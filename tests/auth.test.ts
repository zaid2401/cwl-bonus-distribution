import { test } from "node:test";
import assert from "node:assert/strict";
import { passwordRole, sessionRole, sessionToken } from "../lib/auth";

process.env.ADMIN_PASSWORD = "admin-pw";
process.env.BONUS_PASSWORD = "bonus-pw";

test("the password decides which account you get", () => {
  assert.equal(passwordRole("admin-pw"), "admin");
  assert.equal(passwordRole("bonus-pw"), "bonus");
  assert.equal(passwordRole("something else"), null);
  assert.equal(passwordRole(""), null);
});

test("a cookie says which password minted it", async () => {
  assert.equal(await sessionRole(await sessionToken("admin-pw")), "admin");
  assert.equal(await sessionRole(await sessionToken("bonus-pw")), "bonus");
  assert.equal(await sessionRole(await sessionToken("old-pw")), null);
  assert.equal(await sessionRole(undefined), null);
  assert.equal(await sessionRole("deadbeef"), null);
});

test("no bonus password means no second account", async () => {
  delete process.env.BONUS_PASSWORD;
  assert.equal(passwordRole("bonus-pw"), null);
  assert.equal(await sessionRole(await sessionToken("bonus-pw")), null);
  process.env.BONUS_PASSWORD = "bonus-pw";
});
