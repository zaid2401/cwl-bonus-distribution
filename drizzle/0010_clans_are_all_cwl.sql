-- Clans that were only there for donation tracking have no job left.
DELETE FROM "clans" WHERE "cwl_type" = 'none';--> statement-breakpoint
ALTER TABLE "clans" DROP COLUMN "is_alliance";--> statement-breakpoint
ALTER TABLE "clans" DROP COLUMN "cwl_type";
