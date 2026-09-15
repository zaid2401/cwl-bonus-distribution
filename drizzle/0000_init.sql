CREATE TABLE "bonus_history" (
	"season_id" text NOT NULL,
	"member_key" text NOT NULL,
	"player_tag" text,
	"source" text DEFAULT 'app' NOT NULL,
	CONSTRAINT "bonus_history_season_id_member_key_pk" PRIMARY KEY("season_id","member_key")
);
--> statement-breakpoint
CREATE TABLE "clans" (
	"tag" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"is_alliance" boolean DEFAULT true NOT NULL,
	"cwl_type" text DEFAULT 'none' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cwl_attacks" (
	"war_tag" text NOT NULL,
	"round" integer NOT NULL,
	"clan_tag" text NOT NULL,
	"attacker_tag" text NOT NULL,
	"defender_tag" text NOT NULL,
	"attacker_position" integer NOT NULL,
	"defender_position" integer NOT NULL,
	"stars" integer NOT NULL,
	"destruction" real NOT NULL,
	"order" integer NOT NULL,
	CONSTRAINT "cwl_attacks_war_tag_attacker_tag_order_pk" PRIMARY KEY("war_tag","attacker_tag","order")
);
--> statement-breakpoint
CREATE TABLE "cwl_clan_seasons" (
	"season_id" text NOT NULL,
	"clan_tag" text NOT NULL,
	"clan_name" text DEFAULT '' NOT NULL,
	"bonus_override" integer,
	"last_synced_at" timestamp with time zone,
	"sync_message" text,
	CONSTRAINT "cwl_clan_seasons_season_id_clan_tag_pk" PRIMARY KEY("season_id","clan_tag")
);
--> statement-breakpoint
CREATE TABLE "cwl_roster" (
	"season_id" text NOT NULL,
	"clan_tag" text NOT NULL,
	"player_tag" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"townhall" integer,
	CONSTRAINT "cwl_roster_season_id_clan_tag_player_tag_pk" PRIMARY KEY("season_id","clan_tag","player_tag")
);
--> statement-breakpoint
CREATE TABLE "cwl_war_members" (
	"war_tag" text NOT NULL,
	"clan_tag" text NOT NULL,
	"player_tag" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"townhall" integer,
	"map_position" integer NOT NULL,
	CONSTRAINT "cwl_war_members_war_tag_player_tag_pk" PRIMARY KEY("war_tag","player_tag")
);
--> statement-breakpoint
CREATE TABLE "cwl_wars" (
	"war_tag" text PRIMARY KEY NOT NULL,
	"season_id" text NOT NULL,
	"round" integer NOT NULL,
	"clan_tag" text NOT NULL,
	"opponent_tag" text NOT NULL,
	"state" text NOT NULL,
	"team_size" integer DEFAULT 0 NOT NULL,
	"clan_stars" integer DEFAULT 0 NOT NULL,
	"clan_destruction" real DEFAULT 0 NOT NULL,
	"opponent_stars" integer DEFAULT 0 NOT NULL,
	"opponent_destruction" real DEFAULT 0 NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donations" (
	"season" text NOT NULL,
	"player_tag" text NOT NULL,
	"clan_tag" text NOT NULL,
	"donated" integer DEFAULT 0 NOT NULL,
	"received" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "donations_season_player_tag_clan_tag_pk" PRIMARY KEY("season","player_tag","clan_tag")
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"season_id" text NOT NULL,
	"clan_tag" text NOT NULL,
	"player_tag" text NOT NULL,
	"name" text,
	"selected" boolean DEFAULT false NOT NULL,
	"transfer_to_tag" text,
	"attacks_override" integer,
	"donations_override" integer,
	"imported_attacks" integer,
	"remark" text,
	"hidden" boolean DEFAULT false NOT NULL,
	CONSTRAINT "participants_season_id_clan_tag_player_tag_pk" PRIMARY KEY("season_id","clan_tag","player_tag")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"tag" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"discord_id" text,
	"discord_username" text,
	"pn" integer,
	"is_guest" boolean DEFAULT false NOT NULL,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"sort_key" text NOT NULL,
	"donation_season" text,
	"status" text DEFAULT 'open' NOT NULL,
	"has_cwl_data" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finalized_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "cwl_attacks_clan_idx" ON "cwl_attacks" USING btree ("clan_tag");--> statement-breakpoint
CREATE INDEX "cwl_wars_season_clan_idx" ON "cwl_wars" USING btree ("season_id","clan_tag");--> statement-breakpoint
CREATE INDEX "cwl_wars_season_opp_idx" ON "cwl_wars" USING btree ("season_id","opponent_tag");--> statement-breakpoint
CREATE INDEX "players_discord_idx" ON "players" USING btree ("discord_id");