export const SESSION_COOKIE = "cwl_session";

// Two accounts: Zaid runs everything, the bonus leader only ticks the boxes.
export type Role = "admin" | "bonus";

const PASSWORD_ENV: Record<Role, string> = { admin: "ADMIN_PASSWORD", bonus: "BONUS_PASSWORD" };

export async function sessionToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("jpa-cwl-bonus-session-v1"));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const authDisabled = () => !process.env.ADMIN_PASSWORD && process.env.NODE_ENV !== "production";

export function passwordRole(given: string): Role | null {
  if (!given) return null;
  for (const role of ["admin", "bonus"] as const) {
    if (given === process.env[PASSWORD_ENV[role]]) return role;
  }
  return null;
}

function sameToken(cookie: string, expected: string): boolean {
  if (cookie.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= cookie.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

// The cookie is a signature of whichever password minted it, so it says who is asking.
export async function sessionRole(cookie: string | undefined): Promise<Role | null> {
  if (authDisabled()) return "admin";
  if (!cookie) return null;
  for (const role of ["admin", "bonus"] as const) {
    const pw = process.env[PASSWORD_ENV[role]];
    if (pw && sameToken(cookie, await sessionToken(pw))) return role;
  }
  return null;
}

export async function isValidSession(cookie: string | undefined): Promise<boolean> {
  return (await sessionRole(cookie)) !== null;
}
