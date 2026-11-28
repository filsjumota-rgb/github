-- Tresseuses du Cameroun — notifications Telegram pour l'administratrice
-- À exécuter une fois, APRÈS avoir installé la fonction « notifier » et ses secrets.
-- Peut être relancé sans risque.
--
-- Ce script ne change rien au fonctionnement du site : il demande seulement à la base
-- de prévenir la fonction « notifier » après chaque nouvelle inscription, nouvel avis,
-- paiement réussi, consultation de profil ou clic WhatsApp / Appeler, et chaque soir à 20 h (heure du Cameroun) pour le résumé.
-- L'envoi se fait en arrière-plan : si Telegram ne répond pas, l'inscription
-- (ou l'avis, ou le paiement) est quand même enregistrée normalement.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Mémoire des notifications déjà envoyées (une seule par élément).
-- Aucune règle d'accès : illisible depuis le site, seule la fonction serveur l'utilise.
create table if not exists public.notifications (
  cle         text primary key,
  envoyee_le  timestamptz not null default now()
);
alter table public.notifications enable row level security;

-- Prévient la fonction « notifier » (en arrière-plan, sans jamais bloquer).
create or replace function public.prevenir(p_type text, p_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    -- nom réel de la fonction dans Supabase : « notifier- » (avec un tiret)
    url     := 'https://exvlootzyvolkkeoxdaz.supabase.co/functions/v1/notifier-',
    body    := jsonb_build_object('type', p_type, 'id', p_id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
exception when others then
  null;  -- une notification ratée ne doit jamais empêcher une inscription
end $$;
revoke all on function public.prevenir(text, text) from public, anon, authenticated;

create or replace function public.notif_tresseuse() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform prevenir('tresseuse', new.id::text); return null; end $$;

create or replace function public.notif_avis() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform prevenir('avis', new.id::text); return null; end $$;

create or replace function public.notif_paiement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.statut = 'SUCCESSFUL' and (tg_op = 'INSERT' or old.statut is distinct from 'SUCCESSFUL') then
    perform prevenir('paiement', new.reference);
  end if;
  return null;
end $$;

create or replace function public.notif_evenement() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform prevenir('evenement', new.id::text); return null; end $$;

drop trigger if exists notif_evenement on public.evenements;
create trigger notif_evenement after insert on public.evenements
  for each row execute function public.notif_evenement();

drop trigger if exists notif_tresseuse on public.tresseuses;
create trigger notif_tresseuse after insert on public.tresseuses
  for each row execute function public.notif_tresseuse();

drop trigger if exists notif_avis on public.avis;
create trigger notif_avis after insert on public.avis
  for each row execute function public.notif_avis();

drop trigger if exists notif_paiement on public.paiements;
create trigger notif_paiement after insert or update of statut on public.paiements
  for each row execute function public.notif_paiement();

-- Résumé chaque soir à 20 h, heure du Cameroun (19 h UTC).
select cron.unschedule(jobid) from cron.job where jobname = 'resume-quotidien';
select cron.schedule('resume-quotidien', '0 19 * * *', $$ select public.prevenir('resume', null) $$);

-- Message d'essai immédiat : vous devez recevoir « Les notifications fonctionnent » sur Telegram.
select public.prevenir('test', null);
