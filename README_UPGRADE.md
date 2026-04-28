# Google Drive upgrade for moco dashboard

This patch keeps the app simple:

- Files stay in Google Drive.
- Dashboard stores Google Drive links as normal cards.
- Cards get Open, Copy, and Download buttons.
- Supabase RLS policies are tightened with `WITH CHECK`.
- Mobile card buttons get easier to tap.

## Steps

1. In Supabase, run `security_upgrade.sql`.
2. In your dashboard, add a section called `school files`.
3. Paste `google_drive_helpers.js` into `app.js` before `boot();`.
4. Follow `card_actions_replacement.md` to replace the current edit/delete card actions.
5. Paste `style_additions.css` at the bottom of `style.css`.
6. Upload the changed files to GitHub.

## How to use

1. Upload your school file to Google Drive.
2. Right-click the file → Share.
3. Copy the link.
4. Add a card in the `school files` section.
5. Put the Drive link in the URL field.
6. Use:
   - ↗ open
   - ⧉ copy
   - ↓ download/export
   - ✎ edit
   - × delete from dashboard

Deleting a dashboard card does not delete the real Google Drive file.
