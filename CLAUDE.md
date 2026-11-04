# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Mobile-first photo-bingo web app for the IDSurvey FIRST Summit '26 (~34 players). UI text is Indonesian. Everything runs on free tiers: **Vercel** hosts the Next.js app (pages router, plain JS, Tailwind) in `frontend/`; **Supabase** provides Postgres + Auth; **Cloudinary** stores photos. There is no separate backend — server logic lives in `frontend/src/pages/api/`. Setup steps for all three services are in `README.md`.

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

**Auth.** Supabase Auth with Google OAuth and anonymous (guest) sign-in. Guests can upgrade via `linkIdentity` (keeps the same user ID); a failed link returns to `/bingo` with an error in the URL hash. A `profiles` row (name, entitas) is required before playing — `/` handles sign-in → profile form → redirect to `/bingo`. Admins are rows in the `admins` table; `/admin` and `/master` are wrapped in `components/AdminGate.js`.

**Board model — positions vs. cell IDs.**
- `master_config.cells` (single row, id=1) is a pool of ~30 `{id, label}` cells; the one labelled `FREE` is special.
- `boards.positions` holds 25 master cell IDs per user, dealt randomly on first `GET /api/state`, with FREE always at index 12 (`FREE_POS`).
- `bingo_states.cells` is keyed by **board position (0–24)**, not cell ID. Writes go through the `set_cell` SQL function so concurrent uploads don't clobber each other.
- Label edits in `/master` apply to existing boards (boards store IDs, labels are joined at read time).

**Photo upload flow** (`pages/bingo.js` → `handleFileChange`):
1. `compressImage` (≤1280 px JPEG) in the browser.
2. `POST /api/upload-signature` returns a signed Cloudinary upload with `public_id = bingo/<userId>/<pos>_<timestamp>`.
3. Browser uploads directly to Cloudinary (keeps photos out of Vercel's 4.5 MB body limit).
4. `POST /api/cells` validates the returned URL/public_id belongs to that user + position (`isOwnUpload`), stores it, and deletes the replaced photo.
Display uses Cloudinary URL transforms (`thumb`, `fullPhoto` in `src/lib/bingo.js`) rather than `next/image`.

**Bingo logic** (`checkBingo`, `markedSetFrom` in `src/lib/bingo.js`) is shared by the client and `POST /api/finish`, which verifies a bingo server-side before recording the first finish time.
