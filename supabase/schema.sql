-- ================================================================
--  SKEMA SUPABASE — Fondasi CMS undangan pernikahan (serverless)
--  Jalankan SELURUH file ini SEKALI di: Supabase Dashboard
--    -> SQL Editor -> New query -> tempel -> Run.
--  Aman dijalankan ulang (idempoten): pakai IF NOT EXISTS,
--  drop-then-create policy, dan ON CONFLICT DO NOTHING.
-- ================================================================

-- ================================================================
--  PENGINGAT KEAMANAN PALING PENTING  (WAJIB DIBACA)
-- ----------------------------------------------------------------
--  Policy tabel 'invitation' mengizinkan SIAPA PUN yang berstatus
--  'authenticated' (punya akun & login) untuk MENGUBAH isi undangan.
--  Karena itu, Anda HARUS MEMATIKAN pendaftaran mandiri agar orang
--  luar tidak bisa membuat akun sendiri lalu mengedit undangan:
--
--    Dashboard -> Authentication -> Sign In / Providers (atau
--    Settings) -> MATIKAN "Allow new users to sign up"
--    (Enable email signups = OFF).
--
--  Buat akun ADMIN secara MANUAL lewat dashboard:
--    Dashboard -> Authentication -> Users -> "Add user"
--    (isi email + password, centang auto-confirm).
--
--  anon key MEMANG dipublikasikan di frontend — itu normal dan aman.
--  Keamanan dijaga oleh Row Level Security (RLS) di bawah, BUKAN
--  oleh kerahasiaan key.
-- ================================================================


-- ================================================================
--  1. TABEL invitation  — SINGLETON (hanya 1 baris, id = 1)
--     Menyimpan seluruh objek konfigurasi undangan dalam 1 kolom
--     jsonb bernama 'data'. Bentuknya IDENTIK dengan
--     window.WEDDING_CONFIG di js/config.js.
-- ================================================================
create table if not exists public.invitation (
  id         integer      primary key default 1,
  data       jsonb        not null default '{}'::jsonb,
  updated_at timestamptz  not null default now(),
  -- Kunci singleton: hanya baris id = 1 yang boleh ada.
  constraint invitation_singleton check (id = 1)
);

comment on table  public.invitation      is 'Singleton (id=1) berisi seluruh konfigurasi undangan sebagai jsonb, bentuk identik dengan window.WEDDING_CONFIG.';
comment on column public.invitation.data is 'Objek konfigurasi undangan (groom, bride, date, events, venue, dst.).';


-- ================================================================
--  2. TABEL rsvp  — buku tamu / konfirmasi kehadiran
--     Baris ditulis oleh TAMU (anon). Dibaca hanya oleh ADMIN.
--     CHECK panjang membatasi penyalahgunaan oleh anon.
-- ================================================================
create table if not exists public.rsvp (
  id         bigint generated always as identity primary key,
  name       text        not null,
  attendance text,
  guests     integer     not null default 1,
  message    text,
  created_at timestamptz not null default now(),
  -- Batas wajar untuk mencegah abuse dari klien anonim.
  constraint rsvp_name_len    check (char_length(name) between 1 and 80),
  constraint rsvp_message_len check (message is null or char_length(message) <= 1000),
  constraint rsvp_guests_rng  check (guests between 0 and 20),
  constraint rsvp_attend_len  check (attendance is null or char_length(attendance) <= 40)
);

comment on table public.rsvp is 'Entri RSVP dari tamu (ditulis anon, dibaca hanya admin authenticated).';


-- ================================================================
--  3. AKTIFKAN ROW LEVEL SECURITY
--     Tanpa policy yang cocok, semua akses DITOLAK secara default.
-- ================================================================
alter table public.invitation enable row level security;
alter table public.rsvp       enable row level security;


-- ================================================================
--  4. POLICY  invitation
--     - SELECT : semua (anon + authenticated) boleh membaca isi
--                undangan  ->  using (true)
--     - INSERT : hanya authenticated
--     - UPDATE : hanya authenticated
--     (Publik TIDAK bisa mengubah isi undangan.)
-- ================================================================
drop policy if exists invitation_select_public on public.invitation;
create policy invitation_select_public
  on public.invitation
  for select
  to anon, authenticated
  using (true);

drop policy if exists invitation_insert_auth on public.invitation;
create policy invitation_insert_auth
  on public.invitation
  for insert
  to authenticated
  with check (true);

drop policy if exists invitation_update_auth on public.invitation;
create policy invitation_update_auth
  on public.invitation
  for update
  to authenticated
  using (true)
  with check (true);


-- ================================================================
--  5. POLICY  rsvp
--     - INSERT : anon + authenticated boleh menulis, TAPI hanya
--                yang memenuhi batas panjang (CHECK di atas +
--                with check di sini). Tamu mengirim RSVP.
--     - SELECT : hanya authenticated (admin). Publik TIDAK bisa
--                membaca daftar RSVP orang lain.
--     (Tidak ada policy UPDATE/DELETE -> keduanya otomatis ditolak
--      untuk anon & authenticated; kelola lewat dashboard bila perlu.)
-- ================================================================
drop policy if exists rsvp_insert_anyone on public.rsvp;
create policy rsvp_insert_anyone
  on public.rsvp
  for insert
  to anon, authenticated
  with check (
    char_length(name) between 1 and 80
    and (message is null or char_length(message) <= 1000)
    and guests between 0 and 20
    and (attendance is null or char_length(attendance) <= 40)
  );

drop policy if exists rsvp_select_admin on public.rsvp;
create policy rsvp_select_admin
  on public.rsvp
  for select
  to authenticated
  using (true);


-- ================================================================
--  5b. (OPSIONAL, DISARANKAN) PENGERASAN — batasi ke UID admin
--      ----------------------------------------------------------
--      Policy di atas memberi akses tulis undangan & baca RSVP ke
--      SETIAP user 'authenticated'. Itu aman SELAMA signup dimatikan
--      dan hanya ada 1 akun admin. Untuk pertahanan berlapis (agar
--      meski signup tak sengaja menyala, user baru tetap tak bisa
--      apa-apa), persempit ke UID admin spesifik.
--
--      CARA PAKAI:
--        1) Authentication -> Users -> buka akun admin -> salin "User UID".
--        2) Ganti SEMUA 'GANTI-DENGAN-UID-ADMIN' di bawah dengan UID itu.
--        3) Hapus tanda komentar (--) pada blok ini lalu Run ulang.
--      Setelah diaktifkan, blok ini menimpa (drop+create) policy longgar
--      di atas dengan versi yang terkunci ke UID admin.
--
--  drop policy if exists invitation_update_auth on public.invitation;
--  create policy invitation_update_auth
--    on public.invitation for update to authenticated
--    using (auth.uid() = 'GANTI-DENGAN-UID-ADMIN')
--    with check (auth.uid() = 'GANTI-DENGAN-UID-ADMIN');
--
--  drop policy if exists invitation_insert_auth on public.invitation;
--  create policy invitation_insert_auth
--    on public.invitation for insert to authenticated
--    with check (auth.uid() = 'GANTI-DENGAN-UID-ADMIN');
--
--  drop policy if exists rsvp_select_admin on public.rsvp;
--  create policy rsvp_select_admin
--    on public.rsvp for select to authenticated
--    using (auth.uid() = 'GANTI-DENGAN-UID-ADMIN');
-- ================================================================


-- ================================================================
--  6. SEED  — pastikan baris singleton invitation id=1 ada.
--     data '{}' berarti "belum diisi"; frontend akan fallback ke
--     window.WEDDING_CONFIG (js/config.js) selama data masih kosong.
-- ================================================================
insert into public.invitation (id, data)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

-- ================================================================
--  7. STORAGE  — bucket foto publik 'photos' (untuk fitur upload foto)
--     ------------------------------------------------------------
--     Bucket ini menampung foto mempelai, sampul, & galeri yang
--     diunggah admin lewat panel. 'public = true' berarti FILE-nya
--     bisa DIBACA siapa saja lewat URL publik — memang perlu, karena
--     tamu undangan (anon) harus bisa menampilkan foto tanpa login.
--
--     Keamanan: hanya user 'authenticated' (admin) yang boleh
--     unggah/ubah/hapus; publik hanya boleh membaca (SELECT).
--     Dijaga oleh policy RLS di storage.objects di bawah.
--
--     Idempoten: ON CONFLICT DO NOTHING + drop-then-create policy,
--     aman dijalankan berulang.
-- ================================================================
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- --- Policy storage.objects khusus bucket 'photos' ---
-- SELECT (baca) : publik — anon + authenticated. File foto bisa dilihat
--                 semua tamu lewat URL publik.
drop policy if exists photos_public_read on storage.objects;
create policy photos_public_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'photos');

-- INSERT (unggah) : hanya authenticated (admin).
drop policy if exists photos_auth_insert on storage.objects;
create policy photos_auth_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'photos');

-- UPDATE (ganti/upsert) : hanya authenticated (admin).
drop policy if exists photos_auth_update on storage.objects;
create policy photos_auth_update
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'photos')
  with check (bucket_id = 'photos');

-- DELETE (hapus) : hanya authenticated (admin).
drop policy if exists photos_auth_delete on storage.objects;
create policy photos_auth_delete
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'photos');


-- ================================================================
--  SELESAI. Langkah berikut:
--   1) Authentication -> MATIKAN "Allow new users to sign up".
--   2) Authentication -> Users -> Add user  (buat akun admin manual).
--   3) Settings -> API -> salin "Project URL" & "anon public key"
--      ke js/supabase-config.js.
-- ================================================================
