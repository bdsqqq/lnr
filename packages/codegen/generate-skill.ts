#!/usr/bin/env bun
/**
 * generates SKILL.md from SKILL.template.md + cli-spec.json
 *
 * replaces markers like <!-- ISSUES_EXAMPLES --> with actual CLI examples
 * derived from the spec. keeps skill documentation in sync with codegen.
 *
 * run: bun run packages/codegen/generate-skill.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");

interface Flag {
  name: string;
  type: string;
  required: boolean;
  description: string;
  positional: boolean;
}

interface Command {
  entity: string;
  command: string;
  description: string;
  flags: Flag[];
  operations: { name: string; inferredWhen: string }[];
}

interface CliSpec {
  commands: Command[];
}

const spec: CliSpec = JSON.parse(
  readFileSync(join(__dirname, "cli-spec.json"), "utf-8")
);

function generateExamples(entity: string): string {
  const commands = spec.commands.filter((c) => c.entity === entity);
  const lines: string[] = [];

  for (const cmd of commands) {
    const isList = cmd.command.endsWith("s") && cmd.command !== "teams";
    const singular = cmd.command.replace(/s$/, "");

    if (isList) {
      // list command examples
      lines.push(`lnr ${cmd.command}${padComment("list all")}`);

      const teamFlag = cmd.flags.find((f) => f.name === "team");
      if (teamFlag) {
        lines.push(`lnr ${cmd.command} --team AXM${padComment("filter by team")}`);
      }

      const assigneeFlag = cmd.flags.find((f) => f.name === "assignee");
      if (assigneeFlag) {
        lines.push(`lnr ${cmd.command} --assignee @me${padComment("my items")}`);
      }

      const stateFlag = cmd.flags.find((f) => f.name === "state");
      if (stateFlag) {
        lines.push(`lnr ${cmd.command} --state "In Progress"${padComment("filter by state")}`);
      }
    } else {
      // singular command examples
      const positional = cmd.flags.find((f) => f.positional);
      const posExample = getPositionalExample(entity);

      // show
      lines.push(`lnr ${cmd.command} ${posExample}${padComment("show details")}`);

      // open in browser (if has --open)
      if (cmd.flags.find((f) => f.name === "open")) {
        lines.push(`lnr ${cmd.command} ${posExample} --open${padComment("open in browser")}`);
      }

      // update examples for key mutation flags
      const mutationExamples = getMutationExamples(cmd, posExample);
      lines.push(...mutationExamples);

      // create example
      const hasNew = cmd.operations.some((o) => o.name === "create");
      if (hasNew) {
        const createExample = getCreateExample(cmd);
        if (createExample) {
          lines.push(createExample);
        }
      }

      // delete/archive example
      const archiveFlag = cmd.flags.find((f) => f.name === "archive" || f.name === "delete");
      if (archiveFlag) {
        lines.push(`lnr ${cmd.command} ${posExample} --${archiveFlag.name}${padComment(archiveFlag.name)}`);
      }
    }
  }

  return lines.join("\n");
}

function getPositionalExample(entity: string): string {
  switch (entity) {
    case "issues":
      return "AXM-1234";
    case "projects":
      return '"Project Name"';
    case "docs":
      return '"Doc Title"';
    case "labels":
      return '"bug"';
    case "teams":
      return "AXM";
    case "cycles":
      return "--team AXM --current";
    default:
      return "ID";
  }
}

function getMutationExamples(cmd: Command, posExample: string): string[] {
  const examples: string[] = [];
  const entity = cmd.entity;

  // entity-specific mutation examples
  if (entity === "issues") {
    if (cmd.flags.find((f) => f.name === "state")) {
      examples.push(`lnr ${cmd.command} ${posExample} --state "Done"${padComment("update state")}`);
    }
    if (cmd.flags.find((f) => f.name === "assignee")) {
      examples.push(`lnr ${cmd.command} ${posExample} --assignee @me${padComment("assign to self")}`);
    }
    if (cmd.flags.find((f) => f.name === "priority")) {
      examples.push(`lnr ${cmd.command} ${posExample} --priority high${padComment("set priority")}`);
    }
    if (cmd.flags.find((f) => f.name === "comment")) {
      examples.push(`lnr ${cmd.command} ${posExample} --comment "note"${padComment("add comment")}`);
    }
    if (cmd.flags.find((f) => f.name === "label")) {
      examples.push(`lnr ${cmd.command} ${posExample} --label +bug${padComment("add label")}`);
      examples.push(`lnr ${cmd.command} ${posExample} --label -bug${padComment("remove label")}`);
    }
    if (cmd.flags.find((f) => f.name === "branch")) {
      examples.push(`lnr ${cmd.command} ${posExample} --branch${padComment("git branch name")}`);
    }
    if (cmd.flags.find((f) => f.name === "pr")) {
      examples.push(`lnr ${cmd.command} ${posExample} --pr "https://..."${padComment("link PR")}`);
    }
  }

  if (entity === "projects") {
    if (cmd.flags.find((f) => f.name === "issues")) {
      examples.push(`lnr ${cmd.command} ${posExample} --issues${padComment("list project issues")}`);
    }
  }

  return examples;
}

function getCreateExample(cmd: Command): string | null {
  const entity = cmd.entity;

  switch (entity) {
    case "issues":
      return `lnr ${cmd.command} new --team AXM --title "title" --description "desc"${padComment("create")}`;
    case "projects":
      return `lnr ${cmd.command} new --team AXM --projectName "name"${padComment("create")}`;
    case "docs":
      return `lnr ${cmd.command} new --title "title" --content "..."${padComment("create")}`;
    case "labels":
      return `lnr ${cmd.command} new --team AXM --name "label" --color "#ff0000"${padComment("create")}`;
    default:
      return null;
  }
}

function padComment(comment: string): string {
  return `  # ${comment}`;
}

function generateCyclesExamples(): string {
  return `lnr cycles --team AXM  # list team cycles
lnr cycle --team AXM --current  # current active cycle
lnr cycle --team AXM --current --issues  # issues in current cycle`;
}

function generateTeamsExamples(): string {
  return `lnr teams  # list teams
lnr team AXM  # team details
lnr me  # current user`;
}

// read template
const template = readFileSync(join(ROOT, "SKILL.template.md"), "utf-8");

// replace markers
let output = template
  .replace("<!-- ISSUES_EXAMPLES -->", generateExamples("issues"))
  .replace("<!-- PROJECTS_EXAMPLES -->", generateExamples("projects"))
  .replace("<!-- DOCS_EXAMPLES -->", generateExamples("docs"))
  .replace("<!-- LABELS_EXAMPLES -->", generateExamples("labels"))
  .replace("<!-- CYCLES_EXAMPLES -->", generateCyclesExamples())
  .replace("<!-- TEAMS_EXAMPLES -->", generateTeamsExamples());

// write output
writeFileSync(join(ROOT, "SKILL.md"), output);

console.log("generated SKILL.md from template + cli-spec.json");
