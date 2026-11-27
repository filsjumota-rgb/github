// Tresseuses du Cameroun — fonction serveur « notifier » (Supabase Edge Function)
//
// Envoie une notification Telegram à l'administratrice quand :
//   - une tresseuse crée son profil        { type: "tresseuse", id: <uuid> }
//   - une cliente laisse un avis           { type: "avis",      id: <nombre> }
//   - un paiement Premium est réussi       { type: "paiement",  id: <référence Campay> }
//   - chaque soir : le résumé de la journée { type: "resume" }
// Elle est appelée par la base de données (script 07-notifications.sql), jamais par le site.
//
// Secrets à créer dans Supabase > Edge Functions > Secrets :
//   TELEGRAM_BOT_TOKEN   le jeton donné par @BotFather
//   TELEGRAM_CHAT_ID     votre numéro de discussion Telegram
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement.
//
// Sécurité : la fonction ne fait jamais confiance au contenu de la requête. Elle relit
// l'élément dans la base, n'envoie qu'une seule notification par élément (table
// « notifications ») et ignore les éléments de plus de 24 h. Un inconnu qui l'appellerait
// ne peut donc ni inventer une notification, ni vous en envoyer en boucle.

import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const env = (k: string) => Deno.env.get(k) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
const ok = (msg: string, status = 200) => new Response(msg, { status });
const UN_JOUR = 24 * 3600 * 1000;
const recent = (iso: string) => Date.now() - new Date(iso).getTime() < UN_JOUR;
const court = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

// Une seule notification par élément : renvoie false si elle a déjà été envoyée.
async function reserver(cle: string): Promise<boolean> {
  const { error } = await db.from("notifications").insert({ cle });
  return !error;
}

async function telegram(texte: string) {
  const r = await fetch(`https://api.telegram.org/bot${env("TELEGRAM_BOT_TOKEN")}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env("TELEGRAM_CHAT_ID"), text: texte, disable_web_page_preview: true }),
  });
  if (!r.ok) console.error("Telegram a refusé le message :", r.status, await r.text());
}

async function compter(table: string, filtre?: (q: any) => any): Promise<number> {
  let q = db.from(table).select("*", { count: "exact", head: true });
  if (filtre) q = filtre(q);
  const { count } = await q;
  return count ?? 0;
}

async function nomTresseuse(id: string): Promise<string> {
  const { data } = await db.from("tresseuses").select("nom").eq("id", id).maybeSingle();
  return data?.nom ?? "une tresseuse";
}

async function nouvelleTresseuse(id: string) {
  const { data: t } = await db.from("tresseuses").select("nom, ville, quartier, tel, styles, created_at").eq("id", id).maybeSingle();
  if (!t || !recent(t.created_at) || !(await reserver("tresseuse-" + id))) return;
  const total = await compter("tresseuses");
  const offres = await compter("offres_lancement");
  const places = Math.max(0, 75 - offres);
  await telegram(
    `🆕 Nouvelle tresseuse inscrite\n\n` +
      `👩🏾 ${t.nom}\n📍 ${t.ville}${t.quartier ? ", " + t.quartier : ""}\n` +
      `💇🏾‍♀️ ${Array.isArray(t.styles) ? t.styles.length : 0} style(s) indiqué(s)\n` +
      `📲 WhatsApp : +237 ${t.tel}\n\n` +
      `Total : ${total} tresseuse(s) · Places Premium offertes restantes : ${places}`,
  );
}

async function nouvelAvis(id: string) {
  const { data: a } = await db.from("avis").select("tresseuse_id, auteur, note, commentaire, created_at").eq("id", Number(id)).maybeSingle();
  if (!a || !recent(a.created_at) || !(await reserver("avis-" + id))) return;
  const nom = await nomTresseuse(a.tresseuse_id);
  await telegram(
    `⭐ Nouvel avis : ${"★".repeat(a.note)}${"☆".repeat(5 - a.note)} (${a.note}/5)\n\n` +
      `Pour : ${nom}\nDe : ${a.auteur}\n` +
      (a.commentaire ? `« ${court(a.commentaire, 300)} »` : "(sans commentaire)"),
  );
}

async function nouveauPaiement(ref: string) {
  const { data: p } = await db.from("paiements").select("tresseuse_id, montant, statut, created_at").eq("reference", ref).maybeSingle();
  if (!p || p.statut !== "SUCCESSFUL" || !recent(p.created_at) || !(await reserver("paiement-" + ref))) return;
  const nom = await nomTresseuse(p.tresseuse_id);
  const { data: s } = await db.from("paiements").select("montant").eq("statut", "SUCCESSFUL");
  const cumul = (s ?? []).reduce((n: number, x: { montant: number }) => n + (x.montant ?? 0), 0);
  await telegram(
    `💰 Paiement Premium reçu !\n\n${nom} a payé ${p.montant} FCFA.\n` +
      `Total encaissé depuis le début : ${cumul} FCFA`,
  );
}

async function resume() {
  // Date du jour à Douala (UTC+1)
  const douala = new Date(Date.now() + 3600 * 1000);
  const jour = douala.toISOString().slice(0, 10);
  if (!(await reserver("resume-" + jour))) return;
  const debut = new Date(jour + "T00:00:00+01:00").toISOString();
  const depuis = (q: any) => q.gte("created_at", debut);
  const [inscrites, total, vues, whatsapp, appels, avis, paiements] = await Promise.all([
    compter("tresseuses", depuis),
    compter("tresseuses"),
    compter("evenements", (q) => depuis(q).eq("type", "vue")),
    compter("evenements", (q) => depuis(q).eq("type", "whatsapp")),
    compter("evenements", (q) => depuis(q).eq("type", "appel")),
    compter("avis", depuis),
    compter("paiements", (q) => depuis(q).eq("statut", "SUCCESSFUL")),
  ]);
  const date = douala.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  await telegram(
    `📊 Résumé du ${date}\n\n` +
      `🆕 Nouvelles tresseuses : ${inscrites} (total ${total})\n` +
      `👀 Profils vus : ${vues}\n` +
      `💬 Clics WhatsApp : ${whatsapp}\n` +
      `📞 Appels : ${appels}\n` +
      `⭐ Avis : ${avis}\n` +
      `💰 Paiements Premium : ${paiements}`,
  );
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return ok("ok");
  let body: { type?: string; id?: string | number } = {};
  try { body = await req.json(); } catch { return ok("json invalide", 400); }
  const id = String(body.id ?? "").slice(0, 100);
  try {
    if (body.type === "tresseuse" && id) await nouvelleTresseuse(id);
    else if (body.type === "avis" && /^\d+$/.test(id)) await nouvelAvis(id);
    else if (body.type === "paiement" && id) await nouveauPaiement(id);
    else if (body.type === "resume") await resume();
    else if (body.type === "test") {
      // Message d'essai : au plus un toutes les 10 minutes
      if (await reserver("test-" + Math.floor(Date.now() / 600000))) {
        await telegram("✅ Les notifications de Tresseuses du Cameroun fonctionnent !");
      }
    }
  } catch (e) {
    console.error(e);
  }
  return ok("ok");
});
