export const SESSION_COOKIE = "cwl_session";
export const SESSION_DAYS = 30;

// Two accounts: Zaid runs everything, the bonus leader only ticks the boxes.
export type Role = "admin" | "bonus";

const PASSWORD_ENV: Record<Role, string> = { admin: "ADMIN_PASSWORD", bonus: "BONUS_PASSWORD" };

const hex = (b: ArrayBuffer) =>
  Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");

// The password is the key, so a signature can only be made by whoever knows it. AUTH_SECRET
// goes into the key as well: without it, a stolen cookie is an offline guessing game against
// a short password, and with it the cookie says nothing about the password at all.
async function sign(payload: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(`${password}\n${process.env.AUTH_SECRET ?? ""}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
}

// `v1.<role>.<expiry>.<signature>`. The role is in the signed part, so a bonus cookie cannot
// be edited into an admin one without the admin password. The expiry is signed too, which is
// what makes a copied cookie stop working — `maxAge` alone only asks the browser nicely.
export async function mintSession(role: Role, password: string): Promise<string> {
  const payload = `v1.${role}.${Date.now() + SESSION_DAYS * 86_400_000}`;
  return `${payload}.${await sign(payload, password)}`;
}

export const authDisabled = () => !process.env.ADMIN_PASSWORD && process.env.NODE_ENV !== "production";

function sameDigest(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < b.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Signing both sides and comparing the digests takes the same time whatever the guess is,
// and leaks neither the length of the password nor how much of it was right.
export async function passwordRole(given: string): Promise<Role | null> {
  if (!given) return null;
  const mine = await sign("password-check", given);
  for (const role of ["admin", "bonus"] as const) {
    const pw = process.env[PASSWORD_ENV[role]];
    if (pw && sameDigest(mine, await sign("password-check", pw))) return role;
  }
  return null;
}

export async function sessionRole(cookie: string | undefined): Promise<Role | null> {
  if (authDisabled()) return "admin";
  if (!cookie) return null;
  const [version, role, expiry, sig] = cookie.split(".");
  if (version !== "v1" || !sig) return null;
  if (role !== "admin" && role !== "bonus") return null;
  if (!/^\d{1,16}$/.test(expiry) || Number(expiry) < Date.now()) return null;
  const pw = process.env[PASSWORD_ENV[role]];
  if (!pw) return null;
  return sameDigest(sig, await sign(`v1.${role}.${expiry}`, pw)) ? role : null;
}

// --- login throttle
//
// Guessing the password is the only way in from outside, so wrong answers get slower and ten
// of them in a row cost that caller fifteen minutes. In memory on purpose: a shared counter
// would mean a database write per attempt, and one warm instance is enough to make guessing
// hopeless when every miss also costs a round trip.
const MAX_FAILS = 10;
const LOCK_MS = 15 * 60_000;
const MAX_TRACKED = 5_000;
const fails = new Map<string, { n: number; until: number }>();

function prune(now: number) {
  for (const [ip, f] of fails) if (f.until < now) fails.delete(ip);
  // A caller can claim any X-Forwarded-For, so the table itself must not be allowed to grow.
  if (fails.size > MAX_TRACKED)
    for (const ip of [...fails.keys()].slice(0, fails.size - MAX_TRACKED)) fails.delete(ip);
}

// Seconds left before this caller may try again, or 0.
export function lockedFor(ip: string): number {
  const now = Date.now();
  prune(now);
  const f = fails.get(ip);
  return f && f.n >= MAX_FAILS && f.until > now ? Math.ceil((f.until - now) / 1000) : 0;
}

export function noteFailure(ip: string): void {
  const now = Date.now();
  prune(now);
  const f = fails.get(ip);
  fails.set(ip, { n: f && f.until > now ? f.n + 1 : 1, until: now + LOCK_MS });
}

export function clearFailures(ip: string): void {
  fails.delete(ip);
}
