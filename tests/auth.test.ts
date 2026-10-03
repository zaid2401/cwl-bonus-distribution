import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_DAYS,
  clearFailures,
  lockedFor,
  mintSession,
  noteFailure,
  passwordRole,
  sessionRole,
} from "../lib/auth";

process.env.ADMIN_PASSWORD = "admin-pw";
process.env.BONUS_PASSWORD = "bonus-pw";
// The signing key is the password plus AUTH_SECRET, so the tests fix both ends of it.
delete process.env.AUTH_SECRET;

test("the password decides which account you get", async () => {
  assert.equal(await passwordRole("admin-pw"), "admin");
  assert.equal(await passwordRole("bonus-pw"), "bonus");
  assert.equal(await passwordRole("something else"), null);
  assert.equal(await passwordRole(""), null);
});

test("a cookie says which password minted it", async () => {
  assert.equal(await sessionRole(await mintSession("admin", "admin-pw")), "admin");
  assert.equal(await sessionRole(await mintSession("bonus", "bonus-pw")), "bonus");
  assert.equal(await sessionRole(await mintSession("admin", "old-pw")), null);
  assert.equal(await sessionRole(undefined), null);
  assert.equal(await sessionRole("deadbeef"), null);
});

test("a bonus cookie cannot be edited into an admin one", async () => {
  const bonus = await mintSession("bonus", "bonus-pw");
  const [, , expiry, sig] = bonus.split(".");
  assert.equal(await sessionRole(`v1.admin.${expiry}.${sig}`), null);
  // Nor can the expiry be pushed out, because it is inside the signature.
  assert.equal(await sessionRole(`v1.bonus.${Number(expiry) + 86_400_000}.${sig}`), null);
});

test("an expired cookie is no cookie", async () => {
  const fresh = await mintSession("admin", "admin-pw");
  const expiry = Number(fresh.split(".")[2]);
  assert.ok(expiry > Date.now() && expiry <= Date.now() + SESSION_DAYS * 86_400_000);
  // Signed in the past, so it verifies and is still refused.
  const { createHmac } = await import("node:crypto");
  const payload = `v1.admin.${Date.now() - 1000}`;
  const sig = createHmac("sha256", "admin-pw\n").update(payload).digest("hex");
  assert.equal(await sessionRole(`${payload}.${sig}`), null);
});

test("no bonus password means no second account", async () => {
  delete process.env.BONUS_PASSWORD;
  assert.equal(await passwordRole("bonus-pw"), null);
  assert.equal(await sessionRole(await mintSession("bonus", "bonus-pw")), null);
  process.env.BONUS_PASSWORD = "bonus-pw";
});

test("ten wrong passwords lock that caller out", () => {
  clearFailures("1.2.3.4");
  for (let i = 0; i < 9; i++) noteFailure("1.2.3.4");
  assert.equal(lockedFor("1.2.3.4"), 0);
  noteFailure("1.2.3.4");
  assert.ok(lockedFor("1.2.3.4") > 0, "the tenth miss locks");
  assert.equal(lockedFor("5.6.7.8"), 0, "and only for that caller");
  clearFailures("1.2.3.4");
  assert.equal(lockedFor("1.2.3.4"), 0, "a right password clears the count");
});
