import { seasonOverview, clanBoard } from "./view";
import type { SheetExport } from "./sheets";
import { REQUIRED_ATTACKS } from "./logic";
import { getDb, schema as s } from "./db";
import { eq } from "drizzle-orm";

/** Builds the season sheet in the same layout as the original "Combined" sheet. */
export async function buildSeasonExport(seasonId: string): Promise<SheetExport> {
  const db = await getDb();
  const [season] = await db.select().from(s.seasons).where(eq(s.seasons.id, seasonId));
  if (!season) throw new Error("Season not found");
  const clans = await seasonOverview(seasonId);

  const rows: SheetExport["rows"] = [];
  const greenRows: number[] = [];
  const goldRows: number[] = [];
  let header: string[] | null = null;

  for (const c of clans) {
    const board = await clanBoard(seasonId, c.clanTag, db);
    if (!header) {
      header = [
        "Name",
        "Tag",
        "Number of Attacks",
        "CWL Clan",
        "Total Donated",
        "Username",
        "ID",
        ...[...board.prevSeasons].reverse().map((p) => p.label),
        season.label,
        "Bonus",
        "Remarks",
      ];
      rows.push(header);
    }
    const nameByTag = new Map(board.rows.map((r) => [r.tag, r.name]));
    board.rows.forEach((r, i) => {
      const remarks: string[] = [];
      if (r.pn != null) remarks.push(`PN${r.pn}`);
      if (r.isGuest) remarks.push("Guest");
      if (r.selected && r.transferToTag)
        remarks.push(`Bonus → ${nameByTag.get(r.transferToTag) ?? r.otherAccounts.find((o) => o.tag === r.transferToTag)?.name ?? r.transferToTag}`);
      if (r.remark) remarks.push(r.remark);
      const idx = rows.length;
      rows.push([
        r.name,
        r.tag,
        r.attacks,
        board.clanName,
        r.donated || "",
        r.discordUsername ?? "",
        r.discordId ? `'${r.discordId}` : "",
        ...[...r.history].reverse().map((h) => (h ? "TRUE" : "FALSE")),
        r.selected ? "TRUE" : "FALSE",
        i === 0 ? board.bonuses : "",
        remarks.join(" · "),
      ]);
      if (r.selected) goldRows.push(idx);
      else if (r.attacks >= REQUIRED_ATTACKS) greenRows.push(idx);
    });
    rows.push([]);
  }
  if (!header) rows.push(["No clans in this season"]);
  const width = header?.length ?? 1;
  return {
    title: `CWL ${season.label}`,
    rows: rows.map((r) => (r.length ? r : Array(width).fill(""))),
    greenRows,
    goldRows,
  };
}
