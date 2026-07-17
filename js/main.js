(function () {
  'use strict';

  /* ================================================================
     SUMBER DATA — preseden: preview draft -> cloud -> config.js
     ----------------------------------------------------------------
     CONFIG ditentukan secara async (menunggu cloud bila ON) SEBELUM
     seluruh setup render dijalankan. Saat cloud OFF (default), resolusi
     selesai seketika lewat microtask sehingga tidak ada regresi.
     js/config.js tetap SATU-SATUNYA sumber default & bentuk kanonik. */
  var CONFIG = null;          /* diisi oleh bootstrap sebelum runApp() */
  var PREVIEW_MODE = false;   /* true bila memakai draft ?preview=1 */

  /* ================== Helpers ================== */
  function $(id) { return document.getElementById(id); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) {
      return (o === null || o === undefined) ? undefined : o[k];
    }, obj);
  }

  var prefersReduced = false;
  try {
    prefersReduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) { prefersReduced = false; }

  /* Config dianggap layak-render bila struktur inti yang dibaca renderer
     TANPA penjagaan (venue/calendar/accounts/events/date) hadir. Bila
     tidak, jatuh aman ke window.WEDDING_CONFIG agar situs tetap tampil
     normal & renderer tidak melempar TypeError. */
  function isRenderable(c) {
    return !!(c && typeof c === 'object'
      && c.venue && typeof c.venue === 'object'
      && typeof c.venue.name === 'string'
      && typeof c.venue.address === 'string'
      && c.calendar && typeof c.calendar === 'object'
      && c.date && typeof c.date === 'object'
      && Array.isArray(c.accounts)
      && Array.isArray(c.events));
  }

  /* Hanya izinkan skema URL yang aman untuk href (cegah javascript:,
     data:, dsb.). Nilai maps bisa berasal dari cloud/admin (teks bebas). */
  function safeHref(url) {
    var s = String(url == null ? '' : url).trim();
    return /^(https?:|geo:|mailto:|tel:)/i.test(s) ? s : '';
  }

  /* Preseden sumber data (kontrak fase 1). Selalu resolve — tidak pernah
     reject — sehingga bootstrap tidak akan gagal karena jaringan. */
  function resolveConfig() {
    var fallback = window.WEDDING_CONFIG;
    /* 1. Preview draft admin (WYSIWYG dengan renderer undangan asli). */
    try {
      if (/[?&]preview=1(?:&|$)/.test(window.location.search)) {
        var raw = window.localStorage.getItem('wedding_preview_draft');
        if (raw) {
          var draft = JSON.parse(raw);
          if (isRenderable(draft)) {
            PREVIEW_MODE = true;
            return Promise.resolve(draft);
          }
        }
      }
    } catch (e) { /* draft rusak -> lanjut ke sumber berikutnya */ }
    /* 2. Cloud (hanya bila Supabase dikonfigurasi). */
    try {
      if (window.CloudAPI && CloudAPI.isConfigured()) {
        return CloudAPI.getInvitationConfig().then(function (data) {
          return isRenderable(data) ? data : fallback;
        }, function () { return fallback; });
      }
    } catch (e) { /* CloudAPI tak terduga -> fallback */ }
    /* 3. Fallback default dari js/config.js. */
    return Promise.resolve(fallback);
  }

  /* Penanda kecil non-intrusif saat mode preview admin. */
  function showPreviewBadge() {
    try {
      if (document.getElementById('previewBadge')) return;
      var b = document.createElement('div');
      b.id = 'previewBadge';
      b.textContent = 'MODE PREVIEW';
      b.setAttribute('role', 'status');
      b.style.cssText = [
        'position:fixed', 'left:12px', 'bottom:12px', 'z-index:2147483647',
        'padding:6px 12px', 'border-radius:999px',
        'font:600 11px/1 system-ui,-apple-system,\'Segoe UI\',sans-serif',
        'letter-spacing:0.08em', 'color:#0B1512', 'background:#C9A24B',
        'box-shadow:0 2px 10px rgba(0,0,0,0.35)', 'pointer-events:none',
        'opacity:0.92'
      ].join(';');
      document.body.appendChild(b);
    } catch (e) { /* abaikan */ }
  }

  /* ================================================================
     runApp — seluruh setup render. Dipanggil oleh bootstrap SETELAH
     CONFIG final ditentukan. Semua kode di bawah membaca `CONFIG`.
     ================================================================ */
  function runApp() {

  /* ================== Render dari CONFIG (data-bind) ================== */
  $$('[data-bind]').forEach(function (el) {
    var v = getPath(CONFIG, el.getAttribute('data-bind'));
    if (v !== undefined && v !== null) el.textContent = String(v);
  });
  (function () {
    var mapsHref = safeHref(CONFIG.venue && CONFIG.venue.maps);
    $$('.js-maps').forEach(function (a) {
      if (mapsHref) a.setAttribute('href', mapsHref);
      else a.removeAttribute('href');
    });
  })();
  (function buildCalendarLinks() {
    var c = CONFIG.calendar;
    var url = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      '&text=' + encodeURIComponent(c.title) +
      '&dates=' + c.startUTC + '/' + c.endUTC +
      '&details=' + encodeURIComponent(c.details) +
      '&location=' + encodeURIComponent(c.location);
    $$('.js-calendar').forEach(function (a) { a.setAttribute('href', url); });
  })();

  /* ================== GATE RILIS — placeholder tidak boleh bocor ke tamu ==================
     Selama data wajib masih berisi nilai contoh, elemen yang bisa menyesatkan
     tamu disembunyikan otomatis. Isi data asli di CONFIG untuk memunculkannya. */
  try { (function releaseGate() {
    var problems = [];

    /* 1. Nomor rekening/DANA placeholder → sembunyikan seluruh section Amplop
       Digital agar tombol "Salin Nomor" tidak menyalin nomor yang salah. */
    var PLACEHOLDER_NUMBERS = ['1234567890', '081234567890'];
    var accountsPlaceholder = (Array.isArray(CONFIG.accounts) ? CONFIG.accounts : []).some(function (a) {
      return a && PLACEHOLDER_NUMBERS.indexOf(String(a.number)) !== -1;
    });
    if (accountsPlaceholder) {
      var amplop = $('amplopSection');
      if (amplop) {
        amplop.style.display = 'none';
        amplop.setAttribute('aria-hidden', 'true');
      }
      problems.push('CONFIG.accounts masih PLACEHOLDER — section Amplop Digital disembunyikan. Isi nomor rekening & DANA asli untuk menampilkannya.');
    }

    /* 2. Venue placeholder → sembunyikan tombol "Petunjuk Lokasi" agar Google
       Maps tidak mencocokkan alamat fiktif ke entitas hotel yang salah.
       Leaf dijaga: data cloud bisa punya venue tanpa name/address (null). */
    var venueName = (CONFIG.venue && CONFIG.venue.name) || '';
    var venueAddr = (CONFIG.venue && CONFIG.venue.address) || '';
    var venuePlaceholder =
      String(venueName) === 'Ballroom Hotel Grand Asia' ||
      String(venueAddr).indexOf('Jl. Jend. Sudirman No. 123') !== -1;
    if (venuePlaceholder) {
      $$('.js-maps').forEach(function (a) { a.style.display = 'none'; });
      problems.push('CONFIG.venue masih PLACEHOLDER — tombol Petunjuk Lokasi disembunyikan. Verifikasi nama+alamat venue asli dan ganti CONFIG.venue.maps dengan share-link Google Maps dari pin lokasi pasti.');
    }

    if (problems.length && window.console && console.warn) {
      console.warn('[GATE RILIS] Data wajib diisi sebelum undangan disebar:\n- ' + problems.join('\n- '));
    }
  })(); } catch (e) {
    /* Gate rilis TIDAK boleh menghentikan runApp — bila satu error di sini
       lolos, section berikutnya (termasuk initReveal) harus tetap jalan
       agar konten tidak tersembunyi (opacity:0) alias undangan blank. */
    if (window.console && console.warn) console.warn('[GATE RILIS] dilewati karena error:', e);
  }

  /* ================== Nama tamu dari ?to= (anti-XSS via textContent) ================== */
  function getGuestName() {
    try {
      var fb = CONFIG.guestFallback || 'Tamu Undangan';
      var m = /[?&]to=([^&]*)/.exec(window.location.search);
      if (!m || !m[1]) return fb;
      var name = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim();
      return name || fb;
    } catch (e) {
      return (CONFIG && CONFIG.guestFallback) || 'Tamu Undangan';
    }
  }
  var guestName = getGuestName();
  $$('.js-guest').forEach(function (el) { el.textContent = guestName; });

  /* ================== Musik generatif (WebAudio API) ================== */
  var audio = { ctx: null, master: null, running: false, timer: null, nextTime: 0, step: 0, failed: false };
  var SCALE = [440.0, 493.88, 554.37, 659.25, 739.99]; /* A mayor pentatonik */
  var MELODY = [0, 2, 1, 4, 3, 2, 0, 1, 2, 4, 3, 1, 0, 2, 1, 3];
  var NOTE_GAP = 1.9;

  function playBell(freq, t) {
    try {
      var ctx = audio.ctx;
      var o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
      o.connect(g);
      g.connect(audio.master);
      o.start(t);
      o.stop(t + 3.6);

      var o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = freq / 2;
      var g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.linearRampToValueAtTime(0.06, t + 0.1);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 3.0);
      o2.connect(g2);
      g2.connect(audio.master);
      o2.start(t);
      o2.stop(t + 3.2);
    } catch (e) { /* aman diabaikan */ }
  }

  function initAudio() {
    if (audio.ctx) return true;
    if (audio.failed) return false;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { audio.failed = true; return false; }
      var ctx = new AC();
      var master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.055, ctx.currentTime + 2.5);
      master.connect(ctx.destination);

      /* Pad ambient: dua osilator rendah + lowpass + LFO pelan */
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 380;
      var padGain = ctx.createGain();
      padGain.gain.value = 0.35;
      lp.connect(padGain);
      padGain.connect(master);

      [110.0, 164.81].forEach(function (f, i) {
        var o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.detune.value = i === 0 ? -4 : 4;
        o.connect(lp);
        o.start();
      });

      var lfo = ctx.createOscillator();
      lfo.frequency.value = 0.08;
      var lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.12;
      lfo.connect(lfoGain);
      lfoGain.connect(padGain.gain);
      lfo.start();

      audio.ctx = ctx;
      audio.master = master;
      audio.nextTime = ctx.currentTime + 0.6;

      /* Scheduler nada bel lembut, lookahead 1 detik */
      audio.timer = window.setInterval(function () {
        if (!audio.ctx || audio.ctx.state !== 'running') return;
        var now = audio.ctx.currentTime;
        while (audio.nextTime < now + 1.0) {
          playBell(SCALE[MELODY[audio.step % MELODY.length]], audio.nextTime);
          audio.step += 1;
          audio.nextTime += NOTE_GAP;
        }
      }, 400);
      return true;
    } catch (e) {
      audio.failed = true;
      return false;
    }
  }

  var musicBtn = $('musicBtn');
  var musicEq = $('musicEq');
  function setMusicUI(on) {
    if (musicBtn) {
      musicBtn.classList.toggle('playing', on);
      musicBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      musicBtn.setAttribute('aria-label', on ? 'Jeda musik latar' : 'Putar musik latar');
    }
    if (musicEq) musicEq.classList.toggle('on', on);
  }
  function startMusic() {
    if (!initAudio()) return;
    var p = audio.ctx.resume();
    if (p && typeof p.catch === 'function') p.catch(function () {});
    audio.nextTime = Math.max(audio.nextTime, audio.ctx.currentTime + 0.2);
    audio.running = true;
    setMusicUI(true);
  }
  function stopMusic() {
    if (audio.ctx) {
      var p = audio.ctx.suspend();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    }
    audio.running = false;
    setMusicUI(false);
  }
  if (musicBtn) {
    musicBtn.addEventListener('click', function () {
      if (audio.running) stopMusic(); else startMusic();
    });
  }

  /* ================== Cover: sinkronisasi scroll dua panel ==================
     Kedua belahan pintu punya scroll container .cover-inner sendiri; tanpa
     sinkronisasi, scroll di satu belahan membuat teks cover "sobek" di garis
     tengah pada viewport pendek. Menyalin scrollTop ke belahan lain aman dari
     loop karena assignment scrollTop bernilai sama tidak memicu event scroll. */
  (function syncCoverScroll() {
    var inners = $$('#cover .cover-inner');
    if (inners.length < 2) return;
    function link(src, dst) {
      src.addEventListener('scroll', function () {
        var v = src.scrollTop;
        if (dst.scrollTop !== v) dst.scrollTop = v;
      }, { passive: true });
    }
    link(inners[0], inners[1]);
    link(inners[1], inners[0]);
  })();

  /* ================== Cover: buka undangan ================== */
  var cover = $('cover');
  var mainEl = $('utama');
  var opened = false;
  /* Selama cover terkunci, konten di baliknya di-inert-kan agar fokus keyboard
     tidak "hilang" ke elemen tertutup overlay & screen reader tidak membacanya.
     Diset via JS (bukan atribut statis) supaya halaman tetap utuh tanpa JS. */
  if (mainEl && cover) {
    try { mainEl.inert = true; } catch (e) { /* browser lama */ }
    mainEl.setAttribute('inert', '');
    mainEl.setAttribute('aria-hidden', 'true');
    mainEl.setAttribute('tabindex', '-1');
  }
  function openInvitation() {
    if (opened) return;
    opened = true;
    if (cover) cover.classList.add('is-open');
    if (mainEl) {
      try { mainEl.inert = false; } catch (e) { /* browser lama */ }
      mainEl.removeAttribute('inert');
      mainEl.removeAttribute('aria-hidden');
    }
    document.body.classList.remove('is-locked');
    document.body.classList.add('is-opened');
    window.scrollTo(0, 0);
    /* gesture pengguna = klik ini; hormati prefers-reduced-motion */
    if (!prefersReduced) startMusic();
    window.setTimeout(function () {
      if (cover) {
        cover.style.display = 'none';
        cover.setAttribute('aria-hidden', 'true');
      }
      /* Tombol yang tadi difokus kini display:none — pindahkan fokus ke konten */
      if (mainEl && typeof mainEl.focus === 'function') {
        try { mainEl.focus({ preventScroll: true }); } catch (e) { mainEl.focus(); }
      }
    }, prefersReduced ? 250 : 1000);
  }
  $$('.js-open').forEach(function (btn) { btn.addEventListener('click', openInvitation); });

  /* ================== Countdown (timezone-safe via ISO ber-offset) ================== */
  (function initCountdown() {
    var elD = $('cdDays'), elH = $('cdHours'), elM = $('cdMins'), elS = $('cdSecs');
    var wrap = $('countdownWrap');
    if (!elD || !elH || !elM || !elS || !wrap) return;
    var target = new Date(CONFIG.date.iso).getTime();
    if (isNaN(target)) return;

    function setNum(el, val) {
      var txt = String(val);
      if (el.textContent === txt) return;
      el.textContent = txt;
      if (prefersReduced) return;
      el.classList.remove('tick');
      void el.offsetWidth; /* restart animasi */
      el.classList.add('tick');
    }

    var timerId = null;
    function tick() {
      var diff = target - Date.now();
      if (diff <= 0) {
        wrap.classList.add('is-done');
        if (timerId !== null) window.clearInterval(timerId);
        return;
      }
      var s = Math.floor(diff / 1000);
      setNum(elD, Math.floor(s / 86400));
      setNum(elH, pad2(Math.floor(s / 3600) % 24));
      setNum(elM, pad2(Math.floor(s / 60) % 60));
      setNum(elS, pad2(s % 60));
    }
    tick();
    if (target - Date.now() > 0) timerId = window.setInterval(tick, 1000);
  })();

  /* ================== RSVP & Ucapan (localStorage + anti-XSS) ================== */
  function loadEntries() {
    try {
      var raw = window.localStorage.getItem(CONFIG.storageKey);
      if (!raw) return null;
      var arr = JSON.parse(raw);
      /* Saring elemen korup (null/non-objek) agar satu entri rusak
         tidak melempar TypeError dan mematikan inisialisasi lainnya */
      return Array.isArray(arr)
        ? arr.filter(function (e) { return e && typeof e === 'object'; })
        : null;
    } catch (e) { return null; }
  }
  function saveEntries(arr) {
    try { window.localStorage.setItem(CONFIG.storageKey, JSON.stringify(arr)); } catch (e) { /* mode privat */ }
  }
  function seedEntries() {
    var now = Date.now();
    return (Array.isArray(CONFIG.seedWishes) ? CONFIG.seedWishes : []).map(function (w) {
      return {
        name: w.name,
        attendance: w.attendance,
        guests: w.guests,
        message: w.message,
        ts: now - w.hoursAgo * 3600 * 1000
      };
    });
  }
  function relTime(ts) {
    var diff = Date.now() - ts;
    if (diff < 0) diff = 0;
    var m = Math.floor(diff / 60000);
    if (m < 1) return 'Baru saja';
    if (m < 60) return m + ' menit lalu';
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' jam lalu';
    var d = Math.floor(h / 24);
    if (d < 30) return d + ' hari lalu';
    try {
      return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return new Date(ts).toDateString();
    }
  }

  var wishEntries = loadEntries();
  if (!wishEntries || wishEntries.length === 0) {
    wishEntries = seedEntries();
    saveEntries(wishEntries);
  }

  var wishList = $('wishList');
  function renderWishes() {
    if (!wishList) return;
    wishList.textContent = '';
    var frag = document.createDocumentFragment();
    var list = wishEntries.slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }).slice(0, 60);
    list.forEach(function (en) {
      /* SEMUA teks dirender via textContent — aman dari XSS */
      var card = document.createElement('article');
      card.className = 'wish-card';

      var avatar = document.createElement('span');
      avatar.className = 'wish-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      var nm = String(en.name || '?').trim();
      avatar.textContent = nm ? nm.charAt(0).toUpperCase() : '?';

      var body = document.createElement('div');
      body.className = 'wish-body';

      var head = document.createElement('div');
      head.className = 'wish-head';
      var nameEl = document.createElement('span');
      nameEl.className = 'wish-name';
      nameEl.textContent = nm || 'Tamu';
      head.appendChild(nameEl);
      if (en.attendance) {
        var badge = document.createElement('span');
        badge.className = 'wish-badge';
        badge.textContent = String(en.attendance);
        head.appendChild(badge);
      }
      body.appendChild(head);

      if (en.message) {
        var msg = document.createElement('p');
        msg.className = 'wish-msg';
        msg.textContent = String(en.message);
        body.appendChild(msg);
      }

      var time = document.createElement('span');
      time.className = 'wish-time';
      time.textContent = relTime(Number(en.ts) || Date.now());
      body.appendChild(time);

      card.appendChild(avatar);
      card.appendChild(body);
      frag.appendChild(card);
    });
    wishList.appendChild(frag);
  }
  try { renderWishes(); } catch (e) { /* jangan hentikan inisialisasi lain */ }
  /* Segarkan label waktu relatif tiap menit */
  window.setInterval(function () {
    try { renderWishes(); } catch (e) { /* aman diabaikan */ }
  }, 60000);

  var rsvpForm = $('rsvpForm');
  var rsvpNote = $('rsvpNote');
  var rsvpNoteTimer = null;
  /* Konfirmasi via WhatsApp — aktif hanya bila CONFIG.rsvp.whatsapp diisi.
     Tanpa server, inilah jalur agar mempelai benar-benar menerima RSVP. */
  var waLink = $('rsvpWaLink');
  var waNumber = (CONFIG.rsvp && CONFIG.rsvp.whatsapp) ? String(CONFIG.rsvp.whatsapp).replace(/\D/g, '') : '';
  if (waNumber) {
    var rsvpHint = document.querySelector('.rsvp-hint');
    if (rsvpHint) {
      rsvpHint.textContent = 'Catatan: setelah menekan "Kirim Ucapan", gunakan tombol WhatsApp yang muncul untuk menyampaikan konfirmasi Anda langsung kepada kami.';
    }
  }
  if (rsvpForm) {
    rsvpForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var nameInput = $('fName');
      var attendInput = $('fAttend');
      var guestsInput = $('fGuests');
      var msgInput = $('fMessage');
      if (!nameInput) return;
      var name = nameInput.value.trim();
      if (!name) {
        nameInput.focus();
        return;
      }
      var entry = {
        name: name.slice(0, 60),
        attendance: attendInput ? attendInput.value : '',
        guests: guestsInput ? (parseInt(guestsInput.value, 10) || 1) : 1,
        message: msgInput ? msgInput.value.trim().slice(0, 500) : '',
        ts: Date.now()
      };
      wishEntries.push(entry);
      saveEntries(wishEntries);
      renderWishes();
      rsvpForm.reset();

      /* Kirim ke cloud bila ON — fire-and-forget, TIDAK memblokir UI.
         localStorage di atas tetap jadi cache/perekam lokal seperti dulu.
         Kegagalan ditangani diam-diam (sopan): data tamu sudah tersimpan
         lokal dan tombol WhatsApp tetap tersedia sebagai jalur cadangan. */
      try {
        if (window.CloudAPI && CloudAPI.isConfigured()) {
          CloudAPI.submitRsvp({
            name: entry.name,
            attendance: entry.attendance,
            guests: entry.guests,
            message: entry.message
          }).then(function (res) {
            if (!(res && res.ok) && window.console && console.info) {
              console.info('[RSVP] tersimpan lokal; sinkron cloud gagal, akan mengandalkan WhatsApp/cache.');
            }
          });
        }
      } catch (e) { /* jangan pernah menggagalkan submit lokal */ }

      if (waLink && waNumber) {
        var waText = 'Konfirmasi Kehadiran — ' + CONFIG.calendar.title +
          '\nNama: ' + entry.name +
          '\nKehadiran: ' + entry.attendance +
          '\nJumlah tamu: ' + entry.guests +
          (entry.message ? '\nUcapan: ' + entry.message : '');
        waLink.href = 'https://wa.me/' + waNumber + '?text=' + encodeURIComponent(waText);
        waLink.hidden = false;
      }
      if (rsvpNote) {
        rsvpNote.classList.add('show');
        if (rsvpNoteTimer !== null) window.clearTimeout(rsvpNoteTimer);
        rsvpNoteTimer = window.setTimeout(function () { rsvpNote.classList.remove('show'); }, 5000);
      }
    });
  }

  /* ================== Salin nomor rekening + toast ================== */
  var toastEl = $('toast');
  var toastTimer = null;
  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.remove('show');
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
    if (toastTimer !== null) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toastEl.classList.remove('show'); }, 2000);
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        function () { return true; },
        function () { return fallbackCopy(text); }
      );
    }
    return Promise.resolve(fallbackCopy(text));
  }

  $$('.copy-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var idx = parseInt(btn.getAttribute('data-copy-index'), 10);
      var acc = CONFIG.accounts[idx];
      if (!acc) return;
      copyText(acc.number).then(function (ok) {
        if (ok) {
          showToast('Nomor ' + acc.bank + ' tersalin');
          btn.classList.add('copied');
          window.setTimeout(function () { btn.classList.remove('copied'); }, 1800);
        } else {
          showToast('Gagal menyalin — salin manual: ' + acc.display);
        }
      });
    });
  });

  /* ================== Reveal on scroll (IntersectionObserver + fallback) ================== */
  (function initReveal() {
    /* Stagger anak-anak, delay 80ms per elemen */
    $$('[data-stagger]').forEach(function (group) {
      Array.prototype.forEach.call(group.children, function (child, i) {
        child.style.transitionDelay = (prefersReduced ? 0 : i * 80) + 'ms';
      });
    });

    var targets = $$('.reveal, svg.draw, .timeline');
    if (prefersReduced || !('IntersectionObserver' in window)) {
      /* Fallback: langsung tampil */
      targets.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target); /* hemat baterai */
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });
    targets.forEach(function (el) { io.observe(el); });
  })();

  } /* ================== akhir runApp ================== */

  /* ================================================================
     BOOTSTRAP ASYNC — tentukan CONFIG final (preview -> cloud -> config.js)
     lalu jalankan seluruh setup render satu kali. resolveConfig() tidak
     pernah reject; runApp() dibungkus try/catch agar satu error tak
     mematikan halaman. Skrip dimuat di akhir <body> → DOM sudah siap. */
  resolveConfig().then(function (cfg) {
    CONFIG = isRenderable(cfg) ? cfg : window.WEDDING_CONFIG;
    if (PREVIEW_MODE) showPreviewBadge();
    try { runApp(); }
    catch (e) { if (window.console && console.error) console.error('[init]', e); }
  });

})();
