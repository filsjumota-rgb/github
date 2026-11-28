"use strict";
// Tresseuses du Cameroun — traduction français / anglais.
// La langue vient de ?lang=en|fr, sinon du choix mémorisé, sinon de la langue du téléphone.
// Les textes saisis par les tresseuses (présentation, disponibilités…) ne sont pas traduits.

const I18N_EN = {
  // Page (textes fixes du HTML)
  "Trouvez une tresseuse près de chez vous, voyez ses réalisations, ses prix et ses avis, puis écrivez-lui sur WhatsApp.":
    "Find a braider near you, see her work, prices and reviews, then message her on WhatsApp.",
  "Mode démonstration : les profils affichés sont des exemples et rien n'est enregistré. Renseignez": "Demo mode: the profiles shown are examples and nothing is saved. Fill in",
  "pour passer en ligne.": "to go live.",
  "Trouver une tresseuse": "Find a braider",
  "Je suis tresseuse": "I'm a braider",
  "Ville": "City",
  "Toutes les villes": "All cities",
  "Tous les styles": "All styles",
  "Quartier ou nom": "Neighbourhood or name",
  "Se déplace à domicile": "Home visits",
  "Trier par": "Sort by",
  "Profils récents": "Most recent",
  "Mieux notées": "Top rated",
  "Prix le plus bas": "Lowest price",
  "Chargement des tresseuses…": "Loading braiders…",
  "Créer mon compte tresseuse": "Create my braider account",
  "Gratuit. Votre compte sert seulement à modifier votre profil.": "Free. Your account is only used to edit your profile.",
  "Adresse e-mail": "Email address",
  "Mot de passe": "Password",
  "8 caractères minimum, avec des lettres et des chiffres.": "At least 8 characters, with letters and numbers.",
  "J'accepte les": "I accept the",
  "conditions d'utilisation": "terms of use",
  "et la": "and the",
  "politique de confidentialité": "privacy policy",
  "Créer mon compte": "Create my account",
  "J'ai déjà un compte : me connecter": "I already have an account: log in",
  "Voir mon profil public": "View my public profile",
  "Me déconnecter": "Log out",
  "Vos statistiques": "Your statistics",
  "30 derniers jours. Partagez votre lien sur votre statut WhatsApp pour faire monter ces chiffres.":
    "Last 30 days. Share your link on your WhatsApp status to grow these numbers.",
  "Votre profil": "Your profile",
  "Nom affiché": "Display name",
  "Quartier": "Neighbourhood",
  "Numéro WhatsApp": "WhatsApp number",
  "9 chiffres, sans le +237. Les clientes vous écriront à ce numéro.": "9 digits, without +237. Clients will message you on this number.",
  "Années d'expérience": "Years of experience",
  "Disponibilité": "Availability",
  "Je me déplace à domicile": "I do home visits",
  "Présentation": "About",
  "Photos de vos réalisations": "Photos of your work",
  "Jusqu'à 8 photos. Elles sont réduites automatiquement pour économiser les données mobiles.":
    "Up to 8 photos. They are resized automatically to save mobile data.",
  "Ajouter des photos": "Add photos",
  "Vos styles et prix (FCFA)": "Your styles and prices (FCFA)",
  "Cochez ce que vous savez faire. Le prix est indicatif, à partir de.": "Tick what you can do. The price is a starting price.",
  "Publier mon profil": "Publish my profile",
  "Retirer mon profil": "Remove my profile",
  "Votre profil, vos photos et vos avis seront supprimés. Confirmer ?": "Your profile, photos and reviews will be deleted. Confirm?",
  "Oui, supprimer": "Yes, delete",
  "Annuler": "Cancel",
  "Tresseuses du Cameroun · Annuaire gratuit · Les prix sont indiqués par les tresseuses.":
    "Tresseuses du Cameroun · Free directory · Prices are set by the braiders.",
  "Conditions d'utilisation": "Terms of use",
  "Confidentialité": "Privacy",
  // Exemples dans les champs
  "Ex. Bonamoussadi, Mvog-Ada, Aïcha…": "e.g. Molyko, Bonamoussadi, Aïcha…",
  "Ex. Aïcha Tresses": "e.g. Aïcha Braids",
  "Ex. Akwa, Biyem-Assi": "e.g. Molyko, Akwa",
  "Ex. Lun–Sam, 8h–19h": "e.g. Mon–Sat, 8am–7pm",
  "Votre spécialité, votre salon, ce qui vous distingue…": "Your speciality, your salon, what makes you stand out…",

  // Application
  "Copié": "Copied",
  "Sélectionné, copiez-le": "Selected, copy it",
  "Le service Premium ne répond pas.": "The Premium service is not responding.",
  "Pas encore d'avis": "No reviews yet",
  "À domicile": "Home visits",
  "Aucune tresseuse inscrite pour l'instant": "No braiders registered yet",
  "Vous savez tresser ? Créez votre profil gratuitement en 2 minutes.": "Can you braid? Create your free profile in 2 minutes.",
  "Aucun résultat": "No results",
  "Essayez une autre ville ou un autre style.": "Try another city or style.",
  "Impossible de charger l'annuaire": "Could not load the directory",
  "Vérifiez votre connexion internet puis rechargez la page.": "Check your internet connection, then reload the page.",
  "← Toutes les tresseuses": "← All braiders",
  "Chargement…": "Loading…",
  "Impossible de charger ce profil": "Could not load this profile",
  "Ce profil n'existe plus": "This profile no longer exists",
  "La tresseuse a peut-être retiré son profil.": "The braider may have removed her profile.",
  "sur devis": "on request",
  "Qualité, ponctualité, prix respecté…": "Quality, punctuality, price as agreed…",
  "Publier mon avis": "Post my review",
  "Laisser un avis": "Leave a review",
  "Votre note": "Your rating",
  "Votre prénom": "Your first name",
  "Votre avis (facultatif)": "Your review (optional)",
  "Choisissez une note de 1 à 5 étoiles.": "Choose a rating from 1 to 5 stars.",
  "Indiquez votre prénom.": "Enter your first name.",
  "Vous avez déjà laissé un avis à cette tresseuse depuis ce téléphone.": "You have already reviewed this braider from this phone.",
  "Merci ! Votre avis est publié.": "Thank you! Your review is posted.",
  "Vous êtes connectée avec le compte de cette tresseuse : on ne peut pas laisser d'avis sur son propre profil.":
    "You are logged in as this braider: you can't review your own profile.",
  "L'avis n'a pas pu être publié. Vérifiez votre connexion internet et réessayez.":
    "Your review could not be posted. Check your internet connection and try again.",
  "Contacter": "Contact",
  "Écrire sur WhatsApp": "Message on WhatsApp",
  "Appeler": "Call",
  "Copier le numéro": "Copy number",
  "Styles et prix": "Styles and prices",
  "Prix indicatifs donnés par la tresseuse. Mèches non comprises sauf mention.":
    "Indicative prices set by the braider. Hair extensions not included unless stated.",
  "Partager ce profil": "Share this profile",
  "Avis des clientes": "Client reviews",
  "C'est votre profil": "This is your profile",
  "Les avis sont laissés par vos clientes. Partagez le lien de votre profil pour qu'elles puissent vous noter.":
    "Reviews are left by your clients. Share your profile link so they can rate you.",
  "Modifier mon profil": "Edit my profile",
  "Prix": "Price",
  "Me connecter": "Log in",
  "Pas encore de compte : en créer un": "No account yet: create one",
  "Adresse e-mail invalide.": "Invalid email address.",
  "Le mot de passe doit faire au moins 8 caractères, avec des lettres et des chiffres.":
    "The password must be at least 8 characters, with letters and numbers.",
  "Cochez la case pour accepter les conditions d'utilisation.": "Tick the box to accept the terms of use.",
  "E-mail ou mot de passe incorrect.": "Incorrect email or password.",
  "Ce compte existe déjà : connectez-vous.": "This account already exists: log in.",
  "Confirmez d'abord votre adresse avec l'e-mail reçu.": "First confirm your address with the email you received.",
  "Retirer cette photo": "Remove this photo",
  "La photo n'a pas pu être retirée": "The photo could not be removed",
  "Indiquez votre nom (2 caractères minimum).": "Enter your name (at least 2 characters).",
  "Le numéro doit avoir 9 chiffres et commencer par 6 (ex. 6 77 12 34 56).":
    "The number must have 9 digits and start with 6 (e.g. 6 77 12 34 56).",
  "Cochez au moins un style que vous savez faire.": "Tick at least one style you can do.",
  "Mettre à jour mon profil": "Update my profile",
  "Votre profil est en ligne. Partagez son lien sur votre statut WhatsApp pour avoir plus de clientes.":
    "Your profile is online. Share its link on your WhatsApp status to get more clients.",
  "Complétez votre profil puis publiez-le : il sera visible tout de suite.":
    "Complete your profile, then publish it: it will be visible right away.",
  "Vues du profil": "Profile views",
  "Clics WhatsApp": "WhatsApp clicks",
  "Appels": "Calls",
  "Offre de lancement : ": "Launch offer: ",
  "Je m'inscris": "Sign me up",
  "Voir l'encadré ★ Premium ci-dessous.": "See the ★ Premium box below.",
  "Passer Premium": "Go Premium",
  "Votre profil apparaît en tête des résultats dans votre ville.": "Your profile appears at the top of the results in your city.",
  "Un badge « ★ Premium » sur votre fiche et dans la liste.": "A “★ Premium” badge on your profile and in the list.",
  "Numéro MTN MoMo ou Orange Money qui paie": "MTN MoMo or Orange Money number paying",
  "Numéro invalide : 9 chiffres commençant par 6.": "Invalid number: 9 digits starting with 6.",
  "Gardez cette page ouverte.": "Keep this page open.",
  "Premium activé": "Premium activated",
  "Le paiement a échoué ou a été refusé. Aucun montant n'a été prélevé. Vous pouvez réessayer.":
    "The payment failed or was declined. Nothing was charged. You can try again.",
  "Paiement pas encore confirmé. Si vous l'avez validé, touchez « Vérifier ».": "Payment not confirmed yet. If you approved it, tap “Check”.",
  "Vérifier": "Check",
  "Profil publié": "Profile published",
  "vérifiez votre connexion": "check your connection",
  "Profil supprimé": "Profile deleted",
  "La suppression a échoué. Réessayez.": "Deletion failed. Try again.",
  "Impossible de charger votre profil. Rechargez la page.": "Could not load your profile. Reload the page.",
  // Messages du serveur Premium
  "Connectez-vous d'abord.": "Log in first.",
  "Numéro Mobile Money invalide : 9 chiffres commençant par 6.": "Invalid Mobile Money number: 9 digits starting with 6.",
  "Publiez d'abord votre profil.": "Publish your profile first.",
  "Trop de demandes de paiement. Attendez quelques minutes avant de réessayer.": "Too many payment requests. Wait a few minutes before trying again.",
  "Paiement introuvable.": "Payment not found.",
  "Connexion à Campay impossible (identifiants de l'application ?)": "Could not connect to the payment service.",

  // Textes avec des valeurs {entre accolades}
  "Réalisation de {nom}": "Work by {nom}",
  "À partir de {prix}": "From {prix}",
  "Bonjour {nom}, je vous ai trouvée sur Tresseuses du Cameroun. Je voudrais me faire tresser.":
    "Hello {nom}, I found you on Tresseuses du Cameroun. I would like to get my hair braided.",
  "dès {prix}": "from {prix}",
  "Pas encore d'avis. Vous avez été coiffée par {nom} ? Laissez le premier.": "No reviews yet. Has {nom} done your hair? Leave the first one.",
  "L'avis n'a pas pu être publié ({m}).": "Your review could not be posted ({m}).",
  "Réalisation {i} de {nom}": "Work {i} by {nom}",
  "{note} sur 5": "{note} out of 5",
  "Disponible : {d}": "Available: {d}",
  "{nom} – tresseuse à {ville}": "{nom} – braider in {ville}",
  "Prix pour {s}": "Price for {s}",
  "Compte créé. Ouvrez l'e-mail de confirmation que nous venons d'envoyer à {email}, puis revenez ici pour vous connecter.":
    "Account created. Open the confirmation email we just sent to {email}, then come back here to log in.",
  "Échec : {m}": "Failed: {m}",
  "L'enregistrement a échoué : {m}": "Saving failed: {m}",
  "Connectée : {e}": "Logged in: {e}",
  "Premium actif jusqu'au {date}.": "Premium active until {date}.",
  "{prix} pour {n} jours, sans engagement ni renouvellement automatique.": "{prix} for {n} days, no commitment and no automatic renewal.",
  "Prolonger de {n} jours": "Extend by {n} days",
  "Une demande de paiement a été envoyée au {tel}. Validez-la sur votre téléphone avec votre code secret Mobile Money.":
    "A payment request was sent to {tel}. Approve it on your phone with your Mobile Money PIN.",
  "Si rien ne s'affiche, composez {code}.": "If nothing appears, dial {code}.",
  "Votre Premium se termine dans {n} jours (le {date}). Prolongez-le pour rester en tête des résultats.":
    "Your Premium ends in {n} days ({date}). Extend it to stay at the top of the results.",
  "Votre Premium se termine très bientôt (le {date}). Prolongez-le maintenant pour garder votre place en tête des résultats.":
    "Your Premium ends very soon ({date}). Extend it now to keep your place at the top of the results.",
  "Votre Premium est terminé depuis le {date}. Votre profil n'est plus en tête des résultats : réactivez-le en quelques secondes.":
    "Your Premium ended on {date}. Your profile is no longer at the top of the results: reactivate it in seconds.",
};

// Noms des styles : la valeur enregistrée reste en français, seul l'affichage change
const STYLE_EN = {
  "Tresses collées (nattes)": "Cornrows (tresses collées)",
  "Natte américaine": "American cornrows (natte américaine)",
  "Rasta américaine": "American rasta braids",
  "Rasta classique": "Classic rasta braids",
  "Passe mèche classique": "Classic feed-in braids (passe mèche)",
  "Vanille (twist)": "Twists (vanille)",
  "Bantu knots": "Bantu knots",
  "Crochet braids": "Crochet braids",
  "Box braids": "Box braids",
  "Knotless braids": "Knotless braids",
  "Fulani braids": "Fulani braids",
  "Tresses au fil": "Threading (tresses au fil)",
  "Tresses enfants": "Kids' braids",
  "Cornrows homme": "Men's cornrows",
  "Tissage": "Weave",
  "Lace frontale": "Lace frontal",
  "Pose greffe": "Hair extensions (greffe)",
  "Locks (pose / entretien)": "Locs (install / retwist)",
  "Chignon": "Bun (chignon)",
  "Coiffure au vent": "Natural blowout (coiffure au vent)",
  "Curly": "Curly",
  "Coupe": "Haircut",
  "Brushing": "Blow-dry (brushing)",
  "Shampoing": "Shampoo / wash",
};

const LANG = (() => {
  let l = "";
  try { l = new URLSearchParams(location.search).get("lang") || ""; } catch {}
  if (l === "en" || l === "fr") { try { localStorage.setItem("lang", l); } catch {} return l; }
  try { l = localStorage.getItem("lang") || ""; } catch {}
  if (l === "en" || l === "fr") return l;
  return /^en/i.test(navigator.language || "") ? "en" : "fr";
})();
const LOCALE = LANG === "en" ? "en-GB" : "fr-FR";
document.documentElement.lang = LANG;

// Traduit un texte ; {nom} etc. sont remplacés par les valeurs données
function t(s, p) {
  let r = (LANG === "en" && I18N_EN[s]) || s;
  if (p) r = r.replace(/\{(\w+)\}/g, (m, k) => (k in p ? String(p[k]) : m));
  return r;
}
// Singulier / pluriel ; {n} est remplacé par le nombre
function pl(n, fr1, frN, en1, enN) {
  const s = LANG === "en" ? (n === 1 ? en1 : enN) : (n > 1 ? frN : fr1);
  return s.replace(/\{n\}/g, n);
}
const tStyle = (s) => (LANG === "en" && STYLE_EN[s]) || s;
const tCity = (c) => (LANG === "en" && c === "Autre ville" ? "Other city" : c);

// Traduit les textes fixes de la page (texte, exemples dans les champs, libellés d'accessibilité)
function translateDom(root) {
  if (LANG !== "en") return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (w.nextNode()) nodes.push(w.currentNode);
  for (const n of nodes) {
    const raw = n.nodeValue, key = raw.trim();
    if (key && I18N_EN[key]) n.nodeValue = raw.replace(key, I18N_EN[key]);
  }
  // Liens vers les pages légales : version anglaise
  const LEGAL_EN = { "cgu.html": "cgu-en.html", "confidentialite.html": "privacy.html" };
  root.querySelectorAll("a[href]").forEach(a => { const h = a.getAttribute("href"); if (LEGAL_EN[h]) a.setAttribute("href", LEGAL_EN[h]); });
  for (const a of ["placeholder", "aria-label", "alt", "title"]) {
    root.querySelectorAll("[" + a + "]").forEach(e => { const v = e.getAttribute(a); if (I18N_EN[v]) e.setAttribute(a, I18N_EN[v]); });
  }
}
translateDom(document.body);

// Bouton FR / EN : mémorise le choix et recharge la page à la même place
(() => {
  const b = document.getElementById("lang-btn");
  if (!b) return;
  const other = LANG === "en" ? "fr" : "en";
  b.textContent = other.toUpperCase();
  b.setAttribute("aria-label", other === "en" ? "English version" : "Version française");
  b.addEventListener("click", () => {
    try { localStorage.setItem("lang", other); } catch {}
    const u = new URL(location.href);
    if (u.searchParams.has("lang")) { u.searchParams.delete("lang"); location.replace(u.href); }
    else location.reload();
  });
})();
