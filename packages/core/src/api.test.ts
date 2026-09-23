import { describe, expect, test } from "bun:test";
import { buildSchema } from "graphql";
import { ApiExecutionError, executeApi, getApiSchema, sanitizeApiError } from "./api";

const schema = buildSchema(`
  scalar JSON
  enum Mode { PUBLIC "[Internal]" PRIVATE }
  "[Internal]" scalar Secret
  "[Internal]" type Hidden { id: ID }
  input Nested {
    count: Int!
    "[Internal]" hidden: String
    "[Internal]" automatic: String = "server-default"
    mode: Mode
    json: JSON
  }
  input Input { nested: [Nested!] secret: Secret _legitimate: String _dummy: String }
  type Item { id: ID! name: String "[Internal]" hidden: String }
  type Query {
    items(input: Input, "[Internal]" secret: String): [Item]
    hidden: Hidden
    "[Internal]" private: String
    _dummy: String
    _legitimate: String
  }
  type Mutation {
    save(input: Input): Item
    cycleCreate: Item @deprecated(reason: "Cycle creation is not supported.")
    old: Item @deprecated(reason: "Use save instead.")
  }
  type Subscription { changed: Item }
`);

function harness(response: unknown = { data: { saved: { id: "1", name: "kept" } } }) {
  const calls: { document: string; variables: unknown }[] = [];
  let factories = 0;
  const factory = () => {
    factories++;
    return { client: {
      async rawRequest(document: string, variables?: Record<string, unknown>) {
        calls.push({ document, variables });
        return response as { data?: unknown; errors?: unknown[] };
      },
    } };
  };
  return { calls, factory, factories: () => factories };
}

describe("api validation", () => {
  test.each([
    "{ userSettings { showCodeBlockLineNumbers } }",
    'mutation { integrationsSettingsUpdate(id: "fixture", input: {slackProjectCommentCreated: true}) { success } }',
    'mutation { integrationZendesk(botUserId: "x", subdomain: "x") { success } }',
    "{ projectLabels { nodes { team { id } inheritedFrom { id } } } }",
    'mutation { projectLabelCreate(input: {name: "probe", teamId: "x"}) { success } }',
  ])("uses captured-live additions and visibility, not stale SDK metadata", async document => {
    const h = harness();
    expect(await executeApi({ document }, h.factory)).toMatchObject({ ok: true, executed: false });
    expect(h.factories()).toBe(0);
  });

  test("bundle is lazy-cached and preserves cycle metadata", () => {
    expect(getApiSchema()).toBe(getApiSchema());
    expect(getApiSchema().getMutationType()?.getFields().cycleCreate?.deprecationReason)
      .toBe("Cycle creation is not supported.");
  });
  test.each(["{ items { id } }", "mutation { save { id } }"])("offline default: %s", async document => {
    const h = harness();
    expect(await executeApi({ document }, h.factory, schema)).toMatchObject({ ok: true, executed: false });
    expect(h.factories()).toBe(0);
  });
  test.each([
    "", "query A { items { id } } query B { items { id } }",
    "fragment F on Item { id }", "subscription { changed { id } }",
    "type Extra { id: ID } query { items { id } }", "{ items { unknown } }",
    '{ items(input: {nested: [{count: "SECRET"}]}) { id } }',
    "{ items { id } } # " + "x".repeat(1024 * 1024),
  ])("invalid documents never acquire a client", async document => {
    const h = harness();
    await expect(executeApi({ document, execute: true }, h.factory, schema)).rejects.toBeInstanceOf(ApiExecutionError);
    expect(h.factories()).toBe(0);
  });
  test.each([
    "{ private }", "{ hidden { id } }", "{ _dummy }", "{ items { hidden } }",
    '{ items(secret: "SECRET") { id } }', '{ items(input: {_dummy: "SECRET"}) { id } }',
    '{ items(input: {nested: [{count: 1, hidden: "SECRET"}]}) { id } }',
    "{ items(input: {nested: [{count: 1, mode: PRIVATE}]}) { id } }",
    "{ items(input: {secret: null}) { id } }", "mutation { alias: cycleCreate { id } }",
    "query($input: Input = {nested: [{count: 1, mode: PRIVATE}]}) { items(input: $input) { id } }",
    "query { items { ...Fields } } fragment Fields on Item { hidden }",
  ])("rejects internal and unavailable selections", async document => {
    await expect(executeApi({ document }, harness().factory, schema)).rejects.toBeInstanceOf(ApiExecutionError);
  });
  test.each([
    { nested: [{ count: "SECRET" }] }, { nested: [{ count: 1, unknown: "SECRET" }] },
    { nested: [{ count: 1, hidden: "SECRET" }] }, { nested: [{ count: 1, mode: "PRIVATE" }] },
    { secret: null }, { _dummy: "SECRET" },
  ])("invalid variables never leak values or acquire a client", async input => {
    const h = harness();
    try {
      await executeApi({
        document: "query($input: Input) { items(input: $input) { id } }",
        variables: { input }, execute: true,
      }, h.factory, schema);
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiExecutionError);
      expect(String(error)).not.toContain("SECRET");
    }
    expect(h.factories()).toBe(0);
  });
  test.each([
    "{ _legitimate }", "mutation { old { id } }", "{ items(input: null) { id } }",
    "{ items(input: {nested: []}) { id } }",
    "{ items(input: {nested: {count: 0, mode: PUBLIC}}) { id } }",
    '{ items(input: {nested: [{count: 1, json: {_dummy: 1, hidden: "ok"}}]}) { id } }',
  ])("permits public candidates and scalar-owned keys", async document => {
    expect(await executeApi({ document }, harness().factory, schema)).toMatchObject({ ok: true, executed: false });
  });
});

describe("api execution", () => {
  test("credential failure does not claim a transport attempt or expose configuration data", async () => {
    const result = await executeApi({ document: "{ _legitimate }", execute: true }, () => {
      throw { message: "SECRET", data: { token: "SECRET" } };
    }, schema);
    expect(result).toMatchObject({ ok: false, executed: false });
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });

  test("cursor and nested output pass through without automatic pagination", async () => {
    const data = { issues: {
      nodes: [{ id: "issue-id", project: { id: "project-id" } }],
      pageInfo: { hasNextPage: true, endCursor: "next" },
    } };
    const h = harness({ data });
    const document = `query($after: String) {
      issues(first: 1, after: $after, filter: {priority: {eq: 0}}) {
        nodes { id project { id } }
        pageInfo { hasNextPage endCursor }
      }
    }`;
    const variables = { after: null };
    const result = await executeApi({ document, variables, execute: true }, h.factory);
    expect(result.data).toEqual(data);
    expect(h.calls).toEqual([{ document, variables }]);
  });

  test("one request preserves fragments, aliases, variables, defaults and selected data", async () => {
    const h = harness();
    const document = `mutation Save($input: Input) {
      saved: save(input: $input) { ...Fields }
    } fragment Fields on Item { id name }`;
    const variables = {
      input: { _legitimate: "", nested: [{ count: 0, json: { _dummy: false, hidden: null, arbitrary: [] } }] },
    };
    expect(await executeApi({ document, variables, execute: true }, h.factory, schema)).toEqual({
      ok: true, executed: true, operation: "mutation", data: { saved: { id: "1", name: "kept" } },
    });
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]?.document).toBe(document);
    expect(h.calls[0]?.variables).toBe(variables);
    expect(variables.input.nested[0]).not.toHaveProperty("automatic");
  });
  test.each(["resolved", "linear", "raw"])("partial errors stay failures: %s", async shape => {
    const payload = {
      data: { items: [{ id: "1", name: null }] },
      errors: [{ message: "SECRET", path: ["items", 0, "name"], extensions: { body: "SECRET" } }],
    };
    const factory = () => ({ client: {
      async rawRequest() {
        if (shape === "resolved") return payload;
        if (shape === "raw") throw { response: payload, request: "SECRET" };
        throw Object.assign(new Error("SECRET"), payload, { query: "SECRET", variables: { token: "SECRET" } });
      },
    } });
    const result = await executeApi({ document: "{ items { id name } }", execute: true }, factory, schema);
    expect(result.ok).toBe(false);
    expect(result.data).toEqual(payload.data);
    expect(result.errors?.[0]?.path).toEqual(["items", 0, "name"]);
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });
  test.each([new Error("SECRET"), "SECRET", null, { body: "SECRET" }])("does not retry failures", async failure => {
    let calls = 0;
    const factory = () => ({ client: {
      async rawRequest(): Promise<never> { calls++; throw failure; },
    } });
    const result = await executeApi({ document: "mutation { save { id } }", execute: true }, factory, schema);
    expect(result.ok).toBe(false);
    expect(calls).toBe(1);
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });
  test("malformed responses fail and untrusted paths are omitted", async () => {
    expect((await executeApi({ document: "{ _legitimate }", execute: true }, harness({}).factory, schema)).ok).toBe(false);
    expect(sanitizeApiError({ message: "SECRET", path: ["SECRET"] })).not.toHaveProperty("path");
  });
});
