-- Block Supabase's public Data API (anon/authenticated roles). The app connects as the table owner, which bypasses RLS.
ALTER TABLE "clans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "players" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "seasons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cwl_clan_seasons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cwl_wars" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cwl_war_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cwl_attacks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cwl_roster" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "donations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bonus_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
