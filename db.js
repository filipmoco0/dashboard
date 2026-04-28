/* ═══════════════════════════════════════════════════════════
   db.js — Supabase database layer
   All data operations go through here.
   app.js never touches Supabase directly.
   ═══════════════════════════════════════════════════════════ */

/* ─── init client ─────────────────────────────────────────── */
let _sb = null;

function getClient() {
  if (!_sb) {
    _sb = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON
    );
  }
  return _sb;
}

/* ═══════════════════════════════════════════════════════════
   AUTH
   ═══════════════════════════════════════════════════════════ */
async function dbSignIn(email, password) {
  const { data, error } = await getClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

async function dbSignOut() {
  await getClient().auth.signOut();
}

async function dbGetSession() {
  const { data } = await getClient().auth.getSession();
  return data.session;
}

/* ═══════════════════════════════════════════════════════════
   SETTINGS
   Table: settings  (id uuid PK, user_id uuid, site_name text, tagline text)
   ═══════════════════════════════════════════════════════════ */
async function dbGetSettings(userId) {
  const { data, error } = await getClient()
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function dbUpsertSettings(userId, siteName, tagline) {
  const { error } = await getClient()
    .from('settings')
    .upsert({ user_id: userId, site_name: siteName, tagline }, { onConflict: 'user_id' });
  if (error) throw error;
}

/* ═══════════════════════════════════════════════════════════
   SECTIONS
   Table: sections  (id uuid PK, user_id uuid, label text, type text, position int)
   ═══════════════════════════════════════════════════════════ */
async function dbGetSections(userId) {
  const { data, error } = await getClient()
    .from('sections')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function dbInsertSection(userId, label, type, position) {
  const { data, error } = await getClient()
    .from('sections')
    .insert({ user_id: userId, label, type, position })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function dbDeleteSection(sectionId) {
  const { error } = await getClient()
    .from('sections')
    .delete()
    .eq('id', sectionId);
  if (error) throw error;
}

/* ═══════════════════════════════════════════════════════════
   CARDS
   Table: cards  (
     id uuid PK, section_id uuid FK, user_id uuid,
     name text, desc text, url text, icon text, color text,
     visibility text, progress text,
     linked_note_id uuid nullable,
     content text,           -- notes only
     position int
   )
   ═══════════════════════════════════════════════════════════ */
async function dbGetCards(sectionId) {
  const { data, error } = await getClient()
    .from('cards')
    .select('*')
    .eq('section_id', sectionId)
    .order('position', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function dbInsertCard(userId, sectionId, card, position) {
  const { data, error } = await getClient()
    .from('cards')
    .insert({
      user_id:        userId,
      section_id:     sectionId,
      name:           card.name,
      description:    card.desc,
      url:            card.url || '',
      icon:           card.icon || '',
      color:          card.color,
      visibility:     card.visibility || null,
      progress:       card.progress   || null,
      linked_note_id: card.linkedNoteId || null,
      content:        card.content || '',
      position,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function dbUpdateCard(cardId, fields) {
  const mapped = {
    name:           fields.name,
    description:    fields.desc,
    url:            fields.url || '',
    icon:           fields.icon || '',
    color:          fields.color,
    visibility:     fields.visibility     || null,
    progress:       fields.progress       || null,
    linked_note_id: fields.linkedNoteId   || null,
    content:        fields.content        || '',
  };
  const { error } = await getClient()
    .from('cards')
    .update(mapped)
    .eq('id', cardId);
  if (error) throw error;
}

async function dbDeleteCard(cardId) {
  const { error } = await getClient()
    .from('cards')
    .delete()
    .eq('id', cardId);
  if (error) throw error;
}

/* ═══════════════════════════════════════════════════════════
   POSITION UPDATES (for reordering)
   ═══════════════════════════════════════════════════════════ */
async function dbUpdateSectionPosition(sectionId, position) {
  const { error } = await getClient()
    .from('sections')
    .update({ position })
    .eq('id', sectionId);
  if (error) throw error;
}

async function dbUpdateCardPosition(cardId, position) {
  const { error } = await getClient()
    .from('cards')
    .update({ position })
    .eq('id', cardId);
  if (error) throw error;
}


/* ═══════════════════════════════════════════════════════════
   SUPABASE STORAGE
   Bucket: dashboard-files
   ═══════════════════════════════════════════════════════════ */
const DASHBOARD_FILES_BUCKET = 'dashboard-files';

function safeStorageName(name) {
  return String(name || 'file')
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
}

async function dbUploadDashboardFile(userId, file) {
  const path = `${userId}/${Date.now()}-${safeStorageName(file.name)}`;
  const { error } = await getClient()
    .storage
    .from(DASHBOARD_FILES_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
  if (error) throw error;
  return { bucket: DASHBOARD_FILES_BUCKET, path };
}

async function dbCreateFileSignedUrl(path, downloadName = false) {
  const options = downloadName ? { download: typeof downloadName === 'string' ? downloadName : true } : undefined;
  const { data, error } = await getClient()
    .storage
    .from(DASHBOARD_FILES_BUCKET)
    .createSignedUrl(path, 60 * 60, options);
  if (error) throw error;
  return data.signedUrl;
}

async function dbDeleteDashboardFile(path) {
  const { error } = await getClient()
    .storage
    .from(DASHBOARD_FILES_BUCKET)
    .remove([path]);
  if (error) throw error;
}

