import type { LinearClient } from "@linear/sdk";

export class IssueNotFoundError extends Error {
  constructor(identifier: string) {
    super(`issue not found: ${identifier}`);
    this.name = "IssueNotFoundError";
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
