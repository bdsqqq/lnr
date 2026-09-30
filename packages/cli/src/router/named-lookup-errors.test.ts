import { expect, mock, spyOn, test } from "bun:test";
import { createCli, FailedToExitError } from "trpc-cli";

const core = await import("@bdsqqq/lnr-core");
const id = "aabbccdd-1234-5678-9abc-123456789abc";
const common = { id, name: "Example", slugId: "example-slug", description: "",
  createdAt: new Date(0), updatedAt: new Date(1), url: "https://example.com", color: null };
let entity: "initiative" | "roadmap";
let phase: string;
let failure: Error | undefined;
function rejected(root: string, type = "invalid input", path: (string | number)[] = [root]) {
  return { message: "rejected identifier", extensions: { type }, path };
}
async function sdkError(root: "initiative" | "roadmap", errors: ReturnType<typeof rejected>[]) {
  const transport = spyOn(globalThis, "fetch").mockImplementation(Object.assign(
    async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.query).toContain(`query ${root}(`);
      expect(body.variables).toEqual({ id: "fixture-input" });
      return Response.json({ data: null, errors });
    }, { preconnect() { throw new Error("unexpected preconnect"); } },
  ));
  try {
    // Fixture key, intercepted transport: exercise SDK wrapping without a CLI SDK dependency.
    const client = core.createClientWithKey("fixture");
    const error = await client[root]("fixture-input").then(() => { throw new Error("expected SDK rejection"); }, error => error);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(error).toBeInstanceOf(Error);
    return error as Error;
  } finally { transport.mockRestore(); }
}
const identifierErrors = {
  initiative: await sdkError("initiative", [rejected("initiative")]),
  roadmap: await sdkError("roadmap", [rejected("roadmap")]),
};
const owner = mock(async () => {
  if (phase === "owner") throw failure;
  return phase === "populated" ? { id: "owner-id", name: "Owner" } : null;
});
function value() {
  return entity === "initiative" ? { ...common, status: "Planned", health: null, icon: null,
    targetDate: null, startedAt: null, completedAt: null } : { ...common, get owner() { return owner(); } };
}
const direct = mock(async (..._args: unknown[]) => {
  if (phase === "root") throw failure;
  if (phase.startsWith("fallback")) throw identifierErrors[entity];
  return ["missing", "null-fallback"].includes(phase) ? null : value();
});
const list = mock(async (..._args: unknown[]) => {
  if (phase === "fallback-error") throw failure;
  if (phase === "present") throw new Error("list permission denied");
  return { nodes: ["missing", "fallback-missing"].includes(phase) ? [] :
    [phase === "populated" ? { ...value(), id: "wrong-collision-id", name: "EXAMPLE-SLUG" } : value()] };
});
const reaction = mock(async (..._args: unknown[]) => ({ success: true }));
const subscription = mock(async (..._args: unknown[]) => ({ success: true, lastSyncId: 123 }));
mock.module("@bdsqqq/lnr-core", () => ({
  ...core, getConfigValue: () => "table",
  getClient: () => ({ [entity]: direct, [`${entity}s`]: list, deleteReaction: reaction, createNotificationSubscription: subscription }),
}));
const { appRouter } = await import("./index");
const failures = [
  { message: "network unavailable", code: 1, diagnostic: "network unavailable" },
  { message: "unauthorized", code: 2, diagnostic: "not authenticated" },
  { message: "permission denied", code: 5, diagnostic: "requires a Linear Business or Enterprise plan" },
  { message: "entity not accessible", code: 5, diagnostic: "requires a Linear Business or Enterprise plan" },
  { message: "rate limit exceeded", code: 4, diagnostic: "rate limited" },
  { message: "entity not found", code: 3, diagnostic: "entity not found" },
];
for (const kind of ["initiative", "roadmap"] as const) {
  const sdkFailures: { message: string; code: number; diagnostic: string; error: Error }[] = [];
  for (const entry of [
    { name: "nested SDK path", errors: [rejected(kind, "invalid input", [kind, "owner"])] },
    { name: "other SDK root", errors: [rejected(kind, "invalid input", ["user"])] },
    { name: "mixed forbidden", errors: [rejected(kind), rejected(kind, "forbidden")] },
    { name: "mixed network", errors: [rejected(kind), rejected(kind, "network error")] },
  ]) sdkFailures.push({ message: entry.name, code: 1, diagnostic: "rejected identifier",
    error: await sdkError(kind, entry.errors) });
  for (const target of [id, id.toUpperCase(), "eXaMpLe", "EXAMPLE-SLUG", "not-a-uuid"]) {
    for (const format of ["table", "json", "quiet", ...(kind === "initiative" ? ["mutation", "subscribe"] : [])]) {
      for (const scenario of ["root", "fallback-error", ...(kind === "roadmap" ? ["owner"] : []),
        "missing", "fallback-missing", "present", "populated", ...(["eXaMpLe", "EXAMPLE-SLUG"].includes(target) ? ["fallback", "null-fallback"] : [])]) {
        const errors = [
          ...failures.map(outcome => ({ ...outcome, error: new Error(outcome.message) })),
          ...(["root", "owner"].includes(scenario) ? sdkFailures : []),
        ];
        for (const outcome of ["root", "owner", "fallback-error"].includes(scenario) ? errors : [undefined]) {
          // Unmatched non-UUID input is an explicit missing control, not a fixture name alias.
          if (target === "not-a-uuid" && scenario !== "missing") continue;
          test(`${kind} ${target} ${format} ${scenario} ${outcome?.message ?? "control"}`, async () => {
            entity = kind; phase = scenario; failure = outcome?.error;
            for (const fn of [direct, list, owner, reaction, subscription]) fn.mockClear();
            const stdout = spyOn(console, "log").mockImplementation(() => {});
            const stderr = spyOn(console, "error").mockImplementation(() => {});
            const exit = spyOn(process, "exit").mockImplementation((code): never => {
              throw new FailedToExitError("production exit", { exitCode: Number(code), cause: undefined });
            });
            const previous = process.exitCode;
            const absent = ["missing", "fallback-missing"].includes(scenario);
            const code = outcome?.code ?? (absent ? 3 : 0);
            try {
              await expect(createCli({ router: appRouter }).run({
                argv: [kind, target, ...(format === "subscribe" ? ["--subscribe"] : format === "mutation" ? ["--unreact", "reaction-id"] :
                  format === "table" ? [] : [`--${format}`])],
                logger: { info() {}, error() {} },
                process: { exit(value): never {
                  throw new FailedToExitError("cli exit", { exitCode: value, cause: undefined });
                } },
              })).rejects.toMatchObject({ exitCode: absent ? 1 : code });
              expect(direct.mock.calls).toEqual([[target]]);
              expect(list.mock.calls).toEqual(scenario.startsWith("fallback") || ["missing", "null-fallback"].includes(scenario) ? [[]] : []);
              expect(owner.mock.calls).toEqual(kind === "roadmap" && !["root", "missing", "fallback-missing", "fallback-error"].includes(scenario) ? [[]] : []);
              expect(reaction.mock.calls).toEqual(format === "mutation" && code === 0 ? [["reaction-id"]] : []);
              expect(subscription.mock.calls).toEqual(format === "subscribe" && code === 0 ? [[{
                initiativeId: id, notificationSubscriptionTypes: [
                  "initiativeNewComment", "initiativeDescriptionContentChange", "initiativeUpdateCreated", "initiativeUpdatePrompt",
                ],
              }]] : []);
              if (code) {
                // A thrown test exit is caught by the route; genuine null exits first with 3.
                expect(exit.mock.calls).toEqual(absent ? [[3], [1]] : [[code]]);
                expect(stdout.mock.calls).toEqual([]);
                const diagnostic = stderr.mock.calls.flat().join(" ");
                expect(diagnostic).toContain(outcome?.diagnostic ?? "not found");
                if (outcome && code !== 3) expect(diagnostic).not.toContain("not found");
              } else {
                expect(exit).not.toHaveBeenCalled();
                expect(stderr.mock.calls).toEqual([]);
                if (format === "json") expect(JSON.parse(String(stdout.mock.calls[0]?.[0]))).toMatchObject(
                  kind === "initiative" ? { id, description: "", status: "Planned" } :
                    { id, description: "", ownerId: scenario === "populated" ? "owner-id" : null,
                      ownerName: scenario === "populated" ? "Owner" : null });
                else if (format === "quiet") expect(stdout.mock.calls).toEqual([[id]]);
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
}
