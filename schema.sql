-- ═══════════════════════════════════════════════════════════
-- moco.wtf — Supabase SQL schema
-- Run this in: Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════

-- ─── settings ─────────────────────────────────────────────
create table if not exists settings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  site_name  text not null default 'moco.wtf',
  tagline    text not null default 'building stuff · breaking things',
  unique(user_id)
);

alter table settings enable row level security;

create policy "users manage own settings" on settings
  for all using (auth.uid() = user_id);

-- ─── sections ─────────────────────────────────────────────
create table if not exists sections (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  label     text not null,
  type      text not null default 'generic',  -- generic | projects | notes
  position  int  not null default 0
);

alter table sections enable row level security;

create policy "users manage own sections" on sections
  for all using (auth.uid() = user_id);

-- ─── cards ────────────────────────────────────────────────
create table if not exists cards (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  section_id     uuid not null references sections(id) on delete cascade,
  name           text not null,
  description    text not null default '',
  url            text not null default '',
  icon           text not null default '',
  color          text not null default 'ic-teal',
  visibility     text,           -- personal | public  (projects only)
  progress       text,           -- in-progress | done (projects only)
  linked_note_id uuid,           -- FK to another card (notes link)
  content        text default '', -- notes only
  position       int  not null default 0
);

alter table cards enable row level security;

create policy "users manage own cards" on cards
  for all using (auth.uid() = user_id);
