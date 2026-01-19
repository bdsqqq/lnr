import { IssueRelationType, type LinearClient } from "@linear/sdk";

export async function createIssueRelation(
  client: LinearClient,
  issueId: string,
  relatedIssueId: string,
  type: "blocks" | "related"
): Promise<boolean> {
  const relationType =
    type === "blocks" ? IssueRelationType.Blocks : IssueRelationType.Related;
  const result = await client.createIssueRelation({
    issueId,
    relatedIssueId,
    type: relationType,
  });
  return result.success;
}
