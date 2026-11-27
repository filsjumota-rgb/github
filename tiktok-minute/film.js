// Tresseuses du Cameroun : TikTok bilingue d'une minute. Fonction pure du temps : window.seek(t) peint l'image t.
// Minutage en temps (u) sur la grille mesurée (120 bpm, 0,5 s par temps, 120 temps). Plan : docs/shotlist.md.
import * as M from './lib/motion.js';

const { W, H, FORMAT, E, prog, lerp, clamp, springU, springKeys, SPRING, wobble, shake, font, layout, glyph, text, fill, rrect, crop, fitSize } = M;

const C = { green: '#0f5a3a', deep: '#0a3f28', gold: '#f2b230', ink: '#13281d', white: '#ffffff', mute: '#cfe3d6' };
const DISPLAY = 'Display', UI = 'UI';
const S = FORMAT.safe;

const HITS = [
  [0, 'Tu', 'impact'], [1, 'sais', 'pop', { pitch: 'D6' }], [2, 'tresser ?', 'pop', { pitch: 'G6' }],
  [7.75, 'tresse monte', 'whoosh', { len: 0.45, from: 500, to: 2600 }],
  [8, 'DROP les clientes', 'impact'], [12.5, 'mais ne te trouvent pas', 'thud'],
  [18, 'Voici', 'whoosh', { len: 0.35, from: 2600, to: 700 }], [19, 'logo', 'pop', { pitch: 'B5' }], [23, 'accueil', 'thud'],
  [30, 'filtres', 'whoosh', { len: 0.4, from: 700, to: 2600 }], [34, 'ville', 'tick'], [37, 'style', 'tick'], [40, 'quartier', 'tick'],
  [44, 'ÉTAPE 1', 'impact'], [49, 'je suis tresseuse', 'blip', { pitch: 'E6' }], [53, 'e-mail', 'tick'],
  [60, 'ÉTAPE 2', 'impact'], [65, 'prix knotless', 'tick'], [68, 'prix fulani', 'tick'],
  [74, 'ÉTAPE 3', 'impact'], [79, 'avis', 'tick'], [82, 'à domicile', 'tick'],
  [86, 'WhatsApp', 'whoosh', { len: 0.4, from: 2600, to: 600 }], [88, 'pulse', 'blip', { pitch: 'E6' }], [89, 'pulse 2', 'blip', { pitch: 'B6' }],
  [92, 'statistiques', 'pop', { pitch: 'D6' }],
  [97.75, 'disque or', 'whoosh', { len: 0.4, from: 600, to: 3000 }],
  [98, 'GRATUIT', 'impact'], [101, 'Premium', 'bell', { pitch: 'D6' }], [102, 'compteur 75', 'coins'],
  [108, 'fin logo', 'impact'], [108.5, 'adresse', 'type', { len: 0.8, n: 9 }], [111, 'Inscris-toi', 'bell', { pitch: 'G6' }],
];

// ---------------------------------------------------------------- outils
function braid(ctx, y, h, col, bg, shift = 0) {
  ctx.fillStyle = bg; ctx.fillRect(0, y, W, h);
  ctx.fillStyle = col;
  const s = h, off = ((shift % s) + s) % s;
  for (let x = -2 * s + off; x < W + 2 * s; x += s) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s / 2, y + h / 2); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + s / 2, y + h / 2); ctx.lineTo(x + s, y); ctx.lineTo(x + s, y + h); ctx.closePath(); ctx.fill();
  }
}
// Un mot qui tombe lettre par lettre et rebondit ; taille réduite si la ligne dépasse la zone sûre.
function dropWord(ctx, str, x, base, size, color, u, u0, { stag = 0.025, cfg = SPRING.snappy, from = -140, track = -0.03, maxW = S.w } = {}) {
  size = Math.min(size, fitSize(ctx, str, 800, DISPLAY, maxW, size, track));
  const f = font(size, 800, DISPLAY), L = layout(ctx, str, f, track * size);
  L.glyphs.forEach((g, j) => {
    const k = springU(u, u0 + j * stag, cfg);
    if (k <= 0 || g.ch === ' ') return;
    glyph(ctx, g.ch, x + g.cx, base + (1 - k) * from, f, color, 1, lerp(1.25, 1, clamp(k)));
  });
  return size;
}
// Découpe un texte en lignes qui tiennent dans maxW.
function wrap(ctx, str, f, maxW) {
  ctx.font = f;
  const words = str.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
// Paragraphe qui monte ligne par ligne de derrière un masque. Renvoie la ligne de base suivante.
function para(ctx, str, x, base, size, color, u, u0, { weight = 600, family = UI, maxW = S.w, lh = 1.28, align = 'left' } = {}) {
  const f = font(size, weight, family), lines = wrap(ctx, str, f, maxW);
  lines.forEach((ln, i) => {
    const p = E.outQuint(prog(u, u0 + i * 0.25, u0 + i * 0.25 + 0.6));
    if (p <= 0) return;
    const b = base + i * size * lh;
    ctx.save(); ctx.beginPath(); ctx.rect(0, b - size * 1.15, W, size * 1.5); ctx.clip();
    text(ctx, ln, x, b + (1 - p) * size * 1.3, f, color, align);
    ctx.restore();
  });
  return base + lines.length * size * lh;
}
// Sous-titre anglais : plus petit, sous le français.
const en = (ctx, str, x, base, color, u, u0, size = 56, o = {}) => para(ctx, str, x, base, size, color, u, u0, o);
function star(ctx, x, y, r, col) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); }
  ctx.closePath(); ctx.fillStyle = col; ctx.fill();
}
function card(ctx, x, y, w, h, r = 34, col = C.white) { rrect(ctx, x, y, w, h, r); ctx.fillStyle = col; ctx.fill(); }
// Pastille « ÉTAPE n » qui claque.
function step(ctx, n, x, y, u, u0) {
  const k = springU(u, u0, SPRING.bouncy);
  if (k <= 0) return;
  const f = font(46, 800, DISPLAY), lab = `ÉTAPE ${n} · STEP ${n}`;
  ctx.font = f; const w = ctx.measureText(lab).width + 56;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  card(ctx, 0, -50, w, 74, 37, C.gold);
  text(ctx, lab, 28, 4, f, C.ink);
  ctx.restore();
}
// Capture du site dans une carte blanche arrondie.
function shot(ctx, img, src, x, y, w) {
  const h = w * src[3] / src[2];
  card(ctx, x - 8, y - 8, w + 16, h + 16, 36);
  ctx.save(); rrect(ctx, x, y, w, h, 30); ctx.clip(); crop(ctx, img, src, x, y, w, h); ctx.restore();
  return h;
}
// Anneau or autour d'une zone de la capture (coordonnées source).
function ring(ctx, u, u0, x, y, sc, src, [rx, ry, rw, rh], pad = 12) {
  const p = E.outBack(prog(u, u0, u0 + 0.5), 2);
  if (p <= 0) return;
  ctx.save(); ctx.lineWidth = 9 * p; ctx.strokeStyle = C.gold;
  rrect(ctx, x + (rx - src[0]) * sc - pad, y + (ry - src[1]) * sc - pad, rw * sc + 2 * pad, rh * sc + 2 * pad, 18); ctx.stroke();
  ctx.restore();
}
const enter = (u, u0, from, to, cfg = SPRING.snappy) => lerp(from, to, springU(u, u0, cfg));

// ---------------------------------------------------------------- A accroche (u 0..8)
function sA(ctx, u) {
  fill(ctx, C.green);
  braid(ctx, H - 120, 120, C.gold, C.green, u * 30);
  const size = 200, b1 = S.y + 520;
  dropWord(ctx, 'Tu sais', S.x, b1, size, C.white, u, -0.3, { cfg: SPRING.bouncy, from: -220 });
  ctx.save(); ctx.beginPath(); ctx.rect(0, b1 + 30, W, size * 1.2); ctx.clip();
  dropWord(ctx, 'tresser ?', S.x, b1 + size * 0.98, size, C.gold, u, 1.88, { cfg: SPRING.bouncy, from: 240, stag: 0.035 });
  ctx.restore();
  en(ctx, 'Can you braid?', S.x + 6, b1 + size * 1.72, C.mute, u, 3, 74);
  para(ctx, 'Alors regarde bien.', S.x + 6, b1 + size * 1.72 + 130, 56, C.white, u, 4.5);
  en(ctx, 'Then watch this.', S.x + 6, b1 + size * 1.72 + 205, C.mute, u, 4.8, 50);
  const w = E.inOutCubic(prog(u, 7.4, 8));
  if (w > 0) {
    const top = lerp(H - 120, -140, w);
    ctx.fillStyle = C.gold; ctx.fillRect(0, top + 120, W, H);
    braid(ctx, top, 120, C.gold, C.green, u * 30);
  }
}

// ---------------------------------------------------------------- B le problème (u 8..18)
function sB(ctx, u) {
  ctx.save(); shake(ctx, u, 8, 16);
  fill(ctx, C.gold);
  const y0 = S.y + 230;
  dropWord(ctx, 'Les clientes', S.x, y0, 140, C.ink, u, 7.85);
  dropWord(ctx, 'te cherchent...', S.x, y0 + 140, 140, C.ink, u, 8.2);
  en(ctx, 'Clients are looking for you...', S.x + 4, y0 + 250, C.deep, u, 9.2);
  // deuxième temps : le problème
  const y1 = y0 + 520;
  dropWord(ctx, 'mais ne te', S.x, y1, 140, C.green, u, 12.4);
  dropWord(ctx, 'trouvent pas.', S.x, y1 + 140, 140, C.green, u, 12.7);
  en(ctx, '...but they can\'t find you.', S.x + 4, y1 + 250, C.deep, u, 13.6);
  ctx.restore();
}

// ---------------------------------------------------------------- C la solution (u 18..30)
function sC(ctx, u, IMG) {
  fill(ctx, C.green);
  braid(ctx, 0, 70, C.gold, C.green, -u * 30);
  para(ctx, 'Voici · Here is', S.x, S.y + 90, 56, C.mute, u, 17.5);
  const lk = springU(u, 17.7, SPRING.bouncy);
  if (IMG.logo && lk > 0) {
    const s = 150 * lk, lx = S.x + 75, ly = S.y + 210;
    ctx.save(); ctx.beginPath(); ctx.arc(lx, ly, s / 2 + 10, 0, M.TAU); ctx.fillStyle = C.gold; ctx.fill(); ctx.restore();
    ctx.drawImage(IMG.logo, lx - s / 2, ly - s / 2, s, s);
  }
  dropWord(ctx, 'Tresseuses', S.x + 175, S.y + 205, 104, C.white, u, 17.8, { maxW: S.w - 175 });
  dropWord(ctx, 'du Cameroun', S.x + 175, S.y + 300, 104, C.gold, u, 18.2, { maxW: S.w - 175 });
  let b = para(ctx, 'L\'annuaire des tresseuses du Cameroun, sur internet.', S.x, S.y + 410, 54, C.white, u, 20.5);
  en(ctx, 'The braiders\' directory of Cameroon, online.', S.x, b + 6, C.mute, u, 21.2, 48);
  // la vraie page d'accueil monte
  const img = IMG.home; if (!img) return;
  const src = [0, 0, 1170, 585], w = 860;   // en-tête seulement (sans le compteur de démonstration « 47 places »)
  const y = enter(u, 22.6, H + 40, S.y + 640);
  ctx.save(); ctx.translate(0, 0);
  shot(ctx, img, src, (W - w) / 2, y + 40 * Math.sin(prog(u, 23, 30) * 0.0), w);
  ctx.restore();
}

// ---------------------------------------------------------------- D la recherche des clientes (u 30..44)
function sD(ctx, u, IMG) {
  fill(ctx, C.deep);
  dropWord(ctx, 'Les clientes cherchent', S.x, S.y + 110, 92, C.white, u, 29.4);
  dropWord(ctx, 'par ville, quartier et style', S.x, S.y + 205, 92, C.gold, u, 30.1);
  en(ctx, 'Clients search by city, neighbourhood and style.', S.x, S.y + 300, C.mute, u, 31, 50);
  const img = IMG.home; if (!img) return;
  const src = [0, 1380, 1170, 1100], w = 860, sc = w / src[2], x = (W - w) / 2;
  const y = enter(u, 29.5, H + 60, S.y + 420);
  shot(ctx, img, src, x, y, w);
  ring(ctx, u, 34, x, y, sc, src, [48, 1458, 1074, 126]);
  ring(ctx, u, 37, x, y, sc, src, [48, 1686, 1074, 129]);
  ring(ctx, u, 40, x, y, sc, src, [48, 1920, 1074, 126]);
  // chaque critère s'affiche en légende
  const lab = [[34, 'Douala, Yaoundé, Buea...'], [37, 'knotless, nattes, twists...'], [40, 'Bonamoussadi, Mvog-Ada...']];
  for (const [u0, s] of lab) {
    const p = prog(u, u0, u0 + 0.3) * (1 - prog(u, u0 + 2.8, u0 + 3));
    if (p <= 0) continue;
    ctx.save(); ctx.globalAlpha = p;
    para(ctx, s, S.x, H - 330, 54, C.gold, u0 + 1, u0, { weight: 800, family: DISPLAY });
    ctx.restore();
  }
}

// ---------------------------------------------------------------- E étape 1 inscription (u 44..60)
function sE(ctx, u, IMG) {
  ctx.save(); shake(ctx, u, 44, 12);
  fill(ctx, C.green);
  step(ctx, 1, S.x, S.y + 70, u, 43.5);
  dropWord(ctx, 'Crée ton compte', S.x, S.y + 200, 104, C.white, u, 43.6);
  dropWord(ctx, 'c\'est gratuit', S.x, S.y + 300, 104, C.gold, u, 44.0);
  en(ctx, 'Create your account. It\'s free.', S.x, S.y + 390, C.mute, u, 45.4, 52);
  const img = IMG.signup; if (!img) { ctx.restore(); return; }
  const src = [0, 1180, 1170, 960], w = 840, sc = w / src[2], x = (W - w) / 2;
  const y = enter(u, 43.6, H + 60, S.y + 480);
  shot(ctx, img, src, x, y, w);
  ring(ctx, u, 49, x, y, sc, src, [48, 1212, 477, 123]);
  ring(ctx, u, 53, x, y, sc, src, [51, 1830, 1071, 126]);
  const tip = [[49, 'Touche « Je suis tresseuse »', 'Tap "Je suis tresseuse"'], [53, 'Ton e-mail + un mot de passe', 'Your e-mail + a password']];
  for (const [u0, fr, e] of tip) {
    const p = prog(u, u0, u0 + 0.3) * (u0 === 49 ? 1 - prog(u, 52.6, 53) : 1);
    if (p <= 0) continue;
    ctx.save(); ctx.globalAlpha = p;
    const b = para(ctx, fr, S.x, H - 360, 56, C.gold, u, u0, { weight: 800, family: DISPLAY });
    en(ctx, e, S.x, b - 6, C.white, u, u0 + 0.3, 46);
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- F étape 2 styles et prix (u 60..74)
function sF(ctx, u, IMG) {
  ctx.save(); shake(ctx, u, 60, 12);
  fill(ctx, C.deep);
  step(ctx, 2, S.x, S.y + 70, u, 59.5);
  dropWord(ctx, 'Coche tes styles', S.x, S.y + 200, 104, C.white, u, 59.6);
  dropWord(ctx, 'et mets tes prix', S.x, S.y + 300, 104, C.gold, u, 60.0);
  en(ctx, 'Tick your styles, set your prices.', S.x, S.y + 390, C.mute, u, 61.0, 50);
  const img = IMG.styles; if (!img) { ctx.restore(); return; }
  const w = 800, x = (W - w) / 2;
  const scroll = M.kf(u, [[63, 0], [72, 170]], E.inOutSine);
  const src = [0, scroll, 1074, 1000], sc = w / 1074;
  const y = enter(u, 59.6, H + 60, S.y + 450);
  shot(ctx, img, src, x, y, w);
  const r = (row, u0) => {
    const p = E.outBack(prog(u, u0, u0 + 0.5), 2);
    if (p <= 0) return;
    ctx.save(); ctx.lineWidth = 9 * p; ctx.strokeStyle = C.gold;
    rrect(ctx, x + 729 * sc - 12, y + (row - scroll) * sc - 12, 300 * sc + 24, 114 * sc + 24, 18); ctx.stroke(); ctx.restore();
  };
  r(513, 65); r(789, 68);
  const p = prog(u, 65, 65.3);
  if (p > 0) {
    ctx.save(); ctx.globalAlpha = p;
    const b = para(ctx, 'Les prix en FCFA, affichés clairement', S.x, H - 330, 54, C.gold, u, 65, { weight: 800, family: DISPLAY });
    en(ctx, 'Prices in FCFA, shown upfront', S.x, b - 6, C.white, u, 65.3, 46);
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- G étape 3 le profil  +  H WhatsApp (u 74..98)
const DSRC = [24, 1690, 1122, 820];
function sG(ctx, u, IMG) {
  ctx.save(); shake(ctx, u, 74, 12);
  fill(ctx, C.green);
  step(ctx, 3, S.x, S.y + 70, u, 73.5);
  dropWord(ctx, 'Ton profil complet', S.x, S.y + 200, 100, C.white, u, 73.6);
  let b = para(ctx, 'Ton quartier, à domicile ou non, ton expérience et les avis de tes clientes.', S.x, S.y + 290, 50, C.gold, u, 75, { weight: 800, family: DISPLAY });
  en(ctx, 'Your area, home visits, experience and reviews.', S.x, b, C.mute, u, 76, 46);
  const img = IMG.detail; if (!img) { ctx.restore(); return; }
  const w = 880, sc = w / DSRC[2], x = (W - w) / 2;
  const y = enter(u, 73.6, H + 60, S.y + 620);
  shot(ctx, img, DSRC, x, y, w);
  ring(ctx, u, 79, x, y, sc, DSRC, [51, 1990, 510, 60]);
  ring(ctx, u, 82, x, y, sc, DSRC, [51, 2068, 837, 80]);
  const tip = [[79, 'Les avis de tes clientes', 'Reviews from your clients'], [82, 'À domicile ? Ton expérience ?', 'Home visits? Your experience?']];
  for (const [u0, fr, e] of tip) {
    const p = prog(u, u0, u0 + 0.3) * (u0 === 79 ? 1 - prog(u, 81.6, 82) : 1);
    if (p <= 0) continue;
    ctx.save(); ctx.globalAlpha = p;
    const b = para(ctx, fr, S.x, H - 330, 56, C.gold, u, u0, { weight: 800, family: DISPLAY });
    en(ctx, e, S.x, b - 6, C.white, u, u0 + 0.3, 46);
    ctx.restore();
  }
  ctx.restore();
}
function sH(ctx, u, IMG) {
  fill(ctx, C.deep);
  dropWord(ctx, 'Elles t\'écrivent', S.x, S.y + 120, 108, C.white, u, 85.4);
  dropWord(ctx, 'sur WhatsApp', S.x, S.y + 236, 108, C.gold, u, 86.05);
  en(ctx, 'They message you directly on WhatsApp.', S.x, S.y + 330, C.mute, u, 86.8, 50);
  const img = IMG.detail; if (!img) return;
  const src = [24, 2140, 1122, 392], w = 900, h = w * src[3] / src[2];
  const x = (W - w) / 2, y = enter(u, 85.6, H + 100, S.y + 470);
  const bx = (371 - src[0]) / src[2] * w, by = (2419 - src[1]) / src[3] * h;
  const z = springKeys(u, [[86, 1], [87.5, 1.25]], SPRING.gentle);
  ctx.save();
  ctx.translate(x + bx, y + by); ctx.scale(z, z); ctx.translate(-(x + bx), -(y + by));
  shot(ctx, img, src, x, y, w);
  for (const u0 of [88, 89, 90]) {
    const p = prog(u, u0, u0 + 0.9);
    if (p <= 0 || p >= 1) continue;
    const bw = 544 / src[2] * w, bh = 123 / src[2] * w;
    ctx.save(); ctx.globalAlpha = 1 - p; ctx.lineWidth = 8; ctx.strokeStyle = C.gold;
    const g = 10 + p * 46;
    rrect(ctx, x + bx - bw / 2 - g, y + by - bh / 2 - g, bw + 2 * g, bh + 2 * g, 18 + g); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  let b = para(ctx, 'Pas d\'intermédiaire : la cliente te contacte directement.', S.x, y + h * 1.25 + 150, 52, C.white, u, 88.5);
  b = en(ctx, 'No middleman: the client contacts you directly.', S.x, b, C.mute, u, 89, 46);
  b = para(ctx, 'Et tu vois combien de personnes ont vu ton profil.', S.x, b + 50, 52, C.gold, u, 92, { weight: 800, family: DISPLAY });
  en(ctx, 'And you see how many people viewed your profile.', S.x, b, C.mute, u, 92.5, 46);
  const q = E.inCubic(prog(u, 97.4, 98));
  if (q > 0) { ctx.beginPath(); ctx.arc(x + bx, y + by, q * 2300, 0, M.TAU); ctx.fillStyle = C.gold; ctx.fill(); }
}

// ---------------------------------------------------------------- I gratuit + offre (u 98..108)
function sI(ctx, u, IMG) {
  ctx.save(); shake(ctx, u, 98, 20);
  fill(ctx, C.gold);
  const gs = fitSize(ctx, 'GRATUIT', 800, DISPLAY, S.w, 240, -0.03);
  const k = springU(u, 97.95, SPRING.bouncy), sq = 1 + 0.18 * wobble(u - 98, 2.2, 5);
  const gy = S.y + 220;
  if (k > 0) {
    ctx.save(); ctx.translate(W / 2, gy); ctx.scale(lerp(1.7, 1, clamp(k)) / sq, lerp(1.7, 1, clamp(k)) * sq);
    text(ctx, 'GRATUIT', 0, 0, font(gs, 800, DISPLAY), C.ink, 'center', -0.03 * gs); ctx.restore();
  }
  para(ctx, 'L\'inscription est gratuite · Sign-up is FREE', W / 2, gy + 90, 48, C.deep, u, 98.6, { align: 'center', maxW: 2000 });
  const pk = springU(u, 100.8, SPRING.bouncy);
  if (pk > 0) {
    const cw = 900, ch = 1030, cx = (W - cw) / 2, cy = lerp(H, S.y + 360, pk);
    card(ctx, cx, cy, cw, ch, 40, C.green);
    star(ctx, cx + 74, cy + 86, 30, C.gold);
    text(ctx, 'OFFRE DE LANCEMENT', cx + 118, cy + 104, font(52, 800, DISPLAY), C.gold);
    text(ctx, 'Premium offert aux', cx + 44, cy + 210, font(60, 600, UI), C.white);
    const n = Math.round(75 * E.outCubic(prog(u, 102, 103)));
    text(ctx, String(n), cx + 40, cy + 400, font(210, 800, DISPLAY), C.gold, 'left', -6);
    text(ctx, 'premières', cx + 320, cy + 390, font(76, 800, DISPLAY), C.white);
    let b = para(ctx, 'pendant 1 mois + 1 semaine : ton profil en tête des résultats, avec le badge Premium.', cx + 44, cy + 500, 46, C.white, u, 103, { maxW: cw - 88 });
    b = en(ctx, 'Free Premium for the first 75: 1 month + 1 week at the top of the results, with the Premium badge.', cx + 44, b + 20, C.mute, u, 104, 42, { maxW: cw - 88 });
    const img = IMG.premium;
    if (img) {
      const pa = prog(u, 104.5, 105);
      if (pa > 0) { ctx.save(); ctx.globalAlpha = pa; shot(ctx, img, [0, 0, 1074, 410], cx + 44, Math.min(b + 10, cy + ch - 360), cw - 88); ctx.restore(); }
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- J fin (u 108..120)
function sJ(ctx, u, IMG) {
  ctx.save(); shake(ctx, u, 108, 14);
  fill(ctx, C.green);
  braid(ctx, H - 120, 120, C.gold, C.green, u * 30);
  braid(ctx, 0, 70, C.gold, C.green, -u * 30);
  const lk = springU(u, 107.6, SPRING.bouncy);
  if (IMG.logo && lk > 0) {
    const s = 210 * lk, lx = W / 2, ly = S.y + 150;
    ctx.save(); ctx.beginPath(); ctx.arc(lx, ly, s / 2 + 12, 0, M.TAU); ctx.fillStyle = C.gold; ctx.fill(); ctx.restore();
    ctx.drawImage(IMG.logo, lx - s / 2, ly - s / 2, s, s);
  }
  para(ctx, 'Tresseuses du Cameroun', W / 2, S.y + 340, 60, C.white, u, 108, { weight: 800, family: DISPLAY, align: 'center', maxW: 2000 });
  const url = 'tresseuses237.com';
  const us = fitSize(ctx, url, 800, DISPLAY, S.w + 20, 140, -0.02);
  const f = font(us, 800, DISPLAY), L = layout(ctx, url, f, -0.02 * us);
  const ux = (W - L.width) / 2, uy = S.y + 560;
  card(ctx, ux - 30, uy - us * 0.9, L.width + 60, us * 1.25, 28, C.gold);
  const shown = Math.floor(prog(u, 107.8, 109.4) * url.length + 1.0001);
  L.glyphs.forEach((g, j) => {
    if (j >= shown) return;
    const p = E.outBack(prog(u, 107.8 + j * 0.094, 107.8 + j * 0.094 + 0.35), 2);
    glyph(ctx, g.ch, ux + g.cx, uy, f, C.ink, p, p);
  });
  let b = para(ctx, 'Inscris-toi en 2 minutes', W / 2, uy + 190, 76, C.white, u, 110.8, { weight: 800, family: DISPLAY, align: 'center', maxW: 2000 });
  b = en(ctx, 'Sign up in 2 minutes · free', W / 2, b - 10, C.mute, u, 111.2, 54, { align: 'center', maxW: 2000 });
  b = para(ctx, 'Touche « Je suis tresseuse »', W / 2, b + 60, 52, C.gold, u, 112.5, { weight: 800, family: DISPLAY, align: 'center', maxW: 2000 });
  en(ctx, 'Tap "Je suis tresseuse" (I\'m a braider)', W / 2, b - 6, C.mute, u, 112.9, 44, { align: 'center', maxW: 2000 });
  const ak = prog(u, 113.5, 114);
  if (ak > 0) {
    const ay = b + 90 + 18 * Math.abs(Math.sin((u - 113.5) * Math.PI));
    ctx.save(); ctx.globalAlpha = ak; ctx.strokeStyle = C.gold; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(W / 2, ay); ctx.lineTo(W / 2, ay + 90); ctx.moveTo(W / 2 - 40, ay + 50); ctx.lineTo(W / 2, ay + 90); ctx.lineTo(W / 2 + 40, ay + 50); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

M.film({
  fonts: [font(100, 800, DISPLAY), font(40, 600, UI)],
  images: {
    home: 'assets/shots/home.png', signup: 'assets/shots/signup.png', styles: 'assets/shots/styles.png',
    detail: 'assets/shots/detail.png', premium: 'assets/shots/premium.png', logo: 'assets/logo.svg',
  },
  hits: HITS,
  draw(ctx, u, t, IMG) {
    if (u < 8) sA(ctx, u);
    else if (u < 18) sB(ctx, u);
    else if (u < 30) sC(ctx, u, IMG);
    else if (u < 44) sD(ctx, u, IMG);
    else if (u < 60) sE(ctx, u, IMG);
    else if (u < 74) sF(ctx, u, IMG);
    else if (u < 86) sG(ctx, u, IMG);
    else if (u < 98) sH(ctx, u, IMG);
    else if (u < 108) sI(ctx, u, IMG);
    else sJ(ctx, u, IMG);
  },
});
