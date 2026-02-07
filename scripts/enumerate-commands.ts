#!/usr/bin/env bun
/**
 * enumerate all lnr commands and their flags for UX review.
 *
 * introspects the trpc router + arktype schemas at import time.
 * zero subprocesses — reads metadata directly from the type system.
 *
 * usage:
 *   bun run scripts/enumerate-commands.ts              # flat list
 *   bun run scripts/enumerate-commands.ts --grouped    # grouped with descriptions
 *   bun run scripts/enumerate-commands.ts --markdown   # markdown table
 */

import {
  type Flag,
  type Command,
  camelToKebab,
  buildCommands,
} from "../packages/cli/src/lib/command-introspection";

const fmtFlag = (f: Flag): string =>
  f.positional
    ? f.required ? `<${f.name}>` : `[${f.name}]`
    : "";

const fmtFlagArg = (f: Flag): string =>
  f.type === "boolean" ? "" : ` <${f.type}>`;

const baseLine = (cmd: Command): string => {
  const positionals = cmd.flags
    .filter((f) => f.positional)
    .map(fmtFlag)
    .join(" ");
  return `lnr ${cmd.name}${positionals ? " " + positionals : ""}`;
};

const optionFlags = (cmd: Command): Flag[] =>
  cmd.flags.filter((f) => !f.positional);

const formatGrouped = (commands: Command[]): string =>
  commands
    .map((cmd) => {
      const base = baseLine(cmd);
      const aliasNote = cmd.aliases.length ? `  (alias: ${cmd.aliases.join(", ")})` : "";
      const header = `\n## ${cmd.name}${aliasNote}\n   ${cmd.description}\n`;
      const options = optionFlags(cmd);
      const lines = [
        `  ${base}`,
        ...options.map((f) => `  ${base} --${camelToKebab(f.name)}${fmtFlagArg(f)}  # ${f.description}`),
      ];
      return header + "\n" + lines.join("\n");
    })
    .join("\n");

const formatMarkdown = (commands: Command[]): string => {
  const header = "# lnr command reference\n\ngenerated for UX review. each row = one valid invocation.\n";
  const tableHeader = "| command | description |\n|---------|-------------|";
  const rows = commands.flatMap((cmd) => {
    const base = baseLine(cmd);
    const aliasNote = cmd.aliases.length ? ` (alias: ${cmd.aliases.join(", ")})` : "";
    const options = optionFlags(cmd);
    return [
      `| \`${base}\` | ${cmd.description}${aliasNote} |`,
      ...options.map((f) => `| \`${base} --${camelToKebab(f.name)}${fmtFlagArg(f)}\` | ${f.description} |`),
    ];
  });
  return [header, tableHeader, ...rows].join("\n");
};

const formatFlat = (commands: Command[]): string =>
  commands
    .flatMap((cmd) => {
      const base = baseLine(cmd);
      const options = optionFlags(cmd);
      return [base, ...options.map((f) => `${base} --${camelToKebab(f.name)}${fmtFlagArg(f)}`)];
    })
    .join("\n");

const main = () => {
  const args = new Set(process.argv.slice(2));
  const commands = buildCommands();

  const output = args.has("--markdown")
    ? formatMarkdown(commands)
    : args.has("--grouped")
      ? formatGrouped(commands)
      : formatFlat(commands);

  console.log(output);

  const total = commands.reduce((s, c) => s + 1 + optionFlags(c).length, 0);
  console.error(`\n${commands.length} commands, ${total} permutations`);
};

if (import.meta.main) main();
