import type { LinearClient } from "@linear/sdk";
import type { Cycle, Issue, CreateCycleInput, UpdateCycleInput } from "./types";

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
      description: c.description,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      completedAt: c.completedAt,
      progress: c.progress,
    }));
  } catch {
    return [];
  }
}

export async function getCycle(
  client: LinearClient,
  teamKey: string,
  nameOrNumber: string
): Promise<Cycle | null> {
  try {
    const cycles = await listCycles(client, teamKey);
    const normalizedInput = nameOrNumber.toLowerCase();

    const match = cycles.find(
      (c) =>
        c.name?.toLowerCase() === normalizedInput ||
        c.number?.toString() === nameOrNumber
    );

    return match ?? null;
  } catch {
    return null;
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
      description: activeCycle.description,
      startsAt: activeCycle.startsAt,
      endsAt: activeCycle.endsAt,
      completedAt: activeCycle.completedAt,
      progress: activeCycle.progress,
    };
  } catch {
    return null;
  }
}

export async function getCycleById(
  client: LinearClient,
  cycleId: string
): Promise<Cycle | null> {
  try {
    const cycle = await client.cycle(cycleId);

    if (!cycle) {
      return null;
    }

    return {
      id: cycle.id,
      number: cycle.number,
      name: cycle.name,
      description: cycle.description,
      startsAt: cycle.startsAt,
      endsAt: cycle.endsAt,
      completedAt: cycle.completedAt,
      progress: cycle.progress,
    };
  } catch {
    return null;
  }
}

export async function createCycle(
  client: LinearClient,
  input: CreateCycleInput
): Promise<Cycle | null> {
  try {
    const payload = await client.createCycle({
      teamId: input.teamId,
      name: input.name,
      description: input.description,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
    });

    const cycle = await payload.cycle;

    if (!cycle) {
      return null;
    }

    return {
      id: cycle.id,
      number: cycle.number,
      name: cycle.name,
      description: cycle.description,
      startsAt: cycle.startsAt,
      endsAt: cycle.endsAt,
      completedAt: cycle.completedAt,
      progress: cycle.progress,
    };
  } catch {
    return null;
  }
}

export async function updateCycle(
  client: LinearClient,
  cycleId: string,
  input: UpdateCycleInput
): Promise<boolean> {
  try {
    const payload = await client.updateCycle(cycleId, {
      name: input.name,
      description: input.description,
      startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
      endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
      completedAt: input.completedAt ? new Date(input.completedAt) : undefined,
    });

    return payload.success;
  } catch {
    return false;
  }
}

export async function deleteCycle(
  client: LinearClient,
  cycleId: string
): Promise<boolean> {
  try {
    const payload = await client.archiveCycle(cycleId);
    return payload.success;
  } catch {
    return false;
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
        branchName: i.branchName,
      }))
    );
  } catch {
    return [];
  }
}
