import { expect, mock, spyOn, test } from "bun:test";
import { createCli, FailedToExitError } from "trpc-cli";

const calls: [string, unknown[]][] = [];
const core = await import("@bdsqqq/lnr-core");
const getClient = mock(() => ({}));
const results = {
  getCycle: { id: "C", number: 1 }, getCurrentCycle: { id: "CURRENT", number: 2 },
  getCycleIssuesById: [], updateCycle: true, deleteCycle: true,
  findTeamByKeyOrName: { id: "T" }, createCycle: { id: "C", number: 1 },
  getView: { id: "V", name: "view" }, getViewPreferences: { effective: {} },
  updateView: true, deleteView: true, createView: { id: "V", name: "view" },
  markNotificationRead: true, archiveNotification: true,
  getInitiative: { id: "I", name: "initiative" }, getInitiativeUpdates: [], getInitiativeExternalLinks: [],
  createReaction: true, deleteReaction: true, createSubscription: "SUB",
  findUserSubscription: "SUB", deleteSubscription: true,
  listGitAutomationStates: [{ id: "A", event: "merge" }], getTeamStates: [{ id: "STATE", name: "Done" }],
  createGitAutomationState: { id: "A", event: "merge" }, updateGitAutomationState: true, deleteGitAutomationState: true,
  listGitAutomationTargetBranches: [{ id: "B", branchPattern: "main" }],
  createGitAutomationTargetBranch: { id: "B", branchPattern: "main" },
  updateGitAutomationTargetBranch: true, deleteGitAutomationTargetBranch: true,
  updateAgentSession: true, getAgentSessionActivities: [],
};
mock.module("@bdsqqq/lnr-core", () => ({ ...core, getClient,
  ...Object.fromEntries(Object.entries(results).map(([name, result]) => [name, (...args: unknown[]) => {
    calls.push([name, args.slice(1)]);
    return Promise.resolve(result);
  }])),
}));
mock.module("../lib/error", () => ({
  handleApiError: (error: unknown) => { throw error; },
  exitWithError: (message: string) => { throw new Error(message); },
  EXIT_CODES: { GENERAL_ERROR: 1, NOT_FOUND: 3 },
}));
const { appRouter } = await import("./index");
const cycle = await import("./cycles"), view = await import("./views");
const automation = await import("./git-automation-states"), branch = await import("./git-automation-target-branches");
const cycleArgv = ["cycle", "1", "--team", "ENG"];
const actions = [["--react", "U", "--emoji", "+1"], ["--unreact", "R"],
  ["--subscribe"], ["--unsubscribe"], ["--updates"], ["--links"]];

async function run(argv: string[]) {
  calls.length = 0;
  getClient.mockClear();
  const errors: string[] = [], previous = process.exitCode;
  const log = spyOn(console, "log").mockImplementation(() => {});
  try {
    await createCli({ router: appRouter }).run({ argv,
      process: { exit(code): never {
        throw new FailedToExitError("test exit", { exitCode: code, cause: undefined });
      } },
      logger: { info() {}, error: (...args) => { errors.push(args.map(String).join(" ")); } },
    });
  } catch (error) {
    expect(error).toBeInstanceOf(FailedToExitError);
    expect(error).toMatchObject({ exitCode: errors.length ? 1 : 0 });
  } finally { process.exitCode = previous; log.mockRestore(); }
  return errors.join("\n");
}
async function control(argv: string[], expected: unknown) {
  expect(await run(argv)).toBe("");
  expect(getClient).toHaveBeenCalledTimes(1);
  expect<unknown>(calls).toEqual(expected);
}
test("ignored manual modes reject before credentials or core effects", async () => {
  const conflicts: string[][] = [];
  for (const [base, fields] of [
    [cycleArgv, [["--name", "changed"], ["--description", ""], ["--starts-at", "2026-10-01"], ["--ends-at", "2026-10-14"]]],
    [["view", "V"], [["--name", "changed"], ["--description", ""], ["--icon", "x"], ["--color", "red"], ["--shared=false"]]],
    [["git-automation", "A", "--team", "ENG"], [["--event", "merge"], ["--state", "Done"], ["--branch", "B"]]],
    [["git-branch", "B", "--team", "ENG"], [["--pattern", "release"], ["--regex=false"]]],
  ] as const) for (const flags of fields) {
    conflicts.push([...base, "--delete", ...flags]);
    if (base[0] === "cycle") conflicts.push([...base, "--current", ...flags], [...base, "--issues", ...flags]);
    if (base[0] === "view") conflicts.push([...base, "--preferences", ...flags]);
  }
  conflicts.push([...cycleArgv, "--current", "--delete"], [...cycleArgv, "--issues", "--delete"],
    ["view", "V", "--preferences", "--delete"], ["notification", "N", "--read", "--archive"],
    ["cycle", "new", "--team", "ENG", "--current"],
    ["cycle", "new", "--team", "ENG", "--starts-at", "2026-10-01", "--ends-at", "2026-10-14", "--delete"],
    ["view", "new", "--name", "view", "--delete"], ["view", "new", "--name", "view", "--preferences"],
    ["git-automation", "new", "--team", "ENG", "--event", "merge", "--delete"],
    ["git-branch", "new", "--team", "ENG", "--pattern", "main", "--delete"]);
  for (const [index, action] of actions.entries()) for (const other of actions.slice(index + 1)) {
    conflicts.push(["initiative", "I", ...action, ...other]);
  }
  for (const argv of conflicts) {
    expect(await run(argv)).toContain(argv[0] + " modes conflict; use separate commands");
    expect(getClient).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  }
});
test("consumed combinations and false selectors retain dispatch and core arguments", async () => {
  await control([...cycleArgv, "--current", "--issues"],
    [["getCurrentCycle", ["ENG"]], ["getCycleIssuesById", ["CURRENT"]]]);
  await control([...cycleArgv, "--current=false", "--issues=false", "--delete=false", "--name", "changed", "--description", ""],
    [["getCycle", ["ENG", "1"]], ["updateCycle", ["C", { name: "changed", description: "", startsAt: undefined, endsAt: undefined }]]]);
  await control(["view", "V", "--preferences=false", "--delete=false", "--shared=false"],
    [["getView", ["V"]], ["updateView", ["V", { name: undefined, description: undefined, icon: undefined, color: undefined, shared: false }]]]);
  await control(["git-branch", "B", "--team", "ENG", "--delete=false", "--regex=false", "--pattern", "release"],
    [["listGitAutomationTargetBranches", ["ENG"]], ["updateGitAutomationTargetBranch", ["B", { branchPattern: "release", isRegex: false }]]]);
  await control(["git-automation", "A", "--team", "ENG", "--delete=false", "--event", "review", "--state", "Done", "--branch", "B"],
    [["listGitAutomationStates", ["ENG"]], ["findTeamByKeyOrName", ["ENG"]], ["getTeamStates", ["T"]],
      ["updateGitAutomationState", ["A", { event: "review", stateId: "STATE", targetBranchId: "B" }]]]);
  await control(["agent-session", "S", "--activities=false", "--external-link", "https://example.com", "--summary", "working"],
    [["updateAgentSession", ["S", { externalLink: "https://example.com", summary: "working" }]]]);
  await control(["agent-session", "S", "--activities=false", "--external-link", "", "--clear-summary"],
    [["updateAgentSession", ["S", { externalLink: "", summary: null }]]]);
  await control(["notification", "N", "--read=false", "--archive"], [["archiveNotification", ["N"]]]);
  await control(["notification", "N", "--read", "--archive=false"], [["markNotificationRead", ["N"]]]);
  await control(["initiative", "I", "--updates", "--links=false", "--subscribe=false", "--unsubscribe=false"],
    [["getInitiative", ["I"]], ["getInitiativeUpdates", ["I"]]]);
  for (const [flags, effect] of [
    [["--react", "U", "--emoji", "+1"], ["createReaction", [{ type: "initiativeUpdate", id: "U" }, "+1"]]],
    [["--unreact", "R"], ["deleteReaction", ["R"]]],
    [["--subscribe"], ["createSubscription", [{ type: "initiative", initiativeId: "I" }]]],
    [["--updates"], ["getInitiativeUpdates", ["I"]]], [["--links"], ["getInitiativeExternalLinks", ["I"]]],
  ] as const) await control(["initiative", "I", ...flags], [["getInitiative", ["I"]], effect]);
  await control(["initiative", "I", "--unsubscribe"], [["getInitiative", ["I"]],
    ["findUserSubscription", [{ type: "initiative", initiativeId: "I" }]], ["deleteSubscription", ["SUB"]]]);
});
test("existing session activity guards still precede credentials", async () => {
  for (const flags of [["--external-link", ""], ["--summary", "working"], ["--clear-summary"]]) {
    expect(await run(["agent-session", "S", "--activities", ...flags])).toContain("cannot use --activities");
    expect(getClient).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  }
});
test("pure inference keeps relative precedence even for rejected combinations", () => {
  expect(cycle.inferOperation({ nameOrNumber: "new", team: "ENG", current: true, delete: true, name: "changed" })).toBe("current");
  expect(view.inferOperation({ nameOrId: "new", delete: true, preferences: true })).toBe("create");
  expect(view.inferOperation({ nameOrId: "V", delete: true, preferences: true, shared: false })).toBe("delete");
  expect(view.inferOperation({ nameOrId: "V", preferences: true, shared: false })).toBe("preferences");
  expect(automation.inferOperation({ idOrEvent: "A", team: "ENG", delete: true, event: "merge" })).toBe("delete");
  expect(branch.inferOperation({ patternOrId: "B", team: "ENG", delete: true, regex: false })).toBe("delete");
});
