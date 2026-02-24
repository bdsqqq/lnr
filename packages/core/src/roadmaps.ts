import type { LinearClient } from "@linear/sdk";
import type { Roadmap, Project } from "./types";

export async function listRoadmaps(client: LinearClient): Promise<Roadmap[]> {
  const roadmapsConnection = await client.roadmaps();
  return Promise.all(
    roadmapsConnection.nodes.map(async (r) => {
      const owner = await r.owner;
      return {
        id: r.id,
        name: r.name,
        slugId: r.slugId,
        description: r.description ?? null,
        color: r.color ?? null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        url: r.url,
        ownerId: owner?.id ?? null,
        ownerName: owner?.name ?? null,
      };
    })
  );
}

export async function getRoadmap(
  client: LinearClient,
  id: string
): Promise<Roadmap | null> {
  try {
    const r = await client.roadmap(id);
    const owner = await r.owner;
    return {
      id: r.id,
      name: r.name,
      slugId: r.slugId,
      description: r.description ?? null,
      color: r.color ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      url: r.url,
      ownerId: owner?.id ?? null,
      ownerName: owner?.name ?? null,
    };
  } catch {
    return null;
  }
}

export async function findRoadmapByName(
  client: LinearClient,
  name: string
): Promise<Roadmap | null> {
  const roadmaps = await client.roadmaps();
  const roadmap = roadmaps.nodes.find(
    (r) =>
      r.name.toLowerCase() === name.toLowerCase() ||
      r.slugId.toLowerCase() === name.toLowerCase()
  );

  if (!roadmap) {
    return null;
  }

  const owner = await roadmap.owner;
  return {
    id: roadmap.id,
    name: roadmap.name,
    slugId: roadmap.slugId,
    description: roadmap.description ?? null,
    color: roadmap.color ?? null,
    createdAt: roadmap.createdAt,
    updatedAt: roadmap.updatedAt,
    url: roadmap.url,
    ownerId: owner?.id ?? null,
    ownerName: owner?.name ?? null,
  };
}

export async function getRoadmapProjects(
  client: LinearClient,
  roadmapId: string
): Promise<Project[]> {
  const roadmap = await client.roadmap(roadmapId);

  if (!roadmap) {
    return [];
  }

  const projectsConnection = await roadmap.projects();

  return projectsConnection.nodes.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    state: p.state,
    progress: p.progress ?? null,
    targetDate: p.targetDate ?? null,
    startDate: p.startDate ?? null,
    createdAt: p.createdAt,
  }));
}
