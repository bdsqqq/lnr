import type { LinearClient } from "@linear/sdk";
import type { AgentSession, UpdateAgentSessionInput } from "./types";

export async function listAgentSessions(
  client: LinearClient,
  options?: { status?: string }
): Promise<AgentSession[]> {
  const connection = await client.agentSessions();
  let sessions = connection.nodes;

  if (options?.status) {
    sessions = sessions.filter(
      (s) => s.status.toLowerCase() === options.status?.toLowerCase()
    );
  }

  const results: AgentSession[] = [];
  for (const s of sessions) {
    const creator = s.creatorId ? await s.creator : null;
    const appUser = s.appUserId ? await s.appUser : null;
    const issue = s.issueId ? await s.issue : null;

    results.push({
      id: s.id,
      status: s.status,
      type: s.type,
      summary: s.summary ?? null,
      externalLink: s.externalLink ?? null,
      plan: s.plan ?? null,
      sourceMetadata: s.sourceMetadata ?? null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      startedAt: s.startedAt ?? null,
      endedAt: s.endedAt ?? null,
      dismissedAt: s.dismissedAt ?? null,
      archivedAt: s.archivedAt ?? null,
      issueId: s.issueId ?? null,
      issueIdentifier: issue?.identifier ?? null,
      commentId: s.commentId ?? null,
      creatorId: s.creatorId ?? null,
      creatorName: creator?.name ?? null,
      appUserId: s.appUserId ?? null,
      appUserName: appUser?.name ?? null,
    });
  }

  return results;
}

export async function getAgentSession(
  client: LinearClient,
  id: string
): Promise<AgentSession | null> {
  try {
    const s = await client.agentSession(id);
    const creator = s.creatorId ? await s.creator : null;
    const appUser = s.appUserId ? await s.appUser : null;
    const issue = s.issueId ? await s.issue : null;

    return {
      id: s.id,
      status: s.status,
      type: s.type,
      summary: s.summary ?? null,
      externalLink: s.externalLink ?? null,
      plan: s.plan ?? null,
      sourceMetadata: s.sourceMetadata ?? null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      startedAt: s.startedAt ?? null,
      endedAt: s.endedAt ?? null,
      dismissedAt: s.dismissedAt ?? null,
      archivedAt: s.archivedAt ?? null,
      issueId: s.issueId ?? null,
      issueIdentifier: issue?.identifier ?? null,
      commentId: s.commentId ?? null,
      creatorId: s.creatorId ?? null,
      creatorName: creator?.name ?? null,
      appUserId: s.appUserId ?? null,
      appUserName: appUser?.name ?? null,
    };
  } catch {
    return null;
  }
}

export async function updateAgentSession(
  client: LinearClient,
  id: string,
  input: UpdateAgentSessionInput
): Promise<boolean> {
  try {
    const session = await client.agentSession(id);
    const result = await session.update(input);
    return result.success;
  } catch {
    return false;
  }
}
