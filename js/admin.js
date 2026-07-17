/* ================================================================
   PANEL ADMIN — logika CMS undangan Andre & Sarah
   ----------------------------------------------------------------
   Zero-dependency. Berbicara ke cloud lewat window.CloudAPI (js/api.js).
   Bila Supabase belum dikonfigurasi, panel tetap tampil (tanpa crash)
   dan mengarahkan user untuk mengisi js/supabase-config.js.

   Prinsip anti-kehilangan data: config disimpan sebagai objek utuh.
   Saat menyimpan, kita CLONE config dasar (baseConfig) lalu hanya
   menimpa field yang ada di form — field tak dikenal tetap terjaga.
   ================================================================ */
(function () {
  'use strict';

  var API = window.CloudAPI;
  var DEFAULTS = (window.WEDDING_CONFIG && typeof window.WEDDING_CONFIG === 'object')
    ? window.WEDDING_CONFIG : {};
  var PREVIEW_KEY = 'wedding_preview_draft';

  /* baseConfig = sumber kebenaran objek penuh; dipertahankan agar field
     yang tak ada di form tidak hilang saat menyimpan. */
  var baseConfig = null;

  /* ================== Helpers ================== */
  function $(id) { return document.getElementById(id); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function deepClone(o) {
    try { return JSON.parse(JSON.stringify(o)); } catch (e) { return {}; }
  }
  function isObj(o) { return o && typeof o === 'object' && !Array.isArray(o); }

  function setPath(obj, path, value) {
    var keys = path.split('.');
    var cur = obj;
    for (var i = 0; i < keys.length - 1; i++) {
      if (!isObj(cur[keys[i]])) cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
  }
  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) {
      return (o === null || o === undefined) ? undefined : o[k];
    }, obj);
  }

  /* ================== Status bar (aria-live) ================== */
  var statusBar = $('statusBar');
  var statusText = $('statusText');
  var statusTimer = null;
  function showStatus(msg, kind) {
    if (!statusBar || !statusText) return;
    statusText.textContent = msg;
    statusBar.hidden = false;
    statusBar.className = 'statusbar' + (kind ? ' statusbar--' + kind : '');
    if (statusTimer) window.clearTimeout(statusTimer);
    if (kind === 'ok') {
      statusTimer = window.setTimeout(function () { statusBar.hidden = true; }, 4000);
    }
  }
  if ($('statusClose')) {
    $('statusClose').addEventListener('click', function () { statusBar.hidden = true; });
  }

  /* ================================================================
     VIEW TOGGLING (login <-> app)
     ================================================================ */
  var loginView = $('loginView');
  var appView = $('appView');

  function showApp() {
    loginView.hidden = true;
    appView.hidden = false;
    var s = API.getSession();
    var email = s && s.user && s.user.email;
    if (email && $('userBadge')) $('userBadge').textContent = 'Masuk sebagai ' + email;
    /* Tombol "Masuk" kini tersembunyi; pindahkan fokus ke konten utama agar
       fokus tidak jatuh ke <body> dan navigasi keyboard tetap berlanjut. */
    var main = $('mainContent');
    if (main && typeof main.focus === 'function') {
      main.setAttribute('tabindex', '-1');
      try { main.focus({ preventScroll: true }); } catch (e) { main.focus(); }
    }
  }
  function showLogin() {
    appView.hidden = true;
    loginView.hidden = false;
  }

  /* ================================================================
     LOGIN
     ================================================================ */
  var loginForm = $('loginForm');
  var loginError = $('loginError');
  var loginSubmit = $('loginSubmit');
  var setupNotice = $('setupNotice');

  var configured = false;
  try { configured = !!(API && API.isConfigured && API.isConfigured()); } catch (e) { configured = false; }

  if (!configured) {
    if (setupNotice) setupNotice.hidden = false;
    if (loginSubmit) loginSubmit.disabled = true;
    $$('#loginForm input').forEach(function (el) { el.disabled = true; });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!configured) return;
      loginError.hidden = true;
      var email = $('loginEmail').value.trim();
      var pass = $('loginPassword').value;
      if (!email || !pass) {
        loginError.textContent = 'Email dan kata sandi wajib diisi.';
        loginError.hidden = false;
        return;
      }
      loginSubmit.disabled = true;
      loginSubmit.textContent = 'Memproses…';
      API.login(email, pass).then(function (r) {
        loginSubmit.disabled = false;
        loginSubmit.textContent = 'Masuk';
        if (r && r.ok) {
          $('loginPassword').value = '';
          showApp();
          bootEditor();
        } else {
          var msg = (r && r.error) || 'login-failed';
          if (/invalid|credential|grant|400/i.test(String(msg))) {
            msg = 'Email atau kata sandi salah.';
          } else if (msg === 'cloud-off') {
            msg = 'Cloud belum dikonfigurasi.';
          }
          loginError.textContent = 'Gagal masuk: ' + msg;
          loginError.hidden = false;
        }
      });
    });
  }

  /* ================================================================
     LOGOUT
     ================================================================ */
  if ($('logoutBtn')) {
    $('logoutBtn').addEventListener('click', function () {
      API.logout().then(function () {
        baseConfig = null;
        showLogin();
        showStatus('Anda telah keluar.', 'ok');
      });
    });
  }

  /* ================================================================
     TABS
     ================================================================ */
  var editorTab = $('editorTab');
  var rsvpTab = $('rsvpTab');
  var tabEditorBtn = $('tabEditorBtn');
  var tabRsvpBtn = $('tabRsvpBtn');
  var rsvpLoadedOnce = false;

  function selectTab(which) {
    var editor = which === 'editor';
    editorTab.hidden = !editor;
    rsvpTab.hidden = editor;
    tabEditorBtn.classList.toggle('is-active', editor);
    tabRsvpBtn.classList.toggle('is-active', !editor);
    tabEditorBtn.setAttribute('aria-selected', editor ? 'true' : 'false');
    tabRsvpBtn.setAttribute('aria-selected', editor ? 'false' : 'true');
    /* Pindahkan fokus ke panel aktif (panel punya tabindex=-1) agar pengguna
       keyboard/screen reader tidak kehilangan konteks saat berganti tab. */
    var panel = editor ? editorTab : rsvpTab;
    if (panel && typeof panel.focus === 'function') {
      try { panel.focus({ preventScroll: true }); } catch (e) { panel.focus(); }
    }
    if (!editor && !rsvpLoadedOnce) { rsvpLoadedOnce = true; loadRsvp(); }
  }
  if (tabEditorBtn) tabEditorBtn.addEventListener('click', function () { selectTab('editor'); });
  if (tabRsvpBtn) tabRsvpBtn.addEventListener('click', function () { selectTab('rsvp'); });

  /* ================================================================
     EDITOR — muat config & isi form
     ================================================================ */
  var sourceBadge = $('sourceBadge');

  function bootEditor() {
    if (sourceBadge) { sourceBadge.textContent = 'Memuat…'; sourceBadge.removeAttribute('data-src'); }
    /* Kembalikan Promise<source> agar pemanggil (mis. tombol Muat ulang) bisa
       menampilkan status berdasarkan HASIL nyata, bukan timer buta. */
    return API.getInvitationConfig().then(function (data) {
      var source;
      if (data && isObj(data)) {
        baseConfig = deepClone(data);
        source = 'cloud';
      } else {
        /* Cloud kosong/{} → mulai dari config.js bawaan. */
        baseConfig = deepClone(DEFAULTS);
        source = 'default';
      }
      setSource(source);
      fillForm(baseConfig);
      return source;
    });
  }

  function setSource(src) {
    if (!sourceBadge) return;
    if (src === 'cloud') {
      sourceBadge.textContent = 'Sumber: Cloud';
      sourceBadge.setAttribute('data-src', 'cloud');
    } else {
      sourceBadge.textContent = 'Sumber: Bawaan (config.js)';
      sourceBadge.setAttribute('data-src', 'default');
    }
  }

  /* ---- isi field skalar ---- */
  function fillForm(cfg) {
    $$('[data-path]').forEach(function (el) {
      var v = getPath(cfg, el.getAttribute('data-path'));
      el.value = (v === undefined || v === null) ? '' : String(v);
    });
    /* date.iso -> datetime-local */
    var dIso = $('dIso');
    if (dIso) {
      var iso = getPath(cfg, 'date.iso');
      dIso.value = isoToLocalInput(iso);
    }
    /* arrays */
    renderEvents(Array.isArray(cfg.events) ? cfg.events : []);
    renderAccounts(Array.isArray(cfg.accounts) ? cfg.accounts : []);
    renderWishes(Array.isArray(cfg.seedWishes) ? cfg.seedWishes : []);
  }

  /* iso '2026-12-12T08:00:00+07:00' -> 'YYYY-MM-DDTHH:MM' (nilai lokal WIB) */
  function isoToLocalInput(iso) {
    if (!iso) return '';
    var m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(String(iso));
    return m ? (m[1] + 'T' + m[2]) : '';
  }
  /* ISO ber-offset (mis. '2026-12-12T08:00:00+07:00') -> UTC compact
     'YYYYMMDDTHHMMSSZ' agar bisa dibandingkan dengan calendar.startUTC. */
  function isoToUtcCompact(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) +
      'T' + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + 'Z';
  }
  /* 'YYYY-MM-DDTHH:MM' -> iso ber-offset WIB (+07:00) */
  function localInputToIso(val) {
    if (!val) return '';
    var v = String(val);
    /* datetime-local bisa 16 (menit) atau 19 (detik) char */
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return v + ':00+07:00';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(v)) return v + '+07:00';
    return v;
  }

  /* ================================================================
     REPEATERS (events / accounts / wishes)
     ================================================================ */
  var uidSeq = 0;
  /* Asosiasikan tiap <label> baris repeater dengan input-nya (WCAG 1.3.1/3.3.2).
     Template menulis label+input sebagai sibling tanpa for/id; saat di-clone
     kita bangkitkan id unik per baris lalu set label[for]. Menjaga struktur
     markup & CSS tetap utuh. */
  function associateLabels(root) {
    $$('.field', root).forEach(function (field) {
      var label = field.querySelector('label');
      var ctrl = field.querySelector('input, select, textarea');
      if (label && ctrl && !label.getAttribute('for')) {
        var gid = 'rf-' + (++uidSeq);
        ctrl.id = gid;
        label.setAttribute('for', gid);
      }
    });
  }
  function cloneTpl(id) {
    var tpl = $(id);
    var node = tpl.content.firstElementChild.cloneNode(true);
    associateLabels(node);
    return node;
  }
  function rowField(row, name) {
    return row.querySelector('[data-field="' + name + '"]');
  }
  function fieldVal(row, name) {
    var el = rowField(row, name);
    return el ? el.value.trim() : '';
  }
  function wireDelete(row, listEl, label) {
    var btn = row.querySelector('[data-del]');
    if (btn) btn.addEventListener('click', function () {
      row.parentNode.removeChild(row);
      reindex(listEl, label);
    });
  }
  function reindex(listEl, label) {
    var rows = $$('.repeater__row', listEl);
    rows.forEach(function (r, i) {
      var idx = r.querySelector('.repeater__idx');
      if (idx) idx.textContent = label + ' ' + (i + 1);
    });
    var empty = listEl.querySelector('.repeater__empty');
    if (rows.length && empty) empty.parentNode.removeChild(empty);
    if (!rows.length && !empty) {
      var p = document.createElement('p');
      p.className = 'repeater__empty';
      p.textContent = 'Belum ada baris. Klik tombol tambah di bawah.';
      listEl.appendChild(p);
    }
  }

  /* ---- EVENTS ---- */
  var eventsList = $('eventsList');
  function addEventRow(item) {
    item = item || {};
    var row = cloneTpl('tplEvent');
    if (rowField(row, 'name')) rowField(row, 'name').value = item.name || '';
    if (rowField(row, 'time')) rowField(row, 'time').value = item.time || '';
    if (rowField(row, 'dresscode')) rowField(row, 'dresscode').value = item.dresscode || '';
    eventsList.appendChild(row);
    wireDelete(row, eventsList, 'Acara');
    reindex(eventsList, 'Acara');
  }
  function renderEvents(arr) {
    eventsList.textContent = '';
    arr.forEach(addEventRow);
    reindex(eventsList, 'Acara');
  }
  function collectEvents() {
    var base = Array.isArray(baseConfig.events) ? baseConfig.events : [];
    return $$('[data-row="event"]', eventsList).map(function (row, i) {
      var item = deepClone(base[i] || {}); /* jaga field tak dikenal (index-merge) */
      item.name = fieldVal(row, 'name');
      item.time = fieldVal(row, 'time');
      var dc = fieldVal(row, 'dresscode');
      if (dc) item.dresscode = dc; else delete item.dresscode;
      return item;
    });
  }
  if ($('addEventBtn')) $('addEventBtn').addEventListener('click', function () { addEventRow({}); });

  /* ---- ACCOUNTS ---- */
  var accountsList = $('accountsList');
  function addAccountRow(item) {
    item = item || {};
    var row = cloneTpl('tplAccount');
    ['bank', 'number', 'display', 'holder'].forEach(function (k) {
      if (rowField(row, k)) rowField(row, k).value = item[k] || '';
    });
    accountsList.appendChild(row);
    wireDelete(row, accountsList, 'Rekening');
    reindex(accountsList, 'Rekening');
  }
  function renderAccounts(arr) {
    accountsList.textContent = '';
    arr.forEach(addAccountRow);
    reindex(accountsList, 'Rekening');
  }
  function collectAccounts() {
    var base = Array.isArray(baseConfig.accounts) ? baseConfig.accounts : [];
    return $$('[data-row="account"]', accountsList).map(function (row, i) {
      var item = deepClone(base[i] || {});
      item.bank = fieldVal(row, 'bank');
      item.number = fieldVal(row, 'number');
      item.display = fieldVal(row, 'display');
      item.holder = fieldVal(row, 'holder');
      return item;
    });
  }
  if ($('addAccountBtn')) $('addAccountBtn').addEventListener('click', function () { addAccountRow({}); });

  /* ---- SEED WISHES ---- */
  var wishesList = $('wishesList');
  function addWishRow(item) {
    item = item || {};
    var row = cloneTpl('tplWish');
    if (rowField(row, 'name')) rowField(row, 'name').value = item.name || '';
    if (rowField(row, 'attendance')) rowField(row, 'attendance').value = item.attendance || '';
    if (rowField(row, 'guests')) rowField(row, 'guests').value = (item.guests !== undefined && item.guests !== null) ? item.guests : '';
    if (rowField(row, 'message')) rowField(row, 'message').value = item.message || '';
    if (rowField(row, 'hoursAgo')) rowField(row, 'hoursAgo').value = (item.hoursAgo !== undefined && item.hoursAgo !== null) ? item.hoursAgo : '';
    wishesList.appendChild(row);
    wireDelete(row, wishesList, 'Ucapan');
    reindex(wishesList, 'Ucapan');
  }
  function renderWishes(arr) {
    wishesList.textContent = '';
    arr.forEach(addWishRow);
    reindex(wishesList, 'Ucapan');
  }
  function clampInt(v, min, max, dflt) {
    var n = parseInt(v, 10);
    if (isNaN(n)) n = dflt;
    if (n < min) n = min;
    if (max !== null && n > max) n = max;
    return n;
  }
  function collectWishes() {
    return $$('[data-row="wish"]', wishesList).map(function (row) {
      return {
        name: fieldVal(row, 'name'),
        attendance: fieldVal(row, 'attendance'),
        guests: clampInt(fieldVal(row, 'guests'), 0, 20, 1),
        message: fieldVal(row, 'message'),
        hoursAgo: clampInt(fieldVal(row, 'hoursAgo'), 0, null, 0)
      };
    });
  }
  if ($('addWishBtn')) $('addWishBtn').addEventListener('click', function () { addWishRow({}); });

  /* ================================================================
     RAKIT CONFIG dari form (clone base + timpa field form)
     ================================================================ */
  function collectConfig() {
    var cfg = deepClone(baseConfig || DEFAULTS);
    $$('[data-path]').forEach(function (el) {
      setPath(cfg, el.getAttribute('data-path'), el.value.trim());
    });
    /* date.iso dari datetime-local (pertahankan offset WIB) */
    var dIso = $('dIso');
    if (dIso) {
      var iso = localInputToIso(dIso.value);
      if (iso) setPath(cfg, 'date.iso', iso);
    }
    cfg.events = collectEvents();
    cfg.accounts = collectAccounts();
    cfg.seedWishes = collectWishes();
    return cfg;
  }

  function validate(cfg) {
    var errs = [];
    if (!getPath(cfg, 'groom.name')) errs.push('Nama mempelai pria wajib diisi.');
    if (!getPath(cfg, 'bride.name')) errs.push('Nama mempelai wanita wajib diisi.');
    if (!getPath(cfg, 'date.iso')) errs.push('Target hitung mundur (tanggal & waktu) wajib diisi.');
    /* Tautan Maps dirender sebagai href ke SEMUA tamu — tolak skema berbahaya
       (javascript:, data:) yang bisa jadi stored-XSS bila akun admin disusupi. */
    var maps = getPath(cfg, 'venue.maps');
    if (maps && !/^(https?:|geo:)/i.test(String(maps).trim())) {
      errs.push('Tautan Google Maps harus diawali http:// atau https:// (atau geo:).');
    }
    var re = /^\d{8}T\d{6}Z$/;
    var st = getPath(cfg, 'calendar.startUTC');
    var en = getPath(cfg, 'calendar.endUTC');
    if (st && !re.test(st)) errs.push('Format "Mulai (UTC)" harus YYYYMMDDTHHMMSSZ.');
    if (en && !re.test(en)) errs.push('Format "Selesai (UTC)" harus YYYYMMDDTHHMMSSZ.');
    /* Validasi silang: countdown (date.iso) & tautan kalender (startUTC) adalah
       momen acara yang SAMA. Cegah admin mengubah tanggal countdown lalu lupa
       memperbarui startUTC (WIB->UTC) sehingga tamu memasukkan waktu yang salah. */
    var isoVal = getPath(cfg, 'date.iso');
    if (isoVal && st && re.test(st)) {
      var expected = isoToUtcCompact(isoVal);
      if (expected && expected !== st) {
        errs.push('Waktu "Mulai (UTC)" (' + st + ') tidak sesuai dengan Target hitung mundur. ' +
          'Seharusnya ' + expected + ' (hasil konversi WIB->UTC). Perbarui field "Mulai (UTC)" ' +
          'agar tombol "Simpan ke Kalender" menunjuk waktu yang sama dengan hitung mundur.');
      }
    }
    return errs;
  }

  /* ================================================================
     SIMPAN
     ================================================================ */
  var saving = false;
  function doSave() {
    if (saving) return;
    if (!baseConfig) { showStatus('Config belum termuat. Coba muat ulang.', 'error'); return; }
    var cfg = collectConfig();
    var errs = validate(cfg);
    if (errs.length) { showStatus(errs[0], 'error'); return; }

    saving = true;
    setSaveBtns(true, 'Menyimpan…');
    showStatus('Menyimpan ke cloud…', null);
    API.saveInvitationConfig(cfg).then(function (r) {
      saving = false;
      setSaveBtns(false, 'Simpan ke Cloud');
      if (r && r.ok) {
        baseConfig = deepClone(cfg); /* jadikan basis baru */
        setSource('cloud');
        showStatus('Berhasil disimpan ke cloud.', 'ok');
      } else {
        var msg = (r && r.error) || 'save-failed';
        if (msg === 'not-authenticated') {
          showStatus('Sesi berakhir. Silakan masuk kembali.', 'error');
          window.setTimeout(function () { showLogin(); }, 1500);
        } else {
          showStatus('Gagal menyimpan: ' + msg + (r && r.status ? ' (HTTP ' + r.status + ')' : ''), 'error');
        }
      }
    });
  }
  function setSaveBtns(disabled, label) {
    [$('saveBtn'), $('saveBtn2')].forEach(function (b) {
      if (!b) return;
      b.disabled = disabled;
      b.textContent = label;
    });
  }
  if ($('saveBtn')) $('saveBtn').addEventListener('click', doSave);
  if ($('saveBtn2')) $('saveBtn2').addEventListener('click', doSave);

  /* ================================================================
     PRATINJAU — simpan draft & buka index.html?preview=1
     ================================================================ */
  function doPreview() {
    if (!baseConfig) { showStatus('Config belum termuat.', 'error'); return; }
    var cfg = collectConfig();
    try {
      window.localStorage.setItem(PREVIEW_KEY, JSON.stringify(cfg));
    } catch (e) {
      showStatus('Gagal menyimpan draft pratinjau (localStorage penuh?).', 'error');
      return;
    }
    window.open('index.html?preview=1', '_blank', 'noopener');
    showStatus('Pratinjau dibuka di tab baru. Draft belum tersimpan ke cloud.', 'ok');
  }
  if ($('previewBtn')) $('previewBtn').addEventListener('click', doPreview);
  if ($('previewBtn2')) $('previewBtn2').addEventListener('click', doPreview);

  /* ---- Muat ulang dari cloud ---- */
  if ($('reloadBtn')) $('reloadBtn').addEventListener('click', function () {
    showStatus('Memuat ulang…', null);
    bootEditor().then(function (source) {
      if (source === 'cloud') {
        showStatus('Config dimuat ulang dari cloud.', 'ok');
      } else {
        /* Pembacaan cloud kosong ATAU gagal → panel memakai data bawaan.
           Beri tahu pengguna secara eksplisit agar tidak menimpa cloud tanpa sadar. */
        showStatus('Menampilkan data BAWAAN (config.js). Cloud kosong atau tidak dapat dibaca — periksa koneksi/konfigurasi sebelum menyimpan.', 'error');
      }
    });
  });

  /* ================================================================
     RSVP — daftar kehadiran
     ================================================================ */
  var rsvpBody = $('rsvpBody');
  var rsvpTable = $('rsvpTable');
  var rsvpEmpty = $('rsvpEmpty');
  var rsvpLoading = $('rsvpLoading');
  var rsvpSummary = $('rsvpSummary');
  var currentRows = [];

  function fmtDate(v) {
    if (!v) return '—';
    var d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    try {
      return d.toLocaleString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (e) { return d.toISOString(); }
  }

  function loadRsvp() {
    rsvpLoading.hidden = false;
    rsvpTable.hidden = true;
    rsvpEmpty.hidden = true;
    rsvpSummary.hidden = true;
    API.listRsvp().then(function (r) {
      rsvpLoading.hidden = true;
      if (!r || !r.ok) {
        var msg = (r && r.error) || 'list-failed';
        if (msg === 'not-authenticated') {
          showStatus('Sesi berakhir. Silakan masuk kembali.', 'error');
          window.setTimeout(function () { showLogin(); }, 1500);
          return;
        }
        currentRows = [];
        rsvpEmpty.hidden = false;
        rsvpEmpty.textContent = 'Gagal memuat data kehadiran: ' + msg + '.';
        return;
      }
      currentRows = Array.isArray(r.rows) ? r.rows : [];
      renderRsvp(currentRows);
    });
  }

  function renderRsvp(rows) {
    rsvpBody.textContent = '';
    if (!rows.length) {
      rsvpEmpty.hidden = false;
      rsvpEmpty.textContent = 'Belum ada data kehadiran.';
      rsvpTable.hidden = true;
      rsvpSummary.hidden = true;
      return;
    }
    var attendCount = 0, guestSum = 0;
    var frag = document.createDocumentFragment();
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      var attend = String(row.attendance || '').trim();
      var isHadir = attend.toLowerCase() === 'hadir';
      var guests = parseInt(row.guests, 10);
      if (isNaN(guests)) guests = 0;
      if (isHadir) { attendCount++; guestSum += guests; }

      tr.appendChild(td(row.name || '—', 'cell-name'));
      tr.appendChild(pillCell(attend));
      tr.appendChild(td(String(isNaN(parseInt(row.guests, 10)) ? '—' : guests), 'cell-guests'));
      tr.appendChild(td(row.message || '', 'cell-msg'));
      tr.appendChild(td(fmtDate(row.created_at), 'cell-time'));
      frag.appendChild(tr);
    });
    rsvpBody.appendChild(frag);
    rsvpTable.hidden = false;
    rsvpEmpty.hidden = true;

    $('sumEntries').textContent = String(rows.length);
    $('sumAttend').textContent = String(attendCount);
    $('sumGuests').textContent = String(guestSum);
    rsvpSummary.hidden = false;
  }

  function td(text, cls) {
    var el = document.createElement('td');
    if (cls) el.className = cls;
    el.textContent = String(text); /* anti-XSS: selalu textContent */
    return el;
  }
  function pillCell(attend) {
    var el = document.createElement('td');
    if (attend) {
      var span = document.createElement('span');
      span.className = 'pill';
      span.textContent = attend;
      el.appendChild(span);
    } else {
      el.textContent = '—';
    }
    return el;
  }

  if ($('rsvpReloadBtn')) $('rsvpReloadBtn').addEventListener('click', loadRsvp);

  /* ---- Unduh CSV ---- */
  function csvEscape(v) {
    var s = (v === undefined || v === null) ? '' : String(v);
    /* Anti CSV/formula injection: nilai RSVP dikendalikan tamu anonim.
       Bila sel diawali pemicu formula (= + - @ TAB CR), beri prefiks
       tanda kutip tunggal agar Excel/Sheets memperlakukannya sebagai teks,
       BUKAN rumus (mis. =HYPERLINK/=WEBSERVICE yang mengeksfiltrasi data). */
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function downloadCsv() {
    if (!currentRows.length) { showStatus('Tidak ada data untuk diunduh.', 'error'); return; }
    var header = ['Nama', 'Kehadiran', 'Jumlah', 'Pesan', 'Waktu'];
    var lines = [header.map(csvEscape).join(',')];
    currentRows.forEach(function (row) {
      lines.push([
        csvEscape(row.name),
        csvEscape(row.attendance),
        csvEscape(row.guests),
        csvEscape(row.message),
        csvEscape(row.created_at)
      ].join(','));
    });
    /* BOM agar Excel membaca UTF-8 dengan benar */
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'rsvp-andre-sarah-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    showStatus('CSV diunduh (' + currentRows.length + ' baris).', 'ok');
  }
  if ($('rsvpCsvBtn')) $('rsvpCsvBtn').addEventListener('click', downloadCsv);

  /* ================================================================
     BOOT — cek sesi tersimpan
     ================================================================ */
  (function init() {
    if (!API) {
      if (setupNotice) setupNotice.hidden = false;
      return;
    }
    if (configured && API.isLoggedIn && API.isLoggedIn()) {
      showApp();
      bootEditor();
    } else {
      showLogin();
    }
  })();

})();
