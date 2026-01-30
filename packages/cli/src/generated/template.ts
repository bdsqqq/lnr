/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from extracted-schema.json at 2026-01-30
 *
 * Regenerate with: bun run packages/codegen/generate-commands.ts
 */

import { z } from "zod";
import {
  getClient,
  listTemplates,
  getTemplate,
  getIssueTemplates,
  type Template,
} from "@bdsqqq/lnr-core";
import { router, procedure } from "../router/trpc";
import { handleApiError, exitWithError, EXIT_CODES } from "../lib/error";
import {
  outputJson,
  outputQuiet,
  outputTable,
  getOutputFormat,
  truncate,
  type OutputOptions,
  type TableColumn,
} from "../lib/output";

export const listTemplatesInput = z.object({
  team: z.string().optional().describe("filter by team key"),
  type: z.string().optional().describe("filter by template type (issue, project)"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});

export const templateInput = z.object({
  name: z.string().meta({ positional: true }).describe("template name or id"),
  team: z.string().optional().describe("team key to scope template lookup"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});

type TemplateInput = z.infer<typeof templateInput>;

const templateColumns: TableColumn<Template>[] = [
  { header: "NAME", value: (t) => truncate(t.name, 30), width: 30 },
  { header: "TYPE", value: (t) => t.type, width: 10 },
  { header: "TEAM", value: (t) => t.teamKey ?? "workspace", width: 10 },
];

const verboseTemplateColumns: TableColumn<Template>[] = [
  ...templateColumns,
  { header: "DESCRIPTION", value: (t) => truncate(t.description ?? "-", 40), width: 40 },
  { header: "ID", value: (t) => t.id, width: 36 },
];

async function handleListTemplates(
  input: z.infer<typeof listTemplatesInput>
): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    let templates = await listTemplates(client, input.team);

    if (input.type) {
      templates = templates.filter(
        (t) => t.type.toLowerCase() === input.type!.toLowerCase()
      );
    }

    if (format === "json") {
      outputJson(templates);
      return;
    }

    if (format === "quiet") {
      outputQuiet(templates.map((t) => t.id));
      return;
    }

    const columns = input.verbose ? verboseTemplateColumns : templateColumns;
    outputTable(templates, columns, outputOpts);
  } catch (error) {
    handleApiError(error);
  }
}

async function handleShowTemplate(
  name: string,
  input: TemplateInput
): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    const template = await getTemplate(client, name, input.team);

    if (!template) {
      exitWithError(
        `template "${name}" not found`,
        input.team ? undefined : "try: lnr templates --team <key>",
        EXIT_CODES.NOT_FOUND
      );
    }

    if (format === "json") {
      outputJson(template);
      return;
    }

    if (format === "quiet") {
      console.log(template.id);
      return;
    }

    console.log(`${template.name}`);
    console.log(`type: ${template.type}`);
    console.log(`team: ${template.teamKey ?? "workspace"}`);
    if (template.description) {
      console.log(`description: ${template.description}`);
    }
    console.log(`id: ${template.id}`);
  } catch (error) {
    handleApiError(error);
  }
}

export const generatedTemplatesRouter = router({
  templates: procedure
    .meta({
      description: "list templates",
    })
    .input(listTemplatesInput)
    .query(async ({ input }) => {
      await handleListTemplates(input);
    }),

  template: procedure
    .meta({
      description: "show a template",
    })
    .input(templateInput)
    .query(async ({ input }) => {
      await handleShowTemplate(input.name, input);
    }),
});
