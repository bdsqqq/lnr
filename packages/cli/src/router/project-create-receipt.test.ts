import { expect, mock, spyOn, test } from "bun:test";
import { createCli, FailedToExitError } from "trpc-cli";

const core = await import("@bdsqqq/lnr-core");
const id = "12345678-1234-1234-1234-123456789abc";
const project = {
  id, name: "audit", description: "", state: "planned", progress: 0,
  createdAt: new Date(0),
};
let success: boolean | undefined;
let entity: typeof project | null;
let failure: Error | undefined;
let readFailure: Error | undefined;
const read = mock(async () => {
  if (readFailure) throw readFailure;
  return entity;
});
const createProject = mock(async (..._args: unknown[]) => {
  if (failure) throw failure;
  return { success, get project() { return read(); } };
});
mock.module("@bdsqqq/lnr-core", () => ({
  ...core, getClient: () => ({ createProject }),
}));
const handleApiError = mock((error: unknown) => { throw error; });
mock.module("../lib/error", () => ({
  handleApiError,
  exitWithError: (message: string) => { throw new Error(message); },
  EXIT_CODES: { GENERAL_ERROR: 1, NOT_FOUND: 3 },
}));
const { generatedProjectsRouter } = await import("../generated/project");

for (const scenario of ["confirmed", "false", "missing-success", "missing-project", "rejected", "read-rejected"]) {
  test(`project creation receipt through argv and real core: ${scenario}`, async () => {
    success = scenario === "false" ? false : scenario === "missing-success" ? undefined : true;
    entity = scenario === "missing-project" ? null : project;
    failure = scenario === "rejected" ? new Error("sdk rejected create") : undefined;
    readFailure = scenario === "read-rejected" ? new Error("sdk rejected project read") : undefined;
    createProject.mockClear(); read.mockClear(); handleApiError.mockClear();
    const output = spyOn(console, "log").mockImplementation(() => {});
    const errors: unknown[][] = [];
    const previous = process.exitCode;
    try {
      await expect(createCli({ router: generatedProjectsRouter }).run({
        argv: ["project", "new", "--new-name", "audit"],
        logger: { info() {}, error(...args) { errors.push(args); } },
        process: { exit(code): never {
          throw new FailedToExitError("test exit", { exitCode: code, cause: undefined });
        } },
      })).rejects.toMatchObject({ exitCode: scenario === "confirmed" ? 0 : 1 });
      expect(createProject).toHaveBeenCalledTimes(1);
      expect(createProject).toHaveBeenCalledWith({
        name: "audit", description: undefined, teamIds: [], content: undefined,
        leadId: undefined, startDate: undefined, targetDate: undefined,
        priority: undefined, statusId: undefined,
      });
      expect(read).toHaveBeenCalledTimes(success && !failure ? 1 : 0);
      expect(output.mock.calls).toEqual(scenario === "confirmed" ? [[`created project: audit (${id})`]] : []);
      if (failure || readFailure) {
        expect(handleApiError).toHaveBeenCalledWith(failure ?? readFailure);
      } else if (scenario !== "confirmed") {
        expect(errors.flat().map(String).join(" ")).toContain(
          "project creation returned no project; verify the outcome before retrying",
        );
      }
    } finally {
      output.mockRestore();
      process.exitCode = previous;
    }
  });
}
