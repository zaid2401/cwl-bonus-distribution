// The clashwithjpa.com API. Members apply for CWL there and pick a preference number, so
// that site is where PN comes from — this app only reads it.
const BASE = process.env.JPA_API_BASE ?? "https://api.clashwithjpa.com";

type Envelope<T> = { success: true; data: T } | { success: false; error: unknown };

async function get<T>(path: string): Promise<T> {
  const key = process.env.JPA_API_KEY;
  if (!key) throw new Error("JPA_API_KEY is not set. Add it in Vercel and redeploy.");
  const res = await fetch(`${BASE}${path}`, {
    cache: "no-store",
    headers: {
      "x-api-key": key,
      accept: "application/json",
      // Cloudflare fronts that API and turns away callers that look like a script,
      // which a serverless function with no user agent very much does.
      "user-agent": "jpa-cwl-bonus (+https://cwl-bonus-distribution.vercel.app)",
    },
  });
  const text = await res.text();
  let body: Envelope<T> | null = null;
  try {
    body = JSON.parse(text) as Envelope<T>;
  } catch {}

  if (!body) {
    // The API answers in JSON even when it refuses you, so anything else came from in
    // front of it and the key was never looked at.
    const edge = res.headers.get("cf-ray") ? "Cloudflare" : (res.headers.get("server") ?? "something");
    throw new Error(
      `clashwithjpa ${path}: ${res.status} from ${edge}, not from the API — the key was never checked. ` +
        `Allow this app through the WAF. (${text
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 120)})`,
    );
  }
  if (!body.success) {
    const e = body.error;
    throw new Error(`clashwithjpa ${path}: ${res.status} ${typeof e === "string" ? e : JSON.stringify(e)}`);
  }
  return body.data;
}

export type JpaSeason = { id: number; name: string; month: string; year: number; createdAt: string };

export async function jpaSeasons(): Promise<JpaSeason[]> {
  return (await get<{ seasons: JpaSeason[] }>("/admin/cwl-seasons")).seasons;
}

export type JpaApplication = {
  discordUserId: string;
  discordUsername: string;
  cocAccountName: string;
  cocAccountTag: string;
  isExternal: boolean;
  preferenceNum: number;
  assignedTo: string | null;
};

// 300-odd applicants a season, so this pages rather than guessing a limit that holds.
export async function jpaApplications(seasonId: number): Promise<JpaApplication[]> {
  const out: JpaApplication[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await get<{ applications: JpaApplication[]; total: number }>(
      `/admin/cwl-applications?seasonId=${seasonId}&limit=100&offset=${offset}`,
    );
    out.push(...page.applications);
    if (out.length >= page.total || page.applications.length === 0) return out;
  }
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

// Their seasons are {month: "June", year: 2026}; ours are "2026-06", with "-2" on a second
// CWL in the same month. Only the month is shared, so a repeat pairs up oldest first.
export function matchSeason(ourId: string, theirs: JpaSeason[]): JpaSeason | undefined {
  const m = /^(\d{4})-(\d{2})(?:-(\d+))?$/.exec(ourId);
  if (!m) return undefined;
  const [, year, month, nth] = m;
  const sameMonth = theirs
    .filter((t) => t.year === Number(year) && MONTHS.indexOf(t.month.toLowerCase()) + 1 === Number(month))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return sameMonth[Number(nth ?? 1) - 1];
}
