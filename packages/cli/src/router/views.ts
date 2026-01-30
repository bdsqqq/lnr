import { z } from "zod";
import {
  getClient,
  listViews,
  getView,
  createView,
  updateView,
  deleteView,
  type CustomView,
} from "@bdsqqq/lnr-core";
import { router, procedure } from "./trpc";
import { exitWithError, handleApiError, EXIT_CODES } from "../lib/error";
import {
  outputJson,
  outputQuiet,
  outputTable,
  getOutputFormat,
  formatDate,
  truncate,
  type OutputOptions,
  type TableColumn,
} from "../lib/output";

const outputOptions = z.object({
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});

export const listViewsInput = z.object({}).merge(outputOptions);

export const viewInput = z
  .object({
    nameOrId: z
      .string()
      .meta({ positional: true })
      .describe("view name, id, or 'new'"),
    name: z.string().optional().describe("view name"),
    description: z.string().optional().describe("view description"),
    icon: z.string().optional().describe("view icon"),
    color: z.string().optional().describe("view color"),
    shared: z.boolean().optional().describe("make view shared"),
    delete: z.boolean().optional().describe("delete the view"),
  })
  .merge(outputOptions);

type ViewInput = z.infer<typeof viewInput>;

const viewColumns: TableColumn<CustomView>[] = [
  { header: "NAME", value: (v) => v.name, width: 25 },
  { header: "SHARED", value: (v) => (v.shared ? "yes" : "no"), width: 8 },
  { header: "UPDATED", value: (v) => formatDate(v.updatedAt), width: 12 },
];

const verboseViewColumns: TableColumn<CustomView>[] = [
  ...viewColumns,
  {
    header: "DESCRIPTION",
    value: (v) => truncate(v.description ?? "-", 30),
    width: 30,
  },
  { header: "ICON", value: (v) => v.icon ?? "-", width: 8 },
  { header: "COLOR", value: (v) => v.color ?? "-", width: 10 },
  { header: "ID", value: (v) => v.id, width: 36 },
];

type Operation = "create" | "read" | "update" | "delete";

function inferOperation(input: ViewInput): Operation {
  if (input.nameOrId === "new") return "create";
  if (input.delete) return "delete";
  if (
    input.name !== undefined ||
    input.description !== undefined ||
    input.icon !== undefined ||
    input.color !== undefined ||
    input.shared !== undefined
  )
    return "update";
  return "read";
}

async function handleListViews(
  input: z.infer<typeof listViewsInput>
): Promise<void> {
  try {
    const client = getClient();
    const views = await listViews(client);

    if (views.length === 0) {
      exitWithError("no custom views found");
    }

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    if (format === "json") {
      outputJson(views);
      return;
    }

    if (format === "quiet") {
      outputQuiet(views.map((v) => v.id));
      return;
    }

    const columns = input.verbose ? verboseViewColumns : viewColumns;
    outputTable(views, columns, outputOpts);
  } catch (error) {
    handleApiError(error);
  }
}

async function handleShowView(
  nameOrId: string,
  input: ViewInput
): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    const view = await getView(client, nameOrId);

    if (!view) {
      exitWithError(
        `view "${nameOrId}" not found`,
        "try: lnr views",
        EXIT_CODES.NOT_FOUND
      );
    }

    if (format === "json") {
      outputJson(view);
      return;
    }

    if (format === "quiet") {
      console.log(view.id);
      return;
    }

    console.log(`view: ${view.name}`);
    console.log(`  shared: ${view.shared ? "yes" : "no"}`);
    console.log(`  updated: ${formatDate(view.updatedAt)}`);
    if (view.description) {
      console.log(`  description: ${view.description}`);
    }
    if (view.icon) {
      console.log(`  icon: ${view.icon}`);
    }
    if (view.color) {
      console.log(`  color: ${view.color}`);
    }
  } catch (error) {
    handleApiError(error);
  }
}

async function handleCreateView(input: ViewInput): Promise<void> {
  if (!input.name) {
    exitWithError(
      "--name is required",
      'usage: lnr view new --name "My View"'
    );
  }

  try {
    const client = getClient();

    const view = await createView(client, {
      name: input.name,
      description: input.description,
      icon: input.icon,
      color: input.color,
      filterData: {},
      shared: input.shared,
    });

    if (view) {
      console.log(`created view: ${view.name}`);
    } else {
      exitWithError("failed to create view");
    }
  } catch (error) {
    handleApiError(error);
  }
}

async function handleUpdateView(
  nameOrId: string,
  input: ViewInput
): Promise<void> {
  try {
    const client = getClient();

    const view = await getView(client, nameOrId);

    if (!view) {
      exitWithError(
        `view "${nameOrId}" not found`,
        "try: lnr views",
        EXIT_CODES.NOT_FOUND
      );
    }

    const success = await updateView(client, view.id, {
      name: input.name,
      description: input.description,
      icon: input.icon,
      color: input.color,
      shared: input.shared,
    });

    if (!success) {
      exitWithError(
        `failed to update view "${nameOrId}"`,
        undefined,
        EXIT_CODES.NOT_FOUND
      );
    }

    console.log(`updated view: ${view.name}`);
  } catch (error) {
    handleApiError(error);
  }
}

async function handleDeleteView(
  nameOrId: string,
  input: ViewInput
): Promise<void> {
  try {
    const client = getClient();

    const view = await getView(client, nameOrId);

    if (!view) {
      exitWithError(
        `view "${nameOrId}" not found`,
        "try: lnr views",
        EXIT_CODES.NOT_FOUND
      );
    }

    const success = await deleteView(client, view.id);

    if (!success) {
      exitWithError(
        `failed to delete view "${nameOrId}"`,
        undefined,
        EXIT_CODES.NOT_FOUND
      );
    }

    console.log(`deleted view: ${view.name}`);
  } catch (error) {
    handleApiError(error);
  }
}

export const viewsRouter = router({
  views: procedure
    .meta({
      aliases: { command: ["v"] },
      description: "list custom views",
    })
    .input(listViewsInput)
    .query(async ({ input }) => {
      await handleListViews(input);
    }),

  view: procedure
    .meta({
      description: "show, create, update, or delete a custom view",
    })
    .input(viewInput)
    .mutation(async ({ input }) => {
      const operation = inferOperation(input);

      switch (operation) {
        case "create":
          await handleCreateView(input);
          break;
        case "delete":
          await handleDeleteView(input.nameOrId, input);
          break;
        case "update":
          await handleUpdateView(input.nameOrId, input);
          break;
        case "read":
        default:
          await handleShowView(input.nameOrId, input);
          break;
      }
    }),
});
