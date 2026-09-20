CREATE TABLE "player_stats" (
	"season" text NOT NULL,
	"player_tag" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"clan_tag" text,
	"clan_name" text,
	"donated" integer DEFAULT 0 NOT NULL,
	"received" integer DEFAULT 0 NOT NULL,
	"attack_wins" integer DEFAULT 0 NOT NULL,
	"defense_wins" integer DEFAULT 0 NOT NULL,
	"trophies" integer,
	"townhall" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_stats_season_player_tag_pk" PRIMARY KEY("season","player_tag")
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "is_tracked" boolean DEFAULT false NOT NULL;