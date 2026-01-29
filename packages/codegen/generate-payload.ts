/**
 * shared payload generation from field resolver registry
 *
 * generates TypeScript code for building API payloads from CLI input,
 * using the field resolver registry for consistent resolution logic.
 */

import {
  fieldResolvers,
  isExcluded,
  isPassthrough,
  isResolved,
  type ResolvedField,
  type PassthroughField,
} from "./field-resolvers";

interface SchemaField {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

interface GeneratePayloadOptions {
  /** fields from schema's CreateInput or UpdateInput */
  schemaFields: SchemaField[];
  /** variable name for the payload object */
  payloadVar: string;
  /** variable name for CLI input */
  inputVar: string;
  /** variable name for Linear client */
  clientVar: string;
  /** variable name for teamId (if available in scope) */
  teamIdVar?: string;
  /** indent level (number of spaces) */
  indent: number;
}

interface GeneratePayloadResult {
  /** the generated code */
  code: string;
  /** imports needed (module -> function names) */
  imports: Map<string, Set<string>>;
  /** fields that were not in registry (need manual handling or exclusion) */
  unknownFields: string[];
  /** fields that require teamId but it wasn't provided */
  needsTeamId: boolean;
}

/**
 * generate payload construction code for a set of schema fields
 */
export function generatePayloadCode(
  options: GeneratePayloadOptions
): GeneratePayloadResult {
  const { schemaFields, payloadVar, inputVar, clientVar, teamIdVar, indent } = options;
  const pad = " ".repeat(indent);

  const lines: string[] = [];
  const imports = new Map<string, Set<string>>();
  const unknownFields: string[] = [];
  let needsTeamId = false;

  for (const field of schemaFields) {
    const resolver = fieldResolvers[field.name];

    // field not in registry
    if (!resolver) {
      unknownFields.push(field.name);
      continue;
    }

    // excluded field
    if (isExcluded(resolver)) {
      continue;
    }

    // passthrough field
    if (isPassthrough(resolver)) {
      const line = generatePassthroughLine(resolver, field, payloadVar, inputVar, pad);
      if (line) {
        lines.push(line);

        // add transform import if needed
        if (resolver.transformImport && resolver.transformFrom) {
          const existing = imports.get(resolver.transformFrom) ?? new Set();
          existing.add(resolver.transformImport);
          imports.set(resolver.transformFrom, existing);
        }
      }
      continue;
    }

    // resolved field
    if (isResolved(resolver)) {
      // check if needs teamId
      if (resolver.requiresTeamId && !teamIdVar) {
        needsTeamId = true;
        continue;
      }

      const line = generateResolvedLine(resolver, field, payloadVar, inputVar, clientVar, teamIdVar, pad);
      if (line) {
        lines.push(line);

        // add resolver import
        const existing = imports.get(resolver.from) ?? new Set();
        existing.add(resolver.import);
        imports.set(resolver.from, existing);
      }
    }
  }

  return {
    code: lines.join("\n"),
    imports,
    unknownFields,
    needsTeamId,
  };
}

function generatePassthroughLine(
  resolver: PassthroughField,
  _field: SchemaField,
  payloadVar: string,
  inputVar: string,
  pad: string
): string {
  const flag = resolver.cliFlag;
  const apiField = getApiFieldName(resolver.cliFlag);

  if (resolver.transform) {
    // wrap the value in a transform function
    return `${pad}if (${inputVar}.${flag} !== undefined) {
${pad}  ${payloadVar}.${apiField} = ${resolver.transform.replace(`input.${flag}`, `${inputVar}.${flag}`)};
${pad}}`;
  }

  return `${pad}if (${inputVar}.${flag} !== undefined) {
${pad}  ${payloadVar}.${apiField} = ${inputVar}.${flag};
${pad}}`;
}

function generateResolvedLine(
  resolver: ResolvedField,
  _field: SchemaField,
  payloadVar: string,
  inputVar: string,
  clientVar: string,
  teamIdVar: string | undefined,
  pad: string
): string {
  const flag = resolver.cliFlag;
  const apiField = getApiFieldName(flag);

  // build the resolve expression, replacing placeholders
  let resolveExpr = resolver.resolve
    .replace(/client/g, clientVar)
    .replace(/input\.(\w+)/g, `${inputVar}.$1`);

  if (resolver.requiresTeamId && teamIdVar) {
    resolveExpr = resolveExpr.replace(/teamId/g, teamIdVar);
  }

  return `${pad}if (${inputVar}.${flag} !== undefined) {
${pad}  ${payloadVar}.${apiField} = ${resolveExpr};
${pad}}`;
}

/**
 * map CLI flag name to API field name
 * most are the same, but some differ (e.g., priority stays priority)
 */
function getApiFieldName(cliFlag: string): string {
  const mapping: Record<string, string> = {
    project: "projectId",
    assignee: "assigneeId",
    state: "stateId",
    cycle: "cycleId",
    team: "teamId",
    parent: "parentId",
    delegate: "delegateId",
    lead: "leadId",
  };
  return mapping[cliFlag] ?? cliFlag;
}

/**
 * generate the TypeScript type for a payload based on schema fields
 */
export function generatePayloadType(
  schemaFields: SchemaField[],
  requiredFields: string[] = []
): string {
  const lines: string[] = ["{"];

  for (const field of schemaFields) {
    const resolver = fieldResolvers[field.name];

    if (!resolver || isExcluded(resolver)) {
      continue;
    }

    const isRequired = requiredFields.includes(field.name);
    const tsType = schemaTypeToTS(field.type);
    const optional = isRequired ? "" : "?";

    lines.push(`  ${field.name}${optional}: ${tsType};`);
  }

  lines.push("}");
  return lines.join("\n");
}

function schemaTypeToTS(type: string): string {
  switch (type) {
    case "String":
    case "ID":
      return "string";
    case "Int":
    case "Float":
      return "number";
    case "Boolean":
      return "boolean";
    case "DateTime":
      return "string";
    default:
      return "unknown";
  }
}
