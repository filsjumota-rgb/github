// Tresseuses du Cameroun — fonction serveur « premium » (Supabase Edge Function)
//
// Encaisse l'abonnement Premium par Mobile Money (MTN MoMo / Orange Money) via Campay,
// puis accorde le Premium uniquement après avoir vérifié le paiement auprès de Campay.
//
// Secrets à créer dans Supabase > Edge Functions > Secrets :
//   CAMPAY_USERNAME   identifiant de l'application Campay (« App Username »)
//   CAMPAY_PASSWORD   mot de passe de l'application Campay (« App Password »)
//   CAMPAY_BASE       https://demo.campay.net/api  (tests)  ou  https://www.campay.net/api  (réel)
//   PREMIUM_PRIX      prix en FCFA, par ex. 2000   (en mode test Campay, utilisez un petit montant)
//   PREMIUM_JOURS     durée en jours, par ex. 30   (facultatif, 30 par défaut)
// SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement.
//
// Actions (corps JSON) :
//   { action: "info" }                      -> { prix, jours, premium_until }
//   { action: "start", telephone }          -> { reference, ussd_code, operator }
//   { action: "check", reference }          -> { statut, premium_until }

import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

const env = (k: string, d = "") => Deno.env.get(k) ?? d;
const BASE = env("CAMPAY_BASE", "https://demo.campay.net/api").replace(/\/+$/, "");
const PRIX = Math.round(Number(env("PREMIUM_PRIX", "2000")));
const JOURS = Math.round(Number(env("PREMIUM_JOURS", "30")));

async function campayToken(): Promise<string> {
  const r = await fetch(BASE + "/token/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: env("CAMPAY_USERNAME"), password: env("CAMPAY_PASSWORD") }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.token) throw new Error("Connexion à Campay impossible (identifiants de l'application ?)");
  return d.token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  // Qui appelle ? (session de la tresseuse connectée)
  const asUser = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: "Connectez-vous d'abord." }, 401);

  // Client « serveur » : seul autorisé à écrire abonnements et paiements
  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const body = await req.json().catch(() => ({}));

  const premiumUntil = async () => {
    const { data } = await admin.from("abonnements").select("premium_until").eq("tresseuse_id", user.id).maybeSingle();
    return data?.premium_until ?? null;
  };

  try {
    if (body.action === "info") {
      return json({ prix: PRIX, jours: JOURS, premium_until: await premiumUntil() });
    }

    if (body.action === "start") {
      const tel = String(body.telephone ?? "").replace(/\D/g, "").replace(/^237(?=\d{9}$)/, "");
      if (!/^6\d{8}$/.test(tel)) return json({ error: "Numéro Mobile Money invalide : 9 chiffres commençant par 6." }, 400);
      const { data: profil } = await admin.from("tresseuses").select("id").eq("id", user.id).maybeSingle();
      if (!profil) return json({ error: "Publiez d'abord votre profil." }, 400);

      // Anti-abus : pas plus de 3 demandes de paiement en 10 minutes, ni 10 par jour,
      // pour qu'un compte ne puisse pas envoyer des demandes Mobile Money en boucle à n'importe quel numéro.
      const depuis = (min: number) => new Date(Date.now() - min * 60000).toISOString();
      const { count: recent } = await admin.from("paiements").select("reference", { count: "exact", head: true })
        .eq("tresseuse_id", user.id).gte("created_at", depuis(10));
      const { count: jour } = await admin.from("paiements").select("reference", { count: "exact", head: true })
        .eq("tresseuse_id", user.id).gte("created_at", depuis(1440));
      if ((recent ?? 0) >= 3 || (jour ?? 0) >= 10) {
        return json({ error: "Trop de demandes de paiement. Attendez quelques minutes avant de réessayer." }, 429);
      }

      const token = await campayToken();
      const r = await fetch(BASE + "/collect/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Token " + token },
        body: JSON.stringify({
          amount: String(PRIX),
          currency: "XAF",
          from: "237" + tel,
          description: `Premium Tresseuses du Cameroun (${JOURS} jours)`,
          external_reference: crypto.randomUUID(),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.reference) {
        return json({ error: "Campay a refusé la demande de paiement. " + (d.message || d.detail || "") }, 502);
      }
      await admin.from("paiements").insert({
        reference: d.reference, tresseuse_id: user.id, montant: PRIX, telephone: tel,
      });
      return json({ reference: d.reference, ussd_code: d.ussd_code ?? null, operator: d.operator ?? null });
    }

    if (body.action === "check") {
      const ref = String(body.reference ?? "");
      const { data: p } = await admin.from("paiements").select("*").eq("reference", ref).eq("tresseuse_id", user.id).maybeSingle();
      if (!p) return json({ error: "Paiement introuvable." }, 404);
      if (p.traite) return json({ statut: "SUCCESSFUL", premium_until: await premiumUntil() });

      const token = await campayToken();
      const r = await fetch(`${BASE}/transaction/${encodeURIComponent(ref)}/`, {
        headers: { Authorization: "Token " + token },
      });
      const t = await r.json().catch(() => ({}));
      const statut = String(t.status ?? "PENDING").toUpperCase();

      if (statut === "SUCCESSFUL" && Number(t.amount) >= p.montant) {
        // Marque le paiement comme traité une seule fois (protège contre une double prolongation)
        const { data: claimed } = await admin.from("paiements")
          .update({ statut, traite: true }).eq("reference", ref).eq("traite", false).select("reference");
        if (claimed && claimed.length) {
          const current = await premiumUntil();
          const start = Math.max(Date.now(), current ? Date.parse(current) : 0);
          const until = new Date(start + JOURS * 864e5).toISOString();
          await admin.from("abonnements").upsert({ tresseuse_id: user.id, premium_until: until, updated_at: new Date().toISOString() });
        }
        return json({ statut: "SUCCESSFUL", premium_until: await premiumUntil() });
      }
      if (statut === "FAILED") await admin.from("paiements").update({ statut }).eq("reference", ref);
      return json({ statut: statut === "FAILED" ? "FAILED" : "PENDING" });
    }

    return json({ error: "Action inconnue." }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erreur inattendue." }, 500);
  }
});
