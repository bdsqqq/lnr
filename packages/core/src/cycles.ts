import type { LinearClient } from "@linear/sdk";
import type { Cycle, Issue } from "./types";

export async function listCycles(
  client: LinearClient,
  teamKey: string
): Promise<Cycle[]> {
  try {
    const team = await client.team(teamKey);

    if (!team) {
      return [];
    }

    const cyclesConnection = await team.cycles();
    return cyclesConnection.nodes.map((c) => ({
      id: c.id,
      number: c.number,
      name: c.name,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
    }));
  } catch {
    return [];
  }
}

export async function getCurrentCycle(
  client: LinearClient,
  teamKey: string
): Promise<Cycle | null> {
  try {
    const team = await client.team(teamKey);

    if (!team) {
      return null;
    }

    const activeCycle = await team.activeCycle;

    if (!activeCycle) {
      return null;
    }

    return {
      id: activeCycle.id,
      number: activeCycle.number,
      name: activeCycle.name,
      startsAt: activeCycle.startsAt,
      endsAt: activeCycle.endsAt,
    };
  } catch {
    return null;
  }
}

export async function getCycleIssues(
  client: LinearClient,
  teamKey: string
): Promise<Issue[]> {
  try {
    const team = await client.team(teamKey);

    if (!team) {
      return [];
    }

    const activeCycle = await team.activeCycle;

    if (!activeCycle) {
      return [];
    }

    const issuesConnection = await activeCycle.issues();

    return Promise.all(
      issuesConnection.nodes.map(async (i) => ({
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
  } catch {
    return [];
  }
}
