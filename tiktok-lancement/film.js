// Tresseuses du Cameroun — TikTok de lancement : fonction pure du temps. window.seek(t) peint l'image t.
// Minutage en temps (u) sur la grille mesurée (120 bpm, 0,5 s par temps). Plan : docs/shotlist.md.
import * as M from './lib/motion.js';

const { W, H, FORMAT, E, prog, lerp, clamp, springU, springKeys, SPRING, wobble, shake, font, layout, glyph, text, fill, rrect, crop, bump, fitSize } = M;

// Couleurs de la marque (site tresseuses237.com). Un seul accent : l'or.
const C = { green: '#0f5a3a', deep: '#0a3f28', gold: '#f2b230', ink: '#13281d', white: '#ffffff', mute: '#cfe3d6' };
const DISPLAY = 'Display', UI = 'UI';
const S = FORMAT.safe;                       // zone sûre TikTok : x 72..930, y 250..1490

const HITS = [
  [0, 'Tu', 'impact'],
  [1, 'sais', 'pop', { pitch: 'D6' }],
  [2, 'tresser ?', 'pop', { pitch: 'G6' }],
  [3.75, 'tresse monte', 'whoosh', { len: 0.45, from: 500, to: 2600 }],
  [4, 'les clientes', 'thud'],
  [4.5, 'fiche arrive', 'pop', { pitch: 'B5' }],
  [8, 'DROP styles et prix', 'impact'],
  [10, 'prix knotless', 'tick'],
  [12, 'prix fulani', 'tick'],
  [14, 'WhatsApp', 'whoosh', { len: 0.4, from: 2600, to: 600 }],
  [16, 'bouton pulse', 'blip', { pitch: 'E6' }],
  [17, 'bouton pulse 2', 'blip', { pitch: 'B6' }],
  [19.75, 'bulle grossit', 'whoosh', { len: 0.4, from: 600, to: 3000 }],
  [20, 'GRATUIT', 'impact'],
  [22, 'Premium offert', 'bell', { pitch: 'D6' }],
  [22.5, 'compteur 75', 'coins'],
  [24, 'fin logo', 'impact'],
  [24.25, 'adresse', 'type', { len: 0.8, n: 9 }],
  [26, 'Inscris-toi', 'bell', { pitch: 'G6' }],
];

// ---------------------------------------------------------------- outils
// Bande tressée : chevrons dorés, comme sur le site et les affiches.
function braid(ctx, y, h, col, bg, shift = 0) {
  ctx.fillStyle = bg; ctx.fillRect(0, y, W, h);
  ctx.fillStyle = col;
  const s = h, off = ((shift % s) + s) % s;
  for (let x = -2 * s + off; x < W + 2 * s; x += s) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s / 2, y + h / 2); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + s / 2, y + h / 2); ctx.lineTo(x + s, y); ctx.lineTo(x + s, y + h); ctx.closePath(); ctx.fill();
  }
}
// Un mot qui tombe lettre par lettre et rebondit sur sa ligne de base.
function dropWord(ctx, str, x, base, size, color, u, u0, { stag = 0.035, cfg = SPRING.bouncy, from = -220, track = -0.03 } = {}) {
  const f = font(size, 800, DISPLAY), L = layout(ctx, str, f, track * size);
  L.glyphs.forEach((g, j) => {
    const k = springU(u, u0 + j * stag, cfg);
    if (k <= 0 || g.ch === ' ') return;
    glyph(ctx, g.ch, x + g.cx, base + (1 - k) * from, f, color, 1, lerp(1.25, 1, clamp(k)));
  });
  return L;
}
// Ligne de texte qui monte de derrière un masque.
function rise(ctx, str, x, base, f, color, u, u0, dur = 0.6) {
  const p = E.outQuint(prog(u, u0, u0 + dur));
  if (p <= 0) return;
  ctx.save(); ctx.beginPath(); ctx.rect(0, base - 200, W, 240); ctx.clip();
  text(ctx, str, x, base + (1 - p) * 120, f, color);
  ctx.restore();
}
function star(ctx, x, y, r, col) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); }
  ctx.closePath(); ctx.fillStyle = col; ctx.fill();
}
function card(ctx, x, y, w, h, r = 34, col = C.white) { rrect(ctx, x, y, w, h, r); ctx.fillStyle = col; ctx.fill(); }

// ---------------------------------------------------------------- S1 accroche  (u 0..4)
function s1(ctx, u) {
  fill(ctx, C.green);
  braid(ctx, H - 120, 120, C.gold, C.green, u * 30);
  const size = 200;
  const b1 = S.y + 560;
  dropWord(ctx, 'Tu sais', S.x, b1, size, C.white, u, -0.3);
  ctx.save(); ctx.beginPath(); ctx.rect(0, b1 + 30, W, size * 1.2); ctx.clip();
  dropWord(ctx, 'tresser ?', S.x, b1 + size * 0.98, size, C.gold, u, 2 - 0.12, { from: 240 });
  ctx.restore();
  rise(ctx, 'Alors écoute bien.', S.x + 6, b1 + size * 1.75, font(58, 600, UI), C.mute, u, 2.6);
  // transition : la tresse dorée monte et couvre l'écran (fond or du plan 2)
  const w = E.inOutCubic(prog(u, 3.4, 4));
  if (w > 0) {
    const top = lerp(H - 120, -140, w);
    ctx.fillStyle = C.gold; ctx.fillRect(0, top + 120, W, H);
    braid(ctx, top, 120, C.gold, C.green, u * 30);
  }
}

// ---------------------------------------------------------------- S2 les clientes te cherchent  (u 4..8)
function s2(ctx, u, IMG) {
  fill(ctx, C.gold);
  dropWord(ctx, 'Les clientes', S.x, S.y + 150, 132, C.ink, u, 3.8, { stag: 0.02 });
  dropWord(ctx, 'te cherchent.', S.x, S.y + 150 + 132, 132, C.ink, u, 4.25, { stag: 0.025 });
  const img = IMG.card; if (!img) return;
  const src = [0, 790, img.width, img.height - 790], w = 860, h = w * src[3] / src[2];
  const k = springU(u, 3.75, SPRING.bouncy);
  const x = lerp(W + 60, (W - w) / 2 + 10, k), y = S.y + 470;
  const rot = lerp(0.22, -0.035, clamp(k)) + 0.02 * wobble(u - 4.3, 1.6, 3);
  const z = M.kf(u, [[6.2, 1], [8, 1.16]], E.inCubic);         // poussée lente vers la carte avant la coupe
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot); ctx.scale(z, z); ctx.translate(-w / 2, -h / 2);
  ctx.shadowColor = 'rgba(19,40,29,.35)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 24;
  card(ctx, -10, -10, w + 20, h + 20, 40);
  ctx.shadowColor = 'transparent';
  rrect(ctx, 0, 0, w, h, 32); ctx.save(); ctx.clip(); crop(ctx, img, src, 0, 0, w, h); ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- S3 DROP styles et prix  (u 8..14)
function s3(ctx, u, IMG) {
  ctx.save(); shake(ctx, u, 8, 18);
  fill(ctx, C.green);
  dropWord(ctx, 'Montre tes styles', S.x, S.y + 120, 104, C.white, u, 7.7, { stag: 0.02, cfg: SPRING.snappy, from: -120 });
  dropWord(ctx, 'et tes prix', S.x, S.y + 120 + 112, 104, C.gold, u, 8.0, { stag: 0.025, cfg: SPRING.snappy, from: -120 });
  const img = IMG.styles; if (!img) { ctx.restore(); return; }
  // carte blanche : vraie liste du site (cases cochées et prix en FCFA)
  const src = [0, 0, 1074, 1240], w = 840, h = w * src[3] / src[2];
  const k = springU(u, 7.6, SPRING.snappy);
  const x = (W - w) / 2, y = lerp(H, S.y + 320, k);
  const scroll = M.kf(u, [[9.5, 0], [13.5, 170]], E.inOutSine);   // défilement doux
  ctx.save();
  card(ctx, x - 8, y - 8, w + 16, h + 16, 36);
  rrect(ctx, x, y, w, h, 30); ctx.clip();
  crop(ctx, img, [src[0], src[1] + scroll, src[2], src[3]], x, y, w, h);
  ctx.restore();
  // surlignage or sur le prix des knotless (temps 10) puis des fulani (temps 12)
  const sx = w / src[2];
  const ring = (row, u0) => {
    const p = E.outBack(prog(u, u0, u0 + 0.5), 2);
    if (p <= 0) return;
    const ry = y + (row - scroll) * sx;
    ctx.save(); ctx.lineWidth = 9 * p; ctx.strokeStyle = C.gold;
    rrect(ctx, x + 729 * sx - 12, ry - 12, 300 * sx + 24, 114 * sx + 24, 18); ctx.stroke();
    ctx.restore();
  };
  ring(513, 10); ring(789, 12);
  ctx.restore();
}

// ---------------------------------------------------------------- S4 WhatsApp  (u 14..20)
function s4(ctx, u, IMG) {
  fill(ctx, C.deep);
  dropWord(ctx, "Elles t'écrivent", S.x, S.y + 120, 108, C.white, u, 13.7, { stag: 0.02, cfg: SPRING.snappy, from: -120 });
  dropWord(ctx, 'sur WhatsApp', S.x, S.y + 120 + 116, 108, C.gold, u, 14.05, { stag: 0.025, cfg: SPRING.snappy, from: -120 });
  const img = IMG.detail; if (!img) return;
  // vrai panneau « Contacter » de la fiche (capture du site), cadré puis poussé vers le bouton vert
  const src = [24, 2140, 1122, 392], w = 900, h = w * src[3] / src[2];
  const k = springU(u, 13.6, SPRING.snappy);
  const x = (W - w) / 2, y = lerp(H + 100, S.y + 520, k);
  const bx = (371 - src[0]) / src[2] * w, by = (2419 - src[1]) / src[3] * h;   // centre du bouton WhatsApp dans la carte
  const z = springKeys(u, [[14, 1], [15.5, 1.3]], SPRING.gentle);
  ctx.save();
  ctx.translate(x + bx, y + by); ctx.scale(z, z); ctx.translate(-(x + bx), -(y + by));
  card(ctx, x - 8, y - 8, w + 16, h + 16, 36);
  rrect(ctx, x, y, w, h, 30); ctx.save(); ctx.clip(); crop(ctx, img, src, x, y, w, h); ctx.restore();
  // pulsations dorées autour du bouton sur les temps 16 et 17
  for (const u0 of [16, 17, 18]) {
    const p = prog(u, u0, u0 + 0.9);
    if (p <= 0 || p >= 1) continue;
    const bw = 544 / src[2] * w, bh = 123 / src[2] * w;
    ctx.save(); ctx.globalAlpha = 1 - p; ctx.lineWidth = 8; ctx.strokeStyle = C.gold;
    const g = 10 + p * 46;
    rrect(ctx, x + bx - bw / 2 - g, y + by - bh / 2 - g, bw + 2 * g, bh + 2 * g, 18 + g); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  rise(ctx, 'Directement sur ton téléphone.', S.x, S.y + 520 + h * 1.3 + 150, font(58, 600, UI), C.mute, u, 15.6);
  // transition : un disque or grossit depuis le bouton et remplit l'écran (fond du plan 5)
  const q = E.inCubic(prog(u, 19.4, 20));
  if (q > 0) {
    ctx.beginPath(); ctx.arc(x + bx, y + by, q * 2300, 0, M.TAU); ctx.fillStyle = C.gold; ctx.fill();
  }
}

// ---------------------------------------------------------------- S5 gratuit + offre  (u 20..24)
function s5(ctx, u, IMG) {
  ctx.save(); shake(ctx, u, 20, 22);
  fill(ctx, C.gold);
  // « GRATUIT » s'écrase sur le temps fort
  const gs = fitSize(ctx, 'GRATUIT', 800, DISPLAY, S.w, 260, -0.03);
  const k = springU(u, 19.95, SPRING.bouncy);
  const sq = 1 + 0.18 * wobble(u - 20, 2.2, 5);
  const gy = lerp(S.y + 330, S.y + 300, E.outCubic(prog(u, 21.6, 22.2)));
  if (k > 0) {
    ctx.save(); ctx.translate(W / 2, gy); ctx.scale(lerp(1.7, 1, clamp(k)) / sq, lerp(1.7, 1, clamp(k)) * sq);
    text(ctx, 'GRATUIT', 0, 0, font(gs, 800, DISPLAY), C.ink, 'center', -0.03 * gs); ctx.restore();
  }
  rise(ctx, 'pour les tresseuses', W / 2 - 248, gy + 90, font(58, 600, UI), C.ink, u, 20.6);
  // offre de lancement
  const pk = springU(u, 21.9, SPRING.bouncy);
  if (pk > 0) {
    const cw = 860, ch = 520, cx = (W - cw) / 2, cy = lerp(H, S.y + 520, pk);
    card(ctx, cx, cy, cw, ch, 40, C.green);
    // étiquette Premium (étoile dessinée : le glyphe ★ n'existe pas dans les polices)
    star(ctx, cx + 78, cy + 92, 30, C.gold);
    text(ctx, 'Premium', cx + 122, cy + 114, font(64, 800, DISPLAY), C.gold);
    text(ctx, 'offert aux', cx + 44, cy + 220, font(64, 600, UI), C.white);
    // compteur 0 -> 75
    const n = Math.round(75 * E.outCubic(prog(u, 22.5, 23.4)));
    text(ctx, String(n), cx + 40, cy + 410, font(220, 800, DISPLAY), C.gold, 'left', -6);
    text(ctx, 'premières', cx + 330, cy + 400, font(78, 800, DISPLAY), C.white);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- S6 fin  (u 24..30)
function s6(ctx, u, IMG) {
  ctx.save(); shake(ctx, u, 24, 14);
  fill(ctx, C.green);
  braid(ctx, H - 120, 120, C.gold, C.green, u * 30);
  braid(ctx, 0, 70, C.gold, C.green, -u * 30);
  // logo
  const lk = springU(u, 23.6, SPRING.bouncy);
  if (IMG.logo && lk > 0) {
    const s = 230 * lk, lx = W / 2, ly = S.y + 190;
    ctx.save(); ctx.beginPath(); ctx.arc(lx, ly, s / 2 + 12, 0, M.TAU); ctx.fillStyle = C.gold; ctx.fill(); ctx.restore();
    ctx.drawImage(IMG.logo, lx - s / 2, ly - s / 2, s, s);
  }
  rise(ctx, 'Tresseuses du Cameroun', W / 2 - 330, S.y + 390, font(60, 800, DISPLAY), C.white, u, 24.0);
  // l'adresse s'écrit lettre par lettre
  const url = 'tresseuses237.com';
  const us = fitSize(ctx, url, 800, DISPLAY, S.w + 20, 140, -0.02);
  const f = font(us, 800, DISPLAY), L = layout(ctx, url, f, -0.02 * us);
  const ux = (W - L.width) / 2, uy = S.y + 620;
  card(ctx, ux - 30, uy - us * 0.9, L.width + 60, us * 1.25, 28, C.gold);
  const shown = Math.floor(prog(u, 23.8, 25.4) * url.length + 1.0001);
  L.glyphs.forEach((g, j) => {
    if (j >= shown) return;
    const p = E.outBack(prog(u, 23.8 + j * 0.094, 23.8 + j * 0.094 + 0.35), 2);
    glyph(ctx, g.ch, ux + g.cx, uy, f, C.ink, p, p);
  });
  // appel à l'action
  const ck = springU(u, 25.9, SPRING.bouncy);
  if (ck > 0) {
    const sz = 76 * ck;
    text(ctx, 'Inscris-toi en 2 minutes', W / 2, uy + 190, font(sz, 800, DISPLAY), C.white, 'center');
    text(ctx, '100 % gratuit · Premium offert', W / 2, uy + 270, font(46 * ck, 600, UI), C.mute, 'center');
  }
  // flèche qui sautille vers la légende (lien)
  const ak = prog(u, 26.5, 27);
  if (ak > 0) {
    const ay = uy + 360 + 18 * Math.abs(Math.sin((u - 26.5) * Math.PI));
    ctx.save(); ctx.globalAlpha = ak; ctx.strokeStyle = C.gold; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(W / 2, ay); ctx.lineTo(W / 2, ay + 90); ctx.moveTo(W / 2 - 40, ay + 50); ctx.lineTo(W / 2, ay + 90); ctx.lineTo(W / 2 + 40, ay + 50); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

M.film({
  fonts: [font(100, 800, DISPLAY), font(40, 600, UI)],
  images: {
    card: 'assets/shots/card.png', styles: 'assets/shots/styles.png',
    detail: 'assets/shots/detail.png', premium: 'assets/shots/premium.png', logo: 'assets/logo.svg',
  },
  hits: HITS,
  draw(ctx, u, t, IMG) {
    if (u < 4) s1(ctx, u);
    else if (u < 8) s2(ctx, u, IMG);
    else if (u < 14) s3(ctx, u, IMG);
    else if (u < 20) s4(ctx, u, IMG);
    else if (u < 24) s5(ctx, u, IMG);
    else s6(ctx, u, IMG);
  },
});
