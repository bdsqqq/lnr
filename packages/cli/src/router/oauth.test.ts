import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCli, FailedToExitError } from "trpc-cli";
import { createOAuthAuthorizationUrl, executeOAuth, pkceChallenge } from "@bdsqqq/lnr-core";
import { createOAuthRouter } from "./oauth";

const coreUrl = import.meta.resolve("@bdsqqq/lnr-core");
const config = await import(new URL("./config.ts", coreUrl).href);
const client = await import(new URL("./client.ts", coreUrl).href);
const request = { operation: "client-credentials", client_id: "id",
  client_secret: "INPUT-SECRET", scope: "read" };
const authorization = { client_id: "id", redirect_uri: "http://localhost/callback",
  scope: "read", state: "state&=" };
const tokens = { access_token: "OUTPUT-TOKEN", token_type: "Bearer", expires_in: 0, scope: "read" };
const json = mock(async (): Promise<unknown> => tokens);
const transfer = mock<NonNullable<Parameters<typeof executeOAuth>[1]>>(async () => ({
  status: 200, redirected: false, json,
}));
const execute = mock<typeof executeOAuth>(input => executeOAuth(input, transfer));
const logger = { info: mock((..._args: unknown[]) => {}), error: mock((..._args: unknown[]) => {}) };
let directory: string, file: string;
let previousExitCode: typeof process.exitCode;
let output: ReturnType<typeof spyOn<typeof process.stdout, "write">>;
const fixture = (value: unknown) => writeFileSync(file, JSON.stringify(value));
const printed = () => output.mock.calls.map(call => String(call[0]));
const result = (value: unknown) => expect(printed()).toEqual([`${JSON.stringify(value)}\n`]);

beforeEach(() => {
  previousExitCode = process.exitCode;
  directory = mkdtempSync(join(tmpdir(), "lnr-oauth-"));
  file = join(directory, "input.json");
  fixture(request);
  execute.mockClear(); transfer.mockReset(); json.mockReset();
  logger.info.mockClear(); logger.error.mockClear();
  json.mockImplementation(async () => tokens);
  transfer.mockImplementation(async () => ({ status: 200, redirected: false, json }));
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
async function run(args: string[]) {
  let status: number | undefined;
  await expect(createCli({ router: createOAuthRouter(execute) }).run({
    argv: ["oauth", ...args], logger,
    process: { exit(value): never {
      status = value;
      throw new FailedToExitError("test exit", { exitCode: value, cause: undefined });
    } },
  })).rejects.toBeInstanceOf(FailedToExitError);
  return status;
}
function noSecrets() {
  expect(JSON.stringify([printed(), logger.info.mock.calls, logger.error.mock.calls]))
    .not.toMatch(/INPUT-SECRET|PROVIDER-SECRET/);
}
test("preview reads the fixture without network or ambient credentials", async () => {
  const key = spyOn(config, "getApiKey").mockImplementation(() => { throw Error("credentials"); });
  const connection = spyOn(client, "getClient").mockImplementation(() => { throw Error("client"); });
  const network = spyOn(globalThis, "fetch").mockImplementation(Object.assign(
    () => { throw Error("network"); }, { preconnect() { throw Error("network"); } },
  ));
  expect(await run(["request", file])).toBe(0);
  expect(execute).toHaveBeenCalledWith({ ...request, execute: false });
  result({ kind: "preview", attempted: false });
  for (const call of [transfer, key, connection, network]) expect(call).not.toHaveBeenCalled();
  noSecrets();
});
test.each(["exchange", "refresh", "client-credentials"])(
  "%s execution requires secret-output consent before calling core", async operation => {
    fixture(operation === "exchange"
      ? { operation, client_id: "id", client_secret: "INPUT-SECRET", code: "code",
        redirect_uri: authorization.redirect_uri }
      : operation === "refresh"
        ? { operation, client_id: "id", client_secret: "INPUT-SECRET", refresh_token: "refresh" }
        : request);
    expect(await run(["request", file, "--execute"])).toBe(1);
    expect(execute).not.toHaveBeenCalled();
    expect(transfer).not.toHaveBeenCalled();
    result({ kind: "invalid", attempted: false }); noSecrets();
  },
);
test.each([true, false])("request-file execute=%s cannot supply consent", async executeFlag => {
  fixture({ ...request, execute: executeFlag });
  expect(await run(["request", file, "--execute", "--show-secrets"])).toBe(1);
  expect(execute).not.toHaveBeenCalled();
  result({ kind: "invalid", attempted: false }); noSecrets();
});
test.each(["null", "[]", '"INPUT-SECRET"', '{"INPUT-SECRET":', "{}"])(
  "invalid local JSON produces only the invalid result: %s", async text => {
    writeFileSync(file, text);
    expect(await run(["request", file])).toBe(1);
    expect(transfer).not.toHaveBeenCalled();
    result({ kind: "invalid", attempted: false }); noSecrets();
  },
);
test.each([
  ["request", "FILE", "--unknown"], ["authorize", "FILE", "--execute"],
  ["pkce", "--execute"], ["pkce"], ["request", "MISSING"],
].map(args => ({ args })))("invalid or orphan flags cannot execute: %j", async ({ args }) => {
  expect(await run(args.map(arg => arg === "FILE" ? file
    : arg === "MISSING" ? join(directory, "missing") : arg))).toBe(1);
  expect(execute).not.toHaveBeenCalled();
  expect(transfer).not.toHaveBeenCalled();
  noSecrets();
});
test("explicit execution and secret output return the exact core token result", async () => {
  expect(await run(["request", file, "--execute", "--show-secrets"])).toBe(0);
  expect(execute).toHaveBeenCalledWith({ ...request, execute: true });
  expect(transfer).toHaveBeenCalledTimes(1);
  result({ kind: "tokens", attempted: true, tokens }); noSecrets();
});
test("revoke needs execution consent but not secret-output consent", async () => {
  fixture({ operation: "revoke", token: "INPUT-SECRET&=", token_type_hint: "refresh_token" });
  expect(await run(["request", file, "--execute"])).toBe(0);
  expect(transfer).toHaveBeenCalledTimes(1);
  expect(transfer).toHaveBeenCalledWith("https://api.linear.app/oauth/revoke", {
    method: "POST", body: "token=INPUT-SECRET%26%3D&token_type_hint=refresh_token",
    redirect: "error", credentials: "omit",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  expect(json).not.toHaveBeenCalled();
  result({ kind: "revoked", attempted: true }); noSecrets();
});
test.each(["http", "transport", "response"] as const)(
  "core %s failure stays attempted without exposing provider content", async reason => {
    json.mockImplementation(async () => ({ error: "PROVIDER-SECRET" }));
    transfer.mockImplementation(async () => {
      if (reason === "transport") throw Error("PROVIDER-SECRET");
      return { status: reason === "http" ? 401 : 200, redirected: false, json };
    });
    expect(await run(["request", file, "--execute", "--show-secrets"])).toBe(1);
    expect(execute).toHaveBeenCalledTimes(1); expect(transfer).toHaveBeenCalledTimes(1);
    result({ kind: "failed", attempted: true, reason }); noSecrets();
  },
);
test("stdout failure neither retries execution nor writes a fallback result", async () => {
  output.mockImplementation((...args: unknown[]) => {
    const callback = args.at(-1);
    if (typeof callback === "function") callback(Error("broken pipe"));
    return false;
  });
  expect(await run(["request", file, "--execute", "--show-secrets"])).toBe(1);
  expect(execute).toHaveBeenCalledTimes(1); expect(transfer).toHaveBeenCalledTimes(1);
  result({ kind: "tokens", attempted: true, tokens });
});
test("authorize returns only its URL; PKCE explicitly opts into verifier output", async () => {
  fixture(authorization);
  expect(await run(["authorize", file])).toBe(0);
  result({ kind: "authorization-url", url: createOAuthAuthorizationUrl(authorization) });
  output.mockClear();
  expect(await run(["pkce", "--show-secrets"])).toBe(0);
  const value = JSON.parse(printed()[0]!);
  expect(value).toEqual({ kind: "pkce", verifier: expect.any(String),
    challenge: pkceChallenge(value.verifier) });
  expect(execute).not.toHaveBeenCalled();
});
test("authorize accepts JSON from stdin without network", async () => {
  const router = new URL("./oauth.ts", import.meta.url).href;
  const proc = Bun.spawn([process.execPath, "--eval", `
    import { createCli } from "trpc-cli";
    import { createOAuthRouter } from ${JSON.stringify(router)};
    globalThis.fetch = () => { throw Error("network forbidden"); };
    await createCli({ router: createOAuthRouter() }).run({ argv: ["oauth", "authorize", "-"] });
  `], { cwd: import.meta.dir, stdin: new TextEncoder().encode(JSON.stringify(authorization)),
    stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited,
  ]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: "" });
  expect(JSON.parse(stdout)).toEqual({ kind: "authorization-url",
    url: createOAuthAuthorizationUrl(authorization) });
});

test("plain authorization requires explicit verifier-output consent; S256 does not", async () => {
  const verifier = "sensitive-verifier-".repeat(3);
  fixture({ ...authorization, code_challenge: verifier, code_challenge_method: "plain" });
  expect(await run(["authorize", file])).toBe(1);
  result({ kind: "invalid", attempted: false });
  expect(JSON.stringify([printed(), logger.error.mock.calls])).not.toContain(verifier);
  output.mockClear();
  expect(await run(["authorize", file, "--show-secrets"])).toBe(0);
  expect(new URL(JSON.parse(printed()[0]!).url).searchParams.get("code_challenge")).toBe(verifier);
  output.mockClear();
  fixture({ ...authorization, code_challenge: pkceChallenge(verifier) });
  expect(await run(["authorize", file])).toBe(0);
  expect(new URL(JSON.parse(printed()[0]!).url).searchParams.get("code_challenge")).toBe(pkceChallenge(verifier));
  expect(printed().join("")).not.toContain(verifier);
  expect(execute).not.toHaveBeenCalled();
});
