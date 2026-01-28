import type { LinearClient } from "@linear/sdk";
import type { Issue } from "./types";

export async function searchIssues(
  client: LinearClient,
  query: string,
  options: { team?: string } = {}
): Promise<Issue[]> {
  const searchResults = await client.searchIssues(query);
  let issues = searchResults.nodes;

  if (options.team) {
    const teamKey = options.team.toUpperCase();
    issues = issues.filter((issue) =>
      issue.identifier.startsWith(teamKey + "-")
    );
  }

  return Promise.all(
    issues.map(async (i) => ({
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
}
