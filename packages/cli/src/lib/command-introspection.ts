import "./arktype-config";
import { appRouter } from "../router/index";

export interface Flag {
  name: string;
  type: string;
  description: string;
  positional: boolean;
  required: boolean;
}

export interface Command {
  name: string;
  description: string;
  aliases: string[];
  flags: Flag[];
}

export type SchemaJson = {
  domain: string;
  required?: { key: string; value: SchemaValue }[];
  optional?: { key: string; value: SchemaValue }[];
};

export type SchemaValue = {
  domain?: string;
  meta?: string | { description?: string; positional?: boolean };
  branches?: { unit?: unknown; meta?: string | { description?: string; positional?: boolean } }[];
  unit?: unknown;
};

export const extractMeta = (value: SchemaValue): { description: string; positional: boolean } => {
  const meta = value.meta ?? value.branches?.[0]?.meta;
  return typeof meta === "object"
    ? { description: meta.description ?? "", positional: meta.positional ?? false }
    : { description: meta ?? "", positional: false };
};

export const inferType = (value: SchemaValue): string => {
  if (value.domain) return value.domain === "number" ? "number" : "string";
  if (value.branches?.some((b) => b.unit === true || b.unit === false)) return "boolean";
  if (value.unit !== undefined) return typeof value.unit;
  return "string";
};

export const parseSchema = (json: SchemaJson): Flag[] => [
  ...(json.required ?? []).map(({ key, value }) => ({
    name: key,
    type: inferType(value),
    ...extractMeta(value),
    required: true,
  })),
  ...(json.optional ?? []).map(({ key, value }) => ({
    name: key,
    type: inferType(value),
    ...extractMeta(value),
    required: false,
  })),
];

export const camelToKebab = (s: string): string =>
  s.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();

interface ProcedureDef {
  _def: {
    meta?: { description?: string; aliases?: { command?: string[] } };
    inputs?: { json: SchemaJson }[];
  };
}

function isProcedureDef(value: unknown): value is ProcedureDef {
  return (
    typeof value === "object" &&
    value !== null &&
    "_def" in value &&
    typeof (value as Record<string, unknown>)._def === "object"
  );
}

export const buildCommands = (): Command[] => {
  const procedures = appRouter._def.procedures as Record<string, unknown>;

  return Object.entries(procedures)
    .filter((entry): entry is [string, ProcedureDef] => isProcedureDef(entry[1]))
    .map(([name, proc]) => {
      const meta = proc._def.meta ?? {};
      const schema = proc._def.inputs?.[0]?.json;
      const flags = schema ? parseSchema(schema) : [];

      return {
        name: name.replace(/\./g, " "),
        description: meta.description ?? "",
        aliases: meta.aliases?.command ?? [],
        flags,
      };
    });
};
