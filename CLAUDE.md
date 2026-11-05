# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Mobile-first photo-bingo web app ("Piknik Bingo") for the Piknik DTI 2026 trip to Garut (~34 players). UI text is Indonesian. Everything runs on free tiers: **Vercel** hosts the Next.js app (pages router, plain JS, Tailwind) in `frontend/`; **Supabase** provides Postgres + Auth; **Cloudinary** stores photos. There is no separate backend — server logic lives in `frontend/src/pages/api/`. Setup steps for all three services are in `README.md`.

Tests use Vitest (no linter). Unit tests (`frontend/tests/unit`) cover the pure logic; integration tests (`frontend/tests/integration`) call the API route handlers in-process with a minimal req/res mock against the **real** Supabase + Cloudinary from `frontend/.env`. They create their own users (magic-link sign-in, so CAPTCHA settings don't matter; guests need anonymous sign-ins enabled), swap in a test cell pool via `saveConfig`/`setConfig`/`restoreConfig`, and delete everything they created in `cleanup()`. Browser tests (`frontend/tests/e2e/*.e2e.js`, separate config) start `next dev` on port 3123 and drive the installed Edge via playwright-core (no browser download), injecting a test user's session into localStorage; they cover the reroll overlay, toggles and offline/flaky uploads.

## Commands

All from `frontend/` (needs `.env.local`, see `frontend/.env.example`):
```bash
npm run dev     # http://localhost:3000
npm run build   # production build — use this to check compile errors
npm test                  # all tests (~5 min; integration tests hit the real services)
npm run test:unit         # pure logic only, ~1 s, no network
npm run test:e2e          # real browser (Edge; E2E_BROWSER=chrome for Chrome), ~1.5 min
npx vitest run tests/integration/play.test.js -t "reroll"   # one file / one test
npm run wipe              # dry run: counts players' data; add -- --yes to delete it
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

**Photo upload flow** (`pages/bingo.js` → `handleFileChange` → `runQueue`; helpers in `src/lib/uploadQueue.js`). Built for bad signal: a taken photo goes into a queue persisted in IndexedDB (`pendingStore`, survives reloads) and is sent one at a time in the background with backoff retries; waits for the `online` event when offline. The cell shows the local photo with progress until the server confirms. `isPermanent` decides drop vs retry (4xx like `event_closed` drop; no response / 5xx retry). Items carry the `cellId` and are dropped if the board changed (reroll). `api()` in `src/lib/supabase.js` has a timeout and retries GETs; only pass `retries` to idempotent POSTs (never reroll).
1. `compressImage` in the browser (≤1280 px JPEG; smaller on 2G/3G/data saver, `photoSizeForConnection`).
2. `POST /api/upload-signature` checks the event window and returns a signed Cloudinary upload with `public_id = bingo/<userId>/<cellId>_<timestamp>`.
3. Browser uploads directly to Cloudinary via XHR for progress, aborting if stalled (keeps photos out of Vercel's 4.5 MB body limit).
4. `POST /api/cells` re-checks the window (2-min grace after the end), validates the URL/public_id belongs to that user + cell (`isOwnUpload`), stores it, then calls `updateRecords`.
Display uses Cloudinary URL transforms (`thumb`, `fullPhoto` in `src/lib/bingo.js`) rather than `next/image`.

**Sound, vibration, music** (`src/lib/feedback.js`, toggles in `components/FeedbackToggles.js`): all synthesized with Web Audio, no audio files. Call `feedback(name)` for a game moment (sound + vibration); each channel has its own per-device setting in localStorage. Audio unlocks on the first tap (browser autoplay rules); music stops while the tab is hidden.

**Records** (`records` table; `computeRecords` / `lineTimes` in `src/lib/bingo.js`, `updateRecords` in `src/lib/server/game.js`) are derived, not user-submitted. A completed line's time is the latest `markedAt` among its photo cells; first Bingo = the earliest such line, full board = latest `markedAt` once all 24 are filled. So replacing a photo in a winning line moves the record later. `updateRecords` only overwrites a record whose `*_round` equals the current board round; records from rerolled-away boards are final. Each record stores a snapshot `{ round, board, cells, lines }`.

**Shared logic**: `checkBingo`, `LINES`, `markedSetFrom`, `cellsToLine`, `eventStatus` in `src/lib/bingo.js` are used by both pages and API routes. `src/lib/boardImage.js` renders a board to PNG (player's downloadable card and admin export). The admin photo export (`src/lib/exportPhotos.js`) builds the ZIP in the browser from `GET /api/admin/export`, since the archive is too large for a Vercel function response.
