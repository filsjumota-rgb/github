# Tresseuses du Cameroun

Annuaire gratuit où les tresseuses publient leurs styles, prix, photos et disponibilités, et où les clientes les trouvent par ville, style ou quartier, lisent les avis et les contactent sur WhatsApp.

- `site/` : le site (HTML, CSS, JavaScript, sans compilation)
- `supabase/schema.sql` : la base de données, les règles de sécurité et le stockage des photos
- `index.html` : le premier prototype sur claude.ai

Tant que `site/config.js` est vide, le site tourne en **mode démonstration** : les profils sont des exemples et rien n'est enregistré.

## Mise en ligne (environ 15 minutes, gratuit)

### 1. Créer la base de données (Supabase)
1. Créez un compte sur https://supabase.com, puis **New project**. Choisissez la région la plus proche (Europe, par exemple Frankfurt ou Paris) et notez le mot de passe.
2. Ouvrez **SQL Editor → New query**, collez tout le contenu de `supabase/schema.sql`, puis cliquez sur **Run**.
3. Ouvrez **Project Settings → API** et copiez la **Project URL** et la clé **anon public**.
4. Collez ces deux valeurs dans `site/config.js`.

### 2. Régler les comptes des tresseuses
Dans **Authentication → URL Configuration**, mettez l'adresse du site (étape 3) dans **Site URL**.

Par défaut, Supabase envoie un e-mail de confirmation à chaque nouveau compte. Le service d'e-mail gratuit est limité à quelques messages par heure. Deux possibilités :
- **Plus simple pour démarrer** : dans **Authentication → Sign In / Providers → Email**, décochez **Confirm email**. Les tresseuses sont connectées dès l'inscription.
- **Plus sûr** : gardez la confirmation et branchez un service d'e-mail (Resend, Brevo…) dans **Authentication → SMTP Settings**.

### 3. Publier le site (GitHub Pages)
1. Sur GitHub, ouvrez le dépôt, puis **Settings → Pages → Source : GitHub Actions**.
2. Fusionnez cette branche dans `main`. Le workflow `.github/workflows/tresseuses-pages.yml` publie automatiquement le dossier `site/`.
3. L'adresse s'affiche dans **Actions** et dans **Settings → Pages**. Elle ressemble à `https://<compte>.github.io/github/`.

Si vous voulez un nom de domaine à vous (par exemple `tresseuses.cm`), vous pouvez l'ajouter ensuite dans **Settings → Pages → Custom domain**.

Vous pouvez aussi glisser le dossier `site/` sur https://app.netlify.com/drop.

## Statistiques
Exécuter une fois `supabase/02-statistiques.sql` dans le SQL Editor.

## Premium (Mobile Money via Campay)
Les tresseuses peuvent payer un abonnement Premium (en tête des résultats + badge « ★ Premium »). Le paiement est demandé et **vérifié côté serveur** par la fonction `supabase/functions/premium/index.ts` ; une tresseuse ne peut pas s'accorder le Premium elle-même.

1. Exécuter `supabase/03-premium.sql` dans le SQL Editor.
2. Supabase → **Edge Functions → Deploy a new function → Via Editor** : nom `premium`, coller le contenu de `supabase/functions/premium/index.ts`, **Deploy**.
3. Supabase → **Edge Functions → Secrets**, ajouter :
   - `CAMPAY_USERNAME` et `CAMPAY_PASSWORD` : identifiants de l'application, dans le tableau de bord Campay (rubrique des applications / clés API) ;
   - `CAMPAY_BASE` : `https://demo.campay.net/api` pour les tests, puis `https://www.campay.net/api` en réel ;
   - `PREMIUM_PRIX` : le prix en FCFA (petit montant pour les tests, par ex. 25) ;
   - `PREMIUM_JOURS` : `30`.
4. Tester depuis l'espace tresseuse, encart « ★ Premium ». Tant que la fonction n'est pas installée, l'encart reste masqué.

Ne jamais mettre les identifiants Campay dans le code ni dans `config.js` : seulement dans les secrets Supabase.

## Modération
Le propriétaire du projet Supabase voit et peut supprimer tous les profils et avis dans **Table Editor** (tables `tresseuses` et `avis`). N'importe qui peut laisser un avis sans compte. Le site empêche un même téléphone d'en laisser deux à la même tresseuse, mais ce n'est pas une protection forte : surveillez les avis au début.

## Sécurité
La clé `anon` est publique par conception. Les règles de `schema.sql` font que tout le monde peut lire les profils et les avis, mais chaque tresseuse ne peut créer, modifier ou supprimer que son propre profil et ses propres photos.
