import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCli, FailedToExitError } from "trpc-cli";
import { apiRouter } from "./api";

const clientModule = await import(new URL("./client.ts", import.meta.resolve("@bdsqqq/lnr-core")).href);
const message = "api request failed; check authentication, permissions, inputs, and service status";
const query = `query Transport($first: Int, $after: String, $archived: Boolean, $filter: IssueFilter) {
  selected: issues(first: $first, after: $after, includeArchived: $archived, filter: $filter) {
    nodes { ...Fields }
    pageInfo { hasNextPage endCursor }
  }
}
fragment Fields on Issue {
  id title description priority project { id } labels { nodes { id } }
}`;
const queryVariables = {
  first: 0, after: null, archived: false,
  filter: { priority: { eq: 0 }, title: { eq: "" }, or: [] },
};
const item = {
  id: "issue-id", title: 'é\n"quoted"', description: null, priority: 0,
  project: { id: "project-id" }, labels: { nodes: [] },
};
const queryData = {
  selected: { nodes: [item], pageInfo: { hasNextPage: true, endCursor: "cursor+/=" } },
};
const mutation = `mutation Transport($id: String!, $input: IssueUpdateInput!) {
  saved: issueUpdate(id: $id, input: $input) {
    success
    issue { id title description priority project { id } labels { nodes { id } } }
  }
}`;
const mutationVariables = {
  id: "issue-id",
  input: { title: 'é\n"quoted"', description: null, priority: 0, subscriberIds: [], trashed: false },
};
const mutationData = { saved: { success: true, issue: item } };
const path = ["saved", "issue", "description"];
type Mode = "success" | "partial" | "http" | "network";
let mode: Mode;
let responseData: unknown;
let directory: string;
let previousExitCode: typeof process.exitCode;
let chunks: string[];
let requests: { url: string; init?: RequestInit }[];
let transport: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
let output: ReturnType<typeof spyOn<typeof process.stdout, "write">>;
let factory: ReturnType<typeof spyOn<typeof clientModule, "getClient">>;

beforeEach(() => {
  previousExitCode = process.exitCode;
  directory = mkdtempSync(join(tmpdir(), "lnr-api-transport-"));
  chunks = [];
  requests = [];
  mode = "success";
  responseData = queryData;
  // Every fetch is intercepted; there is no network fallback.
  transport = spyOn(globalThis, "fetch").mockImplementation(Object.assign(
    async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      if (mode === "network") throw new Error("SECRET transport detail");
      if (mode === "http") return new Response("SECRET upstream body", { status: 503 });
      return Response.json({
        data: responseData,
        ...(mode === "partial" ? {
          errors: [{ message: "SECRET upstream detail", path, extensions: { request: "SECRET body" } }],
        } : {}),
      });
    },
    { preconnect() { throw new Error("unexpected preconnect"); } },
  ));
  // This factory constructs the real SDK; only credential acquisition is replaced.
  factory = spyOn(clientModule, "getClient").mockReturnValue(clientModule.createClientWithKey("fixture-key"));
  output = spyOn(process.stdout, "write").mockImplementation((...args: unknown[]) => {
    chunks.push(String(args[0]));
    const callback = args.at(-1);
    if (typeof callback === "function") callback();
    return true;
  });
});
afterEach(() => {
  output.mockRestore();
  factory.mockRestore();
  transport.mockRestore();
  process.exitCode = previousExitCode;
  rmSync(directory, { recursive: true, force: true });
});

async function run(document: string, variables: Record<string, unknown>) {
  const documentFile = join(directory, "request.graphql");
  const variablesFile = join(directory, "variables.json");
  writeFileSync(documentFile, document);
  writeFileSync(variablesFile, JSON.stringify(variables));
  let code: number | undefined;
  await expect(createCli({ router: apiRouter }).run({
    argv: ["api", documentFile, "--variables", variablesFile, "--execute"],
    logger: { info() {}, error() {} },
    process: { exit(value): never {
      code = value;
      throw new FailedToExitError("test exit", { exitCode: value, cause: undefined });
    } },
  })).rejects.toBeInstanceOf(FailedToExitError);
  expect(factory).toHaveBeenCalledTimes(1);
  expect(requests).toHaveLength(1);
  expect(requests[0]!.url).toBe("https://api.linear.app/graphql");
  expect(requests[0]!.init?.method).toBe("POST");
  expect(new Headers(requests[0]!.init?.headers).get("Authorization")).toBe("fixture-key");
  expect(requests[0]!.init?.body).toBe(JSON.stringify({ query: document, variables }));
  return code;
}

/** Fake server data proves serialization through argv/core/SDK, not server semantics or pagination completeness. */
test("argv preserves variables and exact selected JSON without implicit pagination", async () => {
  expect(await run(query, queryVariables)).toBe(0);
  expect(chunks.join("")).toBe(JSON.stringify({
    ok: true, executed: true, operation: "query", data: queryData,
  }) + "\n");
});
test.each(["success", "partial", "http", "network"] as const)(
  "argv preserves mutation results and one-attempt failures: %s",
  async scenario => {
    mode = scenario;
    responseData = mutationData;
    expect(await run(mutation, mutationVariables)).toBe(scenario === "success" ? 0 : 1);
    expect(chunks.join("")).toBe(JSON.stringify({
      ok: scenario === "success", executed: true, operation: "mutation",
      ...(scenario === "success" || scenario === "partial" ? { data: mutationData } : {}),
      ...(scenario === "success" ? {} : {
        errors: [{ message, ...(scenario === "partial" ? { path } : {}) }],
      }),
    }) + "\n");
    expect(chunks.join("")).not.toContain("SECRET");
    expect(chunks.join("")).not.toContain("fixture-key");
  },
);
