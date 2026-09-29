import { expect, mock, spyOn, test } from "bun:test";
import { createCli, FailedToExitError } from "trpc-cli";

const core = await import("@bdsqqq/lnr-core");
let phase: string;
let failure: Error | undefined;
const fields = {
  id: "issue-id", identifier: "ENG-1", title: "example", description: "",
  priority: 0, createdAt: new Date(0), updatedAt: new Date(0),
  url: "https://example.com", branchName: "eng-1",
};
const relation = (name: string) => phase === name ? Promise.reject(failure) : Promise.resolve(null);
const comments = mock(async () => ({ nodes: [] }));
const issue = mock(async (..._args: unknown[]) => {
  if (phase === "root") throw failure;
  if (phase === "missing") return null;
  return { ...fields, comments,
    get state() { return relation("state"); }, get assignee() { return relation("assignee"); },
    get parent() { return relation("parent"); } };
});
const cycleFields = {
  id: "cycle-id", number: 12, name: "Sprint", description: "",
  startsAt: new Date(0), endsAt: new Date(1), completedAt: undefined, progress: 0,
};
const cycles = mock(async () => {
  if (phase === "connection") throw failure;
  return { nodes: phase === "empty" ? [] : [cycleFields], pageInfo: { hasNextPage: false, hasPreviousPage: false } };
});
const team = mock(async (..._args: unknown[]) => {
  if (phase === "root") throw failure;
  return phase === "missing" ? null : { cycles };
});
// Preserve real detail helpers, rendering, and production error classification.
mock.module("@bdsqqq/lnr-core", () => ({
  ...core, getClient: () => ({ issue, team }), getConfigValue: () => "table",
}));
const { appRouter } = await import("./index");
const failures = [
  { message: "network unavailable", code: 1, diagnostic: "network unavailable" },
  { message: "unauthorized", code: 2, diagnostic: "not authenticated" },
  { message: "permission denied", code: 5, diagnostic: "requires a Linear Business or Enterprise plan" },
  { message: "rate limit exceeded", code: 4, diagnostic: "rate limited" },
  { message: "entity not accessible", code: 5, diagnostic: "requires a Linear Business or Enterprise plan" },
  { message: "issue not found", code: 3, diagnostic: "issue not found" },
];
for (const entity of ["issue", "cycle"]) {
  const phases = entity === "issue" ? ["root", "state", "assignee", "parent"] : ["root", "connection"];
  for (const format of entity === "issue" ? ["table", "json"] : ["table", "json", "quiet"]) {
    for (const scenario of [...phases, "missing", ...(entity === "cycle" ? ["empty", "unmatched", "name", "number"] : ["present"])]) {
      for (const outcome of phases.includes(scenario) ? failures : [undefined]) {
        test(`${entity} ${format} ${scenario} ${outcome?.message ?? "control"}`, async () => {
          phase = scenario;
          failure = outcome ? new Error(outcome.message) : undefined;
          for (const fn of [issue, team, cycles, comments]) fn.mockClear();
          const stdout = spyOn(console, "log").mockImplementation(() => {});
          const stderr = spyOn(console, "error").mockImplementation(() => {});
          const exit = spyOn(process, "exit").mockImplementation((code): never => {
            throw new FailedToExitError("production exit", { exitCode: Number(code), cause: undefined });
          });
          const previous = process.exitCode;
          const absent = ["missing", "empty", "unmatched"].includes(scenario);
          const code = outcome?.code ?? (absent ? 3 : 0);
          try {
            const target = entity === "issue" ? "ENG-1" : scenario === "name" ? "sPrInT" : scenario === "unmatched" ? "unknown" : "12";
            await expect(createCli({ router: appRouter }).run({
              argv: [entity, target, ...(entity === "cycle" ? ["--team", "ENG"] : []),
                ...(format === "table" ? [] : [`--${format}`])],
              logger: { info() {}, error() {} },
              process: { exit(value): never {
                throw new FailedToExitError("cli exit", { exitCode: value, cause: undefined });
              } },
            // Null-result exits occur inside the route's try block. The test-only
            // thrown exit is caught there; assert the first production exit below.
            })).rejects.toMatchObject({ exitCode: absent ? 1 : code });
            // Successful issue detail separately fetches comments through client.issue.
            expect(issue.mock.calls).toEqual(entity === "issue" ? (code === 0 ? [["ENG-1"], ["issue-id"]] : [["ENG-1"]]) : []);
            expect(team.mock.calls).toEqual(entity === "cycle" ? [["ENG"]] : []);
            expect(cycles.mock.calls).toEqual(entity === "cycle" && !["root", "missing"].includes(scenario) ? [[]] : []);
            if (code) {
              expect(exit.mock.calls).toEqual(absent ? [[3], [1]] : [[code]]);
              expect(stdout.mock.calls).toEqual([]);
              expect(stderr.mock.calls.flat().join(" ")).toContain(outcome?.diagnostic ?? "not found");
              if (code !== 3) expect(stderr.mock.calls.flat().join(" ")).not.toContain("not found");
              expect(comments).not.toHaveBeenCalled();
            } else {
              expect(exit).not.toHaveBeenCalled();
              expect(stderr.mock.calls).toEqual([]);
              if (format === "json") {
                expect(JSON.parse(String(stdout.mock.calls[0]?.[0]))).toMatchObject(
                  entity === "issue" ? { id: "issue-id", state: null, assignee: null, parentId: null } : { id: "cycle-id", number: 12, name: "Sprint" },
                );
              } else if (format === "quiet") expect(stdout.mock.calls).toEqual([["cycle-id"]]);
              else expect(stdout.mock.calls.length).toBeGreaterThan(0);
            }
          } finally {
            exit.mockRestore(); stdout.mockRestore(); stderr.mockRestore(); process.exitCode = previous;
          }
        });
      }
    }
  }
}
