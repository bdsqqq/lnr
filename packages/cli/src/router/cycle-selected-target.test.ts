import { beforeEach, expect, mock, spyOn, test } from "bun:test";
import { createCli, FailedToExitError } from "trpc-cli";

const core = await import("@bdsqqq/lnr-core");
const issue = (identifier: string) => ({
  id: identifier, identifier, title: identifier, priority: 0,
  createdAt: new Date(0), updatedAt: new Date(0), url: "", branchName: "",
});
const makeCycle = (number: number) => ({
  id: `cycle-${number}`, number, name: `cycle ${number}`,
  startsAt: new Date(0), endsAt: new Date(1),
  issues: mock(async () => ({ nodes: [issue(`ENG-${number}`)] })),
});
const selected = makeCycle(12), current = makeCycle(13);
const active = mock(() => Promise.resolve(current));
const cycle = mock(async (id: string) => {
  if (id === selected.id) return selected;
  if (id === current.id) return current;
  throw new Error("wrong cycle");
});
const team = mock(async () => ({
  cycles: async () => ({ nodes: [selected, current] }),
  get activeCycle() { return active(); },
}));
mock.module("@bdsqqq/lnr-core", () => ({
  ...core, getClient: () => ({ cycle, team }),
}));
mock.module("../lib/error", () => ({
  handleApiError: (error: unknown) => { throw error; },
  exitWithError: (message: string) => { throw new Error(message); },
  EXIT_CODES: { GENERAL_ERROR: 1, NOT_FOUND: 3 },
}));
const { cyclesRouter } = await import("./cycles");
beforeEach(() => {
  for (const fn of [cycle, team, active, selected.issues, current.issues]) fn.mockClear();
});
async function argv(args: string[]) {
  let code: number | undefined;
  await expect(createCli({ router: cyclesRouter }).run({
    argv: args, logger: { info() {}, error() {} },
    process: { exit(value): never {
      code = value;
      throw new FailedToExitError("test exit", { exitCode: value, cause: undefined });
    } },
  })).rejects.toBeInstanceOf(FailedToExitError);
  return code;
}
for (const useCurrent of [false, true]) {
  test(`argv reads resolved ${useCurrent ? "current" : "selected"} cycle id`, async () => {
    const output = spyOn(console, "log").mockImplementation(() => {});
    try {
      const args = ["cycle", "12", "--team", "ENG", "--issues", "--json"];
      if (useCurrent) args.push("--current");
      expect(await argv(args)).toBe(0);
      expect(cycle).toHaveBeenCalledTimes(1);
      expect(cycle).toHaveBeenCalledWith(useCurrent ? "cycle-13" : "cycle-12");
      expect(active).toHaveBeenCalledTimes(useCurrent ? 1 : 0);
      expect(useCurrent ? selected.issues : current.issues).not.toHaveBeenCalled();
      expect(JSON.parse(String(output.mock.calls[0]?.[0]))).toMatchObject([
        { identifier: useCurrent ? "ENG-13" : "ENG-12" },
      ]);
    } finally { output.mockRestore(); }
  });
}
