import type { LinearClient } from "@linear/sdk";
import type { Issue, ListIssuesFilter, CreateIssueInput, UpdateIssueInput } from "./types";

export function priorityFromString(priority: string): number {
  switch (priority.toLowerCase()) {
    case "urgent":
      return 1;
    case "high":
      return 2;
    case "medium":
      return 3;
    case "low":
      return 4;
    case "none":
      return 0;
    default:
      return 0;
  }
}

export async function listIssues(
  client: LinearClient,
  filter: ListIssuesFilter = {}
): Promise<Issue[]> {
  const apiFilter: Record<string, unknown> = {};

  if (filter.team) {
    apiFilter.team = { key: { eq: filter.team } };
  }

  if (filter.state) {
    apiFilter.state = { name: { eqIgnoreCase: filter.state } };
  }

  if (filter.assignee) {
    if (filter.assignee === "@me") {
      const viewer = await client.viewer;
      apiFilter.assignee = { id: { eq: viewer.id } };
    } else {
      apiFilter.assignee = { email: { eq: filter.assignee } };
    }
  }

  if (filter.label) {
    apiFilter.labels = { some: { name: { eqIgnoreCase: filter.label } } };
  }

  if (filter.project) {
    apiFilter.project = { name: { eqIgnoreCase: filter.project } };
  }

  const issues = await client.issues({ filter: apiFilter });
  const nodes = issues.nodes;

  return Promise.all(
    nodes.map(async (n) => ({
      id: n.id,
      identifier: n.identifier,
      title: n.title,
      description: n.description,
      state: (await n.state)?.name ?? null,
      assignee: (await n.assignee)?.name ?? null,
      priority: n.priority,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      url: n.url,
    }))
  );
}

export async function getIssue(
  client: LinearClient,
  identifier: string
): Promise<Issue | null> {
  try {
    const issue = await client.issue(identifier);

    if (!issue) {
      return null;
    }

    const state = await issue.state;
    const assignee = await issue.assignee;

    const parent = await issue.parent;

    return {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description,
      state: state?.name ?? null,
      assignee: assignee?.name ?? null,
      priority: issue.priority,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      url: issue.url,
      parentId: parent?.id ?? null,
      parent: parent?.identifier ?? null,
    };
  } catch {
    return null;
  }
}

export async function createIssue(
  client: LinearClient,
  input: CreateIssueInput
): Promise<Issue | null> {
  const result = await client.createIssue(input);

  if (!result.success) {
    return null;
  }

  const issueData = (result as unknown as { _issue?: { id: string } })._issue;
  if (!issueData?.id) {
    return null;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const createdIssue = await client.issue(issueData.id);
      if (createdIssue) {
        const state = await createdIssue.state;
        const assignee = await createdIssue.assignee;
        return {
          id: createdIssue.id,
          identifier: createdIssue.identifier,
          title: createdIssue.title,
          description: createdIssue.description,
          state: state?.name ?? null,
          assignee: assignee?.name ?? null,
          priority: createdIssue.priority,
          createdAt: createdIssue.createdAt,
          updatedAt: createdIssue.updatedAt,
          url: createdIssue.url,
        };
      }
    } catch {
      if (attempt < 2) await new Promise((r) => setTimeout(r, 300));
    }
  }

  return null;
}

export async function updateIssue(
  client: LinearClient,
  issueId: string,
  input: UpdateIssueInput
): Promise<boolean> {
  const result = await client.updateIssue(issueId, input);
  return result.success;
}

export async function addComment(
  client: LinearClient,
  issueId: string,
  body: string
): Promise<boolean> {
  const result = await client.createComment({ issueId, body });
  return result.success;
}

export async function getTeamStates(
  client: LinearClient,
  teamId: string
): Promise<Array<{ id: string; name: string }>> {
  const team = await client.team(teamId);
  if (!team) return [];

  const states = await team.states();
  return states.nodes.map((s) => ({ id: s.id, name: s.name }));
}

export async function getTeamLabels(
  client: LinearClient,
  teamId: string
): Promise<Array<{ id: string; name: string }>> {
  const team = await client.team(teamId);
  if (!team) return [];

  const labels = await team.labels();
  return labels.nodes.map((l) => ({ id: l.id, name: l.name }));
}

export async function archiveIssue(
  client: LinearClient,
  issueId: string
): Promise<boolean> {
  const result = await client.archiveIssue(issueId);
  return result.success;
}

export async function getSubIssues(
  client: LinearClient,
  issueId: string
): Promise<Issue[]> {
  const issue = await client.issue(issueId);
  if (!issue) return [];

  const children = await issue.children();
  return Promise.all(
    children.nodes.map(async (n) => ({
      id: n.id,
      identifier: n.identifier,
      title: n.title,
      description: n.description,
      state: (await n.state)?.name ?? null,
      assignee: (await n.assignee)?.name ?? null,
      priority: n.priority,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      url: n.url,
      parentId: issueId,
      parent: issue.identifier,
    }))
  );
}
