import type { LinearClient, Comment as LinearComment } from "@linear/sdk";
import type { Comment } from "./types";

export async function getIssueComments(
  client: LinearClient,
  issueId: string
): Promise<Comment[]> {
  const issue = await client.issue(issueId);
  if (!issue) return [];

  const comments = await issue.comments();
  return Promise.all(
    comments.nodes.map(async (c: LinearComment) => {
      const user = await c.user;
      return {
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        user: user?.name ?? null,
        parentId: (c as unknown as { parentId?: string }).parentId ?? null,
      };
    })
  );
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
  parentCommentId: string,
  issueId: string,
  body: string
): Promise<boolean> {
  const result = await client.createComment({
    issueId,
    body,
    parentId: parentCommentId,
  });
  return result.success;
}

export async function deleteComment(
  client: LinearClient,
  commentId: string
): Promise<boolean> {
  const result = await client.deleteComment(commentId);
  return result.success;
}
