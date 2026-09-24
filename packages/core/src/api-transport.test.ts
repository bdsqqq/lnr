import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { LinearClient } from "@linear/sdk";
import { executeApi } from "./api";

const endpoint = "http://localhost:1/graphql";
const message = "api request failed; check authentication, permissions, inputs, and service status";
const document = `mutation Transport($id: String!, $input: IssueUpdateInput!) {
  saved: issueUpdate(id: $id, input: $input) {
    success
    issue { id title description priority project { id } labels { nodes { id } } }
  }
}`;
const variables = {
  id: "issue-id",
  input: { title: "", description: null, priority: 0, subscriberIds: [], trashed: false },
};
const data = {
  saved: { success: true, issue: {
    id: "issue-id", title: "", description: null, priority: 0,
    project: { id: "project-id" }, labels: { nodes: [] },
  } },
};
const path = ["saved", "issue", "description"];
type Mode = "success" | "partial" | "http" | "network";
let mode: Mode;
let requests: { url: string; init?: RequestInit }[];
let transport: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;

beforeEach(() => {
  mode = "success";
  requests = [];
  // No network fallback: even unexpected requests remain inside the fixture.
  transport = spyOn(globalThis, "fetch").mockImplementation(Object.assign(
    async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      if (mode === "network") throw new Error("SECRET transport detail");
      if (mode === "http") return new Response("SECRET upstream body", { status: 503 });
      return Response.json({
        data,
        ...(mode === "partial" ? {
          errors: [{ message: "SECRET upstream detail", path, extensions: { request: "SECRET body" } }],
        } : {}),
      });
    },
    { preconnect() { throw new Error("unexpected preconnect"); } },
  ));
});
afterEach(() => transport.mockRestore());

/** These assertions prove SDK serialization, not live field semantics or business success. */
test.each(["success", "partial", "http", "network"] as const)(
  "real SDK preserves input and makes one attempt: %s",
  async scenario => {
    mode = scenario;
    const before = JSON.stringify(variables);
    const client = new LinearClient({ apiKey: "fixture-key", apiUrl: endpoint });
    const result = await executeApi({ document, variables, execute: true }, () => client);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.url).toBe(endpoint);
    expect(requests[0]!.init?.method).toBe("POST");
    expect(new Headers(requests[0]!.init?.headers).get("Authorization")).toBe("fixture-key");
    expect(new Headers(requests[0]!.init?.headers).get("Content-Type")).toBe("application/json");
    expect(requests[0]!.init?.body).toBe(JSON.stringify({ query: document, variables }));
    expect(JSON.stringify(variables)).toBe(before);
    expect(result).toMatchObject({
      ok: scenario === "success", executed: true, operation: "mutation",
    });
    expect(result.data).toEqual(scenario === "success" || scenario === "partial" ? data : undefined);
    expect(result.errors).toEqual(scenario === "success" ? undefined
      : [{ message, ...(scenario === "partial" ? { path } : {}) }]);
    expect(JSON.stringify(result)).not.toContain("SECRET");
    expect(JSON.stringify(result)).not.toContain("fixture-key");
  },
);
