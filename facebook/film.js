// Automatiser sa page Facebook avec l'IA de A à Z – Jumota Agency.
// Pure function of time: window.seek(t) paints frame t. Scene times and phrase timings come from
// timeline.json (built by tools/timeline.py from the ElevenLabs voice-over); docs/shotlist.md is the plan.
// Two formats from one film: 16x9 (YouTube) and 9x16 (Reels / Shorts / TikTok), each composed for its shape.
import * as M from './lib/motion.js';

const { W, H, E, prog, lerp, clamp, SPRING, font, rrect, hash01, noise1, mix, FORMAT } = M;
const P = FORMAT.portrait;

const TL = await fetch('timeline.json').then((r) => r.json());
const SC = TL.scenes;
const DISPLAY = 'Display', UI = 'UI';

// Jumota palette: bleu nuit, bleu électrique (light only), cyan accent, blanc.
const C = {
  bg0: '#071426', bg1: '#0B1E40', ink: '#FFFFFF', mute: '#8FA3CC', dim: '#4A5E8E',
  panel: '#0C1B3A', panel2: '#10234A', line: '#21396E', cyan: '#00D9FF', blue: '#126BFF',
};
const CYA = (a) => `rgba(0,217,255,${a})`;

// ------------------------------------------------------------------ helpers (all pure)
const sp = (lt, t0, cfg = SPRING.snappy) => M.spring(lt - t0, cfg);
const io = (lt, a, d, ease = E.outCubic) => ease(prog(lt, a, a + d));
const alpha = (ctx, a, fn) => { if (a <= 0.001) return; ctx.save(); ctx.globalAlpha *= clamp(a); fn(); ctx.restore(); };
const ph = (S, i) => S.phrases[Math.min(i, S.phrases.length - 1)].t0 - S.start;   // local time a phrase starts
const pe = (S, i) => S.phrases[Math.min(i, S.phrases.length - 1)].t1 - S.start;   // local time a phrase ends

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
// A line of words rising out of a mask, one after another. parts: [[word, color], ...] or a string.
function rise(ctx, parts, x, y, size, t0, lt, { weight = 800, family = DISPLAY, stagger = 0.07, color = C.ink, track = -0.02, out = null, align = 'left' } = {}) {
  if (typeof parts === 'string') parts = parts.split(' ').map((w) => [w, color]);
  const f = font(size, weight, family), tr = track * size;
  const sw = measure(ctx, ' ', f);
  const ws = parts.map(([w]) => measure(ctx, w, f, tr));
  const total = ws.reduce((a, b) => a + b, 0) + sw * (parts.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  ctx.save(); ctx.beginPath(); ctx.rect(cx - 40, y - size * 1.05, total + 80, size * 1.38); ctx.clip();
  parts.forEach(([w, col], i) => {
    const k = sp(lt, t0 + i * stagger, SPRING.snappy);
    let dy = (1 - k) * size * 1.1;
    if (out != null) dy -= E.inCubic(prog(lt, out + i * 0.03, out + 0.35 + i * 0.03)) * size * 1.3;
    if (k > 0) txt(ctx, w, cx, y + dy, f, col, 'left', tr);
    cx += ws[i] + sw;
  });
  ctx.restore();
  return total;
}
function panel(ctx, x, y, w, h, r = 26, fillc = C.panel, stroke = C.line) {
  rrect(ctx, x, y, w, h, r); ctx.fillStyle = fillc; ctx.fill();
  if (stroke) { ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke(); }
}
const pillW = (ctx, label, size = 26) => measure(ctx, label, font(size, 700, UI), size * 0.06) + size * 1.4;
function pill(ctx, label, x, y, k, { size = 26, filled = false, color = C.cyan } = {}) {
  if (k <= 0.001) return 0;
  const f = font(size, 700, UI), tr = size * 0.06, w = pillW(ctx, label, size), h = size * 2.05;
  ctx.save(); ctx.translate(x + w / 2, y); ctx.scale(k, k); ctx.translate(-(x + w / 2), -y);
  rrect(ctx, x, y - h / 2, w, h, h / 2);
  if (filled) { ctx.fillStyle = color; ctx.fill(); } else { ctx.fillStyle = CYA(0.10); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.stroke(); }
  txt(ctx, label, x + size * 0.7, y + size * 0.36, f, filled ? C.bg0 : color, 'left', tr);
  ctx.restore();
  return w;
}
function arrow(ctx, x0, y0, x1, y1, k, color = C.cyan, wdt = 5) {
  if (k <= 0) return;
  const xe = lerp(x0, x1, k), ye = lerp(y0, y1, k), a = Math.atan2(y1 - y0, x1 - x0);
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = wdt; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(xe - 8 * Math.cos(a), ye - 8 * Math.sin(a)); ctx.stroke();
  ctx.translate(xe, ye); ctx.rotate(a);
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-14, -12); ctx.lineTo(-14, 12); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function check(ctx, x, y, s, k, color = C.cyan) {
  if (k <= 0) return;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const pts = [[x - s * 0.35, y], [x - s * 0.1, y + s * 0.25], [x + s * 0.4, y - s * 0.3]];
  const L1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), L2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
  const d = clamp(k) * (L1 + L2);
  ctx.beginPath(); ctx.moveTo(...pts[0]);
  if (d <= L1) ctx.lineTo(lerp(pts[0][0], pts[1][0], d / L1), lerp(pts[0][1], pts[1][1], d / L1));
  else { ctx.lineTo(...pts[1]); const q = (d - L1) / L2; ctx.lineTo(lerp(pts[1][0], pts[2][0], q), lerp(pts[1][1], pts[2][1], q)); }
  ctx.stroke(); ctx.restore();
}
function checkDot(ctx, x, y, r, k, kc) {  // filled cyan disc with a dark check
  if (k <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, M.TAU); ctx.fillStyle = C.cyan; ctx.fill(); ctx.restore();
  check(ctx, x, y, r * 1.1, kc, C.bg0);
}
function scaleAt(ctx, k, x, y) { ctx.translate(x, y); ctx.scale(k, k); ctx.translate(-x, -y); }
function bar(ctx, x, y, w, h = 12, col = 'rgba(143,163,204,0.35)') { if (w <= 0) return; ctx.fillStyle = col; rrect(ctx, x, y, w, h, h / 2); ctx.fill(); }
function wrapLines(ctx, str, f, maxW) {
  const words = str.split(' '), out = []; let cur = '';
  words.forEach((w) => { const t = cur ? cur + ' ' + w : w; if (measure(ctx, t, f) > maxW && cur) { out.push(cur); cur = w; } else cur = t; });
  if (cur) out.push(cur); return out;
}
const fmtN = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// ------------------------------------------------------------------ icons (stylised pictograms, never official logos)
function icChat(ctx, x, y, s, col = C.cyan, bgc = C.bg0) {
  ctx.save(); ctx.fillStyle = col;
  rrect(ctx, x - s, y - s * 0.75, s * 2, s * 1.4, s * 0.45); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - s * 0.5, y + s * 0.5); ctx.lineTo(x - s * 0.75, y + s * 1.05); ctx.lineTo(x - s * 0.05, y + s * 0.6); ctx.fill();
  ctx.fillStyle = bgc;
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(x + i * s * 0.5, y - s * 0.05, s * 0.15, 0, M.TAU); ctx.fill(); }
  ctx.restore();
}
function icPalette(ctx, x, y, s, col = C.cyan, bgc = C.bg0) {
  ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.85, 0, 0, M.TAU); ctx.fill();
  ctx.fillStyle = bgc; ctx.beginPath(); ctx.arc(x + s * 0.45, y + s * 0.35, s * 0.2, 0, M.TAU); ctx.fill();
  [[-0.45, -0.2], [-0.1, -0.5], [0.35, -0.35], [-0.5, 0.25]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, s * 0.13, 0, M.TAU); ctx.fill(); });
  ctx.restore();
}
function icCal(ctx, x, y, s, col = C.cyan, bgc = C.bg0) {
  ctx.save(); ctx.fillStyle = col; rrect(ctx, x - s, y - s * 0.8, s * 2, s * 1.75, s * 0.3); ctx.fill();
  ctx.fillStyle = bgc; ctx.fillRect(x - s * 0.8, y - s * 0.25, s * 1.6, s * 0.08);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { rrect(ctx, x - s * 0.7 + c * s * 0.5, y + s * 0.02 + r * s * 0.4, s * 0.36, s * 0.26, 3); ctx.fill(); }
  ctx.fillStyle = col; rrect(ctx, x - s * 0.55, y - s * 1.05, s * 0.18, s * 0.5, 4); ctx.fill(); rrect(ctx, x + s * 0.37, y - s * 1.05, s * 0.18, s * 0.5, 4); ctx.fill();
  ctx.restore();
}
function icBot(ctx, x, y, s, col = C.cyan, bgc = C.bg0) {
  ctx.save(); ctx.fillStyle = col; rrect(ctx, x - s, y - s * 0.65, s * 2, s * 1.45, s * 0.5); ctx.fill();
  ctx.fillRect(x - s * 0.06, y - s * 1.05, s * 0.12, s * 0.42); ctx.beginPath(); ctx.arc(x, y - s * 1.08, s * 0.16, 0, M.TAU); ctx.fill();
  ctx.fillStyle = bgc; ctx.beginPath(); ctx.arc(x - s * 0.42, y - s * 0.02, s * 0.2, 0, M.TAU); ctx.arc(x + s * 0.42, y - s * 0.02, s * 0.2, 0, M.TAU); ctx.fill();
  rrect(ctx, x - s * 0.35, y + s * 0.35, s * 0.7, s * 0.14, 4); ctx.fill();
  ctx.restore();
}
function icFlow(ctx, x, y, s, col = C.cyan) {
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = s * 0.16;
  const pts = [[x - s * 0.8, y + s * 0.4], [x, y - s * 0.5], [x + s * 0.8, y + s * 0.4]];
  ctx.beginPath(); ctx.moveTo(...pts[0]); ctx.lineTo(...pts[1]); ctx.lineTo(...pts[2]); ctx.stroke();
  pts.forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, s * 0.34, 0, M.TAU); ctx.fill(); });
  ctx.restore();
}
function icPage(ctx, x, y, s, col = C.cyan, bgc = C.bg0) {
  ctx.save(); ctx.fillStyle = col; rrect(ctx, x - s * 0.8, y - s, s * 1.6, s * 2, s * 0.25); ctx.fill();
  ctx.fillStyle = bgc; ctx.beginPath(); ctx.arc(x, y - s * 0.35, s * 0.3, 0, M.TAU); ctx.fill();
  rrect(ctx, x - s * 0.5, y + s * 0.15, s, s * 0.14, 4); ctx.fill(); rrect(ctx, x - s * 0.5, y + s * 0.45, s * 0.7, s * 0.14, 4); ctx.fill();
  ctx.restore();
}
function icChart(ctx, x, y, s, col = C.cyan) {
  ctx.save(); ctx.fillStyle = col; [0.6, 1.1, 0.8, 1.6].forEach((h, i) => { rrect(ctx, x - s + i * s * 0.55, y + s * 0.8 - h * s, s * 0.38, h * s, 4); ctx.fill(); }); ctx.restore();
}
function icClock(ctx, x, y, s, a = 0, col = C.cyan) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, s, 0, M.TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(a) * s * 0.65, y - Math.cos(a) * s * 0.65);
  ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(a / 12) * s * 0.45, y - Math.cos(a / 12) * s * 0.45); ctx.stroke(); ctx.restore();
}
function icMoon(ctx, x, y, s, col = C.cyan, bgc = C.panel) {
  ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, s, 0, M.TAU); ctx.fill();
  ctx.fillStyle = bgc; ctx.beginPath(); ctx.arc(x + s * 0.45, y - s * 0.3, s * 0.85, 0, M.TAU); ctx.fill(); ctx.restore();
}
function icPerson(ctx, x, y, s, col = C.ink) {
  ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y - s * 0.45, s * 0.42, 0, M.TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x, y + s * 0.65, s * 0.8, s * 0.55, 0, Math.PI, 0); ctx.fill(); ctx.restore();
}
function icSpark(ctx, x, y, s, col = C.cyan) {
  ctx.save(); ctx.fillStyle = col; ctx.beginPath();
  for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.28 : s, a = -Math.PI / 2 + i * Math.PI / 4; ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); }
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function icPlay(ctx, x, y, s, col = C.ink, bgc = C.bg0) { ctx.fillStyle = col; rrect(ctx, x - s * 1.1, y - s * 0.75, s * 2.2, s * 1.5, s * 0.45); ctx.fill(); ctx.fillStyle = bgc; ctx.beginPath(); ctx.moveTo(x - s * 0.3, y - s * 0.4); ctx.lineTo(x + s * 0.45, y); ctx.lineTo(x - s * 0.3, y + s * 0.4); ctx.fill(); }
function icF(ctx, x, y, s, col = C.ink) { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = s * 0.3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + s * 0.1, y + s); ctx.lineTo(x + s * 0.1, y - s * 0.3); ctx.quadraticCurveTo(x + s * 0.1, y - s * 0.9, x + s * 0.65, y - s * 0.9); ctx.moveTo(x - s * 0.35, y - s * 0.05); ctx.lineTo(x + s * 0.55, y - s * 0.05); ctx.stroke(); ctx.restore(); }
function icNote(ctx, x, y, s, col = C.ink) { ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = s * 0.26; ctx.beginPath(); ctx.arc(x - s * 0.3, y + s * 0.55, s * 0.42, 0, M.TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + s * 0.1, y + s * 0.55); ctx.lineTo(x + s * 0.1, y - s); ctx.quadraticCurveTo(x + s * 0.3, y - s * 0.35, x + s * 0.85, y - s * 0.4); ctx.stroke(); ctx.restore(); }
function icInsta(ctx, x, y, s, col = C.ink) { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = s * 0.2; rrect(ctx, x - s, y - s, s * 2, s * 2, s * 0.55); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, s * 0.45, 0, M.TAU); ctx.stroke(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + s * 0.55, y - s * 0.55, s * 0.13, 0, M.TAU); ctx.fill(); ctx.restore(); }

const TOOLS = [
  { name: 'CHATGPT', role: 'Créer les contenus', icon: icChat },
  { name: 'CANVA', role: 'Concevoir les visuels', icon: icPalette },
  { name: 'META BUSINESS SUITE', role: 'Programmer les publications', icon: icCal },
  { name: 'MANYCHAT', role: 'Automatiser les conversations', icon: icBot },
  { name: 'MAKE', role: 'Connecter les outils', icon: icFlow },
];

// ------------------------------------------------------------------ background (continuous across scenes)
function bg(ctx, t, px) {
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, C.bg0); g.addColorStop(1, C.bg1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const orb = (x, y, r, rgb, a) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(${rgb},${a})`); rg.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  orb(W * 0.84 + 120 * noise1(t * 0.05, 2) - px * 0.15, H * 0.18 + 80 * noise1(t * 0.04, 5), P ? 900 : 780, '18,107,255', 0.26);
  orb(W * 0.12 + 140 * noise1(t * 0.03, 8) - px * 0.1, H * 0.95, P ? 950 : 820, '0,217,255', 0.10);
  ctx.save(); ctx.strokeStyle = 'rgba(143,163,204,0.055)'; ctx.lineWidth = 1;
  const step = 80, ox = -((t * 6 + px * 0.3) % step), oy = -((t * 3) % step);
  ctx.beginPath();
  for (let x = ox; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = oy; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke(); ctx.restore();
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// ------------------------------------------------------------------ step layout (scenes 2-9)
// Each step: left text column (label, big number, title, keyword chips) + an illustration card.
// The card is always drawn in its own 840x680 space and scaled into place per format.
const LAY = P
  ? { lx: 80, labelY: 300, numY: 478, numSize: 200, numClip: [300, 500], progY: 290, progX: 620, titleY: 586, titleMax: 920, titleSize: 62, chipY: 720, chipMax: 1000, chipSize: 22,
      card: { x: 86, y: 820, s: 1.08 } }
  : { lx: 140, labelY: 244, numY: 530, numSize: 290, numClip: [270, 570], progY: 584, progX: 140, titleY: 690, titleMax: 760, titleSize: 66, chipY: 850, chipMax: 900, chipSize: 26,
      card: { x: 960, y: 150, s: 1 } };
const CB = { x: 0, y: 0, w: 840, h: 680 };

const STEPS = [
  { n: '?', label: 'LES BASES', idx: -1, title: ['Comprendre', "l'automatisation"], chips: [['AUTOMATISATION', 1], ['IA', 2, 2.4], ['GAIN DE TEMPS', 15, 1.6]], ill: illBasics },
  { n: '01', label: 'ÉTAPE', idx: 0, title: ['Préparer sa', 'page Facebook'], chips: [['PAGE PRO', 1, 0.6], ['PROFIL', 4], ['META BUSINESS SUITE', 10, 0.5]], ill: illPage },
  { n: '02', label: 'ÉTAPE', idx: 1, title: ['Créer ses contenus', 'avec ChatGPT'], chips: [['CHATGPT', 2], ['IDÉES', 3], ['CALENDRIER', 5, 1.4]], ill: illChat },
  { n: '03', label: 'ÉTAPE', idx: 2, title: ['Créer des visuels', 'avec Canva'], chips: [['CANVA', 3], ['AFFICHES', 4, 0.8], ['CARROUSELS', 5], ['IDENTITÉ', 9]], ill: illCanva },
  { n: '04', label: 'ÉTAPE', idx: 3, title: ['Programmer ses', 'publications'], chips: [['PLANIFICATEUR', 3, 0.6], ['DATE + HEURE', 4, 0.6], ['LUNDI – DIMANCHE', 8, 1.2]], ill: illPlanner },
  { n: '05', label: 'ÉTAPE', idx: 4, title: ['Créer un chatbot', 'avec Manychat'], chips: [['MANYCHAT', 4, 0.6], ['MESSENGER', 5, 2.2], ['24 H / 24', 21]], ill: illBot },
  { n: '06', label: 'ÉTAPE', idx: 5, title: ['Connecter les outils', 'avec Make'], chips: [['MAKE', 3, 0.3], ['WORKFLOW', 11, 0.6]], ill: illMake },
  { n: '07', label: 'ÉTAPE', idx: 6, title: ['Analyser les', 'performances'], chips: [['STATISTIQUES', 2, 0.5], ['OPTIMISER', 8, 0.5], ['ÉVOLUER', 10, 1.0]], ill: illStats },
];
const chipAt = (S, c) => ph(S, c[1]) + (c[2] || 0);

function stepScene(ctx, lt, S, st) {
  const L = LAY;
  // label (+ progress through the 7 steps)
  const a0 = io(lt, -0.3, 0.4);
  alpha(ctx, a0, () => {
    ctx.fillStyle = C.cyan; ctx.fillRect(L.lx, L.labelY - 12, 46 * a0, 4);
    txt(ctx, st.label, L.lx + 62, L.labelY, font(P ? 26 : 28, 700, UI), C.cyan, 'left', 7);
  });
  if (st.idx >= 0) {
    for (let i = 0; i < 7; i++) {
      const k = io(lt, 0.0 + i * 0.04, 0.3);
      const x = L.progX + i * (P ? 52 : 60), on = i <= st.idx;
      ctx.fillStyle = i === st.idx ? C.cyan : on ? CYA(0.45) : 'rgba(143,163,204,0.22)';
      rrect(ctx, x, L.progY, (P ? 42 : 50) * k, 8, 4); ctx.fill();
    }
  }
  // big number: digits spring up one after the other
  const nf = font(L.numSize, 800, DISPLAY), dw = L.numSize * 0.69;
  [...st.n].forEach((d, i) => {
    const k = sp(lt, -0.2 + i * 0.08, SPRING.bouncy);
    if (k <= 0) return;
    ctx.save(); ctx.beginPath(); ctx.rect(L.lx - 20, L.numClip[0], 800, L.numClip[1] - L.numClip[0]); ctx.clip();
    txt(ctx, d, L.lx + i * dw, L.numY + (1 - k) * L.numSize, nf, i === 0 && st.n.length > 1 ? C.dim : C.cyan, 'left', -10);
    ctx.restore();
  });
  // title (fit to the column)
  const tf = Math.min(L.titleSize, ...st.title.map((l) => fit(ctx, l, L.titleSize, L.titleMax)));
  st.title.forEach((l, i) => rise(ctx, l, L.lx, L.titleY + i * tf * 1.12, tf, 0.1 + i * 0.12, lt));
  // keyword chips, wrapping to a second row when the column is full
  let cx = L.lx, cy = L.chipY + (st.title.length - 2) * tf;
  st.chips.forEach((c) => {
    const w = pillW(ctx, c[0], L.chipSize);
    if (cx + w > L.lx + L.chipMax) { cx = L.lx; cy += L.chipSize * 2.6; }
    pill(ctx, c[0], cx, cy, sp(lt, chipAt(S, c), SPRING.bouncy), { size: L.chipSize });
    cx += w + 14;
  });
  // illustration card
  const kc = sp(lt, -0.15, SPRING.gentle);
  ctx.save();
  if (P) ctx.translate(0, (1 - kc) * 260); else ctx.translate((1 - kc) * 260, 0);
  ctx.globalAlpha *= clamp(kc * 1.4);
  ctx.translate(L.card.x, L.card.y); ctx.scale(L.card.s, L.card.s);
  panel(ctx, 0, 0, CB.w, CB.h, 30);
  ctx.save(); rrect(ctx, 0, 0, CB.w, CB.h, 30); ctx.clip();
  st.ill(ctx, lt, S, CB);
  ctx.restore(); ctx.restore();
}

function head(ctx, B, label, icon) {  // header strip inside a card
  if (icon) icon(ctx, B.x + 58, B.y + 50, 14);
  txt(ctx, label, B.x + (icon ? 86 : 40), B.y + 58, font(22, 700, UI), C.mute, 'left', 3);
  ctx.fillStyle = C.line; ctx.fillRect(B.x + 40, B.y + 84, B.w - 80, 2);
}

// ---------------- Scene 2: the five automatable tasks around the page
function illBasics(ctx, lt, S, B) {
  head(ctx, B, 'AUTOMATISATION · 5 TÂCHES', icSpark);
  const cx = 420, cy = 405, R = 200;
  const NODES = [['CRÉER', icChat, 5], ['PROGRAMMER', icCal, 7], ['RÉPONDRE', icBot, 9], ['ORGANISER', icPerson, 11], ['ANALYSER', icChart, 13]];
  const appear = ph(S, 2);
  // hub
  const kh = sp(lt, 0.3, SPRING.bouncy);
  NODES.forEach(([lab, icon, pi], i) => {
    const a = -Math.PI / 2 + i * M.TAU / 5, x = cx + Math.cos(a) * R * 1.32, y = cy + Math.sin(a) * R;
    const k = sp(lt, appear + 0.6 + i * 0.18, SPRING.bouncy);
    if (k <= 0) return;
    const on = io(lt, ph(S, pi) - 0.1, 0.35);
    // connection + energy dot
    ctx.save(); ctx.strokeStyle = on > 0 ? CYA(0.3 + 0.5 * on) : 'rgba(143,163,204,0.25)'; ctx.lineWidth = 3; ctx.setLineDash(on > 0 ? [] : [8, 10]);
    const sx = cx + Math.cos(a) * 92, sy = cy + Math.sin(a) * 92, ex = x - Math.cos(a) * 58, ey = y - Math.sin(a) * 58;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(lerp(sx, ex, k), lerp(sy, ey, k)); ctx.stroke(); ctx.restore();
    if (on > 0) {
      const q = ((lt - ph(S, pi)) * 0.7) % 1;
      ctx.beginPath(); ctx.arc(lerp(sx, ex, q), lerp(sy, ey, q), 6, 0, M.TAU); ctx.fillStyle = C.cyan; ctx.fill();
    }
    ctx.save(); scaleAt(ctx, k * (1 + 0.12 * M.bump(lt, ph(S, pi) + 0.15, 0.3)), x, y);
    ctx.beginPath(); ctx.arc(x, y, 56, 0, M.TAU); ctx.fillStyle = on > 0 ? mix(C.panel2, C.cyan, on) : C.panel2; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = on > 0 ? C.cyan : C.line; ctx.stroke();
    icon(ctx, x, y + 2, 22, on > 0.5 ? C.bg0 : C.mute, on > 0.5 ? C.cyan : C.panel2);
    const ly = y + (Math.sin(a) < -0.5 ? -76 : 92);
    txt(ctx, lab, x, ly, font(22, 800, UI), on > 0 ? C.ink : C.mute, 'center', 2);
    ctx.restore();
  });
  if (kh > 0) {
    ctx.save(); scaleAt(ctx, kh, cx, cy);
    // time ring: fills as "gagner du temps" is said
    const tr = io(lt, ph(S, 15) + 0.8, 1.6, E.inOutCubic);
    ctx.beginPath(); ctx.arc(cx, cy, 96, 0, M.TAU); ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(143,163,204,0.15)'; ctx.stroke();
    if (tr > 0) { ctx.beginPath(); ctx.arc(cx, cy, 96, -Math.PI / 2, -Math.PI / 2 + tr * M.TAU); ctx.strokeStyle = C.cyan; ctx.lineCap = 'round'; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(cx, cy, 80, 0, M.TAU); ctx.fillStyle = C.panel2; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.line; ctx.stroke();
    // "human stays" swap: page icon -> person + IA at "l'être humain"
    const hu = io(lt, ph(S, 14), 0.4);
    alpha(ctx, 1 - hu, () => { icPage(ctx, cx, cy - 12, 26); txt(ctx, 'TA PAGE', cx, cy + 50, font(18, 800, UI), C.ink, 'center', 2); });
    alpha(ctx, hu, () => { icPerson(ctx, cx - 22, cy - 6, 24); icSpark(ctx, cx + 26, cy - 14, 20); txt(ctx, 'TOI + IA', cx, cy + 50, font(18, 800, UI), C.ink, 'center', 2); });
    ctx.restore();
  }
}

// ---------------- Scene 3: building a business page, then linking Meta Business Suite
function phone(ctx, x, y, w, h, fillc = '#0A1838') {
  rrect(ctx, x, y, w, h, w * 0.13); ctx.fillStyle = fillc; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#2A4785'; ctx.stroke();
  ctx.fillStyle = '#2A4785'; rrect(ctx, x + w / 2 - 34, y + 14, 68, 10, 5); ctx.fill();
  return { x: x + 12, y: y + 36, w: w - 24, h: h - 48 };
}
function pageMock(ctx, s, lt, t) {  // generic business page inside screen rect s; t = { name, avatar, cover, desc, contact, button } start times
  ctx.save(); rrect(ctx, s.x, s.y, s.w, s.h, 18); ctx.clip();
  const kc = io(lt, t.cover, 0.6, E.outCubic);
  if (kc > 0) {
    const g = ctx.createLinearGradient(s.x, s.y, s.x + s.w, s.y + 140); g.addColorStop(0, C.blue); g.addColorStop(1, C.cyan);
    ctx.fillStyle = g; ctx.fillRect(s.x, s.y, s.w * kc, 140);
    alpha(ctx, kc, () => { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(s.x + s.w * 0.8, s.y + 30, 40 + i * 30, 0, M.TAU); ctx.stroke(); } });
  } else { ctx.fillStyle = 'rgba(143,163,204,0.12)'; ctx.fillRect(s.x, s.y, s.w, 140); }
  const ka = sp(lt, t.avatar, SPRING.bouncy);
  const ax = s.x + 64, ay = s.y + 140;
  ctx.beginPath(); ctx.arc(ax, ay, 46, 0, M.TAU); ctx.fillStyle = '#0A1838'; ctx.fill();
  if (ka > 0) { ctx.save(); scaleAt(ctx, ka, ax, ay); ctx.beginPath(); ctx.arc(ax, ay, 40, 0, M.TAU); ctx.fillStyle = C.ink; ctx.fill(); txt(ctx, 'J', ax, ay + 16, font(44, 800, DISPLAY), C.bg0, 'center'); ctx.restore(); }
  else { ctx.beginPath(); ctx.arc(ax, ay, 40, 0, M.TAU); ctx.strokeStyle = 'rgba(143,163,204,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.stroke(); ctx.setLineDash([]); }
  const kn = io(lt, t.name, 0.4);
  if (kn > 0) { alpha(ctx, kn, () => { txt(ctx, 'Ta Marque Pro', s.x + 22, ay + 86, font(28, 800, DISPLAY), C.ink); txt(ctx, 'Entreprise · Formation', s.x + 22, ay + 116, font(17, 500, UI), C.mute); }); }
  else bar(ctx, s.x + 22, ay + 66, 160, 16, 'rgba(143,163,204,0.18)');
  [0, 1, 2].forEach((i) => bar(ctx, s.x + 22, ay + 146 + i * 22, (s.w - 60) * [0.95, 0.85, 0.6][i] * io(lt, t.desc + i * 0.12, 0.35), 10));
  // contact rows
  [0, 1].forEach((i) => {
    const k = io(lt, t.contact + i * 0.15, 0.35);
    alpha(ctx, k, () => { ctx.beginPath(); ctx.arc(s.x + 30, ay + 228 + i * 30, 8, 0, M.TAU); ctx.fillStyle = C.cyan; ctx.fill(); bar(ctx, s.x + 50, ay + 222 + i * 30, [150, 120][i] * k, 10); });
  });
  const kb = sp(lt, t.button, SPRING.bouncy);
  if (kb > 0) {
    ctx.save(); scaleAt(ctx, kb, s.x + s.w / 2, ay + 316);
    rrect(ctx, s.x + 20, ay + 290, s.w - 40, 52, 26); ctx.fillStyle = C.cyan; ctx.fill();
    txt(ctx, 'ENVOYER UN MESSAGE', s.x + s.w / 2, ay + 323, font(17, 800, UI), C.bg0, 'center', 1);
    ctx.restore();
  }
  ctx.restore();
}
function illPage(ctx, lt, S, B) {
  head(ctx, B, 'PAGE PROFESSIONNELLE', icPage);
  const kp = sp(lt, ph(S, 2), SPRING.gentle);
  if (kp > 0) {
    ctx.save(); ctx.translate(0, (1 - kp) * 300); ctx.globalAlpha *= clamp(kp * 1.5);
    const s = phone(ctx, 50, 110, 320, 545);
    pageMock(ctx, s, lt, { name: ph(S, 3) + 0.4, avatar: ph(S, 4) + 0.2, cover: ph(S, 5) + 0.2, desc: ph(S, 6) + 0.3, contact: ph(S, 7) + 0.1, button: ph(S, 8) + 0.6 });
    ctx.restore();
  }
  // "+ créer une page" before the phone arrives
  const kc = sp(lt, ph(S, 1), SPRING.bouncy) * (1 - io(lt, ph(S, 2) + 0.2, 0.3));
  if (kc > 0) { ctx.save(); scaleAt(ctx, kc, 210, 380); ctx.beginPath(); ctx.arc(210, 380, 70, 0, M.TAU); ctx.fillStyle = C.cyan; ctx.fill(); ctx.fillStyle = C.bg0; ctx.fillRect(206 - 26, 374, 60, 12); ctx.fillRect(204, 350, 12, 60); ctx.restore(); }
  // checklist
  const ITEMS = [['Nom professionnel', 3], ['Photo de profil', 4], ['Couverture', 5], ['Description', 6], ['Coordonnées', 7], ["Bouton d'action", 8]];
  const outL = io(lt, ph(S, 9), 0.5, E.inCubic);
  if (outL < 1) {
    ctx.save(); ctx.translate(outL * 460, 0); ctx.globalAlpha *= 1 - outL;
    ITEMS.forEach(([lab, pi], i) => {
      const k = io(lt, ph(S, 3) - 0.6 + i * 0.1, 0.4), y = 150 + i * 80;
      alpha(ctx, k, () => {
        panel(ctx, 410, y, 380, 62, 16, C.panel2);
        const done = io(lt, ph(S, pi), 0.3);
        if (done > 0) checkDot(ctx, 445, y + 31, 17, sp(lt, ph(S, pi), SPRING.bouncy), io(lt, ph(S, pi) + 0.1, 0.25));
        else { ctx.beginPath(); ctx.arc(445, y + 31, 15, 0, M.TAU); ctx.strokeStyle = C.dim; ctx.lineWidth = 2; ctx.stroke(); }
        txt(ctx, lab, 478, y + 40, font(24, 600, UI), done > 0 ? C.ink : C.mute);
      });
    });
    ctx.restore();
  }
  // link to Meta Business Suite
  const km = sp(lt, ph(S, 10) + 0.2, SPRING.gentle);
  if (km > 0) {
    ctx.save(); ctx.translate((1 - km) * 300, 0); ctx.globalAlpha *= clamp(km * 1.5);
    arrow(ctx, 385, 380, 440, 380, io(lt, ph(S, 10), 0.4));
    panel(ctx, 455, 150, 345, 470, 24, C.panel2, C.cyan);
    icCal(ctx, 500, 207, 22);
    txt(ctx, 'META', 536, 200, font(26, 800, DISPLAY), C.ink); txt(ctx, 'BUSINESS SUITE', 536, 226, font(17, 700, UI), C.cyan, 'left', 2);
    const R = [['Publications', 11, icPage], ['Messages', 12, icChat], ['Statistiques', 12, icChart]];
    R.forEach(([lab, pi, icon], i) => {
      const at = ph(S, pi) + (i === 2 ? 0.9 : 0.3), k = sp(lt, at, SPRING.bouncy), y = 280 + i * 100;
      if (k <= 0) return;
      ctx.save(); scaleAt(ctx, k, 627, y + 38);
      panel(ctx, 480, y, 295, 76, 18, C.panel);
      icon(ctx, 525, y + 38, 15); txt(ctx, lab, 560, y + 46, font(24, 700, UI), C.ink);
      ctx.restore();
    });
    ctx.restore();
  }
  // "indispensable" stamp
  const ks = sp(lt, ph(S, 13) + 0.3, SPRING.bouncy);
  if (ks > 0) { ctx.save(); scaleAt(ctx, ks, 630, 50); pill(ctx, 'INDISPENSABLE', 520, 48, 1, { size: 20, filled: true }); ctx.restore(); }
}

// ---------------- Scene 4: ChatGPT prepares the content
const PROMPT_TXT = 'Propose-moi 30 idées de publications Facebook pour mon entreprise, avec un titre accrocheur, un texte éducatif et un appel à l\'action.';
function illChat(ctx, lt, S, B) {
  head(ctx, B, 'ASSISTANT IA · CHATGPT', icChat);
  // 1) four capabilities
  const CAPS = [['Idées de publications', 3, icSpark], ['Textes publicitaires', 4, icPage], ['Scripts vidéo', 5, icPlay], ['Calendrier éditorial', 5, icCal]];
  const out1 = io(lt, ph(S, 6) - 0.2, 0.5, E.inCubic);
  if (out1 < 1) {
    // big assistant mark before the list fills
    const kb = sp(lt, ph(S, 2) - 0.2, SPRING.bouncy);
    CAPS.forEach(([lab, pi, icon], i) => {
      const at = ph(S, pi) + (i === 3 ? 1.6 : i === 2 ? 0.2 : 0.1), k = sp(lt, at, SPRING.bouncy);
      const col = i % 2, row = Math.floor(i / 2), x = 50 + col * 380, y = 250 + row * 190;
      if (k <= 0) return;
      ctx.save(); ctx.globalAlpha *= 1 - out1; scaleAt(ctx, k, x + 175, y + 80); ctx.translate(0, -out1 * 80);
      panel(ctx, x, y, 360, 160, 22, C.panel2);
      icon(ctx, x + 56, y + 58, 22, C.cyan, C.panel2);
      wrapLines(ctx, lab, font(28, 700, UI), 280).forEach((l, j) => txt(ctx, l, x + 30, y + 112 + j * 34, font(28, 700, UI), C.ink));
      ctx.restore();
    });
    if (kb > 0) {
      ctx.save(); ctx.globalAlpha *= 1 - out1; scaleAt(ctx, kb, 420, 170);
      rrect(ctx, 230, 130, 380, 80, 40); ctx.fillStyle = CYA(0.12); ctx.fill(); ctx.strokeStyle = C.cyan; ctx.lineWidth = 2; ctx.stroke();
      icChat(ctx, 285, 168, 20); txt(ctx, 'CHATGPT', 322, 182, font(36, 800, DISPLAY), C.ink, 'left', 1);
      ctx.restore();
    }
  }
  // 2) prompt typed into the input, then sent as a bubble
  if (lt > ph(S, 6) - 0.2) {
    const typeT0 = ph(S, 8), typeT1 = pe(S, 10);
    const n = Math.floor(PROMPT_TXT.length * prog(lt, typeT0, typeT1));
    const sent = io(lt, typeT1 + 0.1, 0.5, E.inOutCubic);
    const f = font(24, 500, UI);
    const lines = wrapLines(ctx, PROMPT_TXT, f, 560);
    const outP = io(lt, ph(S, 13), 0.5, E.inCubic);
    ctx.save(); ctx.globalAlpha *= io(lt, ph(S, 6) - 0.2, 0.4) * (1 - outP * 0.65);
    // input box (bottom) -> bubble (top right)
    const bx = lerp(50, 150, sent), by = lerp(470, 110, sent), bw = lerp(740, 640, sent), bh = lines.length * 34 + 40;
    panel(ctx, bx, by, bw, bh, 22, sent > 0.5 ? CYA(0.14) : C.panel2, sent > 0.5 ? C.cyan : C.line);
    let left = n;
    lines.forEach((l, j) => {
      const s = sent > 0 ? l : l.slice(0, Math.max(0, left)); left -= l.length + 1;
      txt(ctx, s, bx + 28, by + 46 + j * 34, f, C.ink);
      if (sent === 0 && left < 0 && left > -l.length - 2 && Math.floor(lt * 2.5) % 2 === 0) ctx.fillStyle = C.cyan;
    });
    if (sent === 0 && n > 0 && n < PROMPT_TXT.length) { // caret
      let rem = n, li = 0; while (li < lines.length - 1 && rem > lines[li].length) { rem -= lines[li].length + 1; li++; }
      const cxp = bx + 28 + measure(ctx, lines[li].slice(0, rem), f);
      ctx.fillStyle = C.cyan; ctx.fillRect(cxp + 2, by + 22 + li * 34, 3, 30);
    }
    if (n === 0 && sent === 0) txt(ctx, 'Écris ton message…', bx + 28, by + 46, f, C.dim);
    // send button
    alpha(ctx, 1 - sent, () => { ctx.beginPath(); ctx.arc(bx + bw - 40, by + bh - 36, 22, 0, M.TAU); ctx.fillStyle = n >= PROMPT_TXT.length ? C.cyan : C.dim; ctx.fill(); arrow(ctx, bx + bw - 50, by + bh - 36, bx + bw - 30, by + bh - 36, 1, C.bg0, 4); });
    ctx.restore();
  }
  // 3) thirty ideas pour in
  const g0 = ph(S, 11) + 0.1;
  if (lt > g0) {
    const outG = io(lt, ph(S, 13), 0.5, E.inCubic);
    ctx.save(); ctx.translate(0, -outG * 60); ctx.globalAlpha *= 1 - outG * 0.75;
    for (let i = 0; i < 30; i++) {
      const col = i % 6, row = Math.floor(i / 6), x = 60 + col * 122, y = 330 + row * 62;
      const k = sp(lt, g0 + i * 0.05, SPRING.snappy);
      if (k <= 0) continue;
      ctx.save(); scaleAt(ctx, k, x + 52, y + 26);
      panel(ctx, x, y, 106, 54, 12, C.panel2);
      bar(ctx, x + 12, y + 14, 70 * (0.6 + 0.4 * hash01(i, 3)), 8, CYA(0.75)); bar(ctx, x + 12, y + 32, 80 * (0.5 + 0.5 * hash01(i, 9)), 7);
      // a few get an edit pencil ("corriger et adapter")
      const ed = io(lt, ph(S, 12) + 1.2 + (i % 7) * 0.12, 0.3);
      if (i % 7 === 2 && ed > 0) { ctx.fillStyle = C.cyan; ctx.beginPath(); ctx.arc(x + 98, y + 6, 11 * ed, 0, M.TAU); ctx.fill(); }
      ctx.restore();
    }
    const cnt = Math.min(30, Math.floor((lt - g0) / 0.05) + 1);
    txt(ctx, `${cnt} IDÉES`, 780, 312, font(30, 800, DISPLAY), C.cyan, 'right', 1);
    ctx.restore();
  }
  // 4) warning: ChatGPT prepares, a scheduler publishes
  if (lt > ph(S, 13) - 0.2) {
    const k = sp(lt, ph(S, 13), SPRING.gentle);
    ctx.save(); ctx.translate(0, (1 - k) * 200); ctx.globalAlpha *= clamp(k * 1.5);
    panel(ctx, 50, 420, 740, 220, 24, C.panel2, C.cyan);
    // warning triangle
    ctx.beginPath(); ctx.moveTo(110, 455); ctx.lineTo(140, 507); ctx.lineTo(80, 507); ctx.closePath(); ctx.fillStyle = C.cyan; ctx.fill();
    txt(ctx, '!', 110, 502, font(32, 800, DISPLAY), C.bg0, 'center');
    txt(ctx, 'ATTENTION', 160, 495, font(24, 800, UI), C.cyan, 'left', 4);
    // two boxes: CHATGPT prépare -> OUTIL DE PROGRAMMATION publie
    const kb1 = sp(lt, ph(S, 14), SPRING.bouncy), kb2 = sp(lt, ph(S, 16) + 0.3, SPRING.bouncy);
    if (kb1 > 0) { ctx.save(); scaleAt(ctx, kb1, 230, 575); panel(ctx, 80, 540, 300, 74, 18, C.panel); icChat(ctx, 118, 576, 15); txt(ctx, 'ChatGPT prépare', 146, 586, font(24, 700, UI), C.ink); ctx.restore(); }
    arrow(ctx, 395, 577, 450, 577, io(lt, ph(S, 15), 0.4));
    if (kb2 > 0) { ctx.save(); scaleAt(ctx, kb2, 610, 575); panel(ctx, 465, 540, 300, 74, 18, C.cyan, null); icCal(ctx, 503, 578, 15, C.bg0, C.cyan); txt(ctx, 'Un outil publie', 533, 586, font(24, 800, UI), C.bg0); ctx.restore(); }
    ctx.restore();
  }
}

// ---------------- Scene 5: Canva visuals with the brand identity
function poster(ctx, x, y, w, h, k, seed = 1, title = true) {
  if (k <= 0) return;
  ctx.save(); rrect(ctx, x, y, w, h, 12); ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, seed % 2 ? '#0B2A66' : '#0A1D45'); g.addColorStop(1, seed % 3 ? C.blue : '#0E3A8A');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.globalAlpha *= clamp(k);
  ctx.beginPath(); ctx.arc(x + w * (0.6 + 0.2 * hash01(seed, 4)), y + h * 0.38, Math.min(w, h) * 0.3 * k, 0, M.TAU); ctx.fillStyle = C.cyan; ctx.fill();
  ctx.beginPath(); ctx.arc(x + w * 0.25, y + h * 0.3, Math.min(w, h) * 0.12 * k, 0, M.TAU); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
  if (title) { bar(ctx, x + w * 0.1, y + h * 0.66, w * 0.7 * k, Math.max(8, h * 0.06), C.ink); bar(ctx, x + w * 0.1, y + h * 0.77, w * 0.5 * k, Math.max(6, h * 0.04), 'rgba(255,255,255,0.6)'); }
  rrect(ctx, x + w * 0.1, y + h * 0.86, w * 0.36, Math.max(10, h * 0.07), 8); ctx.fillStyle = C.cyan; ctx.fill();
  ctx.restore();
}
function illCanva(ctx, lt, S, B) {
  head(ctx, B, 'STUDIO DESIGN · CANVA', icPalette);
  // tool rail
  for (let i = 0; i < 5; i++) {
    const k = io(lt, ph(S, 3) + i * 0.06, 0.3), y = 120 + i * 76;
    alpha(ctx, k, () => { panel(ctx, 40, y, 60, 60, 14, i === 0 ? CYA(0.18) : C.panel2, i === 0 ? C.cyan : C.line); [icPage, icPalette, icSpark, icPlay, icChart][i](ctx, 70, y + 30, 13, i === 0 ? C.cyan : C.mute, C.panel2); });
  }
  const X0 = 130, Y0 = 110, AW = 670, AH = 520;
  // states: affiche (4), carrousel (5), couverture + pubs (6), modèles + IA (7), identité (9-10), bibliothèque (11)
  const tPoster = ph(S, 4) + 0.3, tCar = ph(S, 5), tCover = ph(S, 6), tTpl = ph(S, 7), tId = ph(S, 9), tLib = ph(S, 11);
  const s1 = 1 - io(lt, tCar - 0.1, 0.5, E.inOutCubic);
  // blank page (before the poster)
  if (lt < tCar + 0.4) {
    const kb = sp(lt, ph(S, 3), SPRING.gentle);
    ctx.save(); ctx.globalAlpha *= clamp(kb) * s1;
    const pw = 300, phh = 420, px = X0 + AW / 2 - pw / 2, py = Y0 + 30;
    rrect(ctx, px, py, pw, phh, 12); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill(); ctx.setLineDash([8, 8]); ctx.strokeStyle = C.dim; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    poster(ctx, px, py, pw, phh, io(lt, tPoster, 1.2, E.outCubic), 1);
    txt(ctx, 'AFFICHE', px + pw / 2, py + phh + 50, font(22, 800, UI), C.mute, 'center', 3);
    ctx.restore();
  }
  // carousel: three panels slide in
  const outC = io(lt, tCover - 0.1, 0.5, E.inCubic);
  if (lt > tCar - 0.2 && outC < 1) {
    ctx.save(); ctx.globalAlpha *= 1 - outC;
    for (let i = 0; i < 3; i++) {
      const k = sp(lt, tCar + i * 0.15, SPRING.snappy), x = X0 + 20 + i * 215, y = Y0 + 70;
      if (k <= 0) continue;
      ctx.save(); ctx.translate((1 - k) * 400, 0); poster(ctx, x, y, 200, 260, 1, i + 2, i !== 1); ctx.restore();
    }
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(X0 + AW / 2 - 24 + i * 24, Y0 + 370, 7, 0, M.TAU); ctx.fillStyle = i === Math.floor(lt * 1.2) % 3 ? C.cyan : C.dim; ctx.fill(); }
    txt(ctx, 'CARROUSEL', X0 + AW / 2, Y0 + 430, font(22, 800, UI), C.mute, 'center', 3);
    ctx.restore();
  }
  // cover + ads
  const outV = io(lt, tTpl - 0.1, 0.5, E.inCubic);
  if (lt > tCover - 0.2 && outV < 1) {
    ctx.save(); ctx.globalAlpha *= 1 - outV;
    const k = sp(lt, tCover, SPRING.gentle);
    ctx.save(); ctx.translate(0, (1 - k) * 200); poster(ctx, X0 + 20, Y0 + 20, 630, 180, 1, 5, true); ctx.restore();
    txt(ctx, 'COUVERTURE', X0 + 20, Y0 + 240, font(20, 800, UI), C.mute, 'left', 3);
    [0, 1].forEach((i) => { const k2 = sp(lt, tCover + 1.4 + i * 0.2, SPRING.bouncy); if (k2 <= 0) return; ctx.save(); scaleAt(ctx, k2, X0 + 120 + i * 230, Y0 + 370); poster(ctx, X0 + 20 + i * 230, Y0 + 270, 200, 200, 1, 7 + i); ctx.restore(); });
    alpha(ctx, io(lt, tCover + 1.6, 0.3), () => txt(ctx, 'PUBLICITÉS', X0 + 480, Y0 + 380, font(20, 800, UI), C.mute, 'left', 3));
    ctx.restore();
  }
  // templates + AI wand
  const outT = io(lt, tId - 0.1, 0.5, E.inCubic);
  if (lt > tTpl - 0.2 && outT < 1) {
    ctx.save(); ctx.globalAlpha *= 1 - outT;
    for (let i = 0; i < 6; i++) {
      const k = sp(lt, tTpl + i * 0.1, SPRING.snappy), col = i % 3, row = Math.floor(i / 3);
      if (k <= 0) continue;
      ctx.save(); scaleAt(ctx, k, X0 + 120 + col * 220, Y0 + 130 + row * 220); poster(ctx, X0 + 30 + col * 220, Y0 + 30 + row * 220, 180, 200, 1, 10 + i, i % 2 === 0); ctx.restore();
    }
    const kw = sp(lt, tTpl + 2.2, SPRING.bouncy);
    if (kw > 0) { ctx.save(); scaleAt(ctx, kw, X0 + AW - 120, Y0 + 40); pill(ctx, 'IA', X0 + AW - 160, Y0 + 40, 1, { size: 26, filled: true }); icSpark(ctx, X0 + AW - 40, Y0 + 20, 18); ctx.restore(); }
    ctx.restore();
  }
  // brand identity: palette + logo applied
  const outI = io(lt, tLib - 0.1, 0.5, E.inCubic);
  if (lt > tId - 0.2 && outI < 1) {
    ctx.save(); ctx.globalAlpha *= 1 - outI;
    txt(ctx, 'IDENTITÉ GRAPHIQUE', X0 + 30, Y0 + 50, font(22, 800, UI), C.cyan, 'left', 4);
    const SW = [['#071426', 'Bleu nuit'], ['#126BFF', 'Bleu électrique'], ['#00D9FF', 'Cyan'], ['#FFFFFF', 'Blanc']];
    SW.forEach(([hex, name], i) => {
      const k = sp(lt, ph(S, 10) + i * 0.12, SPRING.bouncy), x = X0 + 30 + i * 155, y = Y0 + 90;
      if (k <= 0) return;
      ctx.save(); scaleAt(ctx, k, x + 65, y + 60);
      rrect(ctx, x, y, 130, 120, 18); ctx.fillStyle = hex; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
      txt(ctx, hex, x + 4, y + 152, font(18, 700, UI), C.ink); txt(ctx, name, x + 4, y + 178, font(16, 500, UI), C.mute);
      ctx.restore();
    });
    const kl = sp(lt, ph(S, 10) + 0.9, SPRING.bouncy);
    if (kl > 0) {
      ctx.save(); scaleAt(ctx, kl, X0 + 330, Y0 + 400);
      rrect(ctx, X0 + 30, Y0 + 330, 140, 140, 32); ctx.fillStyle = C.cyan; ctx.fill();
      txt(ctx, 'J', X0 + 100, Y0 + 440, font(100, 800, DISPLAY), C.bg0, 'center');
      txt(ctx, 'JUMOTA', X0 + 200, Y0 + 405, font(60, 800, DISPLAY), C.ink, 'left', -1);
      txt(ctx, 'AGENCY', X0 + 204, Y0 + 445, font(24, 700, UI), C.cyan, 'left', 12);
      ctx.restore();
    }
    ctx.restore();
  }
  // library of ready-to-publish visuals
  if (lt > tLib - 0.2) {
    for (let i = 0; i < 12; i++) {
      const k = sp(lt, tLib + i * 0.07, SPRING.snappy), col = i % 4, row = Math.floor(i / 4), x = X0 + 25 + col * 160, y = Y0 + 70 + row * 150;
      if (k <= 0) continue;
      ctx.save(); scaleAt(ctx, k, x + 70, y + 65); poster(ctx, x, y, 140, 130, 1, 20 + i, i % 3 !== 1);
      check(ctx, x + 118, y + 22, 18, io(lt, tLib + 1.4 + i * 0.05, 0.25), C.ink); ctx.restore();
    }
    alpha(ctx, io(lt, tLib, 0.4), () => txt(ctx, `BIBLIOTHÈQUE · ${Math.min(12, Math.floor((lt - tLib) / 0.07) + 1)} VISUELS PRÊTS`, X0 + 25, Y0 + 40, font(22, 800, UI), C.cyan, 'left', 3));
  }
}

// ---------------- Scene 6: the planner – a week filled in advance
const DAYS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
const SLOTS = [[0, 1, '09:00'], [1, 0, '14:00'], [2, 2, '18:30'], [3, 1, '12:00'], [4, 0, '17:00'], [5, 2, '10:00'], [6, 1, '19:00']];
function illPlanner(ctx, lt, S, B) {
  head(ctx, B, 'META BUSINESS SUITE · PLANIFICATEUR', icCal);
  const gx = 40, gy = 120, cw = 108, rowH = 140;
  const kg = io(lt, ph(S, 2) + 0.4, 0.5);
  // grid
  alpha(ctx, kg, () => {
    DAYS.forEach((d, i) => {
      const x = gx + i * cw;
      txt(ctx, d, x + cw / 2 - 4, gy + 28, font(20, 800, UI), i === 1 ? C.cyan : C.mute, 'center', 2);
      for (let r = 0; r < 3; r++) { rrect(ctx, x + 4, gy + 48 + r * rowH, cw - 16, rowH - 14, 14); ctx.fillStyle = 'rgba(143,163,204,0.06)'; ctx.fill(); }
    });
  });
  // the composer (select date+time, add text/media, schedule) – floats over the grid then flies into Tuesday
  const tSel = ph(S, 4), tAdd = ph(S, 5), tProg = ph(S, 7);
  const fly = io(lt, tProg + 0.6, 0.7, E.inOutCubic);
  const kc = sp(lt, tSel - 0.1, SPRING.gentle);
  const slotRect = (d, r) => ({ x: gx + d * cw + 4, y: gy + 48 + r * rowH, w: cw - 16, h: rowH - 14 });
  if (kc > 0 && fly < 1) {
    const T = slotRect(1, 0), cx0 = 170, cy0 = 170, cw0 = 500, ch0 = 420;
    const x = lerp(cx0, T.x, fly), y = lerp(cy0, T.y, fly), w = lerp(cw0, T.w, fly), h = lerp(ch0, T.h, fly);
    ctx.save(); ctx.globalAlpha *= clamp(kc * 1.5); scaleAt(ctx, lerp(0.85, 1, kc), x + w / 2, y + h / 2);
    panel(ctx, x, y, w, h, 22, C.panel2, C.cyan);
    if (fly < 0.2) {
      ctx.save(); ctx.globalAlpha *= 1 - fly * 5;
      txt(ctx, 'NOUVELLE PUBLICATION', x + 30, y + 52, font(20, 800, UI), C.cyan, 'left', 3);
      // date + time chips
      const kd = sp(lt, tSel + 0.4, SPRING.bouncy), kt = sp(lt, tSel + 1.4, SPRING.bouncy);
      if (kd > 0) { ctx.save(); scaleAt(ctx, kd, x + 110, y + 100); panel(ctx, x + 30, y + 76, 170, 50, 14, C.panel); icCal(ctx, x + 58, y + 102, 11); txt(ctx, 'Mardi', x + 82, y + 110, font(22, 700, UI), C.ink); ctx.restore(); }
      if (kt > 0) { ctx.save(); scaleAt(ctx, kt, x + 300, y + 100); panel(ctx, x + 215, y + 76, 170, 50, 14, C.panel); icClock(ctx, x + 243, y + 101, 11, (lt - tSel) * 6); txt(ctx, '14:00', x + 266, y + 110, font(22, 700, UI), C.ink); ctx.restore(); }
      // text lines + media
      [0, 1, 2].forEach((i) => bar(ctx, x + 30, y + 160 + i * 26, (w - 60) * [0.9, 0.75, 0.5][i] * io(lt, tAdd + i * 0.12, 0.35), 11));
      const km = sp(lt, ph(S, 6), SPRING.bouncy);
      if (km > 0) { ctx.save(); scaleAt(ctx, km, x + 140, y + 290); poster(ctx, x + 30, y + 240, 200, 110, 1, 3); ctx.restore(); }
      const kv = sp(lt, ph(S, 6) + 0.5, SPRING.bouncy);
      if (kv > 0) { ctx.save(); scaleAt(ctx, kv, x + 350, y + 295); panel(ctx, x + 250, y + 240, 200, 110, 12, '#0A1838'); icPlay(ctx, x + 350, y + 295, 20); ctx.restore(); }
      // schedule button
      const press = M.bump(lt, tProg + 0.35, 0.18);
      ctx.save(); scaleAt(ctx, 1 - press * 0.08, x + w / 2, y + h - 40);
      rrect(ctx, x + 30, y + h - 66, w - 60, 52, 26); ctx.fillStyle = lt > tProg ? C.cyan : C.dim; ctx.fill();
      txt(ctx, 'PROGRAMMER', x + w / 2, y + h - 32, font(22, 800, UI), C.bg0, 'center', 3);
      ctx.restore();
      ctx.restore();
    }
    ctx.restore();
  }
  // filled slots
  SLOTS.forEach(([d, r, time], i) => {
    const at = d === 1 ? tProg + 1.3 : ph(S, 8) + 0.3 + i * 0.28;
    const k = sp(lt, at, SPRING.bouncy);
    if (k <= 0) return;
    const R = slotRect(d, r);
    ctx.save(); scaleAt(ctx, k, R.x + R.w / 2, R.y + R.h / 2);
    rrect(ctx, R.x, R.y, R.w, R.h, 14); ctx.fillStyle = C.panel2; ctx.fill(); ctx.strokeStyle = C.cyan; ctx.lineWidth = 2; ctx.stroke();
    poster(ctx, R.x + 8, R.y + 8, R.w - 16, 58, 1, 30 + i, false);
    txt(ctx, time, R.x + 10, R.y + 96, font(19, 800, UI), C.ink);
    // published tick as the week's playhead passes
    const ok = io(lt, ph(S, 9) + 0.4 + d * 0.25, 0.25);
    if (ok > 0) checkDot(ctx, R.x + R.w - 18, R.y + 88, 12, ok, ok);
    ctx.restore();
  });
  // week playhead ("publiées aux dates prévues")
  const pp = prog(lt, ph(S, 9) + 0.3, ph(S, 9) + 0.3 + 7 * 0.25);
  if (pp > 0 && pp < 1) { const x = gx + pp * 7 * cw; ctx.fillStyle = C.cyan; ctx.fillRect(x, gy + 40, 3, 3 * rowH); }
  // "vérifier régulièrement"
  const kv = sp(lt, ph(S, 11) + 0.4, SPRING.bouncy);
  if (kv > 0) { ctx.save(); scaleAt(ctx, kv, 420, 620); pill(ctx, 'VÉRIFIE CHAQUE SEMAINE', 255, 628, 1, { size: 22, filled: true }); ctx.restore(); }
}

// ---------------- Scene 7: Manychat – a midnight visitor, the 5 setup steps, the scripted conversation
function bubbleMsg(ctx, str, x, y, maxW, mine, k, f = font(20, 500, UI)) {
  if (k <= 0) return 0;
  const lines = wrapLines(ctx, str, f, maxW - 36), w = Math.max(...lines.map((l) => measure(ctx, l, f))) + 36, h = lines.length * 27 + 22;
  const bx = mine ? x + maxW - w : x;
  ctx.save(); scaleAt(ctx, k, mine ? bx + w : bx, y + h); ctx.globalAlpha *= clamp(k * 1.5);
  rrect(ctx, bx, y, w, h, 18); ctx.fillStyle = mine ? C.blue : C.panel2; ctx.fill();
  if (!mine) { ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke(); }
  lines.forEach((l, j) => txt(ctx, l, bx + 18, y + 32 + j * 27, f, C.ink));
  ctx.restore();
  return h;
}
function illBot(ctx, lt, S, B) {
  head(ctx, B, 'MANYCHAT · MESSENGER', icBot);
  // phone with the conversation (always on the left)
  const s = phone(ctx, 40, 105, 330, 555);
  ctx.save(); rrect(ctx, s.x, s.y, s.w, s.h, 16); ctx.clip();
  const on = io(lt, ph(S, 4) + 0.2, 0.4);
  // messages: older ones scroll up as new ones arrive
  const MSG = [
    ['Bonjour ! Quels sont vos services ?', true, ph(S, 2) + 0.6],
    ['Bonjour et bienvenue sur notre page !', false, ph(S, 17)],
    ['Que souhaitez-vous découvrir ?', false, ph(S, 18)],
  ];
  const typing = lt > ph(S, 2) + 1.4 && lt < ph(S, 4) + 0.8;
  const scroll = 150 * io(lt, ph(S, 19) - 0.2, 0.6, E.inOutCubic) + 130 * io(lt, ph(S, 22), 0.6, E.inOutCubic);
  let y = s.y + 130 - scroll;
  MSG.forEach(([m, mine, at]) => { const h = bubbleMsg(ctx, m, s.x + 14, y, s.w - 28, mine, sp(lt, at, SPRING.snappy)); y += h ? h + 12 : 0; });
  if (typing) { // "…" with no reply: nobody is there
    const k = io(lt, ph(S, 2) + 1.4, 0.3);
    alpha(ctx, k * (lt < ph(S, 3) + 1.2 ? 1 : 0.4), () => { rrect(ctx, s.x + 14, y, 86, 44, 18); ctx.fillStyle = C.panel2; ctx.fill(); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(s.x + 36 + i * 20, y + 22 - 4 * Math.max(0, Math.sin(lt * 7 - i)), 5, 0, M.TAU); ctx.fillStyle = C.mute; ctx.fill(); } });
  }
  // quick replies
  const QR = [['Nos services', ph(S, 19)], ['Nos tarifs', ph(S, 20)], ['Nos formations', ph(S, 20) + 0.7]];
  const pick = io(lt, ph(S, 21) + 0.6, 0.25);
  QR.forEach(([lab, at], i) => {
    const k = sp(lt, at, SPRING.bouncy), qy = y + 6 + i * 56;
    if (k <= 0) return;
    const sel = i === 2 ? pick : 0;
    ctx.save(); scaleAt(ctx, k * (1 - 0.08 * M.bump(lt, ph(S, 21) + 0.6, 0.15) * (i === 2)), s.x + s.w / 2, qy + 22);
    rrect(ctx, s.x + 30, qy, s.w - 60, 46, 23); ctx.fillStyle = sel > 0 ? mix(C.panel, C.cyan, sel) : C.panel; ctx.fill(); ctx.strokeStyle = C.cyan; ctx.lineWidth = 2; ctx.stroke();
    txt(ctx, lab, s.x + s.w / 2, qy + 30, font(19, 700, UI), sel > 0.5 ? C.bg0 : C.cyan, 'center');
    ctx.restore();
  });
  // info card answer
  const ki = sp(lt, ph(S, 22) + 0.2, SPRING.snappy);
  if (ki > 0) {
    const iy = y + 6 + 3 * 56 + 6;
    ctx.save(); ctx.translate(0, (1 - ki) * 60); ctx.globalAlpha *= clamp(ki * 1.5);
    panel(ctx, s.x + 14, iy, s.w - 28, 96, 16, C.panel2, C.cyan);
    txt(ctx, 'Nos formations', s.x + 32, iy + 34, font(19, 800, UI), C.cyan);
    txt(ctx, 'IA · Facebook Ads', s.x + 32, iy + 60, font(17, 600, UI), C.ink); txt(ctx, 'Montage vidéo', s.x + 32, iy + 84, font(17, 600, UI), C.ink);
    ctx.restore();
  }
  // status bar (midnight) + contact header: offline -> bot online, drawn over the scrolling thread
  ctx.fillStyle = '#0A1838'; ctx.fillRect(s.x, s.y, s.w, 108);
  txt(ctx, '00:00', s.x + 20, s.y + 28, font(20, 800, UI), C.ink);
  icMoon(ctx, s.x + s.w - 30, s.y + 20, 10, C.cyan, '#0A1838');
  ctx.fillStyle = 'rgba(143,163,204,0.08)'; ctx.fillRect(s.x, s.y + 44, s.w, 64);
  ctx.beginPath(); ctx.arc(s.x + 40, s.y + 76, 22, 0, M.TAU); ctx.fillStyle = on > 0.5 ? C.cyan : C.dim; ctx.fill();
  if (on > 0.5) icBot(ctx, s.x + 40, s.y + 79, 11, C.bg0, C.cyan); else txt(ctx, 'J', s.x + 40, s.y + 85, font(24, 800, DISPLAY), C.bg0, 'center');
  txt(ctx, on > 0.5 ? 'Assistant Jumota' : 'Ta Marque Pro', s.x + 74, s.y + 72, font(19, 800, UI), C.ink);
  txt(ctx, on > 0.5 ? 'En ligne · répond 24 h/24' : 'Hors ligne', s.x + 74, s.y + 96, font(15, 600, UI), on > 0.5 ? C.cyan : C.mute);
  ctx.restore();
  // right side, part 1: "not available" at midnight
  const R0 = 405;
  const out0 = io(lt, ph(S, 6) - 0.3, 0.4, E.inCubic);
  if (out0 < 1) {
    ctx.save(); ctx.globalAlpha *= 1 - out0;
    const kq = sp(lt, ph(S, 3), SPRING.bouncy) * (1 - io(lt, ph(S, 4), 0.3));
    if (kq > 0) { ctx.save(); scaleAt(ctx, kq, 600, 330); icMoon(ctx, 600, 300, 60, C.dim, C.panel); txt(ctx, 'Tu dors…', 600, 430, font(30, 700, UI), C.mute, 'center'); ctx.restore(); }
    const kb = sp(lt, ph(S, 4) + 0.1, SPRING.bouncy);
    if (kb > 0) {
      ctx.save(); scaleAt(ctx, kb, 600, 320);
      ctx.beginPath(); ctx.arc(600, 300, 90, 0, M.TAU); ctx.fillStyle = C.cyan; ctx.fill(); icBot(ctx, 600, 312, 44, C.bg0, C.cyan);
      txt(ctx, 'MANYCHAT', 600, 448, font(40, 800, DISPLAY), C.ink, 'center', 1);
      alpha(ctx, io(lt, ph(S, 5) + 0.5, 0.4), () => txt(ctx, 'Scénarios automatisés', 600, 490, font(22, 600, UI), C.mute, 'center'));
      ctx.restore();
    }
    ctx.restore();
  }
  // part 2: the five setup steps
  const STEPS5 = [['Créer ton compte', 7], ['Connecter ta page', 9], ['Nouveau scénario', 11], ['Message de bienvenue', 13], ['Questions / réponses', 15]];
  const out1 = io(lt, ph(S, 16) - 0.2, 0.4, E.inCubic);
  if (lt > ph(S, 6) - 0.4 && out1 < 1) {
    ctx.save(); ctx.globalAlpha *= 1 - out1; ctx.translate(0, -out1 * 60);
    STEPS5.forEach(([lab, pi], i) => {
      const k = sp(lt, ph(S, pi - 1), SPRING.snappy), y = 120 + i * 102;
      if (k <= 0) return;
      ctx.save(); ctx.translate((1 - k) * 200, 0); ctx.globalAlpha *= clamp(k);
      panel(ctx, R0, y, 395, 84, 18, C.panel2);
      const done = io(lt, pe(S, pi) - 0.2, 0.3);
      ctx.beginPath(); ctx.arc(R0 + 42, y + 42, 22, 0, M.TAU); ctx.fillStyle = done > 0 ? C.cyan : C.panel; ctx.fill(); ctx.strokeStyle = C.cyan; ctx.lineWidth = 2; ctx.stroke();
      if (done > 0) check(ctx, R0 + 42, y + 42, 22, done, C.bg0); else txt(ctx, String(i + 1), R0 + 42, y + 51, font(24, 800, DISPLAY), C.cyan, 'center');
      txt(ctx, lab, R0 + 80, y + 51, font(23, 700, UI), C.ink);
      ctx.restore();
    });
    ctx.restore();
  }
  // part 3: the conversation flow tree, then the lead goes to the team
  if (lt > ph(S, 16) - 0.3) {
    const nx = R0 + 197;
    const node = (x, y, w, lab, k, hi) => {
      if (k <= 0) return;
      ctx.save(); scaleAt(ctx, k, x, y);
      rrect(ctx, x - w / 2, y - 30, w, 60, 18); ctx.fillStyle = hi ? C.cyan : C.panel2; ctx.fill(); ctx.strokeStyle = hi ? C.cyan : C.line; ctx.lineWidth = 2; ctx.stroke();
      txt(ctx, lab, x, y + 7, font(w < 140 ? 16 : 19, 800, UI), hi ? C.bg0 : C.ink, 'center', w < 140 ? 0.5 : 1);
      ctx.restore();
    };
    const link = (x0, y0, x1, y1, k, hi) => { if (k <= 0) return; ctx.save(); ctx.strokeStyle = hi ? C.cyan : C.dim; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.bezierCurveTo(x0, (y0 + y1) / 2, x1, (y0 + y1) / 2, lerp(x0, x1, 1), lerp(y0, y1, k)); ctx.stroke(); ctx.restore(); };
    const sel = io(lt, ph(S, 21) + 0.6, 0.3);
    node(nx, 150, 250, 'BIENVENUE', sp(lt, ph(S, 17), SPRING.bouncy), false);
    const BR = [['SERVICES', R0 + 62, ph(S, 19)], ['TARIFS', R0 + 197, ph(S, 20)], ['FORMATIONS', R0 + 332, ph(S, 20) + 0.7]];
    BR.forEach(([lab, x, at], i) => { link(nx, 180, x, 270, io(lt, at - 0.2, 0.3), i === 2 && sel > 0); node(x, 300, 128, lab, sp(lt, at, SPRING.bouncy), i === 2 && sel > 0.5); });
    link(R0 + 332, 330, R0 + 332, 400, io(lt, ph(S, 22), 0.3), true);
    node(R0 + 280, 430, 230, 'INFOS ENVOYÉES', sp(lt, ph(S, 22) + 0.2, SPRING.bouncy), false);
    // lead capture -> team
    const kL = sp(lt, ph(S, 23) + 0.3, SPRING.gentle);
    if (kL > 0) {
      ctx.save(); ctx.translate(0, (1 - kL) * 120); ctx.globalAlpha *= clamp(kL * 1.5);
      panel(ctx, R0, 500, 395, 140, 20, C.panel2, C.cyan);
      txt(ctx, 'NOUVEAU PROSPECT', R0 + 26, 540, font(19, 800, UI), C.cyan, 'left', 3);
      bar(ctx, R0 + 26, 562, 190 * io(lt, ph(S, 23) + 0.8, 0.4), 11, C.ink); bar(ctx, R0 + 26, 588, 150 * io(lt, ph(S, 23) + 1.0, 0.4), 11);
      const kt = sp(lt, ph(S, 23) + 2.6, SPRING.bouncy);
      if (kt > 0) { ctx.save(); scaleAt(ctx, kt, R0 + 320, 590); ctx.beginPath(); ctx.arc(R0 + 320, 590, 34, 0, M.TAU); ctx.fillStyle = C.cyan; ctx.fill(); icPerson(ctx, R0 + 308, 592, 15, C.bg0); icPerson(ctx, R0 + 332, 592, 15, C.bg0); ctx.restore(); }
      arrow(ctx, R0 + 230, 590, R0 + 278, 590, io(lt, ph(S, 23) + 2.3, 0.3));
      ctx.restore();
    }
  }
}

// ---------------- Scene 8: Make – event -> detection -> action
function illMake(ctx, lt, S, B) {
  head(ctx, B, 'SCÉNARIO MAKE · WORKFLOW', icFlow);
  const Y = 300;
  const MOD = [[130, 'FORMULAIRE', 'ÉVÉNEMENT', 8], [420, 'MAKE', 'DÉTECTION', 9], [710, 'TABLEAU DE SUIVI', 'ACTION', 10]];
  const kMake = sp(lt, ph(S, 3), SPRING.bouncy);
  // satellite apps orbiting Make while it is introduced ("faire communiquer plusieurs applications")
  const orb = io(lt, ph(S, 4), 0.5) * (1 - io(lt, ph(S, 5) + 0.3, 0.5));
  if (orb > 0) {
    [icChat, icPalette, icCal, icBot, icChart, icPage].forEach((ic, i) => {
      const a = i * M.TAU / 6 + lt * 0.4, x = 420 + Math.cos(a) * 190, y = Y + Math.sin(a) * 150;
      ctx.save(); ctx.globalAlpha *= orb; ctx.strokeStyle = CYA(0.35); ctx.lineWidth = 2; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.moveTo(420, Y); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(x, y, 34, 0, M.TAU); ctx.fillStyle = C.panel2; ctx.fill(); ctx.strokeStyle = C.line; ctx.stroke(); ic(ctx, x, y, 15, C.cyan, C.panel2); ctx.restore();
    });
  }
  const side = io(lt, ph(S, 6) - 0.2, 0.5);
  // pipes
  [[0, 1], [1, 2]].forEach(([a, b]) => {
    const k = io(lt, ph(S, 6) + 0.3 + a * 0.4, 0.5);
    if (k <= 0) return;
    ctx.save(); ctx.strokeStyle = CYA(0.4); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(MOD[a][0] + 80, Y); ctx.lineTo(lerp(MOD[a][0] + 80, MOD[b][0] - 80, k), Y); ctx.stroke(); ctx.restore();
  });
  // particles: one per run (example run, then the principle run, then a steady loop)
  const runs = [ph(S, 6) + 1.2, ph(S, 8), ph(S, 11) + 0.5, ph(S, 11) + 2.0, ph(S, 12) + 0.8];
  runs.forEach((r0, j) => {
    const q = prog(lt, r0, r0 + (j === 1 ? pe(S, 10) - ph(S, 8) : 1.6));
    if (q <= 0 || q >= 1) return;
    const x = lerp(MOD[0][0], MOD[2][0], q);
    const g = ctx.createRadialGradient(x, Y, 0, x, Y, 30); g.addColorStop(0, CYA(1)); g.addColorStop(1, CYA(0));
    ctx.fillStyle = g; ctx.fillRect(x - 30, Y - 30, 60, 60);
    ctx.beginPath(); ctx.arc(x, Y, 9, 0, M.TAU); ctx.fillStyle = C.ink; ctx.fill();
  });
  MOD.forEach(([x, lab, role, pi], i) => {
    const k = i === 1 ? kMake : sp(lt, ph(S, 6) - 0.1 + (i === 2 ? 1.6 : 0), SPRING.bouncy) * side;
    if (k <= 0) return;
    const hot = M.bump(lt, ph(S, pi) + 0.2, 0.5) + (i === 2 ? M.bump(lt, ph(S, 6) + 2.6, 0.4) : 0);
    ctx.save(); scaleAt(ctx, k * (1 + 0.08 * hot), x, Y);
    if (i === 1) {
      ctx.beginPath(); ctx.arc(x, Y, 84, 0, M.TAU); ctx.fillStyle = C.cyan; ctx.fill();
      icFlow(ctx, x, Y + 4, 34, C.bg0);
    } else {
      panel(ctx, x - 78, Y - 78, 156, 156, 26, mix(C.panel2, '#14306A', clamp(hot)), hot > 0.3 ? C.cyan : C.line);
      if (i === 0) { [0, 1, 2].forEach((r) => { bar(ctx, x - 50, Y - 44 + r * 34, 100, 18, 'rgba(143,163,204,0.25)'); }); rrect(ctx, x - 50, Y + 46, 60, 18, 9); ctx.fillStyle = C.cyan; ctx.fill(); }
      else { for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { ctx.fillStyle = r === 0 ? CYA(0.6) : 'rgba(143,163,204,0.22)'; ctx.fillRect(x - 54 + c * 38, Y - 50 + r * 28, 34, 22); } }
    }
    txt(ctx, lab, x, Y + 128, font(20, 800, UI), C.ink, 'center', 2);
    // the role label (event / detection / action) arrives with the principle
    const kr = sp(lt, ph(S, pi), SPRING.bouncy);
    if (kr > 0) { const w = pillW(ctx, role, 20); pill(ctx, role, x - w / 2, Y - 128, kr, { size: 20, filled: hot > 0.3 }); }
    ctx.restore();
  });
  // new row in the tracking sheet (example)
  const kn = sp(lt, ph(S, 6) + 2.7, SPRING.bouncy) * (1 - io(lt, ph(S, 7), 0.3));
  if (kn > 0) { ctx.save(); scaleAt(ctx, kn, 710, 200); pill(ctx, '+1 DEMANDE', 640, 200, 1, { size: 18, filled: true }); ctx.restore(); }
  // "workflow" brace
  const kw = io(lt, ph(S, 11), 0.6, E.inOutCubic);
  if (kw > 0) {
    ctx.save(); ctx.strokeStyle = C.cyan; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(60, 470); ctx.lineTo(60, 490); ctx.lineTo(lerp(60, 780, kw), 490); if (kw > 0.98) ctx.lineTo(780, 470); ctx.stroke(); ctx.restore();
    alpha(ctx, kw, () => { txt(ctx, 'WORKFLOW', 420, 535, font(36, 800, DISPLAY), C.ink, 'center', 2); alpha(ctx, io(lt, ph(S, 12), 0.4), () => txt(ctx, 'flux de travail automatisé', 420, 570, font(22, 600, UI), C.mute, 'center')); });
  }
  // caveats
  const CAV = [['Intégrations', 14], ['Autorisations', 15], ['Abonnements', 16]];
  if (lt > ph(S, 13) - 0.2) {
    const kA = sp(lt, ph(S, 13), SPRING.gentle);
    ctx.save(); ctx.translate(0, (1 - kA) * 200); ctx.globalAlpha *= clamp(kA * 1.5);
    panel(ctx, 30, 450, 780, 200, 24, C.panel, C.cyan);
    txt(ctx, 'CHAQUE CONNEXION DÉPEND DES…', 60, 500, font(21, 800, UI), C.cyan, 'left', 3);
    CAV.forEach(([lab, pi], i) => {
      const k = sp(lt, ph(S, pi) + 0.2, SPRING.bouncy), x = 60 + i * 250;
      if (k <= 0) return;
      ctx.save(); scaleAt(ctx, k, x + 110, 575); panel(ctx, x, 535, 225, 80, 18, C.panel2);
      ctx.beginPath(); ctx.arc(x + 38, 575, 17, 0, M.TAU); ctx.fillStyle = C.cyan; ctx.fill(); txt(ctx, 'i', x + 38, 583, font(22, 800, DISPLAY), C.bg0, 'center');
      txt(ctx, lab, x + 66, 583, font(21, 700, UI), C.ink); ctx.restore();
    });
    ctx.restore();
  }
}

// ---------------- Scene 9: statistics
function illStats(ctx, lt, S, B) {
  head(ctx, B, 'STATISTIQUES · META BUSINESS SUITE', icChart);
  const KPI = [['PORTÉE', 12400, '', 3], ['INTERACTIONS', 1850, '', 4], ['VUES', 38200, '', 5], ['AUDIENCE', 18, ' %', 5]];
  KPI.forEach(([lab, val, suf, pi], i) => {
    const at = ph(S, pi) + (i === 3 ? 1.4 : 0.1), k = sp(lt, 0.3 + i * 0.12, SPRING.bouncy), x = 40 + i * 192;
    if (k <= 0) return;
    ctx.save(); scaleAt(ctx, k * (1 + 0.08 * M.bump(lt, at + 0.15, 0.3)), x + 86, 165);
    if (lt < at) { panel(ctx, x, 110, 176, 110, 18, C.panel2); txt(ctx, lab, x + 18, 146, font(16, 800, UI), C.mute, 'left', 2); bar(ctx, x + 18, 172, 90, 14, 'rgba(143,163,204,0.2)'); ctx.restore(); return; }
    panel(ctx, x, 110, 176, 110, 18, C.panel2, i === 3 ? C.cyan : C.line);
    txt(ctx, lab, x + 18, 146, font(16, 800, UI), C.mute, 'left', 2);
    const v = val * E.outCubic(prog(lt, at, at + 1.2));
    txt(ctx, (i === 3 ? '+' : '') + fmtN(v) + suf, x + 18, 196, font(36, 800, DISPLAY), i === 3 ? C.cyan : C.ink, 'left', -0.5);
    ctx.restore();
  });
  // bar chart: 7 posts
  const H0 = [0.45, 0.62, 0.38, 0.95, 0.55, 0.7, 0.5];
  const cx0 = 50, cy0 = 620, ch = 255, bw = 44;
  alpha(ctx, io(lt, 1.0, 0.4), () => {
    txt(ctx, 'PERFORMANCES PAR PUBLICATION', cx0, 285, font(17, 800, UI), C.mute, 'left', 2);
    ctx.fillStyle = C.line; ctx.fillRect(cx0, cy0, 400, 2);
  });
  const top = io(lt, ph(S, 6) + 0.3, 0.4);
  H0.forEach((h, i) => {
    const k = sp(lt, ph(S, 1) + 0.3 + i * 0.1, SPRING.gentle) * lerp(0.25, 1, sp(lt, ph(S, 3) + 0.3 + i * 0.08, SPRING.gentle)), x = cx0 + 10 + i * 56;
    if (k <= 0) return;
    const hh = ch * h * Math.min(1.05, k), best = i === 3;
    ctx.fillStyle = best ? mix('#2A4785', C.cyan, top) : (top > 0 ? mix('#2A4785', '#1A2C55', top) : '#2A4785');
    rrect(ctx, x, cy0 - hh, bw, hh, 8); ctx.fill();
  });
  // magnifier on the best post
  if (top > 0) {
    const x = cx0 + 10 + 3 * 56 + bw / 2, y = cy0 - ch * 0.95 - 40;
    ctx.save(); ctx.globalAlpha *= top; ctx.strokeStyle = C.ink; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(x + 40, y - 10, 30, 0, M.TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 18, y + 12); ctx.lineTo(x + 2, y + 28); ctx.stroke();
    pill(ctx, 'TOP CONTENU', x + 80, y - 10, sp(lt, ph(S, 6) + 0.6, SPRING.bouncy), { size: 18, filled: true });
    ctx.restore();
  }
  // right panel: audience growth line -> frequent questions -> improve loop
  const RX = 480, RY = 270, RW = 320, RH = 360;
  const outLine = io(lt, ph(S, 7) - 0.2, 0.4, E.inCubic);
  if (lt > ph(S, 5) && outLine < 1) {
    ctx.save(); ctx.globalAlpha *= 1 - outLine;
    panel(ctx, RX, RY, RW, RH, 20, C.panel2);
    txt(ctx, 'ÉVOLUTION DE L\'AUDIENCE', RX + 22, RY + 40, font(16, 800, UI), C.mute, 'left', 2);
    const k = io(lt, ph(S, 5) + 0.4, 1.4, E.inOutCubic);
    ctx.save(); ctx.beginPath(); ctx.rect(RX, RY, 22 + (RW - 40) * k, RH); ctx.clip();
    ctx.strokeStyle = C.cyan; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.beginPath();
    for (let i = 0; i <= 20; i++) { const x = RX + 22 + i * (RW - 44) / 20, y = RY + RH - 50 - (i / 20) ** 1.4 * 220 - 18 * Math.sin(i * 1.3) * (1 - i / 25); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.restore();
    ctx.restore();
  }
  const outQ = io(lt, ph(S, 8) + 0.6, 0.4, E.inCubic);
  if (lt > ph(S, 7) - 0.2 && outQ < 1) {
    ctx.save(); ctx.globalAlpha *= 1 - outQ;
    panel(ctx, RX, RY, RW, RH, 20, C.panel2);
    txt(ctx, 'QUESTIONS FRÉQUENTES', RX + 22, RY + 40, font(16, 800, UI), C.mute, 'left', 2);
    [['Vos tarifs ?', 42], ['Vos horaires ?', 27], ['Livraison ?', 19], ['Formations ?', 14]].forEach(([q, n], i) => {
      const k = sp(lt, ph(S, 7) + 0.3 + i * 0.25, SPRING.bouncy), y = RY + 70 + i * 70;
      if (k <= 0) return;
      ctx.save(); scaleAt(ctx, k, RX + RW / 2, y + 26);
      rrect(ctx, RX + 20, y, RW - 40, 54, 16); ctx.fillStyle = C.panel; ctx.fill();
      txt(ctx, q, RX + 40, y + 35, font(21, 600, UI), C.ink); txt(ctx, `×${n}`, RX + RW - 40, y + 35, font(21, 800, UI), C.cyan, 'right');
      ctx.restore();
    });
    ctx.restore();
  }
  if (lt > ph(S, 8) + 0.5) {
    const k = sp(lt, ph(S, 8) + 0.6, SPRING.gentle);
    ctx.save(); ctx.globalAlpha *= clamp(k * 1.5); scaleAt(ctx, lerp(0.8, 1, k), RX + RW / 2, RY + RH / 2);
    panel(ctx, RX, RY, RW, RH, 20, C.panel2, C.cyan);
    // improvement loop: analyse -> améliore -> publie
    const cxl = RX + RW / 2, cyl = RY + 165, r = 92, spin = (lt - ph(S, 8)) * 0.9;
    ctx.strokeStyle = C.cyan; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (let j = 0; j < 3; j++) { const a0 = spin + j * M.TAU / 3; ctx.beginPath(); ctx.arc(cxl, cyl, r, a0 + 0.25, a0 + M.TAU / 3 - 0.25); ctx.stroke(); const ae = a0 + M.TAU / 3 - 0.25; arrow(ctx, cxl + Math.cos(ae - 0.05) * r, cyl + Math.sin(ae - 0.05) * r, cxl + Math.cos(ae) * r, cyl + Math.sin(ae) * r, 1, C.cyan, 6); }
    icChart(ctx, cxl, cyl - 4, 26);
    txt(ctx, 'MESURER · AMÉLIORER', cxl, RY + 315, font(19, 800, UI), C.ink, 'center', 2);
    alpha(ctx, io(lt, ph(S, 10) + 0.5, 0.4), () => txt(ctx, 'ÉVOLUER AVEC TON AUDIENCE', cxl, RY + 342, font(15, 800, UI), C.cyan, 'center', 2));
    ctx.restore();
  }
}

// ------------------------------------------------------------------ scene 1: hook
const NOTIFS = [
  ['Publier aujourd\'hui', 'Rien n\'est prêt…', icPage, 0, 2.2, [370, 300], [70, 380]],
  ['12 nouveaux messages', 'Messenger', icChat, 1, 0.1, [1180, 330], [560, 420]],
  ['34 commentaires', 'À modérer', icChat, 2, 0.1, [330, 560], [90, 760]],
  ['Nouveaux clients ?', 'Prospection', icPerson, 3, 0.2, [1220, 600], [520, 1000]],
  ['Statistiques', 'À analyser', icChart, 3, 1.9, [420, 800], [110, 1180]],
  ['8 messages non lus', 'Il est 23 h…', icChat, 4, 0.1, [1150, 840], [560, 1300]],
];
function notifCard(ctx, x, y, title, sub, icon, k, badge) {
  if (k <= 0) return;
  const w = 400, h = 100;
  ctx.save(); scaleAt(ctx, k, x + w / 2, y + h / 2); ctx.globalAlpha *= clamp(k * 1.3);
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
  panel(ctx, x, y, w, h, 22, '#122656', '#2A4785'); ctx.shadowColor = 'transparent';
  ctx.beginPath(); ctx.arc(x + 52, y + 50, 30, 0, M.TAU); ctx.fillStyle = C.cyan; ctx.fill(); icon(ctx, x + 52, y + 52, 14, C.bg0, C.cyan);
  txt(ctx, title, x + 98, y + 46, font(25, 700, UI), C.ink); txt(ctx, sub, x + 98, y + 76, font(19, 500, UI), C.mute);
  if (badge) { ctx.beginPath(); ctx.arc(x + w - 10, y + 10, 18, 0, M.TAU); ctx.fillStyle = C.blue; ctx.fill(); txt(ctx, badge, x + w - 10, y + 17, font(18, 800, UI), C.ink, 'center'); }
  ctx.restore();
}
function sceneHook(ctx, lt, S) {
  const cx = W / 2, cy = P ? 860 : 560, PS = P ? 1.1 : 1;
  const pw = 340 * PS, phh = 680 * PS;
  const suck = io(lt, ph(S, 5) + 0.2, 0.9, E.inCubic);       // chaos -> into the phone
  const outB = io(lt, ph(S, 8) - 0.25, 0.6, E.inCubic);       // system -> title
  // ---- A + B: phone in the middle
  if (outB < 1) {
    const kp = sp(lt, 0.1, SPRING.gentle);
    ctx.save(); ctx.globalAlpha *= 1 - outB; scaleAt(ctx, lerp(0.85, 1, kp) * (1 + outB * 0.6), cx, cy);
    ctx.translate(0, (1 - kp) * 300);
    const s = phone(ctx, cx - pw / 2, cy - phh / 2, pw, phh);
    const sys = io(lt, ph(S, 5) + 0.9, 0.5);
    // the page (stressed) -> automated dashboard
    alpha(ctx, 1 - sys, () => pageMock(ctx, s, lt, { name: 0.2, avatar: 0.3, cover: 0.2, desc: 0.4, contact: 0.6, button: 0.8 }));
    if (sys > 0) {
      ctx.save(); rrect(ctx, s.x, s.y, s.w, s.h, 18); ctx.clip(); ctx.globalAlpha *= sys;
      ctx.fillStyle = '#0A1838'; ctx.fillRect(s.x, s.y, s.w, s.h);
      txt(ctx, 'AUTOMATISÉ', s.x + 24, s.y + 60, font(26 * PS, 800, DISPLAY), C.cyan, 'left', 2);
      ['Publications', 'Messages', 'Commentaires', 'Prospects', 'Statistiques'].forEach((lab, i) => {
        const y = s.y + 100 + i * 96 * PS, k = sp(lt, ph(S, 5) + 1.1 + i * 0.22, SPRING.bouncy);
        if (k <= 0) return;
        ctx.save(); ctx.translate((1 - k) * 120, 0);
        panel(ctx, s.x + 16, y, s.w - 32, 76 * PS, 16, C.panel2);
        txt(ctx, lab, s.x + 36, y + 47 * PS, font(22 * PS, 700, UI), C.ink);
        checkDot(ctx, s.x + s.w - 52, y + 38 * PS, 17, 1, io(lt, ph(S, 5) + 1.25 + i * 0.22, 0.3));
        ctx.restore();
      });
      ctx.restore();
    }
    // AI badge on top of the phone
    const ka = sp(lt, ph(S, 5) + 0.5, SPRING.bouncy);
    if (ka > 0) {
      ctx.save(); scaleAt(ctx, ka, cx, cy - phh / 2 - 10);
      rrect(ctx, cx - 90, cy - phh / 2 - 50, 180, 80, 40); ctx.fillStyle = C.cyan; ctx.fill();
      icSpark(ctx, cx - 42, cy - phh / 2 - 10, 20, C.bg0); txt(ctx, 'IA', cx + 18, cy - phh / 2 + 6, font(44, 800, DISPLAY), C.bg0, 'center');
      ctx.restore();
    }
    ctx.restore();
  }
  // ---- A: notifications pile up around the phone, shaking once it gets "épuisant"
  if (suck < 1) {
    const stress = io(lt, ph(S, 4), 0.6);
    NOTIFS.forEach(([title, sub, icon, pi, off, pl, pp], i) => {
      const at = ph(S, pi) + off, k = sp(lt, at, SPRING.bouncy);
      if (k <= 0) return;
      const [nx, ny] = P ? pp : pl;
      const jx = stress * 10 * noise1(lt * 9, 11 + i), jy = stress * 8 * noise1(lt * 9, 31 + i);
      const x = lerp(nx, cx - 200, suck) + jx, y = lerp(ny, cy - 50, suck) + jy;
      ctx.save(); scaleAt(ctx, 1 - suck * 0.8, x + 200, y + 50); ctx.globalAlpha *= 1 - suck;
      notifCard(ctx, x, y, title, sub, icon, k, String([1, 12, 34, 5, 3, 8][i]));
      ctx.restore();
    });
    // kicker + "épuisant"
    alpha(ctx, io(lt, 0.2, 0.5) * (1 - io(lt, ph(S, 4) - 0.3, 0.3)), () => {
      if (P) rise(ctx, 'IMAGINE…', cx, 250, 64, 0.3, lt, { align: 'center', color: C.mute });
      else rise(ctx, 'IMAGINE…', 140, 170, 64, 0.3, lt, { color: C.mute });
    });
    if (lt > ph(S, 4) - 0.1) {
      const k = sp(lt, ph(S, 4), SPRING.bouncy);
      ctx.save(); ctx.globalAlpha *= (1 - suck);
      M.shake(ctx, lt, ph(S, 4) + 0.05, 12);
      const size = P ? 120 : 150, y = P ? 280 : 180;
      ctx.save(); scaleAt(ctx, lerp(1.8, 1, k), cx, y - size * 0.35); ctx.globalAlpha *= clamp(k * 2);
      txt(ctx, 'ÉPUISANT !', cx, y, font(fit(ctx, 'ÉPUISANT !', size, W - 160), 800, DISPLAY), C.ink, 'center', -2);
      ctx.restore(); ctx.restore();
    }
  }
  // ---- B: side texts (landscape) / top + bottom (portrait)
  if (lt > ph(S, 5) - 0.2 && outB < 1) {
    ctx.save(); ctx.globalAlpha *= 1 - outB;
    const o1 = ph(S, 6) - 0.2;
    if (P) {
      rise(ctx, "ET SI L'IA", cx, 250, 72, ph(S, 5) + 0.1, lt, { align: 'center', out: o1 });
      rise(ctx, "S'EN OCCUPAIT ?", cx, 336, 72, ph(S, 5) + 0.3, lt, { align: 'center', color: C.cyan, out: o1 });
      rise(ctx, 'UN SYSTÈME QUI', cx, 250, 72, ph(S, 6) + 0.1, lt, { align: 'center' });
      rise(ctx, 'TRAVAILLE POUR TOI', cx, 336, 72, ph(S, 6) + 0.3, lt, { align: 'center', color: C.cyan });
    } else {
      rise(ctx, "ET SI L'IA", 120, 490, 70, ph(S, 5) + 0.1, lt, { out: o1 });
      rise(ctx, "S'EN OCCUPAIT ?", 120, 576, 70, ph(S, 5) + 0.3, lt, { color: C.cyan, out: o1 });
      rise(ctx, 'UN SYSTÈME', 120, 450, 70, ph(S, 6) + 0.1, lt);
      rise(ctx, 'QUI TRAVAILLE', 120, 536, 70, ph(S, 6) + 0.3, lt);
      rise(ctx, 'POUR TOI', 120, 622, 70, ph(S, 6) + 0.5, lt, { color: C.cyan });
    }
    // 24/7 badge with the moon ("même lorsque tu n'es pas connecté")
    const km = sp(lt, ph(S, 7), SPRING.bouncy);
    if (km > 0) {
      const bx = P ? cx : 1580, by = P ? 1400 : 540;
      ctx.save(); scaleAt(ctx, km, bx, by);
      ctx.beginPath(); ctx.arc(bx, by - 70, 70, 0, M.TAU); ctx.fillStyle = C.panel2; ctx.fill(); ctx.strokeStyle = C.cyan; ctx.lineWidth = 3; ctx.stroke();
      icMoon(ctx, bx, by - 70, 34, C.cyan, C.panel2);
      txt(ctx, '24 H / 24', bx, by + 50, font(52, 800, DISPLAY), C.ink, 'center', -1);
      txt(ctx, 'MÊME HORS LIGNE', bx, by + 92, font(24, 700, UI), C.cyan, 'center', 4);
      ctx.restore();
    }
    ctx.restore();
  }
  // ---- C: title
  if (lt > ph(S, 8) - 0.2) {
    alpha(ctx, io(lt, ph(S, 8), 0.4), () => txt(ctx, 'DANS CETTE VIDÉO', cx, P ? 330 : 190, font(30, 700, UI), C.mute, 'center', 8));
    const t9 = ph(S, 9);
    const LINES = P ? [['AUTOMATISE', C.ink], ['TA PAGE', C.ink], ['FACEBOOK', C.ink], ["AVEC L'IA", C.cyan]] : [['AUTOMATISE TA PAGE', C.ink], ["FACEBOOK AVEC L'IA", C.ink]];
    const base = P ? 120 : 112, maxW = P ? 940 : 1500, y0 = P ? 470 : 330, step = P ? 128 : 124;
    const fs = Math.min(...LINES.map(([l]) => fit(ctx, l, base, maxW)));
    LINES.forEach(([l, col], i) => rise(ctx, l, cx, y0 + i * step, fs, t9 + 0.05 + i * 0.25, lt, { align: 'center', color: col }));
    // "DE A À Z" slams when it is said (end of phrase 9)
    const tz = pe(S, 9) - 0.75, kz = sp(lt, tz, SPRING.bouncy);
    if (kz > 0) {
      const zy = P ? 1050 : 620, zs = P ? 170 : 150;
      ctx.save(); scaleAt(ctx, lerp(2.2, 1, kz), cx, zy - zs * 0.35); ctx.globalAlpha *= clamp(kz * 2);
      M.shake(ctx, lt, tz + 0.05, 6);
      txt(ctx, 'DE A À Z', cx, zy, font(zs, 800, DISPLAY), C.cyan, 'center', -3);
      ctx.restore();
    }
    // the five tools
    const tc = ph(S, 10) + 0.2;
    const ws = TOOLS.map((t) => pillW(ctx, t.name, P ? 24 : 26) + 44);
    const rows = P ? [[0, 1], [2], [3, 4]] : [[0, 1, 2, 3, 4]];
    rows.forEach((row, r) => {
      const tw = row.reduce((a, i) => a + ws[i] + 16, -16);
      let x = cx - tw / 2;
      row.forEach((i) => {
        const k = sp(lt, tc + i * 0.22, SPRING.bouncy), y = (P ? 1220 : 790) + r * 80;
        if (k > 0) {
          ctx.save(); scaleAt(ctx, k, x + ws[i] / 2, y);
          rrect(ctx, x, y - 30, ws[i], 60, 30); ctx.fillStyle = CYA(0.1); ctx.fill(); ctx.strokeStyle = C.cyan; ctx.lineWidth = 2; ctx.stroke();
          TOOLS[i].icon(ctx, x + 32, y + 1, 12, C.cyan, C.bg0);
          txt(ctx, TOOLS[i].name, x + 54, y + 9, font(P ? 24 : 26, 700, UI), C.ink, 'left', 1.5);
          ctx.restore();
        }
        x += ws[i] + 16;
      });
    });
  }
}

// ------------------------------------------------------------------ scene 10: conclusion + end card
function sceneEnd(ctx, lt, S, IMG) {
  const cx = W / 2;
  // 1) "Et voilà !"
  const out0 = io(lt, ph(S, 2) - 0.2, 0.4, E.inCubic);
  if (out0 < 1) {
    ctx.save(); ctx.globalAlpha *= 1 - out0; ctx.translate(0, -out0 * 80);
    const k = sp(lt, 0.05, SPRING.bouncy);
    ctx.save(); scaleAt(ctx, lerp(1.6, 1, k), cx, H * 0.4); ctx.globalAlpha *= clamp(k * 2);
    txt(ctx, 'ET VOILÀ !', cx, H * 0.4 + 40, font(P ? 150 : 180, 800, DISPLAY), C.ink, 'center', -3); ctx.restore();
    rise(ctx, 'TU CONNAIS LES ÉTAPES', cx, H * 0.4 + (P ? 150 : 170), P ? 52 : 60, ph(S, 1) + 0.3, lt, { align: 'center', color: C.cyan });
    ctx.restore();
  }
  // 2) recap: the five tools, one per sentence
  const outR = io(lt, ph(S, 8) - 0.1, 0.5, E.inCubic);
  if (lt > ph(S, 2) - 0.3 && outR < 1) {
    ctx.save(); ctx.globalAlpha *= 1 - outR;
    alpha(ctx, io(lt, ph(S, 2), 0.4), () => txt(ctx, 'RÉCAPITULONS', cx, P ? 330 : 165, font(30, 700, UI), C.mute, 'center', 8));
    const rw = P ? 920 : 1240, rh = P ? 150 : 132, gap = P ? 22 : 16, y0 = P ? 400 : 205;
    TOOLS.forEach((t, i) => {
      const at = ph(S, 3 + i), k = sp(lt, at, SPRING.snappy), x = cx - rw / 2, y = y0 + i * (rh + gap) - outR * (300 + i * 40);
      if (k <= 0) return;
      ctx.save(); ctx.translate((1 - k) * (i % 2 ? 300 : -300), 0); ctx.globalAlpha *= clamp(k * 1.4);
      const hot = M.bump(lt, at + 0.3, 0.6);
      panel(ctx, x, y, rw, rh, 24, mix(C.panel, '#123068', hot * 0.6), hot > 0.2 ? C.cyan : C.line);
      ctx.beginPath(); ctx.arc(x + rh / 2 + 6, y + rh / 2, rh * 0.32, 0, M.TAU); ctx.fillStyle = C.cyan; ctx.fill();
      t.icon(ctx, x + rh / 2 + 6, y + rh / 2 + 2, rh * 0.15, C.bg0, C.cyan);
      const nf = fit(ctx, t.name, P ? 44 : 48, P ? 600 : 560);
      txt(ctx, t.name, x + rh + 24, y + (P ? rh * 0.45 : rh * 0.6), font(nf, 800, DISPLAY), C.ink, 'left', -0.5);
      if (P) txt(ctx, t.role, x + rh + 24, y + rh * 0.78, font(28, 600, UI), C.cyan);
      else txt(ctx, t.role, x + rw - 40, y + rh * 0.6, font(32, 600, UI), C.cyan, 'right');
      ctx.restore();
    });
    ctx.restore();
  }
  // 3) the recipe: strategy + quality + follow-up
  const outS = io(lt, ph(S, 11) - 0.2, 0.5, E.inCubic);
  if (lt > ph(S, 8) - 0.3 && outS < 1) {
    ctx.save(); ctx.globalAlpha *= 1 - outS; ctx.translate(0, -outS * 60);
    rise(ctx, 'LES MEILLEURS RÉSULTATS', cx, P ? 420 : 250, P ? 62 : 76, ph(S, 8) + 0.1, lt, { align: 'center' });
    const R = [['STRATÉGIE', ph(S, 9) + 1.0], ['CONTENUS DE QUALITÉ', ph(S, 10) + 0.2], ['SUIVI RÉGULIER', ph(S, 10) + 1.6]];
    R.forEach(([lab, at], i) => {
      const k = sp(lt, at, SPRING.bouncy);
      if (k <= 0) return;
      const bw = P ? 860 : 520, bh = P ? 170 : 230;
      const x = P ? cx - bw / 2 : cx - 810 + i * 560, y = P ? 520 + i * (bh + 70) : 390;
      ctx.save(); scaleAt(ctx, k, x + bw / 2, y + bh / 2);
      panel(ctx, x, y, bw, bh, 28, i === 0 ? C.cyan : C.panel2, i === 0 ? null : C.cyan);
      txt(ctx, String(i + 1).padStart(2, '0'), x + 36, y + (P ? 70 : 80), font(40, 800, DISPLAY), i === 0 ? C.bg0 : C.cyan);
      const lf = fit(ctx, lab, P ? 56 : 48, bw - 72);
      txt(ctx, lab, x + 36, y + bh - (P ? 40 : 50), font(lf, 800, DISPLAY), i === 0 ? C.bg0 : C.ink, 'left', -0.5);
      ctx.restore();
      if (i < 2) { const kp = io(lt, R[i + 1][1] - 0.2, 0.3); if (kp > 0) alpha(ctx, kp, () => txt(ctx, '+', P ? cx : x + bw + 20, P ? y + bh + 56 : y + bh / 2 + 26, font(64, 800, DISPLAY), C.cyan, 'center')); }
    });
    ctx.restore();
  }
  // 4) topics + subscribe
  const outT = io(lt, ph(S, 14) - 0.2, 0.5, E.inCubic);
  if (lt > ph(S, 11) - 0.3 && outT < 1) {
    ctx.save(); ctx.globalAlpha *= 1 - outT; ctx.translate(0, -outT * 60);
    rise(ctx, 'APPRENDS AVEC NOUS', cx, P ? 460 : 300, P ? 70 : 84, ph(S, 11) + 0.1, lt, { align: 'center' });
    const topics = [['INTELLIGENCE ARTIFICIELLE', ph(S, 11) + 1.6], ['MARKETING DIGITAL', ph(S, 12) + 0.2], ['CRÉATION VIDÉO', ph(S, 12) + 1.2]];
    topics.forEach(([lab, at], i) => {
      const sz = P ? 34 : 38, w = pillW(ctx, lab, sz);
      pill(ctx, lab, cx - w / 2, (P ? 620 : 450) + i * (P ? 120 : 110), sp(lt, at, SPRING.bouncy), { size: sz });
    });
    ctx.restore();
  }
  // 5) end card
  if (lt > ph(S, 13) - 0.4) {
    const t13 = ph(S, 13);
    const lk = sp(lt, t13, SPRING.bouncy), ly = P ? 560 : 300, ls = P ? 1.15 : 1;
    const endK = io(lt, ph(S, 14) - 0.2, 0.3);   // the topics clear before the full card settles
    void endK;
    if (IMG.logo) {
      const im = IMG.logo, h = 220 * ls, w = (im.width / im.height) * h;
      ctx.save(); scaleAt(ctx, lk, cx, ly); ctx.globalAlpha *= clamp(lk); ctx.drawImage(im, cx - w / 2, ly - h / 2, w, h); ctx.restore();
    } else {
      ctx.save(); ctx.translate(cx, ly); ctx.scale(lk * ls, lk * ls); ctx.globalAlpha *= clamp(lk);
      rrect(ctx, -330, -70, 140, 140, 32); ctx.fillStyle = C.cyan; ctx.fill();
      txt(ctx, 'J', -260, 46, font(110, 800, DISPLAY), C.bg0, 'center');
      txt(ctx, 'JUMOTA', -160, 18, font(96, 800, DISPLAY), C.ink, 'left', -2);
      txt(ctx, 'AGENCY', -156, 62, font(30, 700, UI), C.cyan, 'left', 14);
      ctx.restore();
    }
    alpha(ctx, io(lt, ph(S, 15), 0.5), () => {
      if (P) { txt(ctx, 'APPRENDRE · CRÉER', cx, ly + 190, font(34, 700, UI), C.mute, 'center', 7); txt(ctx, 'DÉVELOPPER', cx, ly + 240, font(34, 700, UI), C.mute, 'center', 7); }
      else txt(ctx, 'APPRENDRE · CRÉER · DÉVELOPPER', cx, ly + 180, font(32, 700, UI), C.mute, 'center', 8);
    });
    const bk = sp(lt, t13 + 0.5, SPRING.bouncy);
    if (bk > 0) {
      const by = P ? 980 : 620;
      const pulse = 1 + 0.03 * Math.max(0, Math.sin((lt - t13) * 3.2)) * io(lt, t13 + 1.5, 0.5);
      ctx.save(); ctx.translate(cx, by); ctx.scale(bk * pulse, bk * pulse);
      const label = 'ABONNE-TOI À JUMOTA AGENCY', fsz = fit(ctx, label, 42, P ? 800 : 820);
      rrect(ctx, -(P ? 460 : 470), -62, P ? 920 : 940, 124, 62); ctx.fillStyle = C.cyan; ctx.fill();
      txt(ctx, label, 0, 15, font(fsz, 800, DISPLAY), C.bg0, 'center', -0.5);
      ctx.restore();
    }
    const icons = [['YouTube', icPlay], ['Facebook', icF], ['Instagram', icInsta], ['TikTok', icNote]];
    icons.forEach(([lab, fn], i) => {
      const ik = sp(lt, t13 + 0.9 + i * 0.15, SPRING.bouncy);
      if (ik <= 0) return;
      const x = cx + (i - 1.5) * (P ? 230 : 240), y = P ? 1200 : 800;
      ctx.save(); ctx.translate(x, y); ctx.scale(ik, ik);
      ctx.beginPath(); ctx.arc(0, 0, 54, 0, M.TAU); ctx.fillStyle = C.panel2; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
      fn(ctx, 0, 0, 24, C.ink, C.panel2);
      txt(ctx, lab, 0, 100, font(24, 700, UI), C.ink, 'center');
      ctx.restore();
    });
    alpha(ctx, io(lt, ph(S, 16), 0.5), () => txt(ctx, 'À TRÈS BIENTÔT !', cx, P ? 1400 : 960, font(P ? 48 : 40, 800, DISPLAY), C.cyan, 'center', 2));
  }
}

// ------------------------------------------------------------------ captions (burned in, from the SRT)
function captions(ctx, t) {
  const c = TL.captions.find(([a, b]) => t >= a && t < b);
  if (!c) return;
  const [a, b, str] = c;
  const k = io(t, a, 0.12) * (1 - io(t, b - 0.08, 0.08));
  const sz = P ? 40 : 36, lh = sz * 1.28;
  const lines = str.split('\n'), f = font(sz, 600, UI);
  const w = Math.max(...lines.map((l) => measure(ctx, l, f))) + 56, h = lines.length * lh + 26;
  const y = P ? 1585 : H - 46 - h;
  ctx.save(); ctx.globalAlpha *= k;
  rrect(ctx, W / 2 - w / 2, y, w, h, 14); ctx.fillStyle = 'rgba(3,8,22,0.8)'; ctx.fill();
  lines.forEach((l, i) => txt(ctx, l, W / 2, y + 13 + lh * 0.78 + i * lh, f, C.ink, 'center'));
  ctx.restore();
}

// ------------------------------------------------------------------ compositor + transitions
function drawScene(ctx, i, lt, IMG) {
  const S = SC[i];
  if (i === 0) sceneHook(ctx, lt, S);
  else if (i === 9) sceneEnd(ctx, lt, S, IMG);
  else stepScene(ctx, lt, S, STEPS[i - 1]);
}
const PRE = 0.3, POST = 0.4;   // a push straddles the cut so its first frame already shows the new scene
function draw(ctx, t, IMG) {
  let i = SC.findIndex((s) => t < s.end); if (i < 0) i = SC.length - 1;
  bg(ctx, t, i * 140 + 140 * io(t, SC[i].start - PRE, PRE + POST, E.inOutCubic) - 140);
  const T = SC[i].start;
  const inTr = i > 0 && t < T + POST;
  const nearNext = i < SC.length - 1 && t > SC[i].end - PRE;
  let a = null, b = null, p = 0;
  if (inTr) { a = i - 1; b = i; p = prog(t, T - PRE, T + POST); }
  else if (nearNext) { a = i; b = i + 1; p = prog(t, SC[i].end - PRE, SC[i].end + POST); }
  if (a == null) { drawScene(ctx, i, t - T, IMG); return; }
  const q = E.inOutCubic(p);
  const zoomCut = b === 1 || b === 9;
  if (zoomCut) {
    alpha(ctx, 1 - q, () => { ctx.save(); M.zoomAbout(ctx, 1 + 1.6 * q, W / 2, H / 2); drawScene(ctx, a, t - SC[a].start, IMG); ctx.restore(); });
    alpha(ctx, Math.min(1, q * 1.6), () => { ctx.save(); M.zoomAbout(ctx, lerp(0.7, 1, q), W / 2, H / 2); drawScene(ctx, b, t - SC[b].start, IMG); ctx.restore(); });
  } else if (P) {
    ctx.save(); ctx.translate(0, -q * H); drawScene(ctx, a, t - SC[a].start, IMG); ctx.restore();
    ctx.save(); ctx.translate(0, (1 - q) * H); drawScene(ctx, b, t - SC[b].start, IMG); ctx.restore();
  } else {
    ctx.save(); ctx.translate(-q * W, 0); drawScene(ctx, a, t - SC[a].start, IMG); ctx.restore();
    ctx.save(); ctx.translate((1 - q) * W, 0); drawScene(ctx, b, t - SC[b].start, IMG); ctx.restore();
  }
}


// ------------------------------------------------------------------ YouTube thumbnail (?thumb=1, 16x9 only)
const THUMB = new URLSearchParams(location.search).get('thumb') === '1';
function drawThumb(ctx) {
  bg(ctx, 12, 0);
  const g = ctx.createRadialGradient(1440, 520, 0, 1440, 520, 700); g.addColorStop(0, 'rgba(0,217,255,0.28)'); g.addColorStop(1, 'rgba(0,217,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // logo
  rrect(ctx, 90, 70, 84, 84, 20); ctx.fillStyle = C.cyan; ctx.fill(); txt(ctx, 'J', 132, 140, font(66, 800, DISPLAY), C.bg0, 'center');
  txt(ctx, 'JUMOTA', 196, 112, font(48, 800, DISPLAY), C.ink, 'left', -1); txt(ctx, 'AGENCY', 199, 146, font(22, 700, UI), C.cyan, 'left', 10);
  // title
  const L = [['AUTOMATISE', C.ink, 150], ['TA PAGE', C.ink, 150], ['FACEBOOK', C.ink, 150], ["AVEC L'IA", C.cyan, 150]];
  L.forEach(([l, col, sz], i) => txt(ctx, l, 84, 330 + i * 150, font(fit(ctx, l, sz, 960), 800, DISPLAY), col, 'left', -4));
  rrect(ctx, 90, 920, 720, 84, 42); ctx.fillStyle = C.cyan; ctx.fill();
  txt(ctx, 'FORMATION COMPLÈTE DE A À Z', 450, 975, font(fit(ctx, 'FORMATION COMPLÈTE DE A À Z', 38, 640, 800), 800, DISPLAY), C.bg0, 'center');
  // phone with the automated dashboard
  const cx = 1440, cy = 560, pw = 400, phh = 800;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(0.06); ctx.translate(-cx, -cy);
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 30;
  const s = phone(ctx, cx - pw / 2, cy - phh / 2, pw, phh); ctx.shadowColor = 'transparent';
  txt(ctx, 'AUTOMATISÉ', s.x + 26, s.y + 70, font(34, 800, DISPLAY), C.cyan, 'left', 2);
  ['Publications', 'Messages', 'Commentaires', 'Prospects', 'Statistiques'].forEach((lab, i) => {
    const y = s.y + 110 + i * 118; panel(ctx, s.x + 18, y, s.w - 36, 96, 18, C.panel2);
    txt(ctx, lab, s.x + 40, y + 60, font(28, 700, UI), C.ink); checkDot(ctx, s.x + s.w - 62, y + 48, 22, 1, 1);
  });
  rrect(ctx, cx - 110, cy - phh / 2 - 60, 220, 100, 50); ctx.fillStyle = C.cyan; ctx.fill();
  icSpark(ctx, cx - 50, cy - phh / 2 - 10, 26, C.bg0); txt(ctx, 'IA', cx + 22, cy - phh / 2 + 10, font(58, 800, DISPLAY), C.bg0, 'center');
  ctx.restore();
  // tool orbs around the phone
  [[1100, 560], [1150, 860], [1780, 260], [1790, 640], [1700, 960]].forEach(([x, y], i) => {
    ctx.beginPath(); ctx.arc(x, y, 66, 0, M.TAU); ctx.fillStyle = C.panel2; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.cyan; ctx.stroke();
    TOOLS[i].icon(ctx, x, y + 2, 28, C.cyan, C.panel2);
  });
}

// ------------------------------------------------------------------ hits (sound on every accent)
const B2U = (t) => t / 0.5;   // 120 bpm grid
const HITS = [];
const at = (i, pi, off = 0) => SC[i].phrases[Math.min(pi, SC[i].phrases.length - 1)].t0 + off;
SC.forEach((S, i) => {
  if (i > 0) HITS.push([B2U(S.start), `cut ${i + 1}`, 'whoosh', { len: 0.45 }]);
  if (i >= 1 && i <= 8) {
    HITS.push([B2U(S.start + 0.1), `number ${i}`, 'thud']);
    STEPS[i - 1].chips.forEach((c) => HITS.push([B2U(S.start + chipAt(S, c)), `chip ${c[0]}`, 'pop', { pitch: 'A5' }]));
  }
});
// hook
NOTIFS.forEach(([title, , , pi, off], j) => HITS.push([B2U(at(0, pi, off)), `notif ${j}`, 'blip', { pitch: ['E5', 'G5', 'B5', 'D6', 'E6', 'G6'][j] }]));
HITS.push([B2U(at(0, 4)), 'épuisant', 'thud']);
HITS.push([B2U(at(0, 5, 0.2)), 'suck', 'whoosh', { len: 0.9 }]);
HITS.push([B2U(at(0, 5, 0.5)), 'IA badge', 'bell', { pitch: 'A5' }]);
for (let k = 0; k < 5; k++) HITS.push([B2U(at(0, 5, 1.25 + k * 0.22)), `auto ${k}`, 'tick']);
HITS.push([B2U(SC[0].phrases[9].t1 - 0.75), 'de A à Z', 'impact']);
TOOLS.forEach((_, k) => HITS.push([B2U(at(0, 10, 0.2 + k * 0.22)), `tool ${k}`, 'blip', { pitch: ['D5', 'F5', 'A5', 'C6', 'D6'][k] }]));
// step scenes: a few signature accents
[5, 7, 9, 11, 13].forEach((pi, k) => HITS.push([B2U(at(1, pi)), `basics node ${k}`, 'blip', { pitch: ['D5', 'F5', 'A5', 'C6', 'D6'][k] }]));
[3, 4, 5, 6, 7, 8].forEach((pi, k) => HITS.push([B2U(at(2, pi)), `page check ${k}`, 'tick']));
HITS.push([B2U(at(3, 8)), 'typing', 'type', { n: 26, len: SC[3].phrases[10].t1 - SC[3].phrases[8].t0 }]);
HITS.push([B2U(at(3, 11, 0.1)), 'ideas', 'coins']);
HITS.push([B2U(at(4, 10, 0.9)), 'logo', 'bell', { pitch: 'D6' }]);
HITS.push([B2U(at(5, 7, 0.35)), 'programmer', 'click']);
HITS.push([B2U(at(5, 7, 1.3)), 'slot', 'thud']);
[7, 9, 11, 13, 15].forEach((pi, k) => HITS.push([B2U(SC[6].phrases[pi].t1 - 0.2), `bot step ${k}`, 'tick']));
HITS.push([B2U(at(6, 2, 0.6)), 'visitor msg', 'blip', { pitch: 'E6' }]);
HITS.push([B2U(at(6, 17)), 'bot msg', 'blip', { pitch: 'A5' }]);
HITS.push([B2U(at(6, 21, 0.6)), 'reply tap', 'click']);
HITS.push([B2U(at(7, 8)), 'event', 'blip', { pitch: 'D5' }]);
HITS.push([B2U(at(7, 9)), 'detect', 'blip', { pitch: 'F5' }]);
HITS.push([B2U(at(7, 10)), 'action', 'blip', { pitch: 'A5' }]);
HITS.push([B2U(at(8, 6, 0.6)), 'top content', 'bell', { pitch: 'A5' }]);
// end
TOOLS.forEach((_, k) => HITS.push([B2U(at(9, 3 + k)), `recap ${k}`, 'pop', { pitch: 'A5' }]));
HITS.push([B2U(at(9, 13)), 'end card', 'impact']);
HITS.push([B2U(at(9, 13, 0.5)), 'subscribe', 'bell', { pitch: 'D6' }]);

const fs = await fetch('assets/logo.png', { method: 'HEAD' }).then((r) => r.ok).catch(() => false);
M.film({
  fonts: [font(100, 800, DISPLAY), font(40, 500, UI), font(40, 700, UI)],
  images: fs ? { logo: 'assets/logo.png' } : {},
  hits: HITS,
  samples: 4,
  draw(ctx, u, t, IMG) { if (THUMB) { drawThumb(ctx); return; } draw(ctx, t, IMG); captions(ctx, t); },
});
