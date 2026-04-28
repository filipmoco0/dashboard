-- ═══════════════════════════════════════════════════════════
-- UPGRADE: security, indexes, files section type, storage
-- Run this after the original schema, or run safely on an existing project.
-- ═══════════════════════════════════════════════════════════

-- Replace old RLS policies with WITH CHECK policies.
drop policy if exists "users manage own settings" on settings;
drop policy if exists "users manage own sections" on sections;
drop policy if exists "users manage own cards" on cards;

create policy "users manage own settings"
on settings for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users manage own sections"
on sections for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users manage own cards"
on cards for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Helpful constraints/indexes.
create index if not exists idx_settings_user on settings(user_id);
create index if not exists idx_sections_user_position on sections(user_id, position);
create index if not exists idx_cards_user_section_position on cards(user_id, section_id, position);
create index if not exists idx_cards_linked_note_id on cards(linked_note_id);
create index if not exists idx_cards_user_name on cards(user_id, lower(name));

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cards_linked_note_id_fkey'
  ) then
    alter table cards
    add constraint cards_linked_note_id_fkey
    foreign key (linked_note_id) references cards(id) on delete set null;
  end if;
end $$;

-- Supabase Storage bucket for dashboard file uploads.
insert into storage.buckets (id, name, public)
values ('dashboard-files', 'dashboard-files', false)
on conflict (id) do nothing;

-- Private storage policies: each user can manage files only under their uid folder.
drop policy if exists "users read own dashboard files" on storage.objects;
drop policy if exists "users upload own dashboard files" on storage.objects;
drop policy if exists "users update own dashboard files" on storage.objects;
drop policy if exists "users delete own dashboard files" on storage.objects;

create policy "users read own dashboard files"
on storage.objects for select to authenticated
using (
  bucket_id = 'dashboard-files'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

create policy "users upload own dashboard files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'dashboard-files'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

create policy "users update own dashboard files"
on storage.objects for update to authenticated
using (
  bucket_id = 'dashboard-files'
  and (select auth.uid())::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'dashboard-files'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

create policy "users delete own dashboard files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'dashboard-files'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);
