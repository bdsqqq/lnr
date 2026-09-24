import {
  getNamedType, isEnumType, isInputObjectType, isObjectType, type GraphQLSchema,
  type GraphQLNamedType, type GraphQLInputField, Kind, parse, TypeInfo, visit, visitWithTypeInfo,
} from "graphql";
import { inputWitnesses, internal } from "./api-witness.test-support";
import { outputWitnesses } from "./api-output-witness.test-support";
import { nestedInputWitnesses } from "./api-nested-input.test-support";

type InputRow = ReturnType<typeof inputWitnesses>[number];
type Route = Extract<InputRow, { status: "witness" | "blocked" }>;

/** Resolve the selected slot, not an enum-looking sibling or arbitrary JSON value. */
function selectedType(schema: GraphQLSchema, row: Route) {
  const [parentName, fieldName] = row.root.split(".");
  const parent = schema.getType(parentName!);
  if (!isObjectType(parent)) throw new Error("unknown witness root");
  let type = parent.getFields()[fieldName!]?.args.find(arg => arg.name === row.path[0])?.type;
  if (!type) throw new Error("unknown witness argument");
  for (const name of row.path.slice(1)) {
    const input: GraphQLNamedType = getNamedType(type);
    if (!isInputObjectType(input)) throw new Error("witness path traverses leaf");
    const field: GraphQLInputField | undefined = input.getFields()[name];
    if (!field) throw new Error("unknown witness field");
    type = field.type;
  }
  return getNamedType(type);
}

/** Preserve required siblings and selected list wrappers; never synthesize missing paths. */
export function enumSlot(value: unknown, path: readonly string[], literal: string): unknown {
  if (Array.isArray(value)) {
    if (value.length !== 1) throw new Error("expected singleton witness list");
    return [enumSlot(value[0], path, literal)];
  }
  if (!path.length) return literal;
  const [key, ...rest] = path;
  if (!value || typeof value !== "object" || !Object.hasOwn(value, key!))
    throw new Error("missing witness slot");
  const object = value as Record<string, unknown>;
  return { ...object, [key!]: enumSlot(object[key!], rest, literal) };
}

/** Root inputs take precedence; nested argument and input-field slots provide fallback witnesses. */
export function enumWitnesses(schema: GraphQLSchema) {
  type EnumRoute = Pick<Route, "root" | "path" | "probe" | "reasons">;
  const usable = new Map<string, EnumRoute>(), blocked = new Map<string, EnumRoute>();
  for (const row of inputWitnesses(schema)) {
    if (row.status === "no-path") continue;
    const type = selectedType(schema, row);
    if (!isEnumType(type)) continue;
    const routes = row.status === "witness" ? usable : blocked;
    if (!routes.has(type.name)) routes.set(type.name, row);
  }
  const outputs = outputWitnesses(schema);
  for (const row of nestedInputWitnesses(schema, outputs)) {
    const type = schema.getType(row.inputType);
    if (!isEnumType(type) || internal(type)) continue;
    const routes = row.status === "witness" ? usable : blocked;
    if (!routes.has(type.name)) routes.set(type.name, row);
  }
  for (const row of outputs) {
    if (row.status !== "witness" || !row.coordinate.endsWith(":)")) continue;
    const info = new TypeInfo(schema);
    visit(parse(row.probe.document), visitWithTypeInfo(info, {
      Argument(node) {
        const argument = info.getArgument();
        const coordinate = `${info.getParentType()?.name}.${info.getFieldDef()?.name}(${argument?.name}:)`;
        if (coordinate !== row.coordinate || !argument) return;
        const type = getNamedType(argument.type);
        if (!isEnumType(type) || internal(type) || usable.has(type.name)) return;
        if (node.value.kind !== Kind.VARIABLE) throw new Error("expected output argument variable");
        const name = node.value.name.value;
        if (!Object.hasOwn(row.probe.variables, name)) throw new Error("missing output argument variable");
        usable.set(type.name, { ...row, path: [name] });
      },
    }));
  }
  return Object.values(schema.getTypeMap())
    .filter(isEnumType)
    .filter(type => !type.name.startsWith("__") && !internal(type))
    .flatMap(type => type.getValues().filter(value => !internal(value)).map(value => {
      const coordinate = `${type.name}.${value.name}`, route = usable.get(type.name);
      if (!route) return {
        coordinate, literal: value.name, status: "no-input-witness" as const,
        reasons: blocked.get(type.name)?.reasons ?? [
          { coordinate, reason: "no usable generated input witness; generator limits are not api restrictions" },
        ],
      };
      return {
        coordinate, literal: value.name, status: "witness" as const,
        root: route.root, path: route.path,
        probe: { document: route.probe.document, variables:
          enumSlot(route.probe.variables, route.path, value.name) as Record<string, unknown> },
      };
    }))
    .sort((a, b) => a.coordinate < b.coordinate ? -1 : a.coordinate > b.coordinate ? 1 : 0);
}
