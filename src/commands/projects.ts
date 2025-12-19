import type { Command } from "commander";
import { getClient } from "../lib/client";
import { handleApiError, exitWithError, EXIT_CODES } from "../lib/error";
import {
  outputJson,
  outputQuiet,
  outputTable,
  getOutputFormat,
  formatDate,
  truncate,
  type OutputOptions,
} from "../lib/output";

interface CreateProjectOptions {
  name?: string;
  team?: string;
  description?: string;
}

async function createProject(options: CreateProjectOptions): Promise<void> {
  const client = getClient();

  if (!options.name) {
    exitWithError("--name is required", "usage: li project new --name \"...\"");
  }

  try {
    const teams = await client.teams();
    let teamId: string | undefined;

    if (options.team) {
      const team = teams.nodes.find(
        (t) => t.key.toLowerCase() === options.team!.toLowerCase() || t.name.toLowerCase() === options.team!.toLowerCase()
      );
      if (!team) {
        const available = teams.nodes.map((t) => t.key).join(", ");
        exitWithError(`team "${options.team}" not found`, `available teams: ${available}`, EXIT_CODES.NOT_FOUND);
      }
      teamId = team.id;
    }

    const createPayload: {
      name: string;
      description?: string;
      teamIds: string[];
    } = {
      name: options.name,
      teamIds: teamId ? [teamId] : [],
    };

    if (options.description) {
      createPayload.description = options.description;
    }

    const result = await client.createProject(createPayload);
    if (result.success) {
      const projectData = await result.project;
      if (projectData) {
        console.log(`created project: ${projectData.name}`);
        return;
      }
      console.log("created project");
    }
  } catch (error) {
    handleApiError(error);
  }
}

async function deleteProject(name: string): Promise<void> {
  const client = getClient();

  try {
    const projects = await client.projects();
    const project = projects.nodes.find(
      (p) => p.name.toLowerCase() === name.toLowerCase() || p.id === name
    );

    if (!project) {
      exitWithError(`project "${name}" not found`, undefined, EXIT_CODES.NOT_FOUND);
    }

    await client.deleteProject(project.id);
    console.log(`deleted project: ${project.name}`);
  } catch (error) {
    handleApiError(error);
  }
}

export function registerProjectsCommand(program: Command): void {
  program
    .command("projects")
    .description("list projects")
    .option("--team <team>", "filter by team")
    .option("--status <status>", "filter by status (active, completed, canceled, paused)")
    .option("--json", "output as json")
    .option("--quiet", "output ids only")
    .option("--verbose", "show detailed output")
    .action(async (options: { team?: string; status?: string; json?: boolean; quiet?: boolean; verbose?: boolean }) => {
      try {
        const client = getClient();
        
        const outputOpts: OutputOptions = {
          format: options.json ? "json" : options.quiet ? "quiet" : undefined,
          verbose: options.verbose,
        };
        const format = getOutputFormat(outputOpts);

        let projects = await client.projects();

        if (options.team) {
          const teams = await client.teams();
          const team = teams.nodes.find(
            (t) => t.key.toLowerCase() === options.team!.toLowerCase() || t.name.toLowerCase() === options.team!.toLowerCase()
          );
          if (!team) {
            const available = teams.nodes.map((t) => t.key).join(", ");
            exitWithError(`team "${options.team}" not found`, `available teams: ${available}`, EXIT_CODES.NOT_FOUND);
          }
          projects = await team.projects();
        }

        if (options.status) {
          const statusLower = options.status.toLowerCase();
          projects.nodes = projects.nodes.filter((p) => {
            const state = p.state?.toLowerCase() ?? "";
            return state === statusLower || state.includes(statusLower);
          });
        }

        if (format === "json") {
          outputJson(
            projects.nodes.map((p) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              state: p.state,
              progress: p.progress,
              targetDate: p.targetDate,
              createdAt: p.createdAt,
            }))
          );
          return;
        }

        if (format === "quiet") {
          outputQuiet(projects.nodes.map((p) => p.id));
          return;
        }

        outputTable(projects.nodes, [
          { header: "NAME", value: (p) => truncate(p.name, 30), width: 30 },
          { header: "STATE", value: (p) => p.state ?? "-", width: 12 },
          { header: "PROGRESS", value: (p) => `${Math.round((p.progress ?? 0) * 100)}%`, width: 10 },
          { header: "TARGET", value: (p) => formatDate(p.targetDate), width: 12 },
        ], outputOpts);
      } catch (error) {
        handleApiError(error);
      }
    });

  program
    .command("project <name>")
    .description("show project details, create with 'new', or delete with --delete")
    .option("--issues", "list issues in project")
    .option("--json", "output as json")
    .option("--quiet", "output ids only")
    .option("--verbose", "show detailed output")
    .option("--delete", "delete/archive the project")
    .option("--name <name>", "name for new project")
    .option("--team <team>", "team for new project")
    .option("--description <description>", "description for new project")
    .action(async (name: string, options: { issues?: boolean; json?: boolean; quiet?: boolean; verbose?: boolean; delete?: boolean; name?: string; team?: string; description?: string }) => {
      if (name === "new") {
        await createProject(options);
        return;
      }

      if (options.delete) {
        await deleteProject(name);
        return;
      }

      try {
        const client = getClient();

        const outputOpts: OutputOptions = {
          format: options.json ? "json" : options.quiet ? "quiet" : undefined,
          verbose: options.verbose,
        };
        const format = getOutputFormat(outputOpts);

        const projects = await client.projects();
        const project = projects.nodes.find(
          (p) => p.name.toLowerCase() === name.toLowerCase() || p.id === name
        );

        if (!project) {
          exitWithError(`project "${name}" not found`, undefined, EXIT_CODES.NOT_FOUND);
        }

        if (options.issues) {
          const issues = await project.issues();

          if (format === "json") {
            outputJson(
              issues.nodes.map((i) => ({
                id: i.id,
                identifier: i.identifier,
                title: i.title,
                priority: i.priority,
                createdAt: i.createdAt,
              }))
            );
            return;
          }

          if (format === "quiet") {
            outputQuiet(issues.nodes.map((i) => i.identifier));
            return;
          }

          outputTable(issues.nodes, [
            { header: "ID", value: (i) => i.identifier, width: 12 },
            { header: "TITLE", value: (i) => truncate(i.title, 50), width: 50 },
            { header: "CREATED", value: (i) => formatDate(i.createdAt), width: 12 },
          ], outputOpts);
          return;
        }

        if (format === "json") {
          outputJson({
            id: project.id,
            name: project.name,
            description: project.description,
            state: project.state,
            progress: project.progress,
            targetDate: project.targetDate,
            startDate: project.startDate,
            createdAt: project.createdAt,
          });
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
    });

  program
    .command("p")
    .description("alias for projects")
    .option("--team <team>", "filter by team")
    .option("--status <status>", "filter by status")
    .option("--json", "output as json")
    .option("--quiet", "output ids only")
    .option("--verbose", "show detailed output")
    .action(async (options: { team?: string; status?: string; json?: boolean; quiet?: boolean; verbose?: boolean }) => {
      await program.commands.find((c) => c.name() === "projects")?.parseAsync(["projects", ...process.argv.slice(3)], { from: "user" });
    });
}
