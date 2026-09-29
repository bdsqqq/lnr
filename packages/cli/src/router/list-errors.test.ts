import { expect, mock, spyOn, test } from "bun:test";
import { createCli, FailedToExitError } from "trpc-cli";

const core = await import("@bdsqqq/lnr-core");
let failure: Error | undefined;
let phase: "lookup" | "connection" | "empty" | "null";
const connection = mock(async () => {
  if (phase === "connection") throw failure;
  return { nodes: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } };
});
const team = mock(async (..._args: unknown[]) => {
  if (phase === "lookup") throw failure;
  if (phase === "null") return null;
  return { cycles: connection, gitAutomationStates: connection };
});
// Keep both list helpers real; isolate SDK access and user output preferences.
mock.module("@bdsqqq/lnr-core", () => ({
  ...core, getClient: () => ({ team }), getConfigValue: () => "table",
}));
const handleApiError = mock((error: unknown) => { throw error; });
mock.module("../lib/error", () => ({
  handleApiError,
  exitWithError: (message: string) => { throw new Error(message); },
  EXIT_CODES: { GENERAL_ERROR: 1, NOT_FOUND: 3 },
}));
const { appRouter } = await import("./index");

for (const command of ["cycles", "git-branches"]) {
  for (const format of ["json", "quiet", "table"]) {
    for (const scenario of ["lookup", "connection", "empty", "null"] as const) {
      for (const message of scenario === "lookup" || scenario === "connection"
        ? ["permission denied", "network unavailable"] : [undefined]) {
        test(`${command} ${format} ${scenario} ${message ?? "success"}`, async () => {
          phase = scenario;
          failure = message ? new Error(message) : undefined;
          team.mockClear();
          connection.mockClear();
          handleApiError.mockClear();
          const output = spyOn(console, "log").mockImplementation(() => {});
          const errors: unknown[][] = [];
          const previous = process.exitCode;
          try {
            await expect(createCli({ router: appRouter }).run({
              argv: [command, "--team", "ENG", ...(format === "table" ? [] : [`--${format}`])],
              logger: { info() {}, error(...args) { errors.push(args); } },
              process: { exit(code): never {
                throw new FailedToExitError("test exit", { exitCode: code, cause: undefined });
              } },
            })).rejects.toMatchObject({ exitCode: failure ? 1 : 0 });
            expect(team).toHaveBeenCalledTimes(1);
            expect(team).toHaveBeenCalledWith("ENG");
            expect(connection).toHaveBeenCalledTimes(scenario === "lookup" || scenario === "null" ? 0 : 1);
            if (failure) {
              expect(handleApiError).toHaveBeenCalledWith(failure);
              expect(errors.flat().map(String).join(" ")).toContain(message!);
              expect(output.mock.calls).toEqual([]);
            } else {
              expect(handleApiError).not.toHaveBeenCalled();
              expect(errors).toEqual([]);
              if (format === "json") expect(output.mock.calls).toEqual([["[]"]]);
              if (format === "quiet") expect(output.mock.calls).toEqual([]);
              if (format === "table") {
                expect(output.mock.calls).toHaveLength(1);
                expect(String(output.mock.calls[0]?.[0])).toContain("no results");
              }
            }
          } finally {
            output.mockRestore();
            process.exitCode = previous;
          }
        });
      }
    }
  }
}
