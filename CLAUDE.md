# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## JPA CWL Bonus

Private tool for picking CWL bonus recipients across the JPA alliance, hosted on Vercel with a
Supabase database. Everything here is CWL: if a feature is not about choosing or recording CWL
bonuses, it does not belong in this app.

## The rules it encodes

Bonuses per clan = **6 + war wins**, overridable by hand. A player qualifies when all four hold:

- **7/7 attacks** used,
- **PN1**, their own main account (PN2 and up are that member's alts),
- **Alt** not ticked on the player,
- **Left JPA** not ticked on that season's board.

Among those, donations from the **previous game season** decide the order, and those only exist once
the sheet for that season has been imported. Nobody is auto-picked: the board sorts and flags, Zaid
ticks the boxes.

Flags are advisory only, never exclusions:

- **B2B** — a bonus in 3 or more of the last 6 seasons.
- **Star steal** — after a player passes 8 stars, any hit on a base numbered below their own war
  position.

`Flags` in `BoardTable.tsx` renders them worst first — disqualifier, then something to look at,
then plain facts — as `.flag` pills with their own dot and border, so four on one row still read
as four things. A clean row shows a dash, never an empty cell.

`lib/logic.ts` holds every constant and the pure functions, and is the only part with unit tests.

## Two accounts

The password decides who you are, so there are no user rows anywhere: `ADMIN_PASSWORD` is Zaid and
`BONUS_PASSWORD` is the leader who only hands out bonuses. The cookie is
`v1.<role>.<expiry>.<signature>`, signed with that role's password, which is how `sessionRole()`
tells them apart.

The bonus account sees the current season and its clan boards and nothing else — not live
attacks — read-only except the Bonus checkbox. Same database, so a tick shows up for Zaid
immediately. Three layers hold that:

- `proxy.ts` sends it back to the board for any path outside `/` and `/seasons/`, and for the
  `/attacks` page inside it.
- `seasonGate()` in `lib/session.ts` sends it back for any season but the newest, and tells the page
  whether to render admin controls. Pages pass that down as `canEdit`.
- The board drops the PN, Alt and Left JPA columns for that account — 9 columns against 12 — and
  every remaining control is inert bar the Bonus checkbox. The state those columns set is still
  visible in **Flags**, which is the point: they read it, they just cannot change it.
- `run()` in `lib/actions.ts` takes the role an action needs, defaulting to admin.
  `updateParticipant` asks for "bonus" only when the patch is exactly `{ selected }` — anything else
  in it, even alongside `selected`, is an admin edit. **Hiding a control is not refusing a write**:
  anything new that the bonus account can reach needs its own `run()` role.

Leave `BONUS_PASSWORD` unset and the second account simply does not exist.

## Security

Two passwords on the public internet are the whole of the front door, so:

- The role and the expiry are **inside** the signature. A bonus cookie cannot be edited into an
  admin one without the admin password, and a copied cookie stops working after 30 days —
  `maxAge` on its own only asks the browser nicely. `AUTH_SECRET` is mixed into the signing key:
  optional, and worth setting, because without it a stolen cookie is an offline guess at a short
  password.
- Ten wrong passwords from one address cost fifteen minutes (`lockedFor` and `noteFailure` in
  `lib/auth.ts`), and every wrong answer waits 400ms first. The counter lives in memory, per
  instance, on purpose: a shared one would mean a database write per guess.
- `passwordRole()` compares digests rather than passwords, so a guess takes the same time
  however much of it was right.
- Every table gets `ENABLE ROW LEVEL SECURITY` with no policy, which shuts Supabase's public
  Data API. **A new table needs its own `ALTER` in the migration** — the app connects as the
  table owner and will never notice the omission.
- `next.config.ts` carries the CSP and the other headers. Everything comes from `self`, so a
  font or a script from anywhere else is blocked until it is named there. `script-src` keeps
  `unsafe-inline` because Next's own bootstrap has no nonce in a static header.
- `safeCell()` in `lib/csv.ts` marks anything opening with `=`, `+`, `-` or `@` as text. A player
  can be called `=IMPORTXML(...)`, and both the CSV and the Sheets export are opened by people.
- Route handlers check the session themselves as well as sitting behind the proxy.
- `npm audit` should say nothing. It found a critical RCE in `next` 16.3.5 once already, so the
  floor in `package.json` is 16.3.8.

## Shape of the code

| Path                             | What lives there                                                               |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `lib/logic.ts`                   | Bonus rules, war results, star-steal detection. No database.                   |
| `lib/util.ts`                    | Tag and season helpers: `normTag()`, `cwlSeasonId()`, `currentCwlSeason()`.    |
| `lib/sync.ts`                    | Clash of Clans API pulls: CWL wars and rosters.                                |
| `lib/jpa.ts`                     | clashwithjpa.com API: CWL seasons and applications. Read-only.                 |
| `lib/pn.ts`                      | Preference numbers onto a season's boards. Only `npm run sync-pn` calls it.    |
| `lib/view.ts`                    | The bonus board and season overview.                                           |
| `lib/live.ts`                    | Round-by-round attack grid.                                                    |
| `lib/imports.ts`                 | Google Sheet imports: history, donations, CWL exports, player links.           |
| `lib/export.ts`, `lib/sheets.ts` | Season export in the old Combined-sheet layout.                                |
| `lib/actions.ts`                 | Every server action. All of them go through `run()`, which checks the session. |
| `lib/auth.ts`                    | Passwords, roles and the session cookie. Safe to import from `proxy.ts`.       |
| `lib/session.ts`                 | What pages ask for the current role. Uses `next/headers`, so not in the proxy. |
| `app/`, `components/`            | Next.js 16 App Router pages and client components.                             |

`clanBoard()` runs its queries in three waves, and `seasonOverview()` builds one board per
clan at once. Keep both that way: a round trip to Supabase is the expensive part, and the
season page used to make a hundred of them in a row.

## Data model notes

- **Seasons are keyed by month** (`2026-09`). The API reports a league group's _start date_, and
  groups start on different days, so always run it through `cwlSeasonId()`. Two events in one month
  use ids like `2026-06` and `2026-06-2`, ordered by `sortKey`.
- Every row in `clans` is a CWL clan. There is no clan type and no alliance flag any more.
- `cwl_clan_seasons.active` says whether a clan is being used for CWL that season. The **In use**
  column on the Clans page is the only control for it, and it always means the current month, since
  that is the only season you can still change your mind about. Syncing a clan that is in a league
  group creates the row ticked; unticking removes the clan from totals, exports and sync without
  touching past seasons. Ticking before the first sync creates the season row too.
- `donations` holds the donation numbers, and only the `clan_tag = 'IMPORT'` rows are read. Without
  an import for a season the board shows blanks, not zeros, and says so in the header. The clan
  snapshots an older version collected are still in the table but ignored: they summed a player who
  changed clans twice.
- `players.is_alt_account` (the **Alt** tick) and the PN-derived `isAlt()` are different things. The
  tick marks an account that is nobody's main; PN is one member's own ordering. The board shows the
  first as an `alt` chip and the second as `PN2`, `PN3` and so on.
- `participants.pn` is that season's preference number, synced from the member's CWL
  application on clashwithjpa.com. The board falls back to `players.pn` when a player has no
  application, and editing PN on a board writes the season value, not the fallback.
- `participants.left_jpa` disqualifies a player for that season only. It is per season on purpose:
  someone who rejoins starts clean next month.
- `bonus_history` is keyed by **member**: the Discord ID, or `tag:#TAG` when unlinked.

## The clashwithjpa.com API

Members apply for CWL on the website and pick their preference number there, so PN is read from
it rather than typed in twice. `JPA_API_KEY` goes in the `x-api-key` header; Manager scope covers
everything this app reads. Every response is `{success, data}` or `{success, error}`, which
`lib/jpa.ts` unwraps. Only `npm run sync-pn` reads the key, out of `.env.local`; the deployed app
never calls that API, so Vercel does not need it.

Their seasons are integer ids with a month name and year; ours are `2026-10`. `matchSeason()`
pairs them on month and year, and when a month holds two CWLs it pairs them oldest first, so our
`2026-06-2` finds their "June 2026 2". Applications page 100 at a time — a season is 300-odd.

**Cloudflare fronts that API and challenges any call from a datacentre** — a "Just a moment…"
page, which a server can never answer. Vercel and GitHub Actions were both tried and both
blocked, and the browser cannot do it either: the API allows no cross-origin calls. Only a home
machine gets through, so this lives in `npm run sync-pn [season]` and **the app has no button
for it** — don't add one back without checking that the block is gone. `JPA_API_BASE` is there
for the day someone finds the origin hostname behind Cloudflare, which would make a button
possible again.

**Sync PN overwrites whatever is on the board**, hand edits included. That is the point: the
website is the source of truth for PN.

## Clash of Clans API gotchas

- Keys are tied to an IP, so everything goes through the RoyaleAPI proxy (`cocproxy.royaleapi.dev`),
  whitelisted as `45.79.218.79`.
- CWL war data disappears a few days after the league ends. Sync during or straight after CWL;
  otherwise fall back to importing a ClashPerk `/export cwl` sheet.
- `attackWins` on a player counts ranked battles only. We do not track multiplayer attacks at all.

## Commands

```bash
npm run dev                  # http://localhost:3000, runs with no env set
npm run build                # production build, also the only full type check of app routes
npx tsc --noEmit             # type check on its own
npx prettier --write .       # formatting (no ESLint in this project)

npm test                     # all rule tests
npx tsx --test tests/logic.test.ts                          # one file
npx tsx --test --test-name-pattern "star steal" tests/*.ts  # one test

npm run mock-coc             # fake Clash of Clans API on :4010
npm run sync-pn [season]     # preference numbers from clashwithjpa.com (newest season by default)
npm run db:generate          # new migration after editing lib/db/schema.ts
npm run db:migrate           # apply migrations to whatever DATABASE_URL points at
```

Route types (`PageProps`, `RouteContext`) come from `npx next typegen`; run it after adding a page
or a route handler, or `tsc` will fail on names it has never seen.

## Local database

With no `DATABASE_URL`, the app runs Postgres in-process out of `./.data`. **Only one process may
open that directory at a time** — a dev server plus a script will corrupt it. Point `PGLITE_DIR`
somewhere scratch when running throwaway scripts.

To drive the app against the mock game API, set `COC_API_BASE=http://localhost:4010/v1` and
`COC_API_TOKEN=test` in `.env.local`.

**Nothing under `scripts/` loads `.env.local`** — Next does that, `tsx` does not. So `npm run
db:migrate` on its own migrates the embedded database and says "Database is up to date", having
never touched production. Pass `DATABASE_URL` explicitly when you mean production.
`scripts/sync-pn.mts` carries its own loader, and it fills in **only names the shell left out**:
`DATABASE_URL=` on the command line means the local database and must beat the file, or a test
you believed was local writes to production. That has happened.

Auth is off in dev when `ADMIN_PASSWORD` is empty, and `.env.development.local` wins over
`.env.local`, so a file holding just `ADMIN_PASSWORD=` gets past the login screen — as admin. To try
the bonus account instead, that file needs a real `ADMIN_PASSWORD` and a `BONUS_PASSWORD`, plus an
empty `DATABASE_URL` and a scratch `PGLITE_DIR` so you are nowhere near production. Delete it
afterwards.

## Migrations

They run on first database use, so deploying is enough to apply them — and so is starting the dev
server against the real `DATABASE_URL`. **That upgrades production.** When a migration drops or
renames something, push the matching code promptly, or the live site is left querying a column that
is no longer there.

`npm run db:generate` diffs the schema against the last snapshot. A **column rename** needs an
interactive answer and the command dies without a TTY, so write those by hand:

1. The `.sql` file, with `ALTER TABLE ... RENAME COLUMN ...`.
2. `drizzle/meta/000N_snapshot.json` — copy the previous snapshot, give it a fresh `id`, set
   `prevId` to the old one's `id`, and rename the column inside.
3. An entry in `drizzle/meta/_journal.json`.

Then run `npm run db:generate` again: "No schema changes" means the snapshot matches.
`scripts/merge-seasons.mts` merges two seasons if one ever splits.

## House style

Comments explain decisions and API quirks, not what the next line does. No doc block on every
export, plain `//` when a comment earns its place, Prettier at 110 columns. See the top-level
memory note on writing code that reads as human-written.

## Deliberately absent

Multiplayer attack tracking, the Latecomers clan type, the alliance/CWL clan split, bonus transfers
to an alt, free-text remarks on a player, a **Sync PN button**, a **GitHub Actions job** for the same
sync (both blocked by Cloudflare, see above), and every form of live donation tracking (the Donations
page, `player_stats`, tracked players, the daily snapshot) were all removed. Donations arrive by
import now. A bonus is recorded against the account that was ticked, under that member's key. Don't
bring any of it back without asking.

Setup and deployment steps (Supabase, Vercel, the API key, the Google service account) live in
`README.md`.
