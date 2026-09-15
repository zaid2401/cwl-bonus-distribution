const DEFAULT_BASE = "https://cocproxy.royaleapi.dev/v1";

export class CocError extends Error {
  constructor(
    public status: number,
    public reason: string,
    message: string,
  ) {
    super(message);
  }
}

export async function coc<T>(path: string): Promise<T> {
  const token = process.env.COC_API_TOKEN;
  if (!token) throw new CocError(0, "noToken", "COC_API_TOKEN is not set");
  const base = (process.env.COC_API_BASE || DEFAULT_BASE).replace(/\/$/, "");
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(base + path, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (res.ok) return (await res.json()) as T;
    if ((res.status === 429 || res.status === 503) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    let reason = "unknown";
    let message = res.statusText;
    try {
      const body = await res.json();
      reason = body.reason ?? reason;
      message = body.message ?? message;
    } catch {}
    if (res.status === 403) message = `Access denied (${reason}). Check the token and that IP 45.79.218.79 is whitelisted.`;
    throw new CocError(res.status, reason, message);
  }
}

export const enc = (tag: string) => encodeURIComponent(tag);

/** Run tasks with limited concurrency. */
export async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

// ---- API types (only the fields we use) ----

export interface ApiMember {
  tag: string;
  name: string;
  townHallLevel?: number;
  townhallLevel?: number;
  mapPosition?: number;
  attacks?: { attackerTag: string; defenderTag: string; stars: number; destructionPercentage: number; order: number }[];
  donations?: number;
  donationsReceived?: number;
}

export interface ApiLeagueGroup {
  state: string;
  season: string;
  clans: { tag: string; name: string; members: ApiMember[] }[];
  rounds: { warTags: string[] }[];
}

export interface ApiWarClan {
  tag: string;
  name: string;
  stars: number;
  destructionPercentage: number;
  members?: ApiMember[];
}

export interface ApiWar {
  state: string;
  teamSize: number;
  clan: ApiWarClan;
  opponent: ApiWarClan;
}

export interface ApiClan {
  tag: string;
  name: string;
  warLeague?: { name: string };
  memberList?: ApiMember[];
}
