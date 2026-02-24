#!/usr/bin/env bun
/**
 * validate entity definitions and show summary.
 * run: bun run packages/codegen/validate-schema.ts
 */

import { ENTITY_DEFINITIONS, getCommandEntities, getFlagEntities, getScopedEntities, getSubcommandEntities } from "./entity-definitions";
import { getFlagsForCommand, getScopedForCommand, getSubcommandsForCommand } from "./entity-schema";

console.log("=== entity definitions loaded ===");
console.log("total entities:", ENTITY_DEFINITIONS.length);
console.log("  command:", getCommandEntities().length);
console.log("  flag:", getFlagEntities().length);
console.log("  scoped:", getScopedEntities().length);
console.log("  subcommand:", getSubcommandEntities().length);

// show what gets injected into each command
const commands = getCommandEntities();
for (const cmd of commands) {
  if (cmd.exposure !== "command") continue;
  
  const name = cmd.command.singular;
  const flags = getFlagsForCommand(ENTITY_DEFINITIONS, name);
  const scoped = getScopedForCommand(ENTITY_DEFINITIONS, name);
  const subcommands = getSubcommandsForCommand(ENTITY_DEFINITIONS, name);
  
  if (flags.length === 0 && scoped.length === 0 && subcommands.length === 0) continue;
  
  console.log(`\n=== ${name} command ===`);
  
  if (flags.length > 0) {
    console.log("  injected flags:");
    for (const f of flags) {
      const ops = f.flags.operations.map(o => `--${o.flag}`).join(", ");
      console.log(`    ${f.name}: ${ops}`);
    }
  }
  
  if (scoped.length > 0) {
    console.log("  scoped entities:");
    for (const s of scoped) {
      console.log(`    ${s.name}: --${s.scoped.flag}`);
    }
  }
  
  if (subcommands.length > 0) {
    console.log("  subcommands:");
    for (const s of subcommands) {
      console.log(`    ${s.name}: ${name} ${s.subcommand.name}`);
    }
  }
}

console.log("\n✓ all definitions valid");
