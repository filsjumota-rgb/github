-- Tresseuses du Cameroun — offre de lancement : Premium offert aux premières tresseuses
-- À exécuter une fois, après 03-premium.sql. Peut être relancé sans risque.
--
-- Les N premières tresseuses qui publient leur profil reçoivent J jours de Premium.
-- Une seule fois par compte (supprimer puis recréer son profil ne redonne pas l'offre).
-- Pour changer le nombre de places ou la durée : modifier les deux petites fonctions
-- ci-dessous, puis relancer ce script.

create or replace function public.offre_nb_places() returns int language sql immutable as $$ select 75 $$;
create or replace function public.offre_nb_jours()  returns int language sql immutable as $$ select 37 $$;

-- Qui a déjà reçu l'offre (pas de clé étrangère : la trace reste si le profil est supprimé)
create table if not exists public.offres_lancement (
  tresseuse_id  uuid primary key,
  created_at    timestamptz not null default now()
);
alter table public.offres_lancement enable row level security;  -- aucune règle : illisible depuis le site

-- Déclenché à la création d'un profil
create or replace function public.offrir_premium_lancement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(424242);  -- évite de dépasser le nombre de places si deux inscriptions arrivent en même temps
  if (select count(*) from offres_lancement) >= offre_nb_places() then
    return new;
  end if;
  insert into offres_lancement (tresseuse_id) values (new.id) on conflict do nothing;
  if found then
    insert into abonnements (tresseuse_id, premium_until)
    values (new.id, now() + make_interval(days => offre_nb_jours()))
    on conflict (tresseuse_id) do update
      set premium_until = greatest(abonnements.premium_until, now()) + make_interval(days => offre_nb_jours()),
          updated_at = now();
  end if;
  return new;
end $$;

drop trigger if exists offre_lancement on public.tresseuses;
create trigger offre_lancement after insert on public.tresseuses
  for each row execute function public.offrir_premium_lancement();

-- Nombre de places restantes, lisible par le site pour afficher le bandeau
create or replace function public.places_offertes() returns int
language sql stable security definer set search_path = public as $$
  select greatest(0, offre_nb_places() - (select count(*)::int from offres_lancement))
$$;
grant execute on function public.places_offertes() to anon, authenticated;
