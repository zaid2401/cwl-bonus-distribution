/** Normalise a player/clan tag: uppercase, '#' prefix, O→0 (common typo). */
export function normTag(raw: string | null | undefined): string {
  const t = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/^#+/, "")
    .replace(/O/g, "0")
    .replace(/[^0-9A-Z]/g, "");
  return t ? `#${t}` : "";
}

/** Tag safe for URLs (no '#'). */
export const tagSlug = (tag: string) => tag.replace(/^#/, "");
export const slugTag = (slug: string) => normTag(decodeURIComponent(slug));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Game (donation) season id for a moment in time.
 * A season ends on the last Monday of the month at 05:00 UTC.
 */
export function gameSeasonAt(d: Date): string {
  let y = d.getUTCFullYear();
  let m = d.getUTCMonth();
  if (d.getTime() >= seasonEnd(y, m).getTime()) {
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

export function seasonEnd(year: number, month0: number): Date {
  const last = new Date(Date.UTC(year, month0 + 1, 0, 5));
  const back = (last.getUTCDay() + 6) % 7; // days since Monday
  last.setUTCDate(last.getUTCDate() - back);
  return last;
}

/**
 * The API reports a CWL season as the group's start date (e.g. "2026-09-01"), and groups
 * can start on different days — so we key seasons by month only.
 */
export function cwlSeasonId(apiSeason: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(String(apiSeason ?? "").trim());
  return m ? `${m[1]}-${m[2]}` : String(apiSeason ?? "").trim();
}

export function prevMonth(season: string): string {
  const [y, m] = season.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function seasonLabel(season: string): string {
  const m = /^(\d{4})-(\d{2})(.*)$/.exec(season);
  if (!m) return season;
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}${m[3] ? " " + m[3].replace(/^[-_]/, "#") : ""}`;
}

/** Best-effort guess of a season id from a sheet header like "MAY", "JULY", "6/1/2026", "2026-06-01". */
export function guessSeasonFromHeader(header: string, now = new Date()): { id: string; sortKey: string } | null {
  const h = header.trim();
  const iso = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/.exec(h);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(h);
  let y: number | undefined, m: number | undefined, day = 1;
  if (iso) [y, m, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3] ?? 1)];
  else if (us) [y, m, day] = [Number(us[3]), Number(us[1]), Number(us[2])];
  else {
    const idx = MONTHS.findIndex((mm) => h.toLowerCase().startsWith(mm.toLowerCase()));
    if (idx < 0) return null;
    m = idx + 1;
    y = now.getUTCFullYear();
    if (m > now.getUTCMonth() + 1) y -= 1;
  }
  const mm = String(m).padStart(2, "0");
  return { id: `${y}-${mm}`, sortKey: `${y}-${mm}-${String(day).padStart(2, "0")}` };
}

export function truthy(v: unknown): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return ["true", "yes", "y", "1", "x", "✓", "✔", "✅"].includes(s);
}

export function toInt(v: unknown): number | null {
  const s = String(v ?? "").replace(/[, ]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
