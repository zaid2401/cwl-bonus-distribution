"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema as s } from "./db";
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  clearFailures,
  lockedFor,
  mintSession,
  noteFailure,
  passwordRole,
  sessionRole,
  type Role,
} from "./auth";
import { coc, enc, type ApiClan } from "./coc";
import { syncAllCwl, syncCwlClan } from "./sync";
import { clanBoard, seasonOverview } from "./view";
import {
  importCwlExport,
  importDonations,
  importHistory,
  importPlayers,
  type HistoryColumn,
} from "./imports";
import { loadRows, writeSheetTab } from "./sheets";
import { buildSeasonExport } from "./export";
import { memberKey } from "./logic";
import { normTag, seasonLabel, prevMonth } from "./util";

export type ActionResult = { ok: boolean; message: string; url?: string };

// `need` is the lowest role allowed to run the action. Admin can do everything; the bonus
// leader can only reach the few actions that say so, whatever the page happens to render.
async function guard(need: Role) {
  const jar = await cookies();
  const role = await sessionRole(jar.get(SESSION_COOKIE)?.value);
  if (!role) throw new Error("Not logged in");
  if (role !== "admin" && role !== need) throw new Error("This account can only tick and untick bonuses.");
}

async function run(fn: () => Promise<string | ActionResult>, need: Role = "admin"): Promise<ActionResult> {
  try {
    await guard(need);
    const r = await fn();
    revalidatePath("/", "layout");
    return typeof r === "string" ? { ok: true, message: r } : r;
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

// --- auth

export async function login(_: unknown, form: FormData): Promise<ActionResult> {
  if (!process.env.ADMIN_PASSWORD) return { ok: false, message: "ADMIN_PASSWORD is not set on the server." };
  // Vercel puts the caller first in the list; everything after it is whatever they claimed.
  const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const locked = lockedFor(ip);
  if (locked)
    return { ok: false, message: `Too many wrong passwords. Try again in ${Math.ceil(locked / 60)} min.` };

  const pw = String(form.get("password") ?? "");
  const role = await passwordRole(pw);
  if (!role) {
    noteFailure(ip);
    // A wrong answer is never instant, so guessing costs real time before the lockout bites.
    await new Promise((r) => setTimeout(r, 400));
    return { ok: false, message: "Wrong password." };
  }
  clearFailures(ip);
  (await cookies()).set(SESSION_COOKIE, await mintSession(role, pw), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DAYS * 86_400,
    path: "/",
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// --- clans

export async function addClan(input: { tag: string }) {
  return run(async () => {
    const tag = normTag(input.tag);
    if (tag.length < 4) throw new Error("Enter a valid clan tag.");
    const db = await getDb();
    let name = "";
    try {
      name = (await coc<ApiClan>(`/clans/${enc(tag)}`)).name;
    } catch {}
    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(${s.clans.sortOrder}), 0)` })
      .from(s.clans);
    await db
      .insert(s.clans)
      .values({ tag, name, sortOrder: Number(max) + 1 })
      .onConflictDoNothing();
    return name ? `Added ${name} (${tag}).` : `Added ${tag}. (Name will fill in after the API is reachable.)`;
  });
}

export async function updateClan(tag: string, patch: Partial<{ name: string; sortOrder: number }>) {
  return run(async () => {
    const db = await getDb();
    await db.update(s.clans).set(patch).where(eq(s.clans.tag, tag));
    return "Saved.";
  });
}

export async function deleteClan(tag: string) {
  return run(async () => {
    const db = await getDb();
    await db.delete(s.clans).where(eq(s.clans.tag, tag));
    return `Removed ${tag}. Past season data is kept.`;
  });
}

// --- players

export async function savePlayer(input: {
  tag: string;
  name?: string;
  discordId?: string | null;
  discordUsername?: string | null;
  pn?: number | null;
  isAltAccount?: boolean;
  notes?: string | null;
}) {
  return run(async () => {
    const tag = normTag(input.tag);
    if (!tag) throw new Error("Player tag is required.");
    const db = await getDb();
    const clean = (v: string | null | undefined) => (v == null ? v : v.trim() || null);
    const set: Partial<typeof s.players.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) set.name = input.name.trim();
    if (input.discordId !== undefined) set.discordId = clean(input.discordId);
    if (input.discordUsername !== undefined) set.discordUsername = clean(input.discordUsername);
    if (input.pn !== undefined) set.pn = input.pn;
    if (input.isAltAccount !== undefined) set.isAltAccount = input.isAltAccount;
    if (input.notes !== undefined) set.notes = clean(input.notes);
    await db
      .insert(s.players)
      .values({ tag, name: set.name ?? "", ...set })
      .onConflictDoUpdate({ target: s.players.tag, set });
    return "Saved.";
  });
}

export async function deletePlayer(tag: string) {
  return run(async () => {
    const db = await getDb();
    await db.delete(s.players).where(eq(s.players.tag, tag));
    return "Deleted.";
  });
}

// --- sync

export async function syncClan(tag: string) {
  return run(async () => {
    const r = await syncCwlClan(tag);
    return { ok: r.ok, message: r.message };
  });
}

export async function syncAll() {
  return run(async () => {
    const res = await syncAllCwl();
    const bad = res.filter((r) => !r.ok);
    return {
      ok: bad.length === 0,
      message:
        `${res.length - bad.length}/${res.length} clans synced.` +
        (bad.length ? " " + bad.map((b) => `${b.clanTag}: ${b.message}`).join(" | ") : ""),
    };
  });
}

// --- bonus board

type PartPatch = Partial<{
  selected: boolean;
  pn: number | null;
  attacksOverride: number | null;
  donationsOverride: number | null;
  leftJpa: boolean;
}>;

export async function updateParticipant(
  seasonId: string,
  clanTag: string,
  playerTag: string,
  patch: PartPatch,
) {
  // Ticking the bonus box is the bonus leader's whole job. Anything else in the patch,
  // even alongside `selected`, is an admin edit.
  const bonusOnly = Object.keys(patch).length === 1 && "selected" in patch;
  return run(
    async () => {
      const db = await getDb();
      const [season] = await db.select().from(s.seasons).where(eq(s.seasons.id, seasonId));
      if (season?.status === "finalized" && "selected" in patch)
        throw new Error("Season is finalized. Reopen it to change bonuses.");
      await db
        .insert(s.participants)
        .values({ seasonId, clanTag, playerTag, ...patch })
        .onConflictDoUpdate({
          target: [s.participants.seasonId, s.participants.clanTag, s.participants.playerTag],
          set: patch,
        });
      return "Saved.";
    },
    bonusOnly ? "bonus" : "admin",
  );
}

export async function addPlayerToBoard(seasonId: string, clanTag: string, rawTag: string, name: string) {
  return run(async () => {
    const tag = normTag(rawTag);
    if (!tag) throw new Error("Enter a player tag.");
    const db = await getDb();
    await db.insert(s.players).values({ tag, name }).onConflictDoNothing();
    await db.insert(s.participants).values({ seasonId, clanTag, playerTag: tag, name }).onConflictDoNothing();
    return `Added ${tag}.`;
  });
}

export async function setBonusOverride(seasonId: string, clanTag: string, value: number | null) {
  return run(async () => {
    const db = await getDb();
    await db
      .update(s.cwlClanSeasons)
      .set({ bonusOverride: value })
      .where(and(eq(s.cwlClanSeasons.seasonId, seasonId), eq(s.cwlClanSeasons.clanTag, clanTag)));
    return "Saved.";
  });
}

// --- seasons

export async function createSeason(input: {
  id: string;
  label?: string;
  sortKey?: string;
  donationSeason?: string;
}) {
  return run(async () => {
    const id = input.id.trim();
    if (!id) throw new Error("Season id is required (e.g. 2026-09).");
    const db = await getDb();
    await db
      .insert(s.seasons)
      .values({
        id,
        label: input.label?.trim() || seasonLabel(id),
        sortKey: input.sortKey?.trim() || `${id}-01`,
        donationSeason: input.donationSeason?.trim() || (/^\d{4}-\d{2}$/.test(id) ? prevMonth(id) : null),
        hasCwlData: true,
      })
      .onConflictDoNothing();
    return `Season ${id} ready.`;
  });
}

export async function updateSeason(
  id: string,
  patch: Partial<{ label: string; sortKey: string; donationSeason: string | null }>,
) {
  return run(async () => {
    const db = await getDb();
    await db.update(s.seasons).set(patch).where(eq(s.seasons.id, id));
    return "Saved.";
  });
}

export async function setClanActive(seasonId: string, clanTag: string, active: boolean) {
  return run(async () => {
    const db = await getDb();
    // Ticking clans is how you set a CWL up, so this can run before any sync has
    // created the season.
    await db
      .insert(s.seasons)
      .values({
        id: seasonId,
        label: seasonLabel(seasonId),
        sortKey: `${seasonId}-01`,
        donationSeason: prevMonth(seasonId),
      })
      .onConflictDoNothing();
    const [clan] = await db.select().from(s.clans).where(eq(s.clans.tag, clanTag));
    await db
      .insert(s.cwlClanSeasons)
      .values({ seasonId, clanTag, clanName: clan?.name ?? "", active })
      .onConflictDoUpdate({
        target: [s.cwlClanSeasons.seasonId, s.cwlClanSeasons.clanTag],
        set: { active },
      });
    return active ? "Using this clan for the season." : "Left out of this season.";
  });
}

export async function finalizeSeason(seasonId: string) {
  return run(async () => {
    const db = await getDb();
    const picked = await db
      .select({ p: s.participants, pl: s.players })
      .from(s.participants)
      .leftJoin(s.players, eq(s.players.tag, s.participants.playerTag))
      .where(and(eq(s.participants.seasonId, seasonId), eq(s.participants.selected, true)));
    await db
      .delete(s.bonusHistory)
      .where(and(eq(s.bonusHistory.seasonId, seasonId), eq(s.bonusHistory.source, "app")));
    const values = new Map<string, typeof s.bonusHistory.$inferInsert>();
    for (const { p, pl } of picked) {
      const key = memberKey(pl?.discordId, p.playerTag);
      values.set(key, { seasonId, memberKey: key, playerTag: p.playerTag, source: "app" });
    }
    if (values.size)
      await db
        .insert(s.bonusHistory)
        .values([...values.values()])
        // A pick beats whatever the import said for that member.
        .onConflictDoUpdate({
          target: [s.bonusHistory.seasonId, s.bonusHistory.memberKey],
          set: { playerTag: sql`excluded.player_tag`, source: "app" },
        });
    await db
      .update(s.seasons)
      .set({ status: "finalized", finalizedAt: new Date() })
      .where(eq(s.seasons.id, seasonId));
    return `Finalized: ${values.size} bonus(es) recorded in history.`;
  });
}

// For a season that was decided by hand and imported, tick the players it names.
// One account per member: main first, then most attacks, then most donations.
// Compares score arrays left to right, biggest wins.
function beats(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

export async function applyRecordedBonuses(seasonId: string) {
  return run(async () => {
    const db = await getDb();
    const [season] = await db.select().from(s.seasons).where(eq(s.seasons.id, seasonId));
    if (season?.status === "finalized") throw new Error("Season is finalized. Reopen it first.");
    const recorded = new Set(
      (await db.select().from(s.bonusHistory).where(eq(s.bonusHistory.seasonId, seasonId))).map(
        (h) => h.memberKey,
      ),
    );
    if (!recorded.size) throw new Error("No bonus history recorded for this season yet. Import it first.");

    const clans = (await seasonOverview(seasonId)).filter((c) => c.active);
    const best = new Map<string, { clanTag: string; playerTag: string; score: number[] }>();

    const boards = await Promise.all(clans.map((c) => clanBoard(seasonId, c.clanTag, db)));

    for (const board of boards) {
      for (const row of board.rows) {
        if (!recorded.has(row.memberKey)) continue;
        const score = [
          row.selected ? 1 : 0,
          row.isAlt ? 0 : 1,
          row.eligible ? 1 : 0,
          row.attacks,
          row.donated ?? -1,
        ];
        const current = best.get(row.memberKey);
        if (!current || beats(score, current.score)) {
          best.set(row.memberKey, { clanTag: board.clanTag, playerTag: row.tag, score });
        }
      }
    }
    if (best.size)
      await db
        .insert(s.participants)
        .values(
          [...best.values()].map((p) => ({
            seasonId,
            clanTag: p.clanTag,
            playerTag: p.playerTag,
            selected: true,
          })),
        )
        .onConflictDoUpdate({
          target: [s.participants.seasonId, s.participants.clanTag, s.participants.playerTag],
          set: { selected: true },
        });

    const missing = recorded.size - best.size;
    return (
      `Ticked ${best.size} player(s) from recorded history.` +
      (missing > 0 ? ` ${missing} recorded member(s) have no account in this season's clans.` : "")
    );
  });
}

export async function reopenSeason(seasonId: string) {
  return run(async () => {
    const db = await getDb();
    await db.update(s.seasons).set({ status: "open", finalizedAt: null }).where(eq(s.seasons.id, seasonId));
    return "Season reopened. Finalize again to update history.";
  });
}

export async function deleteSeason(seasonId: string) {
  return run(async () => {
    const db = await getDb();
    await db.delete(s.bonusHistory).where(eq(s.bonusHistory.seasonId, seasonId));
    await db.delete(s.participants).where(eq(s.participants.seasonId, seasonId));
    await db.delete(s.cwlClanSeasons).where(eq(s.cwlClanSeasons.seasonId, seasonId));
    await db.delete(s.cwlRoster).where(eq(s.cwlRoster.seasonId, seasonId));
    await db.execute(
      sql`delete from cwl_attacks where war_tag in (select war_tag from cwl_wars where season_id = ${seasonId})`,
    );
    await db.execute(
      sql`delete from cwl_war_members where war_tag in (select war_tag from cwl_wars where season_id = ${seasonId})`,
    );
    await db.delete(s.cwlWars).where(eq(s.cwlWars.seasonId, seasonId));
    await db.delete(s.seasons).where(eq(s.seasons.id, seasonId));
    return `Deleted season ${seasonId}.`;
  });
}

// --- imports

export async function previewSheet(source: string) {
  try {
    await guard("admin");
    const rows = await loadRows(source);
    return {
      ok: true as const,
      header: rows[0] ?? [],
      sample: rows.slice(1, 6),
      total: Math.max(0, rows.length - 1),
    };
  } catch (e) {
    return { ok: false as const, message: (e as Error).message };
  }
}

export async function doImportHistory(source: string, idColumn: number, columns: HistoryColumn[]) {
  return run(() => importHistory(source, idColumn, columns));
}
export async function doImportDonations(source: string, season: string, updateLinks: boolean) {
  return run(() => {
    if (!/^\d{4}-\d{2}$/.test(season.trim())) throw new Error("Season must look like 2026-08.");
    return importDonations(source, season.trim(), updateLinks);
  });
}
export async function doImportCwl(source: string, seasonId: string, clanTag: string) {
  return run(() => {
    if (!seasonId.trim() || !clanTag) throw new Error("Choose a season and a clan.");
    return importCwlExport(source, seasonId.trim(), clanTag);
  });
}
export async function doImportPlayers(source: string) {
  return run(() => importPlayers(source));
}

// --- settings and export

export async function saveSetting(key: string, value: string) {
  return run(async () => {
    const db = await getDb();
    await db
      .insert(s.settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: s.settings.key, set: { value } });
    return "Saved.";
  });
}

export async function exportSeasonToSheet(seasonId: string) {
  return run(async () => {
    const db = await getDb();
    const [row] = await db.select().from(s.settings).where(eq(s.settings.key, "exportSheetUrl"));
    if (!row?.value) throw new Error("Set the export Google Sheet link in Settings first.");
    const data = await buildSeasonExport(seasonId);
    const url = await writeSheetTab(row.value, data);
    return { ok: true, message: `Exported to tab “${data.title}”.`, url };
  });
}

export async function testApi() {
  return run(async () => {
    const r = await coc<{ items: unknown[] }>(`/locations?limit=1`);
    return r ? "Clash of Clans API is working." : "No response.";
  });
}
