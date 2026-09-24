import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  buildSchema, execute, getNamedType, isAbstractType, isCompositeType, isObjectType,
  isListType, isNonNullType, Kind, parse, TypeInfo, visit, visitWithTypeInfo,
  type GraphQLSchema, type GraphQLCompositeType, type GraphQLNamedType, type GraphQLObjectType,
  type OperationDefinitionNode, type SelectionSetNode,
} from "graphql";
import { executeApi, getApiSchema } from "./api";
import { outputWitnesses } from "./api-output-witness.test-support";

type Row = ReturnType<typeof outputWitnesses>[number];
const schema = getApiSchema(), rows = outputWitnesses(schema);
const operationNode = (document: string) => parse(document).definitions[0] as OperationDefinitionNode;

/** Pairwise fragment overlap alone does not establish runtime reachability. */
function assertRuntimeSelections(schema: GraphQLSchema, document: string) {
  const objects = Object.values(schema.getTypeMap()).filter(isObjectType);
  const allows = (type: GraphQLNamedType, object: GraphQLObjectType) =>
    type === object || isAbstractType(type) && schema.isSubType(type, object);
  function walk(set: SelectionSetNode, parent: GraphQLCompositeType, runtime: GraphQLObjectType[]) {
    assert(runtime.length > 0, "empty runtime intersection");
    for (const node of set.selections) {
      if (node.kind === Kind.INLINE_FRAGMENT) {
        const condition = node.typeCondition ? schema.getType(node.typeCondition.name.value)! : parent;
        assert(isCompositeType(condition));
        walk(node.selectionSet, condition, runtime.filter(object => allows(condition, object)));
        continue;
      }
      assert(node.kind === Kind.FIELD);
      if (!node.selectionSet) continue;
      assert("getFields" in parent);
      const output = getNamedType(parent.getFields()[node.name.value]!.type);
      assert(isCompositeType(output));
      // Independent of the generator's union-of-return-sets implementation.
      const children = objects.filter(child => allows(output, child) && runtime.some(object => {
        const field = object.getFields()[node.name.value];
        return field !== undefined && allows(getNamedType(field.type), child);
      }));
      walk(node.selectionSet, output, children);
    }
  }
  const operation = operationNode(document);
  const root = operation.operation === "query" ? schema.getQueryType()! : schema.getMutationType()!;
  walk(operation.selectionSet, root, [root]);
}

function assertSelected(schema: GraphQLSchema, row: Row) {
  assert(row.status !== "no-path");
  assertRuntimeSelections(schema, row.probe.document);
  const info = new TypeInfo(schema);
  let found = false;
  visit(parse(row.probe.document), visitWithTypeInfo(info, {
    Field() {
      if (`${info.getParentType()?.name}.${info.getFieldDef()?.name}` === row.coordinate) found = true;
    },
    Argument(node) {
      const coordinate = `${info.getParentType()?.name}.${info.getFieldDef()?.name}(${info.getArgument()?.name}:)`;
      if (coordinate !== row.coordinate) return;
      found = true;
      assert(node.value.kind === Kind.VARIABLE);
      assert(Object.hasOwn(row.probe.variables, node.value.name.value));
      const value = row.probe.variables[node.value.name.value];
      let type = info.getInputType()!;
      if (isNonNullType(type)) type = type.ofType;
      if (isListType(type)) { assert(Array.isArray(value)); assert(value.length > 0); }
    },
  }));
  assert(found, `document does not select ${row.coordinate}`);
}

/** Selected-key scaffolding only, not schema-valid response values or live evidence. */
function fakeSelection(set: SelectionSetNode): Record<string, unknown> {
  return Object.assign({}, ...set.selections.map(node => {
    if (node.kind === Kind.INLINE_FRAGMENT) return fakeSelection(node.selectionSet);
    assert(node.kind === Kind.FIELD);
    return { [node.alias?.value ?? node.name.value]:
      node.selectionSet ? fakeSelection(node.selectionSet) : null };
  }));
}
async function exercise(schema: GraphQLSchema, catalog = outputWitnesses(schema)) {
  assert.deepEqual(outputWitnesses(schema), catalog);
  for (const row of catalog) {
    if (row.status === "no-path") {
      assert.deepEqual(row.reasons, [{ coordinate: row.coordinate, reason: "no public query/mutation output path" }]);
      continue;
    }
    assertSelected(schema, row);
    const before = structuredClone(row.probe);
    const operation = operationNode(row.probe.document);
    if (operation.operation === "subscription") throw new Error("unexpected subscription witness");
    const operationKind = operation.operation === "query" ? "query" : "mutation";
    const data = fakeSelection(operation.selectionSet);
    let factories = 0, calls = 0;
    const factory = () => {
      factories++;
      return { client: { async rawRequest(document: string, variables?: Record<string, unknown>) {
        calls++;
        assert.equal(document, before.document);
        assert.equal(variables, row.probe.variables);
        assert.deepEqual(variables, before.variables);
        return { data };
      } } };
    };
    if (row.reasons.some(reason => reason.generatorLimit)) {
      assert.equal(row.status, "blocked");
      assert.deepEqual(row.probe, before);
      continue;
    }
    if (row.status === "blocked") {
      assert(row.reasons.length > 0);
      for (const execute of [false, true])
        await assert.rejects(executeApi({ ...row.probe, execute }, factory, schema), { name: "ApiExecutionError" });
      assert.equal(factories, 0);
      assert.equal(calls, 0);
    } else {
      assert.deepEqual(row.reasons, []);
      assert.deepEqual(await executeApi(row.probe, factory, schema),
        { ok: true, executed: false, operation: operationKind });
      assert.equal(factories, 0);
      const result = await executeApi({ ...row.probe, execute: true }, factory, schema);
      assert.deepEqual(result, { ok: true, executed: true, operation: operationKind, data });
      assert.equal(result.data, data);
      assert.equal(factories, 1);
      assert.equal(calls, 1);
    }
    assert.deepEqual(row.probe, before);
  }
  return catalog;
}

describe("nonroot output structural witnesses", () => {
  let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
  beforeEach(() => {
    const forbidden = () => { throw new Error("network forbidden in output witnesses"); };
    fetchSpy = spyOn(globalThis, "fetch").mockImplementation(Object.assign(forbidden, { preconnect: forbidden }));
  });
  afterEach(() => {
    try { expect(fetchSpy).not.toHaveBeenCalled(); }
    finally { fetchSpy.mockRestore(); }
  });
  test("accounts exactly once for every inventory nonroot candidate field and argument", () => {
    const inventory = JSON.parse(readFileSync(
      new URL("../../codegen/api-inventory.json", import.meta.url), "utf8",
    )) as {
      roots: Record<string, string | null>;
      coordinates: { coordinate: string; kind: string; scope: string }[];
    };
    const expected = inventory.coordinates.filter(row =>
      row.scope === "public-candidate" && ["field", "argument"].includes(row.kind)
      && !Object.values(inventory.roots).some(root => root && row.coordinate.startsWith(root + ".")),
    ).map(row => row.coordinate).sort();
    assert.deepEqual(rows.map(row => row.coordinate), expected);
    assert.equal(new Set(rows.map(row => row.coordinate)).size, rows.length);
    assert.equal(createHash("sha256")
      .update(readFileSync(new URL("./api-schema.graphql", import.meta.url))).digest("hex"),
    "3d752013e460b853f839aa6f156f23ff85cad8f74035ef5675072c509f53a76d");
    assert.deepEqual({
      total: rows.length, witness: rows.filter(row => row.status === "witness").length,
      blocked: rows.filter(row => row.status === "blocked").length,
      noPath: rows.filter(row => row.status === "no-path").length,
    }, { total: 4851, witness: 4108, blocked: 13, noPath: 730 });
  });
  test("selects each target and preserves documents/variables through offline and fake execution",
    async () => { await exercise(schema, rows); }, 60000);

  test("sibling fragments cannot resurrect excluded types; wider alternatives remain usable", async () => {
    const types = `
      interface Node { id: ID! next: Node }
      type A implements Node { id: ID! next: A }
      type B implements Node { id: ID! next: B onlyB(arg: Int): String }
      type Holder { node: Node }
    `;
    for (const alternative of [false, true]) {
      const fixture = buildSchema(`${types} type Query { a: A ${alternative ? "z: Holder" : ""} }`);
      const catalog = await exercise(fixture);
      const target = catalog.find(row => row.coordinate === "B.onlyB(arg:)")!;
      if (!alternative) {
        assert.equal(target.status, "no-path");
        assert(catalog.filter(row => row.coordinate.startsWith("B.")).every(row => row.status === "no-path"));
      } else {
        assert(target.status === "witness");
        assert.deepEqual(target.path, ["Query.z", "Holder.node", "...on B", "B.onlyB"]);
      }
      const a = { __typename: "A", id: "a" }, b = { __typename: "B", id: "b" };
      let bCalls = 0;
      for (const row of catalog.filter(row => row.status === "witness")) {
        assert(row.status === "witness");
        const result = await execute({ schema: fixture, document: parse(row.probe.document),
          variableValues: row.probe.variables, rootValue: { a, z: { node: b } },
          fieldResolver(source, _args, _context, info) {
            if (info.fieldName === "next") return source;
            if (info.fieldName === "onlyB") { bCalls++; return "reached"; }
            return source[info.fieldName];
          },
        });
        assert.equal(result.errors, undefined);
      }
      assert.equal(bCalls, alternative ? 2 : 0);
      for (const impossible of [
        "query { a { ... on Node { ... on B { onlyB } } } }",
        "query { a { ... on Node { next { ... on B { onlyB } } } } }",
      ]) {
        assert.throws(() => assertRuntimeSelections(fixture, impossible), /empty runtime intersection/);
        let calls = 0;
        const result = await execute({ schema: fixture, document: parse(impossible), rootValue: { a },
          fieldResolver(source, _args, _context, info) {
            if (info.fieldName === "next") return source;
            if (info.fieldName === "onlyB") calls++;
            return source[info.fieldName];
          },
        });
        assert.equal(result.errors, undefined);
        assert.equal(calls, 0);
      }
    }
  });

  test("nullable one-of placeholders are generator limits, not api restrictions", async () => {
    const fixture = buildSchema(`
      input Choice @oneOf { value: String }
      type Item { nullable(choice: Choice): String required(choice: Choice!): String }
      type Query { item: Item }
    `);
    const catalog = await exercise(fixture);
    const row = catalog.find(row => row.coordinate === "Item.nullable(choice:)")!;
    assert(row.status === "blocked");
    assert.deepEqual(row.reasons, [{ coordinate: "Item.nullable(choice:)",
      reason: "one-of input generation not supported", generatorLimit: true }]);
    assert.deepEqual(row.probe.variables, { v1_choice: null });
    const factory = () => ({ client: { async rawRequest() { return { data: { item: { nullable: null } } }; } } });
    assert.equal((await executeApi(row.probe, factory, fixture)).executed, false);
    assert.equal((await executeApi({ ...row.probe, execute: true }, factory, fixture)).executed, true);
  });

  const body = `
    input Filter { enabled: Boolean }
    interface Node { id: ID! }
    type Item implements Node {
      id: ID! next: Item value(id: Int!, tags: [Filter!], count: Int! = 7): String
    }
    union Result = Item
    type Lost { value: Int }
    type Only { value: Int }
    type Wrapper { item: Item }
    "[internal]" input Secret { id: ID }
    type Made { ok: Boolean }
    type Mutation { make: Made }
  `;
  for (const [label, root, path] of [
    ["object", "a(secret: Secret!): Item z(id: ID!): Item long: Wrapper", ["Query.z", "Item.value"]],
    ["union", "a(secret: Secret!): Item z(id: ID!): Result", ["Query.z", "...on Item", "Item.value"]],
    ["interface", "a(secret: Secret!): Item z(id: ID!): Node", ["Query.z", "...on Item", "Item.value"]],
  ] as const) {
    test(`${label}: bounded recursion, blocked alternative, fragments and argument collisions`, async () => {
      const fixture = buildSchema(`${body} type Query { ${root} only(secret: Secret!): Only }`);
      const catalog = await exercise(fixture);
      const selected = catalog.find(row => row.coordinate === "Item.value(tags:)")!;
      assert(selected.status === "witness");
      assert.deepEqual(selected.path, path);
      const index = path.length - 1;
      assert.deepEqual(selected.probe.variables, {
        v0_id: "dummy", [`v${index}_id`]: 0, [`v${index}_tags`]: [{}],
      });
      for (const [coordinate, status] of [
        ["Only.value", "blocked"], ["Lost.value", "no-path"],
        ["Made.ok", "witness"], ["Item.next", "witness"], ["Node.id", "witness"],
      ]) assert.equal(catalog.find(row => row.coordinate === coordinate)?.status, status);
      assert.throws(() => assertSelected(fixture, {
        ...selected, probe: { ...selected.probe, document: "query { __typename }" },
      }));
    });
  }
});
