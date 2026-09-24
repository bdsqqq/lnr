import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { buildSchema, getNamedType, isInputObjectType, isListType, isNonNullType,
  Kind, parse, TypeInfo, visit, visitWithTypeInfo, type GraphQLSchema } from "graphql";
import { executeApi, getApiSchema } from "./api";
import { outputWitnesses } from "./api-output-witness.test-support";
import { nestedInputWitnesses, inputFieldWitnesses } from "./api-nested-input.test-support";
import { enumWitnesses } from "./api-enum.test-support";

type Row = ReturnType<typeof inputFieldWitnesses>[number];
const schema = getApiSchema(), outputs = outputWitnesses(schema);
const nested = nestedInputWitnesses(schema, outputs), rows = inputFieldWitnesses(schema, nested);

function assertTarget(schema: GraphQLSchema, row: Exclude<Row, { status: "no-witness" }>) {
  const info = new TypeInfo(schema);
  let found = false;
  visit(parse(row.probe.document), visitWithTypeInfo(info, { Argument(node) {
    const argument = info.getArgument();
    if (!argument || info.getParentType()?.name + "." + info.getFieldDef()?.name
      + "(" + argument.name + ":)" !== row.argument
      || node.value.kind !== Kind.VARIABLE || node.value.name.value !== row.path[0]) return;
    let type = argument.type, value = row.probe.variables[row.path[0]!], coordinate = "";
    function unwrap() {
      while (isNonNullType(type) || isListType(type)) {
        if (isListType(type)) { assert(Array.isArray(value)); assert.equal(value.length, 1); value = value[0]; }
        type = type.ofType;
      }
    }
    for (const key of row.path.slice(1)) {
      unwrap();
      const input = getNamedType(type);
      assert(isInputObjectType(input));
      assert(value && typeof value === "object" && Object.hasOwn(value, key));
      value = (value as Record<string, unknown>)[key];
      coordinate = input.name + "." + key;
      type = input.getFields()[key]!.type;
    }
    unwrap();
    assert.equal(coordinate, row.coordinate);
    found = true;
  } }));
  assert(found, "unselected target: " + row.coordinate);
}
async function exercise(schema: GraphQLSchema, catalog: readonly Row[]) {
  for (const row of catalog) {
    if (row.status === "no-witness") {
      assert.deepEqual(row.reasons, [{ coordinate: row.coordinate, reason: "no public root or nested argument input path" }]);
      continue;
    }
    if (row.status === "generator-limit") { assert(row.reasons.some(reason => reason.generatorLimit)); continue; }
    assertTarget(schema, row);
    const before = structuredClone(row.probe), data = { target: row.coordinate };
    let factories = 0, calls = 0;
    const factory = () => { factories++; return { client: {
      async rawRequest(document: string, variables?: Record<string, unknown>) {
        calls++; assert.equal(document, before.document); assert.equal(variables, row.probe.variables);
        assert.deepEqual(variables, before.variables); return { data };
      },
    } }; };
    if (row.status === "blocked") {
      assert(row.reasons.length);
      for (const execute of [false, true]) await assert.rejects(executeApi({ ...row.probe, execute }, factory, schema));
      assert.equal(factories, 0); assert.equal(calls, 0);
    } else {
      assert.deepEqual(row.reasons, []);
      assert.equal((await executeApi(row.probe, factory, schema)).executed, false);
      assert.equal(factories, 0);
      const result = await executeApi({ ...row.probe, execute: true }, factory, schema);
      assert.equal(result.ok, true); assert.equal(result.executed, true); assert.deepEqual(result.data, data);
      assert.equal(factories, 1); assert.equal(calls, 1);
    }
    assert.deepEqual(row.probe, before);
  }
}
describe("root or nested argument input-field witnesses", () => {
  let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
  beforeEach(() => {
    const forbidden = () => { throw new Error("network forbidden"); };
    fetchSpy = spyOn(globalThis, "fetch").mockImplementation(Object.assign(forbidden, { preconnect: forbidden }));
  });
  afterEach(() => { try { expect(fetchSpy).not.toHaveBeenCalled(); } finally { fetchSpy.mockRestore(); } });
  test("accounts once for all candidate fields without inventing coverage gains", () => {
    const inventory = JSON.parse(readFileSync(new URL("../../codegen/api-inventory.json", import.meta.url), "utf8")) as {
      coordinates: { coordinate: string; kind: string; scope: string }[];
    };
    assert.deepEqual(rows.map(row => row.coordinate), inventory.coordinates.filter(row =>
      row.kind === "input-field" && row.scope === "public-candidate").map(row => row.coordinate).sort());
    assert.equal(new Set(rows.map(row => row.coordinate)).size, rows.length);
    assert.equal(createHash("sha256").update(readFileSync(new URL("./api-schema.graphql", import.meta.url))).digest("hex"),
      "3d752013e460b853f839aa6f156f23ff85cad8f74035ef5675072c509f53a76d");
    assert.deepEqual([rows.length, ...["witness", "blocked", "generator-limit", "no-witness"].map(status =>
      rows.filter(row => row.status === status).length)], [2919, 2422, 19, 0, 478]);
    assert.equal(nested.length, 1115); assert(nested.every(row => row.status === "witness"));
    assert.deepEqual(nestedInputWitnesses(schema, [...outputs].reverse()), nested);
  });
  test("exercises nested placements even when a root witness takes precedence", async () => {
    for (const row of nested) {
      const source = outputs.find(output => output.coordinate === row.argument)!;
      assert(source.status !== "no-path");
      assert.equal(row.probe.document, source.probe.document);
      const key = row.path[0]!;
      const { [key]: _selected, ...others } = row.probe.variables;
      const { [key]: _baseline, ...originals } = source.probe.variables;
      assert.deepEqual(others, originals);
    }
    await exercise(schema, rows); await exercise(schema, nested);
  }, 60000);
  test("nested-only fields, recursive lists, siblings, defaults and null/false/zero", async () => {
    const fixture = buildSchema(`
      scalar JSON
      enum Mode { A B }
      input Leaf { id: ID! count: Int enabled: Boolean mode: Mode next: Leaf }
      input Filter { required: Int! leaves: [Leaf!] next: Filter flag: Boolean! = false number: Int! = 0 }
      input Lost { value: Int }
      type Item { value(id: Int!, filter: Filter, n: Int! = 7): String }
      type Wrap { item: Item }
      type Query { item(context: JSON!): Item long: Wrap }
    `);
    const contexts = outputWitnesses(fixture).map(row =>
      row.status === "no-path" || !Object.hasOwn(row.probe.variables, "v0_context") ? row
        : { ...row, probe: { ...row.probe, variables: { ...row.probe.variables,
          v0_context: { nullable: null, flag: false, count: 0 } } } });
    const candidates = nestedInputWitnesses(fixture, contexts), catalog = inputFieldWitnesses(fixture, candidates);
    await exercise(fixture, catalog);
    const row = catalog.find(row => row.coordinate === "Leaf.count")!;
    assert(row.status === "witness"); assert.equal(row.source, "nested"); assert.equal(row.root, "Query.item");
    assert.deepEqual(row.probe.variables, { v0_context: { nullable: null, flag: false, count: 0 }, v1_id: 0,
      v1_filter: { required: 0, leaves: [{ id: "dummy", count: 0 }] } });
    assert.throws(() => assertTarget(fixture, {
      ...row, probe: { ...row.probe, document: "query { __typename }" },
    }));
    const nullable = structuredClone(row);
    (nullable.probe.variables.v1_filter as { leaves: { count: number | null }[] }).leaves[0]!.count = null;
    await exercise(fixture, [nullable]);
    for (const [coordinate, key, value] of [["Filter.flag", "flag", false], ["Filter.number", "number", 0]] as const) {
      const selected = catalog.find(row => row.coordinate === coordinate)!; assert(selected.status === "witness");
      assert.deepEqual(selected.probe.variables.v1_filter, { required: 0, [key]: value });
    }
    assert.deepEqual(catalog.filter(row => row.status === "no-witness").map(row => row.coordinate), ["Lost.value"]);
    const enums = enumWitnesses(fixture); assert.equal(enums.length, 2);
    for (const row of enums) {
      assert(row.status === "witness");
      let factories = 0;
      const factory = () => { factories++; return { client: {
        async rawRequest(document: string, variables?: Record<string, unknown>) {
          assert.equal(document, row.probe.document); assert.equal(variables, row.probe.variables);
          return { data: { enum: row.literal } };
        },
      } }; };
      assert.equal((await executeApi(row.probe, factory, fixture)).executed, false);
      assert.equal(factories, 0);
      assert.equal((await executeApi({ ...row.probe, execute: true }, factory, fixture)).ok, true);
      assert.equal(factories, 1);
    }
  });
  test("blocked short paths yield to usable deeper contexts; usable roots win", async () => {
    for (const direct of [false, true]) {
      const fixture = buildSchema(`
        "[internal]" input Secret { id: ID }
        input Shared { enabled: Boolean }
        type Item { value(input: Shared): String }
        type Wrap { item: Item }
        type Query {
          a(input: Shared, secret: Secret!): String bad(secret: Secret!): Item deep: Wrap
          ${direct ? "z(input: Shared): String" : ""}
        }
      `);
      const catalog = inputFieldWitnesses(fixture); await exercise(fixture, catalog);
      const row = catalog.find(row => row.coordinate === "Shared.enabled")!; assert(row.status === "witness");
      assert.equal(row.source, direct ? "root" : "nested"); assert.equal(row.root, direct ? "Query.z" : "Query.deep");
      if (!direct) assert.deepEqual(row.outputPath, ["Query.deep", "Wrap.item", "Item.value"]);
    }
  });
  test("generator limits remain distinct from internal inputs and absent paths", async () => {
    const fixture = buildSchema(`
      input Choice @oneOf { value: String }
      "[internal]" input Secret { value: String }
      input Container { choice: Choice secret: Secret }
      type Item { value(input: Container): String }
      type Query { item: Item }
    `);
    const catalog = inputFieldWitnesses(fixture); await exercise(fixture, catalog);
    assert.equal(catalog.find(row => row.coordinate === "Choice.value")?.status, "generator-limit");
    assert.equal(catalog.find(row => row.coordinate === "Container.secret")?.status, "blocked");
    const loop = buildSchema(`
      input Loop { next: Loop! }
      type Item { value(input: Loop): String }
      type Query { item: Item }
    `);
    assert.equal(inputFieldWitnesses(loop).find(row => row.coordinate === "Loop.next")?.status, "generator-limit");
  });
});
