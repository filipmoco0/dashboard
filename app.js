/* ═══════════════════════════════════════════════════════════
   app.js — UI logic
   ═══════════════════════════════════════════════════════════ */

/* ─── state ───────────────────────────────────────────────── */
const state = {
  user:          null,
  settings:      { siteName: 'moco.wtf', tagline: 'building stuff · breaking things' },
  sections:      [],
  cards:         {},
  activeSection: null,
  search: '',
  filter: 'all',
};

let editingCardId     = null;
let editingNoteId     = null;
let activeNoteSection = null;

/* section targeted by the mobile sheet */

const FALLBACK_ICONS = {
  'ic-teal':'🔗','ic-blue':'🔵','ic-purple':'💜','ic-pink':'🌸',
  'ic-amber':'⚡','ic-coral':'🔶','ic-green':'🌿','ic-gray':'⬜',
};

/* ═══════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════ */
async function boot() {
  const session = await dbGetSession();
  if (session) {
    state.user = session.user;
    await loadAll();
    showApp();
  } else {
    showLogin();
  }
}

async function loadAll() {
  const userId = state.user.id;

  const dbSettings = await dbGetSettings(userId);
  if (dbSettings) {
    state.settings.siteName = dbSettings.site_name || 'moco.wtf';
    state.settings.tagline  = dbSettings.tagline   || '';
  }

  state.sections = await dbGetSections(userId);

  if (state.sections.length === 0) {
    const defaults = [
      { label: 'now',               type: 'generic',  position: 0 },
      { label: 'projects',          type: 'projects', position: 1 },
      { label: 'notes',             type: 'notes',    position: 2 },
      { label: 'files',             type: 'files',    position: 3 },
      { label: 'links & bookmarks', type: 'generic',  position: 4 },
    ];
    for (const d of defaults) {
      const created = await dbInsertSection(userId, d.label, d.type, d.position);
      state.sections.push(created);
    }
  }

  state.cards = {};
  for (const s of state.sections) {
    const raw = await dbGetCards(s.id);
    state.cards[s.id] = raw.map(mapCard);
  }

  if (state.sections.length > 0 && !state.activeSection) {
    state.activeSection = state.sections[0].id;
  }
}

function mapCard(row) {
  return {
    id:           row.id,
    name:         row.name,
    desc:         row.description,
    url:          row.url,
    icon:         row.icon,
    color:        row.color,
    visibility:   row.visibility,
    progress:     row.progress,
    linkedNoteId: row.linked_note_id,
    content:      row.content,
    position:     row.position,
  };
}

/* ═══════════════════════════════════════════════════════════
   AUTH
   ═══════════════════════════════════════════════════════════ */
function showLogin() {
  document.getElementById('login-page').classList.add('visible');
  document.getElementById('app').classList.remove('visible');
  const tb = document.getElementById('mobile-tabbar');
  if (tb) tb.classList.remove('visible');
}

function showApp() {
  document.getElementById('login-page').classList.remove('visible');
  document.getElementById('app').classList.add('visible');
  const tb = document.getElementById('mobile-tabbar');
  if (tb) tb.classList.add('visible');
  renderSidebar();
  renderMain();
  applySettings();
}

async function doLogin() {
  const email    = document.getElementById('l-email').value.trim();
  const password = document.getElementById('l-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.classList.remove('visible');
  try {
    const session = await dbSignIn(email, password);
    state.user = session.user;
    await loadAll();
    showApp();
  } catch (e) {
    errEl.classList.add('visible');
  }
}

async function doLogout() {
  await dbSignOut();
  state.user = null; state.sections = []; state.cards = {}; state.activeSection = null;
  showLogin();
}

/* ═══════════════════════════════════════════════════════════
   SETTINGS
   ═══════════════════════════════════════════════════════════ */
function applySettings() {
  const s = state.settings;
  document.title = s.siteName;
  const logoEl = document.getElementById('header-logo');
  if (logoEl) {
    const dot = s.siteName.indexOf('.');
    logoEl.innerHTML = dot !== -1
      ? s.siteName.slice(0, dot) + '<span>' + s.siteName.slice(dot) + '</span>'
      : s.siteName;
  }
  const tEl = document.getElementById('header-tagline');
  if (tEl) tEl.textContent = s.tagline;
}

function openSettings() {
  document.getElementById('s-name').value    = state.settings.siteName;
  document.getElementById('s-tagline').value = state.settings.tagline;
  renderSettingsSections();
  document.getElementById('modal-settings').classList.add('open');
}

function renderSettingsSections() {
  const list = document.getElementById('settings-sections-list');
  if (!list) return;
  list.innerHTML = '';
  state.sections.forEach((s, idx) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:0.5px solid var(--border);';

    const icon = document.createElement('span');
    icon.style.cssText = 'font-size:13px;width:16px;text-align:center;flex-shrink:0;color:var(--text-tertiary);';
    icon.textContent = sectionIcon(s.type);

    const label = document.createElement('span');
    label.style.cssText = 'flex:1;font-family:var(--mono);font-size:12px;color:var(--text-primary);';
    label.textContent = s.label;

    const btnUp = document.createElement('button');
    btnUp.textContent = '↑';
    btnUp.disabled = idx === 0;
    btnUp.style.cssText = 'font-family:var(--mono);font-size:12px;background:none;border:0.5px solid var(--border-hover);border-radius:5px;padding:3px 7px;cursor:pointer;color:var(--text-secondary);opacity:' + (idx === 0 ? '0.3' : '1') + ';';
    btnUp.onclick = async () => { await moveSectionUp(s.id); renderSettingsSections(); };

    const btnDown = document.createElement('button');
    btnDown.textContent = '↓';
    btnDown.disabled = idx === state.sections.length - 1;
    btnDown.style.cssText = 'font-family:var(--mono);font-size:12px;background:none;border:0.5px solid var(--border-hover);border-radius:5px;padding:3px 7px;cursor:pointer;color:var(--text-secondary);opacity:' + (idx === state.sections.length - 1 ? '0.3' : '1') + ';';
    btnDown.onclick = async () => { await moveSectionDown(s.id); renderSettingsSections(); };

    const btnDel = document.createElement('button');
    btnDel.textContent = '×';
    btnDel.style.cssText = 'font-family:var(--mono);font-size:12px;background:none;border:0.5px solid rgba(216,90,48,0.3);border-radius:5px;padding:3px 7px;cursor:pointer;color:var(--danger);';
    btnDel.onclick = async () => { await removeSection(s.id); renderSettingsSections(); };

    row.appendChild(icon);
    row.appendChild(label);
    row.appendChild(btnUp);
    row.appendChild(btnDown);
    row.appendChild(btnDel);
    list.appendChild(row);
  });
}

function closeSettings() { document.getElementById('modal-settings').classList.remove('open'); }

async function saveSettings() {
  state.settings.siteName = document.getElementById('s-name').value.trim()    || 'moco.wtf';
  state.settings.tagline  = document.getElementById('s-tagline').value.trim() || '';
  await dbUpsertSettings(state.user.id, state.settings.siteName, state.settings.tagline);
  applySettings();
  closeSettings();
}

function exportData() {
  const blob = new Blob([JSON.stringify({ settings: state.settings, sections: state.sections, cards: state.cards }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'moco-dashboard.json';
  a.click();
}

async function importData(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.sections || !data.cards) throw new Error('Invalid dashboard JSON.');

    const mode = confirm('Import will add sections/cards from the JSON. Press OK to continue.') ;
    if (!mode) return;

    const idMap = new Map();

    for (const s of data.sections) {
      const created = await dbInsertSection(
        state.user.id,
        s.label || 'imported',
        ['generic', 'projects', 'notes', 'files'].includes(s.type) ? s.type : 'generic',
        state.sections.length
      );
      state.sections.push(created);
      state.cards[created.id] = [];
      idMap.set(s.id, created.id);

      const sourceCards = data.cards[s.id] || [];
      for (const [i, c] of sourceCards.entries()) {
        const fields = {
          name: c.name || 'imported card',
          desc: c.desc || c.description || '',
          url: c.url || '',
          icon: c.icon || '',
          color: c.color || 'ic-teal',
          visibility: c.visibility || null,
          progress: c.progress || null,
          linkedNoteId: null,
          content: c.content || '',
        };
        const row = await dbInsertCard(state.user.id, created.id, fields, i);
        state.cards[created.id].push(mapCard(row));
      }
    }

    state.activeSection = state.sections[0]?.id || null;
    renderSidebar();
    renderMain();
    alert('Import complete.');
  } catch (e) {
    console.error(e);
    alert('Import failed: ' + (e.message || e));
  }
}

async function resetData() {
  if (!confirm('Reset everything? This deletes all sections and cards.')) return;
  for (const s of state.sections) {
    for (const c of (state.cards[s.id] || [])) await dbDeleteCard(c.id);
    await dbDeleteSection(s.id);
  }
  state.sections = []; state.cards = {}; state.activeSection = null;
  await loadAll();
  renderSidebar();
  renderMain();
  closeSettings();
}

/* ─── mobile bottom tab bar ───────────────────────────────── */
function renderMobileTabbar() {
  const container = document.getElementById('tabbar-sections');
  if (!container) return;
  container.innerHTML = '';

  state.sections.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'tabbar-tab' + (s.id === state.activeSection ? ' active' : '');
    btn.innerHTML = `<span class="tab-icon">${sectionIcon(s.type)}</span><span>${s.label}</span>`;
    btn.onclick = () => switchSection(s.id);

    container.appendChild(btn);
  });
}

/* ═══════════════════════════════════════════════════════════
   SIDEBAR
   ═══════════════════════════════════════════════════════════ */
function renderSidebar() {
  renderMobileTabbar();

  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = '';

  state.sections.forEach((s, idx) => {
    const row = document.createElement('div');
    row.className = 'nav-item-row';
    row.draggable = true;
    row.dataset.sectionId = s.id;
    row.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', s.id));
    row.addEventListener('dragover', e => e.preventDefault());
    row.addEventListener('drop', e => {
      e.preventDefault();
      const fromId = e.dataTransfer.getData('text/plain');
      if (fromId && fromId !== s.id) moveSectionTo(fromId, s.id);
    });

    const btn = document.createElement('button');
    btn.className = 'nav-item' + (s.id === state.activeSection ? ' active' : '');
    btn.innerHTML = `<span class="nav-item-icon">${sectionIcon(s.type)}</span>${s.label}`;
    btn.onclick = () => switchSection(s.id);

    row.appendChild(btn);

    nav.appendChild(row);
  });

  const divider = document.createElement('div');
  divider.className = 'nav-divider';
  nav.appendChild(divider);

  const addBtn = document.createElement('button');
  addBtn.className = 'nav-item';
  addBtn.innerHTML = '<span class="nav-item-icon">+</span> add section';
  addBtn.onclick = openSectionModal;
  nav.appendChild(addBtn);
}

function sectionIcon(type) {
  return { generic: '◈', projects: '⬡', notes: '▤', files: '▣' }[type] || '◈';
}

function switchSection(sectionId) {
  state.activeSection = sectionId;
  renderSidebar();
  renderMain();
}

/* ─── reorder sections ────────────────────────────────────── */
async function moveSectionUp(sectionId) {
  const idx = state.sections.findIndex(s => s.id === sectionId);
  if (idx <= 0) return;
  [state.sections[idx - 1], state.sections[idx]] = [state.sections[idx], state.sections[idx - 1]];
  await persistSectionOrder();
  renderSidebar();
}

async function moveSectionDown(sectionId) {
  const idx = state.sections.findIndex(s => s.id === sectionId);
  if (idx < 0 || idx >= state.sections.length - 1) return;
  [state.sections[idx], state.sections[idx + 1]] = [state.sections[idx + 1], state.sections[idx]];
  await persistSectionOrder();
  renderSidebar();
}

async function persistSectionOrder() {
  for (let i = 0; i < state.sections.length; i++) {
    await dbUpdateSectionPosition(state.sections[i].id, i);
  }
}

/* ─── delete section ──────────────────────────────────────── */
async function removeSection(sectionId) {
  const section = state.sections.find(s => s.id === sectionId);
  if (!section) return;
  if (!confirm(`Remove section "${section.label}"? All cards will be deleted.`)) return;
  for (const c of (state.cards[sectionId] || [])) await dbDeleteCard(c.id);
  await dbDeleteSection(sectionId);
  state.sections = state.sections.filter(s => s.id !== sectionId);
  delete state.cards[sectionId];
  if (state.activeSection === sectionId) state.activeSection = state.sections[0]?.id || null;
  renderSidebar();
  renderMain();
}

/* ═══════════════════════════════════════════════════════════
   MAIN PANEL
   ═══════════════════════════════════════════════════════════ */
function renderMain() {
  const section = state.sections.find(s => s.id === state.activeSection);
  document.getElementById('main-title').textContent = section ? section.label : '—';
  renderToolbar(section);
  if (section) renderGrid(section.id);
  else document.getElementById('main-grid').innerHTML = '';
}

function renderGrid(sectionId) {
  const section = state.sections.find(s => s.id === sectionId);
  const grid    = document.getElementById('main-grid');
  if (!grid || !section) return;

  const allItems = state.cards[sectionId] || [];
  const items = getFilteredItems(allItems, section);
  grid.innerHTML = '';

  grid.appendChild(renderStats(section, allItems, items));

  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = allItems.length === 0 ? 'no items yet — hit "+ add" to get started' : 'no matches';
    grid.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const idx = allItems.findIndex(c => c.id === item.id);
    const isNote = section.type === 'notes';
    const isFile = isFileCard(item) || section.type === 'files';
    const card   = document.createElement('div');
    card.className = 'card' + (!isNote && (item.url || isFile) ? ' card-link' : '');
    card.draggable = true;
    card.dataset.cardId = item.id;

    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', item.id);
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('dragover', e => e.preventDefault());
    card.addEventListener('drop', async e => {
      e.preventDefault();
      const fromId = e.dataTransfer.getData('text/plain');
      if (fromId && fromId !== item.id) await moveCardTo(sectionId, fromId, item.id);
    });

    if (isNote) {
      card.onclick = e => {
        if (!e.target.closest('.card-actions') && !e.target.closest('.card-reorder')) openNoteModal(sectionId, item.id);
      };
      card.style.cursor = 'pointer';
    } else if (isFile) {
      card.onclick = e => {
        if (!e.target.closest('.card-actions') && !e.target.closest('.card-reorder')) openStoredFile(item);
      };
    } else if (item.url) {
      card.onclick = e => {
        if (!e.target.closest('.card-actions') && !e.target.closest('.card-reorder')) window.open(item.url, '_blank', 'noopener,noreferrer');
      };
    }

    const tags = [];
    if (section.type === 'projects') {
      if (item.visibility) tags.push(`<span class="tag tag-${escapeHtml(item.visibility)}">${escapeHtml(item.visibility)}</span>`);
      if (item.progress) {
        const wip = item.progress === 'in-progress';
        tags.push(`<span class="tag-progress"><span class="progress-dot ${wip ? 'dot-inprogress' : 'dot-done'}"></span>${wip ? 'in progress' : 'done'}</span>`);
      }
    }
    if (isFile) {
      const meta = getFileMeta(item);
      if (meta?.size) tags.push(`<span class="tag-progress">${formatBytes(meta.size)}</span>`);
      tags.push(`<span class="tag tag-personal">file</span>`);
    }
    if (!isNote && item.linkedNoteId) {
      const note = findNoteById(item.linkedNoteId);
      if (note) tags.push(`<button class="tag-note-link" onclick="openNoteFromTag(event,'${item.linkedNoteId}')">📝 ${escapeHtml(note.name)}</button>`);
    }
    const tagHtml = tags.length ? `<div class="tag-row">${tags.join('')}</div>` : '';

    const canUp   = idx > 0;
    const canDown = idx < allItems.length - 1;
    const reorderHtml = `
      <div class="card-reorder">
        ${canUp   ? `<button class="card-btn" title="move left"  onclick="moveCardUp('${sectionId}','${item.id}')">←</button>` : ''}
        ${canDown ? `<button class="card-btn" title="move right" onclick="moveCardDown('${sectionId}','${item.id}')">→</button>` : ''}
      </div>`;

    const actions = isFile ? `
        <button class="card-btn" title="open file" onclick="event.stopPropagation(); openStoredFileById('${sectionId}','${item.id}')">↗</button>
        <button class="card-btn" title="download file" onclick="event.stopPropagation(); downloadStoredFileById('${sectionId}','${item.id}')">↓</button>
      ` : '';

    card.innerHTML = `
      <div class="card-actions">
        ${actions}
        <button class="card-btn" title="edit"   onclick="event.stopPropagation(); openEditCard('${sectionId}','${item.id}')">✎</button>
        <button class="card-btn" title="delete" onclick="event.stopPropagation(); deleteCard('${sectionId}','${item.id}')">×</button>
      </div>
      <div class="card-icon ${escapeHtml(item.color || 'ic-teal')}">${escapeHtml(item.icon || FALLBACK_ICONS[item.color] || (isFile ? '📎' : '🔗'))}</div>
      <div class="card-name">${highlightMatch(item.name)}</div>
      ${item.desc ? `<div class="card-desc">${highlightMatch(item.desc)}</div>` : ''}
      ${isNote ? `<div class="card-note-hint">tap to open · ${wordCount(item.content)} words</div>` : ''}
      ${!isNote && item.url ? `<div class="card-url">${highlightMatch(item.url.replace(/^https?:\/\//, ''))}</div>` : ''}
      ${isFile ? `<div class="card-url">${escapeHtml(getFileMeta(item)?.path || 'stored in Supabase')}</div>` : ''}
      ${tagHtml}
      ${reorderHtml}
    `;
    grid.appendChild(card);
  });
}


function renderToolbar(section) {
  const actions = document.querySelector('.main-actions');
  if (!actions) return;
  let search = document.getElementById('search-input');
  let filter = document.getElementById('filter-select');
  let upload = document.getElementById('btn-upload-file');

  if (!search) {
    search = document.createElement('input');
    search.id = 'search-input';
    search.className = 'search-input';
    search.placeholder = 'search…';
    search.oninput = () => { state.search = search.value; renderMain(); };
    actions.insertBefore(search, actions.firstChild);
  }
  search.value = state.search || '';

  if (!filter) {
    filter = document.createElement('select');
    filter.id = 'filter-select';
    filter.className = 'filter-select';
    filter.onchange = () => { state.filter = filter.value; renderMain(); };
    actions.insertBefore(filter, document.getElementById('btn-add-card'));
  }
  filter.innerHTML = `
    <option value="all">all</option>
    <option value="links">links</option>
    <option value="files">files</option>
    <option value="done">done</option>
    <option value="wip">in progress</option>
    <option value="public">public</option>
  `;
  filter.value = state.filter || 'all';

  if (!upload) {
    upload = document.createElement('button');
    upload.id = 'btn-upload-file';
    upload.className = 'btn-add';
    upload.textContent = '↑ file';
    upload.onclick = openFileUploadModal;
    actions.insertBefore(upload, document.getElementById('btn-add-card'));
  }

  upload.style.display = section && section.type === 'files' ? 'inline-flex' : 'none';
  document.getElementById('btn-add-card').style.display = section && section.type === 'files' ? 'none' : 'inline-flex';
}

function getFilteredItems(items, section) {
  const q = (state.search || '').trim().toLowerCase();
  return items.filter(item => {
    const meta = getFileMeta(item);
    const text = [
      item.name, item.desc, item.url, item.content,
      item.visibility, item.progress, meta?.path, meta?.type
    ].filter(Boolean).join(' ').toLowerCase();

    if (q && !text.includes(q)) return false;

    switch (state.filter) {
      case 'links': return !!item.url && !isFileCard(item);
      case 'files': return isFileCard(item) || section.type === 'files';
      case 'done': return item.progress === 'done';
      case 'wip': return item.progress === 'in-progress';
      case 'public': return item.visibility === 'public';
      default: return true;
    }
  });
}

function renderStats(section, allItems, visibleItems) {
  const wrap = document.createElement('div');
  wrap.className = 'stats-row';
  const allCards = Object.values(state.cards).flat();
  const projects = allCards.filter(c => c.progress);
  const done = projects.filter(c => c.progress === 'done').length;
  const notes = state.sections.filter(s => s.type === 'notes').reduce((n, s) => n + (state.cards[s.id] || []).length, 0);
  const files = allCards.filter(isFileCard).length;
  wrap.innerHTML = `
    <div class="stat-pill"><strong>${allItems.length}</strong><span>in section</span></div>
    <div class="stat-pill"><strong>${visibleItems.length}</strong><span>shown</span></div>
    <div class="stat-pill"><strong>${done}/${projects.length}</strong><span>projects done</span></div>
    <div class="stat-pill"><strong>${notes}</strong><span>notes</span></div>
    <div class="stat-pill"><strong>${files}</strong><span>files</span></div>
  `;
  return wrap;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function highlightMatch(value) {
  const safe = escapeHtml(value ?? '');
  const q = (state.search || '').trim();
  if (!q) return safe;
  const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(`(${escapedQ})`, 'ig'), '<mark>$1</mark>');
}

function wordCount(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function getFileMeta(card) {
  try {
    const meta = JSON.parse(card.content || '{}');
    return meta && meta.kind === 'supabase-file' ? meta : null;
  } catch {
    return null;
  }
}

function isFileCard(card) {
  return !!getFileMeta(card);
}

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
}

async function moveCardTo(sectionId, fromId, toId) {
  const cards = state.cards[sectionId] || [];
  const from = cards.findIndex(c => c.id === fromId);
  const to = cards.findIndex(c => c.id === toId);
  if (from < 0 || to < 0 || from === to) return;
  const [moved] = cards.splice(from, 1);
  cards.splice(to, 0, moved);
  await persistCardOrder(sectionId);
  renderGrid(sectionId);
}

async function moveSectionTo(fromId, toId) {
  const from = state.sections.findIndex(s => s.id === fromId);
  const to = state.sections.findIndex(s => s.id === toId);
  if (from < 0 || to < 0 || from === to) return;
  const [moved] = state.sections.splice(from, 1);
  state.sections.splice(to, 0, moved);
  await persistSectionOrder();
  renderSidebar();
  renderMain();
}


function findNoteById(noteId) {
  for (const s of state.sections) {
    if (s.type === 'notes') {
      const found = (state.cards[s.id] || []).find(c => c.id === noteId);
      if (found) return found;
    }
  }
  return null;
}

/* ─── card reorder ────────────────────────────────────────── */
async function moveCardUp(sectionId, cardId) {
  const cards = state.cards[sectionId] || [];
  const idx   = cards.findIndex(c => c.id === cardId);
  if (idx <= 0) return;
  [cards[idx - 1], cards[idx]] = [cards[idx], cards[idx - 1]];
  await persistCardOrder(sectionId);
  renderGrid(sectionId);
}

async function moveCardDown(sectionId, cardId) {
  const cards = state.cards[sectionId] || [];
  const idx   = cards.findIndex(c => c.id === cardId);
  if (idx < 0 || idx >= cards.length - 1) return;
  [cards[idx], cards[idx + 1]] = [cards[idx + 1], cards[idx]];
  await persistCardOrder(sectionId);
  renderGrid(sectionId);
}

async function persistCardOrder(sectionId) {
  const cards = state.cards[sectionId] || [];
  for (let i = 0; i < cards.length; i++) {
    await dbUpdateCardPosition(cards[i].id, i);
  }
}

/* ═══════════════════════════════════════════════════════════
   CARD MODAL
   ═══════════════════════════════════════════════════════════ */
function openCardModal() {
  const section = state.sections.find(s => s.id === state.activeSection);
  if (!section) return;
  editingCardId = null;
  document.getElementById('modal-card-title').textContent = section.type === 'notes' ? 'add note' : 'add item';
  clearCardFields();
  toggleCardFields(section.type);
  populateLinkedNoteSelect(null);
  document.getElementById('modal-card').classList.add('open');
  setTimeout(() => document.getElementById('f-name').focus(), 50);
}

function openEditCard(sectionId, cardId) {
  const section = state.sections.find(s => s.id === sectionId);
  const card    = (state.cards[sectionId] || []).find(c => c.id === cardId);
  if (!section || !card) return;
  state.activeSection = sectionId;
  editingCardId = cardId;
  document.getElementById('modal-card-title').textContent = 'edit item';
  document.getElementById('f-name').value  = card.name  || '';
  document.getElementById('f-desc').value  = card.desc  || '';
  document.getElementById('f-url').value   = card.url   || '';
  document.getElementById('f-icon').value  = card.icon  || '';
  document.getElementById('f-color').value = card.color || 'ic-teal';
  document.getElementById('f-visibility').value = card.visibility || 'personal';
  document.getElementById('f-progress').value   = card.progress   || 'in-progress';
  toggleCardFields(section.type);
  populateLinkedNoteSelect(card.linkedNoteId || null);
  document.getElementById('modal-card').classList.add('open');
  setTimeout(() => document.getElementById('f-name').focus(), 50);
}

function clearCardFields() {
  ['f-name','f-desc','f-url','f-icon'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-color').value      = 'ic-teal';
  document.getElementById('f-visibility').value = 'personal';
  document.getElementById('f-progress').value   = 'in-progress';
}

function toggleCardFields(type) {
  const isProjects = type === 'projects';
  const isNotes    = type === 'notes';
  const isFiles    = type === 'files';
  document.getElementById('f-visibility-wrap').style.display = isProjects ? 'flex' : 'none';
  document.getElementById('f-progress-wrap').style.display   = isProjects ? 'flex' : 'none';
  document.getElementById('f-url-wrap').style.display        = (isNotes || isFiles) ? 'none' : 'flex';
  document.getElementById('f-note-wrap').style.display       = (isNotes || isFiles) ? 'none' : 'flex';
}

function populateLinkedNoteSelect(selectedId) {
  const sel = document.getElementById('f-linked-note');
  sel.innerHTML = '<option value="">— none —</option>';
  state.sections.filter(s => s.type === 'notes').forEach(s => {
    (state.cards[s.id] || []).forEach(note => {
      const opt = document.createElement('option');
      opt.value = note.id; opt.textContent = note.name;
      if (note.id === selectedId) opt.selected = true;
      sel.appendChild(opt);
    });
  });
}

function closeCardModal() {
  document.getElementById('modal-card').classList.remove('open');
  editingCardId = null;
}

async function saveCard() {
  const name = document.getElementById('f-name').value.trim();
  if (!name) return;
  const section = state.sections.find(s => s.id === state.activeSection);
  if (!section) return;
  const isNotes = section.type === 'notes';
  if (section.type === 'files') { openFileUploadModal(); return; }

  const fields = {
    name,
    desc:         document.getElementById('f-desc').value.trim(),
    url:          isNotes ? '' : document.getElementById('f-url').value.trim(),
    icon:         document.getElementById('f-icon').value.trim(),
    color:        document.getElementById('f-color').value,
    visibility:   section.type === 'projects' ? document.getElementById('f-visibility').value : null,
    progress:     section.type === 'projects' ? document.getElementById('f-progress').value   : null,
    linkedNoteId: (!isNotes && document.getElementById('f-linked-note').value) || null,
    content:      editingCardId
      ? ((state.cards[state.activeSection] || []).find(c => c.id === editingCardId) || {}).content || ''
      : '',
  };

  if (editingCardId) {
    await dbUpdateCard(editingCardId, fields);
    const idx = state.cards[state.activeSection].findIndex(c => c.id === editingCardId);
    if (idx !== -1) state.cards[state.activeSection][idx] = { ...state.cards[state.activeSection][idx], ...fields };
  } else {
    const pos = (state.cards[state.activeSection] || []).length;
    const row = await dbInsertCard(state.user.id, state.activeSection, fields, pos);
    if (!state.cards[state.activeSection]) state.cards[state.activeSection] = [];
    state.cards[state.activeSection].push(mapCard(row));
  }

  renderGrid(state.activeSection);
  closeCardModal();
}

async function deleteCard(sectionId, cardId) {
  const card = (state.cards[sectionId] || []).find(c => c.id === cardId);
  if (!confirm('Delete this card?')) return;
  const meta = card ? getFileMeta(card) : null;
  if (meta?.path) {
    try { await dbDeleteDashboardFile(meta.path); } catch (e) { console.warn('File delete failed:', e); }
  }
  await dbDeleteCard(cardId);
  state.cards[sectionId] = (state.cards[sectionId] || []).filter(c => c.id !== cardId);
  renderGrid(sectionId);
}

/* ═══════════════════════════════════════════════════════════
   NOTE EDITOR MODAL
   ═══════════════════════════════════════════════════════════ */

function markdownToHtml(md) {
  let html = escapeHtml(md || '');
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>')
             .replace(/^## (.*)$/gm, '<h2>$1</h2>')
             .replace(/^# (.*)$/gm, '<h1>$1</h1>')
             .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
             .replace(/\*(.*?)\*/g, '<em>$1</em>')
             .replace(/`([^`]+)`/g, '<code>$1</code>')
             .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
             .replace(/\n/g, '<br>');
  return html;
}

function updateNotePreview() {
  const preview = document.getElementById('fn-preview');
  const content = document.getElementById('fn-content');
  if (preview && content) preview.innerHTML = markdownToHtml(content.value);
}

function updateNoteStatus(text) {
  const el = document.getElementById('fn-status');
  if (el) el.textContent = text;
}

let noteAutosaveTimer = null;
function scheduleNoteAutosave() {
  updateNotePreview();
  updateNoteStatus('editing…');
  clearTimeout(noteAutosaveTimer);
  noteAutosaveTimer = setTimeout(async () => {
    if (!editingNoteId || !activeNoteSection) return;
    await saveNote(false);
  }, 1200);
}

function openNoteModal(sectionId, noteId) {
  const note = (state.cards[sectionId] || []).find(c => c.id === noteId);
  if (!note) return;
  activeNoteSection = sectionId;
  editingNoteId     = noteId;
  document.getElementById('modal-note-title').textContent = note.name || 'note';
  document.getElementById('fn-name').value    = note.name    || '';
  document.getElementById('fn-content').value = note.content || '';
  updateNotePreview();
  updateNoteStatus('loaded');
  document.getElementById('fn-color').value   = note.color   || 'ic-teal';
  document.getElementById('fn-icon').value    = note.icon    || '';
  document.getElementById('modal-note').classList.add('open');
  setTimeout(() => document.getElementById('fn-content').focus(), 50);
}

function closeNoteModal() {
  document.getElementById('modal-note').classList.remove('open');
  editingNoteId = null;
}

async function saveNote(closeAfterSave = true) {
  const idx = (state.cards[activeNoteSection] || []).findIndex(c => c.id === editingNoteId);
  if (idx === -1) return;
  const updated = {
    ...state.cards[activeNoteSection][idx],
    name:    document.getElementById('fn-name').value.trim(),
    content: document.getElementById('fn-content').value,
    color:   document.getElementById('fn-color').value,
    icon:    document.getElementById('fn-icon').value.trim(),
  };
  await dbUpdateCard(editingNoteId, updated);
  state.cards[activeNoteSection][idx] = updated;
  renderGrid(activeNoteSection);
  updateNoteStatus('saved');
  if (closeAfterSave) closeNoteModal();
}

function openNoteFromTag(event, noteId) {
  event.stopPropagation();
  for (const s of state.sections) {
    if (s.type === 'notes') {
      const found = (state.cards[s.id] || []).find(c => c.id === noteId);
      if (found) { openNoteModal(s.id, noteId); return; }
    }
  }
}

/* ═══════════════════════════════════════════════════════════
   SECTION MODAL
   ═══════════════════════════════════════════════════════════ */
function openSectionModal() {
  document.getElementById('fs-name').value = '';
  document.getElementById('fs-type').value = 'generic';
  document.getElementById('modal-section').classList.add('open');
  setTimeout(() => document.getElementById('fs-name').focus(), 50);
}

function closeSectionModal() { document.getElementById('modal-section').classList.remove('open'); }

async function saveSection() {
  const label = document.getElementById('fs-name').value.trim();
  if (!label) return;
  const type    = document.getElementById('fs-type').value;
  const pos     = state.sections.length;
  const created = await dbInsertSection(state.user.id, label, type, pos);
  state.sections.push(created);
  state.cards[created.id] = [];
  state.activeSection = created.id;
  renderSidebar();
  renderMain();
  closeSectionModal();
}


/* ═══════════════════════════════════════════════════════════
   SUPABASE FILE UPLOADS
   ═══════════════════════════════════════════════════════════ */
function openFileUploadModal() {
  const section = state.sections.find(s => s.id === state.activeSection);
  if (!section || section.type !== 'files') {
    alert('Create or open a section with type "files" first.');
    return;
  }
  document.getElementById('fu-file').value = '';
  document.getElementById('fu-title').value = '';
  document.getElementById('fu-desc').value = '';
  document.getElementById('fu-status').textContent = '';
  document.getElementById('modal-file-upload').classList.add('open');
}

function closeFileUploadModal() {
  document.getElementById('modal-file-upload').classList.remove('open');
}

async function saveUploadedFile() {
  const file = document.getElementById('fu-file').files[0];
  if (!file) { alert('Choose a file first.'); return; }
  const section = state.sections.find(s => s.id === state.activeSection);
  if (!section || section.type !== 'files') return;

  const status = document.getElementById('fu-status');
  try {
    status.textContent = 'uploading…';
    const uploaded = await dbUploadDashboardFile(state.user.id, file);

    const fields = {
      name: document.getElementById('fu-title').value.trim() || file.name,
      desc: document.getElementById('fu-desc').value.trim(),
      url: '',
      icon: iconForUploadedFile(file.name),
      color: 'ic-blue',
      visibility: null,
      progress: null,
      linkedNoteId: null,
      content: JSON.stringify({
        kind: 'supabase-file',
        bucket: uploaded.bucket,
        path: uploaded.path,
        size: file.size,
        type: file.type,
        originalName: file.name,
        uploadedAt: new Date().toISOString()
      })
    };

    const pos = (state.cards[state.activeSection] || []).length;
    const row = await dbInsertCard(state.user.id, state.activeSection, fields, pos);
    if (!state.cards[state.activeSection]) state.cards[state.activeSection] = [];
    state.cards[state.activeSection].push(mapCard(row));

    renderGrid(state.activeSection);
    closeFileUploadModal();
  } catch (e) {
    console.error(e);
    status.textContent = 'error: ' + (e.message || e);
    alert('Upload failed: ' + (e.message || e));
  }
}

function iconForUploadedFile(name) {
  const n = (name || '').toLowerCase();
  if (n.endsWith('.pdf')) return '📄';
  if (n.endsWith('.doc') || n.endsWith('.docx')) return '📝';
  if (n.endsWith('.ppt') || n.endsWith('.pptx')) return '📊';
  if (n.endsWith('.xls') || n.endsWith('.xlsx')) return '📈';
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(n)) return '🖼️';
  if (/\.(zip|rar|7z)$/.test(n)) return '🗜️';
  return '📎';
}

async function openStoredFile(card) {
  const meta = getFileMeta(card);
  if (!meta) return;
  const url = await dbCreateFileSignedUrl(meta.path, false);
  window.open(url, '_blank', 'noopener,noreferrer');
}

async function downloadStoredFile(card) {
  const meta = getFileMeta(card);
  if (!meta) return;
  const url = await dbCreateFileSignedUrl(meta.path, meta.originalName || card.name || true);
  window.open(url, '_blank', 'noopener,noreferrer');
}

function openStoredFileById(sectionId, cardId) {
  const card = (state.cards[sectionId] || []).find(c => c.id === cardId);
  if (card) openStoredFile(card);
}

function downloadStoredFileById(sectionId, cardId) {
  const card = (state.cards[sectionId] || []).find(c => c.id === cardId);
  if (card) downloadStoredFile(card);
}

/* ═══════════════════════════════════════════════════════════
   GLOBAL EVENTS
   ═══════════════════════════════════════════════════════════ */
['modal-card','modal-note','modal-section','modal-settings','modal-file-upload'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener('click', e => {
    if (e.target === el) { closeCardModal(); closeNoteModal(); closeSectionModal(); closeSettings(); closeFileUploadModal(); }
  });
});


document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeCardModal(); closeNoteModal(); closeSectionModal(); closeSettings(); closeFileUploadModal(); }
});

document.getElementById('l-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

/* ─── init ────────────────────────────────────────────────── */


boot();
