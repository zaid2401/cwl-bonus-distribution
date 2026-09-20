import { eq, sql } from "drizzle-orm";
import { getDb, schema as s } from "./db";
import { findCol } from "./csv";
import { loadRows } from "./sheets";
import { normTag, prevMonth, seasonLabel, toInt, truthy } from "./util";

export interface HistoryColumn {
  index: number;
  seasonId: string;
  label: string;
  sortKey: string;
}

export async function importHistory(source: string, idColumn: number, columns: HistoryColumn[]) {
  const db = await getDb();
  const [, ...rows] = await loadRows(source);
  let marks = 0;
  for (const col of columns) {
    if (!col.seasonId.trim()) continue;
    await db
      .insert(s.seasons)
      .values({ id: col.seasonId, label: col.label || col.seasonId, sortKey: col.sortKey, status: "finalized" })
      .onConflictDoUpdate({ target: s.seasons.id, set: { label: col.label || col.seasonId, sortKey: col.sortKey } });
    await db.delete(s.bonusHistory).where(sql`${s.bonusHistory.seasonId} = ${col.seasonId} and ${s.bonusHistory.source} = 'import'`);
    const values = new Map<string, typeof s.bonusHistory.$inferInsert>();
    for (const r of rows) {
      const raw = (r[idColumn] ?? "").trim();
      if (!raw || !truthy(r[col.index])) continue;
      const key = raw.startsWith("#") ? `tag:${normTag(raw)}` : raw.replace(/^'/, "");
      values.set(key, { seasonId: col.seasonId, memberKey: key, source: "import" });
    }
    if (values.size) await db.insert(s.bonusHistory).values([...values.values()]).onConflictDoNothing();
    marks += values.size;
  }
  return `Imported ${marks} bonus marks across ${columns.filter((c) => c.seasonId.trim()).length} season(s).`;
}

// ClashPerk /export season, or any sheet with Tag and Total Donated.
export async function importDonations(source: string, season: string, updateLinks: boolean) {
  const db = await getDb();
  const [header, ...rows] = await loadRows(source);
  const cTag = findCol(header, ["Tag", "Player Tag"]);
  const cDon = findCol(header, ["Total Donated", "Donated", "Donations"]);
  const cRec = findCol(header, ["Total Received", "Received", "Donations Received"]);
  const cName = findCol(header, ["Name", "Player Name"]);
  const cUser = findCol(header, ["Username", "Discord Username"]);
  const cId = findCol(header, ["ID", "Discord ID", "User ID"]);
  if (cTag < 0 || cDon < 0) throw new Error(`Need "Tag" and "Total Donated" columns. Found: ${header.join(", ")}`);

  const byTag = new Map<string, { donated: number; received: number; name: string; user: string; id: string }>();
  for (const r of rows) {
    const tag = normTag(r[cTag]);
    if (!tag) continue;
    byTag.set(tag, {
      donated: toInt(r[cDon]) ?? 0,
      received: cRec >= 0 ? (toInt(r[cRec]) ?? 0) : 0,
      name: cName >= 0 ? r[cName].trim() : "",
      user: cUser >= 0 ? r[cUser].trim() : "",
      id: cId >= 0 ? r[cId].trim().replace(/^'/, "") : "",
    });
  }
  const entries = [...byTag.entries()];
  for (let i = 0; i < entries.length; i += 500) {
    const chunk = entries.slice(i, i + 500);
    await db
      .insert(s.donations)
      .values(chunk.map(([tag, v]) => ({ season, playerTag: tag, clanTag: "IMPORT", donated: v.donated, received: v.received })))
      .onConflictDoUpdate({
        target: [s.donations.season, s.donations.playerTag, s.donations.clanTag],
        set: { donated: sql`excluded.donated`, received: sql`excluded.received`, updatedAt: new Date() },
      });
    await db
      .insert(s.players)
      .values(
        chunk.map(([tag, v]) => ({
          tag,
          name: v.name,
          discordId: updateLinks && /^\d{15,21}$/.test(v.id) ? v.id : null,
          discordUsername: updateLinks && v.user ? v.user : null,
        })),
      )
      .onConflictDoUpdate({
        target: s.players.tag,
        set: {
          name: sql`case when excluded.name <> '' then excluded.name else ${s.players.name} end`,
          // Never clobber a link that was set by hand.
          discordId: sql`coalesce(${s.players.discordId}, excluded.discord_id)`,
          discordUsername: sql`coalesce(${s.players.discordUsername}, excluded.discord_username)`,
        },
      });
  }
  return `Imported donations for ${entries.length} players into season ${season}.`;
}

// Fallback for when the API has already dropped the war data.
export async function importCwlExport(source: string, seasonId: string, clanTag: string) {
  const db = await getDb();
  const [header, ...rows] = await loadRows(source);
  const cName = findCol(header, ["Name"]);
  const cTag = findCol(header, ["Tag"]);
  const cAtt = findCol(header, ["Number of Attacks", "Attacks"]);
  if (cTag < 0 || cAtt < 0) throw new Error(`Need "Tag" and "Number of Attacks" columns. Found: ${header.join(", ")}`);

  await db
    .insert(s.seasons)
    .values({ id: seasonId, label: seasonLabel(seasonId), sortKey: `${seasonId}-01`, donationSeason: prevMonth(seasonId), hasCwlData: true })
    .onConflictDoUpdate({ target: s.seasons.id, set: { hasCwlData: true } });
  const [clan] = await db.select().from(s.clans).where(eq(s.clans.tag, clanTag));
  await db
    .insert(s.cwlClanSeasons)
    .values({ seasonId, clanTag, clanName: clan?.name ?? "" })
    .onConflictDoNothing();

  let n = 0;
  for (const r of rows) {
    const tag = normTag(r[cTag]);
    if (!tag) continue;
    const name = cName >= 0 ? r[cName].trim() : "";
    await db
      .insert(s.participants)
      .values({ seasonId, clanTag, playerTag: tag, name, importedAttacks: toInt(r[cAtt]) ?? 0 })
      .onConflictDoUpdate({
        target: [s.participants.seasonId, s.participants.clanTag, s.participants.playerTag],
        set: { name, importedAttacks: toInt(r[cAtt]) ?? 0 },
      });
    await db.insert(s.players).values({ tag, name }).onConflictDoNothing();
    n++;
  }
  return `Imported ${n} players for ${clan?.name || clanTag}.`;
}

export async function importPlayers(source: string) {
  const db = await getDb();
  const [header, ...rows] = await loadRows(source);
  const cTag = findCol(header, ["Tag", "Player Tag"]);
  const cName = findCol(header, ["Name"]);
  const cId = findCol(header, ["ID", "Discord ID", "User ID"]);
  const cUser = findCol(header, ["Username", "Discord Username"]);
  const cPn = findCol(header, ["PN", "Priority Number", "Remarks"]);
  const cGuest = findCol(header, ["Guest"]);
  if (cTag < 0) throw new Error(`Need a "Tag" column. Found: ${header.join(", ")}`);
  let n = 0;
  for (const r of rows) {
    const tag = normTag(r[cTag]);
    if (!tag) continue;
    const pnMatch = cPn >= 0 ? /(\d+)/.exec(r[cPn] ?? "") : null;
    const set: Partial<typeof s.players.$inferInsert> = { updatedAt: new Date() };
    if (cName >= 0 && r[cName]?.trim()) set.name = r[cName].trim();
    if (cId >= 0 && r[cId]?.trim()) set.discordId = r[cId].trim().replace(/^'/, "");
    if (cUser >= 0 && r[cUser]?.trim()) set.discordUsername = r[cUser].trim();
    if (pnMatch && /pn|^\d/i.test(r[cPn])) set.pn = Number(pnMatch[1]);
    if (cGuest >= 0 && r[cGuest]?.trim()) set.isGuest = truthy(r[cGuest]);
    await db
      .insert(s.players)
      .values({ tag, name: set.name ?? "", ...set })
      .onConflictDoUpdate({ target: s.players.tag, set });
    n++;
  }
  return `Updated ${n} players.`;
}
