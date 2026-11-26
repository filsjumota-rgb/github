-- Tresseuses du Cameroun — liste de rappels de fin de Premium (pour vous, l'administrateur)
-- À exécuter une fois, après 03-premium.sql et 02-statistiques.sql. Peut être relancé sans risque.
--
-- Pour voir la liste : Supabase > SQL Editor > New query >
--     select * from rappels_premium;
-- > Run. Chaque ligne = une tresseuse dont le Premium se termine dans les 7 prochains jours
-- (ou s'est terminé il y a moins de 7 jours), avec un lien WhatsApp et un message prêt à copier
-- qui contient ses statistiques des 30 derniers jours.
--
-- Cette liste n'est PAS visible depuis le site : seul vous, dans le tableau de bord Supabase, la voyez.

create or replace view public.rappels_premium with (security_invoker = true) as
select
  t.nom,
  t.ville,
  '+237 ' || t.tel                                                         as whatsapp,
  to_char(ab.premium_until at time zone 'Africa/Douala', 'DD/MM/YYYY')      as fin_premium,
  (ab.premium_until at time zone 'Africa/Douala')::date
    - (now() at time zone 'Africa/Douala')::date                            as jours_restants,
  coalesce(s.vues, 0)     as vues_30j,
  coalesce(s.whatsapp, 0) as clics_whatsapp_30j,
  'https://wa.me/237' || t.tel                                              as lien_whatsapp,
  'Bonjour ' || t.nom || ', votre Premium sur Tresseuses du Cameroun '
    || case when ab.premium_until < now() then 's''est terminé le ' else 'se termine le ' end
    || to_char(ab.premium_until at time zone 'Africa/Douala', 'DD/MM/YYYY') || '. '
    || 'Ce mois-ci, votre profil a été vu ' || coalesce(s.vues, 0) || ' fois et '
    || coalesce(s.whatsapp, 0) || ' clientes ont cliqué pour vous écrire sur WhatsApp. '
    || 'Pour rester en tête des résultats, prolongez votre Premium sur https://tresseuses237.com '
    || '(Je suis tresseuse > Premium). Merci !'                             as message_a_envoyer
from public.abonnements ab
join public.tresseuses t on t.id = ab.tresseuse_id
left join lateral (
  select count(*) filter (where e.type = 'vue')      as vues,
         count(*) filter (where e.type = 'whatsapp') as whatsapp
  from public.evenements e
  where e.tresseuse_id = t.id and e.created_at > now() - interval '30 days'
) s on true
where ab.premium_until between now() - interval '7 days' and now() + interval '7 days'
order by ab.premium_until;

-- Réservé au tableau de bord : jamais lisible depuis le site
revoke all on public.rappels_premium from anon, authenticated;
