# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Mobile-first photo-bingo web app ("Piknik Bingo") for the Piknik DTI 2026 trip to Garut (~34 players). UI text is Indonesian. Everything runs on free tiers: **Vercel** hosts the Next.js app (pages router, plain JS, Tailwind) in `frontend/`; **Supabase** provides Postgres + Auth; **Cloudinary** stores photos. There is no separate backend — server logic lives in `frontend/src/pages/api/`. Setup steps for all three services are in `README.md`.

There are no tests or linters configured.

## Commands

All from `frontend/` (needs `.env.local`, see `frontend/.env.example`):
```bash
npm run dev     # http://localhost:3000
npm run build   # production build — use this to check compile errors
```
Database schema: `supabase/schema.sql`, run manually in the Supabase SQL editor (no migration tooling).

## Architecture

**Data access goes only through API routes.** Every table has RLS enabled with *no policies*, so the browser cannot touch the DB directly. API routes use the service-role client (`db()` in `src/lib/server/route.js`) and identify the caller from the `Authorization: Bearer <supabase access token>` header (`requireUser` / `requireAdmin`). The browser calls routes via `api()` in `src/lib/supabase.js`, which attaches the token. Routes are written as `export default route({ GET: ..., POST: ... })`; throw `HttpError(status, msg)` for client errors and wrap Supabase results in `must()`.

**Auth.** Supabase Auth with Google OAuth and anonymous (guest) sign-in. Guests can upgrade via `linkIdentity` (keeps the same user ID); a failed link returns to `/bingo` with an error in the URL hash. A `profiles` row (`name` = the player's self-chosen alias, unique case-insensitively) is required before playing — `/` handles sign-in → profile form → redirect to `/bingo`. Admins are rows in the `admins` table; `/admin` and `/master` are wrapped in `components/AdminGate.js`.

Game rules as the organizer defined them are summarized in `README.md` → "Game rules"; keep code and that section in sync.

**Board model — positions vs. cell IDs.**
- `master_config` (single row, id=1) holds `cells`, a pool of ~30 `{id, label}` cells, plus `event_start` / `event_end`. The free cell is marked `{ free: true }` (label "GARUT"); detect it with `isFreeCell`, never by label.
- `boards` holds `positions` (25 master cell IDs; the free cell always at index 12 = `FREE_POS`) and `round`. Dealt on first `GET /api/state`; `POST /api/reroll` archives the board + marks to `board_history`, clears `bingo_states`, deals a new board and increments `round`.
- `bingo_states.cells` is keyed by **board position (0–24)**; each entry also stores `cellId`. Writes go through the `set_cell` SQL function so concurrent uploads don't clobber each other.
- Label edits in `/master` apply to existing boards (boards store IDs, labels are joined at read time). Snapshots store their own copy of the board.

**Photos are never deleted** from Cloudinary (not on replace, reroll or admin reset): record snapshots and `board_history` still reference them.

**Photo upload flow** (`pages/bingo.js` → `handleFileChange`):
1. `compressImage` (≤1280 px JPEG) in the browser.
2. `POST /api/upload-signature` checks the event window and returns a signed Cloudinary upload with `public_id = bingo/<userId>/<cellId>_<timestamp>`.
3. Browser uploads directly to Cloudinary (keeps photos out of Vercel's 4.5 MB body limit).
4. `POST /api/cells` re-checks the window (2-min grace after the end), validates the URL/public_id belongs to that user + cell (`isOwnUpload`), stores it, then calls `updateRecords`.
Display uses Cloudinary URL transforms (`thumb`, `fullPhoto` in `src/lib/bingo.js`) rather than `next/image`.

**Records** (`records` table; `computeRecords` / `lineTimes` in `src/lib/bingo.js`, `updateRecords` in `src/lib/server/game.js`) are derived, not user-submitted. A completed line's time is the latest `markedAt` among its photo cells; first Bingo = the earliest such line, full board = latest `markedAt` once all 24 are filled. So replacing a photo in a winning line moves the record later. `updateRecords` only overwrites a record whose `*_round` equals the current board round; records from rerolled-away boards are final. Each record stores a snapshot `{ round, board, cells, lines }`.

**Shared logic**: `checkBingo`, `LINES`, `markedSetFrom`, `cellsToLine`, `eventStatus` in `src/lib/bingo.js` are used by both pages and API routes. `src/lib/boardImage.js` renders a board to PNG (player's downloadable card and admin export). The admin photo export (`src/lib/exportPhotos.js`) builds the ZIP in the browser from `GET /api/admin/export`, since the archive is too large for a Vercel function response.
