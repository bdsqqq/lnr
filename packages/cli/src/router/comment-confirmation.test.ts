import { expect, mock, spyOn, test } from "bun:test";
import { createCli, FailedToExitError } from "trpc-cli";

const core = await import("@bdsqqq/lnr-core");
const issueId = "12345678-1234-1234-1234-123456789abc";
const commentId = "87654321-4321-4321-4321-cba987654321";
const body = "confirmation regression";
let outcome: unknown;
const mutate = async (..._args: unknown[]) => {
  if (outcome instanceof Error) throw outcome;
  return { success: outcome as boolean | undefined };
};
const updateComment = mock(mutate);
const deleteComment = mock(mutate);
const createComment = mock(mutate);
const issue = mock(async () => ({
  id: issueId, identifier: "TEST-1", title: "audit", priority: 0,
  team: { id: "team-id" },
  createdAt: new Date(0), updatedAt: new Date(0), url: "https://example.invalid",
}));
mock.module("@bdsqqq/lnr-core", () => ({
  ...core,
  getClient: () => ({ issue, updateComment, deleteComment, createComment }),
}));
const handleApiError = mock((error: unknown) => { throw error; });
mock.module("../lib/error", () => ({
  handleApiError,
  exitWithError: (message: string) => { throw new Error(message); },
  EXIT_CODES: { GENERAL_ERROR: 1, NOT_FOUND: 3 },
}));
const { generatedIssuesRouter } = await import("../generated/issue");

const cases = [
  {
    action: "update", argv: ["--edit-comment", commentId, "--text", body],
    write: updateComment, args: [commentId, { body }],
    output: `updated comment ${commentId.slice(0, 8)}`,
  },
  {
    action: "deletion", argv: ["--delete-comment", commentId],
    write: deleteComment, args: [commentId],
    output: `deleted comment ${commentId.slice(0, 8)}`,
  },
  {
    action: "reply", argv: ["--reply-to", commentId, "--text", body],
    write: createComment, args: [{ issueId, parentId: commentId, body }],
    output: `replied to comment ${commentId.slice(0, 8)}`,
  },
];

for (const entry of cases) {
  for (const value of [false, undefined, true, "false", 1, {}, new Error("sdk rejected comment")]) {
    test(`comment ${entry.action} argv confirms SDK outcome ${typeof value}:${String(value)}`, async () => {
      outcome = value;
      for (const write of [updateComment, deleteComment, createComment]) write.mockClear();
      issue.mockClear();
      handleApiError.mockClear();
      const output = spyOn(console, "log").mockImplementation(() => {});
      const errors: unknown[][] = [];
      const previous = process.exitCode;
      try {
        await expect(createCli({ router: generatedIssuesRouter }).run({
          argv: ["issue", "TEST-1", ...entry.argv],
          logger: { info() {}, error(...args) { errors.push(args); } },
          process: { exit(code): never {
            throw new FailedToExitError("test exit", { exitCode: code, cause: undefined });
          } },
        })).rejects.toMatchObject({ exitCode: value === true ? 0 : 1 });
        expect(issue).toHaveBeenCalledWith("TEST-1");
        expect(entry.write).toHaveBeenCalledTimes(1);
        expect(entry.write).toHaveBeenCalledWith(...entry.args);
        expect(updateComment.mock.calls.length + deleteComment.mock.calls.length + createComment.mock.calls.length).toBe(1);
        expect(output).toHaveBeenCalledTimes(value === true ? 1 : 0);
        if (value === true) {
          expect(output).toHaveBeenCalledWith(entry.output);
        } else if (value instanceof Error) {
          expect(handleApiError).toHaveBeenCalledWith(value);
        } else {
          expect(errors.flat().map(String).join(" ")).toContain(
            `comment ${entry.action} was not confirmed; verify the outcome before retrying`,
          );
        }
      } finally {
        output.mockRestore();
        process.exitCode = previous;
      }
    });
  }
}
