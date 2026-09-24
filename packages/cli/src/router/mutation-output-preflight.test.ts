import { expect, mock, test } from "bun:test";
import { createCli, FailedToExitError } from "trpc-cli";
import { normalizeArgv } from "../lib/argv";
import { t } from "./trpc";

const core = await import("@bdsqqq/lnr-core");
const marker = "credential factory reached";
const getClient = mock(() => { throw new Error(marker); });
mock.module("@bdsqqq/lnr-core", () => ({ ...core, getClient }));
mock.module("../lib/error", () => ({
  handleApiError: (error: unknown) => { throw error; },
  exitWithError: (message: string) => { throw new Error(message); },
  EXIT_CODES: { GENERAL_ERROR: 1, NOT_FOUND: 3 },
}));
const { generatedIssuesRouter } = await import("../generated/issue");
const { generatedProjectsRouter } = await import("../generated/project");
const { generatedDocsRouter } = await import("../generated/doc");
const { generatedLabelsRouter } = await import("../generated/label");
const router = t.mergeRouters(generatedIssuesRouter, generatedProjectsRouter,
  generatedDocsRouter, generatedLabelsRouter);
const caller = router.createCaller({});

// Valid controls establish admission, not successful API execution.
async function check(argv: string[], accesses: number, message?: string) {
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
    if (message !== undefined) expect(errors.join("\n")).toContain(message);
    expect(getClient).toHaveBeenCalledTimes(accesses);
  } finally { process.exitCode = previous; }
}

const mutations = [
  { command: "issue", modes: ["json"], args: [
    ["new", "--team", "ENG", "--title", "test"], ["ENG-1", "--title", "revised"],
    ["ENG-1", "--archive"], ["ENG-1", "--title", "revised", "--archive"],
    ["ENG-1", "--comment", "body"], ["ENG-1", "--subscribe"],
    ["ENG-1", "--react", "C", "--emoji", "+1"],
  ] },
  { command: "project", modes: ["json", "quiet", "verbose"], args: [
    ["new", "--new-name", "test"], ["Apollo", "--description", ""],
    ["Apollo", "--delete"], ["Apollo", "--subscribe"], ["Apollo", "--react", "U", "--emoji", "+1"],
  ] },
  { command: "doc", modes: ["json", "quiet", "verbose"], args: [
    ["new", "--title", "test"], ["D", "--content", ""], ["D", "--delete"],
  ] },
  { command: "label", modes: ["json"], args: [
    ["new", "--team", "ENG", "--name", "test"], ["L", "--name", "revised"], ["L", "--delete"],
  ] },
] as const;

test("singular mutations reject advertised output modes before credentials; defaults remain admitted", async () => {
  for (const { command, modes, args } of mutations) {
    for (const mutation of args) {
      for (const mode of modes) {
        await check([command, ...mutation, "--" + mode], 0, "--" + mode + " is not supported");
      }
      await check([command, ...mutation], 1, marker);
    }
  }
});
test("unadvertised output modes remain invalid options", async () => {
  for (const args of [
    ["issue", "ENG-1", "--title", "revised", "--quiet"],
    ["issue", "ENG-1", "--title", "revised", "--verbose"],
    ["label", "L", "--name", "revised", "--quiet"],
    ["label", "L", "--name", "revised", "--verbose"],
    ["issue", "batch", "ENG-1", "--priority", "high", "--verbose"],
    ["project milestone", "launch", "--project", "Apollo", "--new-name", "renamed", "--quiet"],
  ]) await check(args, 0);
});
test("batch keeps individual json/quiet modes but rejects their combination", async () => {
  for (const command of [["issue", "batch"], ["issue batch"]]) {
    const args = [...command, "ENG-1,ENG-2", "--priority", "high"];
    for (const mode of ["json", "quiet"]) await check([...args, "--" + mode], 1, marker);
    await check([...args, "--json", "--quiet"], 0, "choose one output mode");
  }
});
test("milestone output retains existing precedence and formats", async () => {
  for (const args of [
    ["new", "--new-name", "launch"], ["launch", "--new-name", "renamed"],
    ["launch", "--description", ""], ["launch", "--target-date", "2026-10-01"],
    ["launch"], ["new", "--new-name", "launch", "--delete"],
  ]) await check(["project milestone", ...args, "--project", "Apollo", "--json"], 1, marker);
  for (const extra of [[], ["--new-name", "renamed"]]) {
    const args = ["project milestone", "launch", "--project", "Apollo", "--delete", ...extra];
    await check([...args, "--json"], 0, "--json is not supported");
    await check(args, 1, marker);
  }
});
test("read and list output admission remains unchanged", async () => {
  for (const [args, modes] of [
    [["issue", "ENG-1"], ["json"]], [["label", "L"], ["json"]],
    [["project", "Apollo"], ["json", "quiet", "verbose"]], [["doc", "D"], ["json", "quiet", "verbose"]],
    [["issues"], ["json", "quiet", "verbose"]], [["projects"], ["json", "quiet", "verbose"]],
    [["docs"], ["json", "quiet", "verbose"]], [["labels"], ["json", "quiet", "verbose"]],
  ] as const) {
    for (const mode of modes) await check([...args, "--" + mode], 1, marker);
  }
});
test("false output flags are inactive", async () => {
  for (const invoke of [
    () => caller.issue({ idOrNew: "ENG-1", title: "revised", json: false }),
    () => caller.project({ name: "Apollo", delete: true, json: false, quiet: false, verbose: false }),
    () => caller.doc({ id: "D", content: "", json: false, quiet: false, verbose: false }),
    () => caller.label({ id: "L", delete: true, json: false }),
    () => caller["issue batch"]({ issues: "ENG-1", priority: "high", json: false, quiet: false }),
    () => caller["project milestone"]({ nameOrNew: "launch", project: "Apollo", delete: true, json: false }),
  ]) {
    getClient.mockClear();
    await expect(invoke()).rejects.toThrow(marker);
    expect(getClient).toHaveBeenCalledTimes(1);
  }
});
