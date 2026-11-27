-- Tresseuses du Cameroun — renforcement de la sécurité
-- À exécuter une fois, après les scripts 01 à 05. Peut être relancé sans risque.

-- 1. Dates gérées par le serveur.
--    Sans ça, une tresseuse pourrait mettre une fausse date « updated_at » dans le futur
--    pour rester toujours en haut de la liste « Profils récents ».
create or replace function public.dates_serveur() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists dates_serveur on public.tresseuses;
create trigger dates_serveur before insert or update on public.tresseuses
  for each row execute function public.dates_serveur();

-- 2. Les photos d'un profil doivent venir de son propre dossier.
--    Sans ça, une tresseuse pourrait afficher sur son profil les photos d'une autre.
create or replace function public.photos_du_profil(p_id uuid, p_photos text[]) returns boolean
language sql immutable as $$
  select coalesce(bool_and(p like p_id::text || '/%' and p not like '%..%'), true)
  from unnest(p_photos) as p
$$;

alter table public.tresseuses drop constraint if exists photos_dans_son_dossier;
alter table public.tresseuses add constraint photos_dans_son_dossier
  check (public.photos_du_profil(id, photos));

-- 3. Limite anti-spam sur les avis (laissés sans compte) :
--    au plus 5 avis par tresseuse en 10 minutes, et 30 par jour.
create or replace function public.limite_avis() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from avis where tresseuse_id = new.tresseuse_id
        and created_at > now() - interval '10 minutes') >= 5
     or (select count(*) from avis where tresseuse_id = new.tresseuse_id
        and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Trop d''avis récents pour ce profil. Réessayez plus tard.';
  end if;
  new.created_at := now();
  return new;
end $$;

drop trigger if exists limite_avis on public.avis;
create trigger limite_avis before insert on public.avis
  for each row execute function public.limite_avis();

-- 4. Limite anti-gonflage des statistiques :
--    au-delà de 300 événements par profil et par heure, les suivants sont ignorés.
create or replace function public.limite_evenements() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from evenements where tresseuse_id = new.tresseuse_id
        and created_at > now() - interval '1 hour') >= 300 then
    return null;  -- ignoré sans erreur
  end if;
  new.created_at := now();
  return new;
end $$;

drop trigger if exists limite_evenements on public.evenements;
create trigger limite_evenements before insert on public.evenements
  for each row execute function public.limite_evenements();

-- 5. Les fonctions internes ne sont pas appelables depuis le site
revoke execute on function public.dates_serveur() from anon, authenticated, public;
revoke execute on function public.limite_avis() from anon, authenticated, public;
revoke execute on function public.limite_evenements() from anon, authenticated, public;
revoke execute on function public.offrir_premium_lancement() from anon, authenticated, public;
