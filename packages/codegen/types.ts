/**
 * shared types for codegen
 */

export interface SchemaField {
  name: string;
  type: string;
  description: string;
  required: boolean;
  isList: boolean;
  enumType: string | null;
  isDeprecated: boolean;
  deprecationReason: string | null;
}

export interface EntitySchema {
  name: string;
  description: string;
  operations: {
    create: boolean;
    update: boolean;
    read: boolean;
  };
  createInput: {
    fields: SchemaField[];
    requiredFields: string[];
  };
  updateInput: {
    fields: SchemaField[];
  };
  outputFields: SchemaField[];
}

export interface ExtractedSchema {
  entities: Record<string, EntitySchema>;
  enums: Record<string, string[]>;
}

export interface CLIFlag {
  name: string;
  type: string;
  required: boolean;
  description: string;
  positional: boolean;
  cliOnly?: boolean;
  handler?: string;
  dispatchIn?: "show" | "update" | "create";
}

export interface CLICommand {
  entity: string;
  command: string;
  description: string;
  aliases: string[];
  flags: CLIFlag[];
}

export interface CLISpec {
  commands: CLICommand[];
}

/**
 * maps GraphQL types to arktype string syntax for CLI generation.
 * returns the base type string (e.g., "string", "number") for use in type() calls.
 */
export function graphqlTypeToArktype(field: SchemaField): string {
  let arktypeStr: string;
  switch (field.type) {
    case "String":
    case "ID":
    case "DateTime":
    case "TimelessDate":
    case "JSON":
      arktypeStr = "string";
      break;
    case "Int":
    case "Float":
      arktypeStr = "number";
      break;
    case "Boolean":
      arktypeStr = "boolean";
      break;
    default:
      arktypeStr = "string";
  }
  if (field.isList) {
    arktypeStr = `${arktypeStr}[]`;
  }
  return arktypeStr;
}
