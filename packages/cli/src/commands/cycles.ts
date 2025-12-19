import type { Command } from "commander";
import {
  getClient,
  listCycles,
  getCurrentCycle,
  getCycleIssues,
} from "@bdsqqq/lnr-core";
import { handleApiError, exitWithError } from "../lib/error";
import {
  outputJson,
  outputQuiet,
  outputTable,
  getOutputFormat,
  formatDate,
  truncate,
  type OutputOptions,
} from "../lib/output";

interface CyclesOptions extends OutputOptions {
  team?: string;
  json?: boolean;
  quiet?: boolean;
}

interface CycleOptions extends OutputOptions {
  current?: boolean;
  team?: string;
  issues?: boolean;
  json?: boolean;
  quiet?: boolean;
}

export function registerCyclesCommand(program: Command): void {
  program
    .command("cycles")
    .description("list cycles for a team")
    .requiredOption("--team <key>", "team key (required)")
    .option("--json", "output as json")
    .option("--quiet", "output ids only")
    .option("--verbose", "show detailed output")
    .action(async (options: CyclesOptions) => {
      try {
        const client = getClient();
        const cycles = await listCycles(client, options.team!);

        if (cycles.length === 0) {
          exitWithError(`team "${options.team}" not found`);
        }

        const format = options.json ? "json" : options.quiet ? "quiet" : getOutputFormat(options);

        if (format === "json") {
          outputJson(cycles);
          return;
        }

        if (format === "quiet") {
          outputQuiet(cycles.map((c) => c.id));
          return;
        }

        outputTable(cycles, [
          { header: "#", value: (c) => String(c.number), width: 4 },
          { header: "NAME", value: (c) => c.name ?? `Cycle ${c.number}`, width: 20 },
          { header: "START", value: (c) => formatDate(c.startsAt), width: 12 },
          { header: "END", value: (c) => formatDate(c.endsAt), width: 12 },
        ], options);
      } catch (error) {
        handleApiError(error);
      }
    });

  program
    .command("cycle")
    .description("show cycle details")
    .option("--current", "show current active cycle")
    .requiredOption("--team <key>", "team key (required)")
    .option("--issues", "list issues in the cycle")
    .option("--json", "output as json")
    .option("--quiet", "output ids only")
    .option("--verbose", "show detailed output")
    .action(async (options: CycleOptions) => {
      if (!options.current) {
        exitWithError("cycle identifier required", "use --current to show active cycle");
      }

      try {
        const client = getClient();
        const cycle = await getCurrentCycle(client, options.team!);

        if (!cycle) {
          exitWithError("no active cycle", `team "${options.team}" has no current cycle`);
        }

        const format = options.json ? "json" : options.quiet ? "quiet" : getOutputFormat(options);

        if (options.issues) {
          const issues = await getCycleIssues(client, options.team!);

          if (format === "json") {
            outputJson(issues);
            return;
          }

          if (format === "quiet") {
            outputQuiet(issues.map((i) => i.identifier));
            return;
          }

          outputTable(issues, [
            { header: "ID", value: (i) => i.identifier, width: 10 },
            { header: "TITLE", value: (i) => truncate(i.title, 50), width: 50 },
          ], options);
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
      } catch (error) {
        handleApiError(error);
      }
    });
}
