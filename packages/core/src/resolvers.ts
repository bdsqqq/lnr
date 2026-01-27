import type { LinearClient } from "@linear/sdk";
import { getTeamStates } from "./issues";
import { getViewer } from "./me";

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
