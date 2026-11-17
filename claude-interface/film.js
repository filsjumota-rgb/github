// « Projets, Code, Artéfacts, Tâches planifiées : c'est quoi ? » – Jumota Agency (2 min, voix Sébastien).
// Style (from the user's two references, re-made, nothing copied): light gallery background with a faint
// grid, floating cards with soft shadows, word-by-word kinetic subtitles with mixed weights and coloured
// keywords, inverted label boxes, a glowing spinner, a highlighter, a highlighted cursor with clicks.
// The only product image is the user's own capture of Claude's sidebar (assets/sidebar.jpg); the panels
// around it are schematic illustrations of each step, not copies of Claude's screens.
// Pure function of time: window.seek(t) paints frame t. Timing comes from timeline.json (tools/timeline.py).
import * as M from './lib/motion.js';

const { W, H, FORMAT, E, prog, lerp, clamp, SPRING, font, rrect, TAU } = M;
const P = FORMAT.portrait;
const C = {
  bg: '#F2F0F3', grid: 'rgba(28,28,30,0.035)', ink: '#1C1C1E', grey: '#9E9BA5', soft: '#C9C7CE', line: '#E4E2E7',
  card: '#FFFFFF', paper: '#F7F6F4', marker: 'rgba(255,214,10,0.55)', ok: '#1F9D55', red: '#D64545', blue: '#126BFF',
  // one colour per rubrique, used for its keyword everywhere
  projets: '#7C5CFF', code: '#E5489B', artefacts: '#FF7A2F', taches: '#1E8CFF',
};
const UI = 'UI', MONO = 'Mono';
const sp = (t, t0, cfg = SPRING.snappy) => M.spring(t - t0, cfg);
const io = (t, a, d, ease = E.outCubic) => ease(prog(t, a, a + d));
const alpha = (ctx, a, fn) => { if (a <= 0.001) return; ctx.save(); ctx.globalAlpha *= clamp(a); fn(); ctx.restore(); };
function measure(ctx, s, f, tr = 0) { ctx.font = f; ctx.letterSpacing = `${tr}px`; const w = ctx.measureText(s).width; ctx.letterSpacing = '0px'; return w; }
function txt(ctx, s, x, y, f, col, align = 'left', tr = 0) {
  ctx.font = f; ctx.fillStyle = col; ctx.textAlign = align; ctx.letterSpacing = `${tr}px`; ctx.fillText(s, x, y); ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
}
const scaleAt = (ctx, kx, ky, x, y) => { ctx.translate(x, y); ctx.scale(kx, ky); ctx.translate(-x, -y); };
const disc = (ctx, x, y, r, col) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = col; ctx.fill(); };
const typed = (s, t, t0, t1) => s.slice(0, Math.round(clamp((t - t0) / Math.max(0.1, t1 - t0)) * s.length));

// ------------------------------------------------------------------ voice timeline
const TL = await fetch('timeline.json').then((r) => r.json());
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’]/g, "'").replace(/[^a-z0-9'-]/g, '');
const SC = {};
TL.scenes.forEach((S) => {
  const words = S.phrases.flatMap((p) => p.words);
  const find = (w, n) => words.filter((x) => norm(x.w) === norm(w))[n];
  S.w = (w, n = 0, fb = 1) => { const x = find(w, n); return x ? x.t0 - S.start : fb; };
  S.we = (w, n = 0, fb = 1) => { const x = find(w, n); return x ? x.t1 - S.start : fb; };
  S.dur = S.end - S.start; S.words = words;
  SC[S.key] = S;
});

// ------------------------------------------------------------------ layout per format
// Every scene draws its objects in a 1000x720 "stage"; the stage, the on-screen headline and the
// subtitles are placed per format (portrait: stacked; landscape: stage left, words on the right).
const LAY = P
  ? { st: { x: 40, y: 450, s: 1 }, head: { x: 72, y: 330, w: 936, size: 60 }, cap: { x: 540, y: 1345, w: 960, size: 78 }, logo: { x: 540, y: 1468 } }
  : { st: { x: 50, y: 130, s: 1.13 }, head: { x: 1270, y: 250, w: 600, size: 50 }, cap: { x: 1570, y: 660, w: 620, size: 64 }, logo: { x: 1570, y: 1010 } };

// ------------------------------------------------------------------ UI kit (stage space)
function card(ctx, x, y, w, h, { r = 26, fill = C.card, lift = 1, stroke = true } = {}) {
  ctx.save();
  ctx.shadowColor = `rgba(40,30,60,${0.13 * lift})`; ctx.shadowBlur = 70 * lift; ctx.shadowOffsetY = 34 * lift;
  rrect(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  ctx.shadowColor = 'rgba(40,30,60,0.08)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4; ctx.fill();
  ctx.restore();
  if (stroke) { rrect(ctx, x, y, w, h, r); ctx.lineWidth = 1.5; ctx.strokeStyle = C.line; ctx.stroke(); }
}
function windowCard(ctx, x, y, w, h, title, opts = {}) {
  card(ctx, x, y, w, h, opts);
  [0, 1, 2].forEach((i) => disc(ctx, x + 30 + i * 22, y + 28, 7, C.soft));
  if (title) txt(ctx, title, x + w / 2, y + 38, font(26, 800, UI), C.grey, 'center');
  ctx.fillStyle = C.line; ctx.fillRect(x, y + 56, w, 1.5);
}
function field(ctx, x, y, w, label, value, caret, { h = 70, size = 32, color = C.ink } = {}) {
  txt(ctx, label, x, y - 12, font(24, 800, UI), C.grey, 'left', 1);
  rrect(ctx, x, y, w, h, 14); ctx.fillStyle = C.paper; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = caret ? C.ink : C.line; ctx.stroke();
  const f = font(size, 600, UI);
  const lines = wrap(ctx, value, f, w - 40);
  lines.forEach((l, i) => txt(ctx, l, x + 20, y + 40 + i * (size * 1.3), f, color));
  if (caret) { const last = lines[lines.length - 1] || ''; ctx.fillStyle = C.ink; ctx.fillRect(x + 22 + measure(ctx, last, f), y + 18 + (lines.length - 1) * size * 1.3, 3, size + 4); }
}
function wrap(ctx, s, f, maxW) {
  const out = []; let cur = '';
  s.split(' ').forEach((w) => { const t = cur ? cur + ' ' + w : w; if (cur && measure(ctx, t, f) > maxW) { out.push(cur); cur = w; } else cur = t; });
  if (cur || !out.length) out.push(cur); return out;
}
function pill(ctx, label, x, y, { fill = C.ink, col = C.card, size = 22, k = 1, icon = null } = {}) {
  if (k <= 0.001) return 0;
  const f = font(size, 700, UI), w = measure(ctx, label, f) + size * 1.6 + (icon ? size * 1.2 : 0), h = size * 2;
  ctx.save(); scaleAt(ctx, k, k, x + w / 2, y);
  rrect(ctx, x, y - h / 2, w, h, h / 2); ctx.fillStyle = fill; ctx.fill();
  if (icon) icon(ctx, x + size * 1.3, y, size * 0.5, col);
  txt(ctx, label, x + size * 0.8 + (icon ? size * 1.2 : 0), y + size * 0.36, f, col);
  ctx.restore(); return w;
}
function button(ctx, label, x, y, w, h, { fill = C.ink, col = C.card, press = 0, size = 26 } = {}) {
  ctx.save(); scaleAt(ctx, 1 - 0.06 * press, 1 - 0.06 * press, x + w / 2, y + h / 2);
  rrect(ctx, x, y, w, h, h / 2); ctx.fillStyle = fill; ctx.fill();
  txt(ctx, label, x + w / 2, y + h / 2 + size * 0.36, font(size, 800, UI), col, 'center');
  ctx.restore();
}
function check(ctx, x, y, s, k, col = C.card, lw = 0.18) {
  if (k <= 0) return;
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = s * lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const p = [[x - s * 0.36, y + s * 0.02], [x - s * 0.1, y + s * 0.28], [x + s * 0.4, y - s * 0.28]];
  const L1 = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]), L2 = Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1]), d = clamp(k) * (L1 + L2);
  ctx.beginPath(); ctx.moveTo(...p[0]);
  if (d <= L1) ctx.lineTo(lerp(p[0][0], p[1][0], d / L1), lerp(p[0][1], p[1][1], d / L1));
  else { ctx.lineTo(...p[1]); const q = (d - L1) / L2; ctx.lineTo(lerp(p[1][0], p[2][0], q), lerp(p[1][1], p[2][1], q)); }
  ctx.stroke(); ctx.restore();
}
function okBadge(ctx, x, y, r, k, col = C.ok) {
  if (k <= 0) return;
  ctx.save(); scaleAt(ctx, k, k, x, y); disc(ctx, x, y, r, col); ctx.restore(); check(ctx, x, y, r * 1.1, io(k, 0.4, 0.6), C.card);
}
// glowing gradient spinner (purple to magenta), with a label
function spinner(ctx, x, y, r, t, label) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * 5.2);
  const g = ctx.createConicGradient(0, 0, 0); g.addColorStop(0, 'rgba(124,92,255,0)'); g.addColorStop(0.75, '#7C5CFF'); g.addColorStop(1, '#E5489B');
  ctx.shadowColor = 'rgba(229,72,155,0.6)'; ctx.shadowBlur = 24;
  ctx.strokeStyle = g; ctx.lineWidth = r * 0.24; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU * 0.8); ctx.stroke(); ctx.restore();
  if (label) txt(ctx, label + '.'.repeat(1 + (Math.floor(t * 3) % 3)), x - r * 0.1, y + r + 46, font(30, 600, UI), C.ink, 'center');
}
// line icons of the four rubriques (drawn in code, matching the sidebar's glyphs)
const ICON = {
  projets(ctx, x, y, s, col) {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    rrect(ctx, x - s * 0.75, y - s * 0.25, s * 1.5, s * 1.05, s * 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - s * 0.6, y - s * 0.55); ctx.lineTo(x + s * 0.6, y - s * 0.55); ctx.moveTo(x - s * 0.4, y - s * 0.85); ctx.lineTo(x + s * 0.4, y - s * 0.85); ctx.stroke(); ctx.restore();
  },
  code(ctx, x, y, s, col) {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    ctx.moveTo(x - s * 0.35, y - s * 0.55); ctx.lineTo(x - s * 0.85, y); ctx.lineTo(x - s * 0.35, y + s * 0.55);
    ctx.moveTo(x + s * 0.35, y - s * 0.55); ctx.lineTo(x + s * 0.85, y); ctx.lineTo(x + s * 0.35, y + s * 0.55);
    ctx.moveTo(x + s * 0.15, y - s * 0.8); ctx.lineTo(x - s * 0.15, y + s * 0.8); ctx.stroke(); ctx.restore();
  },
  artefacts(ctx, x, y, s, col) {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = s * 0.16; ctx.lineJoin = 'round';
    ctx.save(); ctx.translate(x + s * 0.2, y - s * 0.15); ctx.rotate(0.12); rrect(ctx, -s * 0.45, -s * 0.6, s * 0.9, s * 1.2, s * 0.18); ctx.stroke(); ctx.restore();
    ctx.fillStyle = C.card; rrect(ctx, x - s * 0.75, y - s * 0.4, s * 0.85, s * 1.2, s * 0.18); ctx.fill(); ctx.stroke(); ctx.restore();
  },
  taches(ctx, x, y, s, col) {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y, s * 0.85, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - s * 0.5); ctx.lineTo(x, y); ctx.lineTo(x + s * 0.35, y + s * 0.3); ctx.stroke(); ctx.restore();
  },
};
function icFile(ctx, x, y, s, col, label = 'PDF') {
  ctx.save(); ctx.fillStyle = C.card; ctx.strokeStyle = C.line; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - s * 0.7, y - s); ctx.lineTo(x + s * 0.35, y - s); ctx.lineTo(x + s * 0.7, y - s * 0.65); ctx.lineTo(x + s * 0.7, y + s); ctx.lineTo(x - s * 0.7, y + s); ctx.closePath(); ctx.fill(); ctx.stroke();
  rrect(ctx, x - s * 0.55, y + s * 0.1, s * 1.1, s * 0.5, 5); ctx.fillStyle = col; ctx.fill();
  txt(ctx, label, x, y + s * 0.48, font(s * 0.36, 800, UI), C.card, 'center'); ctx.restore();
}
function icRepo(ctx, x, y, s, col) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = s * 0.14; ctx.lineJoin = 'round';
  rrect(ctx, x - s * 0.6, y - s * 0.8, s * 1.2, s * 1.6, s * 0.15); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - s * 0.6, y + s * 0.45); ctx.lineTo(x + s * 0.6, y + s * 0.45); ctx.stroke(); ctx.restore();
}
function icCloud(ctx, x, y, s, col) {
  ctx.save(); ctx.fillStyle = col; ctx.beginPath();
  ctx.arc(x - s * 0.45, y + s * 0.1, s * 0.45, 0, TAU); ctx.arc(x + s * 0.1, y - s * 0.2, s * 0.6, 0, TAU); ctx.arc(x + s * 0.65, y + s * 0.15, s * 0.4, 0, TAU);
  ctx.fill(); rrect(ctx, x - s * 0.9, y + s * 0.05, s * 1.95, s * 0.5, s * 0.25); ctx.fill(); ctx.restore();
}
function icLink(ctx, x, y, s, col) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = s * 0.22; ctx.lineCap = 'round';
  ctx.translate(x, y); ctx.rotate(-0.78);
  rrect(ctx, -s * 0.95, -s * 0.32, s * 1.0, s * 0.64, s * 0.32); ctx.stroke(); rrect(ctx, -s * 0.05, -s * 0.32, s * 1.0, s * 0.64, s * 0.32); ctx.stroke(); ctx.restore();
}
// highlighted cursor (yellow halo, click ring)
function cursor(ctx, keys, clicks, t) {
  if (!keys.length || t < keys[0][0] - 0.3) return;
  const [x, y] = M.kf(t, keys.map(([tt, a, b]) => [tt, [a, b]]), E.inOutCubic);
  const vis = clamp((t - keys[0][0] + 0.3) / 0.3);
  ctx.save(); ctx.globalAlpha *= vis;
  disc(ctx, x, y, 34, 'rgba(255,214,10,0.35)');
  clicks.forEach((c) => { const q = prog(t, c, c + 0.45); if (q > 0 && q < 1) { ctx.strokeStyle = `rgba(255,190,0,${0.9 * (1 - q)})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, 20 + 50 * q, 0, TAU); ctx.stroke(); } });
  const press = clicks.reduce((a, c) => Math.max(a, Math.sin(Math.PI * prog(t, c - 0.05, c + 0.15))), 0);
  ctx.translate(x, y); ctx.scale(1.15 - 0.15 * press, 1.15 - 0.15 * press);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 44); ctx.lineTo(11, 34); ctx.lineTo(19, 52); ctx.lineTo(27, 48); ctx.lineTo(19, 31); ctx.lineTo(33, 31); ctx.closePath();
  ctx.fillStyle = C.ink; ctx.fill(); ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; ctx.strokeStyle = C.card; ctx.stroke();
  ctx.restore();
}
const pressAt = (t, c) => Math.sin(Math.PI * prog(t, c - 0.05, c + 0.15));

// ------------------------------------------------------------------ the sidebar (the user's capture)
// rows of the capture (image px): Projets, Code, Artéfacts, Tâches planifiées
const ROWS = [52, 202, 352, 502];
const KEYS = ['projets', 'code', 'artefacts', 'taches'];
const NAMES = ['Projets', 'Code', 'Artéfacts', 'Tâches planifiées'];
function sidebar(ctx, IMG, x, y, w, { lit = [], active = -1, k = 1, lift = 1 } = {}) {
  const im = IMG.sidebar, h = w * im.height / im.width, s = w / im.width;
  if (k <= 0) return { h, row: (i) => y + ROWS[i] * s };
  ctx.save(); ctx.globalAlpha *= clamp(k * 1.5); scaleAt(ctx, lerp(0.9, 1, k), lerp(0.9, 1, k), x + w / 2, y + h / 2);
  card(ctx, x, y, w, h, { r: 22 * w / 600, fill: '#F3F3F1', lift, stroke: false });
  ctx.save(); rrect(ctx, x, y, w, h, 22 * w / 600); ctx.clip(); ctx.drawImage(im, x, y, w, h);
  lit.forEach((v, i) => {   // a rubrique "lights up": its colour washes over the row, a bar on the left
    if (v <= 0.001) return;
    const ry = y + ROWS[i] * s, col = C[KEYS[i]];
    ctx.globalAlpha = 0.22 * clamp(v); rrect(ctx, x + 40 * s, ry - 68 * s, (w - 80 * s) * clamp(v * 1.2), 136 * s, 40 * s); ctx.fillStyle = col; ctx.fill();
    ctx.globalAlpha = clamp(v); rrect(ctx, x + 14 * s, ry - 46 * s, 12 * s, 92 * s, 6 * s); ctx.fill();
    ctx.globalAlpha = 1;
  });
  ctx.restore();
  if (active >= 0) { const ry = y + ROWS[active] * s; ctx.save(); ctx.strokeStyle = C[KEYS[active]]; ctx.lineWidth = 4; rrect(ctx, x + 36 * s, ry - 72 * s, w - 72 * s, 144 * s, 42 * s); ctx.stroke(); ctx.restore(); }
  ctx.restore();
  return { h, row: (i) => y + ROWS[i] * s };
}

// ------------------------------------------------------------------ subtitles (word by word)
// Each spoken word lands when it is said: blurred and low, then sharp. Rubrique names in their colour
// and bold, long words bold, short ones grey: the mixed-weight look of the references.
const KW = { projets: 'projets', projet: 'projets', code: 'code', artefacts: 'artefacts', taches: 'taches', planifiees: 'taches' };
const CHUNKS = (() => {
  const out = [];
  TL.scenes.forEach((S) => S.phrases.forEach((p) => {
    let cur = [];
    p.words.forEach((w, i) => {
      cur.push(w);
      const len = cur.map((x) => x.w).join(' ').length;
      if (len > (P ? 24 : 22) || i === p.words.length - 1) { out.push(cur); cur = []; }
    });
  }));
  return out.map((ws, i) => ({ ws, t0: ws[0].t0 - 0.06 }));
})();
CHUNKS.forEach((c, i) => { const nx = CHUNKS[i + 1]; const last = c.ws[c.ws.length - 1].t1; c.t1 = nx && nx.t0 - last < 0.9 ? nx.t0 : last + 0.7; });
function wordStyle(w) {
  const n = norm(w);
  if (KW[n]) return { col: C[KW[n]], weight: 800, scale: 1.12 };
  if (n === 'claude') return { col: C.ink, weight: 800, scale: 1.12 };
  if (n.replace(/[^a-z]/g, '').length >= 6) return { col: C.ink, weight: 800, scale: 1 };
  return { col: C.grey, weight: 500, scale: 0.94 };
}
function subtitles(ctx, t) {
  const c = CHUNKS.find((x) => t >= x.t0 && t < x.t1);
  if (!c) return;
  const { x: cx, y: cy, w: maxW, size } = LAY.cap;
  const items = c.ws.map((w) => { const st = wordStyle(w.w); const f = font(size * st.scale, st.weight, UI); return { ...w, st, f, wd: measure(ctx, w.w, f, -0.02 * size) }; });
  const gap = size * 0.26, lines = [[]]; let lw = 0;
  items.forEach((it) => { if (lw + it.wd > maxW && lines[lines.length - 1].length) { lines.push([]); lw = 0; } lines[lines.length - 1].push(it); lw += it.wd + gap; });
  const out = io(t, c.t1 - 0.12, 0.12, E.inCubic);
  lines.forEach((ln, li) => {
    const tot = ln.reduce((a, it) => a + it.wd, 0) + gap * (ln.length - 1);
    let x = cx - tot / 2; const y = cy + li * size * 1.2 - (lines.length - 1) * size * 0.6;
    ln.forEach((it) => {
      const q = sp(t, it.t0 - 0.05, { stiffness: 320, damping: 24 });
      if (q > 0) {
        ctx.save(); ctx.globalAlpha = clamp(q * 1.8) * (1 - out);
        const b = (1 - clamp(q)) * 12 + out * 8; if (b > 0.3) ctx.filter = `blur(${b.toFixed(1)}px)`;
        txt(ctx, it.w, x, y + (1 - q) * size * 0.45 - out * 20, it.f, it.st.col, 'left', -0.02 * size);
        ctx.restore();
      }
      x += it.wd + gap;
    });
  });
}

// ------------------------------------------------------------------ on-screen headline (« Texte à l'écran »)
// tokens: [text, colour, boxed]; a boxed token is an inverted label with a shadow (reference style)
function headline(ctx, tokens, lt) {
  const { x: x0, y: y0, w: maxW, size } = LAY.head;
  const words = [];
  tokens.forEach(([s, col = null, box = false]) => { if (box) words.push({ s, col, box }); else s.split(' ').filter(Boolean).forEach((w) => words.push({ s: w, col, box: false })); });
  const f = (wd) => font(size, wd.box || wd.col ? 800 : 700, UI);
  const gap = size * 0.28; let x = x0, y = y0, k = 0;
  words.forEach((wd) => {
    const ww = measure(ctx, wd.s, f(wd), -0.01 * size) + (wd.box ? size * 0.5 : 0);
    if (x + ww > x0 + maxW && x > x0) { x = x0; y += size * 1.35; }
    const q = sp(lt, 0.15 + k++ * 0.05, { stiffness: 300, damping: 26 });
    if (q > 0) {
      ctx.save(); ctx.globalAlpha *= clamp(q * 1.6); const b = (1 - clamp(q)) * 10; if (b > 0.3) ctx.filter = `blur(${b.toFixed(1)}px)`;
      const dy = (1 - q) * 24;
      if (wd.box) {
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.22)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
        ctx.fillStyle = wd.col || C.ink; ctx.fillRect(x, y + dy - size * 0.92, ww, size * 1.22); ctx.restore();
        txt(ctx, wd.s, x + size * 0.25, y + dy, f(wd), C.card, 'left', -0.01 * size);
      } else txt(ctx, wd.s, x, y + dy, f(wd), wd.col || C.ink, 'left', -0.01 * size);
      ctx.restore();
    }
    x += ww + gap;
  });
}

// ------------------------------------------------------------------ scenes (stage space 1000x720, local time)
const HITS = [];
const hit = (S, lt, label, sfx, opts) => HITS.push([(S.start + lt) * 2, label, sfx, opts]);

// 1 · Accroche
const S1 = SC.hook, c1 = KEYS.map((k) => S1.w(k, 0, 1));
c1.deux = S1.w('deux', 0, 6); c1.tout = S1.we('tout', 0, 7.3);
function s1(ctx, lt, IMG) {
  const k = sp(lt, -0.2, SPRING.gentle);
  const lit = c1.map((c, i) => io(lt, c - 0.05, 0.3) * (i === 3 || lt < c1[i + 1] ? 1 : 0.55));
  sidebar(ctx, IMG, 110, 70 + Math.sin(lt * 1.2) * 6, 780, { lit, k });
  // « en deux minutes » : a big glowing figure (reference: the glowing counter)
  const kd = sp(lt, c1.deux - 0.05, SPRING.bouncy);
  if (kd > 0) {
    ctx.save(); scaleAt(ctx, kd, kd, 780, 620);
    const g = ctx.createLinearGradient(640, 560, 940, 660); g.addColorStop(0, '#7C5CFF'); g.addColorStop(1, '#E5489B');
    ctx.shadowColor = 'rgba(229,72,155,0.55)'; ctx.shadowBlur = 40;
    txt(ctx, '2 min', 780, 660, font(132, 900, UI), g, 'center', -4);
    ctx.restore();
  }
  // after the line: a cursor drifts in towards the menu
  cursor(ctx, [[c1.tout + 0.4, 980, 700], [c1.tout + 2.4, 470, 360]], [], lt);
}
c1.forEach((c, i) => hit(S1, c - 0.05, `lit ${i}`, 'blip', { pitch: ['D5', 'F#5', 'A5', 'D6'][i] }));
hit(S1, c1.deux - 0.05, '2 min', 'bell', { pitch: 'A5' });

// 2 · Le menu de gauche : vue complète, zoom lent vers le menu
const S2 = SC.menu, c2 = { q: S2.w('quatre', 0, 2.5), q2: S2.w('quatre', 1, 3.6) };
function s2(ctx, lt, IMG) {
  const z = Math.pow(2.3, E.inOutSine(prog(lt, 0.6, 6.5)));   // log-space zoom: a constant-rate dolly
  const fx = 165, fy = 250;                                     // focus: the sidebar capture
  ctx.save(); ctx.beginPath(); ctx.rect(-60, -60, 1120, 840); ctx.clip();
  ctx.translate(fx, fy); ctx.scale(z, z); ctx.translate(-fx, -fy);
  ctx.translate(lerp(0, 500 - fx, 0) , 0);
  windowCard(ctx, 20, 20, 960, 680, '');
  ctx.fillStyle = '#F3F3F1'; ctx.fillRect(21, 78, 300, 620); ctx.fillStyle = C.line; ctx.fillRect(320, 78, 1.5, 620);
  rrect(ctx, 40, 96, 260, 40, 12); ctx.fillStyle = C.line; ctx.fill();
  txt(ctx, '+  Nouvelle conversation', 56, 122, font(17, 700, UI), C.grey);
  const sb = sidebar(ctx, IMG, 34, 160, 272, { lift: 0.1 });
  [0, 1, 2, 3, 4].forEach((i) => { rrect(ctx, 44, 380 + i * 40, 160 + ((i * 47) % 80), 14, 7); ctx.fillStyle = C.line; ctx.fill(); });
  // chat area (schematic)
  txt(ctx, 'Bonjour !', 650, 300, font(40, 800, UI), C.soft, 'center');
  rrect(ctx, 400, 560, 500, 96, 22); ctx.fillStyle = C.card; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.line; ctx.stroke();
  txt(ctx, 'Écrivez votre message…', 428, 600, font(20, 500, UI), C.soft);
  // numbers 1-4 next to the rubriques
  [0, 1, 2, 3].forEach((i) => {
    const kn = sp(lt, c2.q + i * 0.14, SPRING.bouncy);
    if (kn <= 0) return;
    const y = sb.row(i), x = 312;
    ctx.save(); scaleAt(ctx, kn, kn, x, y); disc(ctx, x, y, 15, C[KEYS[i]]); txt(ctx, String(i + 1), x, y + 6, font(17, 800, UI), C.card, 'center'); ctx.restore();
  });
  ctx.restore();
}
[0, 1, 2, 3].forEach((i) => hit(S2, c2.q + i * 0.14, `n${i + 1}`, 'pop', { pitch: ['D5', 'F#5', 'A5', 'D6'][i] }));

// 3 · Projets
const S3 = SC.projets, c3 = {
  p: S3.w('projets', 0, 1), esp: S3.w('espace', 0, 3), ent: S3.w('entreprise', 0, 5), cli: S3.w('client', 0, 5.6), form: S3.w('formation', 0, 6.2),
  fich: S3.w('fichiers', 0, 8), instr: S3.w('instructions', 0, 8.6), ton: S3.w('ton', 0, 10), conv: S3.w('conversations', 0, 11.5),
  ctx: S3.w('contexte', 0, 14.5), plus: S3.w('plus', 0, 15.5), fin: S3.we('fois', 0, 17.5),
};
c3.click = c3.p + 0.35; c3.modal = c3.click + 0.3; c3.folder = c3.conv - 0.1;
const NOM = 'Mon entreprise', INSTR = 'Réponds toujours en français, ton professionnel.';
function s3(ctx, lt, IMG) {
  const out = io(lt, c3.folder - 0.25, 0.3, E.inCubic);
  sidebar(ctx, IMG, 0, 0, 330, { lit: [io(lt, c3.click, 0.25), 0, 0, 0], active: lt > c3.click ? 0 : -1, k: sp(lt, -0.25, SPRING.gentle) * (1 - out) });
  // the « Nouveau projet » form
  const km = sp(lt, c3.modal, SPRING.snappy) * (1 - out);
  if (km > 0.001) {
    ctx.save(); ctx.globalAlpha *= clamp(km * 2); scaleAt(ctx, lerp(0.6, 1, km), lerp(0.6, 1, km), 160, 120);
    windowCard(ctx, 150, 150, 840, 570, 'Nouveau projet');
    field(ctx, 190, 250, 470, 'NOM DU PROJET', typed(NOM, lt, c3.esp, c3.esp + 0.9), lt > c3.esp && lt < c3.ent);
    // sujet : entreprise / client / formation
    [['Votre entreprise', c3.ent], ['Un client', c3.cli], ['Une formation', c3.form]].forEach(([s, tt], i) => {
      pill(ctx, s, 690, 232 + i * 50, { fill: i === 0 ? C.projets : 'rgba(124,92,255,0.12)', col: i === 0 ? C.card : C.projets, size: 21, k: sp(lt, tt - 0.05, SPRING.bouncy) });
    });
    // fichiers : a PDF drops into the zone
    txt(ctx, 'FICHIERS', 190, 368, font(20, 700, UI), C.grey, 'left', 1);
    ctx.save(); ctx.setLineDash([8, 8]); ctx.lineWidth = 2; ctx.strokeStyle = C.soft; rrect(ctx, 190, 380, 760, 110, 16); ctx.stroke(); ctx.restore();
    const kf = sp(lt, c3.fich - 0.1, { stiffness: 220, damping: 16 });
    if (kf > 0) { const fy = lerp(-120, 435, kf); icFile(ctx, 250, fy, 34, C.red); alpha(ctx, io(lt, c3.fich + 0.3, 0.3), () => txt(ctx, 'Presentation-entreprise.pdf', 300, 446, font(28, 700, UI), C.ink)); okBadge(ctx, 920, 435, 18, sp(lt, c3.fich + 0.5, SPRING.bouncy)); }
    // instructions
    field(ctx, 190, 545, 760, 'INSTRUCTIONS', typed(INSTR, lt, c3.instr + 0.2, c3.ton + 1.2), lt > c3.instr && lt < c3.ton + 1.4, { h: 100, size: 30 });
    button(ctx, 'Créer le projet', 770, 660, 180, 44, { fill: C.projets, size: 18, press: pressAt(lt, c3.folder - 0.4) });
    ctx.restore();
  }
  // the project: conversations filed inside, context shared
  const kp = sp(lt, c3.folder, SPRING.snappy);
  if (kp > 0) {
    ctx.save(); ctx.globalAlpha *= clamp(kp * 2); scaleAt(ctx, lerp(0.85, 1, kp), lerp(0.85, 1, kp), 500, 360);
    card(ctx, 60, 60, 880, 600);
    disc(ctx, 120, 130, 34, 'rgba(124,92,255,0.14)'); ICON.projets(ctx, 120, 134, 26, C.projets);
    txt(ctx, 'Mon entreprise', 172, 128, font(38, 800, UI), C.ink);
    txt(ctx, '1 fichier  ·  ton professionnel', 172, 166, font(26, 600, UI), C.grey);
    ['Devis client Dupont', 'Post LinkedIn de la semaine', 'Réponse à un avis Google'].forEach((s, i) => {
      const kr = sp(lt, c3.conv + 0.15 + i * 0.22, SPRING.snappy);
      if (kr <= 0) return;
      const y = 220 + i * 120;
      ctx.save(); ctx.globalAlpha *= clamp(kr * 2); ctx.translate((1 - kr) * 300, 0);
      rrect(ctx, 100, y, 800, 92, 18); ctx.fillStyle = C.paper; ctx.fill();
      disc(ctx, 146, y + 46, 20, C.line); txt(ctx, s, 184, y + 56, font(32, 700, UI), C.ink);
      // « Claude garde le contexte » : each conversation gets the project's context
      const kc = io(lt, c3.ctx + i * 0.15, 0.3);
      if (kc > 0) { pill(ctx, 'contexte du projet', 640, y + 46, { fill: 'rgba(124,92,255,0.14)', col: C.projets, size: 16, k: kc }); }
      ctx.restore();
    });
    // « plus besoin de tout réexpliquer » : the repeated brief, struck out
    const kx = sp(lt, c3.plus, SPRING.bouncy);
    if (kx > 0) {
      ctx.save(); ctx.translate(560, 600); ctx.rotate(-0.04); scaleAt(ctx, kx, kx, 0, 0);
      rrect(ctx, -10, -36, 380, 64, 32); ctx.fillStyle = C.card; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.line; ctx.stroke();
      txt(ctx, 'Rappel : mon entreprise est…', 14, 6, font(20, 600, UI), C.grey);
      const s = io(lt, c3.plus + 0.25, 0.3);
      ctx.strokeStyle = C.red; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(6, -2); ctx.lineTo(6 + 352 * s, -2); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  cursor(ctx, [[-0.1, 600, 700], [c3.click - 0.1, 70, 40], [c3.esp - 0.3, 360, 290], [c3.fich, 300, 470], [c3.instr, 400, 600], [c3.folder - 0.5, 860, 682], [c3.folder + 1, 900, 700]], [c3.click, c3.folder - 0.4], lt);
}
hit(S3, -0.25, 'in', 'whoosh', { len: 0.35, from: 2400, to: 600 });
hit(S3, c3.click, 'click projets', 'click'); hit(S3, c3.modal, 'modal', 'pop', { pitch: 'A5' });
hit(S3, c3.esp, 'type name', 'type', { n: 10, len: 0.9 });
[c3.ent, c3.cli, c3.form].forEach((tt, i) => hit(S3, tt - 0.05, `sujet ${i}`, 'blip', { pitch: ['E5', 'G5', 'B5'][i] }));
hit(S3, c3.fich + 0.25, 'pdf lands', 'thud'); hit(S3, c3.fich + 0.5, 'pdf ok', 'blip', { pitch: 'D6' });
hit(S3, c3.instr + 0.2, 'type instr', 'type', { n: 26, len: c3.ton + 1 - c3.instr });
hit(S3, c3.folder - 0.4, 'click créer', 'click');
[0, 1, 2].forEach((i) => hit(S3, c3.conv + 0.15 + i * 0.22, `conv ${i}`, 'pop', { pitch: ['D5', 'F#5', 'A5'][i] }));
hit(S3, c3.ctx, 'contexte', 'bell', { pitch: 'A5' }); hit(S3, c3.plus + 0.25, 'strike', 'tok', { pitch: 'C4' });

// 4 · Code
const S4 = SC.code, c4 = {
  c: S4.w('code', 0, 1.2), gh: S4.w('github', 0, 4), dec: S4.w('decrivez', 0, 5.5), bug: S4.w('bug', 0, 7), page: S4.w('page', 0, 8), ecrit: S4.w('ecrit', 0, 9.5),
  verif: S4.w('verifie', 0, 10.5), modif: S4.w('modifications', 0, 11.5), cloud: S4.w('cloud', 0, 13), fermer: S4.w('fermer', 0, 14), revenir: S4.w('revenir', 0, 15.5),
};
c4.click = c4.c + 0.3; c4.pick = c4.gh + 0.7; c4.send = c4.page + 0.9;
const PROMPT = 'Ajoute une page Contact à mon site';
const CODE = ['<section id="contact">', '  <h2>Contactez-nous</h2>', '  <form action="/envoyer">', '    <input name="email" type="email">', '    <textarea name="message"></textarea>', '    <button>Envoyer</button>', '  </form>', '</section>'];
function s4(ctx, lt, IMG) {
  const stage1 = 1 - io(lt, c4.ecrit - 0.3, 0.3, E.inCubic);
  sidebar(ctx, IMG, 0, 0, 330, { lit: [0, io(lt, c4.click, 0.25), 0, 0], active: lt > c4.click ? 1 : -1, k: sp(lt, -0.25, SPRING.gentle) * stage1 });
  // repo picker
  const kr = sp(lt, c4.gh - 0.15, SPRING.snappy) * stage1;
  if (kr > 0.001) {
    ctx.save(); ctx.globalAlpha *= clamp(kr * 2); ctx.translate((1 - kr) * 200, 0);
    windowCard(ctx, 380, 0, 600, 320, 'Choisir un dépôt');
    ['mon-site-web', 'boutique-en-ligne', 'portfolio'].forEach((s, i) => {
      const y = 76 + i * 74, sel = i === 0 && lt > c4.pick;
      if (sel) { rrect(ctx, 400, y, 560, 62, 14); ctx.fillStyle = 'rgba(229,72,155,0.12)'; ctx.fill(); }
      icRepo(ctx, 436, y + 31, 16, sel ? C.code : C.grey); txt(ctx, s, 470, y + 42, font(32, 700, MONO), sel ? C.code : C.ink);
      if (sel) okBadge(ctx, 930, y + 31, 15, sp(lt, c4.pick, SPRING.bouncy), C.code);
    });
    ctx.restore();
  }
  // the request
  const kq = sp(lt, c4.dec - 0.15, SPRING.snappy) * stage1;
  if (kq > 0.001) {
    ctx.save(); ctx.globalAlpha *= clamp(kq * 2); ctx.translate(0, (1 - kq) * 120);
    card(ctx, 0, 380, 980, 150);
    txt(ctx, 'Décrivez la tâche', 34, 424, font(24, 800, UI), C.grey, 'left', 1);
    txt(ctx, typed(PROMPT, lt, c4.dec + 0.1, c4.page + 0.4), 34, 482, font(38, 700, UI), C.ink);
    button(ctx, 'Envoyer', 820, 440, 130, 56, { fill: C.code, size: 22, press: pressAt(lt, c4.send) });
    ctx.restore();
  }
  if (lt > c4.send + 0.1 && stage1 > 0.01) alpha(ctx, stage1 * io(lt, c4.send + 0.1, 0.2), () => spinner(ctx, 500, 610, 36, lt, 'Claude travaille'));
  // code being written, checked, proposed
  const ks = sp(lt, c4.ecrit - 0.2, SPRING.snappy);
  const closed = io(lt, c4.fermer - 0.1, 0.35, E.inCubic) * (1 - io(lt, c4.revenir, 0.4));
  if (ks > 0) {
    ctx.save(); ctx.globalAlpha *= clamp(ks * 2) * (1 - closed); scaleAt(ctx, lerp(0.9, 1, ks) * (1 - 0.6 * closed), lerp(0.9, 1, ks) * (1 - 0.6 * closed), 500, 300);
    windowCard(ctx, 0, 0, 1000, 600, 'contact.html');
    const n = Math.floor(clamp((lt - c4.ecrit) / 1.2) * CODE.length + 0.999);
    CODE.slice(0, n).forEach((l, i) => {
      const y = 104 + i * 40;
      rrect(ctx, 20, y - 26, 960, 38, 6); ctx.fillStyle = 'rgba(31,157,85,0.08)'; ctx.fill();
      txt(ctx, '+', 34, y, font(26, 700, MONO), C.ok); txt(ctx, l, 70, y, font(26, 500, MONO), C.ink);
    });
    // checks
    ['Page créée', 'Lien ajouté au menu', 'Tests réussis'].forEach((s, i) => {
      const kc = sp(lt, c4.verif + i * 0.25, SPRING.bouncy);
      if (kc <= 0) return;
      okBadge(ctx, 58, 470 + i * 0, 0, 0);
      pill(ctx, s, 20 + i * 330, 455, { fill: 'rgba(31,157,85,0.12)', col: C.ok, size: 24, k: kc });
    });
    // proposed changes
    const kd = sp(lt, c4.modif - 0.1, SPRING.snappy);
    if (kd > 0) {
      ctx.save(); scaleAt(ctx, kd, kd, 500, 540);
      card(ctx, 140, 500, 720, 80, { r: 40, fill: C.ink });
      txt(ctx, 'Modifications proposées', 180, 550, font(26, 800, UI), C.card);
      txt(ctx, '+42  −0', 810, 550, font(24, 800, MONO), '#5BE08F', 'right');
      ctx.restore();
    }
    ctx.restore();
  }
  // « tout tourne dans le cloud » : the work goes on with the page closed
  const kcl = sp(lt, c4.cloud - 0.1, SPRING.bouncy);
  if (kcl > 0) {
    const cx = 860, cy = 650;
    ctx.save(); scaleAt(ctx, kcl, kcl, cx, cy); icCloud(ctx, cx, cy, 52, 'rgba(229,72,155,0.16)'); ctx.restore();
    if (lt < c4.revenir + 0.3) spinner(ctx, cx + 6, cy + 4, 18 * kcl, lt, '');
    else okBadge(ctx, cx + 6, cy + 4, 22, sp(lt, c4.revenir + 0.3, SPRING.bouncy));
    if (closed > 0.5) alpha(ctx, clamp((closed - 0.5) * 2), () => txt(ctx, 'Page fermée… Claude continue.', 500, 340, font(34, 800, UI), C.ink, 'center'));
  }
  pill(ctx, 'Forfait payant  ·  compte GitHub requis', 0, 700, { fill: 'rgba(28,28,30,0.06)', col: C.grey, size: 21, k: io(lt, c4.gh, 0.4) * stage1 });
  cursor(ctx, [[-0.1, 600, 700], [c4.click - 0.1, 70, 128], [c4.pick - 0.3, 600, 112], [c4.send - 0.35, 890, 470], [c4.send + 0.6, 960, 560]], [c4.click, c4.pick, c4.send], lt);
}
hit(S4, -0.25, 'in', 'whoosh', { len: 0.35, from: 2400, to: 600 });
hit(S4, c4.click, 'click code', 'click'); hit(S4, c4.gh - 0.15, 'repos', 'pop', { pitch: 'A5' }); hit(S4, c4.pick, 'pick repo', 'click');
hit(S4, c4.dec + 0.1, 'type prompt', 'type', { n: 18, len: c4.page + 0.3 - c4.dec }); hit(S4, c4.send, 'send', 'click');
hit(S4, c4.ecrit - 0.2, 'code', 'whoosh', { len: 0.3 }); for (let i = 0; i < 8; i++) hit(S4, c4.ecrit + i * 0.15, `line ${i}`, 'tick');
[0, 1, 2].forEach((i) => hit(S4, c4.verif + i * 0.25, `check ${i}`, 'blip', { pitch: ['E5', 'A5', 'D6'][i] }));
hit(S4, c4.modif - 0.1, 'diff', 'bell', { pitch: 'A5' }); hit(S4, c4.cloud - 0.1, 'cloud', 'pop', { pitch: 'D5' });
hit(S4, c4.fermer - 0.1, 'close', 'whoosh', { len: 0.35, from: 1600, to: 300 }); hit(S4, c4.revenir + 0.3, 'done', 'bell', { pitch: 'D6' });

// 5 · Artéfacts
const S5 = SC.artefacts, c5 = {
  a: S5.w('artefacts', 0, 1.2), items: [S5.w('documents', 0, 4), S5.w('presentations', 0, 4.7), S5.w('tableaux', 0, 5.4), S5.w('pages', 0, 6), S5.w('applications', 0, 7)],
  ici: S5.w('ici', 0, 8.5), verbs: [S5.w('rouvrir', 0, 10), S5.w('modifier', 0, 10.6), S5.w('exporter', 0, 11.2), S5.w('partager', 0, 11.9)], lien: S5.w('lien', 0, 13),
};
c5.click = c5.a + 0.3; c5.open = c5.ici + 0.9;
const ARTS = ['Document', 'Présentation', 'Tableau', 'Page web', 'Application'];
function thumb(ctx, i, x, y, w, h) {   // a tiny drawing of each kind of artefact
  rrect(ctx, x, y, w, h, 14); ctx.fillStyle = C.paper; ctx.fill();
  ctx.fillStyle = C.soft;
  if (i === 0) for (let k = 0; k < 6; k++) { rrect(ctx, x + 18, y + 22 + k * 22, (w - 36) * (k % 3 === 2 ? 0.6 : 1), 9, 4); ctx.fill(); }
  if (i === 1) { rrect(ctx, x + 18, y + 22, w * 0.5, 16, 6); ctx.fill(); [0.5, 0.8, 0.35, 0.65].forEach((v, k) => { ctx.fillStyle = C.artefacts; ctx.fillRect(x + 24 + k * (w - 60) / 4, y + h - 20 - v * (h - 80), (w - 80) / 5, v * (h - 80)); }); }
  if (i === 2) { ctx.strokeStyle = C.soft; ctx.lineWidth = 2; for (let r = 0; r <= 5; r++) { ctx.beginPath(); ctx.moveTo(x + 14, y + 16 + r * (h - 32) / 5); ctx.lineTo(x + w - 14, y + 16 + r * (h - 32) / 5); ctx.stroke(); } for (let c = 0; c <= 3; c++) { ctx.beginPath(); ctx.moveTo(x + 14 + c * (w - 28) / 3, y + 16); ctx.lineTo(x + 14 + c * (w - 28) / 3, y + h - 16); ctx.stroke(); } }
  if (i === 3) { ctx.fillStyle = 'rgba(255,122,47,0.25)'; rrect(ctx, x + 14, y + 14, w - 28, h * 0.42, 8); ctx.fill(); ctx.fillStyle = C.soft; rrect(ctx, x + 24, y + h * 0.6, w * 0.5, 12, 6); ctx.fill(); ctx.fillStyle = C.artefacts; rrect(ctx, x + 24, y + h * 0.75, 70, 22, 11); ctx.fill(); }
  if (i === 4) { ctx.fillStyle = C.ink; rrect(ctx, x + 18, y + 16, w - 36, 30, 8); ctx.fill(); for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { ctx.fillStyle = c === 3 ? C.artefacts : C.soft; rrect(ctx, x + 18 + c * (w - 36) / 4, y + 58 + r * (h - 74) / 3, (w - 36) / 4 - 8, (h - 74) / 3 - 8, 6); ctx.fill(); } }
}
function s5(ctx, lt, IMG) {
  const gal = io(lt, c5.items[0] - 0.4, 0.3);
  sidebar(ctx, IMG, 0, 0, 330, { lit: [0, 0, io(lt, c5.click, 0.25), 0], active: lt > c5.click ? 2 : -1, k: sp(lt, -0.25, SPRING.gentle) * (1 - gal) });
  const grid = io(lt, c5.ici - 0.1, 0.6, E.inOutCubic), open = io(lt, c5.open, 0.5, E.inOutCubic);
  // the strip scrolls by as each kind is named, then settles into the gallery grid
  ARTS.forEach((name, i) => {
    const k = sp(lt, c5.items[i] - 0.1, SPRING.snappy);
    if (k <= 0) return;
    const scroll = -i * 230 + 0 * lt;
    const sx = 360 + i * 260 - 230 * clamp((lt - c5.items[0]) / (c5.items[4] - c5.items[0] + 0.01)) * 2.2, sy = 160 + Math.sin(i * 1.7) * 30;
    const gx = 30 + (i % 3) * 320, gy = 70 + Math.floor(i / 3) * 300;
    let x = lerp(sx, gx, grid), y = lerp(sy, gy, grid), w = 280, h = 230, rot = lerp(i % 2 ? 0.05 : -0.05, 0, grid);
    if (i === 3) { x = lerp(x, 120, open); y = lerp(y, 40, open); w = lerp(w, 760, open); h = lerp(h, 520, open); rot *= 1 - open; }
    const fade = i === 3 ? 1 : 1 - open;
    ctx.save(); ctx.globalAlpha *= clamp(k * 2) * fade; ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot); scaleAt(ctx, lerp(0.7, 1, k), lerp(0.7, 1, k), 0, 0);
    card(ctx, -w / 2, -h / 2, w, h + 46, { lift: 0.8 });
    thumb(ctx, i, -w / 2 + 14, -h / 2 + 14, w - 28, h - 28);
    txt(ctx, name, -w / 2 + 18, h / 2 + 32, font(28, 800, UI), C.ink);
    ctx.restore();
  });
  // actions on the opened artefact
  if (open > 0) {
    ['Rouvrir', 'Modifier', 'Exporter', 'Partager'].forEach((v, i) => {
      const kv = sp(lt, c5.verbs[i] - 0.05, SPRING.bouncy);
      const hot = i === 3 && lt > c5.verbs[3] + 0.3;
      pill(ctx, v, 110 + i * 205, 650, { fill: hot ? C.artefacts : C.card, col: hot ? C.card : C.ink, size: 26, k: kv });
    });
    const kl = sp(lt, c5.lien - 0.1, SPRING.bouncy);
    if (kl > 0) {
      ctx.save(); scaleAt(ctx, kl, kl, 500, 330);
      card(ctx, 240, 290, 520, 84, { r: 42, fill: C.ink });
      icLink(ctx, 300, 332, 18, C.card); txt(ctx, 'Lien de partage copié', 340, 342, font(26, 800, UI), C.card);
      okBadge(ctx, 716, 332, 18, sp(lt, c5.lien + 0.2, SPRING.bouncy), C.artefacts);
      ctx.restore();
    }
  }
  if (grid > 0 && open < 1) alpha(ctx, grid * (1 - open), () => txt(ctx, 'Mes artéfacts', 30, 40, font(30, 800, UI), C.ink));
  cursor(ctx, [[-0.1, 600, 700], [c5.click - 0.1, 70, 216], [c5.ici + 0.5, 700, 380], [c5.open - 0.05, 640, 200], [c5.verbs[3] + 0.1, 760, 664], [c5.lien + 0.6, 900, 700]], [c5.click, c5.open - 0.05, c5.verbs[3] + 0.3], lt);
}
hit(S5, -0.25, 'in', 'whoosh', { len: 0.35, from: 2400, to: 600 }); hit(S5, c5.click, 'click artefacts', 'click');
c5.items.forEach((tt, i) => hit(S5, tt - 0.1, `art ${i}`, 'pop', { pitch: ['D5', 'E5', 'F#5', 'A5', 'D6'][i] }));
hit(S5, c5.ici - 0.1, 'grid', 'whoosh', { len: 0.4, from: 600, to: 2000 }); hit(S5, c5.open - 0.05, 'open', 'click');
c5.verbs.forEach((tt, i) => hit(S5, tt - 0.05, `verb ${i}`, 'blip', { pitch: ['E5', 'G5', 'B5', 'D6'][i] }));
hit(S5, c5.verbs[3] + 0.3, 'click partager', 'click'); hit(S5, c5.lien - 0.1, 'lien', 'bell', { pitch: 'A5' });

// 6 · Tâches planifiées
const S6 = SC.taches, c6 = {
  tp: S6.w('taches', 0, 0.8), rep: S6.w('repete', 0, 3), lundi: S6.w('lundi', 0, 4), veille: S6.w('veille', 0, 5), freq: S6.w('frequence', 0, 6.5),
  auto: S6.w('automatiquement', 0, 8), eteint: S6.w('eteint', 0, 10),
};
c6.click = c6.tp + 0.35; c6.form = c6.click + 0.3; c6.sel = c6.freq + 0.3; c6.save = c6.freq + 1.1;
const TASK = 'Chaque lundi à 8 h, fais-moi un résumé de l’actualité de l’IA';
function s6(ctx, lt, IMG) {
  const out = io(lt, c6.auto - 0.3, 0.3, E.inCubic);
  sidebar(ctx, IMG, 0, 0, 330, { lit: [0, 0, 0, io(lt, c6.click, 0.25)], active: lt > c6.click ? 3 : -1, k: sp(lt, -0.25, SPRING.gentle) * (1 - out) });
  const kf = sp(lt, c6.form, SPRING.snappy) * (1 - out);
  if (kf > 0.001) {
    ctx.save(); ctx.globalAlpha *= clamp(kf * 2); scaleAt(ctx, lerp(0.6, 1, kf), lerp(0.6, 1, kf), 160, 300);
    windowCard(ctx, 150, 220, 840, 500, 'Nouvelle tâche');
    field(ctx, 190, 320, 760, 'INSTRUCTION', typed(TASK, lt, c6.form + 0.3, c6.veille + 0.6), lt > c6.form + 0.3 && lt < c6.veille + 0.8, { h: 100, size: 30 });
    txt(ctx, 'FRÉQUENCE', 190, 480, font(24, 800, UI), C.grey, 'left', 1);
    ['Chaque jour', 'Chaque semaine', 'Chaque mois'].forEach((s, i) => {
      const on = i === 1 && lt > c6.sel;
      rrect(ctx, 190 + i * 230, 492, 216, 56, 14); ctx.fillStyle = on ? C.taches : C.paper; ctx.fill();
      txt(ctx, s, 298 + i * 230, 529, font(25, 800, UI), on ? C.card : C.ink, 'center');
    });
    pill(ctx, 'lundi · 08:00', 190, 602, { fill: 'rgba(30,140,255,0.12)', col: C.taches, size: 26, k: sp(lt, c6.sel + 0.2, SPRING.bouncy) });
    button(ctx, lt > c6.save ? 'Enregistrée' : 'Enregistrer', 760, 640, 190, 52, { fill: lt > c6.save ? C.ok : C.ink, size: 20, press: pressAt(lt, c6.save) });
    ctx.restore();
  }
  // it runs by itself: every Monday at 8:00, even with the computer off
  const kw = sp(lt, c6.auto - 0.1, SPRING.snappy);
  if (kw > 0) {
    ctx.save(); ctx.globalAlpha *= clamp(kw * 2); ctx.translate(0, (1 - kw) * 80);
    card(ctx, 40, 30, 920, 230);
    ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach((d, i) => {
      const x = 110 + i * 128;
      txt(ctx, d, x, 100, font(30, 800, UI), i === 0 ? C.taches : C.grey, 'center');
      rrect(ctx, x - 48, 124, 96, 96, 18); ctx.fillStyle = i === 0 ? 'rgba(30,140,255,0.12)' : C.paper; ctx.fill();
    });
    txt(ctx, '08:00', 110, 160, font(20, 800, UI), C.taches, 'center');
    okBadge(ctx, 110, 190, 20, sp(lt, c6.auto + 0.4, SPRING.bouncy), C.taches);
    ctx.restore();
    // laptop goes dark, Claude carries on in the cloud
    const off = io(lt, c6.eteint - 0.1, 0.4);
    ctx.save(); ctx.translate(250, 470);
    rrect(ctx, -150, -110, 300, 190, 16); ctx.fillStyle = C.ink; ctx.fill();
    rrect(ctx, -136, -96, 272, 162, 8); ctx.fillStyle = M.mix('#DCE8FF', '#101014', off); ctx.fill();
    rrect(ctx, -190, 80, 380, 22, 10); ctx.fillStyle = '#B8B6BD'; ctx.fill();
    if (off > 0.5) txt(ctx, 'éteint', 0, -6, font(24, 700, UI), '#55535A', 'center');
    ctx.restore();
    icCloud(ctx, 690, 460, 80, 'rgba(30,140,255,0.15)');
    if (lt < c6.eteint + 0.8) spinner(ctx, 700, 466, 26, lt, ''); else okBadge(ctx, 700, 466, 30, sp(lt, c6.eteint + 0.8, SPRING.bouncy), C.taches);
    alpha(ctx, io(lt, c6.eteint + 0.9, 0.3), () => txt(ctx, 'Résumé envoyé', 700, 590, font(28, 800, UI), C.ink, 'center'));
  }
  pill(ctx, 'Forfait payant', 0, 700, { fill: 'rgba(28,28,30,0.06)', col: C.grey, size: 21, k: io(lt, c6.form, 0.4) * (1 - out) });
  cursor(ctx, [[-0.1, 600, 700], [c6.click - 0.1, 70, 304], [c6.sel - 0.3, 520, 520], [c6.save - 0.3, 850, 666], [c6.save + 0.5, 920, 720]], [c6.click, c6.sel, c6.save], lt);
}
hit(S6, -0.25, 'in', 'whoosh', { len: 0.35, from: 2400, to: 600 }); hit(S6, c6.click, 'click taches', 'click'); hit(S6, c6.form, 'form', 'pop', { pitch: 'A5' });
hit(S6, c6.form + 0.3, 'type task', 'type', { n: 30, len: c6.veille + 0.3 - c6.form }); hit(S6, c6.sel, 'weekly', 'click'); hit(S6, c6.save, 'save', 'click');
hit(S6, c6.save + 0.05, 'saved', 'bell', { pitch: 'A5' }); hit(S6, c6.auto + 0.4, 'monday', 'bell', { pitch: 'D6' });
hit(S6, c6.eteint - 0.1, 'off', 'thud', { pitch: 'C3' }); hit(S6, c6.eteint + 0.8, 'sent', 'blip', { pitch: 'E6' });

// 7 · Conclusion
const S7 = SC.fin, c7 = { v: [S7.w('organiser', 0, 0.8), S7.w('developper', 0, 2), S7.w('creer', 0, 3.2), S7.w('automatiser', 0, 4.4)], abo: S7.w('abonnez-vous', 0, 6.5) };
c7.click = c7.abo + 0.6; c7.logo = S7.dur - 2.6;
const VERBS = ['Organiser', 'Coder', 'Créer', 'Automatiser'];
function s7(ctx, lt) {
  const up = io(lt, c7.abo - 0.3, 0.5, E.inOutCubic), gone = io(lt, c7.logo - 0.2, 0.35, E.inCubic);
  [0, 1, 2, 3].forEach((i) => {
    const k = sp(lt, Math.min(c7.v[i] - 0.15, i === 0 ? -0.1 : 99), SPRING.bouncy);
    if (k <= 0) return;
    const x = 20 + i * 245, y = lerp(150, 40, up), col = C[KEYS[i]];
    ctx.save(); ctx.globalAlpha *= clamp(k * 2) * (1 - gone); scaleAt(ctx, k, k, x + 110, y + 150);
    card(ctx, x, y, 220, 300);
    disc(ctx, x + 110, y + 90, 50, col); ICON[KEYS[i]](ctx, x + 110, y + 92, 30, C.card);
    txt(ctx, NAMES[i], x + 110, y + 190, font(i === 3 ? 21 : 26, 800, UI), C.ink, 'center');
    const kv = sp(lt, c7.v[i] - 0.05, SPRING.bouncy);
    if (kv > 0) pill(ctx, VERBS[i], x + 110 - measure(ctx, VERBS[i], font(20, 700, UI)) / 2 - 16, y + 250, { fill: col, col: C.card, size: 20, k: kv });
    ctx.restore();
  });
  const kb = sp(lt, c7.abo - 0.1, SPRING.bouncy) * (1 - gone);
  if (kb > 0.001) {
    ctx.save(); ctx.globalAlpha *= clamp(kb * 2); scaleAt(ctx, kb, kb, 500, 520);
    const on = lt > c7.click;
    button(ctx, on ? 'Abonné' : 'S’abonner', 330, 470, 340, 100, { fill: on ? C.card : '#E8322D', col: on ? C.ink : C.card, size: 36, press: pressAt(lt, c7.click) });
    if (on) check(ctx, 382, 520, 34, io(lt, c7.click, 0.25), C.ink);
    ctx.restore();
  }
  cursor(ctx, [[c7.abo - 0.2, 900, 720], [c7.click - 0.1, 560, 540], [c7.logo, 640, 640]], [c7.click], lt * (1 - gone) + (gone ? -99 : 0));
}
c7.v.forEach((tt, i) => hit(S7, tt - 0.15, `tile ${i}`, 'pop', { pitch: ['D5', 'F#5', 'A5', 'D6'][i] }));
hit(S7, c7.abo - 0.1, 'button', 'pop', { pitch: 'A5' }); hit(S7, c7.click, 'subscribe', 'click'); hit(S7, c7.click + 0.05, 'subscribed', 'bell', { pitch: 'A5' });
hit(S7, c7.logo, 'logo', 'sub', { len: 0.8 }); hit(S7, c7.logo + 0.5, 'dot', 'bell', { pitch: 'D6' });

// end card: the signature, over everything
function endCard(ctx, lt) {
  const k = io(lt, c7.logo, 0.4, E.outCubic);
  if (k <= 0) return;
  const f = font(P ? 200 : 180, 900, UI), w = measure(ctx, 'jumota', f, -6), wd = measure(ctx, '.', f), cx = W / 2, cy = H / 2;
  ctx.save(); ctx.globalAlpha = k;
  const b = (1 - k) * 16; if (b > 0.3) ctx.filter = `blur(${b.toFixed(1)}px)`;
  txt(ctx, 'jumota', cx - (w + wd) / 2, cy + (1 - k) * 40, f, C.ink, 'left', -6);
  const kd = sp(lt, c7.logo + 0.45, { stiffness: 300, damping: 11 });
  ctx.fillStyle = C.blue; ctx.font = f; ctx.fillText('.', cx - (w + wd) / 2 + w, cy - (1 - kd) * 400);
  ctx.filter = 'none';
  alpha(ctx, io(lt, c7.logo + 0.8, 0.4), () => {
    txt(ctx, 'Jumota Agency  ·  Marketing digital & IA', cx, cy + 90, font(P ? 40 : 36, 600, UI), C.grey, 'center');
  });
  ctx.restore();
}

// ------------------------------------------------------------------ assembly
const HEADS = {
  hook: [['Projets', C.projets], [','], ['Code', C.code], [','], ['Artéfacts', C.artefacts], [','], ['Tâches planifiées', C.taches], [': c’est quoi ?']],
  menu: [['4 rubriques ='], ['4 super-pouvoirs', C.ink, true]],
  projets: [['PROJETS', C.projets, true], ['= un espace de travail par sujet']],
  code: [['CODE', C.code, true], ['= Claude programme pour vous']],
  artefacts: [['ARTÉFACTS', C.artefacts, true], ['= toutes vos créations au même endroit']],
  taches: [['TÂCHES PLANIFIÉES', C.taches, true], ['= Claude travaille même sans vous']],
  fin: [['Organiser', C.projets], ['·', C.grey], ['Coder', C.code], ['·', C.grey], ['Créer', C.artefacts], ['·', C.grey], ['Automatiser', C.taches]],
};
const PLAN = [[SC.hook, s1], [SC.menu, s2], [SC.projets, s3], [SC.code, s4], [SC.artefacts, s5], [SC.taches, s6], [SC.fin, s7]];
const SW = [-0.35, 0.05];   // the slide between scenes: both on screen, the new one arriving on the cut
function run(ctx, [S, draw], t, IMG, i) {
  const lt = t - S.start, last = i === PLAN.length - 1;
  if (lt < SW[0] || (!last && lt > S.dur + SW[1])) return;
  const qi = i ? E.inOutCubic(prog(lt, SW[0], SW[1])) : 1, qo = last ? 0 : E.inOutCubic(prog(lt, S.dur + SW[0], S.dur + SW[1]));
  const dx = (1 - qi) * W - qo * W;
  ctx.save(); ctx.translate(dx, 0);
  const z = lerp(0.94, 1, qi) * lerp(1, 0.94, qo);
  // headline (texte à l'écran)
  const hide = last ? io(lt, c7.logo - 0.2, 0.3) : 0;
  alpha(ctx, 1 - hide, () => headline(ctx, HEADS[S.key], lt));
  // stage
  const { x, y, s } = LAY.st;
  ctx.save(); ctx.translate(x + 500 * s, y + 360 * s); ctx.scale(s * z, s * z); ctx.translate(-500, -360);
  draw(ctx, lt, IMG);
  ctx.restore();
  ctx.restore();
  if (last) endCard(ctx, lt);
}
function background(ctx, t) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.beginPath();
  const st = 64, oy = -((t * 6) % st);
  for (let x = 0; x <= W; x += st) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
  for (let y = oy; y <= H; y += st) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
  ctx.stroke();
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(255,255,255,0.35)'); v.addColorStop(1, 'rgba(210,205,220,0.25)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}
function logo(ctx, t) {   // the brand mark stays at the bottom throughout
  const fade = 1 - io(t - SC.fin.start, c7.logo - 0.2, 0.3);
  if (fade <= 0) return;
  const f = font(34, 900, UI), w = measure(ctx, 'jumota', f, -1);
  ctx.save(); ctx.globalAlpha = 0.85 * fade;
  txt(ctx, 'jumota', LAY.logo.x - w / 2 - 6, LAY.logo.y, f, C.soft, 'left', -1);
  ctx.fillStyle = C.blue; ctx.font = f; ctx.fillText('.', LAY.logo.x + w / 2 - 6, LAY.logo.y);
  ctx.restore();
}
for (let i = 1; i < PLAN.length; i++) hit(PLAN[i][0], -0.3, `slide ${i}`, 'whoosh', { len: 0.35, from: 2200, to: 500 });
HITS.sort((a, b) => a[0] - b[0]);
// one sound per moment: drop duplicates landing within 30 ms of each other with the same voice
const HITS_CLEAN = HITS.filter((h, i) => !HITS.slice(0, i).some((g) => g[2] === h[2] && Math.abs(g[0] - h[0]) < 0.06));

M.film({
  fonts: [font(80, 900, UI), font(80, 800, UI), font(80, 700, UI), font(80, 600, UI), font(80, 500, UI), font(30, 500, MONO)],
  images: { sidebar: 'assets/sidebar.jpg' },
  hits: HITS_CLEAN,
  samples: 4,
  draw(ctx, u, t, IMG) {
    background(ctx, t);
    PLAN.forEach((p, i) => run(ctx, p, t, IMG, i));
    subtitles(ctx, t);
    logo(ctx, t);
  },
});
