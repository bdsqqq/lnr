import { expect, mock, test } from "bun:test";
import { createCli, FailedToExitError } from "trpc-cli";
import { t } from "./trpc";
import { normalizeArgv } from "../lib/argv";

const core = await import("@bdsqqq/lnr-core");
const credentialMarker = "credential factory reached";
const getClient = mock(() => { throw new Error(credentialMarker); });
mock.module("@bdsqqq/lnr-core", () => ({ ...core, getClient }));
mock.module("../lib/error", () => ({
  handleApiError: (error: unknown) => { throw error; },
  exitWithError: (message: string) => { throw new Error(message); },
  EXIT_CODES: { GENERAL_ERROR: 1, NOT_FOUND: 3 },
}));
const issue = await import("../generated/issue");
const project = await import("../generated/project");
const doc = await import("../generated/doc");
const label = await import("../generated/label");
const router = t.mergeRouters(issue.generatedIssuesRouter, project.generatedProjectsRouter,
  doc.generatedDocsRouter, label.generatedLabelsRouter);
const caller = router.createCaller({});

// Valid controls prove admission, not execution: the credential factory deliberately stops them.
async function checkArgv(argv: string[], message: string, accesses: number) {
  getClient.mockClear();
  const errors: string[] = [];
  const previous = process.exitCode;
  try {
    await expect(createCli({ router }).run({
      argv: normalizeArgv(argv),
      process: { exit(code): never {
        throw new FailedToExitError("test exit", { exitCode: code, cause: undefined });
      } },
      logger: { info() {}, error: (...args) => { errors.push(args.map(String).join(" ")); } },
    })).rejects.toMatchObject({ exitCode: 1 });
    expect(errors.join("\n")).toContain(message);
    expect(getClient).toHaveBeenCalledTimes(accesses);
  } finally { process.exitCode = previous; }
}
const issueReads = ["branch", "open", "comments", "sub-issues"];
const projectReads = ["issues", "updates", "labels", "show-status", "milestones", "links"];

test("batch argv normalization preserves values and unrelated routes", () => {
  expect(normalizeArgv(["issue", "batch", "ENG-1,ENG-2", "--label", "two words"]))
    .toEqual(["issue batch", "ENG-1,ENG-2", "--label", "two words"]);
  for (const argv of [
    ["issue", "ENG-1", "--title", "batch"], ["issue", "--help"],
    ["issue batch", "ENG-1", "--state", "Done"], ["oauth", "authorize"],
  ]) expect(normalizeArgv(argv)).toEqual(argv);
});

test("show-only actions reject mutating modes before credentials", async () => {
  for (const flag of issueReads) {
    for (const [mode, args] of [
      ["create", ["new", "--team", "ENG", "--title", "test"]],
      ["update", ["ENG-1", "--title", "revised"]],
      ["archive", ["ENG-1", "--archive"]],
    ] as const) {
      await checkArgv(["issue", ...args, "--" + flag],
        "issue read actions cannot be combined with " + mode, 0);
    }
  }
  for (const flag of projectReads) {
    for (const [mode, args] of [
      ["create", ["new", "--new-name", "test"]],
      ["update", ["Apollo", "--description", "revised"]],
      ["delete", ["Apollo", "--delete"]],
    ] as const) {
      await checkArgv(["project", ...args, "--" + flag],
        "project read actions cannot be combined with " + mode, 0);
    }
  }
});
test("read-action pairs reject; every standalone action is admitted", async () => {
  for (const [command, id, flags] of [
    ["issue", "ENG-1", issueReads], ["project", "Apollo", projectReads],
  ] as const) {
    for (const [index, flag] of flags.entries()) {
      await checkArgv([command, id, "--" + flag], credentialMarker, 1);
      for (const other of flags.slice(index + 1)) {
        await checkArgv([command, id, "--" + flag, "--" + other],
          "only one " + command + " read action allowed", 0);
      }
    }
  }
});
test("project deletion rejects active mutators, including zero and empty text", async () => {
  for (const flags of [
    ["--new-name", "renamed"], ["--description", ""], ["--content", ""],
    ["--status", "started"], ["--start-date", "2026-10-01"],
    ["--target-date", "2026-11-01"], ["--priority", "0"],
    ["--lead", "@me"], ["--team", "ENG"],
    ["--react", "U", "--emoji", "+1"], ["--unreact", "R"],
    ["--subscribe"], ["--unsubscribe"],
  ]) {
    await checkArgv(["project", "Apollo", "--delete", ...flags],
      "--delete cannot be combined with project mutation flags", 0);
  }
});
test("doc/label creation rejects deletion; deletion rejects mutations", async () => {
  await checkArgv(["doc", "new", "--title", "test", "--delete"],
    "--delete requires an existing doc", 0);
  await checkArgv(["label", "new", "--name", "test", "--team", "ENG", "--delete"],
    "--delete requires an existing label", 0);
  for (const flags of [["--title", "revised"], ["--content", ""]]) {
    await checkArgv(["doc", "D", "--delete", ...flags],
      "--delete cannot be combined with doc mutation flags", 0);
  }
  for (const flags of [
    ["--name", "revised"], ["--color", "#ffffff"],
    ["--description", ""], ["--group-type", "null"],
  ]) {
    await checkArgv(["label", "L", "--delete", ...flags],
      "--delete cannot be combined with label mutation flags", 0);
  }
  for (const flags of [["--owner-id", "null"], ["--project", "Apollo"]]) {
    await checkArgv(["doc", "D", "--delete", ...flags], "cannot be combined with --delete", 0);
  }
});
test("batch rejects blank fields even with another effective update", async () => {
  for (const flag of ["state", "assignee", "priority", "label"]) {
    for (const value of ["", " ", "\t\n"]) {
      const companion = flag === "priority" ? ["--state", "Done"] : ["--priority", "high"];
      await checkArgv(["issue", "batch", "ENG-1,ENG-2", "--" + flag, value, ...companion],
        "--" + flag + " must not be blank", 0);
    }
  }
});
test("supported writes, selectors and nonblank batch values reach credentials", async () => {
  for (const argv of [
    ["project", "Apollo", "--delete"], ["doc", "D", "--delete"], ["label", "L", "--delete"],
    ["doc", "new", "--title", "test", "--content", "", "--project", "Apollo"],
    ["label", "new", "--name", "test", "--team", "ENG"],
    ["issue", "ENG-1", "--title", "", "--estimate", "0", "--archive"],
    ["issue", "ENG-1", "--project", "Apollo", "--milestone", "launch"],
    ["issue", "ENG-1", "--comment", "body", "--blocks", "ENG-2"],
    ["issue", "ENG-1", "--subscribe", "--unsubscribe"],
    ["issue", "new", "--team", "ENG", "--title", "test", "--blocks", "ENG-2",
      "--blocked-by", "ENG-3", "--relates-to", "ENG-4",
      "--pr", "https://github.com/example/repo/pull/1", "--priority-sort-order", "0"],
    ["project", "Apollo", "--priority", "0", "--description", "",
      "--react", "U", "--emoji", "+1", "--unreact", "R", "--subscribe", "--unsubscribe"],
    ["issue", "batch", "ENG-1,ENG-2", "--priority", "0"],
    ["issue", "batch", "ENG-1,ENG-2", "--priority", "none"],
    ["issue", "batch", "ENG-1,ENG-2", "--state", "Done", "--assignee", "@me"],
    ["issue", "batch", "ENG-1,ENG-2", "--label", "bug"],
    ["issue", "batch", "ENG-1,ENG-2", "--label", "+bug"],
  ]) await checkArgv(argv, credentialMarker, 1);
});
test("false action booleans remain inactive without suppressing false-valued data mutations", async () => {
  for (const invoke of [
    () => caller.issue({ idOrNew: "ENG-1", branch: true, open: false, comments: false,
      subIssues: false, subscribe: false, unsubscribe: false }),
    () => caller.issue({ idOrNew: "ENG-1", title: "revised", branch: false, open: false,
      comments: false, subIssues: false }),
    () => caller.project({ name: "Apollo", issues: true, updates: false, labels: false,
      showStatus: false, milestones: false, links: false, subscribe: false, unsubscribe: false }),
    () => caller.project({ name: "Apollo", delete: true, subscribe: false, unsubscribe: false,
      issues: false, updates: false, labels: false, showStatus: false, milestones: false, links: false }),
    () => caller.doc({ id: "new", title: "test", delete: false }),
    () => caller.label({ id: "new", name: "test", team: "ENG", delete: false }),
  ]) {
    getClient.mockClear();
    await expect(invoke()).rejects.toThrow(credentialMarker);
    expect(getClient).toHaveBeenCalledTimes(1);
  }
  getClient.mockClear();
  await expect(caller.issue({ idOrNew: "ENG-1", inheritsSharedAccess: false, comments: true }))
    .rejects.toThrow("issue read actions cannot be combined with update");
  expect(getClient).not.toHaveBeenCalled();
});
test("relative operation precedence remains; inactive subscription booleans do not select writes", () => {
  expect(issue.inferOperation({ idOrNew: "ENG-1", archive: true, title: "revised" })).toBe("update");
  expect(project.inferOperation({ name: "Apollo", delete: true, description: "revised" })).toBe("delete");
  expect(doc.inferOperation({ id: "new", delete: true, title: "test" })).toBe("create");
  expect(label.inferOperation({ id: "new", delete: true, name: "test" })).toBe("create");
  expect(issue.inferOperation({ idOrNew: "ENG-1", subscribe: false, unsubscribe: false })).toBe("read");
  expect(project.inferOperation({ name: "Apollo", subscribe: false, unsubscribe: false })).toBe("read");
  expect(issue.inferOperation({ idOrNew: "ENG-1", inheritsSharedAccess: false })).toBe("update");
});
