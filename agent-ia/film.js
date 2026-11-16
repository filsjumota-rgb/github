// « C'est quoi un agent IA ? » – Jumota Agency. Short vertical 9:16, 45 s, sans voix.
// Pure function of time: window.seek(t) paints frame t. docs/shotlist.md is the plan this file follows.
// Every scene boundary sits on the 120 BPM grid (1 beat = 0.5 s), so times below are in seconds and
// HITS convert them to beats (u = 2 t).
import * as M from './lib/motion.js';

const { W, H, E, prog, lerp, clamp, SPRING, font, rrect, noise1, TAU } = M;

// Jumota palette: bleu nuit, bleu électrique (fills) + its light tint for type on dark, blanc.
const C = {
  bg0: '#071426', bg1: '#0B1E40', ink: '#FFFFFF', mute: '#9FB2D9', dim: '#3A5288',
  panel: '#0E2147', line: '#22407A', blue: '#126BFF', sky: '#5B9BFF', paper: '#FFFFFF', navy: '#071426', slate: '#51617F',
};
const SKY = (a) => `rgba(91,155,255,${a})`;
const DISPLAY = 'Display', UI = 'UI';
const X0 = 90, XR = 930, TW = XR - X0;   // text column inside the 9:16 safe area

// ------------------------------------------------------------------ helpers (all pure)
const sp = (t, t0, cfg = SPRING.snappy) => M.spring(t - t0, cfg);
const io = (t, a, d, ease = E.outCubic) => ease(prog(t, a, a + d));
const alpha = (ctx, a, fn) => { if (a <= 0.001) return; ctx.save(); ctx.globalAlpha *= clamp(a); fn(); ctx.restore(); };
function measure(ctx, str, f, track = 0) {
  ctx.font = f; ctx.letterSpacing = `${track}px`;
  const w = ctx.measureText(str).width; ctx.letterSpacing = '0px'; return w;
}
function txt(ctx, str, x, y, f, color, align = 'left', track = 0) {
  ctx.font = f; ctx.fillStyle = color; ctx.textAlign = align; ctx.letterSpacing = `${track}px`;
  ctx.fillText(str, x, y); ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
}
const fit = (ctx, str, base, maxW, weight = 800, family = DISPLAY) =>
  Math.min(base, Math.floor(base * maxW / Math.max(1, measure(ctx, str, font(base, weight, family), -0.02 * base))));
function scaleAt(ctx, kx, ky, x, y) { ctx.translate(x, y); ctx.scale(kx, ky); ctx.translate(-x, -y); }

// A line of words rising out of a mask, one after another. parts: [[word, color], ...] or a string.
function rise(ctx, parts, x, y, size, t0, t, { weight = 800, family = DISPLAY, stagger = 0.08, color = C.ink, track = -0.02, align = 'left' } = {}) {
  if (typeof parts === 'string') parts = parts.split(' ').map((w) => [w, color]);
  const f = font(size, weight, family), tr = track * size;
  const sw = measure(ctx, ' ', f);
  const ws = parts.map(([w]) => measure(ctx, w, f, tr));
  const total = ws.reduce((a, b) => a + b, 0) + sw * (parts.length - 1);
  let cx = align === 'center' ? x - total / 2 : x;
  ctx.save(); ctx.beginPath(); ctx.rect(cx - 60, y - size * 1.1, total + 120, size * 1.45); ctx.clip();
  parts.forEach(([w, col], i) => {
    const k = sp(t, t0 + i * stagger, SPRING.snappy);
    if (k > 0) txt(ctx, w, cx, y + (1 - k) * size * 1.15, f, col, 'left', tr);
    cx += ws[i] + sw;
  });
  ctx.restore();
  return total;
}
// A word that lands hard: drops in scaled up, squashes, settles.
function slam(ctx, str, x, y, size, t0, t, color = C.ink, align = 'left') {
  const k = sp(t, t0, { stiffness: 420, damping: 24 });
  if (k <= 0) return;
  const f = font(size, 800, DISPLAY), tr = -0.03 * size, w = measure(ctx, str, f, tr);
  const lx = align === 'center' ? x - w / 2 : x;
  const s = lerp(1.9, 1, k), sq = 1 + 0.1 * M.wobble(t - t0 - 0.12, 3.2, 7);
  ctx.save(); ctx.globalAlpha *= clamp(k * 2.5);
  scaleAt(ctx, s * sq, s / sq, lx + w / 2, y - size * 0.35);
  txt(ctx, str, lx, y, f, color, 'left', tr);
  ctx.restore();
}
function shakeAt(ctx, t, t0, amp, seed = 3) {
  if (t < t0) return;
  const a = amp * Math.exp(-(t - t0) / 0.07);
  if (a > 0.1) ctx.translate(a * noise1(t * 90, seed), a * noise1(t * 90, seed + 9));
}
function panel(ctx, x, y, w, h, r = 28, fillc = C.panel, stroke = C.line) {
  rrect(ctx, x, y, w, h, r); ctx.fillStyle = fillc; ctx.fill();
  if (stroke) { ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function disc(ctx, x, y, r, col) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = col; ctx.fill(); }
// Two-segment check mark drawn on with k (0..1).
function check(ctx, x, y, s, k, color = C.ink) {
  if (k <= 0) return;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = s * 0.17; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const p = [[x - s * 0.38, y + s * 0.02], [x - s * 0.1, y + s * 0.3], [x + s * 0.42, y - s * 0.3]];
  const L1 = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]), L2 = Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1]);
  const d = clamp(k) * (L1 + L2);
  ctx.beginPath(); ctx.moveTo(...p[0]);
  if (d <= L1) ctx.lineTo(lerp(p[0][0], p[1][0], d / L1), lerp(p[0][1], p[1][1], d / L1));
  else { ctx.lineTo(...p[1]); const q = (d - L1) / L2; ctx.lineTo(lerp(p[1][0], p[2][0], q), lerp(p[1][1], p[2][1], q)); }
  ctx.stroke(); ctx.restore();
}
function stroke(ctx, x0, y0, x1, y1, k, col, w) {
  if (k <= 0) return;
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(lerp(x0, x1, clamp(k)), lerp(y0, y1, clamp(k))); ctx.stroke(); ctx.restore();
}

// ------------------------------------------------------------------ pictograms (drawn in code, no logos)
function icMail(ctx, x, y, s, col = C.ink) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = s * 0.13; ctx.lineJoin = 'round';
  rrect(ctx, x - s, y - s * 0.7, s * 2, s * 1.4, s * 0.18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - s * 0.88, y - s * 0.55); ctx.lineTo(x, y + s * 0.1); ctx.lineTo(x + s * 0.88, y - s * 0.55); ctx.stroke();
  ctx.restore();
}
function icSocial(ctx, x, y, s, col = C.ink) {   // share graph: three nodes
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = s * 0.13;
  const a = [x - s * 0.6, y], b = [x + s * 0.6, y - s * 0.62], c = [x + s * 0.6, y + s * 0.62];
  ctx.beginPath(); ctx.moveTo(...b); ctx.lineTo(...a); ctx.lineTo(...c); ctx.stroke();
  [a, b, c].forEach(([px, py]) => disc(ctx, px, py, s * 0.3, col));
  ctx.restore();
}
function icGlobe(ctx, x, y, s, col = C.ink) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = s * 0.11;
  ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x, y, s * 0.42, s, 0, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - s * 0.86, y - s * 0.5); ctx.lineTo(x + s * 0.86, y - s * 0.5); ctx.moveTo(x - s * 0.86, y + s * 0.5); ctx.lineTo(x + s * 0.86, y + s * 0.5); ctx.stroke();
  ctx.restore();
}
function icSearch(ctx, x, y, s, col = C.ink) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = s * 0.17; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x - s * 0.15, y - s * 0.15, s * 0.58, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + s * 0.28, y + s * 0.28); ctx.lineTo(x + s * 0.8, y + s * 0.8); ctx.stroke();
  ctx.restore();
}
function icDoc(ctx, x, y, s, col = C.ink) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = s * 0.13; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  rrect(ctx, x - s * 0.7, y - s * 0.9, s * 1.4, s * 1.8, s * 0.16); ctx.stroke();
  [-0.42, -0.08, 0.26].forEach((dy, i) => { ctx.beginPath(); ctx.moveTo(x - s * 0.38, y + dy * s); ctx.lineTo(x + (i === 2 ? s * 0.1 : s * 0.38), y + dy * s); ctx.stroke(); });
  ctx.restore();
}
function icTarget(ctx, x, y, s, col = C.ink) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = s * 0.14;
  ctx.beginPath(); ctx.arc(x, y, s * 0.9, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, s * 0.5, 0, TAU); ctx.stroke();
  disc(ctx, x, y, s * 0.17, col); ctx.restore();
}
function icClock(ctx, x, y, s, col = C.ink) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = s * 0.14; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, s * 0.9, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y - s * 0.55); ctx.lineTo(x, y); ctx.lineTo(x - s * 0.38, y + s * 0.2); ctx.stroke();
  ctx.restore();
}
function icTools(ctx, x, y, s, col = C.ink) {   // toolbox
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = s * 0.14; ctx.lineJoin = 'round';
  rrect(ctx, x - s * 0.95, y - s * 0.35, s * 1.9, s * 1.15, s * 0.16); ctx.stroke();
  rrect(ctx, x - s * 0.38, y - s * 0.78, s * 0.76, s * 0.43, s * 0.12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - s * 0.95, y + s * 0.15); ctx.lineTo(x + s * 0.95, y + s * 0.15); ctx.stroke();
  ctx.restore();
}
function moon(ctx, x, y, r, col = C.sky) {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.arc(x + r * 0.45, y - r * 0.32, r * 0.86, 0, TAU, true);
  ctx.fillStyle = col; ctx.fill('evenodd'); ctx.restore();
}
function pointer(ctx, x, y, s) {   // mouse cursor, tip at (x, y)
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 66); ctx.lineTo(16, 51); ctx.lineTo(28, 78); ctx.lineTo(40, 72); ctx.lineTo(28, 46); ctx.lineTo(49, 46); ctx.closePath();
  ctx.fillStyle = C.ink; ctx.fill(); ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeStyle = C.navy; ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ background
function bg(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H); g.addColorStop(0, C.bg0); g.addColorStop(1, C.bg1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const orb = (x, y, r, rgb, a) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(${rgb},${a})`); rg.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  orb(W * 0.85 + 140 * noise1(t * 0.06, 2), H * 0.2 + 120 * noise1(t * 0.05, 5), 900, '18,107,255', 0.28);
  orb(W * 0.1 + 160 * noise1(t * 0.04, 8), H * 0.92, 950, '18,107,255', 0.14);
  ctx.save(); ctx.strokeStyle = 'rgba(159,178,217,0.05)'; ctx.lineWidth = 1;
  const step = 90, oy = -((t * 10) % step);
  ctx.beginPath();
  for (let x = 0; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = oy; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke(); ctx.restore();
}

// ------------------------------------------------------------------ scenes
// Each scene draws itself from its local time lt (seconds since its start); transitions are
// applied by run(): 'whip' slides both scenes sideways together, 'up' lifts the old one away
// while the new one's first elements are already arriving.

// 1 · 0–4 s : l'accroche
function s1(ctx, t) {
  const y1 = 720, sz = 116, f = font(sz, 700, DISPLAY), sw = measure(ctx, ' ', f);
  let x = X0;
  [['C’est', -0.12], ['quoi', 0.45], ['un…', 0.9]].forEach(([w, t0]) => {
    const k = sp(t, t0, SPRING.bouncy), ww = measure(ctx, w, f, -2);
    if (k > 0) {
      ctx.save(); ctx.globalAlpha *= clamp(k * 3);
      ctx.translate(x + ww / 2, y1 - (1 - k) * 420); ctx.rotate((1 - k) * -0.25);
      txt(ctx, w, -ww / 2, 0, f, C.ink, 'left', -2); ctx.restore();
    }
    x += ww + sw;
  });
  const big = fit(ctx, 'AGENT', 300, TW);
  ctx.save(); shakeAt(ctx, t, 1.75, 26); shakeAt(ctx, t, 2.25, 18, 7);
  slam(ctx, 'AGENT', X0 - 6, y1 + big * 0.95, big, 1.75, t, C.ink);
  slam(ctx, 'IA ?', X0 - 6, y1 + big * 1.85, big, 2.25, t, C.sky);
  ctx.restore();
  // a slow underline sweeps under the question once it has landed
  const k = io(t, 2.6, 0.6, E.outQuint);
  if (k > 0) { ctx.fillStyle = C.blue; rrect(ctx, X0, y1 + big * 2.07, (TW - 40) * k, 16, 8); ctx.fill(); }
}

// 2 · 4–7 s : pas un robot de film
function robot(ctx, x, y, s, t, struck) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const metal = struck > 0 ? M.mix('#D9E3F5', '#7F8DAA', struck) : '#D9E3F5', dark = '#1A2C52';
  const glow = struck > 0 ? M.mix('#5B9BFF', '#2A3B60', struck) : '#5B9BFF';
  // legs + body
  ctx.fillStyle = metal;
  rrect(ctx, -110, 150, 70, 150, 20); ctx.fill(); rrect(ctx, 40, 150, 70, 150, 20); ctx.fill();
  rrect(ctx, -170, -20, 340, 220, 40); ctx.fill();
  ctx.fillStyle = dark; rrect(ctx, -95, 30, 190, 110, 20); ctx.fill();
  [0, 1, 2].forEach((i) => { disc(ctx, -50 + i * 50, 85, 16, i === Math.floor(t * 4) % 3 && !struck ? glow : '#34507F'); });
  // arms: left hangs, right waves
  const wave = struck > 0 ? 0 : Math.sin(t * 11) * 0.45 * io(t, 0.35, 0.2);
  ctx.save(); ctx.translate(-178, 10); ctx.rotate(0.18); ctx.fillStyle = metal; rrect(ctx, -34, 0, 52, 190, 24); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(178, 10); ctx.rotate(-2.5 + wave); ctx.fillStyle = metal; rrect(ctx, -18, 0, 52, 190, 24); ctx.fill();
  disc(ctx, 8, 196, 34, metal); ctx.restore();
  // head
  ctx.fillStyle = metal; ctx.fillRect(-30, -60, 60, 50);
  rrect(ctx, -150, -290, 300, 240, 48); ctx.fill();
  ctx.fillStyle = dark; rrect(ctx, -115, -245, 230, 120, 36); ctx.fill();
  const blink = Math.abs(Math.sin(t * 1.7)) > 0.97 ? 0.15 : 1;
  ctx.save(); ctx.translate(0, -185); ctx.scale(1, blink);
  disc(ctx, -50, 0, 30, glow); disc(ctx, 50, 0, 30, glow); ctx.restore();
  ctx.fillStyle = '#34507F'; rrect(ctx, -60, -105, 120, 20, 10); ctx.fill();
  // antenna
  ctx.fillStyle = metal; ctx.fillRect(-6, -360, 12, 72);
  disc(ctx, 0, -370, 22, Math.floor(t * 3) % 2 && !struck ? glow : metal);
  ctx.restore();
}
function s2(ctx, t) {
  const k = sp(t, -0.12, SPRING.bouncy);
  const struck = io(t, 1.0, 0.4);
  const by = 1100 + (1 - k) * 1100 + Math.sin(t * 4.2) * 10 * (1 - struck);
  ctx.save(); shakeAt(ctx, t, 1.0, 22); shakeAt(ctx, t, 1.18, 16, 5);
  robot(ctx, 540, by, lerp(1.2, 1.12, struck), t, struck);
  // the cross: two thick strokes in brand blue
  const a = io(t, 1.0, 0.16, E.outQuad), b = io(t, 1.18, 0.16, E.outQuad);
  stroke(ctx, 250, 680, 830, 1430, a, C.blue, 54);
  stroke(ctx, 830, 680, 250, 1430, b, C.blue, 54);
  ctx.restore();
  rise(ctx, [['Pas', C.sky], ['un', C.ink], ['robot', C.ink]], X0, 440, 108, 1.0, t);
  rise(ctx, 'de film.', X0, 560, 108, 1.12, t);
}

// 3 · 7–10 s : un assistant qui travaille tout seul
function s3(ctx, t) {
  rise(ctx, 'C’est un assistant', X0, 470, 84, -0.1, t);
  rise(ctx, 'qui travaille…', X0, 570, 84, 0.2, t);
  const big = fit(ctx, 'TOUT SEUL.', 200, TW);
  ctx.save(); shakeAt(ctx, t, 1.5, 22);
  slam(ctx, 'TOUT SEUL.', X0 - 4, 570 + big * 1.15, big, 1.5, t, C.sky);
  ctx.restore();
  // a task card that runs itself
  const k = sp(t, 0.3, SPRING.gentle);
  if (k <= 0) return;
  const cx = X0, cy = 940 + (1 - k) * 260, cw = TW, ch = 470;
  ctx.save(); ctx.globalAlpha *= clamp(k * 2);
  panel(ctx, cx, cy, cw, ch, 34);
  txt(ctx, 'Tâches du jour', cx + 44, cy + 78, font(44, 800, UI), C.ink);
  // AUTO switch flips on by itself
  const on = io(t, 1.45, 0.25, E.outBack);
  const sx = cx + cw - 196, sy = cy + 40;
  rrect(ctx, sx, sy, 150, 58, 29); ctx.fillStyle = M.mix('#22407A', C.blue, clamp(on)); ctx.fill();
  txt(ctx, 'AUTO', sx + 24 + 52 * (1 - clamp(on)) * 0, sy + 39, font(24, 800, UI), clamp(on) > 0.5 ? C.ink : C.mute, 'left', 1);
  disc(ctx, sx + lerp(30, 120, on), sy + 29, 22, C.ink);
  [['Chercher les infos', 1.75], ['Écrire le résumé', 2.05], ['Envoyer le mail', 2.35]].forEach(([label, tc], i) => {
    const ry = cy + 150 + i * 98, done = io(t, tc, 0.22);
    rrect(ctx, cx + 44, ry, 56, 56, 14);
    if (done > 0) { ctx.fillStyle = C.blue; ctx.fill(); } else { ctx.lineWidth = 3; ctx.strokeStyle = C.dim; ctx.stroke(); }
    check(ctx, cx + 72, ry + 28, 38, io(t, tc, 0.2), C.ink);
    txt(ctx, label, cx + 128, ry + 43, font(44, 600, UI), done > 0.5 ? C.ink : C.mute);
  });
  ctx.restore();
}

// 4 · 10–11 s : tu lui donnes 3 choses
function s4(ctx, t) {
  rise(ctx, 'Tu lui donnes', X0, 700, 112, -0.12, t);
  const k = sp(t, 0.12, SPRING.bouncy);
  if (k > 0) {
    const f = font(640, 800, DISPLAY), w3 = measure(ctx, '3', f);
    ctx.save(); scaleAt(ctx, k, k, X0 + w3 / 2, 1300);
    txt(ctx, '3', X0 - 20, 1360, f, C.sky); ctx.restore();
    rise(ctx, 'choses :', X0 + w3 + 10, 1300, 112, 0.22, t);
  }
}

// 5–7 · 11–26 s : les trois ingrédients. Shared header: number badge, article, keyword, progress.
function itemHeader(ctx, t, n, art, word) {
  const kb = sp(t, -0.3, SPRING.bouncy);
  if (kb > 0) {
    ctx.save(); scaleAt(ctx, kb, kb, X0 + 58, 450);
    disc(ctx, X0 + 58, 450, 58, C.blue);
    txt(ctx, String(n), X0 + 58, 477, font(76, 800, DISPLAY), C.ink, 'center');
    ctx.restore();
  }
  rise(ctx, art, X0 + 146, 478, 72, -0.25, t, { color: C.ink, weight: 700 });
  const sz = fit(ctx, word, 190, TW);
  rise(ctx, word, X0 - 4, 478 + sz * 1.02, sz, -0.18, t, { color: C.sky });
  // progress: three segments, the current one lit
  [0, 1, 2].forEach((i) => {
    ctx.fillStyle = i < n ? (i === n - 1 ? C.blue : SKY(0.45)) : 'rgba(159,178,217,0.18)';
    rrect(ctx, X0 + i * 112, 478 + sz * 1.02 + 46, 96, 12, 6); ctx.fill();
  });
}
function quoteCard(ctx, t, str, t0, dur, y = 1360) {
  const k = sp(t, t0 - 0.25, SPRING.snappy);
  if (k <= 0) return;
  const n = Math.round(io(t, t0, dur, E.linear) * str.length);
  const f = font(54, 700, UI);
  ctx.save(); ctx.globalAlpha *= clamp(k * 2); ctx.translate(0, (1 - k) * 60);
  panel(ctx, X0, y, TW, 128, 64, C.panel, C.blue);
  const shown = str.slice(0, n);
  txt(ctx, shown, X0 + 56, y + 83, f, C.ink);
  if (n < str.length || Math.floor(t * 2.2) % 2 === 0) {   // caret
    const cw = measure(ctx, shown, f);
    ctx.fillStyle = C.sky; ctx.fillRect(X0 + 62 + cw, y + 36, 5, 60);
  }
  ctx.restore();
}

const MISSION_HIT = 1.0;   // arrow lands, lt
function s5(ctx, t) {
  itemHeader(ctx, t, 1, 'Une', 'MISSION');
  const cx = 540, cy = 1020, k = sp(t, -0.3, SPRING.bouncy);
  const hitW = 1 + 0.05 * M.wobble(t - MISSION_HIT, 3, 6);
  if (k > 0) {
    ctx.save(); scaleAt(ctx, k * hitW, k * hitW, cx, cy);
    [[230, C.ink], [172, C.blue], [114, C.ink], [56, C.blue]].forEach(([r, c]) => disc(ctx, cx, cy, r, c));
    ctx.restore();
  }
  // arrow flies in from top right and sticks in the bullseye
  const p = E.inQuad(prog(t, MISSION_HIT - 0.3, MISSION_HIT));
  if (p > 0) {
    const sx = cx + 760, sy = cy - 760, tx = lerp(sx, cx, p), ty = lerp(sy, cy, p);
    const a = Math.atan2(cy - sy, cx - sx), quiver = t > MISSION_HIT ? 0.06 * M.ring(t - MISSION_HIT, 7, 6) : 0;
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(a + quiver);
    ctx.fillStyle = C.navy; ctx.fillRect(-300, -8, 290, 16);
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-30, -22); ctx.lineTo(-30, 22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.sky;
    ctx.beginPath(); ctx.moveTo(-300, -8); ctx.lineTo(-340, -52); ctx.lineTo(-250, -8); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-300, 8); ctx.lineTo(-340, 52); ctx.lineTo(-250, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  quoteCard(ctx, t, '« Résumer l’actu IA »', 1.45, 0.9);
}

const CLOCK = { a: 0.4, b: 2.0 };   // hands spin from 12:00 to 7:00 between these local times
function clockFrac(t) { return E.inOutCubic(prog(t, CLOCK.a, CLOCK.b)); }
function s6(ctx, t) {
  itemHeader(ctx, t, 2, 'Un', 'HORAIRE');
  const cx = 540, cy = 1020, R = 228, k = sp(t, -0.3, SPRING.bouncy);
  if (k <= 0) return;
  const land = io(t, CLOCK.b, 0.5, E.outCubic);
  // sunrise rays behind the clock once it hits 7h
  if (land > 0) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.25);
    ctx.strokeStyle = SKY(0.55 * land); ctx.lineWidth = 14; ctx.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU, r0 = R + 30, r1 = R + 30 + (i % 2 ? 50 : 90) * land;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke();
    }
    ctx.restore();
  }
  const ringS = 1 + 0.045 * M.ring(t - CLOCK.b, 9, 5);
  ctx.save(); scaleAt(ctx, k * ringS, k * ringS, cx, cy);
  ctx.translate(cx, cy); ctx.rotate(0.04 * M.ring(t - CLOCK.b, 11, 5)); ctx.translate(-cx, -cy);
  disc(ctx, cx, cy, R + 18, C.blue); disc(ctx, cx, cy, R, C.ink);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU, r0 = i % 3 ? R - 34 : R - 52;
    ctx.strokeStyle = C.navy; ctx.lineWidth = i % 3 ? 7 : 12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx + Math.sin(a) * r0, cy - Math.cos(a) * r0); ctx.lineTo(cx + Math.sin(a) * (R - 18), cy - Math.cos(a) * (R - 18)); ctx.stroke();
  }
  const f = clockFrac(t), hours = 7 * f;
  const am = hours * TAU, ah = (hours / 12) * TAU;
  ctx.strokeStyle = C.navy; ctx.lineCap = 'round';
  ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(ah) * R * 0.5, cy - Math.cos(ah) * R * 0.5); ctx.stroke();
  ctx.strokeStyle = C.blue; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(am) * R * 0.78, cy - Math.cos(am) * R * 0.78); ctx.stroke();
  disc(ctx, cx, cy, 20, C.navy);
  ctx.restore();
  // 7:00 tag pops off the rim
  const kt = sp(t, CLOCK.b, SPRING.bouncy);
  if (kt > 0) {
    ctx.save(); scaleAt(ctx, kt, kt, cx + 210, cy - 210);
    rrect(ctx, cx + 120, cy - 262, 200, 104, 52); ctx.fillStyle = C.blue; ctx.fill();
    txt(ctx, '7:00', cx + 220, cy - 190, font(58, 800, DISPLAY), C.ink, 'center');
    ctx.restore();
  }
  quoteCard(ctx, t, '« Chaque matin à 7h »', 2.4, 0.9);
}

const TOOLS = [['Email', icMail, 0.5], ['Réseaux|sociaux', icSocial, 1.0], ['Web', icGlobe, 1.5]];
const LINK_T = 2.1;
function s7(ctx, t) {
  itemHeader(ctx, t, 3, 'Des', 'OUTILS');
  const ty = 960, xs = [220, 510, 800], node = [510, 1330];
  // links from your agent to each tool, with data running along them
  TOOLS.forEach((_, i) => {
    const k = io(t, LINK_T + i * 0.12, 0.35);
    if (k <= 0) return;
    const x0 = node[0], y0 = node[1] - 80, x1 = xs[i], y1 = ty + 220;
    ctx.save(); ctx.strokeStyle = SKY(0.7); ctx.lineWidth = 6; ctx.setLineDash([2, 16]); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(lerp(x0, x1, k), lerp(y0, y1, k)); ctx.stroke(); ctx.restore();
    if (k >= 1) {
      const q = ((t - LINK_T - i * 0.25) * 1.1) % 1;
      disc(ctx, lerp(x1, x0, q), lerp(y1, y0, q), 11, C.ink);
    }
  });
  const kn = sp(t, LINK_T - 0.15, SPRING.bouncy);
  if (kn > 0) {
    ctx.save(); scaleAt(ctx, kn, kn, ...node);
    disc(ctx, node[0], node[1], 86, C.blue);
    txt(ctx, 'IA', node[0], node[1] + 22, font(62, 800, DISPLAY), C.ink, 'center');
    ctx.restore();
    alpha(ctx, io(t, LINK_T + 0.2, 0.3), () => txt(ctx, 'ton agent', node[0] + 112, node[1] + 16, font(46, 700, UI), C.mute));
  }
  TOOLS.forEach(([label, ic, t0], i) => {
    const k = sp(t, t0, SPRING.bouncy);
    if (k <= 0) return;
    const x = xs[i], s = 168;
    ctx.save(); scaleAt(ctx, k, k, x, ty);
    rrect(ctx, x - s / 2, ty - s / 2, s, s, 42); ctx.fillStyle = C.blue; ctx.fill();
    ic(ctx, x, ty, 44, C.ink);
    label.split('|').forEach((l, j) => txt(ctx, l, x, ty + s / 2 + 60 + j * 50, font(44, 700, UI), C.ink, 'center'));
    ctx.restore();
  });
}

// 8 · 26–31 s : l'équation
const EQ_SLAM = 2.5;
function s8(ctx, t) {
  const rows = [['', icTarget, 'Mission', -0.1], ['+', icClock, 'Horaire', 0.5], ['+', icTools, 'Outils', 1.0]];
  const dimR = io(t, EQ_SLAM, 0.4);
  rows.forEach(([op, ic, word, t0], i) => {
    const y = 560 + i * 170, k = sp(t, t0, SPRING.snappy);
    if (k <= 0) return;
    ctx.save(); ctx.globalAlpha *= clamp(k * 2) * (1 - 0.35 * dimR); ctx.translate((1 - k) * 260, 0);
    if (op) txt(ctx, op, X0, y, font(110, 800, DISPLAY), C.sky);
    disc(ctx, X0 + 150, y - 38, 54, C.blue); ic(ctx, X0 + 150, y - 38, 32, C.ink);
    txt(ctx, word, X0 + 236, y, font(108, 800, DISPLAY), C.ink, 'left', -2);
    ctx.restore();
  });
  // the rule
  const lk = io(t, 1.75, 0.45, E.inOutCubic);
  if (lk > 0) { ctx.fillStyle = C.ink; rrect(ctx, X0, 960, TW * lk, 10, 5); ctx.fill(); }
  // = AGENT IA, in a blue block that bursts open
  const kb = sp(t, EQ_SLAM - 0.08, { stiffness: 420, damping: 26 });
  if (kb > 0) {
    const bw = TW, bh = 250, by = 1040;
    ctx.save(); shakeAt(ctx, t, EQ_SLAM, 26);
    rrect(ctx, X0, by, bw * kb, bh, 40); ctx.fillStyle = C.blue; ctx.fill();
    // a ring pulse off the block
    const pr = io(t, EQ_SLAM, 0.8, E.outCubic);
    if (pr > 0 && pr < 1) { ctx.strokeStyle = SKY(0.6 * (1 - pr)); ctx.lineWidth = 8; rrect(ctx, X0 - 40 * pr, by - 40 * pr, bw + 80 * pr, bh + 80 * pr, 40 + 40 * pr); ctx.stroke(); }
    ctx.beginPath(); ctx.rect(X0, by, bw * kb, bh); ctx.clip();
    const sz = fit(ctx, '= AGENT IA', 150, bw - 100);
    slam(ctx, '= AGENT IA', X0 + bw / 2, by + bh / 2 + sz * 0.36, sz, EQ_SLAM, t, C.ink, 'center');
    ctx.restore();
  }
}

// 9 · 31–36 s : l'exemple concret
const STEPS = [['7h00', icSearch, 'Il cherche l’actu', 0.0], ['7h02', icDoc, 'Il résume', 1.0], ['7h05', icMail, 'C’est dans ta boîte', 2.0]];
const SLEEP_T = 3.0;
function s9(ctx, t) {
  alpha(ctx, io(t, -0.1, 0.3), () => txt(ctx, 'EXEMPLE CONCRET', X0, 390, font(34, 800, UI), C.mute, 'left', 4));
  // the digital clock follows the steps
  const idx = t < 1.0 ? 0 : t < 2.0 ? 1 : 2, lbl = ['7:00', '7:02', '7:05'][idx];
  const flip = idx ? sp(t, idx, SPRING.bouncy) : sp(t, -0.12, SPRING.bouncy);
  ctx.save(); ctx.beginPath(); ctx.rect(X0 - 20, 410, TW, 200); ctx.clip();
  txt(ctx, lbl, X0 - 6, 580 + (1 - flip) * 150, font(176, 800, DISPLAY), C.ink, 'left', -4);
  ctx.restore();
  STEPS.forEach(([tm, ic, label, t0], i) => {
    const k = sp(t, t0 - 0.1, SPRING.snappy);
    if (k <= 0) return;
    const y = 660 + i * 166;
    ctx.save(); ctx.translate((1 - k) * 700, 0);
    panel(ctx, X0, y, TW, 136, 30, i === 2 && t > t0 + 0.3 ? '#123070' : C.panel, C.line);
    txt(ctx, tm, X0 + 34, y + 86, font(50, 800, DISPLAY), C.sky);
    disc(ctx, X0 + 250, y + 68, 42, C.blue); ic(ctx, X0 + 250, y + 68, 24, C.ink);
    txt(ctx, label, X0 + 318, y + 85, font(48, 700, UI), C.ink);
    if (i === 2) {   // a "new mail" dot lands on the inbox
      const kd = sp(t, t0 + 0.35, SPRING.bouncy);
      if (kd > 0) { disc(ctx, X0 + 282, y + 36, 16 * kd, C.ink); }
    }
    ctx.restore();
  });
  // meanwhile: you're still asleep
  const km = sp(t, SLEEP_T - 0.1, SPRING.gentle);
  if (km > 0) {
    const y = 1260;
    ctx.save(); ctx.globalAlpha *= clamp(km * 2);
    moon(ctx, X0 + 60, y + 30 + (1 - km) * 80, 62, C.sky);
    ctx.restore();
    rise(ctx, [['Toi,', C.sky], ['tu', C.ink], ['dors', C.ink]], X0 + 160, y + 40, 86, SLEEP_T, t);
    rise(ctx, 'encore.', X0 + 160, y + 150, 86, SLEEP_T + 0.15, t);
    // Zzz drifting up
    [0, 1, 2].forEach((i) => {
      const lt = t - SLEEP_T - 0.4 - i * 0.35;
      if (lt <= 0) return;
      const q = (lt % 1.6) / 1.6;
      ctx.save(); ctx.globalAlpha *= Math.sin(q * Math.PI);
      txt(ctx, 'z', 700 + i * 52 + q * 60, y + 140 - q * 170 - i * 30, font(46 + i * 14, 800, DISPLAY), C.mute);
      ctx.restore();
    });
  }
}

// 10 · 36–40 s : la règle d'or
const CHECK_T = 2.5;
function s10(ctx, t) {
  const kp = sp(t, -0.15, SPRING.bouncy);
  if (kp > 0) {
    const f = font(34, 800, UI), w = measure(ctx, 'LA RÈGLE D’OR', f, 4) + 64;
    ctx.save(); scaleAt(ctx, kp, kp, X0 + w / 2, 430);
    rrect(ctx, X0, 392, w, 78, 39); ctx.fillStyle = SKY(0.12); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.sky; ctx.stroke();
    txt(ctx, 'LA RÈGLE D’OR', X0 + 32, 444, f, C.sky, 'left', 4);
    ctx.restore();
  }
  rise(ctx, 'L’IA prépare.', X0, 640, 110, 0.3, t);
  ctx.save(); shakeAt(ctx, t, 1.5, 22);
  slam(ctx, 'TOI,', X0 - 4, 840, 170, 1.5, t, C.sky);
  ctx.restore();
  rise(ctx, 'tu valides.', X0, 980, 110, 1.75, t);
  // the big check
  const kc = sp(t, CHECK_T, SPRING.bouncy), cx = 540, cy = 1270;
  if (kc > 0) {
    const pr = io(t, CHECK_T + 0.15, 0.9);
    if (pr < 1) { ctx.strokeStyle = SKY(0.6 * (1 - pr)); ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, 170 + 120 * pr, 0, TAU); ctx.stroke(); }
    ctx.save(); scaleAt(ctx, kc, kc, cx, cy);
    disc(ctx, cx, cy, 170, C.blue);
    check(ctx, cx, cy, 200, io(t, CHECK_T + 0.08, 0.3, E.outCubic), C.ink);
    ctx.restore();
  }
}

// 11 · 40–42 s : abonne-toi
const CLICK_T = 1.0;
function s11(ctx, t) {
  rise(ctx, 'Le tuto complet', X0, 620, 96, -0.12, t);
  rise(ctx, [['est', C.ink], ['sur', C.ink], ['la', C.ink], ['chaîne', C.sky]], X0, 735, 96, 0.05, t);
  const cx = 520, cy = 1010, bw = 600, bh = 160;
  const kb = sp(t, 0.3, SPRING.bouncy);
  if (kb > 0) {
    const press = 1 - 0.07 * Math.sin(Math.PI * prog(t, CLICK_T - 0.04, CLICK_T + 0.14));
    const on = t >= CLICK_T;
    ctx.save(); scaleAt(ctx, kb * press, kb * press, cx, cy);
    rrect(ctx, cx - bw / 2, cy - bh / 2, bw, bh, bh / 2); ctx.fillStyle = on ? C.ink : C.blue; ctx.fill();
    const label = on ? 'Abonné' : 'S’abonner', f = font(62, 800, DISPLAY);
    const w = measure(ctx, label, f) + (on ? 90 : 0);
    txt(ctx, label, cx - w / 2 + (on ? 90 : 0), cy + 22, f, on ? C.blue : C.ink);
    if (on) check(ctx, cx - w / 2 + 34, cy, 64, io(t, CLICK_T, 0.2), C.blue);
    ctx.restore();
  }
  // the pointer glides in and clicks
  const kp = io(t, 0.45, 0.5, E.inOutCubic);
  if (kp > 0) {
    const px = lerp(980, cx + 220, kp), py = lerp(1420, cy + 40, kp);
    pointer(ctx, px, py, 1.25 * (1 - 0.1 * Math.sin(Math.PI * prog(t, CLICK_T - 0.04, CLICK_T + 0.14))));
  }
}

// 12 · 42–45 s : la signature, sur fond blanc
const WIPE = { x: 520, y: 1010 };
const DOT_T = 1.0;
function s12(ctx, t) {
  const r = Math.hypot(W, H) * E.inOutCubic(prog(t, -0.32, 0.02));
  if (r <= 0) return;
  ctx.save(); ctx.beginPath(); ctx.arc(WIPE.x, WIPE.y, r, 0, TAU); ctx.fillStyle = C.paper; ctx.fill(); ctx.clip();
  const f = font(218, 800, DISPLAY), tr = -8;
  const wWord = measure(ctx, 'jumota', f, tr), wDot = measure(ctx, '.', f, tr), total = wWord + wDot;
  const x0 = 520 - total / 2, y = 1030;
  // letters type on, each popping up from the baseline
  const L = M.layout(ctx, 'jumota', f, tr);
  L.glyphs.forEach((g, i) => {
    const k = sp(t, -0.24 + i * 0.08, SPRING.bouncy);
    if (k <= 0) return;
    M.glyph(ctx, g.ch, x0 + g.cx, y + (1 - k) * 90, f, C.navy, 1, lerp(0.55, 1, clamp(k)));
  });
  // the blue dot drops in and bounces
  const kd = sp(t, DOT_T - 0.25, { stiffness: 300, damping: 11 });
  if (kd > 0) {
    const sq = 1 + 0.25 * M.wobble(t - DOT_T + 0.05, 3, 6);
    ctx.save(); ctx.translate(x0 + wWord + wDot / 2, y - (1 - kd) * 700);
    ctx.scale(sq, 1 / sq); ctx.fillStyle = C.blue;
    ctx.font = f; ctx.letterSpacing = `${tr}px`; ctx.textAlign = 'center'; ctx.fillText('.', 0, 0); ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
    ctx.restore();
  }
  // tagline + a blue rule
  const kl = io(t, 1.5, 0.6, E.outQuint);
  if (kl > 0) { ctx.fillStyle = C.blue; rrect(ctx, 520 - 60 * kl, y + 70, 120 * kl, 8, 4); ctx.fill(); }
  const fa = font(44, 800, UI), fb = font(44, 500, UI);
  const a = 'Jumota Agency', b = '  ·  Marketing digital & IA';
  const wa = measure(ctx, a, fa), wb = measure(ctx, b, fb), tx = 520 - (wa + wb) / 2;
  const kt = sp(t, 1.35, SPRING.snappy);
  if (kt > 0) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, y + 100, W, 120); ctx.clip();
    const dy = (1 - kt) * 60;
    txt(ctx, a, tx, y + 170 + dy, fa, C.navy);
    txt(ctx, b, tx + wa, y + 170 + dy, fb, C.slate);
    ctx.restore();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ timeline
const SCENES = [
  { a: 0, b: 4, draw: s1, out: 'up' },
  { a: 4, b: 7, draw: s2, out: 'up' },
  { a: 7, b: 10, draw: s3, out: 'up' },
  { a: 10, b: 11, draw: s4, out: 'whip' },
  { a: 11, b: 16, draw: s5, in: 'whip', out: 'whip' },
  { a: 16, b: 21, draw: s6, in: 'whip', out: 'whip' },
  { a: 21, b: 26, draw: s7, in: 'whip', out: 'up' },
  { a: 26, b: 31, draw: s8, out: 'up' },
  { a: 31, b: 36, draw: s9, out: 'up' },
  { a: 36, b: 40, draw: s10, out: 'up' },
  { a: 40, b: 42, draw: s11, out: 'none' },
  { a: 42, b: 45.5, draw: s12, top: true },
];
const WHIP = [-0.32, 0.08];   // whip window around a boundary
function run(ctx, S, t) {
  const lt = t - S.a, dur = S.b - S.a;
  if (lt < -0.45 || lt > dur + (S.out === 'none' ? 0.5 : 0.12)) return;
  ctx.save();
  if (S.in === 'whip') { const q = E.inOutCubic(prog(lt, WHIP[0], WHIP[1])); ctx.translate((1 - q) * W, 0); }
  if (S.out === 'whip') { const q = E.inOutCubic(prog(lt, dur + WHIP[0], dur + WHIP[1])); if (q >= 1) { ctx.restore(); return; } ctx.translate(-q * W, 0); }
  if (S.out === 'up') {
    const q = E.inCubic(prog(lt, dur - 0.3, dur));
    if (q >= 1) { ctx.restore(); return; }
    ctx.translate(0, -q * 520); ctx.globalAlpha *= 1 - q;
  }
  S.draw(ctx, lt);
  ctx.restore();
}
function draw(ctx, t) {
  bg(ctx, t);
  SCENES.forEach((S) => run(ctx, S, t));
}

// ------------------------------------------------------------------ hits: every accent gets a sound
const B = (s) => s * 2;   // seconds -> beats (120 BPM)
const HITS = [];
HITS.push([B(0), 'C’est', 'pop', { pitch: 'D5' }]);
HITS.push([B(0.5), 'quoi', 'pop', { pitch: 'F5' }]);
HITS.push([B(0.95), 'un…', 'pop', { pitch: 'A5' }]);
HITS.push([B(1.6), 'agent riser', 'riser', { len: 0.15 }]);
HITS.push([B(1.75), 'AGENT', 'impact']);
HITS.push([B(2.25), 'IA ?', 'thud']);
HITS.push([B(4.0), 'robot rises', 'whoosh', { len: 0.4, from: 400, to: 1600 }]);
HITS.push([B(4.25), 'robot lands', 'thud']);
for (let k = 0; k < 3; k++) HITS.push([B(4.5 + k * 0.17), `robot beep ${k}`, 'tok', { pitch: ['C6', 'E6', 'G6'][k] }]);
HITS.push([B(5.0), 'cross 1', 'thud']);
HITS.push([B(5.18), 'cross 2', 'thud']);
HITS.push([B(6.7), 'lift', 'whoosh', { len: 0.35 }]);
HITS.push([B(8.5), 'TOUT SEUL', 'impact']);
HITS.push([B(8.45), 'auto switch', 'click']);
[8.75, 9.05, 9.35].forEach((s, k) => HITS.push([B(s), `task ${k}`, 'blip', { pitch: ['A5', 'C6', 'E6'][k] }]));
HITS.push([B(9.7), 'lift', 'whoosh', { len: 0.35 }]);
HITS.push([B(10.12), '3', 'pop', { pitch: 'D5' }]);
[11, 16, 21].forEach((s, k) => HITS.push([B(s - 0.1), `whip ${k + 1}`, 'whoosh', { len: 0.4, from: 2400, to: 600 }]));
HITS.push([B(11 + MISSION_HIT - 0.3), 'arrow flies', 'whoosh', { len: 0.3, from: 800, to: 3000 }]);
HITS.push([B(11 + MISSION_HIT), 'bullseye', 'thud']);
HITS.push([B(12.45), 'type mission', 'type', { n: 14, len: 0.9 }]);
// one tick per hour the hands sweep past (inverse of the clock easing)
for (let h = 1; h <= 7; h++) {
  let lo = CLOCK.a, hi = CLOCK.b;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (clockFrac(m) * 7 < h) lo = m; else hi = m; }
  HITS.push([B(16 + lo), `hour ${h}`, 'tick']);
}
HITS.push([B(16 + CLOCK.b), '7h', 'bell', { pitch: 'A5' }]);
HITS.push([B(18.4), 'type horaire', 'type', { n: 14, len: 0.9 }]);
TOOLS.forEach(([, , t0], k) => HITS.push([B(21 + t0), `tool ${k}`, 'pop', { pitch: ['D5', 'F5', 'A5'][k] }]));
HITS.push([B(21 + LINK_T), 'agent node', 'blip', { pitch: 'D6' }]);
HITS.push([B(25.7), 'lift', 'whoosh', { len: 0.35 }]);
[26, 26.5, 27].forEach((s, k) => HITS.push([B(s), `eq row ${k}`, 'pop', { pitch: ['D5', 'F5', 'A5'][k] }]));
HITS.push([B(27.75), 'rule', 'whoosh', { len: 0.45, from: 600, to: 2000 }]);
HITS.push([B(26 + EQ_SLAM), '= AGENT IA', 'impact']);
HITS.push([B(30.7), 'lift', 'whoosh', { len: 0.35 }]);
[31, 32, 33].forEach((s, k) => HITS.push([B(s), `step ${k}`, 'blip', { pitch: ['E5', 'A5', 'D6'][k] }]));
HITS.push([B(33.35), 'mail lands', 'bell', { pitch: 'E6' }]);
HITS.push([B(34), 'asleep', 'tok', { pitch: 'A4' }]);
HITS.push([B(35.7), 'lift', 'whoosh', { len: 0.35 }]);
HITS.push([B(35.9), 'règle d’or', 'pop', { pitch: 'A5' }]);
HITS.push([B(37.5), 'TOI', 'impact']);
HITS.push([B(36 + CHECK_T), 'check', 'bell', { pitch: 'D6' }]);
HITS.push([B(39.7), 'lift', 'whoosh', { len: 0.35 }]);
HITS.push([B(40.3), 'button', 'pop', { pitch: 'A5' }]);
HITS.push([B(40 + CLICK_T), 'click', 'click']);
HITS.push([B(40 + CLICK_T + 0.05), 'subscribed', 'bell', { pitch: 'A5' }]);
HITS.push([B(41.7), 'wipe', 'swell', { len: 0.3 }]);
HITS.push([B(42), 'end card', 'sub', { len: 0.8 }]);
for (let i = 0; i < 6; i++) HITS.push([B(41.8 + i * 0.08), `letter ${i}`, 'tick']);
HITS.push([B(42 + DOT_T), 'dot', 'bell', { pitch: 'D6' }]);
HITS.sort((a, b) => a[0] - b[0]);

M.film({
  fonts: [font(100, 800, DISPLAY), font(100, 700, DISPLAY), font(40, 500, UI), font(40, 700, UI), font(40, 800, UI)],
  hits: HITS,
  samples: 6,
  draw(ctx, u, t) { draw(ctx, t); },
});
