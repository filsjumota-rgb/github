-- Tresseuses du Cameroun — abonnement Premium (à exécuter une fois, après schema.sql)
-- Supabase > SQL Editor > New query > coller > Run. Peut être relancé sans risque.
--
-- Seule la fonction serveur « premium » (clé service_role) peut écrire dans ces tables :
-- une tresseuse ne peut pas s'accorder le Premium elle-même.

-- 1. Date de fin du Premium de chaque tresseuse (lisible par tous pour afficher le badge)
create table if not exists public.abonnements (
  tresseuse_id   uuid primary key references public.tresseuses(id) on delete cascade,
  premium_until  timestamptz not null,
  updated_at     timestamptz not null default now()
);
alter table public.abonnements enable row level security;
drop policy if exists "Tout le monde lit les abonnements" on public.abonnements;
create policy "Tout le monde lit les abonnements" on public.abonnements
  for select to anon, authenticated using (true);
grant select on public.abonnements to anon, authenticated;

-- 2. Historique des paiements Mobile Money (chaque tresseuse ne voit que les siens)
create table if not exists public.paiements (
  reference     text primary key,                 -- référence Campay
  tresseuse_id  uuid not null references public.tresseuses(id) on delete cascade,
  montant       int  not null,
  telephone     text not null,
  statut        text not null default 'PENDING',  -- PENDING, SUCCESSFUL, FAILED
  traite        boolean not null default false,   -- Premium déjà accordé pour ce paiement
  created_at    timestamptz not null default now()
);
alter table public.paiements enable row level security;
drop policy if exists "Une tresseuse lit ses paiements" on public.paiements;
create policy "Une tresseuse lit ses paiements" on public.paiements
  for select to authenticated using (auth.uid() = tresseuse_id);
grant select on public.paiements to authenticated;

-- 3. La vue publique des profils ajoute la date de fin du Premium (colonne ajoutée en dernier)
create or replace view public.tresseuses_notes with (security_invoker = true) as
select t.*,
       coalesce(round(avg(a.note)::numeric, 1), 0) as note_moyenne,
       count(a.id)::int                              as nb_avis,
       (select ab.premium_until from public.abonnements ab where ab.tresseuse_id = t.id) as premium_until
from public.tresseuses t
left join public.avis a on a.tresseuse_id = t.id
group by t.id;
grant select on public.tresseuses_notes to anon, authenticated;
