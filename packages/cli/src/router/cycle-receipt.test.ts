import { expect, mock, spyOn, test } from "bun:test";

const core = await import("@bdsqqq/lnr-core");
const archiveCycle = mock(async (_id: string) => ({ success: true }));
mock.module("@bdsqqq/lnr-core", () => ({
  ...core,
  getClient: () => ({ archiveCycle }),
  getCycle: async () => ({ id: "immutable-cycle-id", name: "cycle", number: 1 }),
}));
const { cyclesRouter } = await import("./cycles");

test("archive output identifies the exact sdk mutation target", async () => {
  const output = spyOn(console, "log").mockImplementation(() => {});
  try {
    await cyclesRouter.createCaller({}).cycle({ nameOrNumber: "1", team: "ENG", delete: true });
    expect(archiveCycle).toHaveBeenCalledTimes(1);
    expect(archiveCycle).toHaveBeenCalledWith("immutable-cycle-id");
    expect(output).toHaveBeenCalledWith("archived cycle: cycle (immutable-cycle-id)");
  } finally {
    output.mockRestore();
  }
});
