# Panduan Setup CMS (Supabase) — Undangan Hafif & Aisah

Undangan ini **berjalan penuh tanpa CMS**: cukup edit [`js/config.js`](js/config.js)
dan host folder sebagai situs statis. CMS (Supabase) bersifat **opsional** —
gunakan bila Anda ingin mengelola isi undangan dan melihat daftar RSVP dari
sebuah panel admin (`/admin.html`) tanpa mengedit file kode.

> Semua langkah di bawah gratis dan sekali jalan. Ikuti **berurutan** — melewati
> langkah 3 (mematikan pendaftaran mandiri) membuat siapa pun bisa membuat akun
> dan mengedit undangan Anda.

---

## Ringkasan alur

```
Buat project Supabase  →  jalankan schema.sql  →  matikan public signup
      →  buat user admin manual  →  salin URL + anon key ke config  →  deploy
```

---

## Langkah 1 — Buat project Supabase

1. Daftar / masuk di <https://supabase.com>.
2. **New project** → beri nama (mis. `undangan-andre-sarah`), pilih region
   terdekat (mis. Southeast Asia / Singapore), set password database (disimpan
   Supabase, tidak Anda pakai langsung).
3. Tunggu project selesai disiapkan (~1–2 menit).

## Langkah 2 — Jalankan skema database

1. Di dashboard project: **SQL Editor → New query**.
2. Buka [`supabase/schema.sql`](supabase/schema.sql), salin **seluruh** isinya,
   tempel ke editor, lalu **Run**.
3. Skema ini idempoten (aman dijalankan ulang). Ia membuat:
   - tabel `invitation` (singleton berisi seluruh config sebagai JSON),
   - tabel `rsvp` (buku tamu),
   - **Row Level Security (RLS)** + policy yang menjaga akses.

## Langkah 3 — Matikan pendaftaran mandiri (WAJIB)

Policy default mengizinkan **setiap** user login untuk mengedit undangan dan
membaca RSVP. Karena itu orang luar **tidak boleh** bisa mendaftar sendiri.

- **Authentication → Sign In / Providers** (atau **Settings**) →
  **MATIKAN "Allow new users to sign up"** (Enable email signups = OFF).

> Ingin pertahanan berlapis? Lihat blok **5b (opsional)** di `supabase/schema.sql`
> untuk mengunci policy ke **UID admin spesifik**, sehingga meski signup tak
> sengaja menyala, user baru tetap tidak bisa mengedit undangan / membaca RSVP.

## Langkah 4 — Buat akun admin secara manual

1. **Authentication → Users → Add user**.
2. Isi **email + password** admin, dan **centang auto-confirm** (Confirm email)
   agar akun langsung aktif tanpa email verifikasi.
3. (Opsional, untuk langkah 5b) salin **User UID** akun ini.

## Langkah 5 — Salin kredensial ke frontend

1. **Project Settings → API**.
2. Salin dua nilai ini ke [`js/supabase-config.js`](js/supabase-config.js):
   - **Project URL** → `url`
   - **anon public key** → `anonKey`

```js
window.SUPABASE = {
  url: 'https://xxxxxxxx.supabase.co',
  anonKey: 'eyJhbGciOi...'   // anon public key
};
```

> **Keamanan:** `anon` key **memang aman dipublikasikan** di frontend — itu
> perilaku normal Supabase. Keamanan dijaga oleh **RLS** di database, bukan oleh
> kerahasiaan key ini. **Jangan pernah** menaruh `service_role` key di frontend.

## Langkah 6 — Deploy & akses panel admin

1. Unggah folder proyek apa adanya ke hosting statis (Netlify / Vercel /
   GitHub Pages / hosting apa pun).
2. Tamu membuka `index.html`. Anda membuka **`/admin.html`**, login dengan akun
   admin dari langkah 4, lalu kelola isi undangan & lihat RSVP.

## Langkah 7 — Aktifkan foto (opsional)

Agar admin bisa **mengunggah foto** (mempelai, sampul, galeri), dibutuhkan
tempat penyimpanan bernama bucket **`photos`** yang bersifat **publik** (agar
foto bisa dilihat semua tamu). Pilih **salah satu** cara:

- **Cara mudah (SQL):** Anda sudah selesai bila menjalankan **seluruh**
  `supabase/schema.sql` di Langkah 2 — bagian **Storage (nomor 7)** di file itu
  otomatis membuat bucket `photos` beserta aturan aksesnya. Tidak ada langkah
  tambahan.
- **Cara lewat Dashboard:** buka **Storage → New bucket**, beri nama persis
  `photos`, aktifkan **Public bucket**, lalu **Create**. (Aturan aksesnya tetap
  dari `schema.sql`, jadi pastikan schema sudah dijalankan.)

> Tanpa langkah ini, undangan tetap tampil normal memakai ornamen/ilustrasi
> bawaan — fitur unggah foto saja yang belum aktif.

---

## Cara kerja sumber data (agar tak pernah blank)

Halaman tamu memilih sumber config dengan urutan:

1. **Draft pratinjau** (`index.html?preview=1`, dari tombol Pratinjau admin),
2. **Cloud** (Supabase) bila dikonfigurasi & berisi data,
3. **Bawaan** [`js/config.js`](js/config.js).

Bila cloud kosong, gagal dibaca, atau datanya tidak layak-render, situs **jatuh
aman** ke `js/config.js` — undangan tetap tampil normal.

## Catatan keamanan tambahan

- **Rahasia:** jangan commit `.mcp.json` (berisi API key MCP untuk sesi desain).
  Sudah masuk `.gitignore`. Bila pernah ter-commit, **rotasi** key tersebut.
- **RSVP anonim:** insert RSVP terbuka untuk anon (memang perlu, agar tamu bisa
  mengirim), dibatasi panjang kolom oleh CHECK + policy, tetapi **tanpa
  rate-limit**. Untuk undangan pernikahan skala kecil ini memadai. Bila khawatir
  spam, tambahkan CAPTCHA ringan (hCaptcha/Cloudflare Turnstile) atau Edge
  Function di depan insert. Data RSVP hanya bisa **dibaca admin** (SELECT
  di-gate RLS), jadi ini soal abuse penulisan, bukan kebocoran data.
