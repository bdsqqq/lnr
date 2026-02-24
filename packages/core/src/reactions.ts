import type { LinearClient } from "@linear/sdk";

/** target entity for a reaction */
export type ReactionTarget =
  | { type: "comment"; id: string }
  | { type: "issue"; id: string }
  | { type: "projectUpdate"; id: string }
  | { type: "initiativeUpdate"; id: string };

/**
 * create a reaction on a comment, issue, project update, or initiative update.
 * @param client - Linear client
 * @param target - target entity (comment, issue, projectUpdate, or initiativeUpdate)
 * @param emoji - emoji code (e.g., "+1", "heart")
 */
export async function createReaction(
  client: LinearClient,
  target: ReactionTarget,
  emoji: string
): Promise<boolean> {
  const input: { emoji: string; commentId?: string; issueId?: string; projectUpdateId?: string; initiativeUpdateId?: string } = { emoji };

  switch (target.type) {
    case "comment":
      input.commentId = target.id;
      break;
    case "issue":
      input.issueId = target.id;
      break;
    case "projectUpdate":
      input.projectUpdateId = target.id;
      break;
    case "initiativeUpdate":
      input.initiativeUpdateId = target.id;
      break;
  }

  const result = await client.createReaction(input);
  return result.success;
}

/**
 * create a reaction on a comment (legacy signature for backward compatibility).
 * @deprecated use createReaction with ReactionTarget instead
 */
export async function createCommentReaction(
  client: LinearClient,
  commentId: string,
  emoji: string
): Promise<boolean> {
  return createReaction(client, { type: "comment", id: commentId }, emoji);
}

export async function deleteReaction(
  client: LinearClient,
  reactionId: string
): Promise<boolean> {
  const result = await client.deleteReaction(reactionId);
  return result.success;
}
