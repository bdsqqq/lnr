import type { OperationSpec } from "../lib/operation-spec";
import "../lib/arktype-config";
import { type } from "arktype";
import {
  getClient,
  listViews,
  getView,
  createView,
  updateView,
  deleteView,
  getViewPreferences,
  type CustomView,
  type ViewPreferencesResult,
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

export const listViewsInput = type({
  "json?": type("boolean").describe("output as json"),
  "quiet?": type("boolean").describe("output ids only"),
  "verbose?": type("boolean").describe("show all columns"),
});

export const viewInput = type({
  nameOrId: type("string").configure({ positional: true }).describe("view name, id, or 'new'"),
  "name?": type("string").describe("view name"),
  "description?": type("string").describe("view description"),
  "icon?": type("string").describe("view icon"),
  "color?": type("string").describe("view color"),
  "shared?": type("boolean").describe("make view shared"),
  "delete?": type("boolean").describe("delete the view"),
  "preferences?": type("boolean").describe("show view preferences"),
  "json?": type("boolean").describe("output as json"),
  "quiet?": type("boolean").describe("output ids only"),
  "verbose?": type("boolean").describe("show all columns"),
});

type ViewInput = typeof viewInput.infer;

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

export const viewOperations = ["create", "read", "update", "delete", "preferences"] as const;
type Operation = (typeof viewOperations)[number];

export const viewMutationFlags: readonly (keyof ViewInput)[] = [
  "name", "description", "icon", "color", "shared"
] as const;

export function inferOperation(input: ViewInput): Operation {
  if (input.nameOrId === "new") return "create";
  if (input.delete) return "delete";
  if (input.preferences) return "preferences";

  for (const flag of viewMutationFlags) {
    if (input[flag] !== undefined) return "update";
  }

  return "read";
}

export const viewOperationSpec: OperationSpec<ViewInput, Operation> = {
  command: "view",
  operations: viewOperations,
  mutationFlags: viewMutationFlags,
  inferOperation,
};

async function handleListViews(
  input: typeof listViewsInput.infer
): Promise<void> {
  try {
    const client = getClient();
    const views = await listViews(client);

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

async function handleShowPreferences(
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

    const prefs = await getViewPreferences(client, view.id);

    if (!prefs) {
      exitWithError(`no preferences found for view "${nameOrId}"`);
    }

    if (format === "json") {
      outputJson(prefs);
      return;
    }

    if (format === "quiet") {
      const ids: string[] = [];
      if (prefs.user) ids.push(prefs.user.id);
      if (prefs.organization) ids.push(prefs.organization.id);
      outputQuiet(ids);
      return;
    }

    console.log(`preferences for view: ${view.name}`);
    console.log();

    console.log("effective preferences:");
    console.log(`  grouping: ${prefs.effective.issueGrouping ?? "-"}`);
    console.log(`  ordering: ${prefs.effective.viewOrdering ?? "-"}`);
    console.log(
      `  show completed: ${prefs.effective.showCompletedIssues ?? "-"}`
    );

    if (input.verbose) {
      if (prefs.user) {
        console.log();
        console.log("user preferences:");
        console.log(`  id: ${prefs.user.id}`);
        console.log(`  type: ${prefs.user.type}`);
        console.log(`  grouping: ${prefs.user.preferences.issueGrouping ?? "-"}`);
        console.log(`  ordering: ${prefs.user.preferences.viewOrdering ?? "-"}`);
        console.log(
          `  show completed: ${prefs.user.preferences.showCompletedIssues ?? "-"}`
        );
      }
      if (prefs.organization) {
        console.log();
        console.log("organization preferences:");
        console.log(`  id: ${prefs.organization.id}`);
        console.log(`  type: ${prefs.organization.type}`);
        console.log(
          `  grouping: ${prefs.organization.preferences.issueGrouping ?? "-"}`
        );
        console.log(
          `  ordering: ${prefs.organization.preferences.viewOrdering ?? "-"}`
        );
        console.log(
          `  show completed: ${prefs.organization.preferences.showCompletedIssues ?? "-"}`
        );
      }
    }
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
        case "preferences":
          await handleShowPreferences(input.nameOrId, input);
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
