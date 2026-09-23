import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import * as config from "./config";

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

  test("per-call redirect policy reaches a fresh authenticated SDK client", () => {
    getClient("lin_oauth_test_123", { redirect: "error" });
    getClient("lin_oauth_test_123", { redirect: "error" });
    expect(mockLinearClient).toHaveBeenCalledTimes(2);
    expect(mockLinearClient).toHaveBeenCalledWith({
      accessToken: "lin_oauth_test_123", redirect: "error",
    });
  });

  test.each([false, true])("transport policy neither populates nor replaces shared cache (warm=%s)", warm => {
    const key = spyOn(config, "getApiKey").mockReturnValue("lin_api_fixture");
    try {
      const before = warm ? getClient() : undefined;
      const scoped = getClient(undefined, { redirect: "error" });
      const shared = getClient();
      expect(scoped).not.toBe(shared);
      if (warm) expect(shared).toBe(before!);
      expect<unknown>(shared).toEqual({ options: { apiKey: "lin_api_fixture" } });
      expect(mockLinearClient).toHaveBeenCalledTimes(2);
    } finally { key.mockRestore(); resetClient(); }
  });

  test("createClientWithKey uses apiKey for personal api keys", () => {
    createClientWithKey("lin_api_test_456");

    expect(mockLinearClient).toHaveBeenCalledWith({
      apiKey: "lin_api_test_456",
    });
  });
});
