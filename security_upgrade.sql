-- moco dashboard — security/schema upgrade
-- Run in Supabase → SQL Editor → New query → Run

-- Replace old policies with stricter policies that include WITH CHECK.
drop policy if exists "users manage own settings" on settings;
drop policy if exists "users manage own sections" on sections;
drop policy if exists "users manage own cards" on cards;

alter table settings enable row level security;
alter table sections enable row level security;
alter table cards enable row level security;

create policy "users manage own settings"
on settings
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users manage own sections"
on sections
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users manage own cards"
on cards
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Helpful indexes for speed.
create index if not exists idx_settings_user
on settings(user_id);

create index if not exists idx_sections_user_position
on sections(user_id, position);

create index if not exists idx_cards_user_section_position
on cards(user_id, section_id, position);

create index if not exists idx_cards_user_name
on cards(user_id, lower(name));

create index if not exists idx_cards_url
on cards(url)
where url <> '';

-- Optional: create a default section for school files for your logged-in user.
-- Use this only after you are logged into Supabase auth and know your user id.
-- You can also just create this section inside the dashboard UI instead.
