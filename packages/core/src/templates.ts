import type { LinearClient } from "@linear/sdk";

export interface Template {
  id: string;
  name: string;
  type: string;
  description: string | null;
  teamKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function listTemplates(
  client: LinearClient,
  teamKey?: string
): Promise<Template[]> {
  try {
    if (teamKey) {
      const teamsConnection = await client.teams({
        filter: { key: { eq: teamKey.toUpperCase() } },
      });
      const team = teamsConnection.nodes[0];
      if (!team) return [];

      const templatesConnection = await team.templates();
      return templatesConnection.nodes.map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        description: t.description ?? null,
        teamKey: teamKey.toUpperCase(),
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }));
    }

    // Fetch templates from all teams
    const teams = await client.teams();
    const allTemplates: Template[] = [];

    for (const team of teams.nodes) {
      const templatesConnection = await team.templates();
      const templates = templatesConnection.nodes.map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        description: t.description ?? null,
        teamKey: team.key,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }));
      allTemplates.push(...templates);
    }

    return allTemplates;
  } catch {
    return [];
  }
}

export async function getTemplate(
  client: LinearClient,
  nameOrId: string,
  teamKey?: string
): Promise<Template | null> {
  try {
    const templates = await listTemplates(client, teamKey);
    return (
      templates.find(
        (t) =>
          t.id === nameOrId ||
          t.name.toLowerCase() === nameOrId.toLowerCase()
      ) ?? null
    );
  } catch {
    return null;
  }
}

export async function findTemplateByName(
  client: LinearClient,
  name: string,
  teamKey?: string
): Promise<Template | null> {
  const templates = await listTemplates(client, teamKey);
  return (
    templates.find((t) => t.name.toLowerCase() === name.toLowerCase()) ?? null
  );
}

export async function getIssueTemplates(
  client: LinearClient,
  teamKey?: string
): Promise<Template[]> {
  const templates = await listTemplates(client, teamKey);
  return templates.filter((t) => t.type === "issue");
}
