-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- All tables have RLS enabled with no policies: only the server (service role key,
-- used by the Next.js API routes) can read or write them.

create table if not exists profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null,
  entitas     text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- positions: 25 master cell IDs in board order; FREE is always at index 12
create table if not exists boards (
  user_id     uuid primary key references profiles (id) on delete cascade,
  positions   jsonb not null,
  created_at  timestamptz not null default now()
);

-- cells: keyed by board position "0".."24" → { marked, photoUrl, publicId, markedAt }
create table if not exists bingo_states (
  user_id     uuid primary key references profiles (id) on delete cascade,
  cells       jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);

create table if not exists completions (
  user_id         uuid primary key references profiles (id) on delete cascade,
  completed_at    timestamptz not null default now(),
  state_snapshot  jsonb
);

create table if not exists master_config (
  id          integer primary key default 1 check (id = 1),
  cells       jsonb not null,
  updated_at  timestamptz not null default now()
);

-- Add admins after they sign in with Google once:
--   insert into admins (user_id) select id from auth.users where email = 'you@example.com';
create table if not exists admins (
  user_id     uuid primary key references auth.users (id) on delete cascade
);

alter table profiles      enable row level security;
alter table boards        enable row level security;
alter table bingo_states  enable row level security;
alter table completions   enable row level security;
alter table master_config enable row level security;
alter table admins        enable row level security;

-- Atomically set one cell without clobbering concurrent uploads to other cells
create or replace function set_cell(p_user_id uuid, p_pos text, p_cell jsonb)
returns void
language sql
as $$
  insert into bingo_states (user_id, cells)
  values (p_user_id, jsonb_build_object(p_pos, p_cell))
  on conflict (user_id) do update
    set cells = bingo_states.cells || jsonb_build_object(p_pos, p_cell),
        updated_at = now();
$$;

revoke execute on function set_cell(uuid, text, jsonb) from public, anon, authenticated;

-- 30-cell pool: each player gets a random 24 of these plus FREE in the centre
insert into master_config (id, cells) values (1, '[
  {"id": 0,  "label": "Seseorang yang bertanya ke pemateri"},
  {"id": 1,  "label": "Seseorang tertawa"},
  {"id": 2,  "label": "VP IT ID Survey"},
  {"id": 3,  "label": "Cari orang brewok di acara"},
  {"id": 4,  "label": "Judul Presentasi di 1 slide"},
  {"id": 5,  "label": "Podium Kahoot"},
  {"id": 6,  "label": "Foto Spanic"},
  {"id": 7,  "label": "Foto Dwiki"},
  {"id": 8,  "label": "Peserta menggunakan virtual background FIRST Summit"},
  {"id": 9,  "label": "VP IT BKI"},
  {"id": 10, "label": "VP IT Sucofindo"},
  {"id": 11, "label": "VP IT SI"},
  {"id": 12, "label": "FREE"},
  {"id": 13, "label": "Foto video safety induction"},
  {"id": 14, "label": "Seseorang bertepuk tangan"},
  {"id": 15, "label": "Foto bersama teman sebelah"},
  {"id": 16, "label": "Foto Selfie saat acara"},
  {"id": 17, "label": "Foto Pemateri kedua"},
  {"id": 18, "label": "Foto orang yang sedang merem di acara/zoom"},
  {"id": 19, "label": "Share di story social media"},
  {"id": 20, "label": "Foto orang yang sedang makan di acara"},
  {"id": 21, "label": "Tulisan ERP saat acara"},
  {"id": 22, "label": "Pembicara minum air di depan panggung"},
  {"id": 23, "label": "Tulisan cybersecurity saat acara"},
  {"id": 24, "label": "Mengisi form evaluasi"},
  {"id": 25, "label": "Foto cewek berambut panjang di acara"},
  {"id": 26, "label": "Foto Seseorang tidak sesuai dresscode"},
  {"id": 27, "label": "Presentasi di 1 slide yang sama selama lebih dari 10 menit"},
  {"id": 28, "label": "Foto orang dengan hpnya di acara"},
  {"id": 29, "label": "Foto orang memakai topi di acara"}
]'::jsonb)
on conflict (id) do nothing;
