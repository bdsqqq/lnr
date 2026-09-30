interface PaginatedConnection {
  pageInfo: {
    hasNextPage: boolean;
    startCursor?: string | null;
    endCursor?: string | null;
  };
  fetchNext(): Promise<unknown>;
}

/** sdk fetchNext mutates the connection and replaces its nodes array; read nodes only after traversal. */
export async function exhaustConnection(
  connection: PaginatedConnection,
  failureMessage: string
): Promise<void> {
  const seen = new Set<string>();
  const initialStartCursor = connection.pageInfo.startCursor;
  while (connection.pageInfo.hasNextPage) {
    const cursor = connection.pageInfo.endCursor;
    if (!cursor || seen.has(cursor)) {
      throw new Error(failureMessage);
    }
    seen.add(cursor);
    await connection.fetchNext();
    // sdk substitutes the initial start for a missing end. forbid that fallback
    // only after the first fetch: a one-item initial page has equal start/end.
    if (initialStartCursor) seen.add(initialStartCursor);
  }
}
