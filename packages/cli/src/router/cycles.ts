import "../lib/arktype-config";
import { type } from "arktype";
import {
  getClient,
  listCycles,
  getCycle,
  getCurrentCycle,
  getCycleIssues,
  createCycle,
  updateCycle,
  deleteCycle,
  findTeamByKeyOrName,
  type Cycle,
} from "@bdsqqq/lnr-core";
import type { OperationSpec } from "../lib/operation-spec";
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

const outputOptions = type({
  "json?": type("boolean").describe("output as json"),
  "quiet?": type("boolean").describe("output ids only"),
  "verbose?": type("boolean").describe("show all columns"),
});

export const listCyclesInput = type({
  team: type("string").describe("team key"),
  "json?": type("boolean").describe("output as json"),
  "quiet?": type("boolean").describe("output ids only"),
  "verbose?": type("boolean").describe("show all columns"),
});

export const cycleInput = type({
  nameOrNumber: type("string").configure({ positional: true }).describe("cycle name, number, or 'new'"),
  team: type("string").describe("team key"),
  "name?": type("string").describe("cycle name"),
  "description?": type("string").describe("cycle description"),
  "startsAt?": type("string").describe("start date (ISO format)"),
  "endsAt?": type("string").describe("end date (ISO format)"),
  "current?": type("boolean").describe("show current active cycle"),
  "issues?": type("boolean").describe("list issues in cycle"),
  "delete?": type("boolean").describe("archive the cycle"),
  "json?": type("boolean").describe("output as json"),
  "quiet?": type("boolean").describe("output ids only"),
  "verbose?": type("boolean").describe("show all columns"),
});

type CycleInput = typeof cycleInput.infer;

const cycleColumns: TableColumn<Cycle>[] = [
  { header: "#", value: (c) => String(c.number), width: 4 },
  { header: "NAME", value: (c) => c.name ?? `Cycle ${c.number}`, width: 20 },
  { header: "START", value: (c) => formatDate(c.startsAt), width: 12 },
  { header: "END", value: (c) => formatDate(c.endsAt), width: 12 },
];

const verboseCycleColumns: TableColumn<Cycle>[] = [
  ...cycleColumns,
  {
    header: "PROGRESS",
    value: (c) => (c.progress != null ? `${Math.round(c.progress * 100)}%` : "-"),
    width: 10,
  },
  {
    header: "DESCRIPTION",
    value: (c) => truncate(c.description ?? "-", 30),
    width: 30,
  },
  { header: "ID", value: (c) => c.id, width: 36 },
];

export const cycleOperations = ["create", "read", "update", "delete", "current"] as const;
type Operation = (typeof cycleOperations)[number];

export const cycleMutationFlags: readonly (keyof CycleInput)[] = [
  "name", "description", "startsAt", "endsAt"
] as const;

export function inferOperation(input: CycleInput): Operation {
  if (input.current) return "current";
  if (input.nameOrNumber === "new") return "create";
  if (input.delete) return "delete";

  for (const flag of cycleMutationFlags) {
    if (input[flag] !== undefined) return "update";
  }

  return "read";
}

export const cycleOperationSpec: OperationSpec<CycleInput, Operation> = {
  command: "cycle",
  operations: cycleOperations,
  mutationFlags: cycleMutationFlags,
  inferOperation,
};

async function handleListCycles(
  input: typeof listCyclesInput.infer
): Promise<void> {
  try {
    const client = getClient();
    const cycles = await listCycles(client, input.team);

    if (cycles.length === 0) {
      exitWithError(`no cycles found for team "${input.team}"`);
    }

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    if (format === "json") {
      outputJson(cycles);
      return;
    }

    if (format === "quiet") {
      outputQuiet(cycles.map((c) => c.id));
      return;
    }

    const columns = input.verbose ? verboseCycleColumns : cycleColumns;
    outputTable(cycles, columns, outputOpts);
  } catch (error) {
    handleApiError(error);
  }
}

async function handleShowCycle(
  nameOrNumber: string,
  input: CycleInput
): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    const cycle = await getCycle(client, input.team, nameOrNumber);

    if (!cycle) {
      exitWithError(
        `cycle "${nameOrNumber}" not found`,
        `try: lnr cycles --team ${input.team}`,
        EXIT_CODES.NOT_FOUND
      );
    }

    if (input.issues) {
      const issues = await getCycleIssues(client, input.team);

      if (format === "json") {
        outputJson(issues);
        return;
      }

      if (format === "quiet") {
        outputQuiet(issues.map((i) => i.identifier));
        return;
      }

      outputTable(
        issues,
        [
          { header: "ID", value: (i) => i.identifier, width: 10 },
          { header: "TITLE", value: (i) => truncate(i.title, 50), width: 50 },
        ],
        outputOpts
      );
      return;
    }

    if (format === "json") {
      outputJson(cycle);
      return;
    }

    if (format === "quiet") {
      console.log(cycle.id);
      return;
    }

    console.log(`cycle ${cycle.number}: ${cycle.name ?? `Cycle ${cycle.number}`}`);
    console.log(`  start: ${formatDate(cycle.startsAt)}`);
    console.log(`  end:   ${formatDate(cycle.endsAt)}`);
    if (cycle.progress != null) {
      console.log(`  progress: ${Math.round(cycle.progress * 100)}%`);
    }
    if (cycle.description) {
      console.log(`  description: ${cycle.description}`);
    }
  } catch (error) {
    handleApiError(error);
  }
}

async function handleCurrentCycle(input: CycleInput): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    const cycle = await getCurrentCycle(client, input.team);

    if (!cycle) {
      exitWithError("no active cycle", `team "${input.team}" has no current cycle`);
    }

    if (input.issues) {
      const issues = await getCycleIssues(client, input.team);

      if (format === "json") {
        outputJson(issues);
        return;
      }

      if (format === "quiet") {
        outputQuiet(issues.map((i) => i.identifier));
        return;
      }

      outputTable(
        issues,
        [
          { header: "ID", value: (i) => i.identifier, width: 10 },
          { header: "TITLE", value: (i) => truncate(i.title, 50), width: 50 },
        ],
        outputOpts
      );
      return;
    }

    if (format === "json") {
      outputJson(cycle);
      return;
    }

    if (format === "quiet") {
      console.log(cycle.id);
      return;
    }

    console.log(`cycle ${cycle.number}: ${cycle.name ?? `Cycle ${cycle.number}`}`);
    console.log(`  start: ${formatDate(cycle.startsAt)}`);
    console.log(`  end:   ${formatDate(cycle.endsAt)}`);
    if (cycle.progress != null) {
      console.log(`  progress: ${Math.round(cycle.progress * 100)}%`);
    }
  } catch (error) {
    handleApiError(error);
  }
}

async function handleCreateCycle(input: CycleInput): Promise<void> {
  if (!input.startsAt || !input.endsAt) {
    exitWithError(
      "--starts-at and --ends-at are required",
      'usage: lnr cycle new --team ENG --starts-at "2026-02-01" --ends-at "2026-02-14"'
    );
  }

  try {
    const client = getClient();

    const team = await findTeamByKeyOrName(client, input.team);
    if (!team) {
      exitWithError(`team "${input.team}" not found`);
    }

    const cycle = await createCycle(client, {
      teamId: team.id,
      name: input.name,
      description: input.description,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });

    if (cycle) {
      console.log(
        `created cycle ${cycle.number}: ${cycle.name ?? `Cycle ${cycle.number}`}`
      );
    } else {
      exitWithError("failed to create cycle");
    }
  } catch (error) {
    handleApiError(error);
  }
}

async function handleUpdateCycle(
  nameOrNumber: string,
  input: CycleInput
): Promise<void> {
  try {
    const client = getClient();

    const cycle = await getCycle(client, input.team, nameOrNumber);

    if (!cycle) {
      exitWithError(
        `cycle "${nameOrNumber}" not found`,
        `try: lnr cycles --team ${input.team}`,
        EXIT_CODES.NOT_FOUND
      );
    }

    const success = await updateCycle(client, cycle.id, {
      name: input.name,
      description: input.description,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });

    if (!success) {
      exitWithError(
        `failed to update cycle "${nameOrNumber}"`,
        undefined,
        EXIT_CODES.NOT_FOUND
      );
    }

    console.log(`updated cycle: ${cycle.name ?? `Cycle ${cycle.number}`}`);
  } catch (error) {
    handleApiError(error);
  }
}

async function handleDeleteCycle(
  nameOrNumber: string,
  input: CycleInput
): Promise<void> {
  try {
    const client = getClient();

    const cycle = await getCycle(client, input.team, nameOrNumber);

    if (!cycle) {
      exitWithError(
        `cycle "${nameOrNumber}" not found`,
        `try: lnr cycles --team ${input.team}`,
        EXIT_CODES.NOT_FOUND
      );
    }

    const success = await deleteCycle(client, cycle.id);

    if (!success) {
      exitWithError(
        `failed to archive cycle "${nameOrNumber}"`,
        undefined,
        EXIT_CODES.NOT_FOUND
      );
    }

    console.log(`archived cycle: ${cycle.name ?? `Cycle ${cycle.number}`}`);
  } catch (error) {
    handleApiError(error);
  }
}

export const cyclesRouter = router({
  cycles: procedure
    .meta({
      aliases: { command: ["c"] },
      description: "list cycles for a team",
    })
    .input(listCyclesInput)
    .query(async ({ input }) => {
      await handleListCycles(input);
    }),

  cycle: procedure
    .meta({
      description: "show, create, update, or archive a cycle",
    })
    .input(cycleInput)
    .mutation(async ({ input }) => {
      const operation = inferOperation(input);

      switch (operation) {
        case "current":
          await handleCurrentCycle(input);
          break;
        case "create":
          await handleCreateCycle(input);
          break;
        case "delete":
          await handleDeleteCycle(input.nameOrNumber, input);
          break;
        case "update":
          await handleUpdateCycle(input.nameOrNumber, input);
          break;
        case "read":
        default:
          await handleShowCycle(input.nameOrNumber, input);
          break;
      }
    }),
});
