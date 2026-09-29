import { expect, mock, spyOn, test } from "bun:test";
import { createCli, FailedToExitError } from "trpc-cli";

const core = await import("@bdsqqq/lnr-core");
const issueId = "12345678-1234-1234-1234-123456789abc";
let outcome: unknown;
const archiveIssue = mock(async (..._args: unknown[]) => {
  if (outcome instanceof Error) throw outcome;
  return outcome === undefined ? {} : { success: outcome };
});
const updateIssue = mock(async (..._args: unknown[]) => ({ success: true }));
const issue = mock(async () => ({
  id: issueId, identifier: "TEST-1", title: "audit", priority: 0,
  team: { id: "team-id" },
  createdAt: new Date(0), updatedAt: new Date(0), url: "https://example.invalid",
}));
mock.module("@bdsqqq/lnr-core", () => ({
  ...core,
  getClient: () => ({ issue, archiveIssue, updateIssue }),
}));
const handleApiError = mock((error: unknown) => { throw error; });
mock.module("../lib/error", () => ({
  handleApiError,
  exitWithError: (message: string) => { throw new Error(message); },
  EXIT_CODES: { GENERAL_ERROR: 1, NOT_FOUND: 3 },
}));
const { generatedIssuesRouter } = await import("../generated/issue");

for (const withUpdate of [false, true]) {
  for (const value of [false, undefined, true, "false", 1, {}, new Error("sdk rejected archive")]) {
    test(`archive argv ${withUpdate ? "after update" : "alone"} confirms SDK outcome ${typeof value}:${String(value)}`, async () => {
      outcome = value;
      archiveIssue.mockClear();
      updateIssue.mockClear();
      issue.mockClear();
      handleApiError.mockClear();
      const output = spyOn(console, "log").mockImplementation(() => {});
      const errors: unknown[][] = [];
      const previous = process.exitCode;
      try {
        await expect(createCli({ router: generatedIssuesRouter }).run({
          argv: ["issue", "TEST-1", "--archive", ...(withUpdate ? ["--title", "changed"] : [])],
          logger: { info() {}, error(...args) { errors.push(args); } },
          process: { exit(code): never {
            throw new FailedToExitError("test exit", { exitCode: code, cause: undefined });
          } },
        })).rejects.toMatchObject({ exitCode: value === true ? 0 : 1 });
        expect(issue).toHaveBeenCalledWith("TEST-1");
        expect(archiveIssue).toHaveBeenCalledTimes(1);
        expect(archiveIssue).toHaveBeenCalledWith(issueId);
        expect(updateIssue).toHaveBeenCalledTimes(withUpdate ? 1 : 0);
        if (withUpdate) expect(updateIssue).toHaveBeenCalledWith(issueId, { title: "changed" });
        expect(output.mock.calls).toEqual([
          ...(withUpdate ? [["updated TEST-1"]] : []),
          ...(value === true ? [["archived TEST-1"]] : []),
        ]);
        if (value instanceof Error) {
          expect(handleApiError).toHaveBeenCalledWith(value);
        } else if (value !== true) {
          expect(errors.flat().map(String).join(" ")).toContain(
            "issue archival was not confirmed; verify the outcome before retrying",
          );
        }
      } finally {
        output.mockRestore();
        process.exitCode = previous;
      }
    });
  }
}
