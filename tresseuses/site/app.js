"use strict";
// Tresseuses du Cameroun — application (vanilla JS, aucune compilation nécessaire)

const VILLES = ["Douala","Yaoundé","Bafoussam","Bamenda","Garoua","Maroua","Ngaoundéré","Bertoua","Ebolowa","Kribi","Limbé","Buea","Kumba","Dschang","Nkongsamba","Edéa","Autre ville"];
const STYLES = ["Nattes collées","Box braids","Knotless braids","Vanilles (twists)","Fulani braids","Crochet braids","Tresses au fil","Tissage","Locks (pose / entretien)","Tresses enfants","Cornrows homme"];
const MAX_PHOTOS = 8;

/* ---------- Petits outils ---------- */
const $ = (id) => document.getElementById(id);
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids) if (k != null && k !== false) n.append(k);
  return n;
}
const fcfa = (n) => new Intl.NumberFormat(LOCALE).format(n) + " FCFA";
const fmtTel = (t) => t.replace(/(\d)(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5");
const stars = (n) => "★★★★★".slice(0, Math.round(n)) + "☆☆☆☆☆".slice(0, 5 - Math.round(n));
const dateFr = (iso) => { try { return new Date(iso).toLocaleDateString(LOCALE, { day: "numeric", month: "long", year: "numeric" }); } catch { return ""; } };
const fmtNote = (n) => n.toFixed(1).replace(".", LANG === "en" ? "." : ",");
const minPrix = (p) => { const v = p.styles.map(s => s.prix).filter(x => x > 0); return v.length ? Math.min(...v) : null; };
function toast(msg) { const box = $("toast"); box.textContent = t(msg); box.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => (box.hidden = true), 2800); }
function notice(box, text, kind) { box.replaceChildren(text ? el("div", { class: "notice" + (kind ? " " + kind : ""), text }) : ""); }
async function copy(text, fallbackNode) {
  try { await navigator.clipboard.writeText(text); toast("Copié"); }
  catch { if (fallbackNode) { const r = document.createRange(); r.selectNodeContents(fallbackNode); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } toast("Sélectionné, copiez-le"); }
}

// Nettoie un profil venant de la base (les données sont saisies par des inconnus)
function clean(d) {
  if (!d || typeof d !== "object") return null;
  const str = (x, n) => (typeof x === "string" ? x.slice(0, n) : "");
  const tel = str(d.tel, 20).replace(/\D/g, "");
  if (!str(d.nom, 60) || tel.length !== 9) return null;
  const styles = Array.isArray(d.styles) ? d.styles.filter(s => s && typeof s.nom === "string").slice(0, 30)
    .map(s => ({ nom: s.nom.slice(0, 40), prix: Number.isFinite(s.prix) && s.prix > 0 ? Math.round(s.prix) : null })) : [];
  return {
    id: String(d.id), nom: str(d.nom, 60), ville: str(d.ville, 40), quartier: str(d.quartier, 60), tel,
    experience: Number.isFinite(d.experience) ? d.experience : null, dispo: str(d.dispo, 80), domicile: d.domicile === true,
    description: str(d.description, 400), styles, photos: Array.isArray(d.photos) ? d.photos.filter(x => typeof x === "string").slice(0, MAX_PHOTOS) : [],
    note: Number(d.note_moyenne) || 0, nbAvis: Number(d.nb_avis) || 0, updated_at: str(d.updated_at, 40),
    premium: typeof d.premium_until === "string" && Date.parse(d.premium_until) > Date.now(),
  };
}

// Réduit une photo à 1280 px max en JPEG (≈ 150–300 Ko) pour économiser les données mobiles
async function compress(file) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close && bmp.close();
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error("compression"))), "image/jpeg", 0.8));
}

/* ---------- Accès aux données : Supabase en ligne, ou démo locale ---------- */
const CFG = window.TRESSES_CONFIG || {};
const LIVE = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase);
const api = LIVE ? liveApi(window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey)) : demoApi();

function liveApi(sb) {
  const must = ({ data, error }) => { if (error) throw error; return data; };
  return {
    live: true,
    async list() { return must(await sb.from("tresseuses_notes").select("*").order("updated_at", { ascending: false }).limit(1000)); },
    async get(id) { return must(await sb.from("tresseuses_notes").select("*").eq("id", id).maybeSingle()); },
    async reviews(id) { return must(await sb.from("avis").select("*").eq("tresseuse_id", id).order("created_at", { ascending: false }).limit(100)); },
    async addReview(r) { must(await sb.from("avis").insert(r)); },
    photoUrl(path) { return sb.storage.from("photos").getPublicUrl(path).data.publicUrl; },
    async user() { const { data } = await sb.auth.getSession(); return data.session ? data.session.user : null; },
    onAuth(fn) { sb.auth.onAuthStateChange((_e, s) => fn(s ? s.user : null)); },
    async signUp(email, password) { const d = must(await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname + "#espace" } })); return !!d.session; },
    async signIn(email, password) { must(await sb.auth.signInWithPassword({ email, password })); },
    async signOut() { await sb.auth.signOut(); },
    async mine(uid) { return must(await sb.from("tresseuses").select("*").eq("id", uid).maybeSingle()); },
    async save(row) { must(await sb.from("tresseuses").upsert(row)); },
    async remove(uid, photos) { if (photos.length) await sb.storage.from("photos").remove(photos); must(await sb.from("tresseuses").delete().eq("id", uid)); },
    async upload(uid, blob) {
      const path = uid + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".jpg";
      must(await sb.storage.from("photos").upload(path, blob, { contentType: "image/jpeg", upsert: false }));
      return path;
    },
    async deletePhoto(path) { must(await sb.storage.from("photos").remove([path])); },
    // Statistiques : on enregistre une visite ou un clic, sans bloquer la page si ça échoue
    track(id, type) { sb.from("evenements").insert({ tresseuse_id: id, type }).then(() => {}, () => {}); },
    async stats(uid) {
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const count = async (type) => {
        const r = await sb.from("evenements").select("id", { count: "exact", head: true }).eq("tresseuse_id", uid).eq("type", type).gte("created_at", since);
        if (r.error) throw r.error;
        return r.count || 0;
      };
      const [vue, whatsapp, appel] = await Promise.all([count("vue"), count("whatsapp"), count("appel")]);
      return { vue, whatsapp, appel };
    },
    async placesOffertes() { return must(await sb.rpc("places_offertes")); },
    // Premium : tout passe par la fonction serveur « premium » (paiement Campay vérifié côté serveur)
    async premium(body) {
      const { data, error } = await sb.functions.invoke("premium", { body });
      if (error) {
        let msg = "";
        try { msg = (await error.context.json()).error; } catch {}
        const e = new Error(msg || t("Le service Premium ne répond pas."));
        e.unavailable = !msg;
        throw e;
      }
      return data;
    },
  };
}

function demoApi() {
  // Exemples affichés seulement tant que config.js est vide. Rien n'est envoyé nulle part.
  const now = Date.now();
  const rows = [
    { id: "demo-1", nom: "Exemple – Aïcha Tresses", ville: "Douala", quartier: "Bonamoussadi", tel: "690000001", experience: 8, dispo: "Lun–Sam, 8h–19h", domicile: true,
      description: "Spécialiste knotless et fulani. Mèches fournies sur demande.", styles: [{ nom: "Knotless braids", prix: 15000 }, { nom: "Fulani braids", prix: 12000 }, { nom: "Nattes collées", prix: 3000 }], photos: [], updated_at: new Date(now - 864e5).toISOString() },
    { id: "demo-2", nom: "Exemple – Salon Mama Ngono", ville: "Yaoundé", quartier: "Mvog-Ada", tel: "677000002", experience: 15, dispo: "Tous les jours", domicile: false,
      description: "Salon familial. Tresses au fil, vanilles et coiffures pour enfants.", styles: [{ nom: "Tresses au fil", prix: 2500 }, { nom: "Vanilles (twists)", prix: 8000 }, { nom: "Tresses enfants", prix: 2000 }], photos: [], updated_at: new Date(now - 3 * 864e5).toISOString() },
    { id: "demo-3", nom: "Exemple – Brenda Braids", ville: "Buea", quartier: "Molyko", tel: "650000003", experience: 4, dispo: "Weekends", domicile: true,
      description: "Box braids et crochet, rapide et soigné.", styles: [{ nom: "Box braids", prix: 10000 }, { nom: "Crochet braids", prix: 7000 }], photos: [], updated_at: new Date(now - 6 * 864e5).toISOString() },
  ];
  const avis = { "demo-1": [{ auteur: "Exemple – Carine", note: 5, commentaire: "Très propre et pas serré.", created_at: new Date(now - 2 * 864e5).toISOString() }], "demo-2": [{ auteur: "Exemple – Sandrine", note: 4, commentaire: "Bon travail pour ma fille.", created_at: new Date(now - 5 * 864e5).toISOString() }] };
  let me = null;
  const withNotes = (r) => { const a = avis[r.id] || []; return { ...r, nb_avis: a.length, note_moyenne: a.length ? a.reduce((s, x) => s + x.note, 0) / a.length : 0 }; };
  const auths = new Set();
  const events = {};
  let demoChecks = 0;
  const fire = () => auths.forEach(f => f(me));
  return {
    live: false,
    async list() { return rows.map(withNotes); },
    async get(id) { const r = rows.find(x => x.id === id); return r ? withNotes(r) : null; },
    async reviews(id) { return [...(avis[id] || [])]; },
    async addReview(r) { (avis[r.tresseuse_id] ||= []).unshift({ ...r, created_at: new Date().toISOString() }); },
    photoUrl(p) { return p; },
    async user() { return me; },
    onAuth(fn) { auths.add(fn); },
    async signUp(email) { me = { id: "demo-me", email }; fire(); return true; },
    async signIn(email) { me = { id: "demo-me", email }; fire(); },
    async signOut() { me = null; fire(); },
    async mine(uid) { return rows.find(x => x.id === uid) || null; },
    async save(row) { const i = rows.findIndex(x => x.id === row.id); if (i >= 0) rows[i] = row; else rows.unshift(row); },
    async remove(uid) { const i = rows.findIndex(x => x.id === uid); if (i >= 0) rows.splice(i, 1); },
    async upload(_uid, blob) { return URL.createObjectURL(blob); },
    async deletePhoto() {},
    track(id, type) { (events[id] ||= { vue: 0, whatsapp: 0, appel: 0 })[type]++; },
    async stats(uid) { return { ...(events[uid] || { vue: 0, whatsapp: 0, appel: 0 }) }; },
    async placesOffertes() { return 47; },
    // Démo : simule un paiement réussi après deux vérifications
    async premium(body) {
      const row = rows.find(x => x.id === (me && me.id));
      if (body.action === "info") return { prix: 2000, jours: 30, premium_until: row && row.premium_until || null };
      if (body.action === "start") { demoChecks = 0; return { reference: "demo-ref", ussd_code: "*126#", operator: "MTN" }; }
      if (body.action === "check") {
        if (++demoChecks < 2) return { statut: "PENDING" };
        const until = new Date(Date.now() + 30 * 864e5).toISOString();
        if (row) row.premium_until = until;
        return { statut: "SUCCESSFUL", premium_until: until };
      }
    },
  };
}

/* ---------- Liste ---------- */
let all = [];
for (const v of VILLES) { $("f-ville").append(el("option", { value: v, text: tCity(v) })); $("p-ville").append(el("option", { value: v, text: tCity(v) })); }
for (const s of STYLES) $("f-style").append(el("option", { value: s, text: tStyle(s) }));

function card(p) {
  const initials = p.nom.replace(/^Exemple – /, "").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const min = minPrix(p);
  return el("a", { class: "card", href: "#t/" + encodeURIComponent(p.id) },
    p.photos[0] ? el("img", { class: "cover", src: api.photoUrl(p.photos[0]), alt: t("Réalisation de {nom}", { nom: p.nom }), loading: "lazy" })
                : el("div", { class: "cover none", "aria-hidden": "true", text: initials }),
    el("div", { class: "body" },
      el("h2", { class: "name", text: p.nom }),
      el("div", { class: "where", text: [p.quartier, tCity(p.ville)].filter(Boolean).join(", ") }),
      p.nbAvis ? el("div", { class: "rating" }, el("span", { class: "stars", text: stars(p.note) }), el("span", { text: fmtNote(p.note) + " · " + pl(p.nbAvis, "{n} avis", "{n} avis", "{n} review", "{n} reviews") }))
               : el("div", { class: "rating", text: t("Pas encore d'avis") }),
      el("div", { class: "tags" },
        p.premium ? el("span", { class: "tag premium", text: "★ Premium" }) : null,
        p.domicile ? el("span", { class: "tag home", text: t("À domicile") }) : null,
        ...p.styles.slice(0, 3).map(s => el("span", { class: "tag", text: tStyle(s.nom) })),
        p.styles.length > 3 ? el("span", { class: "tag", text: "+" + (p.styles.length - 3) }) : null),
      min ? el("div", { class: "from", text: t("À partir de {prix}", { prix: fcfa(min) }) }) : null));
}

function renderList() {
  const v = $("f-ville").value, s = $("f-style").value, q = $("f-q").value.trim().toLowerCase(), home = $("f-home").checked, sort = $("f-sort").value;
  let list = all.filter(p => (!v || p.ville === v) && (!s || p.styles.some(x => x.nom === s)) && (!home || p.domicile) &&
    (!q || (p.nom + " " + p.quartier).toLowerCase().includes(q)));
  if (sort === "note") list.sort((a, b) => b.note - a.note || b.nbAvis - a.nbAvis);
  if (sort === "prix") {
    const price = (p) => s ? (p.styles.find(x => x.nom === s) || {}).prix || Infinity : minPrix(p) || Infinity;
    list.sort((a, b) => price(a) - price(b));
  }
  list.sort((a, b) => b.premium - a.premium);  // les profils Premium passent en tête (tri stable)
  const box = $("list");
  if (!all.length) {
    box.replaceChildren(el("div", { class: "empty" }, el("strong", { text: t("Aucune tresseuse inscrite pour l'instant") }),
      el("span", { text: t("Vous savez tresser ? Créez votre profil gratuitement en 2 minutes.") }),
      el("a", { class: "btn primary", href: "#espace", text: t("Je suis tresseuse") })));
  } else if (!list.length) {
    box.replaceChildren(el("div", { class: "empty" }, el("strong", { text: t("Aucun résultat") }), el("span", { text: t("Essayez une autre ville ou un autre style.") })));
  } else box.replaceChildren(...list.map(card));
  $("count").textContent = all.length ? pl(list.length, "{n} tresseuse", "{n} tresseuses", "{n} braider", "{n} braiders") + (v ? (LANG === "en" ? " in " : " à ") + tCity(v) : "") : "";
}
["f-ville", "f-style", "f-home", "f-sort"].forEach(id => $(id).addEventListener("change", renderList));
$("f-q").addEventListener("input", renderList);

async function loadList() {
  try { all = (await api.list()).map(clean).filter(Boolean); renderList(); }
  catch { $("list").replaceChildren(el("div", { class: "empty" }, el("strong", { text: t("Impossible de charger l'annuaire") }), el("span", { text: t("Vérifiez votre connexion internet puis rechargez la page.") }))); }
}

/* ---------- Fiche détaillée ---------- */
async function renderDetail(id) {
  const box = $("view-detail");
  box.replaceChildren(el("div", { class: "detail" }, el("a", { class: "back", href: "#", text: t("← Toutes les tresseuses") }), el("p", { text: t("Chargement…") })));
  let p, reviews;
  try { p = clean(await api.get(id)); reviews = p ? await api.reviews(id) : []; }
  catch { p = undefined; }
  if (!p) {
    box.replaceChildren(el("div", { class: "detail" }, el("a", { class: "back", href: "#", text: t("← Toutes les tresseuses") }),
      el("div", { class: "empty" }, el("strong", { text: p === undefined ? t("Impossible de charger ce profil") : t("Ce profil n'existe plus") }), el("span", { text: t("La tresseuse a peut-être retiré son profil.") }))));
    return;
  }
  document.title = p.nom + " · Tresseuses du Cameroun";
  const shareUrl = location.origin + location.pathname + "#t/" + encodeURIComponent(p.id);
  const msg = t("Bonjour {nom}, je vous ai trouvée sur Tresseuses du Cameroun. Je voudrais me faire tresser.", { nom: p.nom.replace(/^Exemple – /, "") });
  const num = el("span", { class: "phone", text: "+237 " + fmtTel(p.tel) });

  const prices = el("ul", { class: "prices" }, ...p.styles.map(s => el("li", {}, el("span", { text: tStyle(s.nom) }), el("span", { text: s.prix ? t("dès {prix}", { prix: fcfa(s.prix) }) : t("sur devis") }))));

  // Avis
  const revList = el("div", { style: "display:grid;gap:10px" });
  const drawReviews = () => revList.replaceChildren(...(reviews.length ? reviews.map(r => el("div", { class: "review" },
      el("div", {}, el("span", { class: "stars", text: stars(Math.max(1, Math.min(5, Number(r.note) || 0))) }), " ", el("strong", { text: String(r.auteur || "").slice(0, 40) })),
      r.commentaire ? el("p", { text: String(r.commentaire).slice(0, 500) }) : null,
      el("span", { class: "meta", text: dateFr(r.created_at) })))
    : [el("p", { class: "hint", text: t("Pas encore d'avis. Vous avez été coiffée par {nom} ? Laissez le premier.", { nom: p.nom }) })]));
  drawReviews();

  let pick = 0;
  const starBtns = [1, 2, 3, 4, 5].map(n => el("button", { type: "button", "aria-label": pl(n, "{n} étoile", "{n} étoiles", "{n} star", "{n} stars"), text: "★",
    onclick: () => { pick = n; starBtns.forEach((b, i) => b.classList.toggle("on", i < n)); } }));
  const rName = el("input", { id: "r-nom", maxlength: "40", placeholder: "Ex. Carine" });
  const rText = el("textarea", { id: "r-text", maxlength: "500", placeholder: t("Qualité, ponctualité, prix respecté…") });
  const rMsg = el("div");
  const rBtn = el("button", { class: "btn primary", type: "submit", text: t("Publier mon avis") });
  const rForm = el("form", { class: "panel", novalidate: true },
    el("h2", { text: t("Laisser un avis") }),
    el("div", { class: "star-pick", role: "group", "aria-label": t("Votre note") }, ...starBtns),
    el("label", {}, t("Votre prénom"), rName), el("label", {}, t("Votre avis (facultatif)"), rText), rMsg, rBtn);
  rForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const auteur = rName.value.trim();
    if (!pick) return notice(rMsg, t("Choisissez une note de 1 à 5 étoiles."), "err");
    if (auteur.length < 2) return notice(rMsg, t("Indiquez votre prénom."), "err");
    const key = "avis-" + p.id;
    try { if (localStorage.getItem(key)) return notice(rMsg, t("Vous avez déjà laissé un avis à cette tresseuse depuis ce téléphone."), "err"); } catch {}
    rBtn.disabled = true;
    try {
      const r = { tresseuse_id: p.id, auteur, note: pick, commentaire: rText.value.trim() };
      await api.addReview(r);
      try { localStorage.setItem(key, "1"); } catch {}
      reviews.unshift({ ...r, created_at: new Date().toISOString() }); drawReviews();
      rForm.replaceChildren(el("div", { class: "notice ok", text: t("Merci ! Votre avis est publié.") }));
      loadList();
    } catch (x) {
      const code = x && x.code, m = String(x && x.message || "");
      notice(rMsg, code === "42501" || /row-level security/i.test(m)
        ? t("Vous êtes connectée avec le compte de cette tresseuse : on ne peut pas laisser d'avis sur son propre profil.")
        : /fetch|network|Failed/i.test(m)
          ? t("L'avis n'a pas pu être publié. Vérifiez votre connexion internet et réessayez.")
          : t("L'avis n'a pas pu être publié ({m}).", { m: m.slice(0, 100) }), "err");
      rBtn.disabled = false;
    }
  });
  const ownProfile = !!(me && me.id === p.id);
  // Une visite comptée par profil et par session ; jamais sur son propre profil
  if (!ownProfile) {
    let seen = false;
    try { seen = !!sessionStorage.getItem("vu-" + p.id); sessionStorage.setItem("vu-" + p.id, "1"); } catch {}
    if (!seen) api.track(p.id, "vue");
  }
  const trackClick = (type) => () => { if (!ownProfile) api.track(p.id, type); };

  box.replaceChildren(el("div", { class: "detail" },
    el("a", { class: "back", href: "#", text: t("← Toutes les tresseuses") }),
    p.photos.length ? el("div", { class: "gallery" }, ...p.photos.map((ph, i) => el("img", { src: api.photoUrl(ph), alt: t("Réalisation {i} de {nom}", { i: i + 1, nom: p.nom }), loading: i ? "lazy" : "eager" }))) : null,
    el("div", { style: "display:grid;gap:6px" },
      el("h1", { text: p.nom }),
      el("div", { class: "where", text: [p.quartier, tCity(p.ville)].filter(Boolean).join(", ") }),
      p.nbAvis ? el("div", { class: "rating" }, el("span", { class: "stars", text: stars(p.note) }), el("span", { text: t("{note} sur 5", { note: fmtNote(p.note) }) + " · " + pl(p.nbAvis, "{n} avis", "{n} avis", "{n} review", "{n} reviews") })) : null,
      el("div", { class: "tags" }, p.premium ? el("span", { class: "tag premium", text: "★ Premium" }) : null,
        p.domicile ? el("span", { class: "tag home", text: t("Se déplace à domicile") }) : null,
        p.experience ? el("span", { class: "tag", text: pl(p.experience, "{n} an d'expérience", "{n} ans d'expérience", "{n} year of experience", "{n} years of experience") }) : null)),
    el("div", { class: "cols" },
      el("div", { style: "display:grid;gap:18px;min-width:0" },
        el("div", { class: "panel" },
          el("h2", { text: t("Contacter") }),
          el("div", { class: "actions" },
            el("a", { class: "btn wa", href: "https://wa.me/237" + p.tel + "?text=" + encodeURIComponent(msg), target: "_blank", rel: "noopener", text: t("Écrire sur WhatsApp"), onclick: trackClick("whatsapp") }),
            el("a", { class: "btn ghost", href: "tel:+237" + p.tel, text: t("Appeler"), onclick: trackClick("appel") })),
          el("div", { class: "actions" }, num, el("button", { class: "linkish", type: "button", text: t("Copier le numéro"), onclick: () => copy("+237" + p.tel, num) })),
          p.dispo ? el("div", { class: "where", text: t("Disponible : {d}", { d: p.dispo }) }) : null),
        el("div", { class: "panel" }, el("h2", { text: t("Styles et prix") }), prices, el("span", { class: "hint", text: t("Prix indicatifs donnés par la tresseuse. Mèches non comprises sauf mention.") })),
        p.description ? el("div", { class: "panel" }, el("h2", { text: t("Présentation") }), el("p", { class: "desc", text: p.description })) : null,
        el("button", { class: "btn ghost", type: "button", text: t("Partager ce profil"), onclick: async () => {
          if (navigator.share) { try { await navigator.share({ title: p.nom, text: t("{nom} – tresseuse à {ville}", { nom: p.nom, ville: tCity(p.ville) }), url: shareUrl }); return; } catch {} }
          copy(shareUrl);
        } })),
      el("div", { style: "display:grid;gap:18px;min-width:0" },
        el("div", { class: "panel" }, el("h2", { text: t("Avis des clientes") }), revList),
        ownProfile
          ? el("div", { class: "panel" }, el("h2", { text: t("C'est votre profil") }),
              el("p", { class: "hint", text: t("Les avis sont laissés par vos clientes. Partagez le lien de votre profil pour qu'elles puissent vous noter.") }),
              el("a", { class: "btn ghost", href: "#espace", text: t("Modifier mon profil") }))
          : rForm))));
  window.scrollTo(0, 0);
}

/* ---------- Espace tresseuse ---------- */
let me = null, myPhotos = [], signupMode = true;
STYLES.forEach((s, i) => $("p-styles").append(el("label", { class: "style-row" },
  el("input", { type: "checkbox", id: "st-c-" + i }), el("span", { text: tStyle(s) }),
  el("input", { type: "number", id: "st-p-" + i, min: "0", step: "500", inputmode: "numeric", placeholder: t("Prix"), "aria-label": t("Prix pour {s}", { s: tStyle(s) }) }))));

function setAuthMode(signup) {
  signupMode = signup;
  $("auth-title").textContent = signup ? t("Créer mon compte tresseuse") : t("Me connecter");
  $("auth-submit").textContent = signup ? t("Créer mon compte") : t("Me connecter");
  $("auth-switch").textContent = signup ? t("J'ai déjà un compte : me connecter") : t("Pas encore de compte : en créer un");
  $("a-pass").autocomplete = signup ? "new-password" : "current-password";
  $("a-cgu-row").hidden = !signup;
  notice($("auth-msg"), "");
}
$("auth-switch").onclick = () => setAuthMode(!signupMode);
$("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("a-email").value.trim(), pass = $("a-pass").value;
  if (!/^\S+@\S+\.\S+$/.test(email)) return notice($("auth-msg"), t("Adresse e-mail invalide."), "err");
  if (signupMode && (pass.length < 8 || !/[a-zA-Z]/.test(pass) || !/[0-9]/.test(pass))) return notice($("auth-msg"), t("Le mot de passe doit faire au moins 8 caractères, avec des lettres et des chiffres."), "err");
  if (signupMode && !$("a-cgu").checked) return notice($("auth-msg"), t("Cochez la case pour accepter les conditions d'utilisation."), "err");
  $("auth-submit").disabled = true;
  try {
    if (signupMode) {
      const loggedIn = await api.signUp(email, pass);
      if (!loggedIn) notice($("auth-msg"), t("Compte créé. Ouvrez l'e-mail de confirmation que nous venons d'envoyer à {email}, puis revenez ici pour vous connecter.", { email }), "ok");
    } else await api.signIn(email, pass);
  } catch (x) {
    const m = String(x && x.message || "");
    notice($("auth-msg"), /Invalid login/i.test(m) ? t("E-mail ou mot de passe incorrect.") : /already registered/i.test(m) ? t("Ce compte existe déjà : connectez-vous.") : /confirm/i.test(m) ? t("Confirmez d'abord votre adresse avec l'e-mail reçu.") : t("Échec : {m}", { m: m.slice(0, 120) }), "err");
  } finally { $("auth-submit").disabled = false; }
});
$("logout").onclick = () => api.signOut();

function drawThumbs() {
  $("p-photos").replaceChildren(...myPhotos.map(path => el("div", { class: "thumb" },
    el("img", { src: api.photoUrl(path), alt: "" }),
    el("button", { type: "button", "aria-label": t("Retirer cette photo"), text: "×", onclick: async () => {
      try { await api.deletePhoto(path); myPhotos = myPhotos.filter(x => x !== path); drawThumbs(); await persistPhotos(); }
      catch { toast("La photo n'a pas pu être retirée"); }
    } }))));
  $("p-file").closest("label").hidden = myPhotos.length >= MAX_PHOTOS;
}
let hasProfile = false;
async function persistPhotos() {
  // Si le profil existe déjà, on enregistre tout de suite la liste des photos
  if (hasProfile) { try { await saveProfile(true); } catch {} }
}
$("p-file").addEventListener("change", async (e) => {
  const files = [...e.target.files].slice(0, MAX_PHOTOS - myPhotos.length);
  e.target.value = "";
  if (!files.length) return;
  notice($("form-msg"), pl(files.length, "Envoi de {n} photo…", "Envoi de {n} photos…", "Uploading {n} photo…", "Uploading {n} photos…"));
  let failed = 0;
  for (const f of files) {
    try { myPhotos.push(await api.upload(me.id, await compress(f))); drawThumbs(); }
    catch { failed++; }
  }
  notice($("form-msg"), failed ? pl(failed, "{n} photo n'a pas pu être envoyée. Réessayez.", "{n} photos n'ont pas pu être envoyées. Réessayez.", "{n} photo could not be uploaded. Try again.", "{n} photos could not be uploaded. Try again.") : "", failed ? "err" : "");
  await persistPhotos();
});

function readForm() {
  const tel = $("p-tel").value.replace(/\D/g, "").replace(/^237(?=\d{9}$)/, "");
  const styles = STYLES.map((s, i) => $("st-c-" + i).checked ? { nom: s, prix: Number($("st-p-" + i).value) > 0 ? Math.round(Number($("st-p-" + i).value)) : null } : null).filter(Boolean);
  const exp = $("p-exp").value === "" ? null : Math.max(0, Math.min(60, Math.round(Number($("p-exp").value))));
  return { id: me.id, nom: $("p-nom").value.trim(), ville: $("p-ville").value, quartier: $("p-quartier").value.trim(), tel, experience: exp,
    dispo: $("p-dispo").value.trim(), domicile: $("p-home").checked, description: $("p-desc").value.trim(), styles, photos: myPhotos, updated_at: new Date().toISOString() };
}
function validate(r) {
  if (r.nom.length < 2) return t("Indiquez votre nom (2 caractères minimum).");
  if (!/^[62]\d{8}$/.test(r.tel)) return t("Le numéro doit avoir 9 chiffres et commencer par 6 (ex. 6 77 12 34 56).");
  if (!r.styles.length) return t("Cochez au moins un style que vous savez faire.");
  return "";
}
async function saveProfile(quiet) {
  const r = readForm();
  const err = validate(r);
  if (err) { if (!quiet) notice($("form-msg"), err, "err"); return false; }
  await api.save(r);
  return true;
}
function fillForm(d) {
  $("form").reset(); myPhotos = [];
  if (d) {
    $("p-nom").value = d.nom; $("p-ville").value = d.ville; $("p-quartier").value = d.quartier; $("p-tel").value = d.tel;
    $("p-exp").value = d.experience ?? ""; $("p-dispo").value = d.dispo; $("p-home").checked = d.domicile; $("p-desc").value = d.description;
    STYLES.forEach((s, i) => { const f = d.styles.find(x => x.nom === s); if (f) { $("st-c-" + i).checked = true; $("st-p-" + i).value = f.prix ?? ""; } });
    myPhotos = [...d.photos];
  }
  hasProfile = !!d;
  $("save").textContent = d ? t("Mettre à jour mon profil") : t("Publier mon profil");
  $("del").hidden = !d; $("me-view").hidden = !d;
  $("me-view").href = "#t/" + encodeURIComponent(me.id);
  loadStats(!!d);
  loadPremium(d);
  notice($("me-status"), d ? t("Votre profil est en ligne. Partagez son lien sur votre statut WhatsApp pour avoir plus de clientes.") : t("Complétez votre profil puis publiez-le : il sera visible tout de suite."), d ? "ok" : "");
  drawThumbs();
}
async function loadStats(show) {
  const box = $("stats");
  box.hidden = !show;
  if (!show || !me) return;
  const tile = (n, label) => el("div", { class: "stat" }, el("b", { text: n }), el("span", { text: label }));
  $("stats-grid").replaceChildren(tile("…", t("Vues du profil")), tile("…", t("Clics WhatsApp")), tile("…", t("Appels")));
  try {
    const s = await api.stats(me.id);
    $("stats-grid").replaceChildren(tile(String(s.vue), t("Vues du profil")), tile(String(s.whatsapp), t("Clics WhatsApp")), tile(String(s.appel), t("Appels")));
  } catch { box.hidden = true; }  // table pas encore créée : on n'affiche rien
}

/* ---------- Offre de lancement : Premium offert aux premières inscrites ---------- */
async function loadOffre() {
  const box = $("offre");
  let n = 0;
  try { n = Number(await api.placesOffertes()) || 0; } catch { n = 0; }  // offre pas installée ou terminée
  box.hidden = n <= 0;
  if (n <= 0) return;
  box.replaceChildren(
    el("span", {}, el("strong", { text: t("Offre de lancement : ") }),
      pl(n, "1 mois et 1 semaine de Premium offerts aux premières tresseuses inscrites. Plus que {n} place\u00a0!", "1 mois et 1 semaine de Premium offerts aux premières tresseuses inscrites. Plus que {n} places\u00a0!", "1 month + 1 week of Premium free for the first braiders to sign up. Only {n} place left!", "1 month + 1 week of Premium free for the first braiders to sign up. Only {n} places left!")),
    el("a", { class: "btn primary", href: "#espace", text: t("Je m'inscris") }));
}

/* ---------- Premium (paiement Mobile Money via Campay) ---------- */
let premiumPoll = null;

// Rappel de fin de Premium : 7 jours avant la fin, et jusqu'à 30 jours après. null sinon.
function premiumRappel(until, now) {
  const ts = until ? Date.parse(until) : NaN;
  if (!Number.isFinite(ts)) return null;
  const jours = Math.ceil((ts - now) / 864e5);
  if (jours > 7 || jours < -30) return null;
  if (jours > 1) return { urgent: false, texte: t("Votre Premium se termine dans {n} jours (le {date}). Prolongez-le pour rester en tête des résultats.", { n: jours, date: dateFr(until) }) };
  if (ts > now) return { urgent: true, texte: t("Votre Premium se termine très bientôt (le {date}). Prolongez-le maintenant pour garder votre place en tête des résultats.", { date: dateFr(until) }) };
  return { urgent: true, texte: t("Votre Premium est terminé depuis le {date}. Votre profil n'est plus en tête des résultats : réactivez-le en quelques secondes.", { date: dateFr(until) }) };
}
async function loadPremium(profile) {
  const box = $("premium"), body = $("premium-body");
  clearTimeout(premiumPoll);
  box.hidden = !profile;
  if (!profile || !me) return;
  body.replaceChildren(el("p", { class: "hint", text: t("Chargement…") }));
  let info;
  try { info = await api.premium({ action: "info" }); }
  catch { box.hidden = true; return; }  // service pas encore installé : on n'affiche rien
  const active = info.premium_until && Date.parse(info.premium_until) > Date.now();
  const prix = fcfa(info.prix);
  const rappel = premiumRappel(info.premium_until, Date.now());
  // Rappel bien visible en haut de l'espace tresseuse, en plus de l'encadré Premium
  const old = $("rappel-premium"); if (old) old.remove();
  if (rappel) $("me-status").append(el("div", { id: "rappel-premium", class: "notice " + (rappel.urgent ? "err" : ""), text: rappel.texte + " " + t("Voir l'encadré ★ Premium ci-dessous.") }));
  const tel = el("input", { id: "pm-tel", inputmode: "tel", maxlength: "20", value: profile.tel });
  const msg = el("div");
  const btn = el("button", { class: "btn primary", type: "button", text: (active ? t("Prolonger de {n} jours", { n: info.jours }) : t("Passer Premium")) + " · " + prix });
  btn.onclick = () => payPremium(tel.value, msg, btn);
  body.replaceChildren(...[
    rappel ? el("div", { class: "notice " + (rappel.urgent ? "err" : ""), text: rappel.texte }) : null,
    active && !rappel
      ? el("div", { class: "notice ok", text: t("Premium actif jusqu'au {date}.", { date: dateFr(info.premium_until) }) })
      : active ? null : el("ul", { class: "perks" },
          el("li", { text: t("Votre profil apparaît en tête des résultats dans votre ville.") }),
          el("li", { text: t("Un badge « ★ Premium » sur votre fiche et dans la liste.") }),
          el("li", { text: t("{prix} pour {n} jours, sans engagement ni renouvellement automatique.", { prix, n: info.jours }) })),
    el("label", {}, t("Numéro MTN MoMo ou Orange Money qui paie"), tel),
    msg, btn].filter(Boolean));  // replaceChildren afficherait « null » en texte
}

async function payPremium(rawTel, msg, btn) {
  const tel = String(rawTel).replace(/\D/g, "").replace(/^237(?=\d{9}$)/, "");
  if (!/^6\d{8}$/.test(tel)) return notice(msg, t("Numéro invalide : 9 chiffres commençant par 6."), "err");
  btn.disabled = true;
  let start;
  try { start = await api.premium({ action: "start", telephone: tel }); }
  catch (x) { btn.disabled = false; return notice(msg, t(x.message), "err"); }
  notice(msg, t("Une demande de paiement a été envoyée au {tel}. Validez-la sur votre téléphone avec votre code secret Mobile Money.", { tel: fmtTel(tel) }) +
    (start.ussd_code ? " " + t("Si rien ne s'affiche, composez {code}.", { code: start.ussd_code }) : "") + " " + t("Gardez cette page ouverte."));
  let tries = 0;
  const check = async () => {
    let r;
    try { r = await api.premium({ action: "check", reference: start.reference }); } catch { r = { statut: "PENDING" }; }
    if (r.statut === "SUCCESSFUL") {
      toast("Premium activé"); loadList();
      return loadPremium(clean(await api.mine(me.id)));
    }
    if (r.statut === "FAILED") { btn.disabled = false; return notice(msg, t("Le paiement a échoué ou a été refusé. Aucun montant n'a été prélevé. Vous pouvez réessayer."), "err"); }
    if (++tries < 36) premiumPoll = setTimeout(check, 5000);
    else {
      btn.disabled = false;
      msg.replaceChildren(el("div", { class: "notice" }, t("Paiement pas encore confirmé. Si vous l'avez validé, touchez « Vérifier ».") + " ",
        el("button", { class: "linkish", type: "button", text: t("Vérifier"), onclick: () => { tries = 30; btn.disabled = true; check(); } })));
    }
  };
  premiumPoll = setTimeout(check, 5000);
}

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("save").disabled = true;
  try {
    const wasNew = !hasProfile;
    if (await saveProfile(false)) {
      notice($("form-msg"), ""); fillForm(clean(await api.mine(me.id)) || clean({ ...readForm() }));
      toast("Profil publié"); loadList();
      if (wasNew) loadOffre();
    }
  } catch (x) {
    notice($("form-msg"), t("L'enregistrement a échoué : {m}", { m: String(x && x.message || t("vérifiez votre connexion")).slice(0, 120) }), "err");
  } finally { $("save").disabled = false; }
});
$("del").onclick = () => { $("del-confirm").hidden = false; };
$("del-no").onclick = () => { $("del-confirm").hidden = true; };
$("del-yes").onclick = async () => {
  try { await api.remove(me.id, myPhotos); $("del-confirm").hidden = true; fillForm(null); toast("Profil supprimé"); loadList(); }
  catch { notice($("form-msg"), t("La suppression a échoué. Réessayez."), "err"); }
};

async function renderMe() {
  $("auth-box").hidden = !!me; $("profile-box").hidden = !me;
  if (!me) return;
  $("me-email").textContent = t("Connectée : {e}", { e: me.email || "" });
  try { fillForm(clean(await api.mine(me.id))); }
  catch { notice($("me-status"), t("Impossible de charger votre profil. Rechargez la page."), "err"); }
}
api.onAuth(u => { const changed = (u && u.id) !== (me && me.id); me = u; if (changed) renderMe(); });

/* ---------- Navigation ---------- */
function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  const detail = h.startsWith("t/") ? h.slice(2) : null;
  const meView = h === "espace";
  $("view-list").hidden = !!detail || meView; $("view-detail").hidden = !detail; $("view-me").hidden = !meView;
  $("nav-find").toggleAttribute("aria-current", !meView); if (!meView) $("nav-find").setAttribute("aria-current", "page");
  $("nav-me").toggleAttribute("aria-current", meView); if (meView) $("nav-me").setAttribute("aria-current", "page");
  if (!detail) document.title = "Tresseuses du Cameroun";
  if (detail) renderDetail(detail);
  if (meView) renderMe();
}
window.addEventListener("hashchange", route);

(async () => {
  $("demo-banner").hidden = api.live;
  me = await api.user().catch(() => null);
  route();
  loadList();
  loadOffre();
})();
