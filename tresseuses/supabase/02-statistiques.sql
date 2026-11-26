-- Tresseuses du Cameroun — statistiques de clics (à exécuter une fois, après schema.sql)
-- Supabase > SQL Editor > New query > coller > Run. Peut être relancé sans risque.

create table if not exists public.evenements (
  id            bigint generated always as identity primary key,
  tresseuse_id  uuid not null references public.tresseuses(id) on delete cascade,
  type          text not null check (type in ('vue', 'whatsapp', 'appel')),
  created_at    timestamptz not null default now()
);
create index if not exists evenements_idx on public.evenements (tresseuse_id, type, created_at);

alter table public.evenements enable row level security;

-- Tout visiteur peut enregistrer une visite ou un clic (sauf sur son propre profil)
drop policy if exists "Tout le monde enregistre un événement" on public.evenements;
create policy "Tout le monde enregistre un événement" on public.evenements
  for insert to anon, authenticated
  with check (type in ('vue', 'whatsapp', 'appel') and tresseuse_id is distinct from auth.uid());

-- Chaque tresseuse ne lit que ses propres statistiques
drop policy if exists "Une tresseuse lit ses statistiques" on public.evenements;
create policy "Une tresseuse lit ses statistiques" on public.evenements
  for select to authenticated using (auth.uid() = tresseuse_id);

grant insert on public.evenements to anon, authenticated;
grant select on public.evenements to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
