import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { buildSchema, getVariableValues, Kind, parse, validate, type GraphQLSchema } from "graphql";
import { executeApi, getApiSchema } from "./api";
import { enumSlot, enumWitnesses } from "./api-enum.test-support";

const schema = getApiSchema(), rows = enumWitnesses(schema);
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
beforeEach(() => {
  const forbidden = () => { throw new Error("network forbidden in enum witnesses"); };
  fetchSpy = spyOn(globalThis, "fetch").mockImplementation(Object.assign(forbidden, { preconnect: forbidden }));
});
afterEach(() => {
  try { expect(fetchSpy).not.toHaveBeenCalled(); }
  finally { fetchSpy.mockRestore(); }
});
function selected(value: unknown, path: readonly string[]): unknown {
  if (Array.isArray(value)) { expect(value).toHaveLength(1); return selected(value[0], path); }
  if (!path.length) return value;
  expect(value !== null && typeof value === "object").toBe(true);
  expect(Object.hasOwn(value as object, path[0]!)).toBe(true);
  return selected((value as Record<string, unknown>)[path[0]!], path.slice(1));
}
async function exercise(s: GraphQLSchema, catalog = enumWitnesses(s)) {
  for (const row of catalog) {
    if (row.status === "no-input-witness") {
      expect(row.reasons.length).toBeGreaterThan(0);
      continue;
    }
    const { probe } = row, original = structuredClone(probe.variables);
    expect(selected(probe.variables, row.path)).toBe(row.literal);
    const document = parse(probe.document);
    expect(validate(s, document)).toEqual([]);
    const operation = document.definitions.find(node => node.kind === Kind.OPERATION_DEFINITION)!;
    if (operation.operation === "subscription") throw new Error("unexpected subscription witness");
    const operationKind = operation.operation === "query" ? "query" : "mutation";
    expect(getVariableValues(s, operation.variableDefinitions ?? [], probe.variables).errors).toBeUndefined();
    let factories = 0, calls = 0;
    const data = { coordinate: row.coordinate };
    const factory = () => {
      factories++;
      return { client: { async rawRequest(text: string, variables?: Record<string, unknown>) {
        calls++;
        expect(text).toBe(probe.document);
        expect(variables).toBe(probe.variables);
        expect(variables).toEqual(original);
        return { data };
      } } };
    };
    expect(await executeApi(probe, factory, s))
      .toEqual({ ok: true, executed: false, operation: operationKind });
    expect(factories).toBe(0);
    expect(await executeApi({ ...probe, execute: true }, factory, s))
      .toEqual({ ok: true, executed: true, operation: operationKind, data });
    expect(factories).toBe(1);
    expect(calls).toBe(1);
    expect(probe.variables).toEqual(original);
  }
}
test("pinned enum values have complete deterministic accounting", () => {
  expect(createHash("sha256")
    .update(readFileSync(new URL("./api-schema.graphql", import.meta.url))).digest("hex"))
    .toBe("3d752013e460b853f839aa6f156f23ff85cad8f74035ef5675072c509f53a76d");
  const inventory = JSON.parse(readFileSync(
    new URL("../../codegen/api-inventory.json", import.meta.url), "utf8",
  )) as { coordinates: { coordinate: string; kind: string; scope: string }[] };
  expect(rows.map(row => row.coordinate)).toEqual(inventory.coordinates
    .filter(row => row.kind === "enum-value" && row.scope === "public-candidate")
    .map(row => row.coordinate).sort());
  expect(new Set(rows.map(row => row.coordinate)).size).toBe(664);
  expect(rows).toHaveLength(664);
  expect(rows.filter(row => row.status === "witness")).toHaveLength(325);
  expect(rows.filter(row => row.status === "no-input-witness")).toHaveLength(339);
  expect(enumWitnesses(schema)).toEqual(rows);
});
test("every generated enum witness validates and forwards offline", async () => {
  await exercise(schema, rows);
}, 60000);
test("renamed fields select nested nonempty arrays without changing siblings", async () => {
  for (const field of ["renamed", "otherName"]) {
    const s = buildSchema(`
      enum Choice { FIRST SECOND "[internal]" SECRET _dummy }
      input Box { ${field}: [[Choice!]!] sibling: Choice! }
      type Query { item(box: Box): Boolean }
    `);
    const catalog = enumWitnesses(s);
    expect(catalog.map(row => row.coordinate)).toEqual(["Choice.FIRST", "Choice.SECOND"]);
    const row = catalog[1]!;
    if (row.status !== "witness") throw new Error("missing enum witness");
    expect(row.path).toEqual(["box", field]);
    expect(row.probe.variables).toEqual({ box: { [field]: [["SECOND"]], sibling: "FIRST" } });
    await exercise(s, catalog);
    let factories = 0;
    const forbidden = () => { factories++; throw new Error("unexpected client acquisition"); };
    for (const literal of ["SECRET", "_dummy", "BOGUS", 'SECOND) { __schema { types { name } } }']) {
      const variables = enumSlot(row.probe.variables, row.path, literal) as Record<string, unknown>;
      for (const execute of [false, true])
        await expect(executeApi({ ...row.probe, variables, execute }, forbidden, s))
          .rejects.toMatchObject({ name: "ApiExecutionError" });
    }
    expect(factories).toBe(0);
    expect(row.probe.variables).toEqual({ box: { [field]: [["SECOND"]], sibling: "FIRST" } });
  }
});
test("alternate roots work; output-only enums retain explicit missing-path evidence", async () => {
  const s = buildSchema(`
    enum Choice { A B }
    enum OutputOnly { C }
    "[internal]" enum Hidden { D }
    "[internal]" type Private { id: ID }
    type Query { a(value: Choice): Private z(value: Choice): OutputOnly }
  `);
  const catalog = enumWitnesses(s);
  expect(catalog.map(row => row.coordinate)).toEqual(["Choice.A", "Choice.B", "OutputOnly.C"]);
  expect(catalog[0]).toMatchObject({ root: "Query.z", path: ["value"] });
  expect(catalog[2]).toEqual({
    coordinate: "OutputOnly.C", literal: "C", status: "no-input-witness",
    reasons: [{ coordinate: "OutputOnly.C", reason: "no usable generated input witness; generator limits are not api restrictions" }],
  });
  await exercise(s, catalog);
});
test("theme device and mode literals use nested user-settings arguments", () => {
  const theme = rows.filter(row => /^UserSettingsTheme(DeviceType|Mode)\./.test(row.coordinate));
  expect(theme.map(row => row.coordinate)).toEqual([
    "UserSettingsThemeDeviceType.desktop", "UserSettingsThemeDeviceType.mobileWeb",
    "UserSettingsThemeMode.dark", "UserSettingsThemeMode.light",
  ]);
  for (const row of theme) {
    if (row.status !== "witness") throw new Error("missing theme argument witness");
    const argument = row.coordinate.startsWith("UserSettingsThemeDeviceType.") ? "deviceType" : "mode";
    expect(row.root).toBe("Query.userSettings");
    expect(row.path).toEqual([`v1_${argument}`]);
    expect(row.probe.document).toContain(`theme(${argument}: $v1_${argument})`);
    expect(row.probe.variables).toEqual({ [`v1_${argument}`]: row.literal });
  }
});
test("nested enum arguments replace blocked roots, but never usable roots", async () => {
  for (const argument of ["renamed", "otherName"]) for (const rootUsable of [false, true]) {
    const s = buildSchema(`
      enum Choice { FIRST SECOND "[internal]" SECRET _dummy }
      enum OutputOnly { C }
      "[internal]" type Private { id: ID }
      type Child { theme(${argument}: [[Choice!]!], sibling: Choice!): OutputOnly }
      type Query { a(value: Choice): ${rootUsable ? "Boolean" : "Private"} child: Child }
    `);
    const catalog = enumWitnesses(s);
    expect(enumWitnesses(s)).toEqual(catalog);
    expect(catalog.map(row => row.coordinate)).toEqual(["Choice.FIRST", "Choice.SECOND", "OutputOnly.C"]);
    expect(catalog[2]?.status).toBe("no-input-witness");
    const row = catalog[1]!;
    if (row.status !== "witness") throw new Error("missing nested enum witness");
    expect(row.root).toBe(rootUsable ? "Query.a" : "Query.child");
    expect(row.path).toEqual(rootUsable ? ["value"] : [`v1_${argument}`]);
    expect(row.probe.variables).toEqual(rootUsable ? { value: "SECOND" }
      : { [`v1_${argument}`]: [["SECOND"]], v1_sibling: "FIRST" });
    await exercise(s, catalog);
    let factories = 0;
    const forbidden = () => { factories++; throw new Error("unexpected client acquisition"); };
    for (const literal of ["SECRET", "_dummy", "BOGUS", "SECOND) { __schema { types { name } } }"])
      for (const execute of [false, true]) {
        const variables = enumSlot(row.probe.variables, row.path, literal) as Record<string, unknown>;
        await expect(executeApi({ ...row.probe, variables, execute }, forbidden, s))
          .rejects.toMatchObject({ name: "ApiExecutionError" });
      }
    expect(factories).toBe(0);
  }
});
test("substitution rejects bogus fields and empty selected arrays", () => {
  expect(() => enumSlot({ actual: "A" }, ["renamed"], "B")).toThrow("missing witness slot");
  expect(() => enumSlot({ actual: [] }, ["actual"], "B")).toThrow("singleton witness list");
  expect(enumSlot({ actual: [["A"]], sibling: "A" }, ["actual"], "B"))
    .toEqual({ actual: [["B"]], sibling: "A" });
});
