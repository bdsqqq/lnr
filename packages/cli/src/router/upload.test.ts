import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { createCli, FailedToExitError } from "trpc-cli";
import { executeUpload } from "@bdsqqq/lnr-core";
import { createUploadRouter } from "./upload";

const file = import.meta.path;
const uploadFile = {
  uploadUrl: "https://storage.example/object?signature=SECRET",
  assetUrl: "https://assets.example/object", headers: [],
};
const descriptor = mock(async (..._args: unknown[]) => ({ success: true, uploadFile }));
const factory = mock(() => ({ fileUpload: descriptor }));
const transfer = mock(async (_url: string, _init: RequestInit) => ({ ok: true, redirected: false }));
let output: ReturnType<typeof spyOn<typeof process.stdout, "write">>;
let exitCode: typeof process.exitCode;
beforeEach(() => {
  exitCode = process.exitCode;
  descriptor.mockClear(); factory.mockClear(); transfer.mockClear();
  transfer.mockImplementation(async () => ({ ok: true, redirected: false }));
  output = spyOn(process.stdout, "write").mockImplementation((...args: unknown[]) => {
    const callback = args.at(-1);
    if (typeof callback === "function") callback();
    return true;
  });
});
afterEach(() => { mock.restore(); process.exitCode = exitCode; });
async function run(args: string[]) {
  let status: number | undefined;
  const cli = createCli({ router: createUploadRouter(
    options => executeUpload(options, factory, transfer),
  ) });
  await expect(cli.run({
    argv: ["upload", ...args], logger: { info() {}, error() {} },
    process: { exit(value): never {
      status = value;
      throw new FailedToExitError("test exit", { exitCode: value, cause: undefined });
    } },
  })).rejects.toBeInstanceOf(FailedToExitError);
  return status;
}
test("upload argv defaults offline, with no client or transfer", async () => {
  expect(await run([file])).toBe(0);
  expect(factory).not.toHaveBeenCalled();
  expect(transfer).not.toHaveBeenCalled();
  expect(JSON.parse(String(output.mock.calls[0]![0]))).toMatchObject({ ok: true, executed: false });
});
test("upload argv reaches actual core descriptor and byte transfer", async () => {
  expect(await run([file, "--execute", "--public", "--filename", "fixture.txt",
    "--content-type", "text/plain"])).toBe(0);
  expect(descriptor).toHaveBeenCalledWith("text/plain", "fixture.txt", Bun.file(file).size,
    { makePublic: true, metaData: undefined });
  const body = transfer.mock.calls[0]![1].body as Blob;
  expect(await body.text()).toBe(await Bun.file(file).text());
  expect(JSON.parse(String(output.mock.calls[0]![0]))).toMatchObject({
    ok: true, executed: true, assetUrl: uploadFile.assetUrl,
  });
  expect(factory).toHaveBeenCalledTimes(1);
  expect(transfer).toHaveBeenCalledTimes(1);
});
test.each([
  ["/nonexistent/lnr-upload"], [file, "--filename", ""],
  [file, "--content-type", "invalid"], [file, "--metadata", file],
  [file, "--unknown"], [import.meta.dir],
].map(args => ({ args })))("bad upload argv fails before credentials: %j", async ({ args }) => {
  expect(await run([...args, "--execute"])).toBe(1);
  expect(factory).not.toHaveBeenCalled();
  expect(transfer).not.toHaveBeenCalled();
});
test("failed storage response exits nonzero without retrying or exposing signed URL", async () => {
  transfer.mockImplementation(async () => ({ ok: false, redirected: false }));
  expect(await run([file, "--execute"])).toBe(1);
  expect(transfer).toHaveBeenCalledTimes(1);
  expect(descriptor).toHaveBeenCalledTimes(1);
  expect(JSON.parse(String(output.mock.calls[0]![0]))).toMatchObject({
    ok: false, executed: true, stage: "transfer",
  });
  expect(JSON.stringify(output.mock.calls)).not.toMatch(/SECRET|signature/);
});
test("stdout failure does not retry or reclassify the upload", async () => {
  output.mockImplementation((...args: unknown[]) => {
    const callback = args.at(-1);
    if (typeof callback === "function") callback(new Error("broken pipe"));
    return false;
  });
  expect(await run([file, "--execute"])).toBe(1);
  expect(descriptor).toHaveBeenCalledTimes(1);
  expect(transfer).toHaveBeenCalledTimes(1);
  expect(output).toHaveBeenCalledTimes(1);
  expect(JSON.parse(String(output.mock.calls[0]![0])).executed).toBe(true);
});
