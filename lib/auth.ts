export const SESSION_COOKIE = "cwl_session";

export async function sessionToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("jpa-cwl-bonus-session-v1"));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const authDisabled = () => !process.env.ADMIN_PASSWORD && process.env.NODE_ENV !== "production";

export async function isValidSession(cookie: string | undefined): Promise<boolean> {
  if (authDisabled()) return true;
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || !cookie) return false;
  const expected = await sessionToken(pw);
  if (cookie.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= cookie.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
