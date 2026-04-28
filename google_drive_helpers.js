/*
Paste these helper functions into app.js before the final boot(); call.

They add:
- Open Google Drive link
- Copy link
- Download/export where possible

No Google API is needed.
*/

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getGoogleDriveFileId(url) {
  if (!url) return null;

  const patterns = [
    /\/file\/d\/([^/]+)/,
    /[?&]id=([^&]+)/,
    /\/document\/d\/([^/]+)/,
    /\/presentation\/d\/([^/]+)/,
    /\/spreadsheets\/d\/([^/]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }

  return null;
}

function getDownloadUrl(url) {
  const fileId = getGoogleDriveFileId(url);
  if (!fileId) return url;

  if (url.includes('/document/')) {
    return `https://docs.google.com/document/d/${fileId}/export?format=pdf`;
  }

  if (url.includes('/presentation/')) {
    return `https://docs.google.com/presentation/d/${fileId}/export/pdf`;
  }

  if (url.includes('/spreadsheets/')) {
    return `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`;
  }

  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

function openCardUrl(url) {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

async function copyCardUrl(url) {
  if (!url) return;

  try {
    await navigator.clipboard.writeText(url);
    alert('link copied');
  } catch (e) {
    prompt('copy this link:', url);
  }
}

function downloadCardUrl(url) {
  if (!url) return;
  window.open(getDownloadUrl(url), '_blank', 'noopener,noreferrer');
}
