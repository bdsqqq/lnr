import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { buildSchema } from "graphql";
import { executeApi, getApiSchema } from "./api";
import { inputWitnesses, witness } from "./api-witness.test-support";

const schema = getApiSchema(), rows = inputWitnesses(schema);
function selected(value: unknown, path: readonly string[]): unknown {
  if (Array.isArray(value)) { expect(value).toHaveLength(1); return selected(value[0], path); }
  if (!path.length) return value;
  expect(value !== null && typeof value === "object").toBe(true);
  expect(Object.hasOwn(value as object, path[0]!)).toBe(true);
  return selected((value as Record<string, unknown>)[path[0]!], path.slice(1));
}

describe("coordinate input structural witnesses", () => {
  let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
  beforeEach(() => {
    const forbidden = () => { throw new Error("network forbidden in input witnesses"); };
    fetchSpy = spyOn(globalThis, "fetch").mockImplementation(Object.assign(forbidden, { preconnect: forbidden }));
  });
  afterEach(() => {
    try { expect(fetchSpy).not.toHaveBeenCalled(); }
    finally { fetchSpy.mockRestore(); }
  });
  test("pinned capture retains structural witnesses rather than silently downgrading them", () => {
    expect(createHash("sha256")
      .update(readFileSync(new URL("./api-schema.graphql", import.meta.url))).digest("hex"))
      .toBe("3d752013e460b853f839aa6f156f23ff85cad8f74035ef5675072c509f53a76d");
    expect({
      total: rows.length,
      witness: rows.filter(row => row.status === "witness").length,
      blocked: rows.filter(row => row.status === "blocked").length,
      noPath: rows.filter(row => row.status === "no-path").length,
    }).toEqual({ total: 4018, witness: 3514, blocked: 26, noPath: 478 });
  });
  test("accounts once for every candidate root argument and input field", () => {
    const inventory = JSON.parse(readFileSync(new URL("../../codegen/api-inventory.json", import.meta.url), "utf8")) as {
      roots: { query: string; mutation: string };
      coordinates: { coordinate: string; kind: string; scope: string }[];
    };
    const expected = inventory.coordinates.filter(row => row.scope === "public-candidate" && (
      row.kind === "input-field" || row.kind === "argument" &&
      [inventory.roots.query, inventory.roots.mutation].some(root => row.coordinate.startsWith(root + "."))
    )).map(row => row.coordinate).sort();
    expect(rows.map(row => row.coordinate)).toEqual(expected);
    expect(new Set(rows.map(row => row.coordinate)).size).toBe(rows.length);
    expect(inputWitnesses(schema)).toEqual(rows);
  });
  test("validates and forwards every generated witness without network access", async () => {
    for (const row of rows) {
      if (row.status === "no-path") {
        expect(row.reasons).toEqual([{ coordinate: row.coordinate, reason: "no public query/mutation argument path" }]);
        continue;
      }
      const { probe } = row;
      const original = structuredClone(probe.variables);
      let factories = 0, calls = 0;
      const data = { coordinate: row.coordinate };
      const factory = () => {
        factories++;
        return { client: { async rawRequest(document: string, variables?: Record<string, unknown>) {
          calls++;
          expect(document).toBe(probe.document);
          expect(variables).toBe(probe.variables);
          expect(variables).toEqual(original);
          return { data };
        } } };
      };
      if (row.status === "blocked") {
        expect(row.reasons.length).toBeGreaterThan(0);
        if (row.reasons.some(reason => reason.generatorLimit)) continue;
        for (const execute of [false, true])
          await expect(executeApi({ ...probe, execute }, factory, schema))
            .rejects.toMatchObject({ name: "ApiExecutionError" });
        expect(factories).toBe(0);
        expect(calls).toBe(0);
        continue;
      }
      expect(row.reasons).toEqual([]);
      selected(probe.variables, row.path);
      const operation = probe.document.startsWith("query") ? "query" : "mutation";
      expect(await executeApi(probe, factory, schema)).toEqual({ ok: true, executed: false, operation });
      expect(factories).toBe(0);
      expect(await executeApi({ ...probe, execute: true }, factory, schema))
        .toEqual({ ok: true, executed: true, operation, data });
      expect(factories).toBe(1);
      expect(calls).toBe(1);
    }
  }, 60000);
  test("finite recursive targets, selected lists, false, zero and defaults", () => {
    const fixture = buildSchema(`
      input Input { next: Input items: [Input!] enabled: Boolean count: Int }
      type Query { item(input: Input, count: Int! = 0, flag: Boolean! = false): Boolean }
    `);
    const parent = fixture.getQueryType()!, field = parent.getFields().item!;
    const probe = (path?: string[]) => witness("query", parent, field, path);
    expect(probe().variables).toEqual({});
    expect(probe(["count"]).variables).toEqual({ count: 0 });
    expect(probe(["flag"]).variables).toEqual({ flag: false });
    const recursive = probe(["input", "next", "next", "enabled"]);
    expect(recursive.blocked).toEqual([]);
    expect(recursive.variables).toEqual({ input: { next: { next: { enabled: false } } } });
    expect(probe(["input", "items", "count"]).variables).toEqual({ input: { items: [{ count: 0 }] } });
    const catalog = inputWitnesses(fixture);
    expect(catalog).toHaveLength(7);
    expect(catalog.every(row => row.status === "witness")).toBe(true);
    expect(catalog.find(row => row.coordinate === "Input.count")).toMatchObject({ path: ["input", "count"] });
    expect(() => probe(["input", "missing"])).toThrow("unknown witness field");
    expect(() => probe(["missing"])).toThrow("unknown witness argument");
    expect(() => probe(["count", "missing"])).toThrow("witness path traverses leaf");
  });
  test("alternate usable roots and explicit no-path/internal evidence", () => {
    const fixture = buildSchema(`
      input Shared { enabled: Boolean "[internal]" secret: Boolean }
      input OnlyInternal { value: Int }
      "[internal]" input Hidden { child: Lost }
      input Lost { value: Int }
      "[internal]" type Private { id: ID }
      type Query {
        a(input: Shared): Private z(input: Shared): Boolean
        "[internal]" secret(input: OnlyInternal): Boolean hidden(input: Hidden): Boolean
      }
    `);
    const catalog = inputWitnesses(fixture);
    expect(catalog.find(row => row.coordinate === "Shared.enabled")).toMatchObject({ root: "Query.z" });
    expect(catalog.find(row => row.coordinate === "Query.a(input:)")?.status).toBe("blocked");
    expect(catalog.find(row => row.coordinate === "Query.hidden(input:)")?.status).toBe("blocked");
    expect(catalog.filter(row => row.status === "no-path").map(row => row.coordinate))
      .toEqual(["Lost.value", "OnlyInternal.value"]);
    expect(catalog.some(row => row.coordinate === "Shared.secret" || row.coordinate === "Hidden.child")).toBe(false);
  });
  test("required-only recursion is a generator blocker, not finite target recursion", () => {
    const fixture = buildSchema("input Loop { next: Loop! } type Query { item(input: Loop): Boolean }");
    const parent = fixture.getQueryType()!;
    expect(witness("query", parent, parent.getFields().item!, ["input"]).blocked).toEqual([
      { coordinate: "Loop.next", reason: "required-only input cycle", generatorLimit: true },
    ]);
  });
  test("nullable one-of placeholder is not proof of API rejection", async () => {
    const fixture = buildSchema("input Choice @oneOf { value: String } type Query { item(input: Choice): Boolean }");
    const row = inputWitnesses(fixture).find(row => row.coordinate === "Query.item(input:)")!;
    expect(row.status).toBe("blocked");
    if (row.status === "no-path") throw new Error("missing one-of witness");
    expect(row.reasons).toEqual([{ coordinate: "Query.item(input:)",
      reason: "one-of input generation not supported", generatorLimit: true }]);
    const factory = () => ({ client: { async rawRequest() { return { data: { item: true } }; } } });
    expect((await executeApi(row.probe, factory, fixture)).executed).toBe(false);
    expect((await executeApi({ ...row.probe, execute: true }, factory, fixture)).executed).toBe(true);
  });
});
