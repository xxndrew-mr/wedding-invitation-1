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
  /* Angka Romawi untuk penomoran caption/ghost agar konsisten dengan markup. */
  function toRoman(n) {
    n = Number(n);
    if (!(n > 0) || !isFinite(n)) return String(n);
    var map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'],
      [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    var r = '';
    map.forEach(function (p) { while (n >= p[0]) { r += p[1]; n -= p[0]; } });
    return r;
  }
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

  /* Whitelist khusus untuk <img src> / background-image (BEDA dari safeHref):
     hanya http/https & data:image/* (blokir javascript:, data:text/html, tel:).
     Kembalikan '' bila tidak aman -> renderer memakai ornamen SVG bawaan. */
  function safeImgSrc(url) {
    var s = String(url == null ? '' : url).trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (/^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);/i.test(s)) return s;
    return '';
  }
  /* Whitelist khusus untuk <audio src> / new Audio(): hanya http/https &
     data:audio/* (blokir javascript:, data:text/html, tel:). Kembalikan ''
     bila tidak aman -> renderer memakai nada ambient generatif bawaan. */
  function safeAudioSrc(url) {
    var s = String(url == null ? '' : url).trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (/^data:audio\//i.test(s)) return s;
    return '';
  }
  /* Escape nilai URL agar aman disisipkan ke dalam CSS url("...") */
  function cssUrl(s) {
    return String(s).replace(/[\\"]/g, function (c) { return '\\' + c; })
      .replace(/[\r\n]/g, '');
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

  /* ================== RANGKAIAN ACARA dari CONFIG (dinamis) ==================
     Jumlah kartu mengikuti CONFIG.events: kartu berlebih dibuat dengan
     mengklon kartu bawaan (gaya/ikon/ornamen konsisten), kartu berlebih
     dihapus. Dresscode ditampilkan untuk SETIAP acara yang mengisinya, dan
     dihapus bila kosong agar placeholder tidak bocor ke tamu. Dijalankan
     SEBELUM builder .js-maps/.js-calendar agar tombol pada kartu klon ikut
     mendapatkan href. */
  try {
    var events = CONFIG.events;
    if (Array.isArray(events) && events.length) {
      var eventCards = $$('.event-card');
      if (eventCards.length) {
        var evContainer = eventCards[0].parentNode;
        var evProto = eventCards.length;
        events.forEach(function (ev, i) {
          if (!ev || typeof ev !== 'object') return;
          var card;
          if (i < eventCards.length) {
            card = eventCards[i];
          } else {
            card = eventCards[i % evProto].cloneNode(true);
            evContainer.appendChild(card);
          }
          var h3 = card.querySelector('h3');
          if (h3) h3.textContent = String(ev.name == null ? '' : ev.name);
          var timeEl = card.querySelector('.ev-time');
          if (timeEl) timeEl.textContent = String(ev.time == null ? '' : ev.time);
          var dress = card.querySelector('.ev-dress');
          if (ev.dresscode) {
            if (!dress) {
              dress = document.createElement('p');
              dress.className = 'ev-dress';
              var rows = card.querySelector('.ev-rows');
              if (rows && rows.nextSibling) card.insertBefore(dress, rows.nextSibling);
              else if (rows) card.appendChild(dress);
              else card.appendChild(dress);
            }
            dress.removeAttribute('data-bind');
            dress.textContent = String(ev.dresscode);
          } else if (dress && dress.parentNode) {
            dress.parentNode.removeChild(dress);
          }
        });
        /* Hapus kartu bawaan berlebih bila acara lebih sedikit dari markup */
        for (var ek = events.length; ek < eventCards.length; ek++) {
          if (eventCards[ek] && eventCards[ek].parentNode) {
            eventCards[ek].parentNode.removeChild(eventCards[ek]);
          }
        }
      }
    }
  } catch (e) { /* kartu acara bawaan tetap tampil */ }

  /* ================== AMPLOP DIGITAL dari CONFIG (dinamis) ==================
     Render satu kartu rekening per CONFIG.accounts. Menghindari placeholder
     kartu ke-2 bocor saat rekening dikurangi, memunculkan rekening ke-3+,
     dan menjaga data-copy-index + aria-label selalu sesuai nama bank. */
  try {
    var accounts = CONFIG.accounts;
    if (Array.isArray(accounts) && accounts.length) {
      var bankCards = $$('.bank-card');
      if (bankCards.length) {
        var bankContainer = bankCards[0].parentNode;
        var bankProto = bankCards[0].cloneNode(true); /* template bersih */
        bankCards.forEach(function (c) { if (c.parentNode) c.parentNode.removeChild(c); });
        accounts.forEach(function (acc, i) {
          if (!acc || typeof acc !== 'object') return;
          var card = bankProto.cloneNode(true);
          $$('[data-bind]', card).forEach(function (el) { el.removeAttribute('data-bind'); });
          var nameEl = card.querySelector('.bank-name');
          if (nameEl) nameEl.textContent = String(acc.bank == null ? '' : acc.bank);
          var numEl = card.querySelector('.bank-number');
          if (numEl) {
            var shown = (acc.display != null && String(acc.display).trim())
              ? acc.display : (acc.number == null ? '' : acc.number);
            numEl.textContent = String(shown);
          }
          var holderEl = card.querySelector('.bank-holder');
          if (holderEl) holderEl.textContent = String(acc.holder == null ? '' : acc.holder);
          var btn = card.querySelector('.copy-btn');
          if (btn) {
            btn.setAttribute('data-copy-index', String(i));
            btn.setAttribute('aria-label', 'Salin nomor ' + (acc.bank || 'rekening'));
          }
          bankContainer.appendChild(card);
        });
      }
    }
  } catch (e) { /* kartu rekening bawaan tetap tampil */ }

  (function () {
    var mapsHref = safeHref(CONFIG.venue && CONFIG.venue.maps);
    $$('.js-maps').forEach(function (a) {
      if (mapsHref) { a.setAttribute('href', mapsHref); a.style.display = ''; }
      else { a.removeAttribute('href'); a.style.display = 'none'; }
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

  /* ================== Teks running (marquee) dari CONFIG ==================
     Sebelumnya nama & tanggal di-hardcode sehingga tidak ikut berubah saat
     data diedit. Kini dibangun dari CONFIG (nama panggilan + tanggal). */
  (function buildMarquee() {
    var els = $$('.js-marquee');
    if (!els.length) return;
    var g = (CONFIG.groom && CONFIG.groom.shortName) || '';
    var b = (CONFIG.bride && CONFIG.bride.shortName) || '';
    var d = (CONFIG.date && CONFIG.date.display) || '';
    var couple = (g && b) ? (g + ' & ' + b) : (g || b);
    var parts = [];
    if (couple) parts.push(couple);
    if (d) parts.push(d);
    var unit = parts.join(' — ');
    if (!unit) return; /* tak ada data → biarkan teks bawaan */
    /* ulangi beberapa kali agar pita tetap penuh saat bergulir */
    var text = '';
    for (var i = 0; i < 3; i++) text += unit + ' — ';
    text += ' ';
    els.forEach(function (el) { el.textContent = text; });
  })();

  /* ================== FOTO & KISAH dari CONFIG (fallback aman ke ornamen) ==================
     Semua opsional: bila kosong/hilang, markup ornamen/ilustrasi bawaan dibiarkan
     apa adanya. URL gambar selalu disanitasi (safeImgSrc) untuk cegah XSS. */
  var PHOTOS = (CONFIG && CONFIG.photos && typeof CONFIG.photos === 'object') ? CONFIG.photos : {};
  var SVGNS = 'http://www.w3.org/2000/svg';
  var XLINKNS = 'http://www.w3.org/1999/xlink';

  /* 1. COVER — foto sampul sebagai latar dengan overlay gelap agar teks terbaca. */
  try {
    var coverSrc = safeImgSrc(PHOTOS.cover);
    if (coverSrc) {
      var bg = 'linear-gradient(rgba(7,13,11,0.70), rgba(7,13,11,0.82)), url("' + cssUrl(coverSrc) + '")';
      $$('#cover .cover-inner').forEach(function (inner) {
        inner.style.backgroundImage = bg;
        inner.style.backgroundSize = 'cover';
        inner.style.backgroundPosition = 'center';
        inner.style.backgroundRepeat = 'no-repeat';
      });
    }
  } catch (e) { /* biarkan gradien bawaan */ }

  /* 2. POTRET MEMPELAI — sisipkan foto sebagai <image> di dalam svg.portrait,
     mengikuti klip lengkung (arch) yang sama; siluet bawaan disembunyikan.
     Bila URL kosong/invalid: ilustrasi SVG bawaan tetap dipakai. */
  function renderPortrait(card, url, altName) {
    var src = safeImgSrc(url);
    if (!card || !src) return;
    var svg = card.querySelector('svg.portrait');
    if (!svg) return;
    var uid = 'portraitClip-' + Math.random().toString(36).slice(2);
    var defs = document.createElementNS(SVGNS, 'defs');
    var clip = document.createElementNS(SVGNS, 'clipPath');
    clip.setAttribute('id', uid);
    var cpath = document.createElementNS(SVGNS, 'path');
    cpath.setAttribute('d', 'M8 121 V48 A42 42 0 0 1 92 48 V121 Z');
    clip.appendChild(cpath);
    defs.appendChild(clip);
    svg.appendChild(defs);

    var img = document.createElementNS(SVGNS, 'image');
    img.setAttribute('x', '8');
    img.setAttribute('y', '6');
    img.setAttribute('width', '84');
    img.setAttribute('height', '115');
    img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    img.setAttribute('clip-path', 'url(#' + uid + ')');
    img.setAttribute('href', src);
    img.setAttributeNS(XLINKNS, 'href', src); /* kompatibilitas browser lama */

    /* Sembunyikan siluet bawaan agar tidak menumpuk foto */
    var sil = svg.querySelector('use[href="#silhouette"]');
    if (sil) sil.setAttribute('style', 'display:none');

    /* Sisipkan tepat setelah path isian gradien (path pertama) supaya kedua
       garis lengkung emas (path ke-2 & ke-3) tetap tergambar DI ATAS foto. */
    var firstPath = svg.querySelector('path');
    if (firstPath && firstPath.nextSibling) svg.insertBefore(img, firstPath.nextSibling);
    else svg.appendChild(img);

    if (altName) svg.setAttribute('aria-label', 'Foto ' + altName);
  }
  try {
    var coupleCards = $$('.couple-card');
    var groomName = (CONFIG.groom && CONFIG.groom.name) || 'mempelai pria';
    var brideName = (CONFIG.bride && CONFIG.bride.name) || 'mempelai wanita';
    renderPortrait(coupleCards[0], PHOTOS.groom, groomName);
    renderPortrait(coupleCards[1], PHOTOS.bride, brideName);
  } catch (e) { /* ilustrasi bawaan tetap dipakai */ }

  /* 3. GALERI — isi 6 frame ornamen dengan foto (lazy, object-fit cover).
     < 6 foto: sisanya tetap ornamen. > 6 foto: tambah sel bergaya sama.
     Kosong: tampilan ornamen sekarang dibiarkan utuh. */
  try {
    var galleryUrls = (PHOTOS && Array.isArray(PHOTOS.gallery) ? PHOTOS.gallery : [])
      .map(safeImgSrc).filter(Boolean);
    if (galleryUrls.length) {
      var galleryEl = document.querySelector('.gallery');
      if (galleryEl) {
        var cells = $$('.g-cell', galleryEl);
        var protoCount = cells.length || 1;
        galleryUrls.forEach(function (src, i) {
          var cell, frame;
          if (i < cells.length) {
            cell = cells[i];
          } else {
            /* Klon sel yang ada (siklus) agar gaya frame/rasio/gradien konsisten */
            cell = cells[i % protoCount].cloneNode(true);
            galleryEl.appendChild(cell);
            /* Angka Romawi agar konsisten dengan caption 6 sel bawaan (Momen I–VI) */
            var cap = cell.querySelector('.g-cap');
            if (cap) cap.textContent = 'Momen ' + toRoman(i + 1);
          }
          frame = cell.querySelector('.g-frame');
          if (!frame) return;
          var orn = frame.querySelector('.g-orn');
          if (orn) orn.setAttribute('style', 'display:none');
          /* Bersihkan sisa foto bila sel hasil klon sudah punya <img> */
          var old = frame.querySelector('img.g-img');
          if (old) old.parentNode.removeChild(old);
          var im = document.createElement('img');
          im.className = 'g-img';
          im.src = src;
          im.loading = 'lazy';
          im.decoding = 'async';
          im.alt = 'Foto galeri ' + (i + 1);
          frame.insertBefore(im, frame.firstChild);
        });
      }
    }
  } catch (e) { /* ornamen galeri bawaan tetap tampil */ }

  /* 4. KISAH — bangun ulang timeline dari CONFIG.story bila array valid & non-kosong.
     Bila kosong/hilang: 4 article.story-item hardcode dibiarkan apa adanya. */
  try {
    var story = CONFIG.story;
    if (Array.isArray(story) && story.length) {
      var timeline = $('timeline');
      if (timeline) {
        $$('.story-item', timeline).forEach(function (el) { el.parentNode.removeChild(el); });
        var frag = document.createDocumentFragment();
        story.forEach(function (bab) {
          if (!bab || typeof bab !== 'object') return;
          var art = document.createElement('article');
          art.className = 'story-item';
          var node = document.createElement('span');
          node.className = 'story-node';
          node.setAttribute('aria-hidden', 'true');
          art.appendChild(node);
          var year = document.createElement('p');
          year.className = 'story-year';
          year.textContent = String(bab.year == null ? '' : bab.year);
          art.appendChild(year);
          var h3 = document.createElement('h3');
          h3.textContent = String(bab.title == null ? '' : bab.title);
          art.appendChild(h3);
          var p = document.createElement('p');
          p.textContent = String(bab.text == null ? '' : bab.text);
          art.appendChild(p);
          frag.appendChild(art);
        });
        timeline.appendChild(frag); /* spine tetap sebagai anak pertama */
      }
    }
  } catch (e) { /* kisah hardcode bawaan tetap tampil */ }

  /* ================== GATE RILIS — placeholder tidak boleh bocor ke tamu ==================
     Selama data wajib masih berisi nilai contoh, elemen yang bisa menyesatkan
     tamu disembunyikan otomatis. Isi data asli di CONFIG untuk memunculkannya. */
  try { (function releaseGate() {
    var problems = [];

    /* 1. Nomor rekening/DANA placeholder → section Amplop Digital TETAP TAMPIL
       (mandat: amplop harus terlihat oleh tamu). Hanya beri peringatan di
       console agar mempelai mengganti nomor contoh sebelum undangan disebar. */
    var PLACEHOLDER_NUMBERS = ['1234567890', '081234567890'];
    var accountsPlaceholder = (Array.isArray(CONFIG.accounts) ? CONFIG.accounts : []).some(function (a) {
      return a && PLACEHOLDER_NUMBERS.indexOf(String(a.number)) !== -1;
    });
    if (accountsPlaceholder) {
      problems.push('CONFIG.accounts masih PLACEHOLDER (nomor contoh 1-2-3-4). Amplop Digital tetap ditampilkan — GANTI dengan nomor rekening & DANA asli sebelum undangan disebar agar tamu tidak menyalin nomor yang salah.');
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

  /* ================== Musik latar — lagu custom ATAU nada generatif ==================
     Bila CONFIG.music.url valid (safeAudioSrc) -> putar lagu itu via
     HTMLAudioElement (loop). Bila kosong/invalid/gagal-load -> pakai nada
     ambient generatif WebAudio bawaan. Akses config defensif (undangan lama
     tanpa 'music' tetap jalan). Volume tamu disimpan di localStorage. */
  var MUSIC = (CONFIG && CONFIG.music && typeof CONFIG.music === 'object') ? CONFIG.music : {};
  var musicSrc = safeAudioSrc(MUSIC.url);        /* '' => mode ambient generatif */
  var musicAutoplay = MUSIC.autoplay !== false;  /* default true */
  var VOL_KEY = 'wedding_music_volume';
  var AMBIENT_BASE = 0.055;                       /* gain ambient penuh (volume 100%) */

  function clampVol(v, dflt) {
    var n = Math.round(Number(v));
    if (!isFinite(n)) return dflt;
    return n < 0 ? 0 : (n > 100 ? 100 : n);
  }
  /* Volume default dari CONFIG, di-override preferensi tamu (localStorage). */
  var guestVolume = clampVol(MUSIC.volume, 70);
  try {
    var savedVol = window.localStorage.getItem(VOL_KEY);
    if (savedVol !== null) guestVolume = clampVol(savedVol, guestVolume);
  } catch (e) { /* mode privat */ }
  function currentVol01() { return guestVolume / 100; }

  var musicMode = musicSrc ? 'file' : 'ambient';
  var audioEl = null;   /* HTMLAudioElement (mode file) */
  /* true bila pengguna menekan tombol musik untuk MEMUTAR (bukan sekadar init).
     Dipakai agar, saat lagu custom gagal-load, fallback ke nada generatif terjadi
     dalam SATU tekanan (bukan tombol pertama "termakan" percobaan file gagal). */
  var userWantsPlay = false;

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
      master.gain.linearRampToValueAtTime(Math.max(0.0001, AMBIENT_BASE * currentVol01()), ctx.currentTime + 2.5);
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
  var musicPlaying = false;   /* status UI aktif; dipakai tombol toggle & fallback */
  function setMusicUI(on) {
    musicPlaying = !!on;
    if (musicBtn) {
      musicBtn.classList.toggle('playing', on);
      musicBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      musicBtn.setAttribute('aria-label', on ? 'Jeda musik latar' : 'Putar musik latar');
    }
    if (musicEq) musicEq.classList.toggle('on', on);
  }

  /* Terapkan volume ke sumber aktif (audio-file: audioEl.volume; generatif:
     skala master gain terhadap AMBIENT_BASE). Dipanggil live saat slider digeser. */
  function applyVolume() {
    if (musicMode === 'file' && audioEl) {
      try { audioEl.volume = currentVol01(); } catch (e) { /* aman */ }
      return;
    }
    if (audio.ctx && audio.master) {
      var target = Math.max(0.0001, AMBIENT_BASE * currentVol01());
      try {
        var now = audio.ctx.currentTime;
        audio.master.gain.cancelScheduledValues(now);
        audio.master.gain.setValueAtTime(Math.max(0.0001, audio.master.gain.value), now);
        audio.master.gain.linearRampToValueAtTime(target, now + 0.18);
      } catch (e) {
        try { audio.master.gain.value = target; } catch (e2) { /* aman */ }
      }
    }
  }

  /* Siapkan HTMLAudioElement untuk lagu custom. onerror -> fallback generatif. */
  function initFileAudio() {
    if (audioEl) return true;
    if (musicMode !== 'file') return false;
    try {
      var el = new Audio();
      el.loop = true;
      el.preload = 'auto';
      try { el.volume = currentVol01(); } catch (e) { /* aman */ }
      el.addEventListener('error', function () {
        /* Lagu custom gagal dimuat: alihkan ke nada generatif (atau diam). */
        var wasPlaying = musicPlaying;
        try { el.pause(); } catch (e2) { /* aman */ }
        audioEl = null;
        musicMode = 'ambient';
        /* wasPlaying: sudah berbunyi (autoplay) -> lanjut ambient.
           userWantsPlay: pengguna baru saja menekan tombol untuk memutar, tetapi
           file gagal sebelum play() sempat resolve -> langsung fallback ambient di
           tekanan yang sama (gesture pengguna sudah terjadi -> aman). */
        if (wasPlaying || userWantsPlay) { userWantsPlay = false; startMusic(); }
        else setMusicUI(false);
      });
      el.src = musicSrc;
      audioEl = el;
      return true;
    } catch (e) {
      musicMode = 'ambient';
      return false;
    }
  }

  /* startMusic/stopMusic mengarah ke SUMBER AKTIF (audio-file ATAU generatif). */
  function startMusic() {
    if (musicMode === 'file') {
      if (initFileAudio() && audioEl) {
        applyVolume();
        var el = audioEl;
        var pf = el.play();
        if (pf && typeof pf.then === 'function') {
          /* Guard audioEl===el: bila 'error' sudah mengalihkan ke ambient (audioEl
             di-null-kan lalu startMusic ambient jalan), promise usang dari elemen
             file lama tidak boleh meng-clobber UI. */
          pf.then(function () { if (audioEl === el) setMusicUI(true); }, function () {
            /* play() ditolak kebijakan autoplay: diam, biarkan tombol utk mulai manual */
            if (audioEl === el) setMusicUI(false);
          });
        } else {
          setMusicUI(true);
        }
        return;
      }
      /* initFileAudio gagal sinkron -> jatuh ke jalur ambient di bawah */
    }
    if (!initAudio()) return;
    var p = audio.ctx.resume();
    if (p && typeof p.catch === 'function') p.catch(function () {});
    audio.nextTime = Math.max(audio.nextTime, audio.ctx.currentTime + 0.2);
    audio.running = true;
    setMusicUI(true);
  }
  function stopMusic() {
    if (musicMode === 'file' && audioEl) {
      try { audioEl.pause(); } catch (e) { /* aman */ }
    }
    if (audio.ctx) {
      var p = audio.ctx.suspend();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    }
    audio.running = false;
    setMusicUI(false);
  }
  if (musicBtn) {
    musicBtn.addEventListener('click', function () {
      if (musicPlaying) { userWantsPlay = false; stopMusic(); }
      else { userWantsPlay = true; startMusic(); }
    });
  }

  /* Kontrol volume tamu — slider aksesibel dekat tombol musik. Perubahan
     live + disimpan ke localStorage agar tetap saat tamu kembali. */
  var musicVol = $('musicVolRange');
  if (musicVol) {
    musicVol.value = String(guestVolume);
    musicVol.setAttribute('aria-valuetext', guestVolume + ' persen');
    musicVol.addEventListener('input', function () {
      guestVolume = clampVol(musicVol.value, guestVolume);
      musicVol.setAttribute('aria-valuetext', guestVolume + ' persen');
      try { window.localStorage.setItem(VOL_KEY, String(guestVolume)); } catch (e) { /* mode privat */ }
      applyVolume();
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
    /* gesture pengguna = klik ini; hormati autoplay config & prefers-reduced-motion.
       Pemutaran bersuara hanya di sini (dalam handler gesture) agar tak diblokir
       kebijakan autoplay browser; prefers-reduced-motion menang atas autoplay:true. */
    if (musicAutoplay && !prefersReduced) { userWantsPlay = true; startMusic(); }
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
