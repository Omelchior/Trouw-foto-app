-- Migratie 018: video's uploaden (alleen via de galerij).
-- Run ONCE in de Supabase SQL Editor (na 001-017).
--
-- Gasten kunnen op de galerij-pagina naast foto's ook korte video's delen.
-- Opdracht-uploads blijven foto's; video's krijgen dus nooit een challenge_id.
--
-- De kolom media_type onderscheidt beide in de app:
--   'foto'  -> laten zien met <img> (ook in de diavoorstelling)
--   'video' -> laten zien met <video>; niet mee in de diavoorstelling

alter table public.photos
  add column if not exists media_type text not null default 'foto';

-- Bestaande rijen zijn allemaal foto's; voor de zekerheid alsnog op extensie.
update public.photos
   set media_type = 'video'
 where media_type <> 'video'
   and lower(storage_path) ~ '\.(mp4|mov|m4v|webm|avi|3gp|mkv|quicktime)$';

alter table public.photos
  drop constraint if exists photos_media_type_check;
alter table public.photos
  add constraint photos_media_type_check check (media_type in ('foto', 'video'));

create index if not exists idx_photos_media_type on public.photos(media_type);

-- ============================================================
-- Storage: ruimte voor video-bestanden
-- ============================================================
-- Foto's worden in de browser gecomprimeerd (max ~2400px), video's niet. Het
-- bestandslimiet van de bucket gaat daarom naar 100 MB.
--
-- LET OP: de bucket kan niet boven het projectbrede uploadlimiet uit. Staat dat
-- nog op de standaard 50 MB, zet het dan eerst hoger via
-- Dashboard -> Settings -> Storage -> "Upload file size limit"
-- (en pas dan MAX_VIDEO_SIZE in lib/foto-upload.ts aan als je iets anders wilt).
update storage.buckets
   set file_size_limit = 104857600 -- 100 MB
 where id = 'wedding-photos';
