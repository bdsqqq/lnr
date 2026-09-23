/// <reference path="./graphql.d.ts" />
import {
  buildSchema, getNamedType, getVariableValues, isEnumType, isInputObjectType,
  isListType, isNonNullType, Kind, parse, TypeInfo, typeFromAST, validate,
  visit, visitWithTypeInfo, type GraphQLInputType, type GraphQLSchema,
} from "graphql";
import schemaSource from "./api-schema.graphql" with { type: "text" };
import { getClient } from "./client";

let apiSchema: GraphQLSchema | undefined;

/** captured metadata identifies candidates, not verified executable capabilities. */
export function getApiSchema(): GraphQLSchema {
  return apiSchema ??= buildSchema(schemaSource);
}

export class ApiExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiExecutionError";
  }
}

export interface ApiOptions {
  document: string;
  variables?: Record<string, unknown>;
  execute?: boolean;
}

interface ApiClient {
  client: {
    rawRequest(
      document: string, variables?: Record<string, unknown>,
    ): Promise<{ data?: unknown; errors?: readonly unknown[] }>;
  };
}

export interface ApiResult {
  ok: boolean;
  executed: boolean;
  operation: "query" | "mutation";
  data?: unknown;
  errors?: ReturnType<typeof sanitizeApiError>[];
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

/** upstream messages and extensions can contain credentials or request bodies. */
export function sanitizeApiError(
  error: unknown,
  selectedNames: ReadonlySet<string> = new Set(),
): { message: string; path?: (string | number)[] } {
  const path = record(error)?.path;
  const safe = Array.isArray(path) && path.length > 0 && path.every(
    part => typeof part === "string" ? selectedNames.has(part)
      : typeof part === "number" && Number.isSafeInteger(part) && part >= 0,
  );
  return {
    message: "api request failed; check authentication, permissions, inputs, and service status",
    ...(safe ? { path: [...path] } : {}),
  };
}

function assertPublic(
  item: { name?: string; description?: string | null } | null | undefined,
): void {
  if (item?.name === "_dummy" || /\[internal\]/i.test(item?.description ?? "")) {
    throw new ApiExecutionError("internal schema member is not available");
  }
}

function checkInput(type: GraphQLInputType, value: unknown): void {
  if (isNonNullType(type)) return checkInput(type.ofType, value);
  assertPublic(getNamedType(type));
  if (value === null || value === undefined) return;
  if (isListType(type)) {
    for (const item of Array.isArray(value) ? value : [value]) checkInput(type.ofType, item);
  } else if (isInputObjectType(type)) {
    const input = record(value);
    if (!input) return;
    for (const [name, field] of Object.entries(type.getFields())) {
      if (!Object.hasOwn(input, name)) continue;
      assertPublic(field);
      checkInput(field.type, input[name]);
    }
  } else if (isEnumType(type)) {
    assertPublic(type.getValue(String(value)));
  }
  // custom scalars own their values: JSON keys are not schema input fields.
}

function inspect(options: ApiOptions, schema: GraphQLSchema) {
  if (typeof options.document !== "string"
    || new TextEncoder().encode(options.document).byteLength > 1024 * 1024) {
    throw new ApiExecutionError("provide a graphql document of at most 1 mib");
  }
  const document = parse(options.document);
  const operations = document.definitions.filter(
    definition => definition.kind === Kind.OPERATION_DEFINITION,
  );
  if (operations.length !== 1 || document.definitions.some(
    definition => definition.kind !== Kind.OPERATION_DEFINITION
      && definition.kind !== Kind.FRAGMENT_DEFINITION,
  )) throw new ApiExecutionError("provide exactly one query or mutation plus fragments");
  const operation = operations[0]!;
  if (operation.operation === "subscription") throw new ApiExecutionError("subscriptions are not supported");
  if (validate(schema, document, undefined, { maxErrors: 20 }).length) {
    throw new ApiExecutionError("invalid graphql document; check the bundled schema");
  }
  if (options.variables !== undefined && !record(options.variables)) {
    throw new ApiExecutionError("variables must be an object");
  }
  const definitions = operation.variableDefinitions ?? [];
  const variables = getVariableValues(schema, definitions, options.variables ?? {}, { maxErrors: 20 });
  // coercion diagnostics quote supplied values. inspect only supplied fields, not server defaults.
  if (variables.errors) throw new ApiExecutionError("invalid graphql variables; check required values and types");
  for (const definition of definitions) {
    const type = typeFromAST(schema, definition.type) as GraphQLInputType;
    checkInput(type, options.variables?.[definition.variable.name.value]);
  }
  const selectedNames = new Set<string>();
  const info = new TypeInfo(schema);
  visit(document, visitWithTypeInfo(info, {
    NamedType(node) { assertPublic(schema.getType(node.name.value)); },
    Directive(node) { assertPublic(schema.getDirective(node.name.value)); },
    Field(node) {
      const field = info.getFieldDef();
      assertPublic(field);
      assertPublic(info.getParentType());
      const type = info.getType();
      if (type) assertPublic(getNamedType(type));
      if (info.getParentType() === schema.getMutationType() && field?.name === "cycleCreate"
        && field.deprecationReason === "Cycle creation is not supported.") {
        throw new ApiExecutionError("cycle creation is unavailable upstream");
      }
      selectedNames.add(node.alias?.value ?? node.name.value);
    },
    Argument() {
      assertPublic(info.getArgument());
      const type = info.getInputType();
      if (type) assertPublic(getNamedType(type));
    },
    ObjectField(node) {
      const parent = info.getParentInputType();
      if (parent) {
        const named = getNamedType(parent);
        if (isInputObjectType(named)) assertPublic(named.getFields()[node.name.value]);
      }
      const type = info.getInputType();
      if (type) assertPublic(getNamedType(type));
    },
    EnumValue(node) {
      const type = info.getInputType();
      if (type) {
        const named = getNamedType(type);
        if (isEnumType(named)) assertPublic(named.getValue(node.value));
      }
    },
  }));
  return { operation: operation.operation as "query" | "mutation", selectedNames };
}

/** validation never acquires credentials. both reads and writes require opt-in. */
export async function executeApi(
  options: ApiOptions,
  clientFactory: () => ApiClient = getClient,
  schema: GraphQLSchema = getApiSchema(),
): Promise<ApiResult> {
  let inspected: ReturnType<typeof inspect>;
  try {
    inspected = inspect(options, schema);
  } catch (error) {
    if (error instanceof ApiExecutionError) throw error;
    throw new ApiExecutionError("invalid graphql request; check syntax, schema, and variables");
  }
  const { operation, selectedNames } = inspected;
  if (options.execute !== true) return { ok: true, executed: false, operation };
  let attempted = false;
  try {
    // sdk 95.1.0 rawRequest performs one fetch; no model traversal or retries.
    const client = clientFactory();
    attempted = true;
    const response = await client.client.rawRequest(options.document, options.variables);
    if (!record(response) || !Object.hasOwn(response, "data")) throw new Error("missing response data");
    const errors = response.errors?.map(error => sanitizeApiError(error, selectedNames));
    return {
      ok: !errors?.length, executed: true, operation, data: response.data,
      ...(errors?.length ? { errors } : {}),
    };
  } catch (error) {
    // LinearError retains partial data directly; raw transport errors use response.
    const outer = attempted ? record(error) : undefined;
    const response = record(outer?.response) ?? outer;
    const errors = response?.errors;
    return {
      ok: false, executed: attempted, operation,
      ...(response && Object.hasOwn(response, "data") ? { data: response.data } : {}),
      errors: Array.isArray(errors) && errors.length
        ? errors.map(item => sanitizeApiError(item, selectedNames))
        : [sanitizeApiError(undefined)],
    };
  }
}
