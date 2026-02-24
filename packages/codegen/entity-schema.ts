/**
 * entity configuration schema (v2)
 *
 * arktype-based DSL for declaring how Linear API entities surface in the CLI.
 * replaces the flat entity lists in entity-config.ts with rich definitions
 * that the generator can use to produce complete commands.
 *
 * see docs/adr/0007-entity-config-v2-exploration.md for context.
 */

import { type } from "arktype";

// === flag operation ===

const flagOperation = type({
  /** CLI flag name (e.g., "react", "subscribe") */
  flag: "string",
  /** zod input type */
  inputType: "'string' | 'boolean' | 'number'",
  /** description for --help */
  description: "string",
  /** what this flag does */
  operation: "'create' | 'delete' | 'toggle'",
  /** core function to call (empty string for companion flags like --emoji) */
  handler: "string",
  /** flags that must be present with this one */
  "requires?": "string[]",
});

export type FlagOperation = typeof flagOperation.infer;

// === exposure-specific configs ===

const commandConfig = type({
  /** singular command name (e.g., "issue") */
  singular: "string",
  /** plural command name (e.g., "issues") */
  plural: "string",
  /** command aliases (e.g., ["i"]) */
  "aliases?": "string[]",
  /** positional argument */
  positional: {
    name: "string",
    description: "string",
  },
  /** which CRUD operations to generate */
  operations: {
    list: "boolean",
    show: "boolean",
    create: "boolean",
    update: "boolean",
    "archive?": "boolean",
    "delete?": "boolean",
  },
});

export type CommandConfig = typeof commandConfig.infer;

const flagConfig = type({
  /** which parent commands this flag entity appears on */
  parents: "string[]",
  /** flag operations to inject */
  operations: flagOperation.array(),
});

export type FlagConfig = typeof flagConfig.infer;

const scopedConfig = type({
  /** parent entity command */
  parent: "string",
  /** flag to access this entity (e.g., "updates" for --updates) */
  flag: "string",
  /** description for --help */
  description: "string",
  /** core function to list items */
  "listHandler?": "string",
  /** core function to get single item */
  "getHandler?": "string",
});

export type ScopedConfig = typeof scopedConfig.infer;

const subcommandConfig = type({
  /** parent entity command */
  parent: "string",
  /** subcommand name */
  name: "string",
});

export type SubcommandConfig = typeof subcommandConfig.infer;

// === entity definitions (discriminated by exposure) ===

const commandEntity = type({
  name: "string",
  exposure: "'command'",
  reason: "string",
  command: commandConfig,
});

const flagEntity = type({
  name: "string",
  exposure: "'flag'",
  reason: "string",
  flags: flagConfig,
});

const scopedEntity = type({
  name: "string",
  exposure: "'scoped'",
  reason: "string",
  scoped: scopedConfig,
});

const subcommandEntity = type({
  name: "string",
  exposure: "'subcommand'",
  reason: "string",
  subcommand: subcommandConfig,
});

/** discriminated union of all entity types */
export const entityDefinition = type.or(
  commandEntity,
  flagEntity,
  scopedEntity,
  subcommandEntity
);

export type EntityDefinition = typeof entityDefinition.infer;

// === helper types for narrowing ===

export type CommandEntity = typeof commandEntity.infer;
export type FlagEntity = typeof flagEntity.infer;
export type ScopedEntity = typeof scopedEntity.infer;
export type SubcommandEntity = typeof subcommandEntity.infer;

// === type guards ===

export function isCommandEntity(e: EntityDefinition): e is CommandEntity {
  return e.exposure === "command";
}

export function isFlagEntity(e: EntityDefinition): e is FlagEntity {
  return e.exposure === "flag";
}

export function isScopedEntity(e: EntityDefinition): e is ScopedEntity {
  return e.exposure === "scoped";
}

export function isSubcommandEntity(e: EntityDefinition): e is SubcommandEntity {
  return e.exposure === "subcommand";
}

// === query helpers ===

/**
 * get all flag entities that should be injected into a command.
 */
export function getFlagsForCommand(
  entities: EntityDefinition[],
  commandName: string
): FlagEntity[] {
  return entities.filter(
    (e): e is FlagEntity =>
      isFlagEntity(e) && e.flags.parents.includes(commandName)
  );
}

/**
 * get all scoped entities for a command.
 */
export function getScopedForCommand(
  entities: EntityDefinition[],
  commandName: string
): ScopedEntity[] {
  return entities.filter(
    (e): e is ScopedEntity =>
      isScopedEntity(e) && e.scoped.parent === commandName
  );
}

/**
 * get all subcommands for a command.
 */
export function getSubcommandsForCommand(
  entities: EntityDefinition[],
  commandName: string
): SubcommandEntity[] {
  return entities.filter(
    (e): e is SubcommandEntity =>
      isSubcommandEntity(e) && e.subcommand.parent === commandName
  );
}

/**
 * validate entity definitions array.
 * throws if any definition is invalid.
 */
export function validateDefinitions(definitions: unknown[]): EntityDefinition[] {
  const validated: EntityDefinition[] = [];

  for (let i = 0; i < definitions.length; i++) {
    const def = definitions[i];
    const result = entityDefinition(def);

    if (result instanceof type.errors) {
      throw new Error(
        `invalid entity definition at index ${i}: ${result.summary}`
      );
    }

    validated.push(result);
  }

  return validated;
}
