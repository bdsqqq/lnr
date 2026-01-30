import type { LinearClient } from "@linear/sdk";
import type {
  GitAutomationState,
  GitAutomationEvent,
  CreateGitAutomationStateInput,
  UpdateGitAutomationStateInput,
} from "./types";

export async function listGitAutomationStates(
  client: LinearClient,
  teamKey: string
): Promise<GitAutomationState[]> {
  try {
    const team = await client.team(teamKey);

    if (!team) {
      return [];
    }

    const connection = await team.gitAutomationStates();
    return Promise.all(
      connection.nodes.map(async (g) => {
        const state = await g.state;
        const targetBranch = g.targetBranch;
        return {
          id: g.id,
          event: g.event.toLowerCase() as GitAutomationEvent,
          stateId: state?.id ?? null,
          stateName: state?.name ?? null,
          targetBranchId: targetBranch?.id ?? null,
          targetBranchPattern: targetBranch?.branchPattern ?? null,
          teamId: team.id,
          teamKey: team.key,
          createdAt: g.createdAt,
          updatedAt: g.updatedAt,
          archivedAt: g.archivedAt ?? null,
        };
      })
    );
  } catch {
    return [];
  }
}

export async function getGitAutomationState(
  client: LinearClient,
  teamKey: string,
  id: string
): Promise<GitAutomationState | null> {
  try {
    const states = await listGitAutomationStates(client, teamKey);
    return states.find((s) => s.id === id) ?? null;
  } catch {
    return null;
  }
}

export async function findGitAutomationStateByEvent(
  client: LinearClient,
  teamKey: string,
  event: GitAutomationEvent
): Promise<GitAutomationState | null> {
  try {
    const states = await listGitAutomationStates(client, teamKey);
    return states.find((s) => s.event === event) ?? null;
  } catch {
    return null;
  }
}

export async function createGitAutomationState(
  client: LinearClient,
  input: CreateGitAutomationStateInput
): Promise<GitAutomationState | null> {
  try {
    const payload = await client.createGitAutomationState({
      teamId: input.teamId,
      event: input.event as unknown as import("@linear/sdk").GitAutomationStates,
      stateId: input.stateId,
      targetBranchId: input.targetBranchId,
    });

    if (!payload.success) {
      return null;
    }

    const g = payload.gitAutomationState;
    const state = await g.state;
    const targetBranch = g.targetBranch;
    const team = await g.team;

    return {
      id: g.id,
      event: g.event.toLowerCase() as GitAutomationEvent,
      stateId: state?.id ?? null,
      stateName: state?.name ?? null,
      targetBranchId: targetBranch?.id ?? null,
      targetBranchPattern: targetBranch?.branchPattern ?? null,
      teamId: team?.id ?? input.teamId,
      teamKey: team?.key,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
      archivedAt: g.archivedAt ?? null,
    };
  } catch {
    return null;
  }
}

export async function updateGitAutomationState(
  client: LinearClient,
  id: string,
  input: UpdateGitAutomationStateInput
): Promise<boolean> {
  try {
    const payload = await client.updateGitAutomationState(id, {
      event: input.event as unknown as import("@linear/sdk").GitAutomationStates | undefined,
      stateId: input.stateId,
      targetBranchId: input.targetBranchId,
    });

    return payload.success;
  } catch {
    return false;
  }
}

export async function deleteGitAutomationState(
  client: LinearClient,
  id: string
): Promise<boolean> {
  try {
    const payload = await client.deleteGitAutomationState(id);
    return payload.success;
  } catch {
    return false;
  }
}
