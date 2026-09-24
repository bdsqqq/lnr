import { expect, mock, test } from "bun:test";
import { registerViewReceipt, type OwnedFixture } from "./live-test-support";

const id = "12345678-1234-1234-1234-123456789abc";
const receipt = `created view: audit (${id})`;
const fixture = (): OwnedFixture => ({ name: "audit", remove: mock(async () => {}) });

test("receipt retains ownership when the following independent list fails", async () => {
  const owned = fixture();
  const failure = new Error("list failed");
  const list = mock(async () => {
    expect(owned.id).toBe(id);
    throw failure;
  });
  await expect((async () => {
    registerViewReceipt(receipt, owned);
    await list();
  })()).rejects.toBe(failure);
  expect(owned.id).toBe(id);
  expect(list).toHaveBeenCalledTimes(1);
  expect(owned.remove).not.toHaveBeenCalled();
});
test("invalid or unanchored receipts never register ownership", () => {
  for (const output of ["created view: audit", `prefix ${receipt}`, `${receipt} suffix`, receipt.replace("audit", "other")]) {
    const owned = fixture();
    expect(() => registerViewReceipt(output, owned)).toThrow("missing or invalid");
    expect(owned.id).toBeUndefined();
  }
});
