// « C'est quoi un agent IA ? » – Jumota Agency, version avec voix off (Sébastien, ElevenLabs).
// One film, two cuts: agent-ia-90 (1 min 30) and agent-ia-court (Short, ~55 s) load this file; each
// folder's timeline.json (tools/timeline.py) says which cut it is and when every word is spoken.
// Pure function of time: window.seek(t) paints frame t.
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
function icChat(ctx, x, y, s, col = C.ink) {
  ctx.save(); ctx.fillStyle = col;
  rrect(ctx, x - s, y - s * 0.75, s * 2, s * 1.4, s * 0.45); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - s * 0.5, y + s * 0.5); ctx.lineTo(x - s * 0.75, y + s * 1.05); ctx.lineTo(x - s * 0.05, y + s * 0.6); ctx.fill();
  ctx.fillStyle = C.blue;
  for (let i = -1; i <= 1; i++) disc(ctx, x + i * s * 0.5, y - s * 0.05, s * 0.15, C.blue);
  ctx.restore();
}
function icBolt(ctx, x, y, s, col = C.ink) {
  ctx.save(); ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(x + s * 0.2, y - s); ctx.lineTo(x - s * 0.55, y + s * 0.15); ctx.lineTo(x - s * 0.02, y + s * 0.15);
  ctx.lineTo(x - s * 0.2, y + s); ctx.lineTo(x + s * 0.55, y - s * 0.15); ctx.lineTo(x + s * 0.02, y - s * 0.15); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function icWatch(ctx, x, y, s, k, col = C.ink) {   // stopwatch, ring filling with k
  ctx.save(); ctx.strokeStyle = SKY(0.35); ctx.lineWidth = s * 0.2;
  ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, s, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(k)); ctx.stroke();
  ctx.fillStyle = col; rrect(ctx, x - s * 0.25, y - s * 1.6, s * 0.5, s * 0.35, 3); ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------ the voice-over timeline
// timeline.json (tools/timeline.py) gives each scene its start/end and the time of every spoken word,
// so each accent fires on the word the narrator says. LONG = the 1 min 30 cut; the Short shares
// every scene and skips the extra beats.
const TL = await fetch('timeline.json').then((r) => r.json());
const LONG = TL.version === 'long';
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’]/g, "'").replace(/[^a-z0-9'-]/g, '');
function scene(key) {
  const S = TL.scenes.find((s) => s.key === key);
  const words = S.phrases.flatMap((p) => p.words);
  // local time of the n-th word matching w (exact after normalising), or fb if the take lacks it
  S.w = (w, n = 0, fb = 0) => {
    const hits = words.filter((x) => norm(x.w) === norm(w));
    return hits[n] ? hits[n].t0 - S.start : fb;
  };
  S.we = (w, n = 0, fb = 0) => {
    const hits = words.filter((x) => norm(x.w) === norm(w));
    return hits[n] ? hits[n].t1 - S.start : fb;
  };
  S.dur = S.end - S.start;
  return S;
}

// ------------------------------------------------------------------ scenes
// Each scene: cues (local seconds, from the spoken words), draw(ctx, lt), hits (local seconds).

// 1 · l'accroche
const K1 = (() => {
  const S = scene('hook');
  const c = { c: S.w("c'est", 0, 0.1), q: S.w('quoi', 0, 0.5), u: S.w('un', 0, 0.9), a: S.w('agent', 0, 1.7), ia: S.w('ia', 0, 2.2) };
  if (LONG) { c.tout = S.w('tout', 0, 2.7); c.n90 = S.w('quatre-vingt-dix', 0, 4.2); }
  return { S, c };
})();
function s1(ctx, t) {
  const { c } = K1;
  const y1 = 720, sz = 116, f = font(sz, 700, DISPLAY), sw = measure(ctx, ' ', f);
  let x = X0;
  [['C’est', Math.min(c.c - 0.12, -0.05)], ['quoi', c.q - 0.1], ['un…', c.u - 0.1]].forEach(([w, t0]) => {
    const k = sp(t, t0, SPRING.bouncy), ww = measure(ctx, w, f, -2);
    if (k > 0) {
      ctx.save(); ctx.globalAlpha *= clamp(k * 3);
      ctx.translate(x + ww / 2, y1 - (1 - k) * 420); ctx.rotate((1 - k) * -0.25);
      txt(ctx, w, -ww / 2, 0, f, C.ink, 'left', -2); ctx.restore();
    }
    x += ww + sw;
  });
  const big = fit(ctx, 'AGENT', 300, TW);
  ctx.save(); shakeAt(ctx, t, c.a, 26); shakeAt(ctx, t, c.ia, 18, 7);
  slam(ctx, 'AGENT', X0 - 6, y1 + big * 0.95, big, c.a, t, C.ink);
  slam(ctx, 'IA ?', X0 - 6, y1 + big * 1.85, big, c.ia, t, C.sky);
  ctx.restore();
  const k = io(t, c.ia + 0.35, 0.6, E.outQuint);
  if (k > 0) { ctx.fillStyle = C.blue; rrect(ctx, X0, y1 + big * 2.07, (TW - 40) * k, 16, 8); ctx.fill(); }
  if (!LONG) return;
  // « Tout le monde en parle » : talk bubbles pop, then fold into the 90-second timer
  const by = y1 + big * 2.07 + 150, gone = io(t, c.n90 - 0.15, 0.25, E.inCubic);
  [['IA', 0], ['agent ?', 0.18], ['ChatGPT', 0.36], ['…', 0.54]].forEach(([lbl, d], i) => {
    const kb = sp(t, c.tout + d, SPRING.bouncy) * (1 - gone);
    if (kb <= 0.001) return;
    const f2 = font(44, 700, UI), w = measure(ctx, lbl, f2) + 60, bx = X0 + [0, 140, 380, 650][i], yy = by + (i % 2) * 70;
    ctx.save(); scaleAt(ctx, kb, kb, bx + w / 2, yy);
    rrect(ctx, bx, yy - 36, w, 72, 36); ctx.fillStyle = i % 2 ? C.panel : SKY(0.18); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.line; ctx.stroke();
    txt(ctx, lbl, bx + 28, yy + 13, f2, C.ink);
    ctx.restore();
  });
  const kp = sp(t, c.n90, SPRING.bouncy);
  if (kp > 0) {
    const f2 = font(50, 800, DISPLAY), lbl = '90 SECONDES', w = measure(ctx, lbl, f2) + 160, yy = by + 40;
    ctx.save(); scaleAt(ctx, kp, kp, X0 + w / 2, yy);
    rrect(ctx, X0, yy - 56, w, 112, 56); ctx.fillStyle = C.blue; ctx.fill();
    icWatch(ctx, X0 + 62, yy + 4, 26, io(t, c.n90, K1.S.dur - c.n90, E.linear));
    txt(ctx, lbl, X0 + 116, yy + 18, f2, C.ink);
    ctx.restore();
  }
}
function h1() {
  const { c } = K1, h = [[c.c, 'C’est', 'pop', { pitch: 'D5' }], [c.q, 'quoi', 'pop', { pitch: 'F5' }], [c.u, 'un', 'pop', { pitch: 'A5' }],
    [c.a, 'AGENT', 'impact'], [c.ia, 'IA ?', 'thud']];
  if (LONG) { [0, 0.18, 0.36, 0.54].forEach((d, i) => h.push([c.tout + d, `bubble ${i}`, 'blip', { pitch: ['E5', 'G5', 'B5', 'D6'][i] }])); h.push([c.n90, '90 s', 'bell', { pitch: 'A5' }]); }
  return h;
}

// 2 · pas un robot de film
const K2 = (() => {
  const S = scene('robot');
  const c = LONG ? { x: S.w('pas', 0, 1.0) } : { x: S.w('film', 0, 1.0) + 0.05 };
  c.cap = LONG ? c.x : S.w('pas', 0, 0.4);
  if (LONG) { c.walk0 = S.w('marchent', 0, 1.2); c.walk1 = S.we('marchent', 0, 1.7); c.talk = S.w('parlent', 0, 1.9); }
  return { S, c };
})();
function robot(ctx, x, y, s, t, struck, walk = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const metal = struck > 0 ? M.mix('#D9E3F5', '#7F8DAA', struck) : '#D9E3F5', dark = '#1A2C52';
  const glow = struck > 0 ? M.mix('#5B9BFF', '#2A3B60', struck) : '#5B9BFF';
  const step = walk * Math.sin(t * 14) * 26;
  ctx.fillStyle = metal;
  rrect(ctx, -110, 150 - Math.max(0, step), 70, 150, 20); ctx.fill(); rrect(ctx, 40, 150 - Math.max(0, -step), 70, 150, 20); ctx.fill();
  rrect(ctx, -170, -20, 340, 220, 40); ctx.fill();
  ctx.fillStyle = dark; rrect(ctx, -95, 30, 190, 110, 20); ctx.fill();
  [0, 1, 2].forEach((i) => { disc(ctx, -50 + i * 50, 85, 16, i === Math.floor(t * 4) % 3 && !struck ? glow : '#34507F'); });
  const wave = struck > 0 ? 0 : Math.sin(t * 11) * 0.45 * io(t, 0.35, 0.2) * (1 - walk);
  ctx.save(); ctx.translate(-178, 10); ctx.rotate(0.18 + walk * Math.sin(t * 14) * 0.35); ctx.fillStyle = metal; rrect(ctx, -34, 0, 52, 190, 24); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(178, 10); ctx.rotate(lerp(-2.5 + wave, -0.18 - Math.sin(t * 14) * 0.35, walk)); ctx.fillStyle = metal; rrect(ctx, -18, 0, 52, 190, 24); ctx.fill();
  disc(ctx, 8, 196, 34, metal); ctx.restore();
  ctx.fillStyle = metal; ctx.fillRect(-30, -60, 60, 50);
  rrect(ctx, -150, -290, 300, 240, 48); ctx.fill();
  ctx.fillStyle = dark; rrect(ctx, -115, -245, 230, 120, 36); ctx.fill();
  const blink = Math.abs(Math.sin(t * 1.7)) > 0.97 ? 0.15 : 1;
  ctx.save(); ctx.translate(0, -185); ctx.scale(1, blink);
  disc(ctx, -50, 0, 30, glow); disc(ctx, 50, 0, 30, glow); ctx.restore();
  ctx.fillStyle = '#34507F'; rrect(ctx, -60, -105, 120, 20, 10); ctx.fill();
  ctx.fillStyle = metal; ctx.fillRect(-6, -360, 12, 72);
  disc(ctx, 0, -370, 22, Math.floor(t * 3) % 2 && !struck ? glow : metal);
  ctx.restore();
}
function s2(ctx, t) {
  const { c } = K2;
  const k = sp(t, -0.12, SPRING.bouncy);
  const struck = io(t, c.x, 0.4);
  const walk = LONG ? io(t, c.walk0 - 0.1, 0.2) * (1 - io(t, c.walk1 + 0.2, 0.25)) : 0;
  const bx = 540 + (LONG ? lerp(-60, 60, io(t, c.walk0 - 0.1, c.walk1 - c.walk0 + 0.4, E.inOutSine)) : 0);
  const by = 1100 + (1 - k) * 1100 + Math.sin(t * 4.2) * 10 * (1 - struck) - Math.abs(Math.sin(t * 14)) * 14 * walk;
  ctx.save(); shakeAt(ctx, t, c.x, 22); shakeAt(ctx, t, c.x + 0.18, 16, 5);
  robot(ctx, bx, by, lerp(1.2, 1.12, struck), t, struck, walk);
  if (LONG) {   // « … qui parlent » : a speech bubble from the film robot
    const kb = sp(t, c.talk, SPRING.bouncy) * (1 - io(t, c.x - 0.25, 0.2));
    if (kb > 0.001) {
      const f2 = font(40, 700, UI), lbl = 'BONJOUR, HUMAIN.', w = measure(ctx, lbl, f2, 2) + 60, x0 = Math.min(bx + 40, XR - w), y0 = by - 540;
      ctx.save(); scaleAt(ctx, kb, kb, x0, y0 + 40);
      rrect(ctx, x0, y0 - 40, w, 84, 24); ctx.fillStyle = C.ink; ctx.fill();
      ctx.beginPath(); ctx.moveTo(x0 + 30, y0 + 40); ctx.lineTo(x0 + 10, y0 + 76); ctx.lineTo(x0 + 70, y0 + 40); ctx.fill();
      txt(ctx, lbl, x0 + 30, y0 + 14, f2, C.navy, 'left', 2);
      ctx.restore();
    }
  }
  const a = io(t, c.x, 0.16, E.outQuad), b = io(t, c.x + 0.18, 0.16, E.outQuad);
  stroke(ctx, 250, 680, 830, 1430, a, C.blue, 54);
  stroke(ctx, 830, 680, 250, 1430, b, C.blue, 54);
  ctx.restore();
  rise(ctx, [['Pas', C.sky], ['un', C.ink], ['robot', C.ink]], X0, 440, 108, c.cap - 0.08, t);
  rise(ctx, 'de film.', X0, 560, 108, c.cap + 0.04, t);
}
function h2() {
  const { c } = K2, h = [[-0.05, 'robot rises', 'whoosh', { len: 0.4, from: 400, to: 1600 }], [0.2, 'robot lands', 'thud']];
  if (!LONG) for (let k = 0; k < 3; k++) h.push([0.45 + k * 0.17, `beep ${k}`, 'tok', { pitch: ['C6', 'E6', 'G6'][k] }]);
  if (LONG) {
    for (let k = 0; k < 6; k++) { const tt = c.walk0 + k * 0.224; if (tt < c.walk1 + 0.1) h.push([tt, `step ${k}`, 'tok', { pitch: k % 2 ? 'A3' : 'E3' }]); }
    h.push([c.talk, 'bonjour', 'tok', { pitch: 'G5' }]);
  }
  h.push([c.x, 'cross 1', 'thud'], [c.x + 0.18, 'cross 2', 'thud']);
  return h;
}

// 3 · un assistant qui travaille tout seul (+ la différence avec ChatGPT)
const K3 = (() => {
  const S = scene('solo');
  const c = { a: S.w("c'est", 0, 0), q: S.w('qui', 0, 0.5), ts: S.w('tout', 0, 1.5) };
  if (LONG) { c.diff = S.w('difference', 0, 4); c.gpt = S.w('chatgpt', 1, 5); c.agent = S.w('agent', 0, 8); c.agit = S.w('agit', 0, 9); }
  return { S, c };
})();
function s3(ctx, t) {
  const { c } = K3;
  rise(ctx, 'C’est un assistant', X0, 470, 84, Math.min(c.a - 0.1, -0.08), t);
  rise(ctx, 'qui travaille…', X0, 570, 84, c.q - 0.05, t);
  const big = fit(ctx, 'TOUT SEUL.', 200, TW);
  ctx.save(); shakeAt(ctx, t, c.ts, 22);
  slam(ctx, 'TOUT SEUL.', X0 - 4, 570 + big * 1.15, big, c.ts, t, C.sky);
  ctx.restore();
  // a task card that runs itself
  const out = LONG ? E.inCubic(prog(t, c.diff - 0.1, c.diff + 0.25)) : 0;
  const k = sp(t, Math.min(c.ts - 1.1, 0.35), SPRING.gentle);
  if (k > 0 && out < 1) {
    const cx = X0 - out * 1100, cy = 940 + (1 - k) * 260, cw = TW, ch = 470;
    ctx.save(); ctx.globalAlpha *= clamp(k * 2);
    panel(ctx, cx, cy, cw, ch, 34);
    txt(ctx, 'Tâches du jour', cx + 44, cy + 78, font(44, 800, UI), C.ink);
    const on = io(t, c.ts - 0.05, 0.25, E.outBack);
    const sx = cx + cw - 196, sy = cy + 40;
    rrect(ctx, sx, sy, 150, 58, 29); ctx.fillStyle = M.mix('#22407A', C.blue, clamp(on)); ctx.fill();
    txt(ctx, 'AUTO', sx + 24, sy + 39, font(24, 800, UI), clamp(on) > 0.5 ? C.ink : C.mute, 'left', 1);
    disc(ctx, sx + lerp(30, 120, on), sy + 29, 22, C.ink);
    [['Chercher les infos', 0.25], ['Écrire le résumé', 0.55], ['Envoyer le mail', 0.85]].forEach(([label, d], i) => {
      const tc = c.ts + d, ry = cy + 150 + i * 98, done = io(t, tc, 0.22);
      rrect(ctx, cx + 44, ry, 56, 56, 14);
      if (done > 0) { ctx.fillStyle = C.blue; ctx.fill(); } else { ctx.lineWidth = 3; ctx.strokeStyle = C.dim; ctx.stroke(); }
      check(ctx, cx + 72, ry + 28, 38, io(t, tc, 0.2), C.ink);
      txt(ctx, label, cx + 128, ry + 43, font(44, 600, UI), done > 0.5 ? C.ink : C.mute);
    });
    ctx.restore();
  }
  if (!LONG) return;
  // ChatGPT répond / l'agent agit
  const rows = [
    [c.gpt - 0.15, icChat, 'ChatGPT', 'Tu demandes, il répond.', false],
    [c.agent - 0.1, icBolt, 'Agent IA', 'Il agit, même sans toi.', true],
  ];
  rows.forEach(([t0, ic, title, line, hot], i) => {
    const kr = sp(t, t0, SPRING.snappy);
    if (kr <= 0) return;
    const y = 930 + i * 270;
    ctx.save(); ctx.translate((1 - kr) * 900, 0);
    panel(ctx, X0, y, TW, 230, 34, hot ? '#123070' : C.panel, hot ? C.blue : C.line);
    disc(ctx, X0 + 110, y + 115, 66, hot ? C.blue : '#1C3567'); ic(ctx, X0 + 110, y + 112, 34, C.ink);
    txt(ctx, title, X0 + 210, y + 100, font(58, 800, DISPLAY), hot ? C.sky : C.ink);
    txt(ctx, line, X0 + 210, y + 166, font(44, 600, UI), hot ? C.ink : C.mute);
    if (hot) { const kc = sp(t, c.agit, SPRING.bouncy); if (kc > 0) { ctx.save(); scaleAt(ctx, kc, kc, X0 + TW - 70, y + 60); disc(ctx, X0 + TW - 70, y + 60, 40, C.blue); check(ctx, X0 + TW - 70, y + 60, 44, io(t, c.agit + 0.05, 0.25), C.ink); ctx.restore(); } }
    ctx.restore();
  });
}
function h3() {
  const { c } = K3, h = [[c.ts, 'TOUT SEUL', 'impact'], [c.ts - 0.05, 'auto', 'click']];
  [0.25, 0.55, 0.85].forEach((d, k) => h.push([c.ts + d, `task ${k}`, 'blip', { pitch: ['A5', 'C6', 'E6'][k] }]));
  if (LONG) { h.push([c.diff - 0.1, 'card out', 'whoosh', { len: 0.35 }], [c.gpt - 0.15, 'gpt row', 'pop', { pitch: 'D5' }], [c.agent - 0.1, 'agent row', 'pop', { pitch: 'A5' }], [c.agit, 'agit', 'bell', { pitch: 'D6' }]); }
  return h;
}

// 4 · tu lui donnes 3 choses
const K4 = (() => {
  const S = scene('three');
  const c = { tu: S.w('tu', 0, 0), trois: S.w('trois', 0, 0.2), choses: S.w('choses', 0, 0.4) };
  if (LONG) c.pour = S.w('pour', 0, 0);
  return { S, c };
})();
function s4(ctx, t) {
  const { c } = K4;
  if (LONG) alpha(ctx, io(t, Math.min(c.pour - 0.1, -0.05), 0.3), () => txt(ctx, 'POUR CRÉER UN AGENT', X0, 560, font(36, 800, UI), C.mute, 'left', 4));
  rise(ctx, 'Tu lui donnes', X0, 700, 112, LONG ? c.tu - 0.12 : Math.min(c.tu - 0.12, -0.08), t);
  const k = sp(t, c.trois - 0.05, SPRING.bouncy);
  if (k > 0) {
    const f = font(640, 800, DISPLAY), w3 = measure(ctx, '3', f);
    ctx.save(); scaleAt(ctx, k, k, X0 + w3 / 2, 1300);
    txt(ctx, '3', X0 - 20, 1360, f, C.sky); ctx.restore();
    rise(ctx, 'choses :', X0 + w3 + 10, 1300, 112, c.choses - 0.1, t);
  }
}
function h4() { return [[K4.c.trois - 0.05, '3', 'pop', { pitch: 'D5' }]]; }

// 5–7 · les trois ingrédients
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
  [0, 1, 2].forEach((i) => {
    ctx.fillStyle = i < n ? (i === n - 1 ? C.blue : SKY(0.45)) : 'rgba(159,178,217,0.18)';
    rrect(ctx, X0 + i * 112, 478 + sz * 1.02 + 46, 96, 12, 6); ctx.fill();
  });
}
function quoteCard(ctx, t, str, t0, dur, y = 1360, flip = null) {
  const k = sp(t, t0 - 0.25, SPRING.snappy);
  if (k <= 0) return;
  let f = font(52, 700, UI);
  // optional second line of copy that flips in (horaire, long cut)
  let s = str, td = t0, dd = dur, sy = 1;
  if (flip && t >= flip.t - 0.12) {
    const p = prog(t, flip.t - 0.12, flip.t + 0.12);
    if (t < flip.t) sy = 1 - p * 2; else { s = flip.str; td = flip.t; dd = flip.dur; sy = Math.min(1, (t - flip.t) / 0.12); }
  }
  const fs = Math.min(52, Math.floor(52 * (TW - 120) / measure(ctx, s, f))); f = font(fs, 700, UI);
  const n = Math.round(io(t, td, dd, E.linear) * s.length);
  ctx.save(); ctx.globalAlpha *= clamp(k * 2); ctx.translate(0, (1 - k) * 60);
  scaleAt(ctx, 1, Math.max(0.02, Math.abs(sy)), 540, y + 64);
  panel(ctx, X0, y, TW, 128, 64, C.panel, C.blue);
  const shown = s.slice(0, n);
  txt(ctx, shown, X0 + 52, y + 82, f, C.ink);
  if (n < s.length || Math.floor(t * 2.2) % 2 === 0) { const cw = measure(ctx, shown, f); ctx.fillStyle = C.sky; ctx.fillRect(X0 + 58 + cw, y + 36, 5, 60); }
  ctx.restore();
}

const K5 = (() => {
  const S = scene('mission');
  const c = { hit: S.w('mission', 0, 1.0), q: S.w('resumer', 0, 1.6), qe: S.we('ia', 0, 2.6) };
  if (LONG) { c.claire = S.w('claire', 0, 6); c.qe = S.we("l'ia", 0, c.q + 1.2); }
  return { S, c };
})();
function s5(ctx, t) {
  const { c } = K5;
  itemHeader(ctx, t, 1, 'Une', 'MISSION');
  const cx = 540, cy = LONG ? 990 : 1020, sc = LONG ? 0.86 : 1, k = sp(t, -0.3, SPRING.bouncy);
  const hitW = 1 + 0.05 * M.wobble(t - c.hit, 3, 6);
  if (k > 0) {
    ctx.save(); scaleAt(ctx, k * hitW * sc, k * hitW * sc, cx, cy);
    [[230, C.ink], [172, C.blue], [114, C.ink], [56, C.blue]].forEach(([r, col]) => disc(ctx, cx, cy, r, col));
    ctx.restore();
  }
  const p = E.inQuad(prog(t, c.hit - 0.3, c.hit));
  if (p > 0) {
    const sx = cx + 760, sy = cy - 760, tx = lerp(sx, cx, p), ty = lerp(sy, cy, p);
    const a = Math.atan2(cy - sy, cx - sx), quiver = t > c.hit ? 0.06 * M.ring(t - c.hit, 7, 6) : 0;
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(a + quiver); ctx.scale(sc, sc);
    ctx.fillStyle = C.navy; ctx.fillRect(-300, -8, 290, 16);
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-30, -22); ctx.lineTo(-30, 22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.sky;
    ctx.beginPath(); ctx.moveTo(-300, -8); ctx.lineTo(-340, -52); ctx.lineTo(-250, -8); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-300, 8); ctx.lineTo(-340, 52); ctx.lineTo(-250, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  quoteCard(ctx, t, '« Résumer l’actu IA »', c.q, Math.max(0.5, c.qe - c.q));
  if (!LONG) return;
  // « plus ta mission est claire… » : claire vs floue
  [['claire', true, 0], ['floue', false, 0.3]].forEach(([lbl, good, d], i) => {
    const kc = sp(t, c.claire + d, SPRING.bouncy);
    if (kc <= 0) return;
    const f2 = font(42, 800, UI), w = 290, x = X0 + i * (w + 30), y = 1245;
    ctx.save(); scaleAt(ctx, kc, kc, x + w / 2, y + 40);
    rrect(ctx, x, y, w, 80, 40); ctx.fillStyle = good ? C.blue : 'rgba(159,178,217,0.12)'; ctx.fill();
    if (!good) { ctx.lineWidth = 2; ctx.strokeStyle = C.dim; ctx.stroke(); }
    if (good) check(ctx, x + 50, y + 40, 40, io(t, c.claire + 0.05, 0.25), C.ink);
    else { stroke(ctx, x + 34, y + 24, x + 66, y + 56, 1, C.mute, 7); stroke(ctx, x + 66, y + 24, x + 34, y + 56, 1, C.mute, 7); }
    txt(ctx, lbl, x + 92, y + 55, f2, good ? C.ink : C.mute);
    if (!good) { const lw = measure(ctx, lbl, f2); stroke(ctx, x + 88, y + 42, x + 96 + lw, y + 42, io(t, c.claire + d + 0.15, 0.2), C.mute, 5); }
    ctx.restore();
  });
}
function h5() {
  const { c } = K5, h = [[-0.1, 'whip', 'whoosh', { len: 0.4, from: 2400, to: 600 }], [c.hit - 0.3, 'arrow', 'whoosh', { len: 0.3, from: 800, to: 3000 }], [c.hit, 'bullseye', 'thud'],
    [c.q, 'type', 'type', { n: 14, len: Math.max(0.5, c.qe - c.q) }]];
  if (LONG) h.push([c.claire, 'claire', 'bell', { pitch: 'A5' }], [c.claire + 0.3, 'floue', 'tok', { pitch: 'C4' }]);
  return h;
}

const K6 = (() => {
  const S = scene('horaire');
  const c = { seven: S.w('sept', 0, 2.0), q: S.w('chaque', 0, 1.6) };
  c.qe = S.we('heures', 0, c.q + 1.2);
  c.a = Math.max(0.35, c.seven - 1.7);
  if (LONG) { c.ou = S.w('ou', 0, 4.5); c.oue = S.we('recu', 0, c.ou + 1.4); }
  return { S, c };
})();
const clockFrac = (t) => E.inOutCubic(prog(t, K6.c.a, K6.c.seven));
function s6(ctx, t) {
  const { c } = K6;
  itemHeader(ctx, t, 2, 'Un', 'HORAIRE');
  const cx = 540, cy = 1020, R = 228, k = sp(t, -0.3, SPRING.bouncy);
  if (k <= 0) return;
  const land = io(t, c.seven, 0.5, E.outCubic);
  if (land > 0) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.25);
    ctx.strokeStyle = SKY(0.55 * land); ctx.lineWidth = 14; ctx.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU, r0 = R + 30, r1 = R + 30 + (i % 2 ? 50 : 90) * land;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke();
    }
    ctx.restore();
  }
  const ringS = 1 + 0.045 * M.ring(t - c.seven, 9, 5);
  ctx.save(); scaleAt(ctx, k * ringS, k * ringS, cx, cy);
  ctx.translate(cx, cy); ctx.rotate(0.04 * M.ring(t - c.seven, 11, 5)); ctx.translate(-cx, -cy);
  disc(ctx, cx, cy, R + 18, C.blue); disc(ctx, cx, cy, R, C.ink);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU, r0 = i % 3 ? R - 34 : R - 52;
    ctx.strokeStyle = C.navy; ctx.lineWidth = i % 3 ? 7 : 12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx + Math.sin(a) * r0, cy - Math.cos(a) * r0); ctx.lineTo(cx + Math.sin(a) * (R - 18), cy - Math.cos(a) * (R - 18)); ctx.stroke();
  }
  const hours = 7 * clockFrac(t), am = hours * TAU, ah = (hours / 12) * TAU;
  ctx.strokeStyle = C.navy; ctx.lineCap = 'round';
  ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(ah) * R * 0.5, cy - Math.cos(ah) * R * 0.5); ctx.stroke();
  ctx.strokeStyle = C.blue; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(am) * R * 0.78, cy - Math.cos(am) * R * 0.78); ctx.stroke();
  disc(ctx, cx, cy, 20, C.navy);
  ctx.restore();
  const kt = sp(t, c.seven, SPRING.bouncy);
  if (kt > 0) {
    ctx.save(); scaleAt(ctx, kt, kt, cx + 210, cy - 210);
    rrect(ctx, cx + 120, cy - 262, 200, 104, 52); ctx.fillStyle = C.blue; ctx.fill();
    txt(ctx, '7:00', cx + 220, cy - 190, font(58, 800, DISPLAY), C.ink, 'center');
    ctx.restore();
  }
  if (LONG) {   // « … ou à chaque nouveau mail reçu » : a mail badge lands on the clock
    const km = sp(t, c.ou + 0.3, SPRING.bouncy);
    if (km > 0) {
      ctx.save(); scaleAt(ctx, km, km, cx - 220, cy - 200);
      disc(ctx, cx - 220, cy - 200, 74, C.blue); icMail(ctx, cx - 220, cy - 200, 34, C.ink);
      disc(ctx, cx - 166, cy - 254, 20, C.ink);
      ctx.restore();
    }
  }
  quoteCard(ctx, t, '« Chaque matin à 7h »', c.q, Math.max(0.5, c.qe - c.q), 1360,
    LONG ? { t: c.ou, str: '« Ou à chaque nouveau mail »', dur: Math.max(0.6, c.oue - c.ou) } : null);
}
function h6() {
  const { c } = K6, h = [[-0.1, 'whip', 'whoosh', { len: 0.4, from: 2400, to: 600 }]];
  for (let hr = 1; hr <= 7; hr++) {
    let lo = c.a, hi = c.seven;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (clockFrac(m) * 7 < hr) lo = m; else hi = m; }
    h.push([lo, `hour ${hr}`, 'tick']);
  }
  h.push([c.seven, '7h', 'bell', { pitch: 'A5' }], [c.q, 'type', 'type', { n: 14, len: Math.max(0.5, c.qe - c.q) }]);
  if (LONG) h.push([c.ou + 0.3, 'mail badge', 'pop', { pitch: 'E6' }], [c.ou, 'type 2', 'type', { n: 16, len: Math.max(0.6, c.oue - c.ou) }]);
  return h;
}

const K7 = (() => {
  const S = scene('outils');
  const c = LONG
    ? { node: S.w('mains', 0, 1.6), tools: [S.w('mail', 0, 2.4), S.w('reseaux', 0, 3.2), S.w('web', 0, 4.0)], sans: S.w('sans', 0, 5), rien: S.we('faire', 0, 6.3) }
    : { tools: [S.w('email', 0, 1.6), S.w('reseaux', 0, 2.3), S.w('web', 0, 3.0)] };
  if (!LONG) c.node = c.tools[2] + 0.6;
  return { S, c };
})();
const TOOLS = [['Email', icMail], ['Réseaux|sociaux', icSocial], ['Web', icGlobe]];
function s7(ctx, t) {
  const { c } = K7;
  itemHeader(ctx, t, 3, 'Des', 'OUTILS');
  const ty = 960, xs = [220, 510, 800], node = [510, 1330];
  const cut = LONG ? io(t, c.sans, 0.15) * (1 - io(t, c.rien + 0.1, 0.3)) : 0;   // « sans outils… » : the links drop out
  TOOLS.forEach((_, i) => {
    const t0 = Math.max(c.tools[i], c.node) + 0.1, k = io(t, t0, 0.35);
    if (k <= 0) return;
    const x0 = node[0], y0 = node[1] - 80, x1 = xs[i], y1 = ty + 220;
    ctx.save(); ctx.strokeStyle = cut > 0.5 ? 'rgba(159,178,217,0.25)' : SKY(0.7); ctx.lineWidth = 6; ctx.setLineDash([2, 16]); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(lerp(x0, x1, k), lerp(y0, y1, k)); ctx.stroke(); ctx.restore();
    if (k >= 1 && cut < 0.5) { const q = ((t - t0 - i * 0.25) * 1.1) % 1; disc(ctx, lerp(x1, x0, q), lerp(y1, y0, q), 11, C.ink); }
  });
  const kn = sp(t, c.node - 0.1, SPRING.bouncy);
  if (kn > 0) {
    ctx.save(); scaleAt(ctx, kn, kn, ...node);
    disc(ctx, node[0], node[1], 86, cut > 0.5 ? '#2A3B60' : C.blue);
    txt(ctx, 'IA', node[0], node[1] + 22, font(62, 800, DISPLAY), cut > 0.5 ? C.mute : C.ink, 'center');
    ctx.restore();
    alpha(ctx, io(t, c.node + 0.2, 0.3), () => txt(ctx, 'ton agent', node[0] + 112, node[1] + 16, font(46, 700, UI), C.mute));
  }
  TOOLS.forEach(([label, ic], i) => {
    const k = sp(t, c.tools[i] - 0.08, SPRING.bouncy);
    if (k <= 0) return;
    const x = xs[i], s = 168;
    ctx.save(); scaleAt(ctx, k, k, x, ty); ctx.globalAlpha *= 1 - 0.55 * cut;
    rrect(ctx, x - s / 2, ty - s / 2, s, s, 42); ctx.fillStyle = C.blue; ctx.fill();
    ic(ctx, x, ty, 44, C.ink);
    label.split('|').forEach((l, j) => txt(ctx, l, x, ty + s / 2 + 60 + j * 50, font(44, 700, UI), C.ink, 'center'));
    ctx.restore();
  });
}
function h7() {
  const { c } = K7, h = [[-0.1, 'whip', 'whoosh', { len: 0.4, from: 2400, to: 600 }], [c.node - 0.1, 'agent node', 'blip', { pitch: 'D6' }]];
  c.tools.forEach((tt, k) => h.push([tt - 0.08, `tool ${k}`, 'pop', { pitch: ['D5', 'F5', 'A5'][k] }]));
  if (LONG) h.push([c.sans, 'unplug', 'thud', { pitch: 'C3' }], [c.rien + 0.1, 'replug', 'blip', { pitch: 'D6' }]);
  return h;
}

// 8 · l'équation
const K8 = (() => {
  const S = scene('eq');
  const c = { rows: [S.w('mission', 0, 0), S.w('horaire', 0, 0.6), S.w('outils', 0, 1.2)], slam: S.w('agent', 0, 2.5) };
  return { S, c };
})();
function s8(ctx, t) {
  const { c } = K8;
  const rows = [['', icTarget, 'Mission'], ['+', icClock, 'Horaire'], ['+', icTools, 'Outils']];
  const dimR = io(t, c.slam, 0.4);
  rows.forEach(([op, ic, word], i) => {
    const y = 560 + i * 170, k = sp(t, Math.min(c.rows[i] - 0.12, i === 0 ? -0.1 : 9), SPRING.snappy);
    if (k <= 0) return;
    ctx.save(); ctx.globalAlpha *= clamp(k * 2) * (1 - 0.35 * dimR); ctx.translate((1 - k) * 260, 0);
    if (op) txt(ctx, op, X0, y, font(110, 800, DISPLAY), C.sky);
    disc(ctx, X0 + 150, y - 38, 54, C.blue); ic(ctx, X0 + 150, y - 38, 32, C.ink);
    txt(ctx, word, X0 + 236, y, font(108, 800, DISPLAY), C.ink, 'left', -2);
    ctx.restore();
  });
  const lk = io(t, c.rows[2] + 0.35, Math.max(0.3, c.slam - c.rows[2] - 0.45), E.inOutCubic);
  if (lk > 0) { ctx.fillStyle = C.ink; rrect(ctx, X0, 960, TW * lk, 10, 5); ctx.fill(); }
  const kb = sp(t, c.slam - 0.08, { stiffness: 420, damping: 26 });
  if (kb > 0) {
    const bw = TW, bh = 250, by = 1040;
    ctx.save(); shakeAt(ctx, t, c.slam, 26);
    rrect(ctx, X0, by, bw * kb, bh, 40); ctx.fillStyle = C.blue; ctx.fill();
    const pr = io(t, c.slam, 0.8, E.outCubic);
    if (pr > 0 && pr < 1) { ctx.strokeStyle = SKY(0.6 * (1 - pr)); ctx.lineWidth = 8; rrect(ctx, X0 - 40 * pr, by - 40 * pr, bw + 80 * pr, bh + 80 * pr, 40 + 40 * pr); ctx.stroke(); }
    ctx.beginPath(); ctx.rect(X0, by, bw * kb, bh); ctx.clip();
    const sz = fit(ctx, '= AGENT IA', 150, bw - 100);
    slam(ctx, '= AGENT IA', X0 + bw / 2, by + bh / 2 + sz * 0.36, sz, c.slam, t, C.ink, 'center');
    ctx.restore();
  }
}
function h8() {
  const { c } = K8, h = c.rows.map((tt, k) => [Math.max(0, tt - 0.12), `eq row ${k}`, 'pop', { pitch: ['D5', 'F5', 'A5'][k] }]);
  h.push([c.rows[2] + 0.5, 'rule', 'whoosh', { len: 0.45, from: 600, to: 2000 }], [c.slam, '= AGENT IA', 'impact']);
  return h;
}

// 9 · l'exemple concret
const K9 = (() => {
  const S = scene('exemple');
  const c = { steps: [S.w('sept', 0, 0.3), S.w('sept', 1, 1.6), S.w('sept', 2, 2.9)], sleep: S.w('toi', 0, 4.2), label: LONG ? S.w('concretement', 0, 0) : -0.1 };
  return { S, c };
})();
const STEPS = [['7h00', icSearch, 'Il cherche l’actu'], ['7h02', icDoc, 'Il résume'], ['7h05', icMail, 'C’est dans ta boîte']];
function s9(ctx, t) {
  const { c } = K9;
  alpha(ctx, io(t, Math.min(c.label - 0.1, -0.05), 0.3), () => txt(ctx, 'EXEMPLE CONCRET', X0, 390, font(34, 800, UI), C.mute, 'left', 4));
  const idx = t < c.steps[1] - 0.1 ? 0 : t < c.steps[2] - 0.1 ? 1 : 2, lbl = ['7:00', '7:02', '7:05'][idx];
  const flip = sp(t, idx ? c.steps[idx] - 0.1 : Math.min(c.steps[0] - 0.4, -0.1), SPRING.bouncy);
  ctx.save(); ctx.beginPath(); ctx.rect(X0 - 20, 410, TW, 200); ctx.clip();
  txt(ctx, lbl, X0 - 6, 580 + (1 - flip) * 150, font(176, 800, DISPLAY), C.ink, 'left', -4);
  ctx.restore();
  STEPS.forEach(([tm, ic, label], i) => {
    const t0 = c.steps[i], k = sp(t, t0 - 0.1, SPRING.snappy);
    if (k <= 0) return;
    const y = 660 + i * 166;
    ctx.save(); ctx.translate((1 - k) * 700, 0);
    panel(ctx, X0, y, TW, 136, 30, i === 2 && t > t0 + 0.3 ? '#123070' : C.panel, C.line);
    txt(ctx, tm, X0 + 34, y + 86, font(50, 800, DISPLAY), C.sky);
    disc(ctx, X0 + 250, y + 68, 42, C.blue); ic(ctx, X0 + 250, y + 68, 24, C.ink);
    txt(ctx, label, X0 + 318, y + 85, font(48, 700, UI), C.ink);
    if (i === 2) { const kd = sp(t, t0 + 0.35, SPRING.bouncy); if (kd > 0) disc(ctx, X0 + 282, y + 36, 16 * kd, C.ink); }
    ctx.restore();
  });
  const km = sp(t, c.sleep - 0.1, SPRING.gentle);
  if (km > 0) {
    const y = 1260;
    ctx.save(); ctx.globalAlpha *= clamp(km * 2);
    moon(ctx, X0 + 60, y + 30 + (1 - km) * 80, 62, C.sky);
    ctx.restore();
    rise(ctx, [['Toi,', C.sky], ['tu', C.ink], ['dors', C.ink]], X0 + 160, y + 40, 86, c.sleep - 0.05, t);
    rise(ctx, 'encore.', X0 + 160, y + 150, 86, c.sleep + 0.1, t);
    [0, 1, 2].forEach((i) => {
      const lt = t - c.sleep - 0.4 - i * 0.35;
      if (lt <= 0) return;
      const q = (lt % 1.6) / 1.6;
      ctx.save(); ctx.globalAlpha *= Math.sin(q * Math.PI);
      txt(ctx, 'z', 700 + i * 52 + q * 60, y + 140 - q * 170 - i * 30, font(46 + i * 14, 800, DISPLAY), C.mute);
      ctx.restore();
    });
  }
}
function h9() {
  const { c } = K9, h = c.steps.map((tt, k) => [tt - 0.1, `step ${k}`, 'blip', { pitch: ['E5', 'A5', 'D6'][k] }]);
  h.push([c.steps[2] + 0.35, 'mail lands', 'bell', { pitch: 'E6' }], [c.sleep, 'asleep', 'tok', { pitch: 'A4' }]);
  return h;
}

// 10 · la règle d'or
const K10 = (() => {
  const S = scene('regle');
  const c = { regle: S.w('regle', 0, 0), ia: S.w("l'ia", 0, 0.5), toi: S.w('toi', 0, 1.5), tu: S.w('tu', 0, 1.8), val: S.w('valides', 0, 2.0) };
  if (LONG) { c.relis = S.w('relis', 0, 4.5); c.relise = S.we("d'envoyer", 0, c.relis + 1.8); }
  return { S, c };
})();
function s10(ctx, t) {
  const { c } = K10;
  const kp = sp(t, Math.min(c.regle - 0.2, LONG ? 9 : -0.12), SPRING.bouncy);
  if (kp > 0) {
    const f = font(34, 800, UI), w = measure(ctx, 'LA RÈGLE D’OR', f, 4) + 64;
    ctx.save(); scaleAt(ctx, kp, kp, X0 + w / 2, 430);
    rrect(ctx, X0, 392, w, 78, 39); ctx.fillStyle = SKY(0.12); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.sky; ctx.stroke();
    txt(ctx, 'LA RÈGLE D’OR', X0 + 32, 444, f, C.sky, 'left', 4);
    ctx.restore();
  }
  if (LONG) alpha(ctx, io(t, -0.1, 0.3) * (1 - io(t, c.regle - 0.3, 0.2)), () => txt(ctx, 'ATTENTION', X0, 444, font(34, 800, UI), C.mute, 'left', 6));
  rise(ctx, 'L’IA prépare.', X0, 640, 110, c.ia - 0.1, t);
  ctx.save(); shakeAt(ctx, t, c.toi, 22);
  slam(ctx, 'TOI,', X0 - 4, 840, 170, c.toi, t, C.sky);
  ctx.restore();
  rise(ctx, 'tu valides.', X0, 980, 110, c.tu - 0.08, t);
  const ck = c.val + 0.3;
  const mv = LONG ? io(t, c.relis - 0.1, 0.45, E.inOutCubic) : 0;
  const kc = sp(t, ck, SPRING.bouncy), cx = lerp(540, X0 + 110, mv), cy = 1270, r = lerp(170, 110, mv);
  if (kc > 0) {
    const pr = io(t, ck + 0.15, 0.9);
    if (pr < 1) { ctx.strokeStyle = SKY(0.6 * (1 - pr)); ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, r + 120 * pr, 0, TAU); ctx.stroke(); }
    ctx.save(); scaleAt(ctx, kc, kc, cx, cy);
    disc(ctx, cx, cy, r, C.blue);
    check(ctx, cx, cy, r * 1.18, io(t, ck + 0.08, 0.3, E.outCubic), C.ink);
    ctx.restore();
  }
  if (LONG) {
    rise(ctx, 'Relis toujours', X0 + 260, cy - 14, 58, c.relis + 0.05, t, { weight: 800 });
    rise(ctx, 'avant d’envoyer.', X0 + 260, cy + 66, 58, c.relis + 0.4, t, { weight: 800, color: C.mute });
  }
}
function h10() {
  const { c } = K10, h = [[Math.max(-0.1, c.regle - 0.2), 'règle d’or', 'pop', { pitch: 'A5' }], [c.toi, 'TOI', 'impact'], [c.val + 0.3, 'check', 'bell', { pitch: 'D6' }]];
  if (LONG) h.push([c.relis - 0.1, 'relis', 'whoosh', { len: 0.4, from: 600, to: 1800 }]);
  return h;
}

// 11 · abonne-toi
const K11 = (() => {
  const S = scene('cta');
  const c = { click: S.w('abonne-toi', 0, 1.0) };
  return { S, c };
})();
function s11(ctx, t) {
  const { c } = K11;
  rise(ctx, 'Le tuto complet', X0, 620, 96, -0.12, t);
  rise(ctx, [['est', C.ink], ['sur', C.ink], ['la', C.ink], ['chaîne', C.sky]], X0, 735, 96, 0.05, t);
  if (LONG) alpha(ctx, io(t, 0.6, 0.3), () => txt(ctx, 'PAS À PAS', X0, 820, font(36, 800, UI), C.mute, 'left', 6));
  const cx = 520, cy = 1010, bw = 600, bh = 160;
  const kb = sp(t, 0.3, SPRING.bouncy), CL = c.click;
  if (kb > 0) {
    const press = 1 - 0.07 * Math.sin(Math.PI * prog(t, CL - 0.04, CL + 0.14));
    const on = t >= CL;
    ctx.save(); scaleAt(ctx, kb * press, kb * press, cx, cy);
    rrect(ctx, cx - bw / 2, cy - bh / 2, bw, bh, bh / 2); ctx.fillStyle = on ? C.ink : C.blue; ctx.fill();
    const label = on ? 'Abonné' : 'S’abonner', f = font(62, 800, DISPLAY);
    const w = measure(ctx, label, f) + (on ? 90 : 0);
    txt(ctx, label, cx - w / 2 + (on ? 90 : 0), cy + 22, f, on ? C.blue : C.ink);
    if (on) check(ctx, cx - w / 2 + 34, cy, 64, io(t, CL, 0.2), C.blue);
    ctx.restore();
  }
  const kp = io(t, Math.max(0.45, CL - 0.6), 0.5, E.inOutCubic);
  if (kp > 0) {
    const px = lerp(980, cx + 220, kp), py = lerp(1420, cy + 40, kp);
    pointer(ctx, px, py, 1.25 * (1 - 0.1 * Math.sin(Math.PI * prog(t, CL - 0.04, CL + 0.14))));
  }
}
function h11() {
  const { c } = K11;
  return [[0.3, 'button', 'pop', { pitch: 'A5' }], [c.click, 'click', 'click'], [c.click + 0.05, 'subscribed', 'bell', { pitch: 'A5' }], [K11.S.dur - 0.3, 'wipe', 'swell', { len: 0.3 }]];
}

// 12 · la signature, sur fond blanc
const K12 = (() => {
  const S = scene('fin');
  const c = { dot: S.w('agency', 0, 1.0) + 0.1, tag: S.w('marketing', 0, 1.5) };
  return { S, c };
})();
function s12(ctx, t) {
  const { c } = K12;
  const r = Math.hypot(W, H) * E.inOutCubic(prog(t, -0.32, 0.02));
  if (r <= 0) return;
  ctx.save(); ctx.beginPath(); ctx.arc(520, 1010, r, 0, TAU); ctx.fillStyle = C.paper; ctx.fill(); ctx.clip();
  const f = font(218, 800, DISPLAY), tr = -8;
  const wWord = measure(ctx, 'jumota', f, tr), wDot = measure(ctx, '.', f, tr), total = wWord + wDot;
  const x0 = 520 - total / 2, y = 1030;
  const L = M.layout(ctx, 'jumota', f, tr);
  L.glyphs.forEach((g, i) => {
    const k = sp(t, -0.24 + i * 0.08, SPRING.bouncy);
    if (k <= 0) return;
    M.glyph(ctx, g.ch, x0 + g.cx, y + (1 - k) * 90, f, C.navy, 1, lerp(0.55, 1, clamp(k)));
  });
  const kd = sp(t, c.dot - 0.25, { stiffness: 300, damping: 11 });
  if (kd > 0) {
    const sq = 1 + 0.25 * M.wobble(t - c.dot + 0.05, 3, 6);
    ctx.save(); ctx.translate(x0 + wWord + wDot / 2, y - (1 - kd) * 700);
    ctx.scale(sq, 1 / sq); ctx.fillStyle = C.blue;
    ctx.font = f; ctx.letterSpacing = `${tr}px`; ctx.textAlign = 'center'; ctx.fillText('.', 0, 0); ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
    ctx.restore();
  }
  const kl = io(t, c.tag + 0.1, 0.6, E.outQuint);
  if (kl > 0) { ctx.fillStyle = C.blue; rrect(ctx, 520 - 60 * kl, y + 70, 120 * kl, 8, 4); ctx.fill(); }
  const fa = font(44, 800, UI), fb = font(44, 500, UI);
  const a = 'Jumota Agency', b = '  ·  Marketing digital & IA';
  const wa = measure(ctx, a, fa), wb = measure(ctx, b, fb), tx = 520 - (wa + wb) / 2;
  const kt = sp(t, c.tag - 0.1, SPRING.snappy);
  if (kt > 0) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, y + 100, W, 120); ctx.clip();
    const dy = (1 - kt) * 60;
    txt(ctx, a, tx, y + 170 + dy, fa, C.navy);
    txt(ctx, b, tx + wa, y + 170 + dy, fb, C.slate);
    ctx.restore();
  }
  ctx.restore();
}
function h12() {
  const h = [[0, 'end card', 'sub', { len: 0.8 }]];
  for (let i = 0; i < 6; i++) h.push([-0.2 + i * 0.08, `letter ${i}`, 'tick']);
  h.push([K12.c.dot, 'dot', 'bell', { pitch: 'D6' }]);
  return h;
}

// ------------------------------------------------------------------ timeline
const PLAN = [
  [K1, s1, h1, { out: 'up' }], [K2, s2, h2, { out: 'up' }], [K3, s3, h3, { out: 'up' }], [K4, s4, h4, { out: 'whip' }],
  [K5, s5, h5, { in: 'whip', out: 'whip' }], [K6, s6, h6, { in: 'whip', out: 'whip' }], [K7, s7, h7, { in: 'whip', out: 'up' }],
  [K8, s8, h8, { out: 'up' }], [K9, s9, h9, { out: 'up' }], [K10, s10, h10, { out: 'up' }], [K11, s11, h11, { out: 'none' }], [K12, s12, h12, { last: true }],
];
const SCENES = PLAN.map(([K, draw, , o]) => ({ a: K.S.start, b: o.last ? K.S.end + 1 : K.S.end, draw, ...o }));
const WHIP = [-0.32, 0.08];
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

// every accent gets a sound, on the music grid (u = beats = 2 t at 120 BPM)
const HITS = [];
PLAN.forEach(([K, , hits, o], i) => {
  hits().forEach(([lt, label, sfx, opts]) => HITS.push([Math.max(0, (K.S.start + lt) * 2), label, sfx, opts]));
  if (o.out === 'up') HITS.push([(K.S.end - 0.3) * 2, `lift ${i}`, 'whoosh', { len: 0.35 }]);
});
HITS.sort((a, b) => a[0] - b[0]);

M.film({
  fonts: [font(100, 800, DISPLAY), font(100, 700, DISPLAY), font(40, 500, UI), font(40, 600, UI), font(40, 700, UI), font(40, 800, UI)],
  hits: HITS,
  samples: 6,
  draw(ctx, u, t) { draw(ctx, t); },
});
