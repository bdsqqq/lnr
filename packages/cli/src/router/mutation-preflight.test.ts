import { beforeEach, expect, mock, test } from "bun:test";
import { createCli, FailedToExitError } from "trpc-cli";

const core = await import("@bdsqqq/lnr-core");
const getClient = mock(() => { throw new Error("credential factory reached"); });
mock.module("@bdsqqq/lnr-core", () => ({ ...core, getClient }));
mock.module("../lib/error", () => ({
  handleApiError: (error: unknown) => { throw error; },
  exitWithError: (message: string) => { throw new Error(message); },
  EXIT_CODES: { GENERAL_ERROR: 1, NOT_FOUND: 3 },
}));
const { generatedIssuesRouter } = await import("../generated/issue");
const { generatedProjectsRouter } = await import("../generated/project");
const issues = generatedIssuesRouter.createCaller({});
const projects = generatedProjectsRouter.createCaller({});
beforeEach(() => getClient.mockClear());

test("issue create rejects existing-record actions before credentials", async () => {
  for (const action of [
    { comment: "body" }, { comment: "" },
    { editComment: "C", text: "body" }, { replyTo: "C", text: "body" },
    { deleteComment: "C" }, { react: "C", emoji: "+1" }, { unreact: "R" },
    { archive: true }, { subscribe: true }, { unsubscribe: true },
    { addedReleaseIds: ["R"] }, { removedReleaseIds: ["R"] },
  ]) {
    await expect(issues.issue({
      idOrNew: "new", team: "ENG", title: "test", ...action,
    })).rejects.toThrow();
    expect(getClient).not.toHaveBeenCalled();
  }
});

test("project create rejects existing-record actions before credentials", async () => {
  for (const action of [
    { react: "U", emoji: "+1" }, { unreact: "R" }, { unreact: "" },
    { delete: true }, { subscribe: true }, { unsubscribe: true },
  ]) {
    await expect(projects.project({ name: "new", newName: "test", ...action })).rejects.toThrow();
    expect(getClient).not.toHaveBeenCalled();
  }
});

test("orphan and empty action arguments reject before credentials", async () => {
  for (const idOrNew of ["new", "ENG-1"]) {
    for (const action of [
      { text: "body" }, { text: "" }, { emoji: "+1" }, { emoji: "" },
      { editComment: "C" }, { replyTo: "C", text: "" },
      { editComment: "", text: "body" }, { react: "C" },
      { react: "", emoji: "+1" }, { react: "C", emoji: "" },
      { comment: "" }, { deleteComment: "" }, { unreact: "" },
      { blocks: "" }, { blockedBy: "" }, { relatesTo: "" }, { pr: "" },
    ]) {
      await expect(issues.issue({ idOrNew, team: "ENG", title: "test", ...action })).rejects.toThrow();
      expect(getClient).not.toHaveBeenCalled();
    }
  }
  for (const name of ["new", "existing"]) {
    for (const action of [
      { emoji: "+1" }, { emoji: "" }, { react: "U" },
      { react: "", emoji: "+1" }, { react: "U", emoji: "" }, { unreact: "" },
    ]) {
      await expect(projects.project({ name, newName: "test", ...action })).rejects.toThrow();
      expect(getClient).not.toHaveBeenCalled();
    }
  }
});

test("inactive booleans and supported create followups pass preflight", async () => {
  await expect(issues.issue({
    idOrNew: "new", team: "ENG", title: "test",
    archive: false, subscribe: false, unsubscribe: false,
    blocks: "ENG-2", blockedBy: "ENG-3", relatesTo: "ENG-4",
    pr: "https://github.com/example/repo/pull/1", prioritySortOrder: 0,
  })).rejects.toThrow("credential factory reached");
  await expect(projects.project({
    name: "new", newName: "test", delete: false, subscribe: false, unsubscribe: false,
  })).rejects.toThrow("credential factory reached");
  expect(getClient).toHaveBeenCalledTimes(2);
});

test("preflight preserves existing-record combinations", async () => {
  await expect(issues.issue({
    idOrNew: "ENG-1", react: "C", emoji: "+1", unreact: "R",
    subscribe: true, unsubscribe: true,
  })).rejects.toThrow("credential factory reached");
  await expect(projects.project({
    name: "existing", react: "U", emoji: "+1", unreact: "R",
    subscribe: true, unsubscribe: true,
  })).rejects.toThrow("credential factory reached");
  await expect(issues.issue({
    idOrNew: "ENG-1", editComment: "C", text: "body",
  })).rejects.toThrow("credential factory reached");
  expect(getClient).toHaveBeenCalledTimes(3);
});

test("invalid argv fails before credentials", async () => {
  await expect(createCli({ router: generatedProjectsRouter }).run({
    argv: ["project", "new", "--new-name", "test", "--subscribe"],
    process: { exit(code): never {
      throw new FailedToExitError("test exit", { exitCode: code, cause: undefined });
    } },
    logger: { info: () => {}, error: () => {} },
  })).rejects.toMatchObject({ exitCode: 1 });
  expect(getClient).not.toHaveBeenCalled();
});
