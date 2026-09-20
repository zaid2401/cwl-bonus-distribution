# JPA CWL Bonus

Private web app for picking CWL bonus recipients.

- Syncs CWL attacks and war wins from the Clash of Clans API. Seasons are keyed by month, even though the API reports each league group's start date. Bonuses per clan = **6 + wins**.
- Saves donations for all alliance clans every day, combined across clans.
- Shows eligibility (7/7 attacks, main account, not a guest), bonus history for the last 6 seasons, and the **B2B** (3+ bonuses in the last 6 seasons) and **Star steal** flags.
- You tick the recipients, move a bonus to an alt if needed, finalize, then export to Google Sheets or CSV.
- **Donations page**: live donated/received per player for any game season, combined across alliance clans, with a refresh button and optional auto-refresh.
- **Live attacks page** (season → Live attacks): round-by-round grid per clan showing stars, attacks still open in a running war, and missed attacks.
- Everything can be edited by hand. Imports from Google Sheet links (ClashPerk exports, bonus history, player links) are there as a fallback.

---

## 1. Run it on your PC (no setup needed)

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without `DATABASE_URL`, data is stored in `./.data`. Without `ADMIN_PASSWORD`, login is skipped (local only).

To sync real data locally, create `.env.local`:

```
COC_API_TOKEN=your-token
```

## 2. Clash of Clans API key

1. Log in at https://developer.clashofclans.com → **My Account** → **Create New Key**.
2. Under **Allowed IP addresses**, enter `45.79.218.79`. That is the RoyaleAPI proxy the app uses, so it works from any host.
3. Copy the token into `COC_API_TOKEN`.

## 3. Free hosting (Supabase + Vercel)

**Database: Supabase**
1. Create a project at https://supabase.com (free).
2. Go to **Connect** → **Transaction pooler** and copy the URI (port 6543). Replace `[YOUR-PASSWORD]` in it.
3. This URI is your `DATABASE_URL`. Tables are created automatically on first run.

**App: Vercel**
1. Push this folder to a **private** GitHub repo.
2. At https://vercel.com, click **Add New → Project** and import the repo.
3. Add these environment variables:

| Name | Value |
|---|---|
| `ADMIN_PASSWORD` | your login password |
| `COC_API_TOKEN` | CoC API token |
| `DATABASE_URL` | Supabase pooler URI |
| `CRON_SECRET` | any long random string |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | see step 4 |
| `GOOGLE_PRIVATE_KEY` | see step 4 |

4. Deploy. `vercel.json` schedules `/api/cron` daily at 04:30 UTC, just before the season reset at 05:00 UTC on Mondays. Each run saves donations and syncs CWL.

## 4. Google Sheet export (optional)

1. In https://console.cloud.google.com, create a project and enable the **Google Sheets API**.
2. Go to **IAM & Admin → Service accounts**, create an account, then **Keys → Add key → JSON**.
3. From the JSON file, copy `client_email` into `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `private_key` into `GOOGLE_PRIVATE_KEY` (paste it as-is, including the BEGIN/END lines).
4. Create an empty Google Sheet and **Share** it with the service account email as **Editor**.
5. In the app, open **Settings** and paste that sheet's link. Each export writes a tab named `CWL <season>`.

---

## Season workflow

1. **Clans**: add your CWL clan tags and your alliance clan tags. This is a one-time step.
2. **Import** (first time only): bonus history from your old sheet's `DB` tab, and donations for the previous season if the app wasn't running then.
3. During and after CWL, the daily job syncs automatically. You can also click **Sync CWL now**. Sync within a few days of CWL ending, because the API drops the data after that. If you miss the window, import the ClashPerk `/export cwl` sheets instead.
4. Open the season, then each clan. Link missing Discord IDs, set PN or guest, and tick recipients. Use **Transfer to** to move a bonus to an alt.
5. **Finalize season** writes the picks to bonus history. **Export to Google Sheet** makes a copy to share.

## Rules in code

`lib/logic.ts` holds all the rules: base bonus 6, 7 required attacks, 8-star requirement, 6-season window, B2B threshold 3.

- **Win:** more stars, or equal stars and higher destruction.
- **Star steal:** after a player already has 8+ stars across their CWL attacks (in round order), any attack on a base numbered lower than their own war position is flagged.

## Dev

- `npm test`: unit tests for the rules.
- `npm run mock-coc`: fake CoC API on port 4010. Use it with `COC_API_BASE=http://localhost:4010/v1` and `COC_API_TOKEN=test`.
- Schema changes: edit `lib/db/schema.ts`, then run `npm run db:generate`.
