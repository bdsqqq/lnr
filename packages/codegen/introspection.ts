import { createHash, randomUUID } from "node:crypto";
import { rename, unlink, writeFile } from "node:fs/promises";
import {
  assertValidSchema, buildClientSchema, getIntrospectionQuery, parse, parseValue, print,
  validate, ValuesOfCorrectTypeRule, UniqueInputFieldNamesRule, DirectiveLocation,
  Kind, type IntrospectionQuery,
} from "graphql";

export const ENDPOINT = "https://api.linear.app/graphql";
export const REF_DEPTH = 8;
export const OPTIONS = {
  descriptions: true,
  schemaDescription: true,
  specifiedByUrl: true,
  directiveIsRepeatable: true,
  inputValueDeprecation: true,
  oneOf: true,
};

/** return the envelope so partial graphql errors cannot become an accepted snapshot. */
export type Transport = (
  query: string, variables?: Record<string, unknown>,
) => Promise<unknown>;

/** these requests only read introspection metadata; never reuse this retry policy for mutations. */
export function retryIntrospection(
  transport: Transport,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Transport {
  return async (query, variables) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await transport(query, variables);
      } catch (error) {
        const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
        if (attempt >= 2 || typeof status !== "number" || ![429, 502, 503, 504].includes(status)) throw error;
        await wait(1000 * 2 ** attempt);
      }
    }
  };
}

const document = parse(getIntrospectionQuery(OPTIONS));
const reference = parse(`fragment TypeRef on __Type {
  ${"kind name ofType { ".repeat(REF_DEPTH)}kind name${" }".repeat(REF_DEPTH)}
}`).definitions[0]!;
const fragments = document.definitions
  .filter((node) => node.kind === Kind.FRAGMENT_DEFINITION)
  .map((node) => node.name.value === "TypeRef" ? reference : node);
const fullFragments = fragments.map((node) => print(node)).join("\n");
const inputFragments = fragments
  .filter((node) => node.kind === Kind.FRAGMENT_DEFINITION && node.name.value !== "FullType")
  .map((node) => print(node)).join("\n");

export const INVENTORY_QUERY = `query CaptureInventory {
  __schema {
    description
    queryType { kind name }
    mutationType { kind name }
    subscriptionType { kind name }
    types { kind name }
    directives {
      name description isRepeatable locations
      args(includeDeprecated: true) { ...InputValue }
    }
  }
}
${inputFragments}`;
export const TYPE_QUERY = `query CaptureType($name: String!) {
  __type(name: $name) { ...FullType }
}
${fullFragments}`;

export function batchTypeQuery(size: number): string {
  return `query CaptureTypes(${Array.from({ length: size }, (_, i) => `$name${i}: String!`).join(", ")}) {
    ${Array.from({ length: size }, (_, i) => `type${i}: __type(name: $name${i}) { ...FullType }`).join("\n")}
  }\n${fullFragments}`;
}

type RecordValue = Record<string, unknown>;
const namedKinds = new Set(["SCALAR", "OBJECT", "INTERFACE", "UNION", "ENUM", "INPUT_OBJECT"]);
function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`invalid introspection: ${message}`);
}
function object(value: unknown, path: string): RecordValue {
  requireValue(value !== null && typeof value === "object" && !Array.isArray(value), path);
  return value as RecordValue;
}
function text(value: unknown, path: string, nullable = false): void {
  requireValue(typeof value === "string" || (nullable && value === null), path);
}
function boolean(value: unknown, path: string): void {
  requireValue(typeof value === "boolean", path);
}
function list(value: unknown, path: string): unknown[] {
  requireValue(Array.isArray(value), path);
  return value;
}
function namedList(value: unknown, path: string): RecordValue[] {
  const names = new Set<string>();
  return list(value, path).map((entry) => {
    const item = object(entry, path);
    requireValue(typeof item.name === "string" && /^[_A-Za-z][_0-9A-Za-z]*$/.test(item.name), `${path}.name`);
    requireValue(!names.has(item.name), `${path}: duplicate ${item.name}`);
    names.add(item.name);
    return item;
  });
}
function metadata(item: RecordValue, path: string, deprecated = false): void {
  text(item.description, `${path}.description`, true);
  if (deprecated) {
    boolean(item.isDeprecated, `${path}.isDeprecated`);
    text(item.deprecationReason, `${path}.deprecationReason`, true);
  }
}
function ref(value: unknown, types: Map<unknown, unknown>, path: string, depth = 0): void {
  const item = object(value, path);
  requireValue(depth <= REF_DEPTH, `${path}: reference depth exceeded`);
  if (item.kind === "LIST" || item.kind === "NON_NULL") {
    requireValue(item.name === null, `${path}: named wrapper`);
    const child = object(item.ofType, `${path}: truncated reference`);
    requireValue(item.kind !== "NON_NULL" || child.kind !== "NON_NULL", `${path}: repeated non-null`);
    ref(child, types, `${path}.ofType`, depth + 1);
  } else {
    requireValue(typeof item.name === "string" && namedKinds.has(String(item.kind)), `${path}: invalid named reference`);
    requireValue(types.get(item.name) === item.kind, `${path}: missing or mismatched ${item.name}`);
    requireValue(item.ofType === undefined || item.ofType === null, `${path}: unexpected child`);
  }
}
function inputs(value: unknown, types: Map<unknown, unknown>, path: string): void {
  for (const item of namedList(value, path)) {
    metadata(item, `${path}.${item.name}`, true);
    text(item.defaultValue, `${path}.${item.name}.defaultValue`, true);
    ref(item.type, types, `${path}.${item.name}.type`);
  }
}
function inventory(value: unknown): RecordValue {
  const schema = object(value, "__schema");
  text(schema.description, "__schema.description", true);
  for (const root of ["queryType", "mutationType", "subscriptionType"]) {
    const value = schema[root];
    if (root !== "queryType" && value === null) continue;
    text(object(value, root).name, `${root}.name`);
    requireValue(object(value, root).kind === "OBJECT", `${root}.kind`);
  }
  const types = namedList(schema.types, "types");
  requireValue(types.length > 0, "empty type inventory");
  for (const type of types) requireValue(namedKinds.has(String(type.kind)), `unknown kind: ${type.kind}`);
  namedList(schema.directives, "directives");
  return schema;
}

/** graphql-js can default absent metadata; check completeness before its semantic validation. */
export function validateSchema(value: unknown): asserts value is IntrospectionQuery["__schema"] {
  const schema = inventory(value);
  const definitions = namedList(schema.types, "types");
  const types = new Map(definitions.map((type) => [type.name, type.kind]));
  for (const type of definitions) {
    const path = String(type.name);
    metadata(type, path);
    text(type.specifiedByURL, `${path}.specifiedByURL`, true);
    if (type.kind === "INPUT_OBJECT") boolean(type.isOneOf, `${path}.isOneOf`);
    else requireValue(type.isOneOf === null, `${path}.isOneOf`);
    const applicable: Record<string, boolean> = {
      fields: type.kind === "OBJECT" || type.kind === "INTERFACE",
      interfaces: type.kind === "OBJECT" || type.kind === "INTERFACE",
      possibleTypes: type.kind === "UNION" || type.kind === "INTERFACE",
      inputFields: type.kind === "INPUT_OBJECT",
      enumValues: type.kind === "ENUM",
    };
    for (const [key, enabled] of Object.entries(applicable)) {
      if (!enabled) {
        requireValue(type[key] === null, `${path}.${key}: expected null`);
        continue;
      }
      const entries = namedList(type[key], `${path}.${key}`);
      if (key === "inputFields") inputs(entries, types, `${path}.${key}`);
      for (const entry of entries) {
        const fieldPath = `${path}.${key}.${entry.name}`;
        if (key === "interfaces" || key === "possibleTypes") {
          ref(entry, types, fieldPath);
          requireValue(entry.kind === (key === "interfaces" ? "INTERFACE" : "OBJECT"), `${fieldPath}: invalid member kind`);
        }
        if (key === "enumValues" || key === "fields") metadata(entry, fieldPath, true);
        if (key === "fields") {
          ref(entry.type, types, `${fieldPath}.type`);
          inputs(entry.args, types, `${fieldPath}.args`);
        }
      }
    }
  }
  for (const directive of namedList(schema.directives, "directives")) {
    metadata(directive, String(directive.name));
    boolean(directive.isRepeatable, "directive.isRepeatable");
    const locations = list(directive.locations, "directive.locations");
    requireValue(locations.length > 0 && new Set(locations).size === locations.length, "directive.locations");
    for (const location of locations) {
      requireValue(Object.values(DirectiveLocation).includes(location as DirectiveLocation), "directive.location");
    }
    inputs(directive.args, types, `directive.${directive.name}.args`);
  }
  for (const root of ["queryType", "mutationType", "subscriptionType"]) {
    if (schema[root] !== null) {
      requireValue(types.get(object(schema[root], root).name) === "OBJECT", `${root}: missing object definition`);
    }
  }
  const built = buildClientSchema({ __schema: schema } as unknown as IntrospectionQuery);
  assertValidSchema(built);
  for (const type of definitions.filter((type) => type.kind === "INTERFACE")) {
    const actual = (type.possibleTypes as RecordValue[]).map((member) => member.name).sort();
    const expected = definitions.filter((candidate) => candidate.kind === "OBJECT" &&
      (candidate.interfaces as RecordValue[]).some((item) => item.name === type.name))
      .map((candidate) => candidate.name).sort();
    requireValue(JSON.stringify(actual) === JSON.stringify(expected), `${type.name}: contradictory possible types`);
  }
  const defaultInputs = [
    ...definitions.flatMap((type) => [
      ...((type.inputFields as RecordValue[] | null) ?? []),
      ...((type.fields as RecordValue[] | null) ?? []).flatMap((field) => field.args as RecordValue[]),
    ]),
    ...(schema.directives as RecordValue[]).flatMap((directive) => directive.args as RecordValue[]),
  ];
  function typeText(value: unknown): string {
    const item = value as RecordValue;
    if (item.kind === "NON_NULL") return `${typeText(item.ofType)}!`;
    if (item.kind === "LIST") return `[${typeText(item.ofType)}]`;
    return String(item.name);
  }
  for (const input of defaultInputs) {
    if (input.defaultValue === null) continue;
    const literal = print(parseValue(input.defaultValue as string));
    const probe = parse(`query($value: ${typeText(input.type)} = ${literal}) { __typename }`);
    requireValue(validate(built, probe, [ValuesOfCorrectTypeRule, UniqueInputFieldNamesRule]).length === 0, `${input.name}: invalid default value`);
  }
}

function compare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical).sort((a, b) => compare(
      typeof a === "string" ? a : String((a as RecordValue).name),
      typeof b === "string" ? b : String((b as RecordValue).name),
    ));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => compare(a, b))
      .map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}
export function serialize(value: unknown): string {
  return `${JSON.stringify(canonical(value), null, 2)}\n`;
}
function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
async function request(transport: Transport, query: string, variables?: RecordValue): Promise<RecordValue> {
  const result = object(await transport(query, variables), "response");
  requireValue(result.errors === undefined || (Array.isArray(result.errors) && result.errors.length === 0), "graphql errors; complete modern introspection is required");
  if (result.status !== undefined) {
    requireValue(typeof result.status === "number" && result.status >= 200 && result.status < 300, "http status");
  }
  return object(result.data, "response.data");
}

export async function captureSchema(
  transport: Transport,
  options: { sdkVersion: string; batchSize?: number; now?: () => Date; progress?: (completed: number, total: number, pass: number) => void },
) {
  const now = options.now ?? (() => new Date());
  const batchSize = options.batchSize ?? 8;
  requireValue(Number.isInteger(batchSize) && batchSize >= 1 && batchSize <= 8, "batch size must be 1–8");
  const captureStartedAt = now().toISOString();
  const initial = inventory((await request(transport, INVENTORY_QUERY)).__schema);
  const expected = namedList(initial.types, "types").sort((a, b) => compare(String(a.name), String(b.name)));
  async function readTypes(pass: number): Promise<RecordValue[]> {
    const types: RecordValue[] = [];
    options.progress?.(0, expected.length, pass);
    for (let offset = 0; offset < expected.length; offset += batchSize) {
      const batch = expected.slice(offset, offset + batchSize);
      const single = batchSize === 1;
      const variables = single ? { name: batch[0]!.name }
        : Object.fromEntries(batch.map((entry, i) => [`name${i}`, entry.name]));
      const data = await request(transport, single ? TYPE_QUERY : batchTypeQuery(batch.length), variables);
      for (const [i, entry] of batch.entries()) {
        const type = object(data[single ? "__type" : `type${i}`], `missing type ${entry.name}`);
        requireValue(type.name === entry.name && type.kind === entry.kind, `mismatched type ${entry.name}`);
        types.push(type);
      }
      options.progress?.(types.length, expected.length, pass);
    }
    return types;
  }
  const types = await readTypes(1);
  const schema = { ...initial, types, allTypeNames: expected.map((type) => type.name) };
  validateSchema(schema);
  const verification = await readTypes(2);
  requireValue(serialize(types) === serialize(verification), "type definitions changed during capture; retry");
  const final = inventory((await request(transport, INVENTORY_QUERY)).__schema);
  requireValue(serialize(initial) === serialize(final), "schema inventory changed during capture; retry");
  return {
    __schema: schema,
    provenance: {
      formatVersion: 1, endpoint: ENDPOINT, sdkVersion: options.sdkVersion,
      captureStartedAt, captureCompletedAt: now().toISOString(),
      schemaSha256: hash(serialize(schema)),
      querySha256: hash(`${INVENTORY_QUERY}\n${TYPE_QUERY}\n${batchTypeQuery(batchSize)}`),
      batchSize,
      consistency: "two-matching-passes; not an upstream atomic snapshot",
      referenceDepth: REF_DEPTH, introspectionOptions: OPTIONS,
    },
  };
}

/** publish only after validation; capture failure never opens the destination. */
export async function captureToFile(
  path: string, transport: Transport, options: Parameters<typeof captureSchema>[1],
): Promise<void> {
  const snapshot = await captureSchema(transport, options);
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, serialize(snapshot), { flag: "wx", mode: 0o600 });
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
