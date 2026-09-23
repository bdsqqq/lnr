import { beforeEach, expect, mock, test } from "bun:test";
import { createCli, FailedToExitError } from "trpc-cli";

const core = await import("@bdsqqq/lnr-core");
const createIssue = mock(async (..._args: unknown[]) => ({ success: false }));
const updateIssue = mock(async (..._args: unknown[]) => ({ success: true }));
const updateIssueBatch = mock(async (..._args: unknown[]) => ({ success: true, issues: [] }));
const labels = mock(async () => ({ nodes: [{ id: "label-id", name: "bug" }] }));
const currentLabels = mock(async () => ({ nodes: [{ id: "existing-label" }] }));
const team = {
  id: "team-id", labels,
  cycles: async () => ({ nodes: [{ id: "cycle-id", name: "next", number: 2 }] }),
};
const project = mock(async (..._args: unknown[]) => ({
  projectMilestones: async () => ({ nodes: [{ id: "milestone-id", name: "launch" }] }),
}));
const client = {
  createIssue, updateIssue, updateIssueBatch,
  teams: async () => ({
    nodes: [{ ...team, key: "ENG", name: "test team" }], pageInfo: { hasNextPage: false },
  }),
  issue: async () => ({ team, labels: currentLabels }),
  team: async () => team,
  projects: async () => ({ nodes: [{ id: "new-project-id", name: "new project" }] }),
  project,
};
mock.module("@bdsqqq/lnr-core", () => ({
  ...core,
  getClient: () => client,
  getIssue: async (_client: unknown, identifier: string) => ({
    id: identifier, identifier, title: identifier,
  }),
}));
mock.module("../lib/error", () => ({
  handleApiError: (error: unknown) => { throw error; },
  exitWithError: (message: string) => { throw new Error(message); },
  EXIT_CODES: { GENERAL_ERROR: 1, NOT_FOUND: 3 },
}));
const { generatedIssuesRouter, inferOperation } = await import("../generated/issue");
const caller = generatedIssuesRouter.createCaller({});
beforeEach(() => {
  for (const fn of [createIssue, updateIssue, updateIssueBatch, labels, currentLabels, project]) fn.mockClear();
});

test("each issue update flag reaches the real core and sdk payload", async () => {
  const cases = [
    { flag: { project: "new project" }, payload: { projectId: "new-project-id" } },
    { flag: { cycle: "next" }, payload: { cycleId: "cycle-id" } },
    { flag: { estimate: 0 }, payload: { estimate: 0 } },
    { flag: { dueDate: "2026-10-01" }, payload: { dueDate: "2026-10-01" } },
    { flag: { description: "" }, payload: { description: "" } },
    { flag: { title: "" }, payload: { title: "" } },
  ];
  for (const { flag, payload } of cases) {
    const input = { idOrNew: "ENG-1", ...flag };
    expect(inferOperation(input)).toBe("update");
    await caller.issue(input);
    expect(updateIssue).toHaveBeenLastCalledWith("ENG-1", payload);
  }
  expect(updateIssue).toHaveBeenCalledTimes(cases.length);
});

test("project plus milestone resolves against the requested new project", async () => {
  await caller.issue({
    idOrNew: "ENG-1", project: "new project", milestone: "launch",
    cycle: "next", estimate: 0, dueDate: "2026-10-01",
  });
  expect(project).toHaveBeenCalledWith("new-project-id");
  expect(updateIssue).toHaveBeenCalledTimes(1);
  expect(updateIssue).toHaveBeenCalledWith("ENG-1", {
    projectId: "new-project-id", projectMilestoneId: "milestone-id",
    cycleId: "cycle-id", estimate: 0, dueDate: "2026-10-01",
  });
});

test("milestone without project rejects before mutation", async () => {
  await expect(caller.issue({ idOrNew: "ENG-1", milestone: "launch" }))
    .rejects.toThrow("--project is required");
  expect(updateIssue).not.toHaveBeenCalled();
});

test("batch +label uses atomic addition; bare label retains replacement", async () => {
  await caller["issue batch"]({ issues: "ENG-1,ENG-2", label: "+bug" });
  expect(updateIssueBatch).toHaveBeenLastCalledWith(
    ["ENG-1", "ENG-2"], { addedLabelIds: ["label-id"] },
  );
  expect(currentLabels).not.toHaveBeenCalled();
  await caller["issue batch"]({ issues: "ENG-1,ENG-2", label: "bug" });
  expect(updateIssueBatch).toHaveBeenLastCalledWith(
    ["ENG-1", "ENG-2"], { labelIds: ["label-id"] },
  );
  expect(updateIssueBatch).toHaveBeenCalledTimes(2);
});

test("single label changes never replace a stale read of the current labels", async () => {
  for (const label of ["+bug", "bug", "-bug"]) {
    await caller.issue({ idOrNew: "ENG-1", label });
    expect(updateIssue).toHaveBeenLastCalledWith("ENG-1", {
      [label.startsWith("-") ? "removedLabelIds" : "addedLabelIds"]: ["label-id"],
    });
  }
  expect(currentLabels).not.toHaveBeenCalled();
});

test("argv reaches sdk fields without dropping zero or empty strings", async () => {
  await expect(createCli({ router: generatedIssuesRouter }).run({
    argv: ["issue", "ENG-1", "--project", "new project", "--cycle", "next",
      "--estimate", "0", "--due-date", "2026-10-01", "--description", ""],
    process: { exit(code): never {
      throw new FailedToExitError("test exit", { exitCode: code, cause: undefined });
    } },
    logger: { info: () => {}, error: () => {} },
  })).rejects.toMatchObject({ exitCode: 0 });
  expect(updateIssue).toHaveBeenCalledTimes(1);
  expect(updateIssue).toHaveBeenCalledWith("ENG-1", {
    projectId: "new-project-id", cycleId: "cycle-id", estimate: 0,
    dueDate: "2026-10-01", description: "",
  });
});

test("a rejected issue update does not report success or retry", async () => {
  updateIssue.mockResolvedValueOnce({ success: false });
  await expect(caller.issue({ idOrNew: "ENG-1", estimate: 0 }))
    .rejects.toThrow("verify the outcome before retrying");
  expect(updateIssue).toHaveBeenCalledTimes(1);
});

test("a rejected issue creation does not report success or retry", async () => {
  await expect(caller.issue({ idOrNew: "new", team: "ENG", title: "test" }))
    .rejects.toThrow("verify the outcome before retrying");
  expect(createIssue).toHaveBeenCalledTimes(1);
});
