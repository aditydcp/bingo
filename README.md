# IDSurvey FIRST Summit '26 — Bingo App

Mobile-first photo bingo. Players sign in with Google (or as a guest), get a random 5×5 board (F-I-R-S-T), and fill cells by taking photos. Runs entirely on free tiers:

| Part | Service |
|---|---|
| Web app + API routes | Vercel (Next.js) |
| Database + login (Google, guest) | Supabase |
| Photos | Cloudinary |

## Pages

| Page | URL |
|---|---|
| Sign in / register | `/` |
| Player board | `/bingo` |
| Admin dashboard | `/admin` |
| Master panel (edit cell labels) | `/master` |

## Setup

### 1. Supabase

1. Create a project at supabase.com.
2. **SQL Editor** → run [`supabase/schema.sql`](supabase/schema.sql).
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

## Local development

```bash
cd frontend
cp .env.example .env.local   # fill in values
npm install
npm run dev                  # http://localhost:3000
```

## Free-tier notes

- Supabase pauses projects after 7 days without activity — open the app (or the dashboard) shortly before the event.
- Photos are resized on the phone to ≤1280 px JPEG (~200 KB) before upload, so 34 players × 25 photos is roughly 170 MB.
- Guest progress lives in that browser's session only, until the guest links Google from the board page.
