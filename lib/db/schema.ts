import { pgTable, text, integer, boolean, real, timestamp, primaryKey, index } from "drizzle-orm/pg-core";

export const clans = pgTable("clans", {
  tag: text("tag").primaryKey(),
  name: text("name").notNull().default(""),
  isAlliance: boolean("is_alliance").notNull().default(true),
  // 'none' | 'cwl'
  cwlType: text("cwl_type").notNull().default("none"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const players = pgTable(
  "players",
  {
    tag: text("tag").primaryKey(),
    name: text("name").notNull().default(""),
    discordId: text("discord_id"),
    discordUsername: text("discord_username"),
    // 1 = main account, 2 and up are alts.
    pn: integer("pn"),
    isGuest: boolean("is_guest").notNull().default(false),
    isTracked: boolean("is_tracked").notNull().default(false),
    notes: text("notes"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("players_discord_idx").on(t.discordId)],
);

export const seasons = pgTable("seasons", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  sortKey: text("sort_key").notNull(),
  // Which game season's donations this CWL uses, e.g. 2026-08.
  donationSeason: text("donation_season"),
  // 'open' | 'finalized'
  status: text("status").notNull().default("open"),
  // false when the season is only imported history.
  hasCwlData: boolean("has_cwl_data").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
});

export const cwlClanSeasons = pgTable(
  "cwl_clan_seasons",
  {
    seasonId: text("season_id").notNull(),
    clanTag: text("clan_tag").notNull(),
    clanName: text("clan_name").notNull().default(""),
    // Off for a clan that is added but not being used this CWL.
    active: boolean("active").notNull().default(true),
    bonusOverride: integer("bonus_override"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    syncMessage: text("sync_message"),
  },
  (t) => [primaryKey({ columns: [t.seasonId, t.clanTag] })],
);

export const cwlWars = pgTable(
  "cwl_wars",
  {
    warTag: text("war_tag").primaryKey(),
    seasonId: text("season_id").notNull(),
    round: integer("round").notNull(),
    clanTag: text("clan_tag").notNull(),
    clanName: text("clan_name").notNull().default(""),
    opponentTag: text("opponent_tag").notNull(),
    opponentName: text("opponent_name").notNull().default(""),
    state: text("state").notNull(),
    teamSize: integer("team_size").notNull().default(0),
    clanStars: integer("clan_stars").notNull().default(0),
    clanDestruction: real("clan_destruction").notNull().default(0),
    opponentStars: integer("opponent_stars").notNull().default(0),
    opponentDestruction: real("opponent_destruction").notNull().default(0),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("cwl_wars_season_clan_idx").on(t.seasonId, t.clanTag),
    index("cwl_wars_season_opp_idx").on(t.seasonId, t.opponentTag),
  ],
);

export const cwlWarMembers = pgTable(
  "cwl_war_members",
  {
    warTag: text("war_tag").notNull(),
    clanTag: text("clan_tag").notNull(),
    playerTag: text("player_tag").notNull(),
    name: text("name").notNull().default(""),
    townhall: integer("townhall"),
    mapPosition: integer("map_position").notNull(),
  },
  (t) => [primaryKey({ columns: [t.warTag, t.playerTag] })],
);

export const cwlAttacks = pgTable(
  "cwl_attacks",
  {
    warTag: text("war_tag").notNull(),
    round: integer("round").notNull(),
    clanTag: text("clan_tag").notNull(),
    attackerTag: text("attacker_tag").notNull(),
    defenderTag: text("defender_tag").notNull(),
    attackerPosition: integer("attacker_position").notNull(),
    defenderPosition: integer("defender_position").notNull(),
    stars: integer("stars").notNull(),
    destruction: real("destruction").notNull(),
    order: integer("order").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.warTag, t.attackerTag, t.order] }),
    index("cwl_attacks_clan_idx").on(t.clanTag),
  ],
);

export const cwlRoster = pgTable(
  "cwl_roster",
  {
    seasonId: text("season_id").notNull(),
    clanTag: text("clan_tag").notNull(),
    playerTag: text("player_tag").notNull(),
    name: text("name").notNull().default(""),
    townhall: integer("townhall"),
  },
  (t) => [primaryKey({ columns: [t.seasonId, t.clanTag, t.playerTag] })],
);

export const participants = pgTable(
  "participants",
  {
    seasonId: text("season_id").notNull(),
    clanTag: text("clan_tag").notNull(),
    playerTag: text("player_tag").notNull(),
    name: text("name"),
    selected: boolean("selected").notNull().default(false),
    transferToTag: text("transfer_to_tag"),
    attacksOverride: integer("attacks_override"),
    donationsOverride: integer("donations_override"),
    importedAttacks: integer("imported_attacks"),
    remark: text("remark"),
    hidden: boolean("hidden").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.seasonId, t.clanTag, t.playerTag] })],
);

// clanTag 'IMPORT' means the row came from a sheet, and those beat API snapshots.
export const donations = pgTable(
  "donations",
  {
    season: text("season").notNull(),
    playerTag: text("player_tag").notNull(),
    clanTag: text("clan_tag").notNull(),
    donated: integer("donated").notNull().default(0),
    received: integer("received").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.season, t.playerTag, t.clanTag] })],
);

export const bonusHistory = pgTable(
  "bonus_history",
  {
    seasonId: text("season_id").notNull(),
    memberKey: text("member_key").notNull(),
    playerTag: text("player_tag"),
    // 'import' | 'app'
    source: text("source").notNull().default("app"),
  },
  (t) => [primaryKey({ columns: [t.seasonId, t.memberKey] })],
);

// Counters only go up inside a season, so every write keeps the highest value seen.
export const playerStats = pgTable(
  "player_stats",
  {
    season: text("season").notNull(),
    playerTag: text("player_tag").notNull(),
    name: text("name").notNull().default(""),
    clanTag: text("clan_tag"),
    clanName: text("clan_name"),
    donated: integer("donated").notNull().default(0),
    received: integer("received").notNull().default(0),
    attackWins: integer("attack_wins").notNull().default(0),
    // Lifetime Conqueror value: every multiplayer win, ranked or not.
    attacksTotal: integer("attacks_total"),
    // Where Conqueror stood when the season started.
    attacksBase: integer("attacks_base"),
    defenseWins: integer("defense_wins").notNull().default(0),
    trophies: integer("trophies"),
    townhall: integer("townhall"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.season, t.playerTag] })],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
