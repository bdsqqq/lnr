import type { LinearClient } from "@linear/sdk";
import type { ProjectMilestone, CreateProjectMilestoneInput, UpdateProjectMilestoneInput } from "./types";

export async function listMilestones(
  client: LinearClient,
  filter?: { projectId?: string }
): Promise<ProjectMilestone[]> {
  if (filter?.projectId) {
    const project = await client.project(filter.projectId);
    if (!project) {
      return [];
    }
    const milestonesConnection = await project.projectMilestones();
    return milestonesConnection.nodes.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      targetDate: m.targetDate,
      sortOrder: m.sortOrder,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));
  }

  const projects = await client.projects();
  const allMilestones: ProjectMilestone[] = [];

  for (const project of projects.nodes) {
    const milestonesConnection = await project.projectMilestones();
    for (const m of milestonesConnection.nodes) {
      allMilestones.push({
        id: m.id,
        name: m.name,
        description: m.description,
        targetDate: m.targetDate,
        sortOrder: m.sortOrder,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      });
    }
  }

  return allMilestones;
}

export async function getMilestone(
  client: LinearClient,
  id: string
): Promise<ProjectMilestone | null> {
  try {
    const milestone = await client.projectMilestone(id);
    if (!milestone) {
      return null;
    }
    return {
      id: milestone.id,
      name: milestone.name,
      description: milestone.description,
      targetDate: milestone.targetDate,
      sortOrder: milestone.sortOrder,
      createdAt: milestone.createdAt,
      updatedAt: milestone.updatedAt,
    };
  } catch {
    return null;
  }
}

export async function createMilestone(
  client: LinearClient,
  input: CreateProjectMilestoneInput
): Promise<ProjectMilestone | null> {
  const result = await client.createProjectMilestone({
    name: input.name,
    projectId: input.projectId,
    description: input.description,
    targetDate: input.targetDate,
  });

  if (!result.success) {
    return null;
  }

  const milestone = await result.projectMilestone;
  if (!milestone) {
    return null;
  }

  return {
    id: milestone.id,
    name: milestone.name,
    description: milestone.description,
    targetDate: milestone.targetDate,
    sortOrder: milestone.sortOrder,
    createdAt: milestone.createdAt,
    updatedAt: milestone.updatedAt,
  };
}

export async function updateMilestone(
  client: LinearClient,
  id: string,
  input: UpdateProjectMilestoneInput
): Promise<ProjectMilestone | null> {
  const result = await client.updateProjectMilestone(id, {
    name: input.name,
    description: input.description,
    targetDate: input.targetDate,
    sortOrder: input.sortOrder,
  });

  if (!result.success) {
    return null;
  }

  const milestone = await result.projectMilestone;
  if (!milestone) {
    return null;
  }

  return {
    id: milestone.id,
    name: milestone.name,
    description: milestone.description,
    targetDate: milestone.targetDate,
    sortOrder: milestone.sortOrder,
    createdAt: milestone.createdAt,
    updatedAt: milestone.updatedAt,
  };
}

export async function deleteMilestone(
  client: LinearClient,
  id: string
): Promise<boolean> {
  try {
    const result = await client.deleteProjectMilestone(id);
    return result.success;
  } catch {
    return false;
  }
}
