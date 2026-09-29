import { expect, mock, spyOn, test } from "bun:test";
import { createCli, FailedToExitError } from "trpc-cli";

const core = await import("@bdsqqq/lnr-core");
let phase: string;
let failure: Error | undefined;
const item = { id: "item", name: "example", type: "issue", createdAt: new Date(0), updatedAt: new Date(0) };
const first = mock(async () => ({ nodes: [item] }));
const connection = mock(async () => {
  if (failure) throw failure;
  return { nodes: phase === "populated" ? [item] : [] };
});
const teams = mock(async (..._args: unknown[]) => {
  if (phase === "lookup") throw failure;
  return { nodes: phase === "missing" ? [] : [
    ...(phase === "later" ? [{ key: "FIRST", templates: first }] : []),
    { key: "ENG", templates: connection },
  ] };
});
// Preserve production list helpers, rendering and error classification.
mock.module("@bdsqqq/lnr-core", () => ({
  ...core, getClient: () => ({ customViews: connection, teams }), getConfigValue: () => "table",
}));
const { appRouter } = await import("./index");
const failures = [
  { message: "network unavailable", code: 1, diagnostic: "network unavailable" },
  { message: "unauthorized", code: 2, diagnostic: "not authenticated" },
  { message: "rate limit exceeded", code: 4, diagnostic: "rate limited" },
  { message: "permission denied", code: 5, diagnostic: "requires a Linear Business or Enterprise plan" },
] as const;

for (const command of ["views", "templates", "scoped-templates"]) {
  const scoped = command === "scoped-templates";
  for (const format of ["json", "quiet", "table"]) {
    const phases = command === "views" ? ["connection", "empty", "populated"]
      : ["lookup", "connection", ...(!scoped ? ["later"] : []), "empty", "missing", "populated"];
    for (const scenario of phases) {
      for (const outcome of ["empty", "missing", "populated"].includes(scenario) ? [undefined] : failures) {
        test(`${command} ${format} ${scenario} ${outcome?.message ?? "success"}`, async () => {
          phase = scenario;
          failure = outcome ? new Error(outcome.message) : undefined;
          teams.mockClear(); connection.mockClear(); first.mockClear();
          const stdout = spyOn(console, "log").mockImplementation(() => {});
          const stderr = spyOn(console, "error").mockImplementation(() => {});
          // exitWithError uses global process; intercept only termination, not classification.
          const exit = spyOn(process, "exit").mockImplementation((code): never => {
            throw new FailedToExitError("production exit", { exitCode: Number(code), cause: undefined });
          });
          const previous = process.exitCode;
          try {
            await expect(createCli({ router: appRouter }).run({
              argv: [scoped ? "templates" : command, ...(scoped ? ["--team", "eng"] : []),
                ...(format === "table" ? [] : [`--${format}`])],
              logger: { info() {}, error() {} },
              process: { exit(code): never {
                throw new FailedToExitError("cli exit", { exitCode: code, cause: undefined });
              } },
            })).rejects.toMatchObject({ exitCode: outcome?.code ?? 0 });
            expect(teams).toHaveBeenCalledTimes(command === "views" ? 0 : 1);
            if (command !== "views") expect(teams.mock.calls[0]).toEqual(
              scoped ? [{ filter: { key: { eq: "ENG" } } }] : [],
            );
            expect(first).toHaveBeenCalledTimes(scenario === "later" ? 1 : 0);
            expect(connection).toHaveBeenCalledTimes(["lookup", "missing"].includes(scenario) ? 0 : 1);
            if (outcome) {
              expect(exit.mock.calls).toEqual([[outcome.code]]);
              expect(stderr.mock.calls.flat().join(" ")).toContain(outcome.diagnostic);
              expect(stdout.mock.calls).toEqual([]);
            } else {
              expect(exit).not.toHaveBeenCalled();
              expect(stderr.mock.calls).toEqual([]);
              if (format === "json") {
                const result = JSON.parse(String(stdout.mock.calls[0]?.[0]));
                expect(result).toHaveLength(scenario === "populated" ? 1 : 0);
                if (scenario === "populated") expect(result[0]).toMatchObject({ id: "item", name: "example" });
              } else if (format === "quiet") {
                expect(stdout.mock.calls).toEqual(scenario === "populated" ? [["item"]] : []);
              } else {
                expect(stdout.mock.calls).toHaveLength(1);
                expect(String(stdout.mock.calls[0]?.[0])).toContain(scenario === "populated" ? "example" : "no results");
              }
            }
          } finally {
            exit.mockRestore(); stdout.mockRestore(); stderr.mockRestore();
            process.exitCode = previous;
          }
        });
      }
    }
  }
}
