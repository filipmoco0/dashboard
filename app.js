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
  updateGoogleDriveStatus();
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
      card.onclick = e => { if (!e.target.closest('.card-actions') && !e.target.closest('.card-reorder') && !e.target.closest('.card-link-actions')) openCardUrl(item.url); };
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

    const safeUrl = escapeAttr(item.url || '');

    card.innerHTML = `
      <div class="card-actions">
        <button class="card-btn" title="edit" onclick="event.stopPropagation(); openEditCard('${sectionId}','${item.id}')">✎</button>
        <button class="card-btn" title="delete" onclick="event.stopPropagation(); deleteCard('${sectionId}','${item.id}')">×</button>
      </div>
      <div class="card-icon ${item.color}">${item.icon || FALLBACK_ICONS[item.color] || '🔗'}</div>
      <div class="card-name">${escapeAttr(item.name)}</div>
      ${item.desc ? `<div class="card-desc">${escapeAttr(item.desc)}</div>` : ''}
      ${isNote ? `<div class="card-note-hint">tap to open</div>` : ''}
      ${!isNote && item.url ? `
        <div class="card-url">${escapeAttr(item.url.replace(/^https?:\/\//, ''))}</div>
        <div class="card-link-actions">
          <button class="card-link-btn" type="button" onclick="event.stopPropagation(); openCardUrl('${safeUrl}')">↗ open</button>
          <button class="card-link-btn" type="button" onclick="event.stopPropagation(); copyCardUrl('${safeUrl}')">⧉ copy</button>
          <button class="card-link-btn" type="button" onclick="event.stopPropagation(); downloadCardUrl('${safeUrl}')">↓ download</button>
        </div>
      ` : ''}
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
['modal-card','modal-drive-upload','modal-note','modal-section','modal-settings'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener('click', e => {
    if (e.target === el) { closeCardModal(); closeDriveUploadModal(); closeNoteModal(); closeSectionModal(); closeSettings(); }
  });
});


document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeCardModal(); closeDriveUploadModal(); closeNoteModal(); closeSectionModal(); closeSettings(); }
});

document.getElementById('l-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});



/* ═══════════════════════════════════════════════════════════
   GOOGLE DRIVE UPLOAD
   ═══════════════════════════════════════════════════════════ */
let googleDriveTokenClient = null;
let googleDriveAccessToken = null;
let googleDriveTokenExpiresAt = 0;

function currentSectionAllowsUpload() {
  const section = state.sections.find(s => s.id === state.activeSection);
  return section && section.type !== 'notes';
}











function setDriveUploadStatus(message, isError = false) {
  const el = document.getElementById('drive-upload-status');
  if (!el) return;
  el.textContent = message || '';
  el.className = 'upload-status' + (isError ? ' error' : '');
}

function getDriveToken(forceConsent = false) {
  return new Promise((resolve, reject) => {
    if (googleDriveAccessToken && Date.now() < googleDriveTokenExpiresAt - 60000 && !forceConsent) {
      resolve(googleDriveAccessToken);
      return;
    }

    if (!window.GOOGLE_CLIENT_ID) {
      reject(new Error('Missing GOOGLE_CLIENT_ID in config.js'));
      return;
    }

    if (!window.google || !google.accounts || !google.accounts.oauth2) {
      reject(new Error('Google login library is not loaded yet. Refresh and try again.'));
      return;
    }

    googleDriveTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: window.GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: response => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }

        googleDriveAccessToken = response.access_token;
        googleDriveTokenExpiresAt = Date.now() + ((response.expires_in || 3600) * 1000);
        localStorage.setItem('googleDriveConnectedOnce', 'true');
        updateGoogleDriveStatus();
        resolve(googleDriveAccessToken);
      },
    });

    const hasConnectedBefore = localStorage.getItem('googleDriveConnectedOnce') === 'true';
    googleDriveTokenClient.requestAccessToken({
      prompt: forceConsent || !hasConnectedBefore ? 'consent select_account' : '',
    });
  });
}

async function uploadFileToGoogleDrive(file, token) {
  const metadata = { name: file.name, mimeType: file.type || 'application/octet-stream' };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      googleDriveAccessToken = null;
      googleDriveTokenExpiresAt = 0;
      updateGoogleDriveStatus();
      throw new Error('Google Drive permission expired. Click upload again and reconnect.');
    }
    throw new Error(data?.error?.message || 'Google Drive upload failed.');
  }

  // Try to make the file viewable by link, so cards open/download from any browser.
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });
  } catch (e) {
    console.warn('Could not set link permission:', e);
  }

  return data;
}

function iconForFile(file) {
  const name = (file.name || '').toLowerCase();
  const type = file.type || '';
  if (type.includes('image') || /\.(png|jpg|jpeg|gif|webp|svg)$/.test(name)) return '🖼️';
  if (type.includes('pdf') || name.endsWith('.pdf')) return '📄';
  if (/\.(doc|docx)$/.test(name)) return '📝';
  if (/\.(ppt|pptx)$/.test(name)) return '📊';
  if (/\.(xls|xlsx|csv)$/.test(name)) return '📈';
  if (/\.(zip|rar|7z)$/.test(name)) return '🗜️';
  return '📎';
}

async function uploadSelectedFileToDrive() {
  const fileInput = document.getElementById('drive-file');
  const uploadBtn = document.getElementById('drive-upload-btn');
  const file = fileInput?.files?.[0];

  if (!file) {
    setDriveUploadStatus('Choose a file first.', true);
    return;
  }
  if (!currentSectionAllowsUpload()) {
    setDriveUploadStatus('Switch to a normal/cards section first.', true);
    return;
  }

  try {
    uploadBtn.disabled = true;
    setDriveUploadStatus('Connecting to Google Drive...');
    const token = await getDriveToken(false);

    setDriveUploadStatus('Uploading to Google Drive...');
    const uploaded = await uploadFileToGoogleDrive(file, token);

    setDriveUploadStatus('Saving card in dashboard...');
    const title = document.getElementById('drive-title').value.trim() || uploaded.name || file.name;
    const desc = document.getElementById('drive-desc').value.trim() || `${Math.ceil(file.size / 1024)} KB · Google Drive`;
    const pos = (state.cards[state.activeSection] || []).length;
    const section = state.sections.find(s => s.id === state.activeSection);
    const fields = {
      name: title,
      desc,
      url: uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`,
      icon: iconForFile(file),
      color: 'ic-blue',
      visibility: section?.type === 'projects' ? 'personal' : null,
      progress: section?.type === 'projects' ? 'in-progress' : null,
      linkedNoteId: null,
      content: '',
    };

    const row = await dbInsertCard(state.user.id, state.activeSection, fields, pos);
    if (!state.cards[state.activeSection]) state.cards[state.activeSection] = [];
    state.cards[state.activeSection].push(mapCard(row));

    renderGrid(state.activeSection);
    closeDriveUploadModal();
  } catch (err) {
    console.error(err);
    setDriveUploadStatus(err.message || 'Upload failed.', true);
  } finally {
    uploadBtn.disabled = false;
    updateGoogleDriveStatus();
  }
}

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


/* GOOGLE DRIVE CLEAN PATCH START */
const DriveUpload = {
  accessToken: null,
  expiresAt: 0
};

function getGoogleClientId() {
  return window.GOOGLE_CLIENT_ID || (typeof GOOGLE_CLIENT_ID !== 'undefined' ? GOOGLE_CLIENT_ID : '');
}

function driveIsConnected() {
  return !!DriveUpload.accessToken && Date.now() < DriveUpload.expiresAt - 60000;
}

function driveStatusLabel() {
  return driveIsConnected() ? 'connected' : 'not connected';
}

function updateDriveStatusUi() {
  const el = document.getElementById('drive-settings-status');
  if (el) el.textContent = driveStatusLabel();
}

function requestDriveToken(forceConsent = false) {
  return new Promise((resolve, reject) => {
    const clientId = getGoogleClientId();
    if (!clientId) {
      reject(new Error('Missing GOOGLE_CLIENT_ID in config.js'));
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google script not loaded. Refresh the page and try again.'));
      return;
    }

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      prompt: forceConsent ? 'consent select_account' : '',
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }

        DriveUpload.accessToken = response.access_token;
        DriveUpload.expiresAt = Date.now() + ((response.expires_in || 3600) * 1000);
        localStorage.setItem('driveConnectedOnce', 'true');
        updateDriveStatusUi();
        resolve(response.access_token);
      }
    });

    tokenClient.requestAccessToken();
  });
}

async function getDriveToken() {
  if (driveIsConnected()) return DriveUpload.accessToken;
  return requestDriveToken(localStorage.getItem('driveConnectedOnce') !== 'true');
}

async function connectDrive() {
  try {
    await requestDriveToken(true);
    alert('Google Drive connected.');
  } catch (error) {
    console.error(error);
    alert(error.message || 'Could not connect Google Drive.');
  }
}

function disconnectDrive() {
  if (DriveUpload.accessToken && window.google?.accounts?.oauth2?.revoke) {
    google.accounts.oauth2.revoke(DriveUpload.accessToken, () => {});
  }
  DriveUpload.accessToken = null;
  DriveUpload.expiresAt = 0;
  localStorage.removeItem('driveConnectedOnce');
  updateDriveStatusUi();
  alert('Google Drive disconnected on this browser.');
}

function ensureDriveModal() {
  if (document.getElementById('drive-upload-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'drive-upload-modal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h2>upload to Google Drive</h2>
        <button class="modal-close" type="button" onclick="closeDriveModal()">×</button>
      </div>

      <div class="form-group">
        <label>file</label>
        <input id="drive-file-input" type="file">
      </div>

      <div class="form-group">
        <label>title</label>
        <input id="drive-title-input" type="text" placeholder="auto from filename">
      </div>

      <div class="form-group">
        <label>description</label>
        <textarea id="drive-desc-input" placeholder="optional"></textarea>
      </div>

      <div id="drive-upload-message" class="drive-upload-message"></div>

      <div class="modal-actions">
        <button class="btn-secondary" type="button" onclick="closeDriveModal()">cancel</button>
        <button class="btn-primary" type="button" onclick="uploadSelectedFileToDrive()">upload</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeDriveModal();
  });

  document.getElementById('drive-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const title = document.getElementById('drive-title-input');
    if (file && !title.value.trim()) title.value = file.name;
  });
}

function openDriveModal() {
  const section = state.sections.find(s => s.id === state.activeSection);
  if (!section || section.type === 'notes') {
    alert('Open a normal section or projects section first.');
    return;
  }

  ensureDriveModal();
  document.getElementById('drive-file-input').value = '';
  document.getElementById('drive-title-input').value = '';
  document.getElementById('drive-desc-input').value = '';
  document.getElementById('drive-upload-message').textContent = '';
  document.getElementById('drive-upload-modal').classList.add('open');
}

function closeDriveModal() {
  const modal = document.getElementById('drive-upload-modal');
  if (modal) modal.classList.remove('open');
}

function fileIcon(name) {
  const n = (name || '').toLowerCase();
  if (n.endsWith('.pdf')) return '📄';
  if (n.endsWith('.doc') || n.endsWith('.docx')) return '📝';
  if (n.endsWith('.ppt') || n.endsWith('.pptx')) return '📊';
  if (n.endsWith('.xls') || n.endsWith('.xlsx')) return '📈';
  if (n.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) return '🖼️';
  if (n.match(/\.(zip|rar|7z)$/)) return '🗜️';
  return '📎';
}

async function uploadDriveFile(file) {
  const token = await getDriveToken();

  const metadata = {
    name: file.name,
    mimeType: file.type || 'application/octet-stream'
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      DriveUpload.accessToken = null;
      DriveUpload.expiresAt = 0;
      updateDriveStatusUi();
    }
    throw new Error(result?.error?.message || 'Google Drive upload failed.');
  }

  // make file accessible by link
  await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone' })
  }).catch(console.warn);

  return {
    id: result.id,
    name: result.name || file.name,
    url: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`
  };
}

async function uploadSelectedFileToDrive() {
  const msg = document.getElementById('drive-upload-message');
  const file = document.getElementById('drive-file-input').files[0];
  const title = document.getElementById('drive-title-input').value.trim();
  const desc = document.getElementById('drive-desc-input').value.trim();

  if (!file) {
    alert('Choose a file first.');
    return;
  }

  try {
    msg.textContent = 'Uploading to Google Drive...';
    const uploaded = await uploadDriveFile(file);

    msg.textContent = 'Saving dashboard card...';
    const section = state.sections.find(s => s.id === state.activeSection);
    const fields = {
      name: title || uploaded.name,
      desc,
      url: uploaded.url,
      icon: fileIcon(uploaded.name),
      color: 'ic-blue',
      visibility: section.type === 'projects' ? 'personal' : null,
      progress: section.type === 'projects' ? 'in-progress' : null,
      linkedNoteId: null,
      content: ''
    };

    const pos = (state.cards[state.activeSection] || []).length;
    const row = await dbInsertCard(state.user.id, state.activeSection, fields, pos);
    if (!state.cards[state.activeSection]) state.cards[state.activeSection] = [];
    state.cards[state.activeSection].push(mapCard(row));

    renderGrid(state.activeSection);
    closeDriveModal();
  } catch (error) {
    console.error(error);
    msg.textContent = error.message || 'Upload failed.';
    alert(error.message || 'Upload failed.');
  }
}

function addSingleDriveUploadButton() {
  // Remove duplicates from old patches.
  document.querySelectorAll('#btn-drive-upload, .drive-upload-main-btn, .js-drive-upload-button').forEach(el => el.remove());

  const addBtn = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.trim() === '+ add');
  if (!addBtn) return;

  const btn = document.createElement('button');
  btn.id = 'drive-upload-button';
  btn.className = addBtn.className || 'btn-secondary';
  btn.type = 'button';
  btn.textContent = '↑ upload';
  btn.onclick = openDriveModal;

  addBtn.parentElement.insertBefore(btn, addBtn);
}

function addDriveSettingsPanel() {
  const modal = document.getElementById('modal-settings');
  if (!modal) return;

  const box = modal.querySelector('.modal-box, .modal-content') || modal;
  if (!box || document.getElementById('drive-settings-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'drive-settings-panel';
  panel.className = 'drive-settings-panel';
  panel.innerHTML = `
    <h3>Google Drive</h3>
    <p>Status: <strong id="drive-settings-status">not connected</strong></p>
    <div class="drive-settings-buttons">
      <button class="btn-secondary" type="button" onclick="connectDrive()">connect / reconnect</button>
      <button class="btn-secondary" type="button" onclick="disconnectDrive()">disconnect</button>
    </div>
    <p class="drive-settings-note">On another PC/browser, connect once again.</p>
  `;

  const resetRow = Array.from(box.querySelectorAll('*')).find(el => (el.textContent || '').includes('reset everything'));
  if (resetRow && resetRow.parentElement) {
    resetRow.parentElement.insertAdjacentElement('afterend', panel);
  } else {
    const actions = box.querySelector('.modal-actions');
    if (actions) box.insertBefore(panel, actions);
    else box.appendChild(panel);
  }

  updateDriveStatusUi();
}

// Wrap existing functions after they are defined.
const originalRenderMainForDrive = renderMain;
renderMain = function() {
  originalRenderMainForDrive();
  setTimeout(addSingleDriveUploadButton, 0);
};

const originalOpenSettingsForDrive = openSettings;
openSettings = function() {
  originalOpenSettingsForDrive();
  setTimeout(addDriveSettingsPanel, 0);
};

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    ensureDriveModal();
    addSingleDriveUploadButton();
  }, 300);
});
/* GOOGLE DRIVE CLEAN PATCH END */


boot();
