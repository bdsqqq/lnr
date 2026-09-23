import { expect, mock, test } from "bun:test";
import type { LinearClient } from "@linear/sdk";
import { createView } from "./views";

const input = { name: "audit", filterData: {}, shared: false };
const view = {
  id: "view-id", ...input, description: undefined, icon: undefined,
  color: undefined, createdAt: new Date(0), updatedAt: new Date(0),
};
test("unconfirmed creation never accesses the lazy entity or retries", async () => {
  for (const success of [false, undefined]) {
    const read = mock(() => Promise.resolve(view));
    const create = mock(async () => ({
      success, get customView() { return read(); },
    }));
    const client = { createCustomView: create } as unknown as LinearClient;
    await expect(createView(client, input)).resolves.toBeNull();
    expect(read).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  }
});
test("confirmed creation returns the entity and preserves false shared", async () => {
  const create = mock(async () => ({ success: true, customView: Promise.resolve(view) }));
  const client = { createCustomView: create } as unknown as LinearClient;
  await expect(createView(client, input)).resolves.toEqual(view);
  expect(create).toHaveBeenCalledWith({ ...input, description: undefined, icon: undefined, color: undefined });
});
