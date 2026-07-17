# Undangan Pernikahan Digital — Andre & Sarah

Website undangan pernikahan single-page bergaya **"Nocturne Éditorial"** (editorial mewah:
hijau midnight, emas champagne, tipografi Fraunces, ornamen SVG garis yang "menggambar
dirinya sendiri"). Tanpa framework, tanpa build step, tanpa server — cukup buka
`index.html` atau host sebagai situs statis.

## Struktur file

```
index.html            → markup semua section + pustaka simbol SVG (ornamen digambar sendiri)
css/style.css         → seluruh gaya tampilan halaman tamu
js/config.js          → SEMUA DATA PERNIKAHAN (edit file ini saja untuk mengganti isi)
js/main.js            → logika: cover, countdown, musik, RSVP, galeri, animasi scroll

── Panel Admin / CMS (opsional, lihat SETUP-CMS.md) ──
admin.html            → panel admin: login, editor undangan, daftar RSVP
css/admin.css         → gaya panel admin
js/admin.js           → logika panel admin (form editor + tabel RSVP + unduh CSV)
js/api.js             → window.CloudAPI: lapisan cloud serverless (fetch ke Supabase)
js/supabase-config.js → isi url + anon key Supabase di sini untuk mengaktifkan CMS
supabase/schema.sql   → skema database + Row Level Security (jalankan di Supabase)

.mcp.json             → koneksi MCP Google Stitch (sesi desain di Claude Code; JANGAN commit)
```

## Cara mengisi data asli (WAJIB sebelum disebar)

Semua di [js/config.js](js/config.js):

1. **Nama & orang tua** — `groom`, `bride`.
2. **Tanggal & jam** — `date`, `events`, dan `calendar` (start/end dalam UTC;
   08.00 WIB = 01.00Z).
3. **Venue** — `venue.name`, `venue.address`, dan ganti `venue.maps` dengan
   share-link Google Maps dari pin lokasi pasti.
4. **Rekening amplop digital** — `accounts` (`number` = angka yang disalin tombol,
   `display` = tampilannya).
5. **WhatsApp RSVP** — `rsvp.whatsapp` (format `62812...`). Bila diisi, setelah tamu
   menekan "Kirim Ucapan" muncul tombol *Teruskan Konfirmasi via WhatsApp* sehingga
   konfirmasi benar-benar sampai ke mempelai. Tanpa server, ucapan hanya tersimpan
   di perangkat tamu (localStorage) — fitur WA inilah jalur penerimaan RSVP.

### Gate rilis (pengaman placeholder)

Selama `accounts` dan `venue` masih berisi data contoh, halaman **otomatis
menyembunyikan** section Amplop Digital dan tombol Petunjuk Lokasi, serta menulis
peringatan di console browser. Setelah data asli diisi, keduanya tampil kembali.

## Panel Admin (CMS opsional)

Undangan berjalan penuh **tanpa** CMS (cukup edit `js/config.js`). Bila ingin
mengelola isi undangan & melihat daftar RSVP dari sebuah panel (`/admin.html`)
tanpa menyentuh kode, aktifkan mode CMS berbasis **Supabase** (gratis, serverless).

**Panduan lengkap end-to-end ada di [SETUP-CMS.md](SETUP-CMS.md)** — buat project
Supabase → jalankan `supabase/schema.sql` → matikan pendaftaran mandiri → buat
akun admin manual → salin Project URL + anon key ke `js/supabase-config.js` →
deploy. Selama `js/supabase-config.js` masih berisi placeholder, situs otomatis
memakai data bawaan dari `js/config.js` dan panel admin tidak aktif.

> Catatan: `anon` key Supabase memang aman dipublikasikan di frontend; keamanan
> dijaga oleh Row Level Security di database. Jangan pernah menaruh `service_role`
> key di frontend, dan jangan commit `.mcp.json` (berisi API key sesi desain).

## Nama tamu di cover

Tambahkan parameter `?to=` pada tautan yang dibagikan:

```
https://situs-anda.com/?to=Bapak%20Budi%20%26%20Ibu%20Ani
```

Nama dirender aman (textContent, anti-XSS). Tanpa parameter, tampil "Tamu Undangan".

## Catatan teknis

- Musik latar dibangkitkan via WebAudio (tanpa file audio), mulai saat tamu menekan
  "Buka Undangan"; tombol toggle di kanan bawah.
- Menghormati `prefers-reduced-motion`; ada fallback `<noscript>`.
- Satu-satunya dependensi eksternal: Google Fonts.
- Uji lokal cukup klik dua kali `index.html`. Deploy: unggah folder ini apa adanya
  ke Netlify/Vercel/GitHub Pages/hosting statis apa pun.

## Aset referensi Stitch

Project Stitch "Undangan Pernikahan" (`projects/15100766080330693766`) menyimpan
design system *Nusantara Elegance* + gambar monogram A&S hasil generate — bisa dibuka
di [stitch.withgoogle.com](https://stitch.withgoogle.com) sebagai referensi bila ingin
eksplorasi arah visual lain.
