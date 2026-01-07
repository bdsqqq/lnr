import { z } from "zod";
import {
  getClient,
  listCycles,
  getCurrentCycle,
  getCycleIssues,
} from "@bdsqqq/lnr-core";
import { router, procedure } from "./trpc";
import { exitWithError } from "../lib/error";
import {
  outputJson,
  outputQuiet,
  outputTable,
  getOutputFormat,
  formatDate,
  truncate,
} from "../lib/output";

const outputOptions = z.object({
  json: z.boolean().optional(),
  quiet: z.boolean().optional(),
  verbose: z.boolean().optional(),
});

const cyclesInput = z.object({
  team: z.string(),
}).merge(outputOptions);

const cycleInput = z.object({
  team: z.string(),
  current: z.boolean().optional(),
  issues: z.boolean().optional(),
}).merge(outputOptions);

export const cyclesRouter = router({
  cycles: procedure
    .meta({
      description: "list cycles for a team",
    })
    .input(cyclesInput)
    .query(async ({ input }) => {
      const client = getClient();
      const cycles = await listCycles(client, input.team);

      if (cycles.length === 0) {
        exitWithError(`team "${input.team}" not found`);
      }

      const format = input.json ? "json" : input.quiet ? "quiet" : getOutputFormat(input);

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
      ], input);
    }),

  cycle: procedure
    .meta({
      description: "show cycle details",
    })
    .input(cycleInput)
    .query(async ({ input }) => {
      if (!input.current) {
        exitWithError("cycle identifier required", "use --current to show active cycle");
      }

      const client = getClient();
      const cycle = await getCurrentCycle(client, input.team);

      if (!cycle) {
        exitWithError("no active cycle", `team "${input.team}" has no current cycle`);
      }

      const format = input.json ? "json" : input.quiet ? "quiet" : getOutputFormat(input);

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

        outputTable(issues, [
          { header: "ID", value: (i) => i.identifier, width: 10 },
          { header: "TITLE", value: (i) => truncate(i.title, 50), width: 50 },
        ], input);
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
    }),
});
