import type { LinearClient } from "@linear/sdk";

export async function createReaction(
  client: LinearClient,
  commentId: string,
  emoji: string
): Promise<boolean> {
  const result = await client.createReaction({ commentId, emoji });
  return result.success;
}

export async function deleteReaction(
  client: LinearClient,
  reactionId: string
): Promise<boolean> {
  const result = await client.deleteReaction(reactionId);
  return result.success;
}
