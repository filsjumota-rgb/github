-- Tableau de bord de la propriétaire (lecture seule : ne modifie rien).
-- À coller dans Supabase > SQL Editor > New query, puis « Run ».
select
  (select count(*) from public.tresseuses)                                                        as "Tresseuses inscrites",
  (select count(*) from public.tresseuses where created_at > now() - interval '7 days')           as "Nouvelles (7 jours)",
  (select count(*) from public.evenements where type = 'vue'      and created_at > now() - interval '7 days')  as "Vues de profils (7 jours)",
  (select count(*) from public.evenements where type = 'whatsapp' and created_at > now() - interval '7 days')  as "Clics WhatsApp (7 jours)",
  (select count(*) from public.evenements where type = 'appel'    and created_at > now() - interval '7 days')  as "Appels (7 jours)",
  (select count(*) from public.evenements where type = 'vue'      and created_at > now() - interval '30 days') as "Vues de profils (30 jours)",
  (select count(*) from public.evenements where type = 'whatsapp' and created_at > now() - interval '30 days') as "Clics WhatsApp (30 jours)",
  (select count(*) from public.avis)                                                              as "Avis laissés",
  (select count(*) from public.abonnements where premium_until > now())                           as "Premium actifs",
  (select count(*) from public.paiements where statut = 'SUCCESSFUL')                             as "Paiements réussis",
  (select coalesce(sum(montant), 0) from public.paiements where statut = 'SUCCESSFUL')            as "Total encaissé (FCFA)";
