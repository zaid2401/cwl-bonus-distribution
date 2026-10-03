# JPA CWL Bonus

Private web app for picking CWL bonus recipients.

- Syncs CWL attacks and war wins from the Clash of Clans API. Seasons are keyed by month, even though the API reports each league group's start date. Bonuses per clan = **6 + wins**.
- Shows eligibility (7/7 attacks, PN1 main account, not an alt, still in the alliance), bonus history for the last 6 seasons, and the **B2B** (3+ bonuses in the last 6 seasons) and **Star steal** flags.
- You tick the recipients, move a bonus to an alt if needed, finalize, then export to Google Sheets or CSV.
- Donations for the ordering come from a ClashPerk season export you import per season. The app does not follow them live.

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

| Name                           | Value                                             |
| ------------------------------ | ------------------------------------------------- |
| `ADMIN_PASSWORD`               | your login password                               |
| `AUTH_SECRET`                  | long random string; see below                     |
| `BONUS_PASSWORD`               | the bonus leader's password (optional, see below) |
| `COC_API_TOKEN`                | CoC API token                                     |
| `DATABASE_URL`                 | Supabase pooler URI                               |
| `CRON_SECRET`                  | any long random string                            |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | see step 4                                        |
| `GOOGLE_PRIVATE_KEY`           | see step 4                                        |

4. Deploy. `vercel.json` schedules `/api/cron` daily at 04:30 UTC, just before the season reset at 05:00 UTC on Mondays. Each run syncs CWL.

## Preference numbers

Preference numbers come from each member's CWL application on clashwithjpa.com. Run this after the
CWL rosters have synced, as often as you like — it only writes what changed:

```bash
npm run sync-pn            # the newest season
npm run sync-pn 2026-10    # a particular one
```

It reads `DATABASE_URL` and `JPA_API_KEY` from `.env.local`, so it writes straight to production. A
player with no application keeps whatever PN the Players page holds for them, and re-running
overwrites hand edits — the website is where PN is decided.

There is no button for this in the app: Cloudflare sits in front of that API and challenges any call
from a datacentre, so Vercel and GitHub Actions are both turned away and only a home machine gets
through.

## A second login for the bonus leader

Set `BONUS_PASSWORD` to anything you like and give it to the leader who hands out bonuses. Signing in
with it opens the current season and its clan boards, read-only, with one exception: the **Bonus**
checkbox. The PN, Alt and Left JPA columns are not even shown — they read that state off the
**Flags** column instead. They cannot touch clans, players, imports, settings, live attacks, attack
or donation numbers, Discord links, sync, export, finalize or any other season.

It is the same database, so their picks show up on your side the moment they tick a box. Changing
`BONUS_PASSWORD` signs them out; leaving it unset means the second login does not work at all.

## Keeping it locked

The password is the whole key to this app, so:

- **Set `AUTH_SECRET`** to a long random string — `openssl rand -hex 32`, or any 50-odd random
  characters. It is mixed into the signature on the login cookie, so even a stolen cookie gives
  away nothing about the password itself. Changing it signs everyone out, which is also how you
  throw out a cookie you think somebody else has.
- Sessions last 30 days and then expire on the server, not just in the browser.
- Ten wrong passwords from one address lock that address out for fifteen minutes, and every wrong
  answer is slowed down on purpose. Long passwords still matter: make them long and unguessable.
- `npm audit` should say "found 0 vulnerabilities". Run it now and then, and run
  `npm audit fix` when it does not.

## 4. Google Sheet export (optional)

1. In https://console.cloud.google.com, create a project and enable the **Google Sheets API**.
2. Go to **IAM & Admin → Service accounts**, create an account, then **Keys → Add key → JSON**.
3. From the JSON file, copy `client_email` into `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `private_key` into `GOOGLE_PRIVATE_KEY` (paste it as-is, including the BEGIN/END lines).
4. Create an empty Google Sheet and **Share** it with the service account email as **Editor**.
5. In the app, open **Settings** and paste that sheet's link. Each export writes a tab named `CWL <season>`.

---

## Season workflow

1. **Clans**: add your CWL clan tags once, then tick **In use** for the ones you are running this CWL. Syncing ticks them for you as soon as they join a league group.
2. **Import**: bonus history from your old sheet's `DB` tab (first time only), and the previous game season's donations, which decide the order on the board.
3. During and after CWL, the daily job syncs automatically. You can also click **Sync CWL now**. Sync within a few days of CWL ending, because the API drops the data after that. If you miss the window, import the ClashPerk `/export cwl` sheets instead.
4. Open the season, then each clan. Link missing Discord IDs, set PN, **Alt** or **Left JPA**, and tick recipients. Use **Transfer to** to move a bonus to an alt.
5. **Finalize season** writes the picks to bonus history. **Export to Google Sheet** makes a copy to share.

## Rules in code

`lib/logic.ts` holds all the rules: base bonus 6, 7 required attacks, 8-star requirement, 6-season window, B2B threshold 3.

- **Win:** more stars, or equal stars and higher destruction.
- **Star steal:** after a player already has 8+ stars across their CWL attacks (in round order), any attack on a base numbered lower than their own war position is flagged.

## Dev

- `npm test`: unit tests for the rules.
- `npm run mock-coc`: fake CoC API on port 4010. Use it with `COC_API_BASE=http://localhost:4010/v1` and `COC_API_TOKEN=test`.
- Schema changes: edit `lib/db/schema.ts`, then run `npm run db:generate`.
