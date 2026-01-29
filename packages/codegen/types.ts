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

export function graphqlTypeToZod(field: SchemaField): string {
  let zodType: string;
  switch (field.type) {
    case "String":
    case "ID":
    case "DateTime":
    case "TimelessDate":
    case "JSON":
      zodType = "z.string()";
      break;
    case "Int":
    case "Float":
      zodType = "z.number()";
      break;
    case "Boolean":
      zodType = "z.boolean()";
      break;
    default:
      zodType = "z.string()";
  }
  if (field.isList) {
    zodType = `z.array(${zodType})`;
  }
  return zodType;
}
