import { expect, mock, spyOn, test } from "bun:test";
import { createCli, FailedToExitError } from "trpc-cli";

const core = await import("@bdsqqq/lnr-core");
let phase: string;
let failure: Error | undefined;
const date = new Date(0);
const cycle = { id: "cycle-id", number: 1, name: "cycle", startsAt: date, endsAt: date, progress: 0 };
const relation = mock((name: string) => phase === name ? Promise.reject(failure)
  : Promise.resolve(name === "activeCycle" && phase === "present" ? cycle : null));
const team = mock(async (..._args: unknown[]) => {
  if (phase === "root") throw failure;
  if (phase === "missing") return null;
  return { get activeCycle() { return relation("activeCycle"); } };
});
const notification = mock(async (..._args: unknown[]) => {
  if (phase === "root") throw failure;
  if (phase === "missing") return null;
  return { id: "notification-id", type: "issue", category: "issue", createdAt: date,
    actorId: "actor-id", get actor() { return relation("actor"); } };
});
const agentSession = mock(async (..._args: unknown[]) => {
  if (phase === "root") throw failure;
  if (phase === "missing") return null;
  return { id: "session-id", status: "active", createdAt: date, updatedAt: date,
    creatorId: "creator-id", appUserId: "app-id", issueId: "issue-id",
    get creator() { return relation("creator"); }, get appUser() { return relation("appUser"); },
    get issue() { return relation("issue"); } };
});
// Only client acquisition/config are replaced: argv dispatch, core reads, output,
// and API error classification remain production code.
let client: object;
mock.module("@bdsqqq/lnr-core", () => ({
  ...core, getClient: () => client, getConfigValue: () => "table",
}));
const { appRouter } = await import("./index");
const failures = [
  { message: "network unavailable", code: 1, diagnostic: "network unavailable" },
  { message: "unauthorized", code: 2, diagnostic: "not authenticated" },
  { message: "permission denied", code: 5, diagnostic: "requires a Linear Business or Enterprise plan" },
  { message: "rate limit exceeded", code: 4, diagnostic: "rate limited" },
  { message: "entity not accessible", code: 5, diagnostic: "requires a Linear Business or Enterprise plan" },
  { message: "entity not found", code: 3, diagnostic: "entity not found" },
];
const routes = [
  { name: "current cycle", argv: ["cycle", "current", "--current", "--team", "ENG"], root: team, args: ["ENG"], phases: ["root", "activeCycle"], id: "cycle-id" },
  { name: "notification", argv: ["notification", "id"], root: notification, args: ["id"], phases: ["root", "actor"], id: "notification-id" },
  { name: "agent session", argv: ["agent-session", "id"], root: agentSession, args: ["id"], phases: ["root", "creator", "appUser", "issue"], id: "session-id" },
];
for (const route of routes) {
  for (const format of ["table", "json", "quiet"]) {
    for (const scenario of [...route.phases, "missing", "present", ...(route.root === team ? ["inactive"] : [])]) {
      for (const outcome of route.phases.includes(scenario) ? failures : [undefined]) {
        test(`${route.name} ${format} ${scenario} ${outcome?.message ?? "control"}`, async () => {
          phase = scenario;
          failure = outcome ? new Error(outcome.message) : undefined;
          client = route.root === team ? { team } : route.root === notification ? { notification } : { agentSession };
          relation.mockClear();
          for (const fn of [team, notification, agentSession]) fn.mockClear();
          const stdout = spyOn(console, "log").mockImplementation(() => {});
          const stderr = spyOn(console, "error").mockImplementation(() => {});
          const exit = spyOn(process, "exit").mockImplementation((code): never => {
            throw new FailedToExitError("production exit", { exitCode: Number(code), cause: undefined });
          });
          const previous = process.exitCode;
          const absent = scenario === "missing" || scenario === "inactive";
          const code = outcome?.code ?? (absent ? route.root === team ? 1 : 3 : 0);
          try {
            await expect(createCli({ router: appRouter }).run({
              argv: [...route.argv, ...(format === "table" ? [] : [`--${format}`])],
              logger: { info() {}, error() {} },
              process: { exit(value): never {
                throw new FailedToExitError("cli exit", { exitCode: value, cause: undefined });
              } },
            // Throwing instead of exiting is caught by the route on null results;
            // assert the original production exit separately.
            })).rejects.toMatchObject({ exitCode: absent ? 1 : code });
            for (const fn of [team, notification, agentSession]) {
              expect(fn.mock.calls).toEqual(fn === route.root ? [route.args] : []);
            }
            const expectedRelations = ["root", "missing"].includes(scenario) ? []
              : route.phases.slice(1, outcome ? route.phases.indexOf(scenario) + 1 : undefined);
            // Exact ordered calls prove one access per relation and no later
            // relation fetch after an earlier rejection.
            expect(relation.mock.calls).toEqual(expectedRelations.map(name => [name]));
            if (code) {
              expect(exit.mock.calls).toEqual(absent ? [[code], [1]] : [[code]]);
              expect(stdout.mock.calls).toEqual([]);
              const diagnostic = stderr.mock.calls.flat().join(" ");
              expect(diagnostic).toContain(outcome?.diagnostic ?? (route.root === team ? "no active cycle" : "not found"));
              if (outcome && outcome.code !== 3) {
                expect(diagnostic).not.toContain("not found");
                expect(diagnostic).not.toContain("no active cycle");
              }
            } else {
              expect(exit).not.toHaveBeenCalled();
              expect(stderr.mock.calls).toEqual([]);
              if (format === "json") {
                expect(JSON.parse(String(stdout.mock.calls[0]?.[0]))).toMatchObject({
                  id: route.id,
                  ...(route.root === notification ? { actorName: null } : {}),
                  ...(route.root === agentSession ? { creatorName: null, appUserName: null, issueIdentifier: null } : {}),
                });
              } else if (format === "quiet") expect(stdout.mock.calls).toEqual([[route.id]]);
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
