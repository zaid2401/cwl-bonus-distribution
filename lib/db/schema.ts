import {
  pgTable,
  text,
  integer,
  boolean,
  real,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

/** Clans you track. A clan can be an alliance clan (donations tracked), a CWL clan, or both. */
export const clans = pgTable("clans", {
  tag: text("tag").primaryKey(),
  name: text("name").notNull().default(""),
  isAlliance: boolean("is_alliance").notNull().default(true),
  /** 'none' | 'cwl' */
  cwlType: text("cwl_type").notNull().default("none"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Player identity. Discord link, PN and guest flag are editable (later filled by your website API). */
export const players = pgTable(
  "players",
  {
    tag: text("tag").primaryKey(),
    name: text("name").notNull().default(""),
    discordId: text("discord_id"),
    discordUsername: text("discord_username"),
    /** Priority number from the application. 1 = main, 2+ = alt. */
    pn: integer("pn"),
    isGuest: boolean("is_guest").notNull().default(false),
    notes: text("notes"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("players_discord_idx").on(t.discordId)],
);

/** A CWL season (event). id is usually the API season, e.g. "2026-09". sortKey orders history. */
export const seasons = pgTable("seasons", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  sortKey: text("sort_key").notNull(),
  /** Game season whose donations are used, e.g. "2026-08". */
  donationSeason: text("donation_season"),
  /** 'open' | 'finalized' */
  status: text("status").notNull().default("open"),
  /** false for seasons that only exist as imported history. */
  hasCwlData: boolean("has_cwl_data").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
});

/** Per clan, per season status. */
export const cwlClanSeasons = pgTable(
  "cwl_clan_seasons",
  {
    seasonId: text("season_id").notNull(),
    clanTag: text("clan_tag").notNull(),
    clanName: text("clan_name").notNull().default(""),
    bonusOverride: integer("bonus_override"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    syncMessage: text("sync_message"),
  },
  (t) => [primaryKey({ columns: [t.seasonId, t.clanTag] })],
);

/** Every CWL war fetched (both sides stored as returned by the API). */
export const cwlWars = pgTable(
  "cwl_wars",
  {
    warTag: text("war_tag").primaryKey(),
    seasonId: text("season_id").notNull(),
    round: integer("round").notNull(),
    clanTag: text("clan_tag").notNull(),
    opponentTag: text("opponent_tag").notNull(),
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

/** League group roster (includes members who never got into a war). */
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

/** Your manual decisions and overrides for a player in a CWL clan. */
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
    /** Attacks from an imported ClashPerk CWL export (fallback when API data is missing). */
    importedAttacks: integer("imported_attacks"),
    remark: text("remark"),
    hidden: boolean("hidden").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.seasonId, t.clanTag, t.playerTag] })],
);

/**
 * Donations per game season per player per clan (max value observed).
 * clanTag = 'IMPORT' holds totals imported from a sheet; they take precedence.
 */
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

/** Who received a bonus in which season. memberKey = Discord ID, or "tag:#TAG" when unlinked. */
export const bonusHistory = pgTable(
  "bonus_history",
  {
    seasonId: text("season_id").notNull(),
    memberKey: text("member_key").notNull(),
    playerTag: text("player_tag"),
    /** 'import' | 'app' */
    source: text("source").notNull().default("app"),
  },
  (t) => [primaryKey({ columns: [t.seasonId, t.memberKey] })],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
