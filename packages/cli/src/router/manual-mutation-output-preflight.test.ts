import { expect, mock, test } from "bun:test";
import { createCli, FailedToExitError } from "trpc-cli";
import { normalizeArgv } from "../lib/argv";

const core = await import("@bdsqqq/lnr-core");
const marker = "credential factory reached";
const getClient = mock(() => { throw new Error(marker); });
mock.module("@bdsqqq/lnr-core", () => ({ ...core, getClient }));
mock.module("../lib/error", () => ({
  handleApiError: (error: unknown) => { throw error; },
  exitWithError: (message: string) => { throw new Error(message); },
  EXIT_CODES: { GENERAL_ERROR: 1, NOT_FOUND: 3 },
}));
const { appRouter } = await import("./index");

// Controls stop at the credential factory; no successful API execution is claimed.
async function check(argv: string[], accesses: number, message: string) {
  getClient.mockClear();
  const errors: string[] = [];
  const previous = process.exitCode;
  try {
    await expect(createCli({ router: appRouter }).run({
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
const modes = ["json", "quiet", "verbose"];
const writes = [
  ["agent-session", "S", "--external-link", "https://example.com"],
  ["agent-session", "S", "--summary", "working"], ["agent-session", "S", "--clear-summary"],
  ["notification", "N", "--read"], ["notification", "N", "--archive"],
  ["notification", "N", "--read", "--archive"],
  ["initiative", "I", "--react", "U", "--emoji", "+1"], ["initiative", "I", "--unreact", "R"],
  ["initiative", "I", "--subscribe"], ["initiative", "I", "--unsubscribe"],
  ["view", "new", "--name", "test"], ["view", "V", "--name", "renamed"],
  ["view", "V", "--description", ""], ["view", "V", "--shared=false"],
  ["view", "V", "--delete"], ["view", "V", "--delete", "--preferences", "--name", "renamed"],
  ["cycle", "new", "--team", "ENG", "--starts-at", "2026-10-01", "--ends-at", "2026-10-14"],
  ["cycle", "1", "--team", "ENG", "--name", "renamed"],
  ["cycle", "1", "--team", "ENG", "--description", ""], ["cycle", "1", "--team", "ENG", "--delete"],
  ["git-automation", "new", "--team", "ENG", "--event", "merge"],
  ["git-automation", "A", "--team", "ENG", "--event", "merge"],
  ["git-automation", "A", "--team", "ENG", "--state", "Done"],
  ["git-automation", "A", "--team", "ENG", "--branch", "B"],
  ["git-automation", "A", "--team", "ENG", "--delete"],
  ["git-branch", "new", "--team", "ENG", "--pattern", "main"],
  ["git-branch", "B", "--team", "ENG", "--pattern", "release"],
  ["git-branch", "B", "--team", "ENG", "--regex=false"], ["git-branch", "B", "--team", "ENG", "--delete"],
];
test("all manual write branches reject unsupported modes before credentials", async () => {
  for (const args of writes) {
    for (const mode of modes) await check([...args, "--" + mode], 0, "--" + mode + " is not supported");
  }
});
test("default writes and false output flags retain admission", async () => {
  for (const args of writes) {
    await check(args, 1, marker);
    await check([...args, "--json=false", "--quiet=false", "--verbose=false"], 1, marker);
  }
});
test("read branches retain their output modes and existing inference precedence", async () => {
  for (const args of [
    ["agent-session", "S"], ["agent-session", "S", "--activities"],
    ["agent-session", "S", "--clear-summary=false"], ["notification", "N"],
    ["notification", "N", "--read=false", "--archive=false"],
    ["initiative", "I"], ["initiative", "I", "--updates"], ["initiative", "I", "--links"],
    ["initiative", "I", "--subscribe=false", "--unsubscribe=false"],
    ["view", "V"], ["view", "V", "--preferences"], ["view", "V", "--preferences", "--name", "ignored"],
    ["cycle", "1", "--team", "ENG"], ["cycle", "1", "--team", "ENG", "--issues"],
    ["cycle", "new", "--team", "ENG", "--current", "--delete", "--name", "ignored"],
    ["git-automation", "A", "--team", "ENG"], ["git-branch", "B", "--team", "ENG"],
    ["agent-sessions"], ["notifications"], ["initiatives"], ["views"], ["cycles", "--team", "ENG"],
    ["git-automations", "--team", "ENG"], ["git-branches", "--team", "ENG"],
  ]) {
    for (const mode of modes) await check([...args, "--" + mode], 1, marker);
  }
});
test("false selectors do not suppress data writes", async () => {
  for (const args of [
    ["agent-session", "S", "--clear-summary=false", "--summary", "working"],
    ["notification", "N", "--read=false", "--archive"],
    ["initiative", "I", "--subscribe=false", "--unsubscribe"],
    ["view", "V", "--preferences=false", "--shared=false"],
    ["cycle", "1", "--team", "ENG", "--current=false", "--name", "renamed"],
    ["git-automation", "A", "--team", "ENG", "--delete=false", "--event", "merge"],
    ["git-branch", "B", "--team", "ENG", "--delete=false", "--regex=false"],
  ]) {
    await check([...args, "--json"], 0, "--json is not supported");
    await check(args, 1, marker);
  }
});
