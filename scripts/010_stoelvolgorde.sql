-- Migration 010: stoelvolgorde per tafel
-- Run ONCE in the Supabase SQL Editor (after 001-009).
--
-- `stoel` bepaalt de volgorde van de gasten RONDOM een ronde tafel
-- (0 = eerste stoel bovenaan, met de klok mee). Los van `tafel`, zodat
-- je gasten binnen een tafel kunt herschikken zonder de tafel te wijzigen.

alter table public.guests add column if not exists stoel integer;
