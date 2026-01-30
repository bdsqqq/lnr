import type { LinearClient } from "@linear/sdk";
import { getTeamStates } from "./issues";
import { getViewer } from "./me";
import { findTeamByKeyOrName } from "./teams";
import { listProjects } from "./projects";
import { listCycles } from "./cycles";
import { listMilestones } from "./milestones";

export class IssueNotFoundError extends Error {
  constructor(identifier: string) {
    super(`issue not found: ${identifier}`);
    this.name = "IssueNotFoundError";
  }
}

export class StateNotFoundError extends Error {
  constructor(stateName: string, availableStates: string[]) {
    const stateList = availableStates.length > 0
      ? availableStates.join(", ")
      : "none";
    super(`state not found: "${stateName}". available states: ${stateList}`);
    this.name = "StateNotFoundError";
  }
}

export async function resolveIssueIdentifier(
  client: LinearClient,
  identifier: string
): Promise<string> {
  try {
    const issue = await client.issue(identifier);

    if (!issue) {
      throw new IssueNotFoundError(identifier);
    }

    return issue.id;
  } catch (error) {
    if (error instanceof IssueNotFoundError) {
      throw error;
    }
    throw new IssueNotFoundError(identifier);
  }
}

export async function resolveStateName(
  client: LinearClient,
  teamId: string,
  stateName: string
): Promise<string> {
  const states = await getTeamStates(client, teamId);
  const normalizedInput = stateName.toLowerCase();

  const match = states.find(
    (s) => s.name.toLowerCase() === normalizedInput
  );

  if (!match) {
    throw new StateNotFoundError(
      stateName,
      states.map((s) => s.name)
    );
  }

  return match.id;
}

export class AssigneeNotFoundError extends Error {
  constructor(assignee: string) {
    super(`assignee not found: "${assignee}". use @me or a valid email address`);
    this.name = "AssigneeNotFoundError";
  }
}

export async function resolveAssignee(
  client: LinearClient,
  assignee: string
): Promise<string> {
  if (assignee === "@me") {
    const viewer = await getViewer(client);
    return viewer.id;
  }

  const usersConnection = await client.users({
    filter: { email: { eq: assignee.toLowerCase() } },
  });

  const user = usersConnection.nodes[0];

  if (!user) {
    throw new AssigneeNotFoundError(assignee);
  }

  return user.id;
}

// === team resolver ===

export class TeamNotFoundError extends Error {
  constructor(key: string, availableTeams: string[]) {
    const teamList = availableTeams.length > 0
      ? availableTeams.join(", ")
      : "none";
    super(`team not found: "${key}". available teams: ${teamList}`);
    this.name = "TeamNotFoundError";
  }
}

export async function resolveTeamByKey(
  client: LinearClient,
  key: string
): Promise<string> {
  const team = await findTeamByKeyOrName(client, key);

  if (!team) {
    const teams = await client.teams();
    const available = teams.nodes.map((t) => t.key);
    throw new TeamNotFoundError(key, available);
  }

  return team.id;
}

// === project resolver ===

export class ProjectNotFoundError extends Error {
  constructor(name: string, availableProjects: string[]) {
    const projectList = availableProjects.length > 0
      ? availableProjects.slice(0, 10).join(", ") + (availableProjects.length > 10 ? "..." : "")
      : "none";
    super(`project not found: "${name}". available projects: ${projectList}`);
    this.name = "ProjectNotFoundError";
  }
}

export async function resolveProjectByName(
  client: LinearClient,
  name: string
): Promise<string> {
  const projects = await listProjects(client, {});
  const normalizedInput = name.toLowerCase();

  const match = projects.find(
    (p) => p.name.toLowerCase() === normalizedInput
  );

  if (!match) {
    throw new ProjectNotFoundError(
      name,
      projects.map((p) => p.name)
    );
  }

  return match.id;
}

// === cycle resolver ===

export class CycleNotFoundError extends Error {
  constructor(name: string, availableCycles: string[]) {
    const cycleList = availableCycles.length > 0
      ? availableCycles.join(", ")
      : "none";
    super(`cycle not found: "${name}". available cycles: ${cycleList}`);
    this.name = "CycleNotFoundError";
  }
}

export async function resolveCycleByName(
  client: LinearClient,
  teamIdOrKey: string,
  name: string
): Promise<string> {
  // listCycles accepts team key or id (SDK handles both)
  const cycles = await listCycles(client, teamIdOrKey);
  const normalizedInput = name.toLowerCase();

  // match by name or number
  const match = cycles.find(
    (c) => c.name?.toLowerCase() === normalizedInput ||
           c.number?.toString() === name
  );

  if (!match) {
    throw new CycleNotFoundError(
      name,
      cycles.map((c) => c.name ?? `#${c.number}`)
    );
  }

  return match.id;
}

// === milestone resolver ===

export class MilestoneNotFoundError extends Error {
  constructor(name: string, availableMilestones: string[]) {
    const milestoneList = availableMilestones.length > 0
      ? availableMilestones.join(", ")
      : "none";
    super(`milestone not found: "${name}". available milestones: ${milestoneList}`);
    this.name = "MilestoneNotFoundError";
  }
}

export async function resolveMilestoneByName(
  client: LinearClient,
  projectId: string,
  name: string
): Promise<string> {
  const milestones = await listMilestones(client, { projectId });
  const normalizedInput = name.toLowerCase();

  const match = milestones.find(
    (m) => m.name.toLowerCase() === normalizedInput
  );

  if (!match) {
    throw new MilestoneNotFoundError(
      name,
      milestones.map((m) => m.name)
    );
  }

  return match.id;
}
