# Piknik Bingo — Piknik DTI 2026, Garut

Mobile-first photo bingo. Players sign in with Google (or as a guest), get a random 5×5 board (B-I-N-G-O), and fill cells by taking photos. Runs entirely on free tiers:

| Part | Service |
|---|---|
| Web app + API routes | Vercel (Next.js) |
| Database + login (Google, guest) | Supabase |
| Photos | Cloudinary |

## Game rules

1. **Board.** Each player gets 25 cells: 24 picked at random from the master pool, plus **GARUT** (free, always marked) in the dead centre.
2. **Photos.** Tapping a cell opens the camera. The photo is compressed on the phone and uploaded to Cloudinary for that cell. Tapping a filled cell shows the photo and lets the player replace it.
3. **Bingo.** A completed row, column or diagonal is a Bingo. The first Bingo and a full board each trigger a full-screen confetti ceremony; every additional line shows a small banner.
4. **Reroll.** "Acak Ulang Papan" deals a fresh random board and clears the current marks. It's allowed any time, as often as the player wants. Photos are never deleted, and records already earned are kept.
5. **Records** are automatic (there is no Finish button):
   - **First Bingo** = when the earliest completed line was completed. A line's time is its latest photo, so replacing a photo in a winning line moves the time later. A snapshot of the board at that moment is saved.
   - **Full board** = when all 24 photo cells were filled (latest photo time), with a snapshot.
   - A record earned on a board that was later rerolled away stays as it is.
6. **Event window.** Admins set start and end times on `/master`. Photos can only be uploaded in between (with a 2-minute grace after the end for uploads already in progress). Players can still view and reroll their board outside the window.
7. **Admin.** `/admin` shows every player's progress, plus a **Kompetisi** view with two leaderboards:
   - **Bingo Pertama**: by first-Bingo time, then by fewest cells missing for a line, then by most cells filled.
   - **Papan Penuh**: by full-board time, then by most cells filled.
   "Ekspor Foto" downloads a ZIP with one folder per player (see below).

## Pages

| Page | URL |
|---|---|
| Sign in / register | `/` |
| Player board | `/bingo` |
| Admin dashboard | `/admin` |
| Master panel (event window, cell labels) | `/master` |

## Setup

### 1. Supabase

1. Create a project at supabase.com.
2. **SQL Editor** → run [`supabase/schema.sql`](supabase/schema.sql). Run it again after pulling a newer version: it's safe to re-run and upgrades existing tables (it also renames the old `FREE` cell to `GARUT`).
3. **Authentication → Sign In / Providers**:
   - Enable **Allow anonymous sign-ins** (guest mode).
   - Enable **Allow manual linking** (lets guests upgrade to Google and keep progress).
   - Enable **Google** with a Client ID/secret from Google Cloud Console (APIs & Services → Credentials → OAuth client ID, type "Web application"). Add `https://<project-ref>.supabase.co/auth/v1/callback` as an authorized redirect URI.
4. **Authentication → URL Configuration**: set **Site URL** to your Vercel URL and add `http://localhost:3000/**` and `https://<your-app>.vercel.app/**` to **Redirect URLs**.
5. **Authentication → Rate Limits**: raise the anonymous sign-in limit (default 30/hour per IP). Everyone on the venue Wi-Fi shares one IP.

### 2. Cloudinary

Create a free account and copy the cloud name, API key and API secret from **Settings → API Keys**.

### 3. Vercel

1. Import this repo and set **Root Directory** to `frontend`.
2. Add the environment variables from [`frontend/.env.example`](frontend/.env.example).
3. Deploy.

### 4. First admin

Sign in with Google once (e.g. at `/admin`), then in the Supabase SQL editor:

```sql
insert into admins (user_id) select id from auth.users where email = 'you@example.com';
```

### 5. Before the event

On `/master`, set the event start and end times (in your device's time zone) and save.

## Photo export

On `/admin`, click **Ekspor Foto**. The ZIP is built in your browser (Vercel can't serve files this large), so use a laptop with Chrome or Edge and keep the tab open until it downloads. Expect roughly 200–500 MB.

```
Budi Santoso (a1b2c3)/
  03 - Seseorang tertawa.jpg     photos on the current board (NN = board position)
  papan.png                      current board
  bingo-pertama.png              first-Bingo snapshot
  papan-penuh.png                full-board snapshot
  board-lama-1/                  a board the player rerolled away from
    ...photos, papan.png
```

The ID suffix keeps players with the same name apart. Photos that fail to download are listed in `GAGAL-DIUNDUH.txt`.

## Local development

```bash
cd frontend
cp .env.example .env.local   # fill in values
npm install
npm run dev                  # http://localhost:3000
```

### Tests

```bash
npm run test:unit            # game logic, no network
npm test                     # everything; integration tests use the real Supabase + Cloudinary in .env
```

Integration tests create their own throwaway players and delete them (and their photos) afterwards, and restore the master config. Guest tests need **Allow anonymous sign-ins** enabled.

### Wiping all data

```bash
npm run wipe                 # dry run: shows what would be deleted
npm run wipe -- --yes        # deletes all players, boards, marks, records, history and bingo/ photos
npm run wipe -- --yes --include-admins   # also delete admin accounts
```

The cell pool and event window (`master_config`) are kept. Use this to clear test data before the event.

## Free-tier notes

- Supabase pauses projects after 7 days without activity — open the app (or the dashboard) shortly before the event.
- Photos are resized on the phone to ≤1280 px JPEG (~200 KB) before upload, so 34 players × 25 photos is roughly 170 MB. Replaced and rerolled photos are kept, so actual usage will be somewhat higher, still well within Cloudinary's free plan.
- Guest progress lives in that browser's session only, until the guest links Google from the board page.
