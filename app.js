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
      { label: 'links & bookmarks', type: 'generic',  position: 3 },
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

function importData(event) {
  event.target.value = '';
  alert('Import via JSON is not supported with Supabase backend.\nUse the dashboard UI to add sections and cards.');
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
  return { generic: '◈', projects: '⬡', notes: '▤' }[type] || '◈';
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
  if (section) renderGrid(section.id);
  else document.getElementById('main-grid').innerHTML = '';
}

function renderGrid(sectionId) {
  const section = state.sections.find(s => s.id === sectionId);
  const grid    = document.getElementById('main-grid');
  if (!grid || !section) return;

  const items = state.cards[sectionId] || [];
  grid.innerHTML = '';

  if (items.length === 0) {
    grid.innerHTML = `<div class="empty-state">no items yet — hit "+ add" to get started</div>`;
    return;
  }

  items.forEach((item, idx) => {
    const isNote = section.type === 'notes';
    const card   = document.createElement('div');
    card.className = 'card' + (!isNote && item.url ? ' card-link' : '');

    if (isNote) {
      card.onclick = e => { if (!e.target.closest('.card-actions') && !e.target.closest('.card-reorder')) openNoteModal(sectionId, item.id); };
      card.style.cursor = 'pointer';
    } else if (item.url) {
      card.onclick = e => { if (!e.target.closest('.card-actions') && !e.target.closest('.card-reorder')) window.open(item.url, '_blank'); };
    }

    /* tags */
    const tags = [];
    if (section.type === 'projects') {
      if (item.visibility) tags.push(`<span class="tag tag-${item.visibility}">${item.visibility}</span>`);
      if (item.progress) {
        const wip = item.progress === 'in-progress';
        tags.push(`<span class="tag-progress"><span class="progress-dot ${wip ? 'dot-inprogress' : 'dot-done'}"></span>${wip ? 'in progress' : 'done'}</span>`);
      }
    }
    if (!isNote && item.linkedNoteId) {
      const note = findNoteById(item.linkedNoteId);
      if (note) tags.push(`<button class="tag-note-link" onclick="openNoteFromTag(event,'${item.linkedNoteId}')">📝 ${note.name}</button>`);
    }
    const tagHtml = tags.length ? `<div class="tag-row">${tags.join('')}</div>` : '';

    /* reorder buttons */
    const canUp   = idx > 0;
    const canDown = idx < items.length - 1;
    const reorderHtml = `
      <div class="card-reorder">
        ${canUp   ? `<button class="card-btn" title="move left"  onclick="moveCardUp('${sectionId}','${item.id}')">←</button>` : ''}
        ${canDown ? `<button class="card-btn" title="move right" onclick="moveCardDown('${sectionId}','${item.id}')">→</button>` : ''}
      </div>`;

    card.innerHTML = `
      <div class="card-actions">
        <button class="card-btn" title="edit"   onclick="openEditCard('${sectionId}','${item.id}')">✎</button>
        <button class="card-btn" title="delete" onclick="deleteCard('${sectionId}','${item.id}')">×</button>
      </div>
      <div class="card-icon ${item.color}">${item.icon || FALLBACK_ICONS[item.color] || '🔗'}</div>
      <div class="card-name">${item.name}</div>
      ${item.desc ? `<div class="card-desc">${item.desc}</div>` : ''}
      ${isNote ? `<div class="card-note-hint">tap to open</div>` : ''}
      ${!isNote && item.url ? `<div class="card-url">${item.url.replace(/^https?:\/\//, '')}</div>` : ''}
      ${tagHtml}
      ${reorderHtml}
    `;
    grid.appendChild(card);
  });
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
  document.getElementById('f-visibility-wrap').style.display = isProjects ? 'flex' : 'none';
  document.getElementById('f-progress-wrap').style.display   = isProjects ? 'flex' : 'none';
  document.getElementById('f-url-wrap').style.display        = isNotes    ? 'none' : 'flex';
  document.getElementById('f-note-wrap').style.display       = isNotes    ? 'none' : 'flex';
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
  if (!confirm('Delete this card?')) return;
  await dbDeleteCard(cardId);
  state.cards[sectionId] = (state.cards[sectionId] || []).filter(c => c.id !== cardId);
  renderGrid(sectionId);
}

/* ═══════════════════════════════════════════════════════════
   NOTE EDITOR MODAL
   ═══════════════════════════════════════════════════════════ */
function openNoteModal(sectionId, noteId) {
  const note = (state.cards[sectionId] || []).find(c => c.id === noteId);
  if (!note) return;
  activeNoteSection = sectionId;
  editingNoteId     = noteId;
  document.getElementById('modal-note-title').textContent = note.name || 'note';
  document.getElementById('fn-name').value    = note.name    || '';
  document.getElementById('fn-content').value = note.content || '';
  document.getElementById('fn-color').value   = note.color   || 'ic-teal';
  document.getElementById('fn-icon').value    = note.icon    || '';
  document.getElementById('modal-note').classList.add('open');
  setTimeout(() => document.getElementById('fn-content').focus(), 50);
}

function closeNoteModal() {
  document.getElementById('modal-note').classList.remove('open');
  editingNoteId = null;
}

async function saveNote() {
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
  closeNoteModal();
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
   GLOBAL EVENTS
   ═══════════════════════════════════════════════════════════ */
['modal-card','modal-note','modal-section','modal-settings'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener('click', e => {
    if (e.target === el) { closeCardModal(); closeNoteModal(); closeSectionModal(); closeSettings(); }
  });
});


document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeCardModal(); closeNoteModal(); closeSectionModal(); closeSettings(); }
});

document.getElementById('l-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

/* ─── init ────────────────────────────────────────────────── */
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

boot();
