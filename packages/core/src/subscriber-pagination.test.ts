import { expect, mock, spyOn, test } from "bun:test";
import { LinearClient } from "@linear/sdk";
import { subscribeToIssue, unsubscribeFromIssue } from "./subscriptions";

const page = (ids: string[], hasNextPage: boolean, endCursor?: string | null) => ({
  nodes: ids.map(id => ({ id })),
  pageInfo: { hasNextPage, hasPreviousPage: false, startCursor: "start", endCursor },
});
const modes = [
  "absent", "late-viewer", "early-viewer", "empty-initial", "empty-middle",
  "terminal-empty", "terminal-null", "terminal-repeat", "first-single",
  "missing-cursor", "same-cursor", "cursor-cycle", "later-null", "later-omitted", "later-error",
  "overlap-absent", "overlap-late-viewer",
];
for (const [action, run] of [
  ["subscribe", subscribeToIssue], ["unsubscribe", unsubscribeFromIssue],
] as const) {
  for (const mode of modes) {
    test(`real SDK subscribers ${action}: ${mode}`, async () => {
      const pages = mode.startsWith("overlap-") ? [
          page(["other", "middle"], true, "a"),
          page(["middle", "last"], true, "b"),
          page(mode === "overlap-late-viewer" ? ["other", "viewer", "last", "viewer"] : ["other", "last"], false),
        ]
        : mode === "later-error" ? [page(["viewer", "other"], true, "a"), page([], false)]
        : mode === "missing-cursor" ? [page([], true)]
        : mode === "same-cursor" ? [page(["other"], true, "a"), page([], true, "a")]
        : mode === "cursor-cycle" ? [page(["other"], true, "a"), page([], true, "b"), page([], true, "a")]
        : mode === "later-null" ? [page(["viewer"], true, "a"), page([], true, null)]
        : mode === "later-omitted" ? [page(["viewer"], true, "a"), page([], true)]
        : mode === "terminal-empty" ? [page(["other", "viewer"], true, "a"), page([], false)]
        : mode === "terminal-null" ? [page(["other"], true, "a"), page(["last"], false, null)]
        : mode === "terminal-repeat" ? [page(["other"], true, "a"), page(["last"], false, "a")]
        : mode === "first-single" ? [page(["other"], true, "start"), page(["last"], false)]
        : [
          page(mode === "empty-initial" ? [] : mode === "early-viewer" ? ["viewer", "other"] : ["other"], true, "a"),
          page(mode === "empty-middle" ? [] : ["middle"], true, "b"),
          page(mode === "late-viewer" ? ["viewer", "last"] : ["last"], false),
        ];
      const invalid = ["missing-cursor", "same-cursor", "cursor-cycle", "later-null", "later-omitted", "later-error"].includes(mode);
      const requests: { operation: string; variables: Record<string, unknown> }[] = [];
      let index = 0;
      const transport = spyOn(globalThis, "fetch").mockImplementation(Object.assign(
        async (_url: string | URL | Request, init?: RequestInit) => {
          const body = JSON.parse(String(init?.body));
          const operation = /(?:query|mutation)\s+(\w+)/.exec(body.query)?.[1] ?? "";
          requests.push({ operation, variables: body.variables });
          if (operation === "viewer") return Response.json({ data: { viewer: { id: "viewer" } } });
          if (operation === "issue") return Response.json({ data: { issue: {
            id: "immutable-id", sharedAccess: { isShared: false, sharedWithUsers: [] }, reactions: [],
          } } });
          if (operation === "issue_subscribers") {
            // A broken guard must fail at a finite fixture cap, never fall through to the network.
            if (index >= pages.length) throw new Error("unexpected extra page request");
            if (mode === "later-error" && index === 1) {
              index++;
              return Response.json({ errors: [{ message: "permission denied" }] });
            }
            return Response.json({ data: { issue: { subscribers: pages[index++] } } });
          }
          expect(operation).toBe("updateIssue");
          expect(index).toBe(pages.length);
          return Response.json({ data: { issueUpdate: { success: true } } });
        }, { preconnect() { throw new Error("unexpected preconnect"); } },
      ));
      try {
        const client = new LinearClient({ apiKey: "fixture", apiUrl: "http://localhost:1/graphql" });
        if (invalid) await expect(run(client, "immutable-id")).rejects.toThrow(mode === "later-error"
          ? "permission denied" : "subscriber pagination did not advance");
        else expect(await run(client, "immutable-id")).toBe(true);
        expect(index).toBe(pages.length);
        // Literal first-seen expectations keep this independent of production deduplication.
        const ids = mode === "overlap-absent" ? ["other", "middle", "last"]
          : mode === "overlap-late-viewer" ? ["other", "middle", "last", "viewer"]
          : pages.flatMap(p => p.nodes.map(n => n.id));
        const writes = !invalid && (action === "subscribe" ? !ids.includes("viewer") : ids.includes("viewer"));
        expect(requests).toEqual([
          { operation: "viewer", variables: {} },
          { operation: "issue", variables: { id: "immutable-id" } },
          { operation: "issue_subscribers", variables: { id: "immutable-id" } },
          ...pages.slice(0, -1).map(p => ({
            operation: "issue_subscribers", variables: { id: "immutable-id", after: p.pageInfo.endCursor, first: 50 },
          })),
          ...(writes ? [{
            operation: "updateIssue",
            variables: { id: "immutable-id", input: {
              subscriberIds: action === "subscribe" ? [...ids, "viewer"] : ids.filter(id => id !== "viewer"),
            } },
          }] : []),
        ]);
      } finally { transport.mockRestore(); }
    });
  }
}

for (const run of [subscribeToIssue, unsubscribeFromIssue]) {
  for (const stage of ["viewer", "issue", "subscribers", "later-page", "write"]) {
    for (const earlyViewer of [false, true]) {
      test(`${run.name} preserves ${stage} error identity, early viewer ${earlyViewer}`, async () => {
        const error = new Error("permission denied");
        const fail = async () => { throw error; };
        const events: string[] = [];
        const connection = {
          nodes: (earlyViewer ? ["viewer", "other"] : ["other"]).map(id => ({ id })),
          pageInfo: { hasNextPage: stage === "later-page", endCursor: "a" },
          fetchNext: mock(async () => { events.push("next"); throw error; }),
        };
        const subscribers = mock(async () => {
          events.push("subscribers");
          return stage === "subscribers" ? fail() : connection;
        });
        const issue = mock(async (_id: string) => { events.push("issue"); return stage === "issue" ? fail() : { subscribers }; });
        const updateIssue = mock(fail);
        const client = {
          get viewer() { events.push("viewer"); return stage === "viewer" ? fail() : Promise.resolve({ id: "viewer" }); },
          issue, updateIssue,
        } as unknown as LinearClient;
        const noop = stage === "write" && (run === subscribeToIssue ? earlyViewer : !earlyViewer);
        if (noop) expect(await run(client, "immutable-id")).toBe(true);
        else await expect(run(client, "immutable-id")).rejects.toBe(error);
        expect(updateIssue).toHaveBeenCalledTimes(stage === "write" && !noop ? 1 : 0);
        expect(events).toEqual(stage === "viewer" ? ["viewer"]
          : stage === "issue" ? ["viewer", "issue"]
          : stage === "later-page" ? ["viewer", "issue", "subscribers", "next"]
          : ["viewer", "issue", "subscribers"]);
        if (issue.mock.calls.length) expect(issue.mock.calls).toEqual([["immutable-id"]]);
        if (subscribers.mock.calls.length) expect(subscribers.mock.calls).toEqual([[]]);
        if (connection.fetchNext.mock.calls.length) expect(connection.fetchNext.mock.calls).toEqual([[]]);
      });
    }
  }
}
