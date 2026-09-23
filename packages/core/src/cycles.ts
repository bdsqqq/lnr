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
  const payload = await client.createCycle({
    teamId: input.teamId,
    name: input.name,
    description: input.description,
    startsAt: new Date(input.startsAt),
    endsAt: new Date(input.endsAt),
  });

  if (!payload.success) return null;

  // this sdk getter makes another request; let the cli report failures from either phase.
  const cycle = await payload.cycle;
  if (!cycle) return null;

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

    return mapCycleIssues(issuesConnection.nodes);
  } catch {
    return [];
  }
}

/** Pin the resolved cycle rather than re-read a team's possibly different active cycle. */
export async function getCycleIssuesById(
  client: LinearClient,
  cycleId: string
): Promise<Issue[]> {
  const cycle = await client.cycle(cycleId);
  const issuesConnection = await cycle.issues();
  return mapCycleIssues(issuesConnection.nodes);
}

type SdkCycle = Awaited<ReturnType<LinearClient["cycle"]>>;
type CycleIssueNodes = Awaited<ReturnType<SdkCycle["issues"]>>["nodes"];

function mapCycleIssues(nodes: CycleIssueNodes): Promise<Issue[]> {
  return Promise.all(
    nodes.map(async (issue) => ({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description,
      state: (await issue.state)?.name ?? null,
      assignee: (await issue.assignee)?.name ?? null,
      priority: issue.priority,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      url: issue.url,
      branchName: issue.branchName,
    }))
  );
}
