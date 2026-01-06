import { IssueRelationType, type LinearClient } from "@linear/sdk";

export async function createIssueRelation(
  client: LinearClient,
  issueId: string,
  relatedIssueId: string,
  type: "blocks" | "related"
) {
  const relationType =
    type === "blocks" ? IssueRelationType.Blocks : IssueRelationType.Related;
  return client.createIssueRelation({
    issueId,
    relatedIssueId,
    type: relationType,
  });
}
