import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockLinearClient = mock((options: Record<string, string>) => ({ options }));

// other suites import sdk enums in the same process, including when this file runs first.
const sdk = await import("@linear/sdk");
mock.module("@linear/sdk", () => ({
  ...sdk,
  LinearClient: mockLinearClient,
}));

const { createClientWithKey, getClient, resetClient } = await import("./client");

describe("client auth selection", () => {
  beforeEach(() => {
    mockLinearClient.mockClear();
    resetClient();
  });

  test("constructor mock preserves sdk runtime exports", async () => {
    const mockedSdk = await import("@linear/sdk");
    expect<unknown>(mockedSdk.LinearClient).toBe(mockLinearClient);
    expect<string>(mockedSdk.LinearDocument.LabelGroupType.SingleSelect).toBe("singleSelect");
    expect(mockedSdk.PaginationOrderBy).toBe(sdk.PaginationOrderBy);
    expect<string>(mockedSdk.GitAutomationStates.Start).toBe("start");
  });

  test("getClient uses accessToken for oauth token overrides", () => {
    getClient("lin_oauth_test_123");

    expect(mockLinearClient).toHaveBeenCalledWith({
      accessToken: "lin_oauth_test_123",
    });
  });

  test("getClient uses apiKey for personal api key overrides", () => {
    getClient("lin_api_test_123");

    expect(mockLinearClient).toHaveBeenCalledWith({
      apiKey: "lin_api_test_123",
    });
  });

  test("createClientWithKey uses accessToken for oauth tokens", () => {
    createClientWithKey("lin_oauth_test_456");

    expect(mockLinearClient).toHaveBeenCalledWith({
      accessToken: "lin_oauth_test_456",
    });
  });

  test("createClientWithKey uses apiKey for personal api keys", () => {
    createClientWithKey("lin_api_test_456");

    expect(mockLinearClient).toHaveBeenCalledWith({
      apiKey: "lin_api_test_456",
    });
  });
});
