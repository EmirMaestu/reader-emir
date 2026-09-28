// Sincronización con Google Drive (carpeta oculta appDataFolder).
// - mergeLibrary: fusión pura de la biblioteca local y la remota.
// - Auth: token OAuth con Google Identity Services (sin servidor).
// - Drive: llamadas REST mínimas. Se puede reemplazar HojaSync.drive en pruebas.
(function (root) {
  'use strict';

  const newer = (a, b) => (a || 0) > (b || 0);

  // local/remote: { books: { [id]: { id, title, author, added, spineCount, prog?, marks?, marksAt?, deleted? } } }
  function mergeLibrary(local, remote) {
    const L = (local && local.books) || {}, R = (remote && remote.books) || {};
    const books = {}, progFromRemote = [], marksFromRemote = [];
    let changedRemote = false;
    for (const id of new Set([...Object.keys(L), ...Object.keys(R)])) {
      const l = L[id], r = R[id];
      if (!r) { books[id] = Object.assign({}, l); changedRemote = true; continue; }
      if (!l) {
        books[id] = Object.assign({}, r);
        if (!r.deleted && r.prog) progFromRemote.push(id);
        if (!r.deleted && r.marks) marksFromRemote.push(id);
        continue;
      }
      const b = Object.assign({}, r, l);
      const deleted = Math.max(l.deleted || 0, r.deleted || 0);
      if (deleted) b.deleted = deleted; else delete b.deleted;
      if (newer(l.deleted, r.deleted)) changedRemote = true;

      const lp = l.prog && l.prog.at, rp = r.prog && r.prog.at;
      if (newer(rp, lp)) { b.prog = r.prog; if (!deleted) progFromRemote.push(id); }
      else { b.prog = l.prog; if (newer(lp, rp)) changedRemote = true; }
      if (!b.prog) delete b.prog;

      if (newer(r.marksAt, l.marksAt)) { b.marks = r.marks; b.marksAt = r.marksAt; if (!deleted) marksFromRemote.push(id); }
      else if (newer(l.marksAt, r.marksAt)) changedRemote = true;
      if (!b.marks) { delete b.marks; delete b.marksAt; }
      books[id] = b;
    }
    return { lib: { books }, progFromRemote, marksFromRemote, changedRemote };
  }

  // ── Auth (Google Identity Services, token client) ──
  const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  const TOKEN_KEY = 'hoja:gtoken', CONNECTED_KEY = 'hoja:gconnected';
  const store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } };

  class AuthError extends Error {}

  const Auth = {
    clientId() { return (root.HOJA_CONFIG && root.HOJA_CONFIG.googleClientId) || ''; },
    configured() { return !!this.clientId(); },
    connected() { return !!store(CONNECTED_KEY); },
    token() { const t = store(TOKEN_KEY); return t && t.exp > Date.now() + 60000 ? t.token : null; },
    _gis: null,
    // Carga el script de Google con anticipación: requestAccessToken debe llamarse
    // dentro del gesto del usuario, sin esperas asíncronas de por medio.
    preload() {
      if (this._gis || !this.configured()) return this._gis;
      this._gis = new Promise((res, rej) => {
        if (root.google && root.google.accounts && root.google.accounts.oauth2) return res();
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
        s.onload = () => res(); s.onerror = () => { this._gis = null; rej(new Error('No se pudo cargar Google')); };
        document.head.appendChild(s);
      });
      return this._gis;
    },
    ready() { return !!(root.google && root.google.accounts && root.google.accounts.oauth2); },
    // prompt '' = sin pantalla de consentimiento si ya se dio antes.
    request(prompt) {
      return new Promise((res, rej) => {
        if (!this.ready()) return rej(new Error('Google aún no cargó, intenta de nuevo'));
        const client = root.google.accounts.oauth2.initTokenClient({
          client_id: this.clientId(), scope: SCOPE,
          callback: (r) => {
            if (r.error) return rej(new Error(r.error_description || r.error));
            store(TOKEN_KEY, { token: r.access_token, exp: Date.now() + (r.expires_in || 3600) * 1000 });
            store(CONNECTED_KEY, true);
            res(r.access_token);
          },
          error_callback: (e) => rej(new Error((e && e.message) || 'Inicio de sesión cancelado')),
        });
        client.requestAccessToken({ prompt });
      });
    },
    connect() { return this.request(this.connected() ? '' : 'consent'); },
    expire() { store(TOKEN_KEY, null); },
    disconnect() {
      const t = this.token();
      if (t && this.ready()) root.google.accounts.oauth2.revoke(t, () => {});
      store(TOKEN_KEY, null); store(CONNECTED_KEY, null);
    },
  };

  // ── Drive REST ──
  const API = 'https://www.googleapis.com/drive/v3/files', UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
  async function call(url, opts = {}) {
    const token = Auth.token(); if (!token) throw new AuthError('Sin sesión');
    const r = await fetch(url, Object.assign({}, opts, { headers: Object.assign({ Authorization: 'Bearer ' + token }, opts.headers || {}) }));
    if (r.status === 401) { Auth.expire(); throw new AuthError('Sesión vencida'); }
    if (!r.ok && !(opts.method === 'DELETE' && r.status === 404)) throw new Error('Drive ' + r.status + ': ' + (await r.text()).slice(0, 200));
    return r;
  }

  const Drive = {
    async list() {
      const files = []; let page = '';
      do {
        const q = new URLSearchParams({ spaces: 'appDataFolder', pageSize: '1000', fields: 'nextPageToken,files(id,name)' });
        if (page) q.set('pageToken', page);
        const j = await (await call(API + '?' + q)).json();
        files.push(...j.files); page = j.nextPageToken;
      } while (page);
      return files;
    },
    async getText(id) { return (await call(API + '/' + id + '?alt=media')).text(); },
    async getBlob(id) { return (await call(API + '/' + id + '?alt=media')).blob(); },
    async upload(name, blob, id) {
      if (id) return (await call(UPLOAD + '/' + id + '?uploadType=media', { method: 'PATCH', body: blob })).json();
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify({ name, parents: ['appDataFolder'] })], { type: 'application/json' }));
      form.append('file', blob);
      return (await call(UPLOAD + '?uploadType=multipart&fields=id,name', { method: 'POST', body: form })).json();
    },
    async remove(id) { await call(API + '/' + id, { method: 'DELETE' }); },
  };

  const HojaSync = { mergeLibrary, Auth, AuthError, drive: Drive };
  if (typeof module !== 'undefined' && module.exports) module.exports = HojaSync;
  else root.HojaSync = HojaSync;
})(typeof window !== 'undefined' ? window : globalThis);
