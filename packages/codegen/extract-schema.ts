#!/usr/bin/env bun

/**
 * Extract structured entity metadata from Linear GraphQL schema.
 * Parses schema.json (from introspection) and emits extracted-schema.json.
 *
 * Usage: bun run packages/codegen/extract-schema.ts
 */

interface GraphQLType {
  kind: "NON_NULL" | "LIST" | "SCALAR" | "ENUM" | "INPUT_OBJECT" | "OBJECT";
  name: string | null;
  ofType?: GraphQLType | null;
}

interface GraphQLField {
  name: string;
  description: string | null;
  type: GraphQLType;
  defaultValue?: string | null;
  isDeprecated?: boolean;
  deprecationReason?: string | null;
  args?: GraphQLArg[];
}

interface GraphQLArg {
  name: string;
  description: string | null;
  type: GraphQLType;
  defaultValue?: string | null;
}

interface GraphQLEnumValue {
  name: string;
  description: string | null;
  isDeprecated?: boolean;
  deprecationReason?: string | null;
}

interface GraphQLSchemaType {
  kind: string;
  name: string;
  description: string | null;
  fields?: GraphQLField[] | null;
  inputFields?: GraphQLField[] | null;
  enumValues?: GraphQLEnumValue[] | null;
}

interface ExtractedField {
  name: string;
  type: string;
  description: string | null;
  required: boolean;
  isList: boolean;
  enumType: string | null;
  isDeprecated: boolean;
  deprecationReason: string | null;
}

interface ExtractedEnum {
  name: string;
  description: string | null;
  values: {
    name: string;
    description: string | null;
    isDeprecated: boolean;
    deprecationReason: string | null;
  }[];
}

interface ExtractedEntity {
  name: string;
  description: string | null;
  operations: {
    create: boolean;
    update: boolean;
    read: boolean;
  };
  createInput: {
    fields: ExtractedField[];
    requiredFields: string[];
  } | null;
  updateInput: {
    fields: ExtractedField[];
  } | null;
  outputFields: ExtractedField[];
  deprecatedFields: string[];
}

interface ExtractedSchema {
  entities: Record<string, ExtractedEntity>;
  enums: Record<string, ExtractedEnum>;
  metadata: {
    extractedAt: string;
    totalEntities: number;
    totalEnums: number;
    totalDeprecatedFields: number;
  };
}

function unwrapType(type: GraphQLType): { baseType: string; required: boolean; isList: boolean } {
  let isList = false;
  let current = type;

  // required = outermost wrapper is NON_NULL
  const required = type.kind === "NON_NULL";

  while (current.ofType) {
    if (current.kind === "LIST") {
      isList = true;
    }
    current = current.ofType;
  }

  return {
    baseType: current.name || "Unknown",
    required,
    isList,
  };
}

function extractField(field: GraphQLField): ExtractedField {
  const { baseType, required, isList } = unwrapType(field.type);

  let enumType: string | null = null;
  let current = field.type;
  while (current) {
    if (current.kind === "ENUM" && current.name) {
      enumType = current.name;
      break;
    }
    current = current.ofType as GraphQLType;
  }

  return {
    name: field.name,
    type: baseType,
    description: field.description,
    required,
    isList,
    enumType,
    isDeprecated: field.isDeprecated ?? false,
    deprecationReason: field.deprecationReason ?? null,
  };
}

function extractEntity(
  entityName: string,
  types: GraphQLSchemaType[]
): ExtractedEntity | null {
  const objectType = types.find((t) => t.name === entityName && t.kind === "OBJECT");
  const createInputType = types.find(
    (t) => t.name === `${entityName}CreateInput` && t.kind === "INPUT_OBJECT"
  );
  const updateInputType = types.find(
    (t) => t.name === `${entityName}UpdateInput` && t.kind === "INPUT_OBJECT"
  );

  if (!objectType && !createInputType && !updateInputType) {
    return null;
  }

  const outputFields = (objectType?.fields ?? []).map(extractField);
  const createFields = (createInputType?.inputFields ?? []).map(extractField);
  const updateFields = (updateInputType?.inputFields ?? []).map(extractField);

  const deprecatedFields = [
    ...outputFields.filter((f) => f.isDeprecated).map((f) => f.name),
    ...createFields.filter((f) => f.isDeprecated).map((f) => `create.${f.name}`),
    ...updateFields.filter((f) => f.isDeprecated).map((f) => `update.${f.name}`),
  ];

  return {
    name: entityName,
    description: objectType?.description ?? null,
    operations: {
      create: !!createInputType,
      update: !!updateInputType,
      read: !!objectType,
    },
    createInput: createInputType
      ? {
          fields: createFields,
          requiredFields: createFields.filter((f) => f.required).map((f) => f.name),
        }
      : null,
    updateInput: updateInputType
      ? {
          fields: updateFields,
        }
      : null,
    outputFields,
    deprecatedFields,
  };
}

function extractEnum(enumType: GraphQLSchemaType): ExtractedEnum {
  return {
    name: enumType.name,
    description: enumType.description,
    values: (enumType.enumValues ?? []).map((v) => ({
      name: v.name,
      description: v.description,
      isDeprecated: v.isDeprecated ?? false,
      deprecationReason: v.deprecationReason ?? null,
    })),
  };
}

async function main() {
  const schemaPath = new URL("./schema.json", import.meta.url).pathname;
  const schema = await Bun.file(schemaPath).json();
  const types: GraphQLSchemaType[] = schema.__schema?.types ?? [];

  if (types.length === 0) {
    console.error("error: no types found in schema.json");
    console.error("fix: run bun run packages/codegen/introspect-linear.ts first");
    process.exit(1);
  }

  // Entities to extract
  const entityNames = ["Issue", "Project", "Comment"];

  const entities: Record<string, ExtractedEntity> = {};
  for (const name of entityNames) {
    const entity = extractEntity(name, types);
    if (entity) {
      entities[name] = entity;
      console.log(`extracted ${name}: ${entity.operations.create ? "create " : ""}${entity.operations.update ? "update " : ""}${entity.operations.read ? "read" : ""}`);
    } else {
      console.log(`skipped ${name}: no types found`);
    }
  }

  // Extract all enums
  const enumTypes = types.filter((t) => t.kind === "ENUM" && !t.name.startsWith("__"));
  const enums: Record<string, ExtractedEnum> = {};
  for (const enumType of enumTypes) {
    enums[enumType.name] = extractEnum(enumType);
  }

  // Count deprecated fields
  const totalDeprecatedFields = Object.values(entities).reduce(
    (sum, e) => sum + e.deprecatedFields.length,
    0
  );

  const extracted: ExtractedSchema = {
    entities,
    enums,
    metadata: {
      extractedAt: new Date().toISOString(),
      totalEntities: Object.keys(entities).length,
      totalEnums: Object.keys(enums).length,
      totalDeprecatedFields,
    },
  };

  const outputPath = new URL("./extracted-schema.json", import.meta.url).pathname;
  await Bun.write(outputPath, JSON.stringify(extracted, null, 2));
  console.log(`\nwrote extracted-schema.json`);

  // Summary
  console.log(`\nsummary:`);
  console.log(`  entities: ${extracted.metadata.totalEntities}`);
  console.log(`  enums: ${extracted.metadata.totalEnums}`);
  console.log(`  deprecated fields: ${extracted.metadata.totalDeprecatedFields}`);

  for (const [name, entity] of Object.entries(entities)) {
    const createCount = entity.createInput?.fields.length ?? 0;
    const updateCount = entity.updateInput?.fields.length ?? 0;
    const outputCount = entity.outputFields.length;
    const requiredCount = entity.createInput?.requiredFields.length ?? 0;
    console.log(
      `  ${name}: ${createCount} create fields (${requiredCount} required), ${updateCount} update fields, ${outputCount} output fields`
    );
  }
}

main().catch((err) => {
  console.error("error:", err.message);
  process.exit(1);
});
