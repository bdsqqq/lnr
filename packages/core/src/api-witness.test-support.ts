import {
  getNamedType, isCompositeType, isEnumType, isInputObjectType, isListType, isNonNullType,
  type GraphQLField, type GraphQLInputType, type GraphQLObjectType, type GraphQLSchema,
} from "graphql";

type Operation = "query" | "mutation" | "subscription";
type Member = { name: string; description?: string | null };
type Blocker = { coordinate: string; reason: string; generatorLimit?: true };
export const internal = (item: Member) =>
  item.name === "_dummy" || /\[internal\]/i.test(item.description ?? "");
const required = (item: { type: GraphQLInputType; defaultValue?: unknown }) =>
  isNonNullType(item.type) && item.defaultValue === undefined;
const sorted = <T extends Member>(items: readonly T[]) => [...items].sort((a, b) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/** Structural values only; an omitted target preserves the required-only root baseline. */
export function witness(
  operation: Operation, parent: { name: string }, field: GraphQLField<unknown, unknown>,
  target?: readonly string[],
) {
  const blocked: Blocker[] = [];
  function check(item: Member, coordinate: string, reason: string) {
    if (internal(item)) blocked.push({ coordinate, reason });
  }
  function value(
    type: GraphQLInputType, coordinate: string, ancestors: string[] = [], path?: readonly string[],
  ): unknown {
    if (isNonNullType(type)) return value(type.ofType, coordinate, ancestors, path);
    check(getNamedType(type), getNamedType(type).name, `internal required input type at ${coordinate}`);
    if (isListType(type)) return path === undefined ? []
      : [value(type.ofType, coordinate, ancestors, path)];
    if (isInputObjectType(type)) {
      if (ancestors.includes(type.name) || type.isOneOf) {
        blocked.push({ coordinate, generatorLimit: true, reason: type.isOneOf
          ? "one-of input generation not supported" : "required-only input cycle" });
        return null;
      }
      if (path?.length && !type.getFields()[path[0]!])
        throw new Error(`unknown witness field: ${coordinate}`);
      return Object.fromEntries(Object.values(type.getFields())
        .filter(input => required(input) || input.name === path?.[0]).map(input => {
          const at = `${type.name}.${input.name}`;
          check(input, at, "internal required input field");
          const chosen = input.name === path?.[0];
          // Consuming a finite target permits repeated types; only implicit recursion needs a guard.
          return [input.name, value(input.type, at, chosen ? [] : [...ancestors, type.name],
            chosen ? path!.slice(1) : undefined)];
        }));
    }
    if (path?.length) throw new Error(`witness path traverses leaf: ${coordinate}`);
    if (isEnumType(type)) {
      const allowed = type.getValues().find(item => !internal(item));
      if (!allowed) blocked.push({ coordinate: type.name, reason: `no public enum value at ${coordinate}` });
      const chosen = allowed ?? type.getValues()[0];
      if (!chosen) throw new Error(`empty enum ${type.name}`);
      return chosen.name;
    }
    return type.name === "Boolean" ? false : type.name === "Int" || type.name === "Float" ? 0 : "dummy";
  }
  if (target && (!target.length || !field.args.some(arg => arg.name === target[0])))
    throw new Error("unknown witness argument");
  const args = field.args.filter(arg => required(arg) || arg.name === target?.[0]);
  const variables: Record<string, unknown> = {};
  for (const arg of args) {
    const at = `${parent.name}.${field.name}(${arg.name}:)`;
    check(arg, at, "internal required argument");
    variables[arg.name] = value(arg.type, at, [], arg.name === target?.[0] ? target!.slice(1) : undefined);
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

type Route = {
  operation: "query" | "mutation"; parent: GraphQLObjectType; field: GraphQLField<unknown, unknown>;
  path: string[]; type: GraphQLInputType; coordinate: string;
};
type Candidate = { root: string; path: string[]; probe: ReturnType<typeof witness>; reasons: Blocker[] };

/**
 * Returns one accounting row per candidate, not coverage-ledger classifications.
 * Sorted breadth-first search chooses shortest paths; a second pass tries usable alternatives.
 * Under this generator, extending a path cannot remove a prefix's required blockers.
 * Once a usable prefix reaches a type, suffix generation is independent of that
 * prefix: selected steps reset the required-only recursion guard. Expanding each
 * type once therefore bounds cycles without discarding usable alternate roots.
 * Outputs, nested-output arguments and enum-value enumeration are outside this slice.
 */
export function inputWitnesses(schema: GraphQLSchema) {
  const seeds: Route[] = [], coordinates: string[] = [];
  for (const [operation, parent] of [
    ["query", schema.getQueryType()], ["mutation", schema.getMutationType()],
  ] as const) {
    if (!parent || internal(parent)) continue;
    for (const field of sorted(Object.values(parent.getFields())).filter(item => !internal(item))) {
      for (const arg of sorted(field.args).filter(item => !internal(item))) {
        const coordinate = `${parent.name}.${field.name}(${arg.name}:)`;
        coordinates.push(coordinate);
        seeds.push({ operation, parent, field, path: [arg.name], type: arg.type, coordinate });
      }
    }
  }
  seeds.sort((a, b) => a.coordinate < b.coordinate ? -1 : a.coordinate > b.coordinate ? 1 : 0);
  for (const type of Object.values(schema.getTypeMap())) {
    if (!isInputObjectType(type) || internal(type)) continue;
    for (const field of Object.values(type.getFields()).filter(item => !internal(item)))
      coordinates.push(`${type.name}.${field.name}`);
  }
  function search(usableOnly: boolean) {
    const queue = [...seeds], expanded = new Set<string>(), found = new Map<string, Candidate>();
    for (let i = 0; i < queue.length; i++) {
      const route = queue[i]!;
      const { operation, parent, field, path, coordinate } = route;
      const probe = witness(operation, parent, field, path), reasons = [...probe.blocked];
      if (operation === "mutation" && field.name === "cycleCreate"
        && field.deprecationReason === "Cycle creation is not supported.")
        reasons.push({ coordinate: `${parent.name}.${field.name}`, reason: "cycle creation is unavailable upstream" });
      if (usableOnly && reasons.length) continue;
      if (!found.has(coordinate))
        found.set(coordinate, { root: `${parent.name}.${field.name}`, path, probe, reasons });
      const type = getNamedType(route.type);
      if (!isInputObjectType(type) || internal(type) || expanded.has(type.name)) continue;
      expanded.add(type.name);
      for (const input of sorted(Object.values(type.getFields())).filter(item => !internal(item)))
        queue.push({ ...route, path: [...path, input.name], type: input.type,
          coordinate: `${type.name}.${input.name}` });
    }
    return found;
  }
  const shortest = search(false), usable = search(true);
  return coordinates.sort().map(coordinate => {
    const candidate = usable.get(coordinate) ?? shortest.get(coordinate);
    return candidate
      ? { coordinate, status: candidate.reasons.length ? "blocked" as const : "witness" as const, ...candidate }
      : { coordinate, status: "no-path" as const,
        reasons: [{ coordinate, reason: "no public query/mutation argument path" }] };
  });
}
