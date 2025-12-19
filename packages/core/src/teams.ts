import type { LinearClient } from "@linear/sdk";
import type { Team, TeamMember } from "./types";

export async function listTeams(client: LinearClient): Promise<Team[]> {
  const teamsConnection = await client.teams();
  return teamsConnection.nodes.map((t) => ({
    id: t.id,
    key: t.key,
    name: t.name,
    description: t.description,
    private: t.private,
    timezone: t.timezone,
  }));
}

export async function getTeam(
  client: LinearClient,
  key: string
): Promise<Team | null> {
  const teamsConnection = await client.teams({
    filter: { key: { eq: key.toUpperCase() } },
  });
  const team = teamsConnection.nodes[0];

  if (!team) {
    return null;
  }

  return {
    id: team.id,
    key: team.key,
    name: team.name,
    description: team.description,
    private: team.private,
    timezone: team.timezone,
  };
}

export async function getTeamMembers(
  client: LinearClient,
  key: string
): Promise<TeamMember[]> {
  const teamsConnection = await client.teams({
    filter: { key: { eq: key.toUpperCase() } },
  });
  const team = teamsConnection.nodes[0];

  if (!team) {
    return [];
  }

  const membersConnection = await team.members();
  return membersConnection.nodes.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    displayName: m.displayName,
    active: m.active,
  }));
}

export async function findTeamByKeyOrName(
  client: LinearClient,
  keyOrName: string
): Promise<Team | null> {
  const teams = await client.teams();
  const team = teams.nodes.find(
    (t) =>
      t.key.toLowerCase() === keyOrName.toLowerCase() ||
      t.name.toLowerCase() === keyOrName.toLowerCase()
  );

  if (!team) {
    return null;
  }

  return {
    id: team.id,
    key: team.key,
    name: team.name,
    description: team.description,
    private: team.private,
    timezone: team.timezone,
  };
}

export async function getAvailableTeamKeys(
  client: LinearClient
): Promise<string[]> {
  const teams = await client.teams();
  return teams.nodes.map((t) => t.key);
}
