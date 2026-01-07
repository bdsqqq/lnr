import { z } from "zod";
import {
  getClient,
  listProjects,
  getProject,
  getProjectIssues,
  createProject,
  deleteProject,
  findTeamByKeyOrName,
  getAvailableTeamKeys,
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
} from "../lib/output";

const listProjectsInput = z.object({
  team: z.string().optional(),
  status: z.string().optional(),
  json: z.boolean().optional(),
  quiet: z.boolean().optional(),
  verbose: z.boolean().optional(),
});

const projectInput = z.object({
  name: z.string().meta({ positional: true }),
  issues: z.boolean().optional(),
  json: z.boolean().optional(),
  quiet: z.boolean().optional(),
  verbose: z.boolean().optional(),
  delete: z.boolean().optional(),
  projectName: z.string().optional(),
  team: z.string().optional(),
  description: z.string().optional(),
});

export const projectsRouter = router({
  projects: procedure
    .meta({
      aliases: { command: ["p"] },
      description: "list projects",
    })
    .input(listProjectsInput)
    .query(async ({ input }) => {
      try {
        const client = getClient();

        const outputOpts: OutputOptions = {
          format: input.json ? "json" : input.quiet ? "quiet" : undefined,
          verbose: input.verbose,
        };
        const format = getOutputFormat(outputOpts);

        const projects = await listProjects(client, {
          team: input.team,
          status: input.status,
        });

        if (format === "json") {
          outputJson(projects);
          return;
        }

        if (format === "quiet") {
          outputQuiet(projects.map((p) => p.id));
          return;
        }

        outputTable(
          projects,
          [
            { header: "NAME", value: (p) => truncate(p.name, 30), width: 30 },
            { header: "STATE", value: (p) => p.state ?? "-", width: 12 },
            {
              header: "PROGRESS",
              value: (p) => `${Math.round((p.progress ?? 0) * 100)}%`,
              width: 10,
            },
            { header: "TARGET", value: (p) => formatDate(p.targetDate), width: 12 },
          ],
          outputOpts
        );
      } catch (error) {
        handleApiError(error);
      }
    }),

  project: procedure
    .meta({
      description: "show project details, create with 'new', or delete with --delete",
    })
    .input(projectInput)
    .query(async ({ input }) => {
      if (input.name === "new") {
        if (!input.projectName) {
          exitWithError("--projectName is required", "usage: lnr project new --projectName \"...\"");
        }

        try {
          const client = getClient();
          let teamIds: string[] = [];

          if (input.team) {
            const team = await findTeamByKeyOrName(client, input.team);
            if (!team) {
              const available = (await getAvailableTeamKeys(client)).join(", ");
              exitWithError(
                `team "${input.team}" not found`,
                `available teams: ${available}`,
                EXIT_CODES.NOT_FOUND
              );
            }
            teamIds = [team.id];
          }

          const project = await createProject(client, {
            name: input.projectName,
            description: input.description,
            teamIds,
          });

          if (project) {
            console.log(`created project: ${project.name}`);
          } else {
            console.log("created project");
          }
        } catch (error) {
          handleApiError(error);
        }
        return;
      }

      if (input.delete) {
        try {
          const client = getClient();
          const success = await deleteProject(client, input.name);

          if (!success) {
            exitWithError(`project "${input.name}" not found`, undefined, EXIT_CODES.NOT_FOUND);
          }

          console.log(`deleted project: ${input.name}`);
        } catch (error) {
          handleApiError(error);
        }
        return;
      }

      try {
        const client = getClient();

        const outputOpts: OutputOptions = {
          format: input.json ? "json" : input.quiet ? "quiet" : undefined,
          verbose: input.verbose,
        };
        const format = getOutputFormat(outputOpts);

        const project = await getProject(client, input.name);

        if (!project) {
          exitWithError(`project "${input.name}" not found`, undefined, EXIT_CODES.NOT_FOUND);
        }

        if (input.issues) {
          const issues = await getProjectIssues(client, input.name);

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
              { header: "ID", value: (i) => i.identifier, width: 12 },
              { header: "TITLE", value: (i) => truncate(i.title, 50), width: 50 },
              { header: "CREATED", value: (i) => formatDate(i.createdAt), width: 12 },
            ],
            outputOpts
          );
          return;
        }

        if (format === "json") {
          outputJson(project);
          return;
        }

        if (format === "quiet") {
          console.log(project.id);
          return;
        }

        console.log(`${project.name}`);
        if (project.description) {
          console.log(`  ${truncate(project.description, 80)}`);
        }
        console.log();
        console.log(`state:    ${project.state ?? "-"}`);
        console.log(`progress: ${Math.round((project.progress ?? 0) * 100)}%`);
        console.log(`target:   ${formatDate(project.targetDate)}`);
        console.log(`started:  ${formatDate(project.startDate)}`);
        console.log(`created:  ${formatDate(project.createdAt)}`);
      } catch (error) {
        handleApiError(error);
      }
    }),
});
