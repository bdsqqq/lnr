import type { LinearClient } from "@linear/sdk";

export interface Reaction {
  id: string;
  emoji: string;
  createdAt: Date;
  user: string | null;
}

export interface CreateReactionInput {
  commentId: string;
  emoji: string;
}

export async function createReaction(
  client: LinearClient,
  input: CreateReactionInput
): Promise<Reaction | null> {
  const result = await client.createReaction(input);

  if (!result.success) {
    return null;
  }

  const reaction = await result.reaction;
  if (!reaction) {
    return null;
  }

  const user = await reaction.user;
  return {
    id: reaction.id,
    emoji: reaction.emoji,
    createdAt: reaction.createdAt,
    user: user?.name ?? null,
  };
}

export async function deleteReaction(
  client: LinearClient,
  reactionId: string
): Promise<boolean> {
  const result = await client.deleteReaction(reactionId);
  return result.success;
}
