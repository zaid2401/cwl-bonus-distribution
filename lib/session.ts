import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, sessionRole, type Role } from "./auth";
import { listSeasons } from "./view";

// What pages call to decide what to render. Server actions do their own check in `run()`,
// because hiding a control is not the same as refusing the write.
export async function currentRole(): Promise<Role | null> {
  return sessionRole((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function isAdmin(): Promise<boolean> {
  return (await currentRole()) === "admin";
}

// Every season page starts here. The bonus leader gets the CWL that is on now and nothing
// older, so a stale link or a typed id puts them back on it.
export async function seasonGate(seasonId: string): Promise<boolean> {
  if ((await currentRole()) === "admin") return true;
  const [latest] = await listSeasons();
  if (latest?.id !== seasonId) redirect("/");
  return false;
}
