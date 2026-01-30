import type { LinearClient } from "@linear/sdk";
import type { Initiative } from "./types";

export async function listInitiatives(client: LinearClient): Promise<Initiative[]> {
  const initiativesConnection = await client.initiatives();
  return initiativesConnection.nodes.map((i) => ({
    id: i.id,
    name: i.name,
    slugId: i.slugId,
    description: i.description ?? null,
    status: i.status,
    health: i.health ?? null,
    color: i.color ?? null,
    icon: i.icon ?? null,
    targetDate: i.targetDate ?? null,
    startedAt: i.startedAt ?? null,
    completedAt: i.completedAt ?? null,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    url: i.url,
  }));
}

export async function getInitiative(
  client: LinearClient,
  id: string
): Promise<Initiative | null> {
  try {
    const i = await client.initiative(id);
    return {
      id: i.id,
      name: i.name,
      slugId: i.slugId,
      description: i.description ?? null,
      status: i.status,
      health: i.health ?? null,
      color: i.color ?? null,
      icon: i.icon ?? null,
      targetDate: i.targetDate ?? null,
      startedAt: i.startedAt ?? null,
      completedAt: i.completedAt ?? null,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
      url: i.url,
    };
  } catch {
    return null;
  }
}

export async function findInitiativeByName(
  client: LinearClient,
  name: string
): Promise<Initiative | null> {
  const initiatives = await client.initiatives();
  const initiative = initiatives.nodes.find(
    (i) =>
      i.name.toLowerCase() === name.toLowerCase() ||
      i.slugId.toLowerCase() === name.toLowerCase()
  );

  if (!initiative) {
    return null;
  }

  return {
    id: initiative.id,
    name: initiative.name,
    slugId: initiative.slugId,
    description: initiative.description ?? null,
    status: initiative.status,
    health: initiative.health ?? null,
    color: initiative.color ?? null,
    icon: initiative.icon ?? null,
    targetDate: initiative.targetDate ?? null,
    startedAt: initiative.startedAt ?? null,
    completedAt: initiative.completedAt ?? null,
    createdAt: initiative.createdAt,
    updatedAt: initiative.updatedAt,
    url: initiative.url,
  };
}
