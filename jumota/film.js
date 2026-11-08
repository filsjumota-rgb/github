// 8 astuces pour monter des vidéos professionnelles avec Claude AI – Jumota Agency.
// Pure function of time: window.seek(t) paints frame t. Scene times and phrase timings come from
// timeline.json (built by tools/timeline.py from the ElevenLabs voice-over); docs/shotlist.md is the plan.
import * as M from './lib/motion.js';

const { W, H, E, prog, lerp, clamp, SPRING, font, rrect, hash01, noise1, mix } = M;

const TL = await fetch('timeline.json').then((r) => r.json());
const SC = TL.scenes;
const DISPLAY = 'Display', UI = 'UI';

// Palette: bleu nuit + one accent (cyan). Violet only lives in the background light.
const C = {
  bg0: '#050915', bg1: '#0A1433', ink: '#F4F7FF', mute: '#8A9BC8', dim: '#4A5B8C',
  panel: '#0C1632', line: '#22346A', cyan: '#2EE6F6', cyanD: '#1AA9C4', violet: '#5B4DFF',
};

// ------------------------------------------------------------------ helpers (all pure)
const sp = (lt, t0, cfg = SPRING.snappy) => M.spring(lt - t0, cfg);
const io = (lt, a, d, ease = E.outCubic) => ease(prog(lt, a, a + d));
const alpha = (ctx, a, fn) => { if (a <= 0.001) return; ctx.save(); ctx.globalAlpha *= clamp(a); fn(); ctx.restore(); };
const ph = (S, i) => S.phrases[i].t0 - S.start;     // local time a phrase starts

function measure(ctx, str, f, track = 0) {
  ctx.font = f; ctx.letterSpacing = `${track}px`;
  const w = ctx.measureText(str).width; ctx.letterSpacing = '0px'; return w;
}
function txt(ctx, str, x, y, f, color, align = 'left', track = 0) {
  ctx.font = f; ctx.fillStyle = color; ctx.textAlign = align; ctx.letterSpacing = `${track}px`;
  ctx.fillText(str, x, y); ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
}
// A line of words rising out of a mask, one after another. parts: [[word, color], ...] or a string.
function rise(ctx, parts, x, y, size, t0, lt, { weight = 800, family = DISPLAY, stagger = 0.07, color = C.ink, track = -0.02, out = null, align = 'left' } = {}) {
  if (typeof parts === 'string') parts = parts.split(' ').map((w) => [w, color]);
  const f = font(size, weight, family), tr = track * size;
  const sw = measure(ctx, ' ', f);
  const ws = parts.map(([w]) => measure(ctx, w, f, tr));
  const total = ws.reduce((a, b) => a + b, 0) + sw * (parts.length - 1);
  let cx = align === 'center' ? x - total / 2 : x;
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
function panel(ctx, x, y, w, h, r = 26, fillc = C.panel) {
  rrect(ctx, x, y, w, h, r); ctx.fillStyle = fillc; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = C.line; ctx.stroke();
}
function pill(ctx, label, x, y, k, { size = 26, filled = false, color = C.cyan } = {}) {
  if (k <= 0.001) return 0;
  const f = font(size, 700, UI), tr = size * 0.06, w = measure(ctx, label, f, tr) + size * 1.4, h = size * 2.05;
  ctx.save(); ctx.translate(x + w / 2, y); ctx.scale(k, k); ctx.translate(-(x + w / 2), -y);
  rrect(ctx, x, y - h / 2, w, h, h / 2);
  if (filled) { ctx.fillStyle = color; ctx.fill(); } else { ctx.fillStyle = 'rgba(46,230,246,0.10)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.stroke(); }
  txt(ctx, label, x + size * 0.7, y + size * 0.36, f, filled ? C.bg0 : color, 'left', tr);
  ctx.restore();
  return w;
}
function arrow(ctx, x0, y, x1, k, color = C.cyan, wdt = 5) {
  if (k <= 0) return;
  const xe = lerp(x0, x1, k);
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = wdt; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(xe - 8, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(xe + 6, y); ctx.lineTo(xe - 14, y - 13); ctx.lineTo(xe - 14, y + 13); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function check(ctx, x, y, s, k, color = C.cyan) {
  if (k <= 0) return;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const pts = [[x - s * 0.35, y], [x - s * 0.1, y + s * 0.25], [x + s * 0.4, y - s * 0.3]];
  const L1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), L2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
  const d = k * (L1 + L2);
  ctx.beginPath(); ctx.moveTo(...pts[0]);
  if (d <= L1) ctx.lineTo(lerp(pts[0][0], pts[1][0], d / L1), lerp(pts[0][1], pts[1][1], d / L1));
  else { ctx.lineTo(...pts[1]); const q = (d - L1) / L2; ctx.lineTo(lerp(pts[1][0], pts[2][0], q), lerp(pts[1][1], pts[2][1], q)); }
  ctx.stroke(); ctx.restore();
}
// Chat bubble mark used for "Claude" (a neutral icon, not the official logo).
function bubble(ctx, x, y, s, color = C.cyan) {
  ctx.save(); ctx.fillStyle = color;
  rrect(ctx, x - s, y - s * 0.75, s * 2, s * 1.4, s * 0.45); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - s * 0.5, y + s * 0.5); ctx.lineTo(x - s * 0.75, y + s * 1.05); ctx.lineTo(x - s * 0.05, y + s * 0.6); ctx.fill();
  ctx.fillStyle = C.bg0;
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(x + i * s * 0.5, y - s * 0.05, s * 0.15, 0, M.TAU); ctx.fill(); }
  ctx.restore();
}

// ------------------------------------------------------------------ background (continuous across scenes)
function bg(ctx, t, px) {
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, C.bg0); g.addColorStop(1, C.bg1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const orb = (x, y, r, col, a) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, col.replace('A', a)); rg.addColorStop(1, col.replace('A', 0));
    ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  orb(W * 0.82 + 120 * noise1(t * 0.05, 2) - px * 0.15, H * 0.2 + 80 * noise1(t * 0.04, 5), 760, 'rgba(91,77,255,A)', 0.22);
  orb(W * 0.15 + 140 * noise1(t * 0.03, 8) - px * 0.1, H * 0.95, 820, 'rgba(46,230,246,A)', 0.10);
  // fine tech grid, drifting slowly, parallax with the scene pushes
  ctx.save(); ctx.strokeStyle = 'rgba(138,155,200,0.06)'; ctx.lineWidth = 1;
  const step = 80, ox = -((t * 6 + px * 0.3) % step), oy = -((t * 3) % step);
  ctx.beginPath();
  for (let x = ox; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = oy; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke(); ctx.restore();
  // vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 1.05);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// ------------------------------------------------------------------ tip layout (scenes 2-9)
const TIPS = [
  { n: '01', title: ['Créer un script', 'professionnel'], chips: [['SCRIPT', 1.6], ['ACCROCHE', 8.2], ['CONCLUSION', 11.0]], ill: illScript },
  { n: '02', title: ['Transformer ton', 'script en storyboard'], chips: [['SCRIPT', 1.8], ['STORYBOARD', 3.2], ['VIDÉO', 14.4]], arrows: true, ill: illStoryboard },
  { n: '03', title: ['Trouver les bonnes', 'animations'], chips: [['ANIMATIONS', 5.8], ['TRANSITIONS', 9.6], ['EFFETS VISUELS', 10.4]], ill: illAnim },
  { n: '04', title: ['Générer des prompts', 'pour les images IA'], chips: [['CLAUDE', 2.0], ['PROMPT', 3.0], ['IMAGE IA', 7.0]], arrows: true, ill: illPrompt },
  { n: '05', title: ['Préparer une voix off', 'professionnelle'], chips: [['VOIX OFF', 1.8], ['INTONATION', 5.6], ['NARRATION', 14.0]], ill: illVoice },
  { n: '06', title: ['Créer des', 'sous-titres'], chips: [['SOUS-TITRES', 2.0], ['FORMAT SRT', 6.0]], ill: illSubs },
  { n: '07', title: ['Créer des animations', 'avec du code'], chips: [['CODE', 2.0], ['ANIMATION', 6.6], ['CRÉATIVITÉ', 14.6]], ill: illCode },
  { n: '08', title: ['Améliorer la qualité', 'de ton montage'], chips: [['ANALYSER', 4.2], ['CORRIGER', 14.6], ['AMÉLIORER', 16.0]], ill: illReview },
];
const LX = 140, CARD = { x: 960, y: 150, w: 840, h: 680 };

function tipScene(ctx, lt, S, tip, idx) {
  // label + progress
  const a0 = io(lt, -0.3, 0.4);
  alpha(ctx, a0, () => {
    ctx.fillStyle = C.cyan; ctx.fillRect(LX, 232, 46 * a0, 4);
    txt(ctx, 'ASTUCE', LX + 62, 244, font(28, 700, UI), C.cyan, 'left', 7);
  });
  // big number: digits spring up one after the other
  const nf = font(290, 800, DISPLAY);
  [...tip.n].forEach((d, i) => {
    const k = sp(lt, -0.2 + i * 0.08, SPRING.bouncy);
    if (k <= 0) return;
    ctx.save(); ctx.beginPath(); ctx.rect(LX - 20, 270, 700, 300); ctx.clip();
    const x = LX + i * 200;
    txt(ctx, d, x, 530 + (1 - k) * 300, nf, i === 0 ? C.dim : C.cyan, 'left', -10);
    ctx.restore();
  });
  // 8-step progress
  for (let i = 0; i < 8; i++) {
    const k = io(lt, 0.0 + i * 0.04, 0.3);
    const x = LX + i * 52, on = i <= idx;
    ctx.fillStyle = i === idx ? C.cyan : on ? 'rgba(46,230,246,0.45)' : 'rgba(138,155,200,0.22)';
    rrect(ctx, x, 584, 42 * k, 8, 4); ctx.fill();
  }
  // title (fit to the column)
  const tf = Math.min(66, ...tip.title.map((l) => Math.floor(66 * 760 / measure(ctx, l, font(66, 800, DISPLAY), -1.3))));
  tip.title.forEach((l, i) => rise(ctx, l, LX, 690 + i * tf * 1.12, tf, 0.1 + i * 0.12, lt));
  // keyword chips (with drawn arrows between them for "A -> B -> C" tips)
  let cx = LX;
  tip.chips.forEach(([label, at], i) => {
    const k = sp(lt, at, SPRING.bouncy);
    if (tip.arrows && i > 0) { arrow(ctx, cx - 4, 850, cx + 34, io(lt, at - 0.25, 0.3), C.cyan, 4); cx += 50; }
    const w = pill(ctx, label, cx, 850, k);
    cx += (w || measure(ctx, label, font(26, 700, UI), 1.5) + 36) + (tip.arrows ? 10 : 16);
  });
  // illustration card
  const kc = sp(lt, -0.15, SPRING.gentle);
  ctx.save(); ctx.translate((1 - kc) * 260, 0); ctx.globalAlpha *= clamp(kc * 1.4);
  panel(ctx, CARD.x, CARD.y, CARD.w, CARD.h, 30);
  ctx.save(); rrect(ctx, CARD.x, CARD.y, CARD.w, CARD.h, 30); ctx.clip();
  tip.ill(ctx, lt, S, CARD);
  ctx.restore(); ctx.restore();
}

// ------------------------------------------------------------------ illustrations (inside CARD)
function head(ctx, B, label) {  // small header strip inside a card
  txt(ctx, label, B.x + 40, B.y + 58, font(22, 700, UI), C.mute, 'left', 3);
  ctx.fillStyle = C.line; ctx.fillRect(B.x + 40, B.y + 80, B.w - 80, 2);
}
function bars(ctx, x, y, w, n, lt, t0, seed, color = 'rgba(138,155,200,0.35)', gap = 30, rate = 0.08) {
  for (let i = 0; i < n; i++) {
    const k = io(lt, t0 + i * rate, 0.35);
    const lw = w * (0.55 + 0.45 * hash01(i, seed)) * k;
    ctx.fillStyle = color; rrect(ctx, x, y + i * gap, lw, 12, 6); ctx.fill();
  }
}

// Tip 1: raw text becomes a structured script
function illScript(ctx, lt, S, B) {
  head(ctx, B, 'SCRIPT_VIDEO.TXT');
  // brief fields: Sujet / Public cible / Durée
  const fields = [['Sujet', ph(S, 2)], ['Public cible', ph(S, 3)], ['Durée : 60 s', ph(S, 3) + 1.3]];
  let fx = B.x + 40;
  fields.forEach(([l, at]) => { const w = pill(ctx, l, fx, B.y + 130, sp(lt, at, SPRING.bouncy), { size: 22 }); fx += (w || 0) + 14; });
  // raw paragraph -> three labelled sections
  const org = io(lt, ph(S, 4) - 0.2, 0.9, E.inOutCubic);
  const secs = [['ACCROCHE', ph(S, 4), 2], ['DÉVELOPPEMENT', ph(S, 5), 4], ['CONCLUSION + APPEL À L\'ACTION', ph(S, 5) + 2.2, 2]];
  let rowY = B.y + 200, line = 0;
  secs.forEach(([lab, at, n], si) => {
    const tagK = sp(lt, at, SPRING.snappy);
    const yTag = rowY + org * 40 * si;
    if (tagK > 0) {
      ctx.save(); ctx.globalAlpha *= clamp(tagK);
      ctx.fillStyle = si === 0 ? C.cyan : si === 2 ? C.cyan : C.mute;
      rrect(ctx, B.x + 40, yTag + 6, 6, n * 30 - 4, 3); ctx.fill();
      txt(ctx, lab, B.x + 62 + (1 - tagK) * 20, yTag + org * 0 + 4, font(20, 700, UI), si === 1 ? C.mute : C.cyan, 'left', 2);
      ctx.restore();
    }
    for (let i = 0; i < n; i++) {
      const k = io(lt, ph(S, 1) + 0.1 + line * 0.12, 0.35);
      const lw = (B.w - 140) * (0.5 + 0.5 * hash01(line, 7)) * k;
      const y = rowY + 22 + i * 30 + org * (40 * si + 10);
      const col = mix('#3A4A7A', si === 1 ? '#5D6E9F' : '#8FEFF8', org * clamp(tagK));
      ctx.fillStyle = col; rrect(ctx, B.x + 62, y, lw, 12, 6); ctx.fill();
      line++;
    }
    rowY += n * 30 + 30;
  });
  // solid base: a check stamp in the header
  const kd = sp(lt, ph(S, 6) + 0.4, SPRING.bouncy);
  if (kd > 0) {
    const cx = B.x + B.w - 66, cy = B.y + 50;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(kd, kd);
    ctx.beginPath(); ctx.arc(0, 0, 24, 0, M.TAU); ctx.fillStyle = C.cyan; ctx.fill();
    ctx.restore(); check(ctx, cx, cy, 26, io(lt, ph(S, 6) + 0.55, 0.35), C.bg0);
    alpha(ctx, io(lt, ph(S, 6) + 0.6, 0.4), () => txt(ctx, 'BASE SOLIDE', cx - 40, cy + 8, font(22, 800, UI), C.cyan, 'right', 3));
  }
}

// Tip 2: the script splits into storyboard panels
function illStoryboard(ctx, lt, S, B) {
  head(ctx, B, 'STORYBOARD · 6 SCÈNES');
  const split = io(lt, ph(S, 2) + 0.2, 1.1, E.inOutCubic);
  const gx = B.x + 40, gy = B.y + 120, pw = (B.w - 80 - 2 * 24) / 3, phh = 240;
  const icons = [drawPlay, drawPerson, drawChart, drawPhone, drawBulb, drawStar];
  for (let i = 0; i < 6; i++) {
    const col = i % 3, row = Math.floor(i / 3);
    const tx = gx + col * (pw + 24), ty = gy + row * (phh + 40);
    // start: stacked as one document in the middle
    const sx = B.x + B.w / 2 - 170, sy = B.y + 150 + i * 70;
    const x = lerp(sx, tx, split), y = lerp(sy, ty, split), w = lerp(340, pw, split), h = lerp(56, phh, split);
    const appear = io(lt, ph(S, 1) + i * 0.08, 0.4);
    if (appear <= 0) continue;
    ctx.save(); ctx.globalAlpha *= appear;
    rrect(ctx, x, y, w, h, 16); ctx.fillStyle = '#0F1D42'; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
    if (split < 0.5) { ctx.fillStyle = 'rgba(138,155,200,0.35)'; rrect(ctx, x + 20, y + 22, w * (0.5 + 0.4 * hash01(i, 3)), 12, 6); ctx.fill(); }
    alpha(ctx, io(lt, ph(S, 2) + 1.2 + i * 0.05, 0.3), () => {
      txt(ctx, `SCÈNE ${i + 1}`, x + 18, y + 36, font(18, 700, UI), C.mute, 'left', 2);
      // image slot
      const ik = sp(lt, ph(S, 4) + i * 0.12, SPRING.bouncy);
      if (ik > 0) { ctx.save(); ctx.translate(x + w / 2, y + 112); ctx.scale(ik, ik); icons[i](ctx, 0, 0, 34); ctx.restore(); }
      // motion lines = animations
      const ak = io(lt, ph(S, 5) + i * 0.08, 0.4);
      if (ak > 0) { ctx.strokeStyle = 'rgba(46,230,246,0.7)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        for (let m = 0; m < 3; m++) { ctx.beginPath(); ctx.moveTo(x + w / 2 - 70 - m * 4, y + 96 + m * 14); ctx.lineTo(x + w / 2 - 70 - m * 4 - 34 * ak, y + 96 + m * 14); ctx.stroke(); } }
      // duration badge
      const dk = sp(lt, ph(S, 6) + 0.6 + i * 0.07, SPRING.bouncy);
      pill(ctx, `0:0${[4, 6, 5, 3, 5, 4][i]}`, x + w - 92, y + h - 32, dk, { size: 18, filled: true });
    });
    ctx.restore();
  }
  // transitions between panels
  for (let i = 0; i < 5; i++) {
    if (i === 2) continue;
    const col = i % 3, row = Math.floor(i / 3);
    const x = gx + col * (pw + 24) + pw - 3, y = gy + row * (phh + 40) + phh / 2;
    const k = io(lt, ph(S, 6) + i * 0.08, 0.3);
    if (k > 0) { ctx.save(); ctx.globalAlpha *= k; ctx.fillStyle = C.cyan; ctx.beginPath(); ctx.arc(x + 15, y, 17, 0, M.TAU); ctx.fill(); arrow(ctx, x + 6, y, x + 26, 1, C.bg0, 3); ctx.restore(); }
  }
}
function drawPlay(ctx, x, y, s) { ctx.fillStyle = C.cyan; rrect(ctx, x - s * 1.3, y - s, s * 2.6, s * 2, s * 0.5); ctx.fill(); ctx.fillStyle = C.bg0; ctx.beginPath(); ctx.moveTo(x - s * 0.35, y - s * 0.5); ctx.lineTo(x + s * 0.55, y); ctx.lineTo(x - s * 0.35, y + s * 0.5); ctx.fill(); }
function drawPerson(ctx, x, y, s) { ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x, y - s * 0.45, s * 0.42, 0, M.TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(x, y + s * 0.65, s * 0.8, s * 0.55, 0, Math.PI, 0); ctx.fill(); }
function drawChart(ctx, x, y, s) { ctx.fillStyle = C.cyan; [0.6, 1.1, 0.8, 1.5].forEach((h, i) => { rrect(ctx, x - s + i * s * 0.55, y + s * 0.8 - h * s, s * 0.38, h * s, 4); ctx.fill(); }); }
function drawPhone(ctx, x, y, s) { ctx.lineWidth = s * 0.14; ctx.strokeStyle = C.ink; rrect(ctx, x - s * 0.55, y - s, s * 1.1, s * 2, s * 0.25); ctx.stroke(); ctx.fillStyle = C.cyan; rrect(ctx, x - s * 0.3, y - s * 0.55, s * 0.6, s * 0.7, 3); ctx.fill(); }
function drawBulb(ctx, x, y, s) { ctx.fillStyle = C.cyan; ctx.beginPath(); ctx.arc(x, y - s * 0.2, s * 0.7, 0, M.TAU); ctx.fill(); ctx.fillStyle = C.ink; rrect(ctx, x - s * 0.32, y + s * 0.5, s * 0.64, s * 0.4, 4); ctx.fill(); }
function drawStar(ctx, x, y, s, col = C.ink) { ctx.fillStyle = col; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.45 : s, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); } ctx.closePath(); ctx.fill(); }

// Tip 3: a mini motion editor (preview + keyframe tracks)
function illAnim(ctx, lt, S, B) {
  head(ctx, B, 'ANIMATIONS · SCÈNE 3');
  const pv = { x: B.x + 40, y: B.y + 110, w: B.w - 80, h: 300 };
  rrect(ctx, pv.x, pv.y, pv.w, pv.h, 18); ctx.fillStyle = '#081129'; ctx.fill();
  ctx.save(); rrect(ctx, pv.x, pv.y, pv.w, pv.h, 18); ctx.clip();
  const zoom = 1 + 0.35 * io(lt, ph(S, 4), 0.8, E.inOutCubic) - 0.35 * io(lt, ph(S, 5), 0.6, E.inOutCubic);
  ctx.save(); M.zoomAbout(ctx, zoom, pv.x + pv.w / 2, pv.y + pv.h / 2);
  // text appearing letter by letter
  const word = 'TITRE ANIMÉ';
  const f = font(64, 800, DISPLAY), tw = measure(ctx, word, f, -1);
  let x = pv.x + pv.w / 2 - tw / 2 - 40;
  [...word].forEach((ch, i) => {
    const k = sp(lt, ph(S, 2) + i * 0.05, SPRING.bouncy);
    const cw = measure(ctx, ch, f, -1);
    if (k > 0) { ctx.save(); ctx.globalAlpha *= clamp(k); txt(ctx, ch, x, pv.y + 180 + (1 - k) * 60, f, i > 5 ? C.cyan : C.ink, 'left', -1); ctx.restore(); }
    x += cw;
  });
  // icon bounce
  const bk = sp(lt, ph(S, 3), SPRING.wobbly);
  if (bk > 0) { const by = pv.y + 150 - Math.abs(M.ring(lt - ph(S, 3), 1.4, 1.6)) * 60; ctx.save(); ctx.translate(x + 60, by); ctx.scale(bk, bk); drawStar(ctx, 0, 0, 40, C.cyan); ctx.restore(); }
  ctx.restore();
  // wipe transition (a cyan slab sweeps across)
  const wp = prog(lt, ph(S, 5), ph(S, 5) + 0.9);
  if (wp > 0 && wp < 1) { const wx = lerp(pv.x - 300, pv.x + pv.w + 40, E.inOutCubic(wp)); ctx.fillStyle = C.cyan; ctx.beginPath(); ctx.moveTo(wx, pv.y); ctx.lineTo(wx + 220, pv.y); ctx.lineTo(wx + 140, pv.y + pv.h); ctx.lineTo(wx - 80, pv.y + pv.h); ctx.fill(); }
  ctx.restore();
  // keyframe tracks
  const rows = [['Texte', ph(S, 2)], ['Icône', ph(S, 3)], ['Zoom', ph(S, 4)], ['Transition', ph(S, 5)]];
  const tx = B.x + 200, tw2 = B.w - 240, t0 = B.y + 450;
  rows.forEach(([lab, at], i) => {
    const y = t0 + i * 50;
    txt(ctx, lab, B.x + 40, y + 8, font(22, 600, UI), C.mute);
    ctx.fillStyle = 'rgba(138,155,200,0.15)'; rrect(ctx, tx, y - 10, tw2, 26, 13); ctx.fill();
    const kx = tx + tw2 * clamp((at - 3) / 10);
    const k1 = sp(lt, at - 0.1, SPRING.bouncy), k2 = sp(lt, at + 0.5, SPRING.bouncy);
    const dia = (dx, k) => { if (k <= 0) return; ctx.save(); ctx.translate(dx, y + 3); ctx.rotate(Math.PI / 4); ctx.scale(k, k); ctx.fillStyle = C.cyan; ctx.fillRect(-9, -9, 18, 18); ctx.restore(); };
    if (k1 > 0) { ctx.fillStyle = 'rgba(46,230,246,0.35)'; ctx.fillRect(kx, y - 1, 70 * clamp(k2), 8); }
    dia(kx, k1); dia(kx + 70, k2);
  });
  // playhead
  const phx = tx + tw2 * clamp((lt - 3) / 10);
  if (lt > 3) { ctx.fillStyle = C.ink; ctx.fillRect(phx - 1.5, t0 - 30, 3, 200); ctx.beginPath(); ctx.moveTo(phx - 9, t0 - 36); ctx.lineTo(phx + 9, t0 - 36); ctx.lineTo(phx, t0 - 24); ctx.fill(); }
}

// Tip 4: prompt -> generated image (mosaic resolves) -> variations
const PROMPT = 'Robot humanoïde futuriste, lumière bleue néon, style 3D, fond bleu nuit';
function robot(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y);
  // antenna
  ctx.strokeStyle = C.mute; ctx.lineWidth = s * 0.05; ctx.beginPath(); ctx.moveTo(0, -s * 0.95); ctx.lineTo(0, -s * 0.7); ctx.stroke();
  ctx.fillStyle = C.cyan; ctx.beginPath(); ctx.arc(0, -s * 1.0, s * 0.09, 0, M.TAU); ctx.fill();
  // head
  const g = ctx.createLinearGradient(0, -s * 0.7, 0, s * 0.35); g.addColorStop(0, '#DCE6FF'); g.addColorStop(1, '#7F8FC4');
  ctx.fillStyle = g; rrect(ctx, -s * 0.7, -s * 0.7, s * 1.4, s * 1.05, s * 0.3); ctx.fill();
  ctx.fillStyle = '#0A1433'; rrect(ctx, -s * 0.55, -s * 0.48, s * 1.1, s * 0.55, s * 0.22); ctx.fill();
  ctx.fillStyle = C.cyan; [-1, 1].forEach((d) => { ctx.beginPath(); ctx.ellipse(d * s * 0.24, -s * 0.21, s * 0.11, s * 0.13, 0, 0, M.TAU); ctx.fill(); });
  ctx.fillStyle = 'rgba(46,230,246,0.8)'; rrect(ctx, -s * 0.18, -s * 0.03, s * 0.36, s * 0.04, 3); ctx.fill();
  // body
  ctx.fillStyle = g; rrect(ctx, -s * 0.85, s * 0.45, s * 1.7, s * 0.9, s * 0.35); ctx.fill();
  ctx.fillStyle = C.cyan; ctx.beginPath(); ctx.arc(0, s * 0.85, s * 0.14, 0, M.TAU); ctx.fill();
  ctx.restore();
}
let mosaicCanvas = null;
function illPrompt(ctx, lt, S, B) {
  head(ctx, B, 'PROMPT IMAGE');
  // prompt box with typing
  const bx = B.x + 40, by = B.y + 110, bw = B.w - 80;
  rrect(ctx, bx, by, bw, 120, 16); ctx.fillStyle = '#081129'; ctx.fill(); ctx.strokeStyle = C.cyan; ctx.lineWidth = 2; ctx.stroke();
  const n = Math.floor(PROMPT.length * prog(lt, ph(S, 1) + 0.2, ph(S, 1) + 3.6));
  const shown = PROMPT.slice(0, n);
  const f = font(26, 500, UI);
  // wrap into two lines
  const words = shown.split(' '); let l1 = '', l2 = '';
  for (const w of words) { if (!l2 && measure(ctx, l1 + w + ' ', f) < bw - 50) l1 += w + ' '; else l2 += w + ' '; }
  txt(ctx, l1, bx + 24, by + 50, f, C.ink); txt(ctx, l2, bx + 24, by + 90, f, C.ink);
  if (n < PROMPT.length && lt > ph(S, 1)) { const cw = measure(ctx, l2 ? l2 : l1, f); if (Math.floor(lt * 3) % 2 === 0 || n > 0) { ctx.fillStyle = C.cyan; ctx.fillRect(bx + 26 + cw, by + (l2 ? 66 : 26), 3, 30); } }
  // arrow down to the image frame
  const ak = io(lt, ph(S, 1) + 3.7, 0.4);
  if (ak > 0) { ctx.save(); ctx.translate(B.x + B.w / 2, by + 135); ctx.rotate(Math.PI / 2); arrow(ctx, 0, 0, 50, ak, C.cyan, 4); ctx.restore(); }
  // image frame: the robot resolves from a coarse mosaic to sharp
  const fx = B.x + 40, fy = by + 200, fw = 440, fh = 330;
  const gk = io(lt, ph(S, 2) - 0.3, 0.3);
  if (gk > 0) {
    ctx.save(); ctx.globalAlpha *= gk;
    rrect(ctx, fx, fy, fw, fh, 18); ctx.fillStyle = '#0B1A44'; ctx.fill();
    ctx.save(); rrect(ctx, fx, fy, fw, fh, 18); ctx.clip();
    const res = io(lt, ph(S, 2) - 0.2, 2.6, E.inOutCubic);
    if (!mosaicCanvas) { mosaicCanvas = document.createElement('canvas'); mosaicCanvas.width = fw; mosaicCanvas.height = fh; }
    const mc = mosaicCanvas.getContext('2d');
    mc.clearRect(0, 0, fw, fh);
    const rg = mc.createRadialGradient(fw / 2, fh * 0.45, 10, fw / 2, fh / 2, fw * 0.7); rg.addColorStop(0, '#1C3A8A'); rg.addColorStop(1, '#060C22');
    mc.fillStyle = rg; mc.fillRect(0, 0, fw, fh);
    robot(mc, fw / 2, fh * 0.5, 120);
    const cell = Math.max(1, Math.round(lerp(40, 1, res)));
    ctx.imageSmoothingEnabled = cell <= 1;
    if (cell > 1) {
      const sw = Math.ceil(fw / cell), sh = Math.ceil(fh / cell);
      const small = document.createElement('canvas'); small.width = sw; small.height = sh;
      small.getContext('2d').drawImage(mosaicCanvas, 0, 0, sw, sh);
      ctx.drawImage(small, fx, fy, fw, fh);
    } else ctx.drawImage(mosaicCanvas, fx, fy);
    ctx.imageSmoothingEnabled = true;
    // scanning line while generating
    if (res < 1) { const sy = fy + fh * res; ctx.fillStyle = 'rgba(46,230,246,0.8)'; ctx.fillRect(fx, sy, fw, 3); }
    ctx.restore();
    pill(ctx, res < 1 ? `Génération ${Math.round(res * 100)} %` : 'Image IA prête', fx + 16, fy + fh - 34, 1, { size: 18, filled: res >= 1 });
    ctx.restore();
  }
  // variations (other subjects)
  const vars = [['Ordinateur', drawLaptop, ph(S, 3)], ['Entrepreneur', drawPerson, ph(S, 4)], ['Environnement tech', drawCity, ph(S, 4) + 1.4]];
  vars.forEach(([lab, fn, at], i) => {
    const k = sp(lt, at, SPRING.bouncy); if (k <= 0) return;
    const x = B.x + 510, y = fy + i * 112, w = 290, h = 96;
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(k, k); ctx.translate(-(x + w / 2), -(y + h / 2));
    rrect(ctx, x, y, w, h, 14); ctx.fillStyle = '#0F1D42'; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
    fn(ctx, x + 52, y + h / 2, 24);
    txt(ctx, lab, x + 100, y + h / 2 + 8, font(21, 700, UI), C.ink);
    ctx.restore();
  });
}
function drawLaptop(ctx, x, y, s) { ctx.fillStyle = C.ink; rrect(ctx, x - s, y - s * 0.75, s * 2, s * 1.25, 4); ctx.fill(); ctx.fillStyle = C.cyan; rrect(ctx, x - s * 0.82, y - s * 0.6, s * 1.64, s * 0.95, 2); ctx.fill(); ctx.fillStyle = C.mute; rrect(ctx, x - s * 1.3, y + s * 0.55, s * 2.6, s * 0.2, 3); ctx.fill(); }
function drawCity(ctx, x, y, s) { ctx.fillStyle = C.cyan; [[-1.1, 1.2], [-0.5, 1.8], [0.1, 1.0], [0.6, 1.5]].forEach(([dx, h]) => { ctx.fillRect(x + dx * s, y + s * 0.8 - h * s, s * 0.45, h * s); }); }

// Tip 5: the real voice-over waveform + annotated narration
function illVoice(ctx, lt, S, B) {
  head(ctx, B, 'VOIX OFF · NARRATION');
  // waveform of the actual VO around the current time
  const cx = B.x + B.w / 2, wy = B.y + 230, t = S.start + lt;
  const N = 120, span = 4;
  for (let i = 0; i < N; i++) {
    const tt = t - span / 2 + (i / N) * span;
    const e = TL.env[Math.max(0, Math.floor(tt * 30))] || 0;
    const h = 6 + Math.min(1, e * 6) * 110;
    const x = B.x + 40 + i * ((B.w - 80) / N);
    ctx.fillStyle = tt < t ? C.cyan : 'rgba(138,155,200,0.4)';
    rrect(ctx, x, wy - h / 2, (B.w - 80) / N - 2, h, 2); ctx.fill();
  }
  ctx.fillStyle = C.ink; ctx.fillRect(cx - 1.5, wy - 90, 3, 180);
  // annotated narration line(s)
  const tokens = [['Une', 0], ['narration', 2], ['/', 1], ['bien', 0], ['préparée', 2], ['//', 1], ['rend', 0], ['ton', 0], ['contenu', 0], ['plus', 0], ['agréable', 2], ['à', 0], ['écouter.', 0]];
  const f = font(34, 700, UI), fb = font(34, 800, DISPLAY);
  let x = B.x + 40, y = B.y + 420;
  tokens.forEach(([w, kind], i) => {
    const ff = kind === 2 ? fb : f; const ww = measure(ctx, w, ff);
    if (x + ww > B.x + B.w - 40) { x = B.x + 40; y += 64; }
    const k = io(lt, ph(S, 1) + 0.2 + i * 0.07, 0.3);
    const show = kind === 1 ? sp(lt, ph(S, 2) + i * 0.08, SPRING.bouncy) : kind === 2 ? io(lt, ph(S, 3) + 0.8 + i * 0.06, 0.3) : 0;
    if (k > 0) {
      ctx.save(); ctx.globalAlpha *= k;
      if (kind === 1) { if (show > 0) txt(ctx, w, x, y, font(34, 800, DISPLAY), C.cyan); }
      else {
        txt(ctx, w, x, y, ff, kind === 2 ? mix('#F4F7FF', '#2EE6F6', show) : C.ink);
        if (kind === 2 && show > 0) { ctx.fillStyle = C.cyan; ctx.fillRect(x, y + 10, ww * show, 4); }
      }
      ctx.restore();
    }
    x += ww + 16;
  });
  // intonation curve over the line
  const ik = io(lt, ph(S, 3) - 0.1, 1.0);
  if (ik > 0) {
    ctx.save(); ctx.strokeStyle = 'rgba(46,230,246,0.85)'; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = 0; i <= 60 * ik; i++) { const xx = B.x + 40 + i * ((B.w - 80) / 60); const yy = B.y + 360 - 18 * Math.sin(i / 60 * Math.PI * 3) * Math.sin(i / 60 * Math.PI); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
    ctx.stroke(); ctx.restore();
  }
  // two sources: synthèse vocale / ta propre voix
  const opts = [['Synthèse vocale', ph(S, 4) + 0.6], ['Ta propre voix', ph(S, 4) + 2.6]];
  opts.forEach(([lab, at], i) => {
    const k = sp(lt, at, SPRING.bouncy); if (k <= 0) return;
    const x0 = B.x + 40 + i * 390, y0 = B.y + B.h - 130, w = 360, h = 90;
    ctx.save(); ctx.translate(x0 + w / 2, y0 + h / 2); ctx.scale(k, k); ctx.translate(-(x0 + w / 2), -(y0 + h / 2));
    rrect(ctx, x0, y0, w, h, 16); ctx.fillStyle = '#0F1D42'; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
    if (i === 0) { ctx.fillStyle = C.cyan; for (let b = 0; b < 5; b++) { const hh = 14 + 22 * Math.abs(Math.sin(b * 1.7 + lt * 4)); rrect(ctx, x0 + 30 + b * 11, y0 + h / 2 - hh / 2, 6, hh, 3); ctx.fill(); } }
    else drawMic(ctx, x0 + 55, y0 + h / 2, 22);
    txt(ctx, lab, x0 + 100, y0 + h / 2 + 9, font(25, 700, UI), C.ink);
    ctx.restore();
  });
}
function drawMic(ctx, x, y, s) { ctx.fillStyle = C.cyan; rrect(ctx, x - s * 0.45, y - s, s * 0.9, s * 1.35, s * 0.45); ctx.fill(); ctx.strokeStyle = C.cyan; ctx.lineWidth = s * 0.14; ctx.beginPath(); ctx.arc(x, y - s * 0.05, s * 0.75, 0.15, Math.PI - 0.15); ctx.stroke(); ctx.fillRect(x - 2, y + s * 0.7, 4, s * 0.4); }

// Tip 6: an SRT file next to a video frame showing the subtitle in sync
function illSubs(ctx, lt, S, B) {
  head(ctx, B, 'SOUS-TITRES.SRT');
  const lines = [
    ['1', C.cyan], ['00:00:01,000 --> 00:00:03,200', C.mute], ['Tu veux des vidéos pro ?', C.ink], ['', C.ink],
    ['2', C.cyan], ['00:00:03,200 --> 00:00:05,800', C.mute], ['Claude t\'aide à les préparer.', C.ink], ['', C.ink],
    ['3', C.cyan], ['00:00:05,800 --> 00:00:08,000', C.mute], ['Script, storyboard, voix off.', C.ink],
  ];
  const f = font(25, 600, UI);
  lines.forEach(([l, col], i) => {
    const at = ph(S, 2) + i * 0.22;
    const n = Math.floor(l.length * prog(lt, at, at + 0.35));
    if (n > 0) txt(ctx, l.slice(0, n), B.x + 40, B.y + 132 + i * 37, f, col, 'left', 0.4);
  });
  // video frame
  const vx = B.x + 40, vy = B.y + 530, vw = B.w - 80, vh = 120;
  const vk = io(lt, ph(S, 3), 0.5);
  if (vk > 0) {
    ctx.save(); ctx.globalAlpha *= vk; ctx.translate(0, (1 - vk) * 30);
    rrect(ctx, vx, vy, vw, vh, 16); ctx.fillStyle = '#081129'; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
    drawPlay(ctx, vx + 60, vy + 46, 18);
    // timeline + sync blocks
    const tY = vy + vh - 34;
    ctx.fillStyle = 'rgba(138,155,200,0.25)'; rrect(ctx, vx + 20, tY, vw - 40, 10, 5); ctx.fill();
    const play = prog(lt, ph(S, 3) + 0.2, ph(S, 5) + 2.5);
    ctx.fillStyle = C.cyan; rrect(ctx, vx + 20, tY, (vw - 40) * play, 10, 5); ctx.fill();
    const subs = ['Tu veux des vidéos pro ?', 'Claude t\'aide à les préparer.', 'Script, storyboard, voix off.'];
    const si = Math.min(2, Math.floor(play * 3));
    rrect(ctx, vx + vw / 2 - 250, vy + 22, 500, 46, 10); ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fill();
    txt(ctx, subs[si], vx + vw / 2, vy + 54, font(24, 700, UI), C.ink, 'center');
    ctx.restore();
  }
  // sync check
  const ck = sp(lt, ph(S, 4) + 1.5, SPRING.bouncy);
  if (ck > 0) {
    const x = B.x + B.w - 210, y = B.y + 120;
    ctx.save(); ctx.translate(x + 85, y + 26); ctx.scale(ck, ck); ctx.translate(-(x + 85), -(y + 26));
    rrect(ctx, x, y, 170, 52, 26); ctx.fillStyle = C.cyan; ctx.fill();
    txt(ctx, 'Synchro', x + 60, y + 35, font(22, 800, UI), C.bg0);
    ctx.restore(); check(ctx, x + 32, y + 26, 30, io(lt, ph(S, 4) + 1.6, 0.3), C.bg0);
  }
}

// Tip 7: code editor -> counter, chart, dynamic title
const CODE = [
  [['const ', '#8A9BC8'], ['compteur', '#F4F7FF'], [' = ', '#8A9BC8'], ['animer', '#2EE6F6'], ['(0, 1250);', '#F4F7FF']],
  [['const ', '#8A9BC8'], ['graphique', '#F4F7FF'], [' = ', '#8A9BC8'], ['barres', '#2EE6F6'], ['(donnees);', '#F4F7FF']],
  [['titre', '#F4F7FF'], ['.', '#8A9BC8'], ['apparition', '#2EE6F6'], ['(\'rebond\');', '#F4F7FF']],
];
function illCode(ctx, lt, S, B) {
  head(ctx, B, 'ANIMATION.JS');
  const f = font(25, 600, UI);
  let total = 0;
  CODE.forEach((line, li) => {
    const str = line.map((s) => s[0]).join('');
    const at = ph(S, 1) + 0.2 + li * 1.4;
    const n = Math.floor(str.length * prog(lt, at, at + 1.2));
    let x = B.x + 90, used = 0;
    txt(ctx, String(li + 1), B.x + 44, B.y + 140 + li * 46, f, C.dim);
    for (const [s, col] of line) {
      const take = Math.max(0, Math.min(s.length, n - used)); used += s.length;
      if (take > 0) { txt(ctx, s.slice(0, take), x, B.y + 140 + li * 46, f, col); }
      x += measure(ctx, s, f);
    }
    total += n;
  });
  // outputs row
  const oy = B.y + 330;
  // counter
  const ck = sp(lt, ph(S, 2), SPRING.snappy);
  if (ck > 0) {
    ctx.save(); ctx.globalAlpha *= clamp(ck); panel(ctx, B.x + 40, oy, 240, 300, 18, '#0F1D42');
    const v = Math.round(1250 * E.outCubic(prog(lt, ph(S, 2) + 0.2, ph(S, 2) + 2.2)));
    txt(ctx, v.toLocaleString('fr-FR').replace(/ | /g, ' '), B.x + 160, oy + 160, font(58, 800, DISPLAY), C.cyan, 'center', -1);
    txt(ctx, 'abonnés', B.x + 160, oy + 210, font(22, 600, UI), C.mute, 'center');
    ctx.restore();
  }
  // bar chart
  const gk = sp(lt, ph(S, 3), SPRING.snappy);
  if (gk > 0) {
    ctx.save(); ctx.globalAlpha *= clamp(gk); panel(ctx, B.x + 300, oy, 240, 300, 18, '#0F1D42');
    [0.35, 0.55, 0.45, 0.8, 0.95].forEach((h, i) => {
      const k = sp(lt, ph(S, 3) + 0.2 + i * 0.1, SPRING.bouncy);
      const bh = 200 * h * k;
      ctx.fillStyle = i === 4 ? C.cyan : 'rgba(46,230,246,0.45)';
      rrect(ctx, B.x + 330 + i * 38, oy + 260 - bh, 26, bh, 5); ctx.fill();
    });
    ctx.restore();
  }
  // dynamic title
  const tk = sp(lt, ph(S, 4), SPRING.snappy);
  if (tk > 0) {
    ctx.save(); ctx.globalAlpha *= clamp(tk); panel(ctx, B.x + 560, oy, 240, 300, 18, '#0F1D42');
    ['TITRE', 'DYNA-', 'MIQUE'].forEach((w, li) => {
      const k = sp(lt, ph(S, 4) + 0.2 + li * 0.15, SPRING.bouncy);
      if (k > 0) { ctx.save(); ctx.translate(B.x + 680, oy + 110 + li * 56); ctx.scale(k, k); txt(ctx, w, 0, 0, font(42, 800, DISPLAY), li === 1 ? C.cyan : C.ink, 'center', -1); ctx.restore(); }
    });
    ctx.restore();
  }
}

// Tip 8: art-director checklist + score
function illReview(ctx, lt, S, B) {
  head(ctx, B, 'CONTRÔLE QUALITÉ · DIRECTION ARTISTIQUE');
  const items = [['Rythme', ph(S, 3)], ['Cohérence des scènes', ph(S, 4)], ['Couleurs', ph(S, 5)], ['Lisibilité des textes', ph(S, 6)], ['Transitions', ph(S, 6) + 1.0]];
  items.forEach(([lab, at], i) => {
    const y = B.y + 140 + i * 82;
    const k = io(lt, ph(S, 2) + i * 0.15, 0.4);
    if (k <= 0) return;
    ctx.save(); ctx.globalAlpha *= k; ctx.translate((1 - k) * 30, 0);
    rrect(ctx, B.x + 40, y, 470, 64, 14); ctx.fillStyle = '#0F1D42'; ctx.fill();
    const c = sp(lt, at, SPRING.bouncy);
    ctx.beginPath(); ctx.arc(B.x + 80, y + 32, 18, 0, M.TAU);
    if (c > 0) { ctx.fillStyle = C.cyan; ctx.fill(); check(ctx, B.x + 80, y + 32, 22, io(lt, at + 0.05, 0.25), C.bg0); }
    else { ctx.strokeStyle = C.dim; ctx.lineWidth = 3; ctx.stroke(); }
    txt(ctx, lab, B.x + 116, y + 41, font(26, 700, UI), c > 0 ? C.ink : C.mute);
    ctx.restore();
  });
  // score gauge
  const gx = B.x + 670, gy = B.y + 360, r = 110;
  const gk = io(lt, ph(S, 2) + 0.6, 0.5);
  if (gk > 0) {
    ctx.save(); ctx.globalAlpha *= gk;
    ctx.lineCap = 'round'; ctx.lineWidth = 22; ctx.strokeStyle = 'rgba(138,155,200,0.2)';
    ctx.beginPath(); ctx.arc(gx, gy, r, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
    const checks = items.filter(([, at]) => lt > at).length;
    const v = lerp(5.8, 6.4, io(lt, ph(S, 2) + 1, 1)) + 0.6 * checks * io(lt, ph(S, 7), 1.5) + (checks >= 5 ? 0.2 : 0) * io(lt, ph(S, 7) + 1.2, 1);
    const vv = Math.min(9.4, lerp(5.8, v, 1));
    ctx.strokeStyle = C.cyan; ctx.beginPath(); ctx.arc(gx, gy, r, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * (vv / 10)); ctx.stroke();
    txt(ctx, vv.toFixed(1).replace('.', ','), gx, gy + 20, font(64, 800, DISPLAY), C.ink, 'center', -1);
    txt(ctx, 'SCORE / 10', gx, gy + 66, font(18, 700, UI), C.mute, 'center', 2);
    ctx.restore();
  }
  const pk = sp(lt, ph(S, 7) + 2.4, SPRING.bouncy);
  pill(ctx, 'Prêt à publier', B.x + 570, B.y + 560, pk, { size: 24, filled: true });
}

// ------------------------------------------------------------------ scene 1: hook
const CLIPS = (() => {
  const out = []; let id = 0;
  [[0, [210, 330, 260, 300]], [1, [380, 240, 420, 180]], [2, [160, 280, 220, 300, 200]]].forEach(([row, ws]) => {
    let x = 0; ws.forEach((w) => { out.push({ row, x, w, id: id++ }); x += w + 10; });
  });
  return out;
})();
function timeline(ctx, lt, S, x0, y0, sc) {
  const mess = io(lt, ph(S, 1), 0.7, E.inOutCubic) * (1 - io(lt, ph(S, 3) + 0.4, 1.0, E.inOutCubic));
  ctx.save(); ctx.translate(x0, y0); ctx.scale(sc, sc);
  const tw = 1300;
  panel(ctx, -40, -50, tw + 80, 330, 24);
  txt(ctx, 'TIMELINE', -10, -14, font(18, 700, UI), C.mute, 'left', 3);
  CLIPS.forEach((c, i) => {
    const k = sp(lt, -0.4 + i * 0.09, SPRING.snappy);
    if (k <= 0) return;
    const dx = (hash01(i, 4) - 0.5) * 340 * mess, dy = (hash01(i, 9) - 0.5) * 140 * mess, rot = (hash01(i, 13) - 0.5) * 0.5 * mess;
    const x = c.x + (1 - k) * 500 + dx, y = 10 + c.row * 82 + dy;
    const col = c.row === 0 ? C.cyan : c.row === 1 ? '#5B6CFF' : '#3A4C8A';
    ctx.save(); ctx.translate(x + c.w / 2, y + 30); ctx.rotate(rot); ctx.translate(-(x + c.w / 2), -(y + 30));
    rrect(ctx, x, y, c.w, 60, 12); ctx.fillStyle = col; ctx.globalAlpha *= clamp(k) * (c.row === 2 ? 0.9 : 1); ctx.fill();
    ctx.fillStyle = 'rgba(5,9,21,0.35)'; for (let s = 0; s < 3; s++) { rrect(ctx, x + 14 + s * 26, y + 14, 18, 32, 4); ctx.fill(); }
    ctx.restore();
  });
  const phx = (lt * 90) % tw;
  ctx.fillStyle = C.ink; ctx.fillRect(phx, -20, 3, 290);
  ctx.restore();
}
function sceneHook(ctx, lt, S) {
  // timeline: lower half; recedes for the "8 astuces" slam
  const away = io(lt, ph(S, 5), 0.9, E.inOutCubic);
  alpha(ctx, 1 - away, () => timeline(ctx, lt, S, 310, lerp(640, 760, away), lerp(1, 0.85, away)));
  // headlines (top band)
  const y1 = 250, y2 = 360, size = 92;
  if (lt < ph(S, 1) + 0.6) {
    rise(ctx, [['TU VEUX DES', C.ink], ['VIDÉOS', C.cyan]], 160, y1, size, -0.15, lt, { out: ph(S, 1) - 0.05 });
    rise(ctx, 'PROFESSIONNELLES ?', 160, y2, size, 0.25, lt, { out: ph(S, 1) });
  }
  if (lt > ph(S, 1) - 0.2 && lt < ph(S, 2) + 0.6) {
    rise(ctx, 'MAIS TON MONTAGE', 160, y1, size, ph(S, 1) + 0.15, lt, { out: ph(S, 2) - 0.05 });
    rise(ctx, [['EST', C.ink], ['DÉSORGANISÉ ?', C.cyan]], 160, y2, size, ph(S, 1) + 0.35, lt, { out: ph(S, 2) });
  }
  if (lt > ph(S, 2) - 0.2 && lt < ph(S, 5) + 0.6) {
    rise(ctx, [['ET', C.ink], ['SI', C.ink], ['CLAUDE', C.cyan], ['DEVENAIT', C.ink]], 160, y1, 84, ph(S, 2) + 0.1, lt, { out: ph(S, 5) - 0.05 });
    rise(ctx, 'TON ASSISTANT DE PRODUCTION ?', 160, y2, 84, ph(S, 4) + 0.05, lt, { out: ph(S, 5) });
    // Claude badge
    const bk = sp(lt, ph(S, 3), SPRING.bouncy) * (1 - io(lt, ph(S, 5), 0.4));
    if (bk > 0) {
      ctx.save(); ctx.translate(1560, 160); ctx.scale(bk, bk);
      rrect(ctx, -200, -40, 400, 80, 40); ctx.fillStyle = 'rgba(46,230,246,0.12)'; ctx.fill(); ctx.strokeStyle = C.cyan; ctx.lineWidth = 2; ctx.stroke();
      bubble(ctx, -150, -2, 20); txt(ctx, 'Claude', -112, 4, font(30, 800, DISPLAY), C.ink); txt(ctx, 'IA d\'Anthropic', 20, 4, font(20, 600, UI), C.mute);
      ctx.restore();
    }
  }
  // "8 ASTUCES" slam
  if (lt > ph(S, 5) - 0.1) {
    alpha(ctx, io(lt, ph(S, 5), 0.4), () => txt(ctx, 'DANS CETTE VIDÉO', W / 2, 250, font(30, 700, UI), C.mute, 'center', 8));
    const fold = io(lt, ph(S, 6) - 0.25, 0.3, E.inCubic);
    for (let d = 0; d < 8; d++) {
      const kd = sp(lt, ph(S, 5) + 0.35 + d * 0.2, SPRING.bouncy) * (1 - fold);
      if (kd <= 0) continue;
      const x = lerp(W / 2 - 595 + d * 170, W / 2 - 330, fold), y = lerp(540, 520, fold);
      ctx.save(); ctx.translate(x, y); ctx.scale(kd, kd);
      ctx.beginPath(); ctx.arc(0, 0, 62, 0, M.TAU); ctx.fillStyle = d === 7 ? C.cyan : '#0F1D42'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = d === 7 ? C.cyan : C.line; ctx.stroke();
      txt(ctx, String(d + 1).padStart(2, '0'), 0, 16, font(44, 800, DISPLAY), d === 7 ? C.bg0 : C.ink, 'center', -1);
      ctx.restore();
    }
    const k = sp(lt, ph(S, 6), SPRING.bouncy);
    if (k > 0) {
      ctx.save(); ctx.translate(W / 2 - 330, 640); const s = lerp(2.4, 1, k);
      ctx.scale(s, s); ctx.globalAlpha *= clamp(k * 2);
      txt(ctx, '8', 0, 0, font(420, 800, DISPLAY), C.cyan, 'center', -10);
      ctx.restore();
      M.shake(ctx, lt, ph(S, 6) + 0.05, 0);
    }
    rise(ctx, 'ASTUCES', W / 2 - 150, 520, 150, ph(S, 6) + 0.12, lt, { track: -0.03 });
    rise(ctx, [['POUR', C.ink], ['DES', C.ink], ['VIDÉOS', C.ink], ['PROS', C.ink]], W / 2 - 145, 620, 64, ph(S, 6) + 0.35, lt);
    rise(ctx, [['AVEC', C.mute], ['CLAUDE', C.cyan], ['AI', C.cyan]], W / 2 - 145, 700, 64, ph(S, 6) + 0.55, lt);
  }
}

// ------------------------------------------------------------------ scene 10: conclusion + end card
const RECAP = ['Script', 'Storyboard', 'Animations', 'Prompts IA', 'Voix off', 'Sous-titres', 'Code', 'Contrôle qualité'];
let LOGO = null;
function sceneEnd(ctx, lt, S, IMG) {
  // 1) recap grid
  const outG = io(lt, ph(S, 1) - 0.1, 0.5, E.inCubic);
  if (outG < 1) {
    const gx = 160, gy = 330, tw = 380, th = 150;
    RECAP.forEach((lab, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const k = sp(lt, -0.1 + i * 0.24, SPRING.bouncy);
      if (k <= 0) return;
      const x = gx + col * (tw + 20), y = gy + row * (th + 24) - outG * (500 + i * 30);
      ctx.save(); ctx.translate(x + tw / 2, y + th / 2); ctx.scale(k, k); ctx.translate(-(x + tw / 2), -(y + th / 2));
      panel(ctx, x, y, tw, th, 20);
      txt(ctx, String(i + 1).padStart(2, '0'), x + 30, y + 70, font(48, 800, DISPLAY), C.cyan, 'left', -1);
      txt(ctx, lab, x + 30, y + 118, font(30, 700, UI), C.ink);
      check(ctx, x + tw - 50, y + 50, 30, io(lt, 0.1 + i * 0.24, 0.3));
      ctx.restore();
    });
  }
  // 2) the message
  const outQ = io(lt, ph(S, 4) - 0.1, 0.5, E.inCubic);
  if (lt > ph(S, 1) - 0.2 && outQ < 1) {
    ctx.save(); ctx.translate(0, -outQ * 80); ctx.globalAlpha *= 1 - outQ;
    alpha(ctx, io(lt, ph(S, 1), 0.4), () => txt(ctx, 'RAPPELLE-TOI', W / 2, 330, font(30, 700, UI), C.mute, 'center', 8));
    rise(ctx, 'L\'IA NE REMPLACE PAS', W / 2, 470, 96, ph(S, 2), lt, { align: 'center' });
    rise(ctx, 'TA CRÉATIVITÉ.', W / 2, 580, 96, ph(S, 2) + 1.4, lt, { align: 'center' });
    rise(ctx, [['ELLE', C.cyan], ['LA', C.cyan], ['DÉVELOPPE.', C.cyan]], W / 2, 720, 96, ph(S, 3), lt, { align: 'center' });
    ctx.restore();
  }
  // 3) topics
  const outT = io(lt, ph(S, 6) - 0.2, 0.5, E.inCubic);
  if (lt > ph(S, 4) - 0.2 && outT < 1) {
    ctx.save(); ctx.globalAlpha *= 1 - outT; ctx.translate(0, -outT * 60);
    rise(ctx, 'APPRENDS AVEC NOUS', W / 2, 330, 80, ph(S, 4) + 0.1, lt, { align: 'center' });
    const topics = [['INTELLIGENCE ARTIFICIELLE', ph(S, 4) + 1.2], ['MARKETING DIGITAL', ph(S, 5) + 0.2], ['CRÉATION DE CONTENU', ph(S, 5) + 1.6]];
    topics.forEach(([lab, at], i) => {
      const w = measure(ctx, lab, font(36, 700, UI), 2) + 50;
      pill(ctx, lab, W / 2 - w / 2, 480 + i * 110, sp(lt, at, SPRING.bouncy), { size: 36 });
    });
    ctx.restore();
  }
  // 4) end card
  if (lt > ph(S, 6) - 0.4) {
    const k = sp(lt, ph(S, 6) - 0.2, SPRING.gentle);
    const lk = sp(lt, ph(S, 6), SPRING.bouncy);
    if (IMG.logo) {
      const im = IMG.logo, h = 220, w = (im.width / im.height) * h;
      ctx.save(); ctx.translate(W / 2, 300); ctx.scale(lk, lk); ctx.globalAlpha *= clamp(lk);
      ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
    } else {
      ctx.save(); ctx.translate(W / 2, 300); ctx.scale(lk, lk); ctx.globalAlpha *= clamp(lk);
      // wordmark: monogram tile + name
      rrect(ctx, -330, -70, 140, 140, 32); ctx.fillStyle = C.cyan; ctx.fill();
      txt(ctx, 'J', -260, 46, font(110, 800, DISPLAY), C.bg0, 'center');
      txt(ctx, 'JUMOTA', -160, 18, font(96, 800, DISPLAY), C.ink, 'left', -2);
      txt(ctx, 'AGENCY', -156, 62, font(30, 700, UI), C.cyan, 'left', 14);
      ctx.restore();
    }
    alpha(ctx, io(lt, ph(S, 8), 0.5), () => txt(ctx, 'CRÉER · INNOVER · ENTREPRENDRE', W / 2, 480, font(32, 700, UI), C.mute, 'center', 8));
    // subscribe button with a gentle pulse
    const bk = sp(lt, ph(S, 6) + 0.5, SPRING.bouncy);
    if (bk > 0) {
      const pulse = 1 + 0.03 * Math.max(0, Math.sin((lt - ph(S, 6)) * 3.2)) * io(lt, ph(S, 6) + 1.5, 0.5);
      ctx.save(); ctx.translate(W / 2, 620); ctx.scale(bk * pulse, bk * pulse);
      rrect(ctx, -440, -62, 880, 124, 62); ctx.fillStyle = C.cyan; ctx.fill();
      txt(ctx, 'ABONNE-TOI POUR NE RIEN MANQUER', 0, 15, font(42, 800, DISPLAY), C.bg0, 'center', -0.5);
      ctx.restore();
    }
    // social icons (stylised, not the official logos)
    const icons = [['YouTube', iconPlay], ['Facebook', iconF], ['TikTok', iconNote]];
    icons.forEach(([lab, fn], i) => {
      const ik = sp(lt, ph(S, 6) + 0.9 + i * 0.15, SPRING.bouncy);
      if (ik <= 0) return;
      const x = W / 2 + (i - 1) * 260, y = 800;
      ctx.save(); ctx.translate(x, y); ctx.scale(ik, ik);
      ctx.beginPath(); ctx.arc(0, 0, 54, 0, M.TAU); ctx.fillStyle = '#0F1D42'; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
      fn(ctx, 0, 0, 26);
      txt(ctx, lab, 0, 100, font(24, 700, UI), C.ink, 'center');
      ctx.restore();
    });
    void k;
  }
}
function iconPlay(ctx, x, y, s) { ctx.fillStyle = C.ink; rrect(ctx, x - s * 1.1, y - s * 0.75, s * 2.2, s * 1.5, s * 0.45); ctx.fill(); ctx.fillStyle = C.bg0; ctx.beginPath(); ctx.moveTo(x - s * 0.3, y - s * 0.4); ctx.lineTo(x + s * 0.45, y); ctx.lineTo(x - s * 0.3, y + s * 0.4); ctx.fill(); }
function iconF(ctx, x, y, s) { ctx.strokeStyle = C.ink; ctx.lineWidth = s * 0.3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + s * 0.1, y + s); ctx.lineTo(x + s * 0.1, y - s * 0.3); ctx.quadraticCurveTo(x + s * 0.1, y - s * 0.9, x + s * 0.65, y - s * 0.9); ctx.moveTo(x - s * 0.35, y - s * 0.05); ctx.lineTo(x + s * 0.55, y - s * 0.05); ctx.stroke(); }
function iconNote(ctx, x, y, s) { ctx.fillStyle = C.ink; ctx.strokeStyle = C.ink; ctx.lineWidth = s * 0.26; ctx.beginPath(); ctx.arc(x - s * 0.3, y + s * 0.55, s * 0.42, 0, M.TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + s * 0.1, y + s * 0.55); ctx.lineTo(x + s * 0.1, y - s); ctx.quadraticCurveTo(x + s * 0.3, y - s * 0.35, x + s * 0.85, y - s * 0.4); ctx.stroke(); }

// ------------------------------------------------------------------ captions (burned in, from the SRT)
function captions(ctx, t) {
  const c = TL.captions.find(([a, b]) => t >= a && t < b);
  if (!c) return;
  const [a, b, str] = c;
  const k = io(t, a, 0.12) * (1 - io(t, b - 0.08, 0.08));
  const lines = str.split('\n'), f = font(36, 600, UI);
  const w = Math.max(...lines.map((l) => measure(ctx, l, f))) + 56, h = lines.length * 46 + 26;
  const y = H - 46 - h;
  ctx.save(); ctx.globalAlpha *= k;
  rrect(ctx, W / 2 - w / 2, y, w, h, 14); ctx.fillStyle = 'rgba(3,6,18,0.78)'; ctx.fill();
  lines.forEach((l, i) => txt(ctx, l, W / 2, y + 47 + i * 46, f, C.ink, 'center'));
  ctx.restore();
}

// ------------------------------------------------------------------ compositor + transitions
function drawScene(ctx, i, lt, IMG) {
  const S = SC[i];
  if (i === 0) sceneHook(ctx, lt, S);
  else if (i === 9) sceneEnd(ctx, lt, S, IMG);
  else tipScene(ctx, lt, S, TIPS[i - 1], i - 1);
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
    // zoom-through: A pushes past the camera, B arrives from depth
    alpha(ctx, 1 - q, () => { ctx.save(); M.zoomAbout(ctx, 1 + 1.6 * q, W / 2, H / 2); drawScene(ctx, a, t - SC[a].start, IMG); ctx.restore(); });
    alpha(ctx, Math.min(1, q * 1.6), () => { ctx.save(); M.zoomAbout(ctx, lerp(0.7, 1, q), W / 2, H / 2); drawScene(ctx, b, t - SC[b].start, IMG); ctx.restore(); });
  } else {
    ctx.save(); ctx.translate(-q * W, 0); drawScene(ctx, a, t - SC[a].start, IMG); ctx.restore();
    ctx.save(); ctx.translate((1 - q) * W, 0); drawScene(ctx, b, t - SC[b].start, IMG); ctx.restore();
  }
}

// ------------------------------------------------------------------ hits (sound on every accent)
const B2U = (t) => t / 0.5;   // 120 bpm grid, offset ~0
const HITS = [];
SC.forEach((S, i) => {
  if (i > 0) HITS.push([B2U(S.start), `cut ${i + 1}`, 'whoosh', { len: 0.45 }]);
  if (i >= 1 && i <= 8) {
    HITS.push([B2U(S.start + 0.1), `number ${i}`, 'thud']);
    TIPS[i - 1].chips.forEach(([l, at]) => HITS.push([B2U(S.start + at), `chip ${l}`, 'pop', { pitch: 'A5' }]));
  }
});
HITS.push([B2U(SC[0].phrases[6].t0), '8 astuces slam', 'impact']);
for (let d = 0; d < 8; d++) HITS.push([B2U(SC[0].phrases[5].t0 + 0.35 + d * 0.2), `dot ${d + 1}`, 'blip', { pitch: ['D5', 'F5', 'A5', 'C6', 'D6', 'F6', 'A6', 'D7'][d] }]);
HITS.push([B2U(SC[9].phrases[6].t0), 'end card', 'impact']);
HITS.push([B2U(SC[9].phrases[6].t0 + 0.5), 'subscribe', 'bell', { pitch: 'D6' }]);
SC[8].phrases.slice(3, 7).forEach((p, j) => HITS.push([B2U(p.t0), `check ${j}`, 'tick']));

const fs = await fetch('assets/logo.png', { method: 'HEAD' }).then((r) => r.ok).catch(() => false);
M.film({
  fonts: [font(100, 800, DISPLAY), font(40, 500, UI), font(40, 700, UI)],
  images: fs ? { logo: 'assets/logo.png' } : {},
  hits: HITS,
  samples: 4,
  draw(ctx, u, t, IMG) { draw(ctx, t, IMG); captions(ctx, t); },
});
