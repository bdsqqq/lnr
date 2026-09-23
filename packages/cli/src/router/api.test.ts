import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCli, FailedToExitError } from "trpc-cli";
import type { executeApi } from "@bdsqqq/lnr-core";
import { apiRouter, createApiRouter } from "./api";

const coreUrl = import.meta.resolve("@bdsqqq/lnr-core");
const config = await import(new URL("./config.ts", coreUrl).href);
const client = await import(new URL("./client.ts", coreUrl).href);
const valid = { ok: true, executed: false, operation: "query" as const };
const execute = mock<typeof executeApi>(async () => valid);
let directory: string;
let document: string;
let variables: string;
let previousExitCode: typeof process.exitCode;
let output: ReturnType<typeof spyOn<typeof process.stdout, "write">>;

beforeEach(() => {
  previousExitCode = process.exitCode;
  directory = mkdtempSync(join(tmpdir(), "lnr-api-"));
  document = join(directory, "query.graphql");
  variables = join(directory, "variables.json");
  writeFileSync(document, "query { viewer { id } }");
  writeFileSync(variables, '{"secret":"do-not-print"}');
  execute.mockReset();
  execute.mockImplementation(async () => valid);
  output = spyOn(process.stdout, "write").mockImplementation((...args: unknown[]) => {
    const callback = args.at(-1);
    if (typeof callback === "function") callback();
    return true;
  });
});

afterEach(() => {
  mock.restore();
  process.exitCode = previousExitCode;
  rmSync(directory, { recursive: true, force: true });
});

async function runCli(args: string[], realCore = false) {
  const cli = createCli({ router: realCore ? apiRouter : createApiRouter(execute) });
  let code: number | undefined;
  await expect(cli.run({
    argv: ["api", ...args],
    logger: { info: () => {}, error: () => {} },
    process: { exit: (value): never => {
      code = value;
      throw new FailedToExitError("test exit", { exitCode: value, cause: undefined });
    } },
  })).rejects.toBeInstanceOf(FailedToExitError);
  return code;
}

test("argv defaults to offline and forwards variables without printing them", async () => {
  expect(await runCli([document, "--variables", variables])).toBe(0);
  expect(execute).toHaveBeenCalledWith({
    document: "query { viewer { id } }", variables: { secret: "do-not-print" }, execute: false,
  });
  expect(output.mock.calls.map(call => String(call[0]))).toEqual([`${JSON.stringify(valid)}\n`]);
});

test("real offline execution never acquires credentials or uses fetch", async () => {
  const key = spyOn(config, "getApiKey").mockImplementation(() => { throw Error("credentials"); });
  const connection = spyOn(client, "getClient").mockImplementation(() => { throw Error("client"); });
  const fetch = spyOn(globalThis, "fetch").mockImplementation(Object.assign(
    () => { throw Error("network"); }, { preconnect: () => { throw Error("network"); } },
  ));
  expect(await runCli([document], true)).toBe(0);
  expect(key).not.toHaveBeenCalled();
  expect(connection).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

test("explicit execute reaches core through argv", async () => {
  expect(await runCli([document, "--execute"])).toBe(0);
  expect(execute.mock.calls[0]?.[0].execute).toBe(true);
});

test("validate-only stays offline", async () => {
  expect(await runCli([document, "--validate-only"])).toBe(0);
  expect(execute.mock.calls[0]?.[0].execute).toBe(false);
});

test.each([
  { flags: ["--unknown"] }, { flags: ["--execute", "--validate-only"] },
  { flags: ["--variables", "/nonexistent/lnr-api-variables"] },
])("invalid argv prevents execution: %j", async ({ flags }) => {
  expect(await runCli([document, ...flags])).toBe(1);
  expect(execute).not.toHaveBeenCalled();
});

test("missing document fails without execution", async () => {
  expect(await runCli([join(directory, "missing")])).toBe(1);
  expect(execute).not.toHaveBeenCalled();
});

test.each(["null", "[]", '"do-not-print"', '{"secret":"do-not-print"'])(
  "rejects invalid variables without echoing content: %s", async (text) => {
    writeFileSync(variables, text);
    expect(await runCli([document, "--variables", variables])).toBe(1);
    expect(execute).not.toHaveBeenCalled();
    expect(JSON.stringify(output.mock.calls)).not.toContain("do-not-print");
  },
);

test("partial data is printed unchanged and CLI exits nonzero", async () => {
  const result = { ok: false, executed: true, operation: "query" as const,
    data: { viewer: null }, errors: [{ message: "denied", path: ["viewer"] }] };
  execute.mockResolvedValue(result);
  expect(await runCli([document, "--execute"])).toBe(1);
  expect(output.mock.calls.map(call => String(call[0]))).toEqual([`${JSON.stringify(result)}\n`]);
});

test("unexpected errors cannot expose query or variables", async () => {
  execute.mockRejectedValue(Error("do-not-print"));
  expect(await runCli([document])).toBe(1);
  expect(JSON.stringify(output.mock.calls)).not.toContain("do-not-print");
});

test("stdout failure does not reclassify or repeat an attempted operation", async () => {
  execute.mockResolvedValue({ ...valid, executed: true });
  output.mockImplementation((...args: unknown[]) => {
    const callback = args.at(-1);
    if (typeof callback === "function") callback(new Error("broken pipe"));
    return false;
  });
  expect(await runCli([document, "--execute"])).toBe(1);
  expect(execute).toHaveBeenCalledTimes(1);
  expect(output).toHaveBeenCalledTimes(1);
  expect(JSON.parse(String(output.mock.calls[0]![0])).executed).toBe(true);
});

test("production entrypoint accepts stdin without credentials or network", async () => {
  const entrypoint = new URL("../cli.ts", import.meta.url).href;
  const program = `
    globalThis.fetch = () => { throw new Error("network forbidden"); };
    process.argv = ["bun", ${JSON.stringify(entrypoint)}, "api", "-"];
    await import(${JSON.stringify(entrypoint)});
  `;
  const proc = Bun.spawn([process.execPath, "--eval", program], {
    stdin: new TextEncoder().encode("{ viewer { id } }"),
    stdout: "pipe", stderr: "pipe",
    env: { ...process.env, LINEAR_API_KEY: "", LNR_CONFIG_PATH: join(directory, "no-config") },
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited,
  ]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: "" });
  expect(JSON.parse(stdout)).toEqual({ ok: true, executed: false, operation: "query" });
});

test.each([true, false])("production stdout flushes large results before exit: %s", async ok => {
  const entrypoint = new URL("../cli.ts", import.meta.url).href;
  const program = `
    import { mock } from "bun:test";
    const core = await import("@bdsqqq/lnr-core");
    globalThis.fetch = () => { throw new Error("network forbidden"); };
    mock.module("@bdsqqq/lnr-core", () => ({ ...core, executeApi: async () => ({
      ok: ${ok}, executed: true, operation: "query",
      data: { viewer: { id: "x".repeat(2 * 1024 * 1024) } },
      ...(${ok} ? {} : { errors: [{ message: "denied" }] })
    }) }));
    process.argv = ["bun", ${JSON.stringify(entrypoint)}, "api", "-", "--execute"];
    await import(${JSON.stringify(entrypoint)});
  `;
  const proc = Bun.spawn([process.execPath, "--eval", program], {
    cwd: new URL("../..", import.meta.url).pathname,
    stdin: new TextEncoder().encode("{ viewer { id } }"),
    stdout: "pipe", stderr: "pipe",
    env: { ...process.env, LINEAR_API_KEY: "", LNR_CONFIG_PATH: join(directory, "no-config") },
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited,
  ]);
  expect({ code, stderr }).toEqual({
    code: ok ? 0 : 1, stderr: ok ? "" : expect.stringContaining("api command failed"),
  });
  const result = JSON.parse(stdout);
  expect(result.ok).toBe(ok);
  expect(result.data.viewer.id).toHaveLength(2 * 1024 * 1024);
}, 10000);
