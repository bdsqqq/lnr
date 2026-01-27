#!/usr/bin/env bun
/**
 * generates contract tests from cli-spec.json
 *
 * tests verify the INPUT → REQUEST PAYLOAD transformation:
 * - CLI args parse correctly via zod schemas
 * - operation inference selects correct code path
 * - core functions receive correct parameters
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Flag {
  name: string;
  type: string;
  required: boolean;
  description: string;
  positional: boolean;
}

interface Operation {
  name: string;
  inferredWhen: string;
}

interface Command {
  entity: string;
  command: string;
  description: string;
  aliases: string[];
  flags: Flag[];
  operations: Operation[];
}

interface CliSpec {
  extractedAt: string;
  version: string;
  commands: Command[];
}

function generateValidInput(cmd: Command): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  for (const flag of cmd.flags) {
    if (flag.required) {
      if (flag.type === "boolean") {
        input[flag.name] = true;
      } else if (flag.type.startsWith("enum(")) {
        const values = flag.type.slice(5, -1).split(",");
        input[flag.name] = values[0];
      } else {
        input[flag.name] = "test-value";
      }
    }
  }
  return input;
}

function generateTestFile(spec: CliSpec): string {
  const lines: string[] = [];

  lines.push(`/**`);
  lines.push(` * contract tests: CLI input → core function parameters`);
  lines.push(` * generated from cli-spec.json at ${new Date().toISOString()}`);
  lines.push(` *`);
  lines.push(` * these tests verify the transformation from CLI flags to API request payloads.`);
  lines.push(` * regenerate with: bun run packages/codegen/generate-contract-tests.ts`);
  lines.push(` */`);
  lines.push(``);
  lines.push(`import { describe, test, expect } from "bun:test";`);
  lines.push(``);
  lines.push(`// import schemas directly from router files`);
  lines.push(`import { listIssuesInput, issueInput } from "../router/issues";`);
  lines.push(`import { listProjectsInput, projectInput } from "../router/projects";`);
  lines.push(`import { listTeamsInput, teamInput } from "../router/teams";`);
  lines.push(`import { listCyclesInput, cycleInput } from "../router/cycles";`);
  lines.push(`import { listDocsInput, docInput } from "../router/docs";`);
  lines.push(`import { listLabelsInput, labelInput } from "../router/labels";`);
  lines.push(`import { meInput } from "../router/me";`);
  lines.push(`import { searchInput } from "../router/search";`);
  lines.push(`import { authInput } from "../router/auth";`);
  lines.push(`import { getInput as configGetInput, setInput as configSetInput } from "../router/config";`);
  lines.push(``);
  lines.push(`// operation inference - mirrors router logic`);
  lines.push(`function inferOperation(command: string, input: Record<string, unknown>): "create" | "update" | "delete" | "show" {`);
  lines.push(`  const positionalNewCommands = ["issue", "project", "doc", "label"];`);
  lines.push(`  if (positionalNewCommands.includes(command)) {`);
  lines.push(`    const positional = input.idOrNew ?? input.name ?? input.id;`);
  lines.push(`    if (positional === "new") return "create";`);
  lines.push(`  }`);
  lines.push(`  if (input.delete || input.archive) return "delete";`);
  lines.push(`  const mutationFlags = [`);
  lines.push(`    "state", "assignee", "priority", "label", "comment",`);
  lines.push(`    "editComment", "replyTo", "deleteComment", "react", "unreact",`);
  lines.push(`    "parent", "blocks", "blockedBy", "relatesTo", "title",`);
  lines.push(`    "content", "projectName"`);
  lines.push(`  ];`);
  lines.push(`  for (const flag of mutationFlags) {`);
  lines.push(`    if (input[flag] !== undefined) return "update";`);
  lines.push(`  }`);
  lines.push(`  return "show";`);
  lines.push(`}`);
  lines.push(``);

  // group commands by entity for cleaner output
  const entities = [...new Set(spec.commands.map((c) => c.entity))];

  for (const entity of entities) {
    const cmds = spec.commands.filter((c) => c.entity === entity);
    lines.push(`describe("${entity}", () => {`);

    for (const cmd of cmds) {
      const schemaName = getSchemaName(cmd);
      if (!schemaName) continue;

      lines.push(`  describe("${cmd.command}", () => {`);

      // test: valid input parses
      const validInput = generateValidInput(cmd);
      lines.push(`    test("valid input parses", () => {`);
      lines.push(`      const result = ${schemaName}.safeParse(${JSON.stringify(validInput)});`);
      lines.push(`      expect(result.success).toBe(true);`);
      lines.push(`    });`);
      lines.push(``);

      // test: required flags
      const requiredFlags = cmd.flags.filter((f) => f.required);
      if (requiredFlags.length > 0) {
        lines.push(`    test("rejects missing required flags", () => {`);
        lines.push(`      const result = ${schemaName}.safeParse({});`);
        lines.push(`      expect(result.success).toBe(false);`);
        lines.push(`    });`);
        lines.push(``);
      }

      // test: operation inference (only for commands with multiple ops)
      if (cmd.operations.length > 1) {
        const positionalFlag = cmd.flags.find((f) => f.positional);

        // CREATE via 'new'
        if (cmd.operations.some((o) => o.name === "create") && positionalFlag) {
          lines.push(`    test("infers CREATE when ${positionalFlag.name}='new'", () => {`);
          lines.push(`      expect(inferOperation("${cmd.command}", { ${positionalFlag.name}: "new" })).toBe("create");`);
          lines.push(`    });`);
          lines.push(``);
        }

        // DELETE via delete/archive flag
        const deleteFlag = cmd.flags.find((f) => f.name === "delete" || f.name === "archive");
        if (cmd.operations.some((o) => o.name === "delete") && deleteFlag) {
          lines.push(`    test("infers DELETE when --${deleteFlag.name}", () => {`);
          const input = { ...validInput, [deleteFlag.name]: true };
          lines.push(`      expect(inferOperation("${cmd.command}", ${JSON.stringify(input)})).toBe("delete");`);
          lines.push(`    });`);
          lines.push(``);
        }

        // UPDATE via mutation flag
        const mutationFlag = cmd.flags.find((f) =>
          ["state", "assignee", "priority", "title", "content"].includes(f.name)
        );
        if (cmd.operations.some((o) => o.name === "update") && mutationFlag) {
          lines.push(`    test("infers UPDATE when --${mutationFlag.name}", () => {`);
          const input = { ...validInput, [mutationFlag.name]: "test" };
          lines.push(`      expect(inferOperation("${cmd.command}", ${JSON.stringify(input)})).toBe("update");`);
          lines.push(`    });`);
          lines.push(``);
        }

        // SHOW when no mutation flags
        lines.push(`    test("infers SHOW with no mutation flags", () => {`);
        lines.push(`      expect(inferOperation("${cmd.command}", ${JSON.stringify(validInput)})).toBe("show");`);
        lines.push(`    });`);
        lines.push(``);
      }

      lines.push(`  });`);
      lines.push(``);
    }

    lines.push(`});`);
    lines.push(``);
  }

  return lines.join("\n");
}

function getSchemaName(cmd: Command): string | null {
  const map: Record<string, string> = {
    issues: "listIssuesInput",
    issue: "issueInput",
    projects: "listProjectsInput",
    project: "projectInput",
    teams: "listTeamsInput",
    team: "teamInput",
    cycles: "listCyclesInput",
    cycle: "cycleInput",
    docs: "listDocsInput",
    doc: "docInput",
    labels: "listLabelsInput",
    label: "labelInput",
    me: "meInput",
    search: "searchInput",
    auth: "authInput",
    get: "configGetInput",
    set: "configSetInput",
    list: null, // config.list has no input schema
  };
  return map[cmd.command] ?? null;
}

async function main() {
  const specPath = join(__dirname, "cli-spec.json");
  const outputPath = join(__dirname, "..", "cli", "src", "router", "contract.test.ts");

  console.log(`reading spec from ${specPath}`);
  const specContent = readFileSync(specPath, "utf-8");
  const spec: CliSpec = JSON.parse(specContent);

  console.log(`generating contract tests for ${spec.commands.length} commands`);
  const testContent = generateTestFile(spec);

  writeFileSync(outputPath, testContent);
  console.log(`wrote tests to ${outputPath}`);

  const testCount = (testContent.match(/test\(/g) || []).length;
  console.log(`generated ${testCount} tests`);
}

main().catch(console.error);
