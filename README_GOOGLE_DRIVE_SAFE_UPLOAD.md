# Google Drive safer upload patch

This version adds a safer Google Drive flow:

- Settings panel with Google Drive connect/reconnect/disconnect.
- Upload modal with clear error messages.
- If the access token expires, upload asks you to reconnect instead of breaking.
- The dashboard remains usable after failed uploads.
- Google Drive files are saved back to the current dashboard section as cards.

## Files to upload to GitHub

Replace these in your repo:

- app.js
- index.html
- config.js
- style.css

## Google Cloud checklist

Make sure:

- Google Drive API is enabled.
- OAuth consent screen has your Gmail as a test user.
- Authorized JavaScript origins includes your live domain:
  - https://moco.wtf
  - and/or your Render URL

## Important

This browser-only version cannot stay connected across every PC forever.
On a different PC/browser, open Settings → Google Drive → connect/reconnect once.
