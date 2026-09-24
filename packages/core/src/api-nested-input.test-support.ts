import {
  getNamedType, GraphQLBoolean, isInputObjectType, Kind, parse, TypeInfo, visit, visitWithTypeInfo,
  type GraphQLArgument, type GraphQLField, type GraphQLInputType, type GraphQLSchema,
} from "graphql";
import { inputWitnesses, internal, witness } from "./api-witness.test-support";
import { outputWitnesses } from "./api-output-witness.test-support";

type Probe = ReturnType<typeof witness>;
type Output = ReturnType<typeof outputWitnesses>[number];
type Candidate = {
  source: "root" | "nested"; root: string; argument: string; outputPath: string[];
  path: string[]; probe: Probe; reasons: Probe["blocked"];
};
type Context = {
  row: Extract<Output, { status: "witness" | "blocked" }>; argument: GraphQLArgument;
  field: GraphQLField<unknown, unknown>; parent: string; variable: string;
};
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const status = (reasons: Probe["blocked"]) => reasons.some(reason => reason.generatorLimit)
  ? "generator-limit" as const : reasons.length ? "blocked" as const : "witness" as const;

function context(schema: GraphQLSchema, row: Context["row"]): Context {
  const info = new TypeInfo(schema);
  let found: Context | undefined;
  visit(parse(row.probe.document), visitWithTypeInfo(info, {
    Argument(node) {
      const argument = info.getArgument(), field = info.getFieldDef(), parent = info.getParentType();
      if (!argument || !field || !parent
        || parent.name + "." + field.name + "(" + argument.name + ":)" !== row.coordinate) return;
      if (node.value.kind !== Kind.VARIABLE || !Object.hasOwn(row.probe.variables, node.value.name.value))
        throw new Error("missing nested argument variable: " + row.coordinate);
      // Output witnesses contain one selection chain; its last occurrence is the target.
      found = { row, argument, field, parent: parent.name, variable: node.value.name.value };
    },
  }));
  if (!found) throw new Error("unselected nested argument: " + row.coordinate);
  return found;
}

/** Only the argument value is synthetic; never execute or substitute the local document. */
function replace(ctx: Context, path: string[]): Candidate {
  const local = witness("query", { name: ctx.parent },
    { ...ctx.field, args: [ctx.argument], type: GraphQLBoolean }, [ctx.argument.name, ...path]);
  const reasons = [...ctx.row.reasons, ...local.blocked].filter((reason, index, all) =>
    all.findIndex(other => JSON.stringify(other) === JSON.stringify(reason)) === index);
  return { source: "nested", root: ctx.row.root, argument: ctx.row.coordinate,
    outputPath: ctx.row.path, path: [ctx.variable, ...path], reasons,
    probe: { document: ctx.row.probe.document, blocked: reasons,
      variables: { ...ctx.row.probe.variables, [ctx.variable]: local.variables[ctx.argument.name] } } };
}

/**
 * Shortest means output AST hops plus input-field hops; lexical paths break ties.
 * The usable pass tries alternatives before marking an input type expanded.
 * Required siblings cannot disappear when extending a path. Selected input steps
 * reset the implicit recursion guard, so suffix generation is context-independent.
 * One expansion per type per pass therefore bounds cycles without losing alternatives.
 */
export function nestedInputWitnesses(schema: GraphQLSchema, outputs = outputWitnesses(schema)) {
  const seeds = outputs.filter((row): row is Context["row"] =>
    row.status !== "no-path" && row.coordinate.endsWith(":)")).map(row => context(schema, row));
  type Node = { ctx: Context; path: string[]; type: GraphQLInputType; coordinate?: string };
  function search(usableOnly: boolean) {
    const buckets: Node[][] = [], expanded = new Set<string>();
    const found = new Map<string, Candidate & { coordinate: string; inputType: string }>();
    for (const ctx of seeds)
      (buckets[ctx.row.path.length] ??= []).push({ ctx, path: [], type: ctx.argument.type });
    for (let depth = 0; depth < buckets.length; depth++) {
      const nodes = buckets[depth] ?? [];
      nodes.sort((a, b) => compare(JSON.stringify([a.ctx.row.path, a.ctx.row.coordinate, a.path]),
        JSON.stringify([b.ctx.row.path, b.ctx.row.coordinate, b.path])));
      for (const node of nodes) {
        const candidate = replace(node.ctx, node.path);
        if (usableOnly && candidate.reasons.length) continue;
        if (node.coordinate && !found.has(node.coordinate)) found.set(node.coordinate,
          { ...candidate, coordinate: node.coordinate, inputType: getNamedType(node.type).name });
        const type = getNamedType(node.type);
        if (!isInputObjectType(type) || internal(type) || expanded.has(type.name)) continue;
        expanded.add(type.name);
        for (const input of Object.values(type.getFields()).filter(field => !internal(field)))
          (buckets[depth + 1] ??= []).push({ ...node, path: [...node.path, input.name], type: input.type,
            coordinate: type.name + "." + input.name });
      }
    }
    return found;
  }
  return [...new Map([...search(false), ...search(true)]).values()]
    .map(row => ({ ...row, status: status(row.reasons) })).sort((a, b) => compare(a.coordinate, b.coordinate));
}

/** Prefer usable roots, then usable nested contexts; retain blockers and absent paths explicitly. */
export function inputFieldWitnesses(schema: GraphQLSchema, nested = nestedInputWitnesses(schema)) {
  const roots = new Map(inputWitnesses(schema).map(row => [row.coordinate, row]));
  const alternatives = new Map(nested.map(row => [row.coordinate, row]));
  return Object.values(schema.getTypeMap()).filter(isInputObjectType).filter(type => !internal(type))
    .flatMap(type => Object.values(type.getFields()).filter(field => !internal(field)).map(field => {
      const coordinate = type.name + "." + field.name, row = roots.get(coordinate);
      const root: Candidate | undefined = row && row.status !== "no-path" ? {
        source: "root", root: row.root, argument: row.root + "(" + row.path[0] + ":)", outputPath: [row.root],
        path: row.path, probe: row.probe, reasons: row.reasons,
      } : undefined;
      const alternative = alternatives.get(coordinate);
      const candidate: Candidate | undefined = root && !root.reasons.length ? root
        : alternative?.status === "witness" ? alternative : root ?? alternative;
      const inputType = getNamedType(field.type).name;
      return candidate ? { coordinate, inputType, ...candidate, status: status(candidate.reasons) }
        : { coordinate, inputType, status: "no-witness" as const,
          reasons: [{ coordinate, reason: "no public root or nested argument input path" }] };
    })).sort((a, b) => compare(a.coordinate, b.coordinate));
}
