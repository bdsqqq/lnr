import { describe, expect, mock, test } from "bun:test";
import type { LinearClient } from "@linear/sdk";
import { createCycle } from "./cycles";

const input = {
  teamId: "T1",
  name: "test cycle",
  startsAt: "2026-10-01",
  endsAt: "2026-10-14",
};

describe("createCycle", () => {
  test("preserves mutation errors for the cli error boundary", async () => {
    const error = new Error("cycle creation rejected");
    const client = {
      createCycle: mock(async () => { throw error; }),
    } as unknown as LinearClient;
    await expect(createCycle(client, input)).rejects.toBe(error);
  });

  test("preserves follow-up read errors after successful creation", async () => {
    const error = new Error("cycle read failed");
    const client = {
      createCycle: mock(async () => ({
        success: true,
        get cycle() { return Promise.reject(error); },
      })),
    } as unknown as LinearClient;
    await expect(createCycle(client, input)).rejects.toBe(error);
  });

  test("unsuccessful payload does not fetch the cycle", async () => {
    const readCycle = mock(() => { throw new Error("must not read"); });
    const client = {
      createCycle: mock(async () => ({
        success: false,
        get cycle() { return readCycle(); },
      })),
    } as unknown as LinearClient;
    await expect(createCycle(client, input)).resolves.toBeNull();
    expect(readCycle).not.toHaveBeenCalled();
  });

  test("missing cycle remains a null result", async () => {
    const client = {
      createCycle: mock(async () => ({ success: true, cycle: undefined })),
    } as unknown as LinearClient;
    await expect(createCycle(client, input)).resolves.toBeNull();
  });

  test("maps successful creation and sends dates to the sdk", async () => {
    const cycle = {
      id: "C1", number: 1, name: input.name, description: undefined,
      startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt),
      completedAt: undefined, progress: 0,
    };
    const create = mock(async () => ({ success: true, cycle: Promise.resolve(cycle) }));
    const client = { createCycle: create } as unknown as LinearClient;
    await expect(createCycle(client, input)).resolves.toEqual(cycle);
    expect(create).toHaveBeenCalledWith({
      ...input, description: undefined,
      startsAt: cycle.startsAt, endsAt: cycle.endsAt,
    });
  });
});
