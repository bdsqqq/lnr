import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSchema, graphql } from "graphql";
import {
  captureSchema, captureToFile, INVENTORY_QUERY, serialize, TYPE_QUERY, retryIntrospection,
  type Transport,
} from "./introspection";

const schema = buildSchema(`
  schema { query: ReadRoot mutation: WriteRoot }
  interface Node { id: ID! }
  type Item implements Node { id: ID! title: String }
  type Other { value: Int }
  union Result = Item | Other
  enum Mode { LIVE OLD @deprecated(reason: "old mode") }
  input Nested { enabled: Boolean = false }
  input Filter {
    nested: [[Nested!]!]
    mode: Mode = LIVE
    old: String = "kept" @deprecated(reason: "old input")
  }
  type ReadRoot {
    find(filter: Filter, old: Int = 0 @deprecated(reason: "old arg")): [Result!]!
    legacy: String @deprecated(reason: "old field")
  }
  type WriteRoot { set(filter: Filter!): Item }
`);
const options = { sdkVersion: "95.1.0", batchSize: 1, now: () => new Date("2026-09-22T00:00:00Z") };
const transport: Transport = (source, variableValues) => graphql({ schema, source, variableValues });
type Json = Record<string, any>;
function mutate(change: (data: Json, variables?: Record<string, unknown>) => void): Transport {
  return async (query, variables) => {
    const result = structuredClone(await transport(query, variables)) as Json;
    change(result, variables);
    return result;
  };
}
function type(snapshot: Awaited<ReturnType<typeof captureSchema>>, name: string): Json {
  return snapshot.__schema.types.find((entry) => entry.name === name)!;
}

describe("complete introspection", () => {
  test("batched capture preserves the graph while reducing request count", async () => {
    let requests = 0;
    const counted: Transport = async (query, variables) => {
      requests++;
      return transport(query, variables);
    };
    const batched = await captureSchema(counted, { ...options, batchSize: 8 });
    const single = await captureSchema(transport, options);
    expect(serialize(batched.__schema)).toBe(serialize(single.__schema));
    expect(requests).toBe(Math.ceil(single.__schema.types.length / 8) * 2 + 2);
  });

  test("retries only transient introspection failures with a three-attempt cap", async () => {
    const waits: number[] = [];
    let attempts = 0;
    const transport = retryIntrospection(async () => {
      if (++attempts < 3) throw { status: 503 };
      return { data: {} };
    }, async (ms) => { waits.push(ms); });
    expect(await transport(INVENTORY_QUERY)).toEqual({ data: {} });
    expect(waits).toEqual([1000, 2000]);
    for (const status of [400, 401, 403, 429, 503]) {
      attempts = 0;
      const failing = retryIntrospection(async () => { attempts++; throw { status }; }, async () => {});
      await expect(failing(INVENTORY_QUERY)).rejects.toEqual({ status });
      expect(attempts).toBe([429, 503].includes(status) ? 3 : 1);
    }
  });

  test("captures roots, named kinds, nested refs and deprecated inputs", async () => {
    const snapshot = await captureSchema(transport, options);
    expect(snapshot.__schema.queryType).toMatchObject({ name: "ReadRoot", kind: "OBJECT" });
    expect(snapshot.__schema.mutationType).toMatchObject({ name: "WriteRoot", kind: "OBJECT" });
    expect(snapshot.__schema.subscriptionType).toBeNull();
    expect(snapshot.__schema.types.length).toBe(Object.keys(schema.getTypeMap()).length);
    expect(type(snapshot, "Result").possibleTypes.map((item: Json) => item.name).sort()).toEqual(["Item", "Other"]);
    expect(type(snapshot, "Item").interfaces[0].name).toBe("Node");
    const fields = type(snapshot, "ReadRoot").fields;
    expect(fields.find((item: Json) => item.name === "legacy").isDeprecated).toBe(true);
    const oldArg = fields.find((item: Json) => item.name === "find").args.find((item: Json) => item.name === "old");
    expect(oldArg).toMatchObject({ defaultValue: "0", isDeprecated: true, deprecationReason: "old arg" });
    const inputs = type(snapshot, "Filter").inputFields;
    expect(inputs.find((item: Json) => item.name === "old")).toMatchObject({ defaultValue: '"kept"', isDeprecated: true });
    expect(inputs.find((item: Json) => item.name === "nested").type.ofType.kind).toBe("NON_NULL");
    expect(type(snapshot, "Nested").inputFields[0].defaultValue).toBe("false");
    expect(type(snapshot, "Mode").enumValues.find((item: Json) => item.name === "OLD").isDeprecated).toBe(true);
    expect(snapshot.__schema.directives.length).toBeGreaterThan(0);
    expect(snapshot.provenance.schemaSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  test("query documents execute without unknown or unused fragments", async () => {
    expect((await transport(INVENTORY_QUERY) as Json).errors).toBeUndefined();
    expect((await transport(TYPE_QUERY, { name: "ReadRoot" }) as Json).errors).toBeUndefined();
  });

  test("canonical output ignores server ordering", async () => {
    function reverse(value: unknown): void {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) value.reverse();
      for (const child of Object.values(value)) reverse(child);
    }
    expect(serialize(await captureSchema(mutate(reverse), options)))
      .toBe(serialize(await captureSchema(transport, options)));
  });

  let itemReads = 0;
  const invalid: [string, Transport][] = [
    ["unknown directive location", mutate((result) => {
      if (result.data?.__schema) result.data.__schema.directives[0].locations = ["NOT_A_LOCATION"];
    })],
    ["duplicate default input field", mutate((result, vars) => {
      if (vars?.name === "Filter") {
        result.data.__type.inputFields.find((field: Json) => field.name === "nested").defaultValue =
          '[[{enabled: true, enabled: false}]]';
      }
    })],
    ["omitted interface possible type", mutate((result, vars) => {
      if (vars?.name === "Node") result.data.__type.possibleTypes = [];
    })],
    ["extra interface possible type", mutate((result, vars) => {
      if (vars?.name === "Node") {
        result.data.__type.possibleTypes.push({ kind: "OBJECT", name: "Other" });
      }
    })],
    ["wrong-kind interface possible type", mutate((result, vars) => {
      if (vars?.name === "Node") {
        result.data.__type.possibleTypes = [{ kind: "INTERFACE", name: "Node" }];
      }
    })],
    ["unknown enum default", mutate((result, vars) => {
      if (vars?.name === "Filter") {
        result.data.__type.inputFields.find((field: Json) => field.name === "mode").defaultValue = "ABSENT";
      }
    })],
    ["invalid nested input default", mutate((result, vars) => {
      if (vars?.name === "Filter") {
        result.data.__type.inputFields.find((field: Json) => field.name === "nested").defaultValue =
          '[[{enabled: "false"}]]';
      }
    })],
    ["out-of-range int default", mutate((result, vars) => {
      if (vars?.name === "ReadRoot") {
        result.data.__type.fields.find((field: Json) => field.name === "find")
          .args.find((arg: Json) => arg.name === "old").defaultValue = "2147483648";
      }
    })],
    ["second-pass field-only drift", mutate((result, vars) => {
      if (vars?.name === "Item" && ++itemReads === 2) {
        result.data.__type.fields.find((field: Json) => field.name === "title").type =
          { kind: "SCALAR", name: "Int", ofType: null };
      }
    })],
    ["null type", mutate((result, vars) => { if (vars?.name === "Item") result.data.__type = null; })],
    ["partial graphql errors", mutate((result) => { result.errors = [{ message: "partial" }]; })],
    ["missing data", async () => ({})],
    ["http error", async () => ({ status: 503, data: {} })],
    ["unsupported introspection", async () => ({ errors: [{ message: "Unknown argument includeDeprecated" }] })],
    ["truncated reference", mutate((result, vars) => {
      if (vars?.name === "ReadRoot") result.data.__type.fields[0].type = { kind: "LIST", name: null };
    })],
    ["unknown reference", mutate((result, vars) => {
      if (vars?.name === "ReadRoot") result.data.__type.fields[0].type = { kind: "OBJECT", name: "Absent" };
    })],
    ["missing deprecation metadata", mutate((result, vars) => {
      if (vars?.name === "Filter") delete result.data.__type.inputFields[0].isDeprecated;
    })],
    ["network failure", async () => { throw new Error("offline"); }],
  ];
  for (const [name, request] of invalid) {
    test(`${name} preserves the existing snapshot`, async () => {
      const directory = await mkdtemp(join(tmpdir(), "lnr-introspection-"));
      const path = join(directory, "schema.json");
      try {
        await writeFile(path, "sentinel\n");
        await expect(captureToFile(path, request, options)).rejects.toThrow();
        expect(await readFile(path, "utf8")).toBe("sentinel\n");
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });
  }

  test("rejects an inventory change during capture", async () => {
    let inventories = 0;
    const changed = mutate((result, variables) => {
      if (!variables && ++inventories === 2) result.data.__schema.types.pop();
    });
    await expect(captureSchema(changed, options)).rejects.toThrow("inventory changed");
  });

  test("publishes the canonical envelope", async () => {
    const directory = await mkdtemp(join(tmpdir(), "lnr-introspection-"));
    const path = join(directory, "schema.json");
    try {
      await captureToFile(path, transport, options);
      expect(await readFile(path, "utf8")).toBe(serialize(await captureSchema(transport, options)));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
