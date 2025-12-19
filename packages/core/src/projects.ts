import type { LinearClient } from "@linear/sdk";
import type { Issue, Project, CreateProjectInput } from "./types";

export async function listProjects(
  client: LinearClient,
  options: { team?: string; status?: string } = {}
): Promise<Project[]> {
  let projectsConnection = await client.projects();

  if (options.team) {
    const teams = await client.teams();
    const team = teams.nodes.find(
      (t) =>
        t.key.toLowerCase() === options.team!.toLowerCase() ||
        t.name.toLowerCase() === options.team!.toLowerCase()
    );
    if (!team) {
      return [];
    }
    projectsConnection = await team.projects();
  }

  let nodes = projectsConnection.nodes;

  if (options.status) {
    const statusLower = options.status.toLowerCase();
    nodes = nodes.filter((p) => {
      const state = p.state?.toLowerCase() ?? "";
      return state === statusLower || state.includes(statusLower);
    });
  }

  return nodes.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    state: p.state,
    progress: p.progress,
    targetDate: p.targetDate,
    startDate: p.startDate,
    createdAt: p.createdAt,
  }));
}

export async function getProject(
  client: LinearClient,
  nameOrId: string
): Promise<Project | null> {
  const projects = await client.projects();
  const project = projects.nodes.find(
    (p) => p.name.toLowerCase() === nameOrId.toLowerCase() || p.id === nameOrId
  );

  if (!project) {
    return null;
  }

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    state: project.state,
    progress: project.progress,
    targetDate: project.targetDate,
    startDate: project.startDate,
    createdAt: project.createdAt,
  };
}

export async function getProjectIssues(
  client: LinearClient,
  nameOrId: string
): Promise<Issue[]> {
  const projects = await client.projects();
  const project = projects.nodes.find(
    (p) => p.name.toLowerCase() === nameOrId.toLowerCase() || p.id === nameOrId
  );

  if (!project) {
    return [];
  }

  const issues = await project.issues();

  return Promise.all(
    issues.nodes.map(async (i) => ({
      id: i.id,
      identifier: i.identifier,
      title: i.title,
      description: i.description,
      state: (await i.state)?.name ?? null,
      assignee: (await i.assignee)?.name ?? null,
      priority: i.priority,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
      url: i.url,
    }))
  );
}

export async function createProject(
  client: LinearClient,
  input: CreateProjectInput
): Promise<Project | null> {
  const result = await client.createProject({
    name: input.name,
    description: input.description,
    teamIds: input.teamIds ?? [],
  });

  if (!result.success) {
    return null;
  }

  const projectData = await result.project;
  if (!projectData) {
    return null;
  }

  return {
    id: projectData.id,
    name: projectData.name,
    description: projectData.description,
    state: projectData.state,
    progress: projectData.progress,
    targetDate: projectData.targetDate,
    startDate: projectData.startDate,
    createdAt: projectData.createdAt,
  };
}

export async function deleteProject(
  client: LinearClient,
  nameOrId: string
): Promise<boolean> {
  const projects = await client.projects();
  const project = projects.nodes.find(
    (p) => p.name.toLowerCase() === nameOrId.toLowerCase() || p.id === nameOrId
  );

  if (!project) {
    return false;
  }

  const result = await client.deleteProject(project.id);
  return result.success;
}
