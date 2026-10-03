# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## JPA CWL Bonus

Private tool for picking CWL bonus recipients across the JPA alliance. One admin user (Zaid), hosted
on Vercel with a Supabase database. Everything here is CWL: if a feature is not about choosing or
recording CWL bonuses, it does not belong in this app.

## The rules it encodes

Bonuses per clan = **6 + war wins**, overridable by hand. A player qualifies when they used **7/7
attacks**, are on their **main account** (PN1; PN2 and up are alts) and are **not a guest**. Among
those, donations from the **previous game season** decide the order. Nobody is auto-picked: the
board sorts and flags, Zaid ticks the boxes.

Flags are advisory only, never exclusions:

- **B2B** — a bonus in 3 or more of the last 6 seasons.
- **Star steal** — after a player passes 8 stars, any hit on a base numbered below their own war
  position.

A bonus belongs to the member, not the account. It can be transferred to an alt and still counts
against that member's history.

`lib/logic.ts` holds every constant and the pure functions, and is the only part with unit tests.

## Shape of the code

| Path                             | What lives there                                                               |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `lib/logic.ts`                   | Bonus rules, war results, star-steal detection. No database.                   |
| `lib/sync.ts`                    | Clash of Clans API pulls: CWL wars, per-player season donations.               |
| `lib/view.ts`                    | The bonus board and season overview.                                           |
| `lib/live.ts`                    | Round-by-round attack grid, donation totals for old seasons.                   |
| `lib/stats.ts`                   | Donations page rows.                                                           |
| `lib/imports.ts`                 | Google Sheet imports: history, donations, CWL exports, player links.           |
| `lib/export.ts`, `lib/sheets.ts` | Season export in the old Combined-sheet layout.                                |
| `lib/actions.ts`                 | Every server action. All of them go through `run()`, which checks the session. |
| `app/`, `components/`            | Next.js 16 App Router pages and client components.                             |

## Data model notes

- **Seasons are keyed by month** (`2026-09`). The API reports a league group's _start date_, and
  groups start on different days, so always run it through `cwlSeasonId()`. Two events in one month
  use ids like `2026-06` and `2026-06-2`, ordered by `sortKey`.
- `cwl_clan_seasons.active` says whether a clan is being used for CWL that season. Unticking it
  removes the clan from totals, exports and sync, without touching past seasons.
- `player_stats` is per player per game season, written by `snapshotPlayerStats()`. Values only grow
  inside a season, so a player who leaves a clan keeps their numbers.
- `donations` only holds sheet imports (`clan_tag = 'IMPORT'`) and old clan snapshots. An import
  always beats the API.
- `bonus_history` is keyed by **member**: the Discord ID, or `tag:#TAG` when unlinked.

## Clash of Clans API gotchas

- Keys are tied to an IP, so everything goes through the RoyaleAPI proxy (`cocproxy.royaleapi.dev`),
  whitelisted as `45.79.218.79`.
- CWL war data disappears a few days after the league ends. Sync during or straight after CWL;
  otherwise fall back to importing a ClashPerk `/export cwl` sheet.
- `attackWins` on a player counts ranked battles only. We do not track multiplayer attacks at all.
- The clan members endpoint has no per-player detail worth using here, so donations are read one
  player at a time. That is also what covers tracked players outside the family clans.

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

Migrations run automatically on first database use, so deploying is enough to apply them.
`scripts/merge-seasons.mts` merges two seasons if one ever splits.

## House style

Comments explain decisions and API quirks, not what the next line does. No doc block on every
export, plain `//` when a comment earns its place, Prettier at 110 columns. See the top-level
memory note on writing code that reads as human-written.

## Deliberately absent

Multiplayer attack tracking, the Latecomers clan type, and clan-level donation snapshots were all
removed. Don't bring them back without asking.

Setup and deployment steps (Supabase, Vercel, the API key, the Google service account) live in
`README.md`.
