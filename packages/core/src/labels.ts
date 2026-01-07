import type { LinearClient } from "@linear/sdk";

export interface Label {
  id: string;
  name: string;
  color: string;
  description: string | null;
}

export async function listLabels(
  client: LinearClient,
  teamId?: string
): Promise<Label[]> {
  if (teamId) {
    const team = await client.team(teamId);
    if (!team) {
      return [];
    }
    const labelsConnection = await team.labels();
    return labelsConnection.nodes.map((l) => ({
      id: l.id,
      name: l.name,
      color: l.color,
      description: l.description ?? null,
    }));
  }

  const labelsConnection = await client.issueLabels();
  return labelsConnection.nodes.map((l) => ({
    id: l.id,
    name: l.name,
    color: l.color,
    description: l.description ?? null,
  }));
}

export async function getLabel(
  client: LinearClient,
  id: string
): Promise<Label | null> {
  try {
    const label = await client.issueLabel(id);
    return {
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description ?? null,
    };
  } catch {
    return null;
  }
}

export async function createLabel(
  client: LinearClient,
  input: { name: string; teamId?: string; color?: string; description?: string }
): Promise<Label | null> {
  const payload = await client.createIssueLabel({
    name: input.name,
    teamId: input.teamId,
    color: input.color,
    description: input.description,
  });

  if (!payload.success) {
    return null;
  }

  const label = await payload.issueLabel;
  if (!label) {
    return null;
  }

  return {
    id: label.id,
    name: label.name,
    color: label.color,
    description: label.description ?? null,
  };
}

export async function updateLabel(
  client: LinearClient,
  id: string,
  input: { name?: string; color?: string; description?: string }
): Promise<boolean> {
  const payload = await client.updateIssueLabel(id, input);
  return payload.success;
}

export async function deleteLabel(
  client: LinearClient,
  id: string
): Promise<boolean> {
  const payload = await client.deleteIssueLabel(id);
  return payload.success;
}
