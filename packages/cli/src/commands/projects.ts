import type { Command } from "commander";
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

async function handleCreateProject(options: CreateProjectOptions): Promise<void> {
  if (!options.name) {
    exitWithError("--name is required", "usage: li project new --name \"...\"");
  }

  try {
    const client = getClient();
    let teamIds: string[] = [];

    if (options.team) {
      const team = await findTeamByKeyOrName(client, options.team);
      if (!team) {
        const available = (await getAvailableTeamKeys(client)).join(", ");
        exitWithError(`team "${options.team}" not found`, `available teams: ${available}`, EXIT_CODES.NOT_FOUND);
      }
      teamIds = [team.id];
    }

    const project = await createProject(client, {
      name: options.name,
      description: options.description,
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
}

async function handleDeleteProject(name: string): Promise<void> {
  try {
    const client = getClient();
    const success = await deleteProject(client, name);

    if (!success) {
      exitWithError(`project "${name}" not found`, undefined, EXIT_CODES.NOT_FOUND);
    }

    console.log(`deleted project: ${name}`);
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

        const projects = await listProjects(client, { team: options.team, status: options.status });

        if (format === "json") {
          outputJson(projects);
          return;
        }

        if (format === "quiet") {
          outputQuiet(projects.map((p) => p.id));
          return;
        }

        outputTable(projects, [
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
        await handleCreateProject(options);
        return;
      }

      if (options.delete) {
        await handleDeleteProject(name);
        return;
      }

      try {
        const client = getClient();

        const outputOpts: OutputOptions = {
          format: options.json ? "json" : options.quiet ? "quiet" : undefined,
          verbose: options.verbose,
        };
        const format = getOutputFormat(outputOpts);

        const project = await getProject(client, name);

        if (!project) {
          exitWithError(`project "${name}" not found`, undefined, EXIT_CODES.NOT_FOUND);
        }

        if (options.issues) {
          const issues = await getProjectIssues(client, name);

          if (format === "json") {
            outputJson(issues);
            return;
          }

          if (format === "quiet") {
            outputQuiet(issues.map((i) => i.identifier));
            return;
          }

          outputTable(issues, [
            { header: "ID", value: (i) => i.identifier, width: 12 },
            { header: "TITLE", value: (i) => truncate(i.title, 50), width: 50 },
            { header: "CREATED", value: (i) => formatDate(i.createdAt), width: 12 },
          ], outputOpts);
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
