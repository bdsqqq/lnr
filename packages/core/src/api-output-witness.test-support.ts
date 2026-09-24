import {
  getNamedType, isCompositeType, isInterfaceType, isObjectType, Kind,
  parse, print, visit, type GraphQLCompositeType, type GraphQLField,
  type GraphQLInterfaceType, type GraphQLObjectType, type GraphQLSchema,
  type FieldNode, type InlineFragmentNode, type OperationDefinitionNode,
  type SelectionSetNode, type VariableDefinitionNode,
} from "graphql";
import { internal, witness } from "./api-witness.test-support";

type Operation = "query" | "mutation";
type Owner = GraphQLObjectType | GraphQLInterfaceType;
type FieldStep = { kind: "field"; parent: Owner; field: GraphQLField<unknown, unknown> };
type Step = FieldStep | { kind: "fragment"; type: Owner };
type Route = {
  operation: Operation; type: GraphQLCompositeType; steps: Step[];
  runtime: GraphQLObjectType[];
};
type Probe = ReturnType<typeof witness>;
type Candidate = { root: string; path: string[]; probe: Probe; reasons: Probe["blocked"] };
const sorted = <T extends { name: string }>(items: readonly T[]) => [...items].sort((a, b) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
const operationNode = (document: string) => parse(document).definitions[0] as OperationDefinitionNode;

/**
 * Structural accounting only: shortest means field/inline-fragment AST hops.
 * Breadth-first ties use root type name, then fields before fragments, each name-sorted.
 * The usable search discards blocked prefixes before marking types expanded.
 * Suffix feasibility depends on both static type and feasible concrete parents.
 * Fragment conditions intersect that set; fields use concrete implementation
 * return types, which may narrow an interface's declared return type.
 * Expanding each (static type, concrete set) once bounds cycles without losing
 * usable alternatives; extending a blocked prefix cannot remove its blockers.
 */
export function outputWitnesses(schema: GraphQLSchema) {
  const roots = new Set([
    schema.getQueryType(), schema.getMutationType(), schema.getSubscriptionType(),
  ].filter(type => type != null).map(type => type.name));
  const composites = sorted(Object.values(schema.getTypeMap()).filter(type =>
    isCompositeType(type) && !internal(type) && !type.name.startsWith("__")));
  const owners = composites.filter((type): type is Owner => isObjectType(type) || isInterfaceType(type));
  const coordinates = owners.filter(type => !roots.has(type.name)).flatMap(type =>
    sorted(Object.values(type.getFields())).filter(field => !internal(field)).flatMap(field => [
      `${type.name}.${field.name}`, ...sorted(field.args).filter(arg => !internal(arg))
        .map(arg => `${type.name}.${field.name}(${arg.name}:)`),
    ])).sort();

  const possible = (type: GraphQLCompositeType): readonly GraphQLObjectType[] =>
    isObjectType(type) ? [type] : schema.getPossibleTypes(type);
  function children(route: Route, field: GraphQLField<unknown, unknown>, type: GraphQLCompositeType) {
    const declared = new Set(possible(type));
    return sorted([...new Set(route.runtime.flatMap(parent => {
      const implementation = parent.getFields()[field.name];
      if (!implementation) return [];
      const output = getNamedType(implementation.type);
      return isCompositeType(output) ? possible(output).filter(child => declared.has(child)) : [];
    }))]);
  }

  function probe(operation: Operation, steps: Step[], argument?: string): Probe {
    let selectionSet: SelectionSetNode | undefined;
    const variables: Record<string, unknown> = {}, definitions: VariableDefinitionNode[] = [];
    const blocked: Probe["blocked"] = [];
    for (let i = steps.length - 1; i >= 0; i--) {
      const step = steps[i]!;
      if (step.kind === "fragment") {
        const template = operationNode(`query { ... on ${step.type.name} { __typename } }`)
          .selectionSet.selections[0] as InlineFragmentNode;
        selectionSet = { kind: Kind.SELECTION_SET,
          selections: [{ ...template, selectionSet: selectionSet! }] };
        continue;
      }
      const sample = witness(operation, step.parent, step.field,
        i === steps.length - 1 && argument ? [argument] : undefined);
      blocked.push(...sample.blocked);
      if (step.parent === schema.getMutationType() && step.field.name === "cycleCreate"
        && step.field.deprecationReason === "Cycle creation is not supported.")
        blocked.push({ coordinate: `${step.parent.name}.${step.field.name}`,
          reason: "cycle creation is unavailable upstream" });
      const rename = (name: string) => `v${i}_${name}`;
      const template = visit(operationNode(sample.document), {
        Variable(node) { return { ...node, name: { ...node.name, value: rename(node.name.value) } }; },
      });
      definitions.unshift(...template.variableDefinitions ?? []);
      for (const [key, value] of Object.entries(sample.variables)) variables[rename(key)] = value;
      const field = template.selectionSet.selections[0] as FieldNode;
      selectionSet = { kind: Kind.SELECTION_SET,
        selections: [{ ...field, ...(selectionSet ? { selectionSet } : {}) }] };
    }
    return { document: print({ ...operationNode(`${operation} { __typename }`),
      variableDefinitions: definitions, selectionSet: selectionSet! }), variables, blocked };
  }

  function search(usableOnly: boolean) {
    const queue: Route[] = [];
    for (const [operation, type] of [
      ["query", schema.getQueryType()], ["mutation", schema.getMutationType()],
    ] as const) if (type && !internal(type)) queue.push({ operation, type, steps: [], runtime: [type] });
    queue.sort((a, b) => a.type.name < b.type.name ? -1 : a.type.name > b.type.name ? 1 : 0);
    const expanded = new Set<string>(), found = new Map<string, Candidate>();
    for (let i = 0; i < queue.length; i++) {
      const route = queue[i]!;
      const key = JSON.stringify([route.type.name, route.runtime.map(type => type.name)]);
      if (expanded.has(key)) continue;
      expanded.add(key);
      if (isObjectType(route.type) || isInterfaceType(route.type)) {
        for (const field of sorted(Object.values(route.type.getFields())).filter(field => !internal(field))) {
          const steps: Step[] = [...route.steps, { kind: "field", parent: route.type, field }];
          const coordinate = `${route.type.name}.${field.name}`, baseline = probe(route.operation, steps);
          const argumentsToSelect = sorted(field.args).filter(arg => !internal(arg)).map(arg => arg.name);
          for (const argument of [undefined, ...argumentsToSelect]) {
            const sample = argument ? probe(route.operation, steps, argument) : baseline;
            if (usableOnly && sample.blocked.length) continue;
            const at = argument ? `${coordinate}(${argument}:)` : coordinate;
            const first = steps[0] as FieldStep;
            if (!found.has(at)) found.set(at, { root: `${first.parent.name}.${first.field.name}`,
              path: steps.map(step => step.kind === "field" ? `${step.parent.name}.${step.field.name}`
                : `...on ${step.type.name}`), probe: sample, reasons: sample.blocked });
          }
          const type = getNamedType(field.type);
          if (isCompositeType(type) && !internal(type) && (!usableOnly || !baseline.blocked.length)) {
            const runtime = children(route, field, type);
            if (runtime.length) queue.push({ ...route, type, steps, runtime });
          }
        }
      }
      // Concrete-to-interface fragments also witness the interface's own coordinates.
      if (route.steps.length) for (const type of owners) {
        if (type === route.type) continue;
        const allowed = new Set(possible(type));
        const runtime = route.runtime.filter(parent => allowed.has(parent));
        if (runtime.length)
          queue.push({ ...route, type, runtime, steps: [...route.steps, { kind: "fragment", type }] });
      }
    }
    return found;
  }
  const shortest = search(false), usable = search(true);
  return coordinates.map(coordinate => {
    const candidate = usable.get(coordinate) ?? shortest.get(coordinate);
    return candidate
      ? { coordinate, status: candidate.reasons.length ? "blocked" as const : "witness" as const, ...candidate }
      : { coordinate, status: "no-path" as const,
        reasons: [{ coordinate, reason: "no public query/mutation output path" }] };
  });
}
