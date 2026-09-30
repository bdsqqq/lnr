import { expect, mock, spyOn, test } from "bun:test";
import { createCli, FailedToExitError } from "trpc-cli";

const core = await import("@bdsqqq/lnr-core");
let initial: string[] = [];
let later: string[] = [];
let failure: Error | undefined;
let malformed = false;
let confirmation: unknown = true;
const events: string[] = [];
const nextCalls: unknown[][] = [];
const subscribers = mock(async () => {
  events.push("subscribers");
  const connection = {
    nodes: initial.map(id => ({ id })),
    pageInfo: { hasNextPage: true, startCursor: "start", endCursor: "a" },
    async fetchNext(...args: unknown[]) {
      nextCalls.push(args);
      events.push("next");
      if (failure) throw failure;
      // Bound a missing/repeated-cursor control instead of letting it hang.
      if (nextCalls.length > 2) throw new Error("unexpected extra page request");
      connection.nodes = [...connection.nodes, ...later.map(id => ({ id }))];
      connection.pageInfo.hasNextPage = malformed;
      return connection;
    },
  };
  return connection;
});
const issue = mock(async (id: string) => {
  events.push(`issue:${id}`);
  return {
    id: "immutable-id", identifier: "ENG-1", title: "fixture",
    createdAt: new Date(0), updatedAt: new Date(0), url: "", branchName: "",
    state: undefined, assignee: undefined, parent: undefined, team: { id: "team-id" }, subscribers,
  };
});
const updateIssue = mock(async (_id: string, input: { subscriberIds: string[] }) => {
  events.push("write");
  if (confirmation === true) {
    initial = input.subscriberIds.slice(0, 1);
    later = input.subscriberIds.slice(1);
  }
  return { success: confirmation };
});
const client = {
  get viewer() { events.push("viewer"); return Promise.resolve({ id: "viewer" }); },
  issue, updateIssue,
};
mock.module("@bdsqqq/lnr-core", () => ({
  ...core, getClient: () => client, getConfigValue: () => "table",
}));
const { appRouter } = await import("./index");
const outcomes = [
  { mode: "late", code: 0 },
  { mode: "absent", code: 0 },
  { mode: "early", code: 0 },
  { mode: "empty-initial", code: 0 },
  { mode: "repeat", code: 1, diagnostic: "subscriber pagination did not advance" },
  { mode: "false", code: 1, diagnostic: "failed to" },
  { mode: "missing", code: 1, diagnostic: "failed to" },
  { mode: "truthy", code: 1, diagnostic: "failed to" },
  { mode: "network unavailable", code: 1, diagnostic: "network unavailable" },
  { mode: "unauthorized", code: 2, diagnostic: "not authenticated" },
  { mode: "permission denied", code: 5, diagnostic: "requires a Linear Business or Enterprise plan" },
  { mode: "rate limit exceeded", code: 4, diagnostic: "rate limited" },
];
for (const action of ["subscribe", "unsubscribe", "both"]) {
  for (const outcome of outcomes) {
    test(`subscriber pagination real-core argv ${action}: ${outcome.mode}`, async () => {
      const errorMode = ["network unavailable", "unauthorized", "permission denied", "rate limit exceeded"].includes(outcome.mode);
      initial = outcome.mode === "early" || errorMode ? ["viewer", "other"] : outcome.mode === "empty-initial" ? [] : ["other"];
      later = outcome.mode === "absent" || outcome.mode === "early" || errorMode ? ["last"]
        : action === "subscribe" && ["false", "missing", "truthy"].includes(outcome.mode) ? ["last"] : ["viewer", "last"];
      failure = errorMode ? new Error(outcome.mode) : undefined;
      malformed = outcome.mode === "repeat";
      confirmation = outcome.mode === "false" ? false : outcome.mode === "missing" ? undefined : outcome.mode === "truthy" ? "true" : true;
      if (action === "both" && ["false", "missing", "truthy"].includes(outcome.mode)) later = ["last"];
      const original = [...initial, ...later];
      events.length = 0; nextCalls.length = 0;
      for (const fn of [issue, subscribers, updateIssue]) fn.mockClear();
      const stdout = spyOn(console, "log").mockImplementation(() => {});
      const stderr = spyOn(console, "error").mockImplementation(() => {});
      const exit = spyOn(process, "exit").mockImplementation((code): never => {
        throw new FailedToExitError("production exit", { exitCode: Number(code), cause: undefined });
      });
      const previous = process.exitCode;
      try {
        const result = await createCli({ router: appRouter }).run({
          argv: ["issue", "ENG-1", ...(action === "both" ? ["--subscribe", "--unsubscribe"] : [`--${action}`])],
          logger: { info() {}, error() {} },
          process: { exit(code): never {
            throw new FailedToExitError("cli exit", { exitCode: code, cause: undefined });
          } },
        }).catch(error => error);
        expect({ code: result.exitCode, diagnostic: stderr.mock.calls.flat().join(" ") })
          .toMatchObject({ code: outcome.code });
        const failedRead = errorMode || malformed;
        const runs = action === "both" && outcome.code === 0 ? 2 : 1;
        expect(issue.mock.calls).toEqual([["ENG-1"], ["immutable-id"], ...Array.from({ length: runs }, (): [string] => ["immutable-id"])]);
        expect(subscribers.mock.calls).toEqual(Array.from({ length: runs }, () => []));
        expect(nextCalls).toEqual(Array.from({ length: runs }, () => []));
        const expectedWrites: [string, { subscriberIds: string[] }][] = [];
        const expectedEvents = ["issue:ENG-1", "issue:immutable-id"];
        let ids = original;
        for (const operation of action === "both" ? ["subscribe", "unsubscribe"].slice(0, runs) : [action]) {
          expectedEvents.push("viewer", "issue:immutable-id", "subscribers", "next");
          if (!failedRead && (operation === "subscribe" ? !ids.includes("viewer") : ids.includes("viewer"))) {
            ids = operation === "subscribe" ? [...ids, "viewer"] : ids.filter(id => id !== "viewer");
            expectedWrites.push(["immutable-id", { subscriberIds: ids }]);
            expectedEvents.push("write");
          }
        }
        expect(updateIssue.mock.calls).toEqual(expectedWrites);
        expect(events).toEqual(expectedEvents);
        if (outcome.code) {
          // Confirmation failures exit inside the handler, then its catch reports
          // our throwing exit stub. Real process.exit would stop at the first call.
          expect(exit.mock.calls).toEqual(["false", "missing", "truthy"].includes(outcome.mode)
            ? [[outcome.code], [outcome.code]] : [[outcome.code]]);
          expect(stdout.mock.calls).toEqual([]);
          expect(stderr.mock.calls.flat().join(" ")).toContain(outcome.diagnostic!);
        } else {
          expect(exit).not.toHaveBeenCalled();
          expect(stderr.mock.calls).toEqual([]);
          expect(stdout.mock.calls.flat()).toEqual(action === "both"
            ? ["subscribed to ENG-1", "unsubscribed from ENG-1"]
            : [action === "subscribe" ? "subscribed to ENG-1" : "unsubscribed from ENG-1"]);
        }
      } finally {
        exit.mockRestore(); stdout.mockRestore(); stderr.mockRestore(); process.exitCode = previous;
      }
    });
  }
}
