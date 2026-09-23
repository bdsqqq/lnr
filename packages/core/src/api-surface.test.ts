import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import {
  buildSchema, getNamedType, getVariableValues, isCompositeType, isEnumType,
  isInputObjectType, isListType, isNonNullType, Kind, parse, validate,
  type GraphQLField, type GraphQLInputType, type GraphQLObjectType,
} from "graphql";
import { executeApi, getApiSchema } from "./api";

type Operation = "query" | "mutation" | "subscription";
type Member = { name: string; description?: string | null };
type Blocker = { coordinate: string; reason: string };
const internal = (item: Member) =>
  item.name === "_dummy" || /\[internal\]/i.test(item.description ?? "");
const required = (item: { type: GraphQLInputType; defaultValue?: unknown }) =>
  isNonNullType(item.type) && item.defaultValue === undefined;

/** minimal structural witnesses, not semantically valid live mutation payloads. */
function witness(operation: Operation, parent: GraphQLObjectType, field: GraphQLField<unknown, unknown>) {
  const blocked: Blocker[] = [];
  function check(item: Member, coordinate: string, reason: string) {
    if (internal(item)) blocked.push({ coordinate, reason });
  }
  function value(type: GraphQLInputType, coordinate: string, ancestors: string[] = []): unknown {
    if (isNonNullType(type)) return value(type.ofType, coordinate, ancestors);
    check(getNamedType(type), getNamedType(type).name, `internal required input type at ${coordinate}`);
    if (isListType(type)) return [];
    if (isInputObjectType(type)) {
      if (ancestors.includes(type.name)) throw new Error(`required input cycle at ${coordinate}`);
      return Object.fromEntries(Object.values(type.getFields()).filter(required).map(input => {
        const at = `${type.name}.${input.name}`;
        check(input, at, "internal required input field");
        return [input.name, value(input.type, at, [...ancestors, type.name])];
      }));
    }
    if (isEnumType(type)) {
      const allowed = type.getValues().find(item => !internal(item));
      if (!allowed) blocked.push({ coordinate: type.name, reason: `no public enum value at ${coordinate}` });
      const chosen = allowed ?? type.getValues()[0];
      if (!chosen) throw new Error(`empty enum ${type.name}`);
      return chosen.name;
    }
    return type.name === "Boolean" ? false
      : type.name === "Int" || type.name === "Float" ? 0 : "dummy";
  }
  const args = field.args.filter(required);
  const variables: Record<string, unknown> = {};
  for (const arg of args) {
    const at = `${parent.name}.${field.name}(${arg.name}:)`;
    check(arg, at, "internal required argument");
    variables[arg.name] = value(arg.type, at);
  }
  const output = getNamedType(field.type);
  check(output, output.name, `internal output type at ${parent.name}.${field.name}`);
  const definitions = args.length ? `(${args.map(arg => `$${arg.name}: ${arg.type}`).join(", ")})` : "";
  const argumentsText = args.length ? `(${args.map(arg => `${arg.name}: $${arg.name}`).join(", ")})` : "";
  return {
    document: `${operation}${definitions} { ${field.name}${argumentsText}${
      isCompositeType(output) ? " { __typename }" : ""
    } }`,
    variables, blocked,
  };
}

const schema = getApiSchema();
const roots = [
  ["query", schema.getQueryType()], ["mutation", schema.getMutationType()],
  ["subscription", schema.getSubscriptionType()],
] as const;
const surface = roots.flatMap(([operation, parent]) =>
  Object.values(parent?.getFields() ?? {}).map(field => {
    const coordinate = `${parent!.name}.${field.name}`;
    const skipped = [parent!, field].filter(internal);
    const probe = skipped.length ? undefined : witness(operation, parent!, field);
    const status = skipped.length ? "internal" : operation === "subscription" ? "unsupported"
      : probe!.blocked.length ? "blocked"
      : operation === "mutation" && field.name === "cycleCreate"
        && field.deprecationReason === "Cycle creation is not supported." ? "unavailable" : "success";
    return { operation, coordinate, probe, status };
  }),
);

/** these tests prove lossless fake-transport access, not live permissions or full field coverage. */
describe("captured root surface through executeApi", () => {
  let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
  beforeEach(() => {
    const forbidden = () => { throw new Error("network forbidden in api surface tests"); };
    fetchSpy = spyOn(globalThis, "fetch").mockImplementation(Object.assign(forbidden, { preconnect: forbidden }));
  });
  afterEach(() => {
    try { expect(fetchSpy).not.toHaveBeenCalled(); }
    finally { fetchSpy.mockRestore(); }
  });

  test("frozen counts retain exclusions and gaps rather than claiming parity", () => {
    const counts = Object.fromEntries(roots.map(([operation]) => {
      const rows = surface.filter(row => row.operation === operation);
      const count = (status: string) => rows.filter(row => row.status === status).length;
      return [operation, {
        total: rows.length, internal: count("internal"), success: count("success"),
        blocked: count("blocked"), unavailable: count("unavailable"), unsupported: count("unsupported"),
      }];
    }));
    expect(counts).toEqual({
      query: { total: 172, internal: 20, success: 152, blocked: 0, unavailable: 0, unsupported: 0 },
      mutation: { total: 377, internal: 45, success: 328, blocked: 3, unavailable: 1, unsupported: 0 },
      subscription: { total: 82, internal: 0, success: 0, blocked: 0, unavailable: 0, unsupported: 82 },
    });
    expect(surface.filter(row => row.status === "unavailable").map(row => row.coordinate))
      .toEqual(["Mutation.cycleCreate"]);
    expect(surface.filter(row => row.status === "blocked").map(row => ({
      root: row.coordinate, blocked: row.probe!.blocked,
    }))).toEqual([
      "Mutation.createOrganizationFromOnboarding", "Mutation.joinOrganizationFromOnboarding",
      "Mutation.leaveOrganization",
    ].map(root => ({
      root, blocked: [{
        coordinate: "CreateOrJoinOrganizationResponse", reason: `internal output type at ${root}`,
      }],
    })));
  });

  for (const row of surface) {
    if (row.status === "internal") continue;
    test(`${row.coordinate}: ${row.status}`, async () => {
      const { document, variables } = row.probe!;
      const parsed = parse(document);
      expect(validate(schema, parsed)).toEqual([]);
      const definition = parsed.definitions[0]!;
      if (definition.kind !== Kind.OPERATION_DEFINITION) throw new Error(row.coordinate);
      expect(getVariableValues(schema, definition.variableDefinitions ?? [], variables).errors).toBeUndefined();
      let factories = 0;
      const calls: { document: string; variables?: Record<string, unknown> }[] = [];
      const data = { witness: row.coordinate };
      const factory = () => {
        factories++;
        return { client: {
          async rawRequest(document: string, variables?: Record<string, unknown>) {
            calls.push({ document, variables });
            return { data };
          },
        } };
      };
      if (row.status !== "success") {
        const message = row.status === "unsupported" ? "subscriptions are not supported"
          : row.status === "unavailable" ? "cycle creation is unavailable upstream"
          : "internal schema member is not available";
        for (const execute of [false, true]) {
          await expect(executeApi({ document, variables, execute }, factory, schema))
            .rejects.toMatchObject({ name: "ApiExecutionError", message });
        }
        expect(factories).toBe(0);
        expect(calls).toHaveLength(0);
        return;
      }
      if (row.operation === "subscription") throw new Error("subscription cannot count as reachable");
      expect(await executeApi({ document, variables }, factory, schema)).toEqual({
        ok: true, executed: false, operation: row.operation,
      });
      expect(factories).toBe(0);
      expect(await executeApi({ document, variables, execute: true }, factory, schema)).toEqual({
        ok: true, executed: true, operation: row.operation, data,
      });
      expect(factories).toBe(1);
      expect(calls).toHaveLength(1);
      expect(calls[0]!.document).toBe(document);
      expect(calls[0]!.variables).toBe(variables);
    });
  }

  test("witness omits optional members and non-null defaults, including zero", () => {
    const fixture = buildSchema(`
      scalar Custom
      enum Mode { "[internal]" PRIVATE PUBLIC }
      input Input {
        count: Int! = 0 values: [String!]! mode: Mode! custom: Custom!
        "[internal]" optional: String
      }
      type Item { id: ID! }
      type Query { item(input: Input!, count: Int! = 0, optional: String): Item }
    `);
    const parent = fixture.getQueryType()!;
    const probe = witness("query", parent, parent.getFields().item!);
    expect(probe.blocked).toEqual([]);
    expect(probe.document).toBe("query($input: Input!) { item(input: $input) { __typename } }");
    expect(probe.variables).toEqual({ input: { values: [], mode: "PUBLIC", custom: "dummy" } });
    expect(validate(fixture, parse(probe.document))).toEqual([]);
  });
});
