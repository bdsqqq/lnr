import { expect, mock, test } from "bun:test";
import { cleanupOwned, registerProjectReceipt, type OwnedFixture } from "./live-test-support";

const id = "12345678-1234-1234-1234-123456789abc";
const name = "audit (project).*";
const receipt = `created project: ${name} (${id})`;

test("project receipt retains ownership when the independent listing fails", async () => {
  const remove = mock(async (_id: string) => ({ success: true }));
  const fixture: OwnedFixture = { name, remove };
  const failure = new Error("listing failed");
  const list = mock(async () => { throw failure; });
  await expect((async () => {
    expect(registerProjectReceipt(receipt, fixture)).toBe(id);
    await list();
  })()).rejects.toBe(failure);
  expect(fixture.id).toBe(id);
  await cleanupOwned([fixture]);
  expect(remove).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledWith(id);
});

for (const output of [
  "", `created project: ${name}`, `created project: other (${id})`,
  `created view: ${name} (${id})`, `created project: ${name} (not-a-uuid)`,
  `prefix ${receipt}`, `${receipt} suffix`, `${receipt}\n`, `${receipt}\nextra`,
  `${receipt}\n${receipt}`, receipt.replace(id, id.slice(1)),
]) {
  test(`invalid project receipt leaves ownership unchanged: ${JSON.stringify(output)}`, () => {
    const fixture: OwnedFixture = { name, remove: async () => ({ success: true }) };
    expect(() => registerProjectReceipt(output, fixture)).toThrow("missing or invalid project creation receipt");
    expect(fixture.id).toBeUndefined();
  });
}
