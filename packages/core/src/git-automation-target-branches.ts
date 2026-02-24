import type { LinearClient } from "@linear/sdk";
import type {
  GitAutomationTargetBranch,
  CreateGitAutomationTargetBranchInput,
  UpdateGitAutomationTargetBranchInput,
} from "./types";

export async function listGitAutomationTargetBranches(
  client: LinearClient,
  teamKey: string
): Promise<GitAutomationTargetBranch[]> {
  try {
    const team = await client.team(teamKey);

    if (!team) {
      return [];
    }

    const connection = await team.gitAutomationStates();
    const branchMap = new Map<string, GitAutomationTargetBranch>();

    for (const state of connection.nodes) {
      const targetBranch = state.targetBranch;
      if (targetBranch && !branchMap.has(targetBranch.id)) {
        branchMap.set(targetBranch.id, {
          id: targetBranch.id,
          branchPattern: targetBranch.branchPattern,
          isRegex: targetBranch.isRegex,
          teamId: team.id,
          teamKey: team.key,
          createdAt: targetBranch.createdAt,
          updatedAt: targetBranch.updatedAt,
          archivedAt: targetBranch.archivedAt ?? null,
        });
      }
    }

    return Array.from(branchMap.values());
  } catch {
    return [];
  }
}

export async function getGitAutomationTargetBranch(
  client: LinearClient,
  teamKey: string,
  id: string
): Promise<GitAutomationTargetBranch | null> {
  try {
    const branches = await listGitAutomationTargetBranches(client, teamKey);
    return branches.find((b) => b.id === id) ?? null;
  } catch {
    return null;
  }
}

export async function findGitAutomationTargetBranchByPattern(
  client: LinearClient,
  teamKey: string,
  pattern: string
): Promise<GitAutomationTargetBranch | null> {
  try {
    const branches = await listGitAutomationTargetBranches(client, teamKey);
    return branches.find((b) => b.branchPattern === pattern) ?? null;
  } catch {
    return null;
  }
}

export async function createGitAutomationTargetBranch(
  client: LinearClient,
  input: CreateGitAutomationTargetBranchInput
): Promise<GitAutomationTargetBranch | null> {
  try {
    const payload = await client.createGitAutomationTargetBranch({
      teamId: input.teamId,
      branchPattern: input.branchPattern,
      isRegex: input.isRegex,
    });

    if (!payload.success) {
      return null;
    }

    const b = payload.targetBranch;
    const team = await b.team;

    return {
      id: b.id,
      branchPattern: b.branchPattern,
      isRegex: b.isRegex,
      teamId: team?.id ?? input.teamId,
      teamKey: team?.key,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      archivedAt: b.archivedAt ?? null,
    };
  } catch {
    return null;
  }
}

export async function updateGitAutomationTargetBranch(
  client: LinearClient,
  id: string,
  input: UpdateGitAutomationTargetBranchInput
): Promise<boolean> {
  try {
    const payload = await client.updateGitAutomationTargetBranch(id, {
      branchPattern: input.branchPattern,
      isRegex: input.isRegex,
    });

    return payload.success;
  } catch {
    return false;
  }
}

export async function deleteGitAutomationTargetBranch(
  client: LinearClient,
  id: string
): Promise<boolean> {
  try {
    const payload = await client.deleteGitAutomationTargetBranch(id);
    return payload.success;
  } catch {
    return false;
  }
}
