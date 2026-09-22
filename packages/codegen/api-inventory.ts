import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  assertValidSchema, buildSchema, isEnumType, isInputObjectType, isInterfaceType,
  isObjectType, isScalarType, isUnionType, parse, print, visit,
  type ASTNode, type GraphQLArgument, type GraphQLInputField,
} from "graphql";

type Provenance = {
  source: "sdk-release"; sdkVersion: string; commit: string;
  sourceSha256: string; schemaSha256: string; url: string;
};
type Scope = "internal" | "public-candidate";
type Item = {
  name: string; description?: string | null;
  deprecationReason?: string | null; astNode?: ASTNode | null;
};
const schemaFile = "packages/core/src/api-schema.graphql";
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const names = (items: readonly { name: string }[]) => items.map(t => t.name).sort(compare);
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const input = (field: GraphQLArgument | GraphQLInputField) => ({
  type: String(field.type),
  defaultValue: field.astNode?.defaultValue ? print(field.astNode.defaultValue) : null,
});

/** scope candidates are not proven public; coverage needs separate binding evidence. */
export function generateInventory(sdl: string, provenance: Provenance, file = schemaFile): string {
  if (provenance.source !== "sdk-release" || !provenance.sdkVersion ||
      provenance.schemaSha256 !== sha256(sdl)) throw new Error("invalid sdk schema provenance");
  const schema = buildSchema(sdl);
  assertValidSchema(schema);
  const references = new Map<string, ASTNode>();
  visit(parse(sdl), {
    NamedType(node) {
      if (!references.has(node.name.value)) references.set(node.name.value, node);
    },
  });
  const roots = {
    query: schema.getQueryType()?.name ?? null,
    mutation: schema.getMutationType()?.name ?? null,
    subscription: schema.getSubscriptionType()?.name ?? null,
  };
  const coordinates: (Record<string, unknown> & { coordinate: string })[] = [];
  function add(
    item: Item, coordinate: string, kind: string, parent?: Scope,
    extra: Record<string, unknown> = {},
  ): Scope {
    const scope = parent === "internal" || item.name === "_dummy" ||
      /\[internal\]/i.test(item.description ?? "") ? "internal" : "public-candidate";
    const node = item.astNode ?? references.get(item.name);
    if (!node?.loc) throw new Error(`missing source location: ${coordinate}`);
    coordinates.push({
      coordinate, kind, scope, description: item.description ?? null,
      deprecated: item.deprecationReason != null, deprecationReason: item.deprecationReason ?? null,
      coverage: { status: "unclassified" },
      source: { file, line: node.loc.startToken.line, location: item.astNode ? "definition" : "reference" },
      ...extra,
    });
    return scope;
  }
  for (const type of Object.values(schema.getTypeMap())) {
    if (type.name.startsWith("__")) continue;
    if (!type.astNode && !references.has(type.name)) continue;
    const kind = isObjectType(type) ? "OBJECT" : isInterfaceType(type) ? "INTERFACE" :
      isInputObjectType(type) ? "INPUT_OBJECT" : isEnumType(type) ? "ENUM" :
      isUnionType(type) ? "UNION" : "SCALAR";
    const scope = add(type, type.name, kind, undefined, {
      interfaces: isObjectType(type) || isInterfaceType(type) ? names(type.getInterfaces()) : [],
      possibleTypes: isUnionType(type) ? names(type.getTypes()) :
        isInterfaceType(type) ? names(schema.getPossibleTypes(type)) : [],
      ...(isInputObjectType(type) ? { isOneOf: type.isOneOf } : {}),
      ...(isScalarType(type) ? { specifiedByURL: type.specifiedByURL ?? null } : {}),
    });
    if (isObjectType(type) || isInterfaceType(type)) for (const field of Object.values(type.getFields())) {
      const coordinate = `${type.name}.${field.name}`;
      const operations = Object.entries(roots).filter(([, name]) => name === type.name).map(([key]) => key).sort(compare);
      const unavailable = type.name === roots.mutation && field.name === "cycleCreate" &&
        field.deprecationReason === "Cycle creation is not supported.";
      const fieldScope = add(field, coordinate, "field", scope, {
        type: String(field.type), operations,
        ...(unavailable ? { coverage: { status: "upstream-unavailable", reason: field.deprecationReason } } : {}),
      });
      for (const arg of field.args) add(arg, `${coordinate}(${arg.name}:)`, "argument", fieldScope, input(arg));
    }
    if (isInputObjectType(type)) for (const field of Object.values(type.getFields()))
      add(field, `${type.name}.${field.name}`, "input-field", scope, input(field));
    if (isEnumType(type)) for (const value of type.getValues())
      add(value, `${type.name}.${value.name}`, "enum-value", scope);
  }
  coordinates.sort((a, b) => compare(a.coordinate, b.coordinate));
  return `${JSON.stringify({
    formatVersion: 1,
    source: {
      kind: "sdk-release", sdkVersion: provenance.sdkVersion, schemaSha256: provenance.schemaSha256,
      commit: provenance.commit, sourceSha256: provenance.sourceSha256, url: provenance.url,
    },
    roots, coordinates,
  }, null, 2)}\n`;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const paths = {
    schema: fileURLToPath(new URL("../core/src/api-schema.graphql", import.meta.url)),
    provenance: fileURLToPath(new URL("../core/src/api-schema.provenance.json", import.meta.url)),
    output: fileURLToPath(new URL("./api-inventory.json", import.meta.url)),
  };
  let check = false;
  let sourceFile = schemaFile;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--check") { check = true; continue; }
    if (arg !== "--schema" && arg !== "--provenance" && arg !== "--output")
      throw new Error(`unknown option: ${arg}`);
    const value = args[++i];
    if (!value || value.startsWith("--")) throw new Error(`missing value: ${arg}`);
    paths[arg.slice(2) as keyof typeof paths] = value;
    if (arg === "--schema") sourceFile = value;
  }
  const expected = generateInventory(
    await readFile(paths.schema, "utf8"), JSON.parse(await readFile(paths.provenance, "utf8")), sourceFile,
  );
  if (!check) { await writeFile(paths.output, expected); return; }
  const actual = await readFile(paths.output, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    throw new Error("inventory missing; regenerate api-inventory");
  });
  if (actual !== expected) throw new Error("inventory stale; regenerate api-inventory");
}

if (import.meta.main) main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
