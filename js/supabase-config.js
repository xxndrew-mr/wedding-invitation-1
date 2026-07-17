/* ================================================================
   KONFIGURASI SUPABASE (opsional) — CMS cloud untuk undangan.
   ----------------------------------------------------------------
   Undangan ini TETAP berjalan penuh tanpa Supabase. File ini hanya
   perlu diisi bila Anda ingin mengelola isi undangan & RSVP lewat
   cloud (mode CMS). Selama masih berisi 'XXXX' / 'PLACEHOLDER',
   situs otomatis memakai data bawaan dari js/config.js.

   CARA MENGISI:
   1. Buat project gratis di https://supabase.com
   2. Jalankan supabase/schema.sql di SQL Editor (sekali saja).
   3. Buka Dashboard -> Settings -> API, lalu salin:
        - "Project URL"          -> ganti nilai `url` di bawah
        - "Publishable key"      -> ganti nilai `anonKey` di bawah
          (di project lama namanya "anon public" key)
   4. Authentication -> MATIKAN "Allow new users to sign up".
   5. Authentication -> Users -> Add user (buat akun admin manual).

   ⚠ CATATAN KEAMANAN — WAJIB DIBACA:
   Isi HANYA dengan Publishable key (berawalan "sb_publishable") atau
   anon key lama (berupa JWT "eyJ..."). Key jenis ini MEMANG aman
   dipublikasikan di frontend; keamanan dijaga oleh Row Level Security
   (RLS) di database.
   JANGAN PERNAH menaruh Secret key (berawalan "sb" + "_secret") atau
   service_role key di sini — key itu mem-bypass RLS, sehingga siapa
   pun yang membuka situs bisa membaca/menghapus seluruh database Anda.
   ================================================================ */
window.SUPABASE = {
  url: 'https://wcqhbikhdmfgeokdaihk.supabase.co',
  anonKey: 'sb_publishable_2gfUCBOrzVLeR4vpldA8uw_uOZoaqQC'
};
