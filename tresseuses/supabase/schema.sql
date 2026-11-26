-- Tresseuses du Cameroun — base de données Supabase
-- À coller en entier dans Supabase > SQL Editor > New query, puis "Run".
-- Le script peut être relancé sans risque.

-- 1. Profils des tresseuses (un profil par compte)
create table if not exists public.tresseuses (
  id           uuid primary key references auth.users(id) on delete cascade,
  nom          text not null check (char_length(nom) between 2 and 60),
  ville        text not null check (char_length(ville) <= 40),
  quartier     text not null default '' check (char_length(quartier) <= 60),
  tel          text not null check (tel ~ '^[62][0-9]{8}$'),
  experience   int  check (experience between 0 and 60),
  dispo        text not null default '' check (char_length(dispo) <= 80),
  domicile     boolean not null default false,
  description  text not null default '' check (char_length(description) <= 400),
  styles       jsonb not null default '[]'::jsonb check (jsonb_typeof(styles) = 'array'),
  photos       text[] not null default '{}' check (coalesce(array_length(photos, 1), 0) <= 8),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.tresseuses enable row level security;

drop policy if exists "Tout le monde lit les profils" on public.tresseuses;
create policy "Tout le monde lit les profils" on public.tresseuses
  for select to anon, authenticated using (true);

drop policy if exists "Une tresseuse crée son profil" on public.tresseuses;
create policy "Une tresseuse crée son profil" on public.tresseuses
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "Une tresseuse modifie son profil" on public.tresseuses;
create policy "Une tresseuse modifie son profil" on public.tresseuses
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Une tresseuse supprime son profil" on public.tresseuses;
create policy "Une tresseuse supprime son profil" on public.tresseuses
  for delete to authenticated using (auth.uid() = id);

-- 2. Avis des clientes (sans compte)
create table if not exists public.avis (
  id            bigint generated always as identity primary key,
  tresseuse_id  uuid not null references public.tresseuses(id) on delete cascade,
  auteur        text not null check (char_length(auteur) between 2 and 40),
  note          int  not null check (note between 1 and 5),
  commentaire   text not null default '' check (char_length(commentaire) <= 500),
  created_at    timestamptz not null default now()
);
create index if not exists avis_tresseuse_idx on public.avis (tresseuse_id, created_at desc);

alter table public.avis enable row level security;

drop policy if exists "Tout le monde lit les avis" on public.avis;
create policy "Tout le monde lit les avis" on public.avis
  for select to anon, authenticated using (true);

drop policy if exists "Tout le monde peut laisser un avis" on public.avis;
create policy "Tout le monde peut laisser un avis" on public.avis
  for insert to anon, authenticated
  with check (tresseuse_id is distinct from auth.uid());  -- pas d'avis sur son propre profil

-- 3. Vue : profils + note moyenne
create or replace view public.tresseuses_notes with (security_invoker = true) as
select t.*,
       coalesce(round(avg(a.note)::numeric, 1), 0) as note_moyenne,
       count(a.id)::int                              as nb_avis
from public.tresseuses t
left join public.avis a on a.tresseuse_id = t.id
group by t.id;

grant select on public.tresseuses_notes to anon, authenticated;

-- 4. Photos des réalisations (dossier = identifiant de la tresseuse)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Une tresseuse ajoute ses photos" on storage.objects;
create policy "Une tresseuse ajoute ses photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Une tresseuse supprime ses photos" on storage.objects;
create policy "Une tresseuse supprime ses photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
