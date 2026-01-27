import type { LinearClient } from "@linear/sdk";
import { getTeamStates } from "./issues";

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
