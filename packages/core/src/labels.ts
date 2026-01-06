import type { LinearClient } from "@linear/sdk";
import type { Label, CreateLabelInput, UpdateLabelInput } from "./types";

export interface ListLabelsOptions {
  teamId?: string;
}

export async function listLabels(
  client: LinearClient,
  options: ListLabelsOptions = {}
): Promise<Label[]> {
  if (options.teamId) {
    const team = await client.team(options.teamId);
    const labelsConnection = await team.labels();
    return labelsConnection.nodes.map(mapLabel);
  }

  const labelsConnection = await client.issueLabels();
  return labelsConnection.nodes.map(mapLabel);
}

export async function getLabel(
  client: LinearClient,
  id: string
): Promise<Label | null> {
  try {
    const label = await client.issueLabel(id);
    if (!label) return null;
    return mapLabel(label);
  } catch {
    return null;
  }
}

export async function createLabel(
  client: LinearClient,
  input: CreateLabelInput
): Promise<Label> {
  const payload = await client.createIssueLabel({
    name: input.name,
    color: input.color,
    description: input.description,
    teamId: input.teamId,
    parentId: input.parentId,
  });

  if (!payload.success) {
    throw new Error("failed to create label");
  }

  const label = await payload.issueLabel;
  if (!label) {
    throw new Error("failed to create label");
  }

  return mapLabel(label);
}

export async function updateLabel(
  client: LinearClient,
  id: string,
  input: UpdateLabelInput
): Promise<Label> {
  const payload = await client.updateIssueLabel(id, {
    name: input.name,
    color: input.color,
    description: input.description,
  });

  if (!payload.success) {
    throw new Error("failed to update label");
  }

  const label = await payload.issueLabel;
  if (!label) {
    throw new Error("failed to update label");
  }

  return mapLabel(label);
}

export async function deleteLabel(
  client: LinearClient,
  id: string
): Promise<boolean> {
  const payload = await client.deleteIssueLabel(id);
  return payload.success;
}

function mapLabel(label: {
  id: string;
  name: string;
  color: string;
  description?: string | null;
  isGroup: boolean;
}): Label {
  return {
    id: label.id,
    name: label.name,
    color: label.color,
    description: label.description,
    isGroup: label.isGroup,
    parentId: undefined,
    teamId: undefined,
  };
}
