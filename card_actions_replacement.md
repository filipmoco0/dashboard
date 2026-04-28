# Card actions replacement

In `app.js`, find the card HTML section that currently has only:

```js
✎ ×
```

Replace that card-actions area with this version:

```js
<div class="card-actions">
  ${!isNote && item.url ? `
    <button class="card-btn" title="open" onclick="event.stopPropagation(); openCardUrl('${escapeAttr(item.url)}')">↗</button>
    <button class="card-btn" title="copy link" onclick="event.stopPropagation(); copyCardUrl('${escapeAttr(item.url)}')">⧉</button>
    <button class="card-btn" title="download" onclick="event.stopPropagation(); downloadCardUrl('${escapeAttr(item.url)}')">↓</button>
  ` : ''}
  <button class="card-btn" title="edit" onclick="event.stopPropagation(); openEditCard('${sectionId}', '${item.id}')">✎</button>
  <button class="card-btn" title="delete" onclick="event.stopPropagation(); deleteCard('${sectionId}', '${item.id}')">×</button>
</div>
```

Also change the card click behavior from:

```js
window.open(item.url, '_blank');
```

to:

```js
openCardUrl(item.url);
```

This makes normal card clicks use the safer `noopener,noreferrer` behavior.
