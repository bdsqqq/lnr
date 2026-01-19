import type { LinearClient, ExternalEntityInfo } from "@linear/sdk";

/** aggregated reaction count for display (e.g., 👍 x 3) */
export interface CommentReaction {
  emoji: string;
  count: number;
}

/** slack-specific sync metadata */
export interface SlackSyncMeta {
  type: "slack";
  channelName?: string;
  messageUrl?: string;
}

/** github-specific sync metadata */
export interface GithubSyncMeta {
  type: "github";
  owner?: string;
  repo?: string;
  number?: number;
}

/** jira-specific sync metadata */
export interface JiraSyncMeta {
  type: "jira";
  issueKey?: string;
  projectId?: string;
}

/** generic sync metadata for unknown services */
export interface GenericSyncMeta {
  type: "unknown";
}

export type SyncMeta = SlackSyncMeta | GithubSyncMeta | JiraSyncMeta | GenericSyncMeta;

/** external service sync info — extracted from linear's ExternalEntityInfo */
export interface CommentSyncInfo {
  service: string;
  meta: SyncMeta;
}

export interface CommentsResult {
  comments: Comment[];
  error?: string;
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

export function aggregateReactions(reactions: readonly { emoji: string }[]): CommentReaction[] {
  const counts = new Map<string, number>();
  for (const r of reactions) {
    counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([emoji, count]) => ({ emoji, count }));
}

export function extractSyncMeta(service: string, metadata: unknown): SyncMeta {
  const svc = service.toLowerCase();
  const isObject = typeof metadata === "object" && metadata !== null;

  if (svc === "slack") {
    const channelName =
      isObject && "channelName" in metadata && typeof metadata.channelName === "string"
        ? metadata.channelName
        : undefined;
    const messageUrl =
      isObject && "messageUrl" in metadata && typeof metadata.messageUrl === "string"
        ? metadata.messageUrl
        : undefined;
    return { type: "slack", channelName, messageUrl } satisfies SyncMeta;
  }

  if (svc === "github") {
    const owner =
      isObject && "owner" in metadata && typeof metadata.owner === "string"
        ? metadata.owner
        : undefined;
    const repo =
      isObject && "repo" in metadata && typeof metadata.repo === "string"
        ? metadata.repo
        : undefined;
    const number =
      isObject && "number" in metadata && typeof metadata.number === "number"
        ? metadata.number
        : undefined;
    return { type: "github", owner, repo, number } satisfies SyncMeta;
  }

  if (svc === "jira") {
    const issueKey =
      isObject && "issueKey" in metadata && typeof metadata.issueKey === "string"
        ? metadata.issueKey
        : undefined;
    const projectId =
      isObject && "projectId" in metadata && typeof metadata.projectId === "string"
        ? metadata.projectId
        : undefined;
    return { type: "jira", issueKey, projectId } satisfies SyncMeta;
  }

  return { type: "unknown" } satisfies SyncMeta;
}

function extractSyncInfo(syncedWith?: ExternalEntityInfo[]): CommentSyncInfo[] {
  if (!syncedWith) return [];
  return syncedWith.map((s) => ({
    service: s.service,
    meta: extractSyncMeta(s.service, s.metadata),
  }));
}

export async function getIssueComments(
  client: LinearClient,
  issueId: string
): Promise<CommentsResult> {
  try {
    const issue = await client.issue(issueId);
    if (!issue) return { comments: [] };

    const commentsData = await issue.comments();
    const comments = await Promise.all(
      commentsData.nodes.map(async (c) => {
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
    return { comments };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { comments: [], error: message };
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
