/* ================================================================
   window.CloudAPI — lapisan cloud serverless untuk undangan.
   ----------------------------------------------------------------
   Zero-dependency: memakai fetch() bawaan browser, TANPA SDK
   @supabase/supabase-js. Berbicara langsung ke REST & Auth API
   Supabase via anon key + (opsional) access_token admin.

   PRINSIP PALING PENTING:
   Modul ini TIDAK BOLEH pernah membuat undangan blank. Semua jalur
   baca (getInvitationConfig) menangkap error dan mengembalikan null
   dengan aman sehingga pemanggil bisa fallback ke window.WEDDING_CONFIG.

   Dimuat via <script src="js/supabase-config.js"> lalu
   <script src="js/api.js"> SEBELUM js/main.js.
   ================================================================ */
(function () {
  'use strict';

  /* ---------- Konfigurasi & deteksi "belum dikonfigurasi" ---------- */
  var CFG = (window.SUPABASE && typeof window.SUPABASE === 'object') ? window.SUPABASE : {};
  var URL_BASE = String(CFG.url || '').replace(/\/+$/, ''); /* buang trailing slash */
  var ANON = String(CFG.anonKey || '');

  /* Kunci penyimpanan sesi admin. localStorage agar sesi bertahan
     antar-tab & reload; berisi token — jangan tampilkan ke publik. */
  var SESSION_KEY = 'wedding_admin_session';

  function isConfigured() {
    if (!URL_BASE || !ANON) return false;
    /* Placeholder bawaan -> anggap cloud OFF, jangan sentuh jaringan. */
    if (URL_BASE.indexOf('XXXX') !== -1) return false;
    if (ANON.indexOf('PLACEHOLDER') !== -1) return false;
    return true;
  }

  /* ---------- Util fetch dengan timeout (tanpa melempar liar) ---------- */
  function timeoutSignal(ms) {
    /* AbortController tersedia di semua browser modern; bila tidak,
       kembalikan undefined agar fetch tetap jalan tanpa timeout. */
    try {
      if (typeof AbortController === 'undefined') return { signal: undefined, cancel: function () {} };
      var ctrl = new AbortController();
      var id = window.setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, ms);
      return { signal: ctrl.signal, cancel: function () { window.clearTimeout(id); } };
    } catch (e) {
      return { signal: undefined, cancel: function () {} };
    }
  }

  /* fetch JSON: mengembalikan Promise<{ ok, status, data }>. Tidak
     pernah reject karena jaringan/timeout — error dinormalisasi jadi
     { ok:false }. Pemanggil memutuskan fallback. */
  function request(path, opts) {
    opts = opts || {};
    if (!isConfigured()) {
      return Promise.resolve({ ok: false, status: 0, data: null, offline: true });
    }
    var to = timeoutSignal(opts.timeout || 12000);
    var init = {
      method: opts.method || 'GET',
      headers: opts.headers || {},
      signal: to.signal
    };
    if (opts.body !== undefined) init.body = JSON.stringify(opts.body);

    return fetch(URL_BASE + path, init).then(function (res) {
      to.cancel();
      var ctype = res.headers.get('content-type') || '';
      var parse = ctype.indexOf('application/json') !== -1
        ? res.json().catch(function () { return null; })
        : res.text().catch(function () { return null; });
      return parse.then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      });
    }, function (err) {
      to.cancel();
      return { ok: false, status: 0, data: null, error: err };
    });
  }

  /* ---------- Header builder ---------- */
  function restHeaders(token, extra) {
    var h = {
      'apikey': ANON,
      'Authorization': 'Bearer ' + (token || ANON)
    };
    if (extra) for (var k in extra) if (extra.hasOwnProperty(k)) h[k] = extra[k];
    return h;
  }
  function authHeaders(extra) {
    var h = { 'apikey': ANON, 'Content-Type': 'application/json' };
    if (extra) for (var k in extra) if (extra.hasOwnProperty(k)) h[k] = extra[k];
    return h;
  }

  /* ================================================================
     SESI ADMIN — disimpan di localStorage dengan hati-hati.
     Bentuk: { access_token, refresh_token, expires_at (ms epoch), user }
     ================================================================ */
  function getSession() {
    try {
      var raw = window.localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || typeof s !== 'object' || !s.access_token) return null;
      return s;
    } catch (e) {
      return null;
    }
  }

  function setSession(s) {
    try {
      if (!s || !s.access_token) return false;
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearSession() {
    try { window.localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  function isLoggedIn() {
    return !!getSession();
  }

  /* Ubah respons token Supabase menjadi bentuk sesi internal. */
  function toSession(tokenResp) {
    if (!tokenResp || !tokenResp.access_token) return null;
    var expiresInSec = Number(tokenResp.expires_in) || 3600;
    return {
      access_token: tokenResp.access_token,
      refresh_token: tokenResp.refresh_token || '',
      /* refresh 60 detik sebelum benar-benar kadaluarsa */
      expires_at: Date.now() + (expiresInSec * 1000),
      user: tokenResp.user || null
    };
  }

  /* ================================================================
     AUTH — login / logout / refresh
     ================================================================ */
  function login(email, password) {
    if (!isConfigured()) {
      return Promise.resolve({ ok: false, error: 'cloud-off' });
    }
    return request('/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: authHeaders(),
      body: { email: email, password: password }
    }).then(function (r) {
      if (r.ok && r.data && r.data.access_token) {
        var sess = toSession(r.data);
        setSession(sess);
        return { ok: true, session: sess };
      }
      var msg = (r.data && (r.data.error_description || r.data.msg || r.data.error)) || 'login-failed';
      return { ok: false, error: msg, status: r.status };
    });
  }

  function logout() {
    var s = getSession();
    /* Bersihkan sesi lokal apa pun hasil panggilan server. */
    if (!s || !isConfigured()) {
      clearSession();
      return Promise.resolve({ ok: true });
    }
    return request('/auth/v1/logout', {
      method: 'POST',
      headers: restHeaders(s.access_token, { 'Content-Type': 'application/json' })
    }).then(function () {
      clearSession();
      return { ok: true };
    }, function () {
      clearSession();
      return { ok: true };
    });
  }

  /* Tukar refresh_token dengan access_token baru. */
  function refreshSession() {
    var s = getSession();
    if (!s || !s.refresh_token || !isConfigured()) {
      return Promise.resolve({ ok: false, error: 'no-refresh' });
    }
    return request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: authHeaders(),
      body: { refresh_token: s.refresh_token }
    }).then(function (r) {
      if (r.ok && r.data && r.data.access_token) {
        var sess = toSession(r.data);
        setSession(sess);
        return { ok: true, session: sess };
      }
      /* Refresh gagal -> sesi tidak valid lagi. */
      clearSession();
      return { ok: false, error: 'refresh-failed' };
    });
  }

  /* Pastikan token masih segar; refresh otomatis bila hampir/sudah
     kadaluarsa. Mengembalikan Promise<access_token|null>. */
  function ensureFreshToken() {
    var s = getSession();
    if (!s) return Promise.resolve(null);
    var SKEW = 60 * 1000; /* refresh 60 dtk sebelum kadaluarsa */
    if (typeof s.expires_at === 'number' && Date.now() < (s.expires_at - SKEW)) {
      return Promise.resolve(s.access_token);
    }
    return refreshSession().then(function (r) {
      return (r.ok && r.session) ? r.session.access_token : null;
    });
  }

  /* ================================================================
     DATA — invitation config
     ================================================================ */
  /* Baca isi undangan dari cloud. SELALU mengembalikan objek data
     atau null (bila OFF / gagal / kosong). TIDAK PERNAH melempar. */
  function getInvitationConfig() {
    if (!isConfigured()) return Promise.resolve(null);
    return request('/rest/v1/invitation?id=eq.1&select=data', {
      method: 'GET',
      headers: restHeaders(null) /* baca publik: pakai anon */
    }).then(function (r) {
      try {
        if (!r.ok || !Array.isArray(r.data) || !r.data.length) return null;
        var data = r.data[0] && r.data[0].data;
        if (!data || typeof data !== 'object') return null;
        /* data '{}' (belum diisi) -> anggap kosong, biar fallback. */
        for (var k in data) { if (data.hasOwnProperty(k)) return data; }
        return null;
      } catch (e) {
        return null;
      }
    }, function () {
      return null;
    });
  }

  /* Simpan isi undangan (perlu sesi admin). PATCH baris singleton. */
  function saveInvitationConfig(dataObj) {
    if (!isConfigured()) return Promise.resolve({ ok: false, error: 'cloud-off' });
    if (!dataObj || typeof dataObj !== 'object') {
      return Promise.resolve({ ok: false, error: 'invalid-data' });
    }
    return ensureFreshToken().then(function (token) {
      if (!token) return { ok: false, error: 'not-authenticated' };
      return request('/rest/v1/invitation?id=eq.1', {
        method: 'PATCH',
        headers: restHeaders(token, {
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        }),
        body: { data: dataObj, updated_at: new Date().toISOString() }
      }).then(function (r) {
        if (r.ok) return { ok: true };
        return { ok: false, error: 'save-failed', status: r.status, detail: r.data };
      });
    });
  }

  /* ================================================================
     DATA — rsvp
     ================================================================ */
  /* Kirim RSVP sebagai tamu (anon). entry = { name, attendance,
     guests, message }. Mengembalikan { ok } tanpa melempar. */
  function submitRsvp(entry) {
    if (!isConfigured()) return Promise.resolve({ ok: false, error: 'cloud-off' });
    entry = entry || {};
    var payload = {
      name: String(entry.name || '').slice(0, 80),
      attendance: entry.attendance ? String(entry.attendance).slice(0, 40) : null,
      guests: (function () {
        var g = parseInt(entry.guests, 10);
        if (isNaN(g)) g = 1;
        if (g < 0) g = 0;
        if (g > 20) g = 20;
        return g;
      })(),
      message: entry.message ? String(entry.message).slice(0, 1000) : null
    };
    if (!payload.name) return Promise.resolve({ ok: false, error: 'name-required' });
    return request('/rest/v1/rsvp', {
      method: 'POST',
      headers: restHeaders(null, { /* anon boleh insert */
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }),
      body: payload
    }).then(function (r) {
      if (r.ok) return { ok: true };
      return { ok: false, error: 'submit-failed', status: r.status, detail: r.data };
    });
  }

  /* Daftar RSVP (perlu sesi admin). Mengembalikan { ok, rows }. */
  function listRsvp() {
    if (!isConfigured()) return Promise.resolve({ ok: false, error: 'cloud-off', rows: [] });
    return ensureFreshToken().then(function (token) {
      if (!token) return { ok: false, error: 'not-authenticated', rows: [] };
      return request('/rest/v1/rsvp?select=*&order=created_at.desc', {
        method: 'GET',
        headers: restHeaders(token)
      }).then(function (r) {
        if (r.ok && Array.isArray(r.data)) return { ok: true, rows: r.data };
        return { ok: false, error: 'list-failed', status: r.status, rows: [] };
      });
    });
  }

  /* ---------- Ekspor publik ---------- */
  window.CloudAPI = {
    isConfigured: isConfigured,
    getInvitationConfig: getInvitationConfig,
    saveInvitationConfig: saveInvitationConfig,
    submitRsvp: submitRsvp,
    listRsvp: listRsvp,
    login: login,
    logout: logout,
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession,
    isLoggedIn: isLoggedIn,
    ensureFreshToken: ensureFreshToken
  };
})();
