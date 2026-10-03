DROP TABLE "player_stats" CASCADE;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "left_jpa" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN "is_tracked";