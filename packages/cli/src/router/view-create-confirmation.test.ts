import { expect, mock, spyOn, test } from "bun:test";
import { createCli, FailedToExitError } from "trpc-cli";
const core = await import("@bdsqqq/lnr-core");
const viewId = "12345678-1234-1234-1234-123456789abc";
const read = mock(() => Promise.resolve({
  id: viewId, name: "audit", filterData: {}, shared: false,
  createdAt: new Date(0), updatedAt: new Date(0),
}));
let success: boolean | undefined = false;
const createCustomView = mock(async () => ({
  success, get customView() { return read(); },
}));
mock.module("@bdsqqq/lnr-core", () => ({
  ...core, getClient: () => ({ createCustomView }),
}));
mock.module("../lib/error", () => ({
  handleApiError: (error: unknown) => { throw error; },
  exitWithError: (message: string) => { throw new Error(message); },
  EXIT_CODES: { GENERAL_ERROR: 1, NOT_FOUND: 3 },
}));
const { viewsRouter } = await import("./views");
test("view argv cannot print success for an unconfirmed SDK create", async () => {
  const output = spyOn(console, "log").mockImplementation(() => {});
  const previous = process.exitCode;
  try {
    for (success of [false, undefined, true]) {
      read.mockClear(); createCustomView.mockClear(); output.mockClear();
      await expect(createCli({ router: viewsRouter }).run({
        argv: ["view", "new", "--name", "audit"],
        logger: { info() {}, error() {} },
        process: { exit(code): never {
          throw new FailedToExitError("test exit", { exitCode: code, cause: undefined });
        } },
      })).rejects.toMatchObject({ exitCode: success ? 0 : 1 });
      expect(createCustomView).toHaveBeenCalledTimes(1);
      expect(read).toHaveBeenCalledTimes(success ? 1 : 0);
      expect(output).toHaveBeenCalledTimes(success ? 1 : 0);
      if (success) expect(output).toHaveBeenCalledWith(`created view: audit (${viewId})`);
    }
  } finally { output.mockRestore(); process.exitCode = previous; }
});
