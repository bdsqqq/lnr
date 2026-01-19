import type { LinearClient, ExternalEntityInfo, Reaction } from "@linear/sdk";

/** aggregated reaction count for display (e.g., 👍 x 3) */
export interface CommentReaction {
  emoji: string;
  count: number;
}

/** external service sync info (slack, etc.) — extracted from linear's ExternalEntityInfo */
export interface CommentSyncInfo {
  service: string;
  channelName?: string;
  messageUrl?: string;
}

export interface Comment {
  id: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  /** linear user who authored the comment, null if external */
  user: string | null;
  /** parent comment id for threading, null if root */
  parentId: string | null;
  url: string;
  reactions: CommentReaction[];
  /** external services this comment syncs with (slack channels, etc.) */
  syncedWith: CommentSyncInfo[];
  /** bot that created this comment (linear integrations) */
  botActor?: string | null;
  /** external user (e.g., slack user) who authored the comment */
  externalUser?: string | null;
}

function aggregateReactions(reactions: Reaction[]): CommentReaction[] {
  const counts = new Map<string, number>();
  for (const r of reactions) {
    counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([emoji, count]) => ({ emoji, count }));
}

function extractSyncInfo(syncedWith?: ExternalEntityInfo[]): CommentSyncInfo[] {
  if (!syncedWith) return [];
  return syncedWith.map((s) => {
    const slackMeta = s.metadata as { channelName?: string; messageUrl?: string } | undefined;
    return {
      service: s.service,
      channelName: slackMeta?.channelName,
      messageUrl: slackMeta?.messageUrl,
    };
  });
}

export async function getIssueComments(
  client: LinearClient,
  issueId: string
): Promise<Comment[]> {
  try {
    const issue = await client.issue(issueId);
    if (!issue) return [];

    const comments = await issue.comments();
    return Promise.all(
      comments.nodes.map(async (c) => {
        const user = await c.user;
        const externalUser = c.externalUserId ? await c.externalUser : null;
        const botActor = c.botActor;

        return {
          id: c.id,
          body: c.body,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          user: user?.name ?? null,
          parentId: c.parentId ?? null,
          url: c.url,
          reactions: aggregateReactions(c.reactions ?? []),
          syncedWith: extractSyncInfo(c.syncedWith),
          botActor: botActor?.name ?? null,
          externalUser: externalUser?.name ?? null,
        };
      })
    );
  } catch {
    return [];
  }
}

export async function updateComment(
  client: LinearClient,
  commentId: string,
  body: string
): Promise<boolean> {
  const result = await client.updateComment(commentId, { body });
  return result.success;
}

export async function replyToComment(
  client: LinearClient,
  issueId: string,
  parentId: string,
  body: string
): Promise<boolean> {
  const result = await client.createComment({ issueId, body, parentId });
  return result.success;
}

export async function deleteComment(
  client: LinearClient,
  commentId: string
): Promise<boolean> {
  const result = await client.deleteComment(commentId);
  return result.success;
}
