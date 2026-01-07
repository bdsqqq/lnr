import { LinearClient, PaginationOrderBy } from "@linear/sdk";
import type { User, Issue, Activity } from "./types";

export async function getViewer(client: LinearClient): Promise<User> {
  const viewer = await client.viewer;

  return {
    id: viewer.id,
    name: viewer.name,
    email: viewer.email,
    displayName: viewer.displayName,
    active: viewer.active,
    admin: viewer.admin,
  };
}

export async function getMyIssues(client: LinearClient): Promise<Issue[]> {
  const viewer = await client.viewer;
  const issuesConnection = await viewer.assignedIssues({
    filter: { state: { type: { nin: ["completed", "canceled"] } } },
  });

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
}

export async function getMyCreatedIssues(
  client: LinearClient
): Promise<Issue[]> {
  const viewer = await client.viewer;
  const issuesConnection = await viewer.createdIssues({
    filter: { state: { type: { nin: ["completed", "canceled"] } } },
  });

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
}

export async function getMyActivity(
  client: LinearClient,
  limit = 20
): Promise<Activity[]> {
  const viewer = await client.viewer;
  const assignedConnection = await viewer.assignedIssues({
    first: limit * 2,
    orderBy: PaginationOrderBy.UpdatedAt,
  });
  const createdConnection = await viewer.createdIssues({
    first: limit * 2,
    orderBy: PaginationOrderBy.UpdatedAt,
  });

  const issueMap = new Map<string, Activity>();

  for (const i of [...assignedConnection.nodes, ...createdConnection.nodes]) {
    if (!issueMap.has(i.id)) {
      issueMap.set(i.id, {
        id: i.id,
        identifier: i.identifier,
        title: i.title,
        state: (await i.state)?.name ?? null,
        updatedAt: i.updatedAt,
        url: i.url,
      });
    }
  }

  return [...issueMap.values()]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, limit);
}
