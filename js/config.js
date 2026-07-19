/* ================================================================
   KONFIGURASI DATA PERNIKAHAN — edit file ini saja.
   Semua teks nama, tanggal, lokasi, rekening ada di sini.
   ================================================================ */
window.WEDDING_CONFIG = {
  groom: {
    name: 'Muhammad Hafif Maulana',
    shortName: 'Hafif',
    parents: 'Putra dari Bapak Nisan (Alm.) & Ibu Nurlailah'
  },
  bride: {
    name: 'Siti Aisah Wulandari',
    shortName: 'Wulan',
    parents: 'Putri dari Bapak Haryanto & Ibu Ernawati'
  },
  date: {
    /* CATATAN: tanggal & jam di bawah masih CONTOH — belum diberikan.
       Ganti dengan tanggal pernikahan yang sebenarnya. */
    display: 'Sabtu, 12 Desember 2026',
    numeric: '12 . 12 . 2026',
    iso: '2026-12-12T08:00:00+07:00' /* target countdown, timezone-safe (WIB) */
  },
  events: [
    { name: 'Akad Nikah', time: '08.00 – 10.00 WIB' },
    { name: 'Resepsi', time: '11.00 – 14.00 WIB' }
  ],
  venue: {
    name: 'Kediaman Mempelai',
    address: 'Gg. Hj. Talen (pinggir kali, dekat pedagang buah Pak Ari), RT 005 / RW 003, Kel. Ketapang, Kec. Cipondoh, Kota Tangerang',
    /* Ganti 'maps' dengan share-link Google Maps dari pin lokasi yang PASTI
       agar tamu tidak nyasar (alamat gang kecil sering tidak akurat). */
    maps: 'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent('Gg. Hj. Talen, Ketapang, Cipondoh, Kota Tangerang')
  },
  calendar: {
    title: 'Pernikahan Hafif & Aisah',
    /* 08.00 WIB = 01:00 UTC; selesai resepsi 14.00 WIB = 07:00 UTC.
       Sesuaikan bila tanggal/jam diubah di atas. */
    startUTC: '20261212T010000Z',
    endUTC: '20261212T070000Z',
    details: 'Akad Nikah 08.00–10.00 WIB dan Resepsi 11.00–14.00 WIB. Kediaman Mempelai, Gg. Hj. Talen, Kel. Ketapang, Kec. Cipondoh, Kota Tangerang.',
    location: 'Gg. Hj. Talen, RT 005 / RW 003, Kel. Ketapang, Kec. Cipondoh, Kota Tangerang'
  },
  quote: {
    text: '“Dan di antara tanda-tanda (kebesaran)-Nya ialah Dia menciptakan pasangan-pasangan untukmu dari jenismu sendiri, agar kamu cenderung dan merasa tenteram kepadanya, dan Dia menjadikan di antaramu rasa kasih dan sayang. Sungguh, pada yang demikian itu benar-benar terdapat tanda-tanda (kebesaran Allah) bagi kaum yang berpikir.”',
    source: '— QS. Ar-Rum: 21'
  },
  /* FOTO — semua nilai berupa string URL publik (hasil upload ke Supabase
     Storage bucket 'photos', atau URL gambar mana pun). Kosong = renderer
     memakai ornamen/ilustrasi bawaan (fallback aman). 'gallery' = array URL.
     Undangan lama tanpa field ini tetap jalan: renderer harus fallback. */
  photos: {
    cover: '',      /* foto sampul / hero (opsional) */
    groom: '',      /* potret mempelai pria (opsional) */
    bride: '',      /* potret mempelai wanita (opsional) */
    gallery: []     /* daftar URL foto galeri; kosong = pakai ornamen */
  },
  /* MUSIK LATAR — kontrol audio undangan.
       url      : URL lagu custom (mp3/audio) hasil upload ke Storage
                  bucket 'photos' (folder 'musik/') atau URL audio mana pun.
                  Kosong = pakai NADA AMBIENT generatif bawaan (fallback aman).
       volume   : 0-100 (persen) volume default.
       autoplay : true = putar otomatis saat "Buka Undangan". TETAP dihormati
                  prefers-reduced-motion & hanya bersuara setelah gesture klik.
     Undangan lama tanpa field ini tetap jalan: renderer harus akses defensif.
     URL wajib disanitasi (safeAudioSrc: izinkan http/https & data:audio). */
  music: {
    url: '',
    volume: 70,
    autoplay: true
  },
  /* KISAH — "Empat Bab Perjalanan". Dipindahkan verbatim dari markup
     hardcode di index.html (section No. VI). Setiap item:
       { year: label tahun+bab, title: judul bab, text: narasi }.
     Renderer & CMS harus fallback aman bila array kosong/hilang. */
  story: [
    {
      year: '2019 — Bab Pertama',
      title: 'Pertama Bertemu',
      text: 'Di koridor kampus yang sama, sebuah perkenalan sederhana di sela kegiatan organisasi menjadi halaman pertama dari kisah yang tidak pernah kami duga akan sepanjang ini.'
    },
    {
      year: '2021 — Bab Kedua',
      title: 'Menjadi Sahabat',
      text: 'Dari rekan diskusi menjadi tempat pulang cerita. Kami tumbuh bersama dalam persahabatan yang tenang, saling menguatkan di masa-masa yang tidak mudah.'
    },
    {
      year: '2025 — Bab Ketiga',
      title: 'Lamaran',
      text: 'Dengan restu kedua keluarga, Hafif datang membawa niat yang tulus. Sebuah jawaban “ya” mengubah persahabatan panjang menjadi janji yang serius.'
    },
    {
      year: '2026 — Bab Keempat',
      title: 'Menikah',
      text: 'Dan sampailah kami di halaman ini — 12 Desember 2026. Dengan izin Allah, kami mengikat janji suci di hadapan keluarga dan sahabat terkasih.'
    }
  ],
  guestFallback: 'Tamu Undangan',
  /* PENTING: nomor di bawah ini masih PLACEHOLDER (pola 1-2-3-4).
     WAJIB diganti dengan nomor rekening & DANA asli sebelum undangan disebar.
     Selama masih placeholder, GATE RILIS otomatis menyembunyikan section
     Amplop Digital agar tidak bocor ke tamu.
     'number' = angka murni yang disalin tombol; 'display' = pengelompokan
     tampilan yang HARUS diturunkan dari 'number' yang sama. */
  accounts: [
    { bank: 'BCA',  number: '1234567890',   display: '1234 5678 90',   holder: 'a.n. Muhammad Hafif Maulana' },
    { bank: 'DANA', number: '081234567890', display: '0812-3456-7890', holder: 'a.n. Siti Aisah Wulandari' }
  ],
  storageKey: 'rsvp_entries_hafif_aisah',
  rsvp: {
    /* Nomor WhatsApp penerima konfirmasi kehadiran, format internasional
       tanpa '+' (contoh: '6281234567890'). Bila diisi, setelah tamu menekan
       "Kirim Ucapan" muncul tombol untuk meneruskan konfirmasinya ke nomor
       ini — satu-satunya cara mempelai benar-benar menerima data RSVP,
       karena undangan statis ini tidak punya server. Kosongkan bila tidak dipakai. */
    whatsapp: ''
  },
  seedWishes: [
    { name: 'Rizky Ananda', attendance: 'Hadir', guests: 2, message: 'Barakallahu laka wa baraka ‘alaika. Selamat menempuh hidup baru, Hafif & Aisah! Semoga menjadi keluarga sakinah, mawaddah, warahmah.', hoursAgo: 2 },
    { name: 'Putri Maharani', attendance: 'Insya Allah', guests: 1, message: 'MasyaAllah, akhirnya! Semoga lancar sampai hari H ya. Doa terbaik untuk kalian berdua.', hoursAgo: 7 },
    { name: 'Keluarga Besar Wijaya', attendance: 'Hadir', guests: 4, message: 'Selamat kepada kedua mempelai dan keluarga. Semoga Allah mengumpulkan kalian berdua dalam kebaikan.', hoursAgo: 26 }
  ]
};
