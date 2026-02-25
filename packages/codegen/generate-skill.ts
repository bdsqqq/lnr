#!/usr/bin/env bun
/**
 * generates SKILL.md from SKILL.template.md + command-reference.md
 *
 * parses command-reference.md to extract entity names and aliases,
 * then injects a compact entity catalog into the template. keeps
 * the skill in sync with codegen without exhaustive flag listings.
 *
 * run: bun run packages/codegen/generate-skill.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");

interface EntityInfo {
  /** plural list command, e.g. "issues" */
  listCmd: string;
  /** singular show/mutate command, e.g. "issue" */
  singularCmd: string | null;
  /** short alias from command-reference, e.g. "i" */
  alias: string | null;
  /** has create/update/delete operations */
  hasMutations: boolean;
  /** subcommands like "batch", "milestone" */
  subcommands: string[];
  /** extra notes for the catalog */
  notes: string | null;
}

/**
 * parses command-reference.md to extract entities.
 *
 * each line looks like:
 *   | `lnr issues` | list issues (alias: i) |
 *   | `lnr issue <idOrNew>` | show or update a issue, or create with 'new' |
 *   | `lnr issue batch <issues>` | batch update multiple issues at once |
 */
function parseCommandReference(content: string): Map<string, EntityInfo> {
  const entities = new Map<string, EntityInfo>();
  const lines = content.split("\n");

  /** commands to skip — these are standalone and handled in the template */
  const SKIP = new Set(["auth", "config", "me", "search"]);

  for (const line of lines) {
    const match = line.match(/\| `lnr (\S+?)(?:`|\s+(\S+?))?(?:`|\s+(\S+?))?`/);
    if (!match) continue;

    const [, cmd, arg1, arg2] = match;

    if (SKIP.has(cmd)) continue;

    // detect alias from description: "(alias: X)"
    const aliasMatch = line.match(/\(alias: (\w+)\)/);

    // detect mutations from description
    const hasMutation =
      line.includes("create") ||
      line.includes("update") ||
      line.includes("delete") ||
      line.includes("archive") ||
      line.includes("--state") ||
      line.includes("--assignee");

    // detect subcommand: "lnr issue batch", "lnr project milestone"
    if (arg1 && arg2 && !arg1.startsWith("<") && !arg1.startsWith("-")) {
      // this is a subcommand like "issue batch" or "project milestone"
      const parentKey = findParentKey(entities, cmd);
      if (parentKey) {
        const parent = entities.get(parentKey)!;
        if (!parent.subcommands.includes(arg1)) {
          parent.subcommands.push(arg1);
        }
      }
      continue;
    }

    // plural (list) command — no positional arg or first arg is a flag
    const isListCmd =
      !arg1 || arg1.startsWith("-") || (arg1.startsWith("<") === false && arg1.startsWith("-") === false);

    // actually: list commands have no <positional> arg typically
    const hasPositional = arg1?.startsWith("<");

    if (!hasPositional) {
      // list command
      const key = cmd;
      if (!entities.has(key)) {
        entities.set(key, {
          listCmd: cmd,
          singularCmd: null,
          alias: aliasMatch?.[1] ?? null,
          hasMutations: false,
          subcommands: [],
          notes: null,
        });
      } else {
        // update alias if we found one
        if (aliasMatch) {
          entities.get(key)!.alias = aliasMatch[1];
        }
      }
    } else {
      // singular command — find or create parent
      const parentKey = findParentKey(entities, cmd);
      if (parentKey) {
        const parent = entities.get(parentKey)!;
        parent.singularCmd = cmd;
        if (hasMutation) parent.hasMutations = true;
      } else {
        // singular without a known parent — create entry keyed by cmd
        // e.g. "notification" might appear before "notifications"
        entities.set(cmd, {
          listCmd: cmd + "s",
          singularCmd: cmd,
          alias: aliasMatch?.[1] ?? null,
          hasMutations: hasMutation,
          subcommands: [],
          notes: null,
        });
      }
    }
  }

  return entities;
}

/**
 * naive pluralization for command names.
 * handles: issue→issues, cycle→cycles, git-branch→git-branches
 */
function pluralize(cmd: string): string[] {
  const candidates = [cmd + "s"];
  if (cmd.endsWith("ch") || cmd.endsWith("sh") || cmd.endsWith("ss") || cmd.endsWith("x")) {
    candidates.unshift(cmd + "es");
  }
  return candidates;
}

/**
 * finds the parent entity key for a singular command.
 * e.g. "issue" → "issues", "project" → "projects", "git-branch" → "git-branches"
 */
function findParentKey(
  entities: Map<string, EntityInfo>,
  singularCmd: string
): string | null {
  // direct match (e.g. entry keyed by "notification" before "notifications" was seen)
  if (entities.has(singularCmd)) return singularCmd;

  // try plural forms
  for (const plural of pluralize(singularCmd)) {
    if (entities.has(plural)) return plural;
  }

  // try matching listCmd or singularCmd
  for (const [key, info] of entities) {
    if (info.singularCmd === singularCmd) return key;
    for (const plural of pluralize(singularCmd)) {
      if (info.listCmd === plural) return key;
    }
  }

  return null;
}

/**
 * formats the entity catalog as a compact grouped list.
 *
 * groups by capability (crud vs read-only) with aliases and subcommands noted.
 */
function formatCatalog(entities: Map<string, EntityInfo>): string {
  const crud: string[] = [];
  const readOnly: string[] = [];

  for (const [, info] of entities) {
    const name = info.listCmd;
    const parts: string[] = [name];
    if (info.alias) parts[0] += ` (${info.alias})`;
    if (info.subcommands.length > 0) {
      parts.push(`subcommands: ${info.subcommands.join(", ")}`);
    }

    const entry = parts.length > 1 ? `${parts[0]} — ${parts.slice(1).join("; ")}` : parts[0];

    if (info.hasMutations) {
      crud.push(entry);
    } else {
      readOnly.push(entry);
    }
  }

  const lines: string[] = [];
  if (crud.length) {
    lines.push(`**crud:** ${crud.join(" · ")}`);
  }
  if (readOnly.length) {
    lines.push(`**read-only:** ${readOnly.join(" · ")}`);
  }

  lines.push("");
  lines.push(
    "`me` — current user info (`--issues`, `--created`, `--activity`). " +
    "`search` (s) — full-text issue search. " +
    "`auth` — authenticate (`--whoami`, `--logout`). " +
    "`config get|set|list` — manage settings."
  );

  return lines.join("\n");
}

// --- main ---

const template = readFileSync(join(ROOT, "SKILL.template.md"), "utf-8");
const commandRef = readFileSync(join(ROOT, "docs/command-reference.md"), "utf-8");

const entities = parseCommandReference(commandRef);
const catalog = formatCatalog(entities);

const output = template.replace("<!-- ENTITY_CATALOG -->", catalog);

writeFileSync(join(ROOT, "SKILL.md"), output);

console.log(
  `generated SKILL.md — ${entities.size} entities, ${output.split("\n").length} lines`
);
