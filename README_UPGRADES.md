# Dashboard upgrade pack

Files to replace in GitHub:
- app.js
- db.js
- index.html
- style.css
- schema.sql

New optional files:
- public.html
- supabase_upgrade.sql
- public_mode_optional.sql

Before using Supabase file uploads:
1. Go to Supabase → SQL Editor.
2. Run `supabase_upgrade.sql`.
3. This creates a private Storage bucket called `dashboard-files`.
4. In the dashboard, add a new section with type `files`.
5. Open that section and use `↑ file`.

What changed:
- Search bar and filter dropdown.
- Dashboard stats row.
- Drag-and-drop card and sidebar section reordering.
- Better mobile layout.
- Markdown note preview and autosave.
- JSON import now works.
- Optional public page for public cards.
- Stronger RLS policies and indexes.
- Supabase Storage upload section type.
