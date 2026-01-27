import * as fs from "fs";
import * as path from "path";

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

interface CommandSpec {
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
  commands: CommandSpec[];
}

function extractSchemaBlock(content: string, schemaName: string): string | null {
  const startPattern = new RegExp(`const\\s+${schemaName}\\s*=\\s*z\\.object\\(\\{`);
  const match = content.match(startPattern);
  if (!match || match.index === undefined) return null;

  let depth = 0;
  let inBlock = false;
  let blockStart = match.index + match[0].length - 1;
  let blockEnd = blockStart;

  for (let i = blockStart; i < content.length; i++) {
    const char = content[i];
    if (char === "{") {
      depth++;
      inBlock = true;
    } else if (char === "}") {
      depth--;
      if (inBlock && depth === 0) {
        blockEnd = i;
        break;
      }
    }
  }

  return content.slice(blockStart + 1, blockEnd);
}

function parseZodSchema(content: string, schemaName: string): Flag[] {
  const flags: Flag[] = [];

  const block = extractSchemaBlock(content, schemaName);
  if (!block) {
    const mergeMatch = content.match(
      new RegExp(`const\\s+${schemaName}\\s*=\\s*z\\.object\\(\\{([^}]*)\\}\\)\\.merge\\((\\w+)\\)`, "s")
    );
    if (mergeMatch) {
      parseFieldsFromBlock(mergeMatch[1], flags);
      const mergedFlags = parseZodSchema(content, mergeMatch[2].trim());
      flags.push(...mergedFlags);
    }
    return flags;
  }

  parseFieldsFromBlock(block, flags);
  return flags;
}

function parseFieldsFromBlock(block: string, flags: Flag[]): void {
  const lines = block.split("\n");
  let currentField = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;

    currentField += " " + trimmed;

    const openParens = (currentField.match(/\(/g) || []).length;
    const closeParens = (currentField.match(/\)/g) || []).length;

    if (openParens === closeParens && currentField.includes(":")) {
      parseFieldLine(currentField.trim(), flags);
      currentField = "";
    }
  }

  if (currentField.trim()) {
    parseFieldLine(currentField.trim(), flags);
  }
}

function parseFieldLine(line: string, flags: Flag[]): void {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return;

  const name = line.slice(0, colonIndex).trim();
  if (!name || name.includes("{") || name.includes("}")) return;

  const definition = line.slice(colonIndex + 1).trim().replace(/,$/, "");

  let type = "unknown";
  const typeMatch = definition.match(/z\.(\w+)/);
  if (typeMatch) {
    type = typeMatch[1];
    if (type === "enum") {
      const enumMatch = definition.match(/z\.enum\(\[([^\]]+)\]\)/);
      if (enumMatch) {
        type = `enum(${enumMatch[1].replace(/["']/g, "").replace(/\s+/g, "")})`;
      }
    }
  }

  const required = !definition.includes(".optional()");
  const positional = definition.includes("positional: true");

  const descMatch = definition.match(/\.describe\(["'](.+?)["']\)/);
  const description = descMatch ? descMatch[1] : "";

  flags.push({ name, type, required, description, positional });
}

function parseRouterMeta(content: string, procedureName: string): { description: string; aliases: string[] } {
  const metaPattern = new RegExp(
    `${procedureName}:\\s*procedure\\s*\\.meta\\(\\{([^}]+)\\}\\)`,
    "s"
  );
  const match = content.match(metaPattern);

  if (!match) return { description: "", aliases: [] };

  const metaBlock = match[1];
  const descMatch = metaBlock.match(/description:\s*["']([^"']+)["']/);
  const description = descMatch ? descMatch[1] : "";

  const aliasMatch = metaBlock.match(/aliases:\s*\{\s*command:\s*\[([^\]]+)\]/);
  const aliases = aliasMatch
    ? aliasMatch[1].split(",").map((a) => a.trim().replace(/["']/g, ""))
    : [];

  return { description, aliases };
}

function inferOperations(commandName: string, content: string): Operation[] {
  const operations: Operation[] = [];

  if (content.includes(`=== "new"`) || content.includes(`input.idOrNew === "new"`)) {
    operations.push({ name: "create", inferredWhen: "positional arg is 'new'" });
  }

  const mutationFlags = ["state", "assignee", "priority", "label", "comment", "archive", "parent"];
  const hasMutation = mutationFlags.some((f) => content.includes(`input.${f}`));
  if (hasMutation) {
    operations.push({ name: "update", inferredWhen: "mutation flags present (state, assignee, priority, etc)" });
  }

  if (content.includes("input.delete") || content.includes("deleteProject") || content.includes("deleteLabel") || content.includes("deleteDocument") || content.includes("archiveIssue")) {
    operations.push({ name: "delete", inferredWhen: "--delete or --archive flag present" });
  }

  operations.push({ name: "show", inferredWhen: "no mutation flags present" });

  return operations;
}

function extractCommandFromFile(filePath: string): CommandSpec[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const specs: CommandSpec[] = [];
  const entity = path.basename(filePath, ".ts");

  const inputSchemas = new Map<string, string>();
  const schemaDefPattern = /const\s+(\w+Input|docInput|labelInput|teamInput|projectInput|cycleInput|issueInput|searchInput|meInput|authInput|getInput|setInput)\s*=\s*z\.object/g;
  let schemaMatch: RegExpExecArray | null;
  while ((schemaMatch = schemaDefPattern.exec(content)) !== null) {
    const schemaName = schemaMatch[1];
    inputSchemas.set(schemaName, schemaName);
  }

  const procedurePattern = /(\w+):\s*(?:router\(|procedure\s*\.meta\(\{)/g;
  let match: RegExpExecArray | null;

  while ((match = procedurePattern.exec(content)) !== null) {
    const commandName = match[1];

    if (commandName === "config" && match[0].includes("router(")) {
      continue;
    }

    const inputMatch = content.match(
      new RegExp(`${commandName}:\\s*procedure[\\s\\S]*?\\.input\\((\\w+)\\)`)
    );

    let flags: Flag[] = [];
    if (inputMatch) {
      const schemaName = inputMatch[1];
      flags = parseZodSchema(content, schemaName);
    }

    const { description, aliases } = parseRouterMeta(content, commandName);
    const operations = inferOperations(commandName, content);

    specs.push({
      entity,
      command: commandName,
      description,
      aliases,
      flags,
      operations,
    });
  }

  return specs;
}

function main(): void {
  const routerDir = path.join(__dirname, "../cli/src/router");
  const outputPath = path.join(__dirname, "cli-spec.json");

  const routerFiles = fs.readdirSync(routerDir).filter(
    (f) => f.endsWith(".ts") && f !== "index.ts" && f !== "trpc.ts"
  );

  const allCommands: CommandSpec[] = [];

  for (const file of routerFiles) {
    const filePath = path.join(routerDir, file);
    const commands = extractCommandFromFile(filePath);
    allCommands.push(...commands);
  }

  const spec: CliSpec = {
    extractedAt: new Date().toISOString(),
    version: "1.0.0",
    commands: allCommands,
  };

  fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));
  console.log(`extracted ${allCommands.length} commands to ${outputPath}`);

  const issueCmd = allCommands.find((c) => c.command === "issue");
  const projectCmd = allCommands.find((c) => c.command === "project");
  console.log(`  - issue flags: ${issueCmd?.flags.length ?? 0}`);
  console.log(`  - project flags: ${projectCmd?.flags.length ?? 0}`);
}

main();
