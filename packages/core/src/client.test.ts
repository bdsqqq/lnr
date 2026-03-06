import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockLinearClient = mock((options: Record<string, string>) => ({ options }));

mock.module("@linear/sdk", () => ({
  LinearClient: mockLinearClient,
}));

const { createClientWithKey, getClient, resetClient } = await import("./client");

describe("client auth selection", () => {
  beforeEach(() => {
    mockLinearClient.mockClear();
    resetClient();
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
