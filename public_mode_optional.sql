-- Optional public/share mode:
-- This allows anonymous visitors to read cards you marked visibility = 'public'.
-- It does NOT expose personal/private cards.
drop policy if exists "anon can read public cards" on cards;
create policy "anon can read public cards"
on cards for select to anon
using (visibility = 'public');
