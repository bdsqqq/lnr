import type { LinearClient } from "@linear/sdk";

export interface Comment {
  id: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  user: string | null;
  parentId: string | null;
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
      comments.nodes.map(async (c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        user: (await c.user)?.name ?? null,
        parentId: c.parentId ?? null,
      }))
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
