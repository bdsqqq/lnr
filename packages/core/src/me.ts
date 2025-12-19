import type { LinearClient } from "@linear/sdk";
import type { User, Issue } from "./types";

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
