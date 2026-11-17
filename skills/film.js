// 3 skills Claude à installer en premier – Jumota Agency. Vertical 9:16, 1080×1920.
// Pure function of time: window.seek(t) paints frame t. Scene starts and every word's time come from
// timeline.json (tools/timeline.py: Antinéa takes when all present, reading pace otherwise), so the
// whole film re-times itself when the voice-over lands. Plan: docs/shotlist.md.
// Frame (after the reference): chapter bar on top, word-by-word captions, a stage, a console below.
import * as M from './lib/motion.js';

const { W, H, E, prog, lerp, clamp, SPRING, font, rrect, hash01, noise1 } = M;

const TL = await fetch('timeline.json').then((r) => r.json());
const BG = await fetch('beats.json').then((r) => r.json());   // grid, to place sound hits in beats
const SC = TL.scenes;
const DUR = TL.duration;
const DISPLAY = 'Display', UI = 'UI', MONO = 'Mono';

// Jumota night blue + electric blue / cyan, a violet glow from the reference, orange for warnings.
const C = {
  bg0: '#050C1E', bg1: '#0A1633', ink: '#FFFFFF', mute: '#8E9DC2', dim: '#4F5F8A', faint: '#26355E',
  panel: 'rgba(12,24,52,0.92)', panel2: '#0F1E42', line: '#22386B',
  cyan: '#00D9FF', blue: '#126BFF', violet: '#8B5CFF', pink: '#E84CFF', orange: '#FF8A1F', green: '#2BD98F', red: '#FF4D5E',
};
const rgba = (hex, a) => { const [r, g, b] = M.hexRgb(hex); return `rgba(${r},${g},${b},${a})`; };
const X0 = 72, XW = W - 2 * X0;          // content column
const CAP_Y = 262;                        // caption block top
const STAGE_Y = 452, STAGE_B = 1250;      // stage band
const CON_Y = 1292, CON_H = 318;          // console

// ------------------------------------------------------------------ timing helpers
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9-]/g, '');
// time a word starts: first word (n-th match) of scene S whose text starts with key
function A(S, key, n = 0) {
  const k = norm(key);
  for (const w of S.words) if (norm(w.w).startsWith(k) && n-- === 0) return w.t0;
  throw new Error(`no word "${key}" in scene ${S.i}`);
}
const AE = (S, key, n = 0) => { const k = norm(key); for (const w of S.words) if (norm(w.w).startsWith(k) && n-- === 0) return w.t1; throw new Error(key); };
const sp = (t, t0, cfg = SPRING.snappy) => M.spring(t - t0, cfg);
const io = (t, a, d, ease = E.outCubic) => ease(prog(t, a, a + d));
const alpha = (ctx, a, fn) => { if (a <= 0.002) return; ctx.save(); ctx.globalAlpha *= clamp(a); fn(); ctx.restore(); };
const sceneAt = (t) => { for (let i = SC.length - 1; i >= 0; i--) if (t >= SC[i].start) return i; return 0; };

// ------------------------------------------------------------------ drawing helpers
function measure(ctx, str, f, track = 0) { ctx.font = f; ctx.letterSpacing = `${track}px`; const w = ctx.measureText(str).width; ctx.letterSpacing = '0px'; return w; }
function txt(ctx, str, x, y, f, color, align = 'left', track = 0) {
  ctx.font = f; ctx.fillStyle = color; ctx.textAlign = align; ctx.letterSpacing = `${track}px`;
  ctx.fillText(str, x, y); ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
}
function grad(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
const BRAND = (ctx, x0, x1, y = 0) => grad(ctx, x0, y, x1, y, [[0, C.cyan], [0.5, C.blue], [1, C.violet]]);
function scaleAt(ctx, k, x, y) { ctx.translate(x, y); ctx.scale(k, k); ctx.translate(-x, -y); }
function panel(ctx, x, y, w, h, r = 24, { fillc = C.panel, stroke = C.line, glow = 0, top = false } = {}) {
  if (glow > 0) { ctx.save(); ctx.shadowColor = rgba(C.cyan, 0.35 * glow); ctx.shadowBlur = 40 * glow; rrect(ctx, x, y, w, h, r); ctx.fillStyle = fillc; ctx.fill(); ctx.restore(); }
  rrect(ctx, x, y, w, h, r); ctx.fillStyle = fillc; ctx.fill();
  if (stroke) { ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke(); }
  if (top) { ctx.save(); rrect(ctx, x, y, w, h, r); ctx.clip(); ctx.fillStyle = grad(ctx, x, 0, x + w, 0, [[0, C.cyan], [0.55, C.violet], [1, C.orange]]); ctx.fillRect(x, y, w, 4); ctx.restore(); }
}
function check(ctx, x, y, s, k, color = C.cyan, lw = 0.17) {
  if (k <= 0) return;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = s * lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const p = [[x - s * 0.36, y + s * 0.02], [x - s * 0.1, y + s * 0.27], [x + s * 0.4, y - s * 0.3]];
  const L1 = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]), L2 = Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1]);
  const d = clamp(k) * (L1 + L2);
  ctx.beginPath(); ctx.moveTo(...p[0]);
  if (d <= L1) ctx.lineTo(lerp(p[0][0], p[1][0], d / L1), lerp(p[0][1], p[1][1], d / L1));
  else { ctx.lineTo(...p[1]); const q = (d - L1) / L2; ctx.lineTo(lerp(p[1][0], p[2][0], q), lerp(p[1][1], p[2][1], q)); }
  ctx.stroke(); ctx.restore();
}
function checkDot(ctx, x, y, r, k, col = C.cyan) {
  if (k <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.beginPath(); ctx.arc(0, 0, r, 0, M.TAU); ctx.fillStyle = col; ctx.fill(); ctx.restore();
  check(ctx, x, y, r * 1.05, prog(k, 0.4, 1), C.bg0, 0.2);
}
function spark(ctx, x, y, r, col = C.ink, rot = 0) {  // 4-point star
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, rr = i % 2 ? r * 0.28 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.restore();
}
function pill(ctx, label, x, y, k, { size = 26, bg = C.orange, fg = C.bg0, outline = false, f = null } = {}) {
  if (k <= 0.002) return 0;
  const ff = f || font(size, 800, UI), w = measure(ctx, label, ff, size * 0.04) + size * 1.3, h = size * 1.9;
  ctx.save(); scaleAt(ctx, k, x + w / 2, y);
  rrect(ctx, x, y - h / 2, w, h, h / 2);
  if (outline) { ctx.fillStyle = rgba(bg, 0.12); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = bg; ctx.stroke(); }
  else { ctx.fillStyle = bg; ctx.fill(); }
  txt(ctx, label, x + size * 0.65, y + size * 0.36, ff, outline ? bg : fg, 'left', size * 0.04);
  ctx.restore();
  return w;
}
const pillW = (ctx, label, size = 26) => measure(ctx, label, font(size, 800, UI), size * 0.04) + size * 1.3;
function wrapWords(ctx, words, f, maxW) {
  const lines = [[]]; let cur = 0; const sw = measure(ctx, ' ', f);
  words.forEach((w) => { const ww = measure(ctx, w, f); if (cur + ww > maxW && lines[lines.length - 1].length) { lines.push([]); cur = 0; } lines[lines.length - 1].push(w); cur += ww + sw; });
  return lines;
}
function typed(str, t, t0, cps = 38) { const n = Math.floor(clamp((t - t0) * cps, 0, str.length)); return str.slice(0, n); }

// ---- icons (plain pictograms, no official logos)
function iconFolder(ctx, x, y, s, col = C.orange) {
  ctx.save(); ctx.fillStyle = col;
  rrect(ctx, x, y + s * 0.12, s * 0.45, s * 0.2, s * 0.06); ctx.fill();
  rrect(ctx, x, y + s * 0.22, s, s * 0.7, s * 0.1); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; rrect(ctx, x, y + s * 0.3, s, s * 0.12, s * 0.04); ctx.fill(); ctx.restore();
}
function iconDoc(ctx, x, y, w, h, col, label, k = 1) {   // file tile with folded corner + big label
  const c = Math.min(w, h) * 0.24;
  ctx.save();
  ctx.beginPath(); ctx.moveTo(x + 14, y); ctx.lineTo(x + w - c, y); ctx.lineTo(x + w, y + c); ctx.lineTo(x + w, y + h - 14);
  ctx.quadraticCurveTo(x + w, y + h, x + w - 14, y + h); ctx.lineTo(x + 14, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - 14);
  ctx.lineTo(x, y + 14); ctx.quadraticCurveTo(x, y, x + 14, y); ctx.closePath();
  ctx.fillStyle = '#F4F7FF'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + w - c, y); ctx.lineTo(x + w - c, y + c * 0.85); ctx.quadraticCurveTo(x + w - c, y + c, x + w - c * 0.85, y + c); ctx.lineTo(x + w, y + c); ctx.closePath();
  ctx.fillStyle = '#C9D3EC'; ctx.fill();
  for (let i = 0; i < 3; i++) { ctx.fillStyle = '#D5DDF0'; rrect(ctx, x + w * 0.14, y + h * (0.24 + i * 0.1), w * (i === 2 ? 0.45 : 0.62), h * 0.045, 4); ctx.fill(); }
  rrect(ctx, x + w * 0.1, y + h * 0.6, w * 0.8, h * 0.27, 10); ctx.fillStyle = col; ctx.fill();
  const f = font(Math.min(w * 0.24, 56), 900, DISPLAY);
  txt(ctx, label, x + w / 2, y + h * 0.6 + h * 0.27 / 2 + Math.min(w * 0.24, 56) * 0.36, f, '#FFFFFF', 'center', 1);
  ctx.restore();
}
function iconPen(ctx, x, y, s, col = C.cyan) {
  ctx.save(); ctx.translate(x + s / 2, y + s / 2); ctx.rotate(-Math.PI / 4); ctx.fillStyle = col;
  rrect(ctx, -s * 0.12, -s * 0.45, s * 0.24, s * 0.68, s * 0.05); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-s * 0.12, s * 0.26); ctx.lineTo(s * 0.12, s * 0.26); ctx.lineTo(0, s * 0.47); ctx.closePath(); ctx.fill(); ctx.restore();
}
function iconTool(ctx, x, y, s, col = C.cyan) {
  ctx.save(); ctx.translate(x + s / 2, y + s / 2); ctx.rotate(Math.PI / 4); ctx.fillStyle = col;
  rrect(ctx, -s * 0.09, -s * 0.2, s * 0.18, s * 0.66, s * 0.06); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -s * 0.28, s * 0.22, 0, M.TAU); ctx.fill();
  ctx.globalCompositeOperation = 'destination-out'; rrect(ctx, -s * 0.07, -s * 0.56, s * 0.14, s * 0.26, 3); ctx.fill(); ctx.restore();
}
function iconSheet(ctx, x, y, s, col = C.cyan) {  // small doc glyph for list rows
  ctx.save(); ctx.fillStyle = col; rrect(ctx, x + s * 0.18, y + s * 0.05, s * 0.64, s * 0.9, s * 0.08); ctx.fill();
  ctx.fillStyle = C.bg0; for (let i = 0; i < 3; i++) { rrect(ctx, x + s * 0.3, y + s * (0.3 + i * 0.18), s * 0.4, s * 0.07, 2); ctx.fill(); } ctx.restore();
}
function shield(ctx, x, y, s, k) {
  if (k <= 0) return;
  ctx.save(); scaleAt(ctx, k, x, y);
  const path = () => { ctx.beginPath(); ctx.moveTo(x, y - s * 0.55); ctx.bezierCurveTo(x + s * 0.3, y - s * 0.42, x + s * 0.42, y - s * 0.45, x + s * 0.46, y - s * 0.42);
    ctx.bezierCurveTo(x + s * 0.48, y + s * 0.1, x + s * 0.3, y + s * 0.42, x, y + s * 0.58); ctx.bezierCurveTo(x - s * 0.3, y + s * 0.42, x - s * 0.48, y + s * 0.1, x - s * 0.46, y - s * 0.42);
    ctx.bezierCurveTo(x - s * 0.42, y - s * 0.45, x - s * 0.3, y - s * 0.42, x, y - s * 0.55); ctx.closePath(); };
  ctx.shadowColor = rgba(C.green, 0.6); ctx.shadowBlur = 50; path(); ctx.fillStyle = grad(ctx, x, y - s * 0.6, x, y + s * 0.6, [[0, '#34E8A0'], [1, '#0E9F6A']]); ctx.fill();
  ctx.shadowBlur = 0; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.stroke();
  check(ctx, x, y + s * 0.02, s * 0.5, prog(k, 0.5, 1), '#FFFFFF', 0.2);
  ctx.restore();
}
function jumotaMark(ctx, x, y, s) {  // rounded square, gradient, "J"
  ctx.save(); rrect(ctx, x, y, s, s, s * 0.28); ctx.fillStyle = grad(ctx, x, y, x + s, y + s, [[0, C.blue], [1, C.cyan]]); ctx.fill();
  txt(ctx, 'J', x + s / 2, y + s * 0.74, font(s * 0.7, 900, DISPLAY), '#FFFFFF', 'center'); ctx.restore();
}

// ------------------------------------------------------------------ background
function background(ctx, t) {
  ctx.fillStyle = grad(ctx, 0, 0, 0, H, [[0, C.bg1], [0.55, C.bg0], [1, '#090A22']]); ctx.fillRect(0, 0, W, H);
  const glow = (x, y, r, col, a) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); };
  glow(W * (0.85 + 0.06 * noise1(t * 0.07, 2)), H * (0.78 + 0.04 * noise1(t * 0.05, 3)), 900, C.violet, 0.30);
  glow(W * (0.1 + 0.06 * noise1(t * 0.06, 4)), H * (0.22 + 0.03 * noise1(t * 0.05, 5)), 760, C.blue, 0.22);
  glow(W * 0.5, H * 0.46, 620, C.cyan, 0.05);
  // dot grid, drifting slowly upward
  ctx.fillStyle = 'rgba(140,170,255,0.07)';
  const off = (t * 6) % 54;
  for (let y = -54; y < H + 54; y += 54) for (let x = 27; x < W; x += 54) ctx.fillRect(x, y - off, 3, 3);
}

// ------------------------------------------------------------------ header: chapter counter + progress segments
function header(ctx, t) {
  const i = sceneAt(t), S = SC[i];
  const k = 1;
  const y = 128;
  txt(ctx, String(i + 1).padStart(2, '0'), X0, y, font(26, 700, MONO), C.cyan);
  txt(ctx, `/ 07   ${S.chapter}`, X0 + 40, y, font(26, 700, MONO), C.mute, 'left', 1);
  jumotaMark(ctx, W - X0 - 52, y - 40, 52);
  // segments
  const n = SC.length, gap = 10, sw = (XW - gap * (n - 1)) / n, by = 158;
  for (let j = 0; j < n; j++) {
    const x = X0 + j * (sw + gap);
    rrect(ctx, x, by, sw, 6, 3); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
    const p = j < i ? 1 : j > i ? 0 : clamp((t - SC[j].start) / (SC[j].end - SC[j].start));
    if (p > 0) { rrect(ctx, x, by, sw * p, 6, 3); ctx.fillStyle = BRAND(ctx, x, x + sw); ctx.fill(); }
  }
  return k;
}

// ------------------------------------------------------------------ captions: current chunk, word by word
function captions(ctx, t) {
  const i = sceneAt(t);
  for (const S of [SC[i]]) {
    let ci = -1;
    S.chunks.forEach(([a], j) => { if (t >= S.words[a].t0 - 0.12) ci = j; });
    if (ci < 0) continue;
    const [a, b] = S.chunks[ci];
    const words = S.words.slice(a, b + 1);
    const fKey = font(66, 800, UI), fN = font(66, 600, UI);
    // layout with the wider (key) face so nothing reflows mid-chunk
    const lines = wrapWords(ctx, words.map((w) => w.w), fKey, XW - 40);
    const lh = 82;
    const top = CAP_Y + (lines.length === 1 ? lh * 0.5 : 0);
    const sceneOut = E.inCubic(prog(t, S.end - 0.25, S.end));
    let wi = 0;
    lines.forEach((line, li) => {
      const ws = line.map((s) => measure(ctx, s, fKey));
      const sw = measure(ctx, ' ', fKey);
      const tot = ws.reduce((p, q) => p + q, 0) + sw * (line.length - 1);
      let x = W / 2 - tot / 2;
      const y = top + 60 + li * lh;
      line.forEach((s, j) => {
        const w = words[wi++];
        const k = sp(t, w.t0 - 0.06, SPRING.snappy);
        if (k > 0.001) {
          const said = clamp((t - w.t0) / 0.18);
          const col = w.key ? C.ink : M.mix(C.dim, C.mute, said);
          alpha(ctx, clamp(k * 1.4) * (1 - sceneOut), () => {
            txt(ctx, s, x, y + (1 - k) * 26, w.key ? fKey : fN, col);
            if (w.key) {
              const ul = io(t, w.t0 + 0.05, 0.25);
              if (ul > 0) { const uw = measure(ctx, s.replace(/[\s ]*[?:!;,.…]+["»]?$/, ''), fKey); rrect(ctx, x, y + 14, uw * ul, 6, 3); ctx.fillStyle = BRAND(ctx, x, x + uw); ctx.fill(); }
            }
          });
        }
        x += ws[j] + sw;
      });
    });
    // one spark on the chunk's first key word
    const kw = words.find((w) => w.key);
    if (kw) {
      // position: recompute where it sits
      let idx = words.indexOf(kw), wi2 = 0, pos = null;
      lines.forEach((line, li) => {
        const ws = line.map((s) => measure(ctx, s, fKey)); const sw = measure(ctx, ' ', fKey);
        const tot = ws.reduce((p, q) => p + q, 0) + sw * (line.length - 1); let x = W / 2 - tot / 2;
        line.forEach((s, j) => { if (wi2 === idx) pos = [x + measure(ctx, s.replace(/[\s ]*[?:!;,.…]+["»]?$/, ''), fKey) + 14, top + 60 + li * lh - 50]; x += ws[j] + sw; wi2++; });
      });
      const k = sp(t, kw.t0 + 0.1, SPRING.bouncy);
      if (pos && k > 0) alpha(ctx, 1 - sceneOut, () => spark(ctx, pos[0], pos[1], 15 * k, C.cyan, (t - kw.t0) * 1.5));
    }
  }
}

// ------------------------------------------------------------------ console
// lines: [time, kind, text]; kinds: '>' command, 'ok', '!' warning, '.' info
const LOG = [];
function log(t, kind, text) { LOG.push([t, kind, text]); }
function consoleBox(ctx, t) {
  const x = X0, y = CON_Y, w = XW, h = CON_H;
  panel(ctx, x, y, w, h, 22, { fillc: 'rgba(7,14,34,0.94)', stroke: '#1C2D5A', top: true });
  // title row
  jumotaMark(ctx, x + 26, y + 26, 30);
  txt(ctx, 'JUMOTA CONSOLE', x + 70, y + 49, font(22, 700, MONO), C.mute, 'left', 2);
  for (let i = 0; i < 5; i++) { const on = 0.5 + 0.5 * noise1(t * 1.3 + i * 0.7, 9) > 0.35 || i < 3; rrect(ctx, x + w - 190 + i * 12, y + 50 - (i + 1) * 5, 8, (i + 1) * 5, 1); ctx.fillStyle = on ? C.cyan : C.faint; ctx.fill(); }
  txt(ctx, `CH.${String(sceneAt(t) + 1).padStart(2, '0')}`, x + w - 26, y + 49, font(20, 700, MONO), C.dim, 'right', 1);
  ctx.fillStyle = '#16264D'; ctx.fillRect(x + 20, y + 72, w - 40, 2);
  // last 5 lines, newest at the bottom, each types in
  const shown = LOG.filter((l) => l[0] <= t);
  const last = shown.slice(-5);
  const lh = 44, base = y + 118;
  // scroll: when a new line arrives the stack eases up one row
  const newest = shown.length ? shown[shown.length - 1][0] : -9;
  const sc = shown.length > 5 ? 1 - io(t, newest, 0.22) : 0;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y + 76, w, h - 80); ctx.clip();
  last.forEach(([t0, kind, s], j) => {
    const yy = base + (j + sc) * lh;
    const k = io(t, t0, 0.18);
    const col = kind === 'ok' ? C.cyan : kind === '!' ? C.orange : kind === '>' ? C.ink : C.dim;
    alpha(ctx, k, () => {
      if (kind === 'ok') check(ctx, x + 40, yy - 8, 22, io(t, t0, 0.2), C.cyan, 0.2);
      else txt(ctx, kind === '.' ? '·' : kind, x + 40, yy, font(26, 700, MONO), col, 'center');
      const str = typed(s, t, t0, 60);
      txt(ctx, str, x + 68, yy, font(25, kind === '>' ? 700 : 400, MONO), kind === '.' ? C.mute : kind === '!' ? C.orange : '#DDE6FF');
      if (str.length < s.length || (j === last.length - 1 && t - t0 < 1.2 && Math.floor(t * 3) % 2 === 0)) {
        const cw = measure(ctx, str, font(25, 400, MONO)); ctx.fillStyle = C.cyan; ctx.fillRect(x + 72 + cw, yy - 22, 13, 26);
      }
    });
  });
  ctx.restore();
}

// ------------------------------------------------------------------ skill header (badge, gradient title, credit line)
function skillHeader(ctx, t, S, n, title, credit, tTitle) {
  const y = STAGE_Y + 34;
  const kb = sp(t, S.start + 0.3, SPRING.bouncy);
  if (kb > 0) {
    ctx.save(); scaleAt(ctx, kb, X0 + 50, y);
    rrect(ctx, X0, y - 30, 100, 60, 30); ctx.fillStyle = BRAND(ctx, X0, X0 + 100); ctx.fill();
    txt(ctx, `${n}/3`, X0 + 50, y + 12, font(32, 900, DISPLAY), '#FFFFFF', 'center');
    ctx.restore();
  }
  // title glyphs drop in one by one
  const size = Math.min(132, Math.floor(132 * (XW - 10) / measure(ctx, title, font(132, 900, DISPLAY), -3)));
  const f = font(size, 900, DISPLAY), L = M.layout(ctx, title, f, -0.025 * size);
  const ty = y + 60 + size * 0.86;
  ctx.save(); ctx.beginPath(); ctx.rect(0, ty - size * 1.05, W, size * 1.32); ctx.clip();
  const g = BRAND(ctx, X0, X0 + L.width);
  L.glyphs.forEach((gl, j) => {
    const k = sp(t, tTitle + j * 0.025, SPRING.snappy);
    if (k <= 0) return;
    ctx.font = f; ctx.textAlign = 'center'; ctx.fillStyle = g;
    ctx.fillText(gl.ch, X0 + gl.cx, ty + (1 - k) * size * 1.1); ctx.textAlign = 'left';
  });
  ctx.restore();
  const kc = io(t, tTitle + 0.25, 0.4);
  alpha(ctx, kc, () => txt(ctx, credit, X0 + 4 + (1 - kc) * 30, ty + 52, font(24, 700, MONO), C.mute, 'left', 3));
  return ty + 80;   // bottom of the header block
}

// ------------------------------------------------------------------ scenes
// Each scene draws its stage only. Entrance/exit is handled in draw() (whip left between scenes).

// S0 hook: giant "3" + stacked title; zoom-in punch; then the "potential" gauge stuck at 20 %
const S0 = SC[0];
log(S0.start + 0.5, '>', 'claude --skills');
log(A(S0, 'skills'), '.', 'skills installées : 0');
log(A(S0, 'vrai'), '!', 'potentiel utilisé : 20 %');
function scene0(ctx, t) {
  const S = S0;
  const z = 1.18 * (1 / 1.18) ** E.outCubic(prog(t, 0, 1.1));     // log-space punch-in
  ctx.save(); scaleAt(ctx, z, W / 2, 820);
  // the 3
  const k3 = sp(t, -0.05, SPRING.bouncy);
  const f3 = font(640, 900, DISPLAY);
  ctx.save(); ctx.translate(300, 1080); ctx.scale(k3, k3); ctx.translate(-300, -1080);
  ctx.shadowColor = rgba(C.violet, 0.75); ctx.shadowBlur = 80;
  ctx.font = f3; ctx.textAlign = 'center'; ctx.fillStyle = grad(ctx, 0, 560, 0, 1080, [[0, C.cyan], [0.5, C.violet], [1, C.pink]]);
  ctx.fillText('3', 270, 1080); ctx.restore();
  // stacked words
  const words = [['SKILLS', C.ink, A(S, 'skills') - 1.5], ['CLAUDE', C.ink, 0.25], ['À INSTALLER', C.ink, 0.4]];
  words.forEach(([w, col, t0], j) => {
    const tt = j === 0 ? 0.1 : t0;
    const k = sp(t, tt, SPRING.snappy);
    const size = j === 2 ? 74 : 112;
    alpha(ctx, clamp(k * 1.5), () => txt(ctx, w, 520 + (1 - k) * 120, [680, 800, 892][j], font(size, 900, DISPLAY), col, 'left', -2));
  });
  // EN PREMIER in an orange box, slams
  const kp = sp(t, 0.6, SPRING.bouncy);
  if (kp > 0) {
    ctx.save(); scaleAt(ctx, kp, 745, 990);
    ctx.shadowColor = rgba(C.orange, 0.7); ctx.shadowBlur = 40;
    rrect(ctx, 510, 932, 470, 116, 18); ctx.fillStyle = C.orange; ctx.fill(); ctx.shadowBlur = 0;
    txt(ctx, 'EN PREMIER', 745, 1012, font(68, 900, DISPLAY), C.bg0, 'center', -1);
    ctx.restore();
  }
  // subtitle
  const ks = io(t, 0.9, 0.5);
  alpha(ctx, ks, () => {
    ctx.save(); ctx.shadowColor = rgba(C.cyan, 0.8); ctx.shadowBlur = 24;
    txt(ctx, 'GUIDE DÉBUTANT · GRATUIT', W / 2, 1180 + (1 - ks) * 30, font(60, 900, DISPLAY), C.cyan, 'center', 2); ctx.restore();
  });
  ctx.restore();
  // potential gauge: 'tu passes à côté de son vrai potentiel'
  const tg = A(S, 'alors');
  const kg = sp(t, tg, SPRING.snappy);
  if (kg > 0) alpha(ctx, clamp(kg * 1.4), () => {
    const y = 1222 + (1 - kg) * 30;
    txt(ctx, 'POTENTIEL UTILISÉ', X0 + 10, y, font(24, 700, MONO), C.mute, 'left', 2);
    const fillp = 0.2 * E.outCubic(prog(t, A(S, 'potentiel') - 0.3, A(S, 'potentiel') + 0.4));
    const shake = Math.sin(t * 60) * 3 * Math.max(0, 1 - Math.abs(t - A(S, 'potentiel') - 0.5) * 3);
    txt(ctx, `${Math.round(fillp * 100)} %`, W - X0 - 10 + shake, y, font(30, 900, DISPLAY), C.orange, 'right');
    rrect(ctx, X0 + 10, y + 18, XW - 20, 16, 8); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill();
    if (fillp > 0) { rrect(ctx, X0 + 10, y + 18, (XW - 20) * fillp, 16, 8); ctx.fillStyle = grad(ctx, X0, 0, X0 + XW * 0.2, 0, [[0, C.red], [1, C.orange]]); ctx.fill(); }
  });
}

// S1 what is a skill: folder card plugs into Claude, 3 identical results, then the list of three
const S1 = SC[1];
const S1B = A(S1, 'voici');
log(A(S1, 'skill'), '>', 'open humanizer/SKILL.md');
log(A(S1, 'apprend'), 'ok', 'module branché sur Claude');
log(A(S1, 'bien'), 'ok', 'même résultat × 3');
log(S1B, '>', 'claude skills install --premier 3');
log(A(S1, 'trois') + 0.25, 'ok', 'humanizer · trouvé');
log(A(S1, 'installer') + 0.1, 'ok', 'skills-documents · trouvé');
log(A(S1, 'premier') + 0.1, 'ok', 'skill-creator · trouvé');
function claudeNode(ctx, x, y, w, h, k, pulse) {
  if (k <= 0) return;
  ctx.save(); scaleAt(ctx, k, x + w / 2, y + h / 2);
  panel(ctx, x, y, w, h, 30, { fillc: '#101F46', stroke: M.mix('#2A4380', C.cyan, pulse), glow: 0.5 + pulse });
  spark(ctx, x + 66, y + h / 2, 32, C.orange, 0);
  txt(ctx, 'Claude', x + 112, y + h / 2 + 18, font(54, 800, UI), C.ink);
  ctx.restore();
}
function scene1(ctx, t) {
  const S = S1;
  // phase A (until 'Voici')
  const outA = E.inCubic(prog(t, S1B - 0.35, S1B));
  if (outA < 1) alpha(ctx, 1 - outA, () => {
    ctx.save(); ctx.translate(0, -outA * 120);
    const t0 = A(S, 'skill'), tPlug = A(S, 'apprend'), tNode = A(S, 'module');
    // Claude node on the right
    const pulse = Math.max(0, 1 - (t - tPlug - 0.3) * 1.5) * (t > tPlug + 0.3 ? 1 : 0);
    claudeNode(ctx, 600, 560, 400, 170, sp(t, S.start + 0.02, SPRING.bouncy), pulse);
    // folder card slides in, then plugs into the node
    const kc = sp(t, S.start + 0.12, SPRING.snappy);
    const plug = sp(t, tPlug, SPRING.gentle);
    const cx = lerp(lerp(-460, 80, kc), 190, plug), cy = 540;
    if (kc > 0) {
      ctx.save();
      // connector line
      if (plug > 0.05) { ctx.strokeStyle = rgba(C.cyan, 0.9); ctx.lineWidth = 6; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t * 60; ctx.beginPath(); ctx.moveTo(cx + 400, cy + 105); ctx.lineTo(600, 645); ctx.stroke(); ctx.setLineDash([]); }
      panel(ctx, cx, cy, 400, 210, 22, { fillc: '#0E1D40', stroke: '#2D4A8A' });
      iconFolder(ctx, cx + 28, cy + 26, 54);
      txt(ctx, 'humanizer/', cx + 96, cy + 70, font(32, 700, MONO), C.ink);
      txt(ctx, 'SKILL.md', cx + 32, cy + 126, font(26, 400, MONO), C.cyan);
      for (let i = 0; i < 2; i++) { rrect(ctx, cx + 32, cy + 148 + i * 22, i ? 220 : 320, 10, 5); ctx.fillStyle = 'rgba(143,163,204,0.3)'; ctx.fill(); }
      // plug tab
      rrect(ctx, cx + 392, cy + 88, 26, 34, 6); ctx.fillStyle = C.cyan; ctx.fill();
      ctx.restore();
      alpha(ctx, io(t, tNode, 0.3), () => pill(ctx, 'SKILL = MODULE', cx + 6, cy - 36, 1, { size: 22, bg: C.cyan, outline: true }));
    }
    // task chip + 3 identical results
    const tTask = A(S, 'tache'), tSame = A(S, 'meme'), tGood = A(S, 'bien');
    const kt = sp(t, tTask, SPRING.bouncy);
    if (kt > 0) { const lbl = 'UNE TÂCHE PRÉCISE'; pill(ctx, lbl, W / 2 - pillW(ctx, lbl, 30) / 2, 850, kt, { size: 30, bg: C.orange }); }
    for (let i = 0; i < 3; i++) {
      const k = sp(t, tSame + i * 0.16, SPRING.snappy);
      if (k <= 0) continue;
      const x = X0 + 20 + i * 312, y = 930;
      alpha(ctx, clamp(k * 1.5), () => {
        ctx.save(); ctx.translate(0, (1 - k) * 60);
        panel(ctx, x, y, 286, 200, 20, { fillc: '#0E1D40', stroke: '#2A4380' });
        txt(ctx, `RÉSULTAT ${i + 1}`, x + 24, y + 44, font(20, 700, MONO), C.mute, 'left', 2);
        for (let r = 0; r < 3; r++) { rrect(ctx, x + 24, y + 70 + r * 26, [200, 230, 150][r], 12, 6); ctx.fillStyle = rgba(C.cyan, 0.35); ctx.fill(); }
        checkDot(ctx, x + 243, y + 160, 24, sp(t, tGood + i * 0.12, SPRING.bouncy), C.cyan);
        ctx.restore();
      });
    }
    ctx.restore();
  });
  // phase B: the list card
  const kB = sp(t, S1B - 0.05, SPRING.snappy);
  if (kB > 0) alpha(ctx, clamp(kB * 1.5), () => {
    ctx.save(); ctx.translate(0, (1 - kB) * 140);
    const lbl = '3 SKILLS À INSTALLER EN PREMIER';
    const pw = pillW(ctx, lbl, 30);
    const cardY = 600, cardH = 560;
    panel(ctx, X0 + 40, cardY, XW - 80, cardH, 28, { fillc: '#0D1B3E', stroke: '#2D4A8A', glow: 0.6 });
    pill(ctx, lbl, W / 2 - pw / 2, cardY - 4, 1, { size: 30, bg: C.orange });
    txt(ctx, 'Claude', X0 + 80, cardY + 92, font(44, 800, UI), C.ink);
    txt(ctx, 'SKILLS · 3', XW + X0 - 80, cardY + 90, font(22, 700, MONO), C.mute, 'right', 3);
    const rows = [['HUMANIZER', iconPen, A(S, 'trois')], ['SKILLS DOCUMENTS', iconSheet, A(S, 'installer')], ['SKILL CREATOR', iconTool, A(S, 'premier')]];
    rows.forEach(([name, icon, t0], j) => {
      const k = sp(t, t0, SPRING.bouncy);
      if (k <= 0) return;
      const y = cardY + 130 + j * 108, x = X0 + 80, w = XW - 160;
      ctx.save(); scaleAt(ctx, lerp(0.85, 1, clamp(k)), x + w / 2, y + 44); ctx.globalAlpha *= clamp(k * 2);
      panel(ctx, x, y, w, 88, 18, { fillc: '#0B2148', stroke: C.cyan });
      icon(ctx, x + 26, y + 20, 48, C.cyan);
      txt(ctx, name, x + 100, y + 58, font(40, 900, DISPLAY), C.ink, 'left', 0);
      checkDot(ctx, x + w - 46, y + 44, 22, sp(t, t0 + 0.3, SPRING.bouncy));
      ctx.restore();
    });
    // usefulness gauge: basique -> utile
    const tg = A(S, 'debutes');
    const gp = lerp(0.12, 1, E.outCubic(prog(t, tg - 0.2, tg + 0.7)));
    const gx = X0 + 80, gy = cardY + cardH - 70, gw = XW - 160;
    rrect(ctx, gx, gy, gw, 14, 7); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill();
    rrect(ctx, gx, gy, gw * gp, 14, 7); ctx.fillStyle = grad(ctx, gx, 0, gx + gw, 0, [[0, C.orange], [0.5, C.violet], [1, C.cyan]]); ctx.fill();
    txt(ctx, 'BASIQUE', gx, gy + 48, font(20, 700, MONO), C.dim, 'left', 2);
    txt(ctx, 'UTILE', gx + gw, gy + 48, font(20, 700, MONO), gp > 0.95 ? C.cyan : C.dim, 'right', 2);
    ctx.restore();
  });
}

// S2 Humanizer: AI draft with tells highlighted, struck through, rewritten; use chips
const S2 = SC[2];
log(S2.start + 0.3, 'ok', 'skill 1/3 · humanizer');
log(A(S2, '"ia'), '!', '3 tics d\'IA détectés');
log(A(S2, 'reecrit'), '.', 'réécriture en cours…');
log(A(S2, 'naturel'), 'ok', 'ton : naturel');
log(A(S2, 'legendes'), 'ok', 'posts · e-mails · légendes');
function scene2(ctx, t) {
  const S = S2;
  const yb = skillHeader(ctx, t, S, 1, 'HUMANIZER', 'SKILL COMMUNAUTAIRE · GRATUITE', S.start + 0.05);
  const tCard = A(S, 'ton'), tIA = A(S, '"ia'), tRobot = A(S, 'robot'), tRw = A(S, 'reecrit'), tNat = A(S, 'naturel'), tMe = A(S, 'toi-meme');
  const kc = sp(t, tCard - 0.1, SPRING.snappy);
  if (kc <= 0) return;
  const x = X0, y = yb + 4, w = XW, h = 420;
  alpha(ctx, clamp(kc * 1.5), () => {
    ctx.save(); ctx.translate(0, (1 - kc) * 80);
    panel(ctx, x, y, w, h, 24, { fillc: '#0D1B3E', stroke: '#2A4380' });
    txt(ctx, 'BROUILLON IA', x + 32, y + 46, font(22, 700, MONO), C.mute, 'left', 3);
    // robot meter
    const kr = sp(t, tRobot, SPRING.bouncy), nat = io(t, tNat, 0.5);
    if (kr > 0) {
      const lbl = nat > 0.5 ? 'TON : NATUREL' : 'TON : ROBOT 92 %';
      const pw = pillW(ctx, lbl, 22);
      pill(ctx, lbl, x + w - 28 - pw, y + 38, kr, { size: 22, bg: nat > 0.5 ? C.cyan : C.orange });
    }
    // AI draft lines with tells
    const draft = [[['Dans un monde ', 0], ['en constante évolution,', 1]], [['il est ', 0], ['crucial', 1], [' de tirer parti', 0]], [['de ces ', 0], ['synergies innovantes.', 1]]];
    const f = font(36, 600, UI);
    const strike = io(t, tRw, 0.6, E.inOutCubic);
    draft.forEach((line, li) => {
      let xx = x + 32; const yy = y + 104 + li * 50;
      line.forEach(([s, tell], si) => {
        const sw = measure(ctx, s, f);
        if (tell) {
          const hk = io(t, tIA + 0.12 * (li + si * 0.3), 0.25);
          if (hk > 0) { rrect(ctx, xx - 6, yy - 34, (sw + 12) * hk, 46, 8); ctx.fillStyle = rgba(C.orange, 0.22); ctx.fill(); }
        }
        txt(ctx, s, xx, yy, f, M.mix('#C7D2EE', C.dim, strike), 'left');
        xx += sw;
      });
      const lw = measure(ctx, line.map((p) => p[0]).join(''), f);
      const sk = clamp(strike * 3 - li);
      if (sk > 0) { ctx.fillStyle = C.orange; ctx.fillRect(x + 28, yy - 12, (lw + 8) * sk, 4); }
    });
    // divider + humanized
    ctx.fillStyle = '#1E3366'; ctx.fillRect(x + 32, y + 250, w - 64, 2);
    const kh = io(t, tNat - 0.15, 0.3);
    alpha(ctx, kh, () => {
      txt(ctx, 'HUMANISÉ', x + 32, y + 290, font(22, 700, MONO), C.cyan, 'left', 3);
      const out = 'Bonne nouvelle : tu peux maintenant partager tes brouillons. Et c\'est gratuit.';
      const s = typed(out, t, tNat - 0.05, 34);
      const lines = wrapWords(ctx, s.split(' '), font(38, 800, UI), w - 64);
      lines.forEach((ln, i) => txt(ctx, ln.join(' '), x + 32, y + 342 + i * 50, font(38, 800, UI), C.ink));
    });
    const km = sp(t, tMe, SPRING.bouncy);
    if (km > 0) { ctx.save(); ctx.translate(x + w - 60, y + h - 8); ctx.rotate(-0.06); pill(ctx, 'ÉCRIT PAR TOI', -230, 0, km, { size: 22, bg: C.ink }); ctx.restore(); }
    ctx.restore();
  });
  // usage chips
  const chips = [['POSTS', A(S, 'posts')], ['E-MAILS', A(S, 'e-mails')], ['LÉGENDES', A(S, 'legendes')]];
  const fsz = 30; const ws = chips.map(([l]) => pillW(ctx, l, fsz)); const tot = ws.reduce((a, b) => a + b, 0) + 24 * 2;
  let cx = W / 2 - tot / 2;
  chips.forEach(([l, t0], i) => { pill(ctx, l, cx, y + h + 46, sp(t, t0, SPRING.bouncy), { size: fsz, bg: C.cyan, outline: true }); cx += ws[i] + 24; });
}

// S3 document skills: plain text bubble -> 4 real files -> download
const S3 = SC[3];
log(S3.start + 0.3, 'ok', 'skill 2/3 · skills-documents');
log(A(S3, 'texte'), '.', 'sortie : texte brut');
log(A(S3, 'word'), 'ok', 'rapport.docx créé');
log(A(S3, 'pdf'), 'ok', 'rapport.pdf créé');
log(A(S3, 'presentations'), 'ok', 'pitch.pptx créé');
log(A(S3, 'tableurs'), 'ok', 'budget.xlsx créé');
log(A(S3, 'telecharger'), 'ok', '4 fichiers prêts à télécharger');
function scene3(ctx, t) {
  const S = S3;
  const yb = skillHeader(ctx, t, S, 2, 'SKILLS DOCUMENTS', 'PAR ANTHROPIC · OFFICIELLES', S.start + 0.05);
  const tTxt = A(S, 'avec'), tFiles = A(S, 'vrais');
  // the old way: a text bubble, then crossed out and dropped
  const kb = sp(t, tTxt, SPRING.snappy), drop = E.inCubic(prog(t, tFiles - 0.1, tFiles + 0.35));
  if (kb > 0 && drop < 1) alpha(ctx, clamp(kb * 1.5) * (1 - drop), () => {
    const x = X0 + 60, y = yb + 30 + drop * 200, w = XW - 120, h = 300;
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(drop * 0.12); ctx.translate(-(x + w / 2), -(y + h / 2));
    panel(ctx, x, y, w, h, 28, { fillc: '#13244D', stroke: '#2A4380' });
    txt(ctx, 'AVANT : DU TEXTE', x + 32, y + 50, font(22, 700, MONO), C.mute, 'left', 3);
    for (let i = 0; i < 5; i++) { rrect(ctx, x + 32, y + 86 + i * 38, [w - 90, w - 150, w - 70, w - 200, w * 0.4][i], 16, 8); ctx.fillStyle = 'rgba(143,163,204,0.32)'; ctx.fill(); }
    const kx = io(t, A(S, 'texte') + 0.2, 0.3);
    if (kx > 0) { ctx.strokeStyle = C.orange; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 30, y + h - 30); ctx.lineTo(x + 30 + (w - 60) * kx, y + h - 30 - (h - 60) * kx); ctx.stroke(); }
    ctx.restore();
  });
  // files
  const files = [['DOCX', '#2B6CFF', 'Word', A(S, 'word')], ['PDF', '#FF4D5E', 'PDF', A(S, 'pdf')], ['PPTX', '#FF8A1F', 'Présentation', A(S, 'presentations')], ['XLSX', '#22C27A', 'Tableur', A(S, 'tableurs')]];
  const tw = 204, gap = (XW - tw * 4) / 3, ty = yb + 40, th = 262;
  const tDl = A(S, 'telecharger');
  files.forEach(([lbl, col, name, t0], i) => {
    const k = sp(t, t0 - 0.05, SPRING.bouncy);
    if (k <= 0) return;
    const x = X0 + i * (tw + gap);
    const hop = Math.max(0, Math.sin(Math.PI * clamp((t - tDl - i * 0.08) / 0.35))) * 22;
    ctx.save(); ctx.translate(x + tw / 2, ty + th); ctx.scale(k, k); ctx.translate(-(x + tw / 2), -(ty + th));
    ctx.translate(0, -hop);
    ctx.shadowColor = rgba(col, 0.55); ctx.shadowBlur = 40; iconDoc(ctx, x, ty, tw, th, col, lbl); ctx.shadowBlur = 0;
    txt(ctx, name, x + tw / 2, ty + th + 46, font(28, 700, UI), C.ink, 'center');
    checkDot(ctx, x + tw - 8, ty + 8, 22, sp(t, tDl + 0.15 + i * 0.08, SPRING.bouncy), C.green);
    ctx.restore();
  });
  // download button
  const kd = sp(t, tDl - 0.1, SPRING.bouncy);
  if (kd > 0) {
    const bw = 720, bh = 104, bx = W / 2 - bw / 2, by = ty + th + 100;
    ctx.save(); scaleAt(ctx, kd, W / 2, by + bh / 2);
    ctx.shadowColor = rgba(C.cyan, 0.6); ctx.shadowBlur = 40;
    rrect(ctx, bx, by, bw, bh, bh / 2); ctx.fillStyle = BRAND(ctx, bx, bx + bw); ctx.fill(); ctx.shadowBlur = 0;
    // arrow
    const ax = bx + 78, ay = by + bh / 2, bob = Math.sin((t - tDl) * 8) * 4;
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(ax, ay - 24 + bob); ctx.lineTo(ax, ay + 12 + bob); ctx.moveTo(ax - 15, ay - 2 + bob); ctx.lineTo(ax, ay + 13 + bob); ctx.lineTo(ax + 15, ay - 2 + bob);
    ctx.moveTo(ax - 22, ay + 26); ctx.lineTo(ax + 22, ay + 26); ctx.stroke();
    txt(ctx, 'PRÊTS À TÉLÉCHARGER', bx + 130, by + bh / 2 + 14, font(38, 900, DISPLAY), '#FFFFFF', 'left', 0);
    ctx.restore();
  }
}

// S4 Skill Creator: the same task three times -> described once -> its own one-click skill
const S4 = SC[4];
log(S4.start + 0.3, 'ok', 'skill 3/3 · skill-creator');
log(A(S4, 'meme'), '!', 'même tâche répétée × 3');
log(A(S4, 'decris-la'), '>', 'décris la tâche une fois…');
log(A(S4, 'propre'), 'ok', 'recap-hebdo/SKILL.md créé');
log(A(S4, 'volonte'), 'ok', 'réutilisable à volonté');
function scene4(ctx, t) {
  const S = S4;
  const yb = skillHeader(ctx, t, S, 3, 'SKILL CREATOR', 'PAR ANTHROPIC · CRÉE TES SKILLS', S.start + 0.05);
  const tRep = A(S, 'repetes'), tDesc = A(S, 'decris-la'), tOwn = A(S, 'propre'), tVol = A(S, 'volonte');
  // three stacked repeats
  const collapse = E.inOutCubic(prog(t, tDesc - 0.1, tDesc + 0.4));
  const days = ['LUNDI 6', 'LUNDI 13', 'LUNDI 20'];
  if (collapse < 1) for (let i = 2; i >= 0; i--) {
    const k = sp(t, tRep + i * 0.32, SPRING.bouncy);
    if (k <= 0) continue;
    const x = X0 + 30 + i * 22, y = lerp(yb + 20 + i * 132, yb + 20, collapse), w = XW - 60 - i * 44, h = 112;
    alpha(ctx, clamp(k * 1.5) * (1 - collapse), () => {
      ctx.save(); scaleAt(ctx, lerp(0.8, 1, clamp(k)), x + w / 2, y + h / 2);
      panel(ctx, x, y, w, h, 20, { fillc: '#0E1D40', stroke: '#2A4380' });
      txt(ctx, days[i], x + 28, y + 44, font(20, 700, MONO), C.mute, 'left', 3);
      txt(ctx, 'Notes → récap client', x + 28, y + 88, font(36, 700, UI), C.ink);
      pill(ctx, `× ${i + 1}`, x + w - 120, y + h / 2, sp(t, tRep + i * 0.32 + 0.15, SPRING.bouncy), { size: 30, bg: C.orange });
      ctx.restore();
    });
  }
  // described once: prompt box types
  const kp = sp(t, tDesc - 0.05, SPRING.snappy);
  const toSkill = E.inOutCubic(prog(t, tOwn - 0.25, tOwn + 0.25));
  if (kp > 0) alpha(ctx, clamp(kp * 1.5), () => {
    const x = X0, y = yb + 20, w = XW, h = 190;
    panel(ctx, x, y, w, h, 24, { fillc: '#0D1B3E', stroke: M.mix('#2A4380', C.cyan, 0.6), glow: 0.4 });
    txt(ctx, 'DÉCRIS LA TÂCHE UNE FOIS', x + 30, y + 48, font(22, 700, MONO), C.cyan, 'left', 3);
    const str = 'Chaque lundi, je transforme mes notes en récap client.';
    const s = typed(str, t, tDesc + 0.05, 30);
    const lines = wrapWords(ctx, s.split(' '), font(36, 600, UI), w - 60);
    lines.forEach((ln, i) => txt(ctx, ln.join(' '), x + 30, y + 104 + i * 46, font(36, 600, UI), C.ink));
    if (s.length < str.length || Math.floor(t * 3) % 2 === 0) {
      const last = lines[lines.length - 1].join(' '); const cw = measure(ctx, last, font(36, 600, UI));
      ctx.fillStyle = C.cyan; ctx.fillRect(x + 34 + cw, y + 74 + (lines.length - 1) * 46, 4, 40);
    }
  });
  // arrow down + the skill: folder card + one-click button
  if (toSkill > 0) {
    const y0 = yb + 240;
    const ka = toSkill;
    ctx.strokeStyle = C.cyan; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(W / 2, y0); ctx.lineTo(W / 2, y0 + 50 * ka); ctx.stroke();
    if (ka > 0.9) { ctx.beginPath(); ctx.moveTo(W / 2 - 16, y0 + 36); ctx.lineTo(W / 2, y0 + 52); ctx.lineTo(W / 2 + 16, y0 + 36); ctx.stroke(); }
    const kf = sp(t, tOwn, SPRING.bouncy);
    if (kf > 0) {
      const x = X0 + 30, y = y0 + 76, w = 430, h = 180;
      ctx.save(); scaleAt(ctx, kf, x + w / 2, y + h / 2);
      panel(ctx, x, y, w, h, 22, { fillc: '#0E1D40', stroke: C.orange, glow: 0.3 });
      iconFolder(ctx, x + 26, y + 26, 54);
      txt(ctx, 'recap-hebdo/', x + 94, y + 68, font(31, 700, MONO), C.ink);
      txt(ctx, 'SKILL.md', x + 30, y + 124, font(26, 400, MONO), C.cyan);
      pill(ctx, 'TA SKILL', x + 30, y + 156, 1, { size: 18, bg: C.orange });
      ctx.restore();
    }
    const kb = sp(t, tOwn + 0.45, SPRING.bouncy);
    if (kb > 0) {
      const bx = X0 + 500, by = y0 + 104, bw = XW - 530, bh = 124;
      const press = Math.max(0, ...[0, 1, 2].map((i) => Math.sin(Math.PI * clamp((t - tVol - i * 0.28) / 0.2))));
      ctx.save(); scaleAt(ctx, kb * (1 - 0.06 * press), bx + bw / 2, by + bh / 2);
      ctx.shadowColor = rgba(C.cyan, 0.6 + 0.4 * press); ctx.shadowBlur = 40 + 30 * press;
      rrect(ctx, bx, by, bw, bh, 30); ctx.fillStyle = BRAND(ctx, bx, bx + bw); ctx.fill(); ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.moveTo(bx + 46, by + 38); ctx.lineTo(bx + 46, by + 86); ctx.lineTo(bx + 84, by + 62); ctx.closePath(); ctx.fillStyle = '#FFFFFF'; ctx.fill();
      txt(ctx, 'Récap hebdo', bx + 108, by + 76, font(38, 800, UI), '#FFFFFF');
      ctx.restore();
      const kv = sp(t, tVol, SPRING.bouncy);
      if (kv > 0) { const lbl = 'RÉUTILISABLE À VOLONTÉ'; pill(ctx, lbl, bx + bw / 2 - pillW(ctx, lbl, 22) / 2, by + bh + 40, kv, { size: 22, bg: C.cyan, outline: true }); }
    }
  }
}

// S5 activation + golden rule
const S5 = SC[5];
log(A(S5, 'parametres'), '>', 'claude.ai / paramètres / skills');
log(A(S5, 'claude.ai') + 0.4, 'ok', 'skill activée');
log(A(S5, 'code'), '>', 'ls ~/.claude/skills/');
log(A(S5, 'regle'), '!', 'règle d\'or');
log(A(S5, 'fiables'), 'ok', 'source vérifiée');
log(A(S5, 'lis'), 'ok', 'SKILL.md lu');
log(A(S5, 'activer', 1), 'ok', 'activation sûre');
function scene5(ctx, t) {
  const S = S5;
  const tRule = A(S, 'regle');
  const up = E.inOutCubic(prog(t, tRule - 0.2, tRule + 0.3));
  // two panels: Claude.ai settings path + toggle, Claude Code folder path
  const pA = sp(t, S.start + 0.15, SPRING.snappy), pB = sp(t, A(S, 'code') - 0.2, SPRING.snappy);
  const y0 = STAGE_Y + 20;
  const sc = lerp(1, 0.86, up), shift = up * -12;
  ctx.save(); scaleAt(ctx, sc, W / 2, y0); ctx.translate(0, shift);
  if (pA > 0) alpha(ctx, clamp(pA * 1.5) * lerp(1, 0.75, up), () => {
    const x = X0, y = y0 + (1 - pA) * 60, w = XW, h = 170;
    panel(ctx, x, y, w, h, 24, { fillc: '#0D1B3E', stroke: '#2A4380' });
    txt(ctx, 'CLAUDE.AI', x + 30, y + 50, font(24, 700, MONO), C.cyan, 'left', 3);
    txt(ctx, 'Paramètres › Capacités › Skills', x + 30, y + 118, font(38, 700, UI), C.ink);
    // toggle
    const on = io(t, A(S, 'claude.ai') + 0.2, 0.3);
    const tx = x + w - 150, ty = y + 92;
    rrect(ctx, tx, ty - 30, 110, 60, 30); ctx.fillStyle = M.mix('#2A3B66', C.green, on); ctx.fill();
    ctx.beginPath(); ctx.arc(tx + 30 + 50 * on, ty, 23, 0, M.TAU); ctx.fillStyle = '#FFFFFF'; ctx.fill();
  });
  if (pB > 0) alpha(ctx, clamp(pB * 1.5) * lerp(1, 0.75, up), () => {
    const x = X0, y = y0 + 200 + (1 - pB) * 60, w = XW, h = 170;
    panel(ctx, x, y, w, h, 24, { fillc: '#081127', stroke: '#2A4380' });
    txt(ctx, 'CLAUDE CODE', x + 30, y + 50, font(24, 700, MONO), C.cyan, 'left', 3);
    const s = typed('~/.claude/skills/humanizer/', t, A(S, 'code'), 34);
    txt(ctx, '$', x + 30, y + 116, font(36, 700, MONO), C.green);
    txt(ctx, s, x + 70, y + 116, font(36, 700, MONO), C.ink);
  });
  ctx.restore();
  // golden rule: shield + 3 checks
  if (up > 0) {
    const y = y0 + 350;
    const ks = sp(t, tRule - 0.05, SPRING.bouncy);
    alpha(ctx, clamp(up * 1.5), () => {
      panel(ctx, X0, y, XW, 440, 28, { fillc: 'rgba(10,30,40,0.92)', stroke: rgba(C.green, 0.6), glow: 0.2 });
      shield(ctx, X0 + 150, y + 220, 200, ks);
      pill(ctx, 'RÈGLE D\'OR', X0 + 300, y + 70, sp(t, tRule, SPRING.bouncy), { size: 30, bg: C.orange });
      const items = [['Sources fiables uniquement', A(S, 'fiables')], ['Lis le SKILL.md', A(S, 'lis')], ['Puis active', A(S, 'activer', 1)]];
      items.forEach(([s, t0], i) => {
        const k = sp(t, t0 - 0.05, SPRING.snappy);
        if (k <= 0) return;
        const yy = y + 168 + i * 96;
        alpha(ctx, clamp(k * 1.5), () => {
          checkDot(ctx, X0 + 326, yy - 12, 24, sp(t, t0 + 0.1, SPRING.bouncy), C.green);
          txt(ctx, s, X0 + 368 + (1 - k) * 40, yy, font(38, 800, UI), C.ink);
        });
      });
    });
  }
}

// S6 CTA: free PDF guide, comment "SKILLS", subscribe, end card
const S6 = SC[6];
log(A(S6, 'gratuit'), 'ok', 'guide-installation.pdf · gratuit');
log(A(S6, 'guide', 1), '>', 'commentaire : GUIDE');
log(A(S6, "t'envoie"), 'ok', 'PDF complet envoyé');
log(A(S6, 'abonne-toi'), '>', 'abonnement : Jumota Agency');
function pdfCover(ctx, x, y, w, h, t) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
  rrect(ctx, x, y, w, h, 18); ctx.fillStyle = grad(ctx, x, y, x + w, y + h, [[0, '#0B1A3C'], [0.6, '#1A1452'], [1, '#3A1670']]); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.stroke();
  ctx.save(); rrect(ctx, x, y, w, h, 18); ctx.clip();
  const g = ctx.createRadialGradient(x + w * 0.8, y + h * 0.2, 0, x + w * 0.8, y + h * 0.2, w); g.addColorStop(0, rgba(C.cyan, 0.35)); g.addColorStop(1, rgba(C.cyan, 0)); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.restore();
  pill(ctx, 'GUIDE GRATUIT', x + 30, y + 54, 1, { size: 20, bg: C.orange });
  ctx.font = font(250, 900, DISPLAY); ctx.textAlign = 'left'; ctx.fillStyle = grad(ctx, 0, y + 90, 0, y + 330, [[0, C.cyan], [0.5, C.violet], [1, C.pink]]); ctx.fillText('3', x + 24, y + 310);
  txt(ctx, 'SKILLS', x + 190, y + 190, font(54, 900, DISPLAY), '#FFFFFF');
  txt(ctx, 'CLAUDE', x + 190, y + 248, font(54, 900, DISPLAY), '#FFFFFF');
  txt(ctx, 'À INSTALLER EN PREMIER', x + 30, y + 382, font(28, 900, DISPLAY), C.cyan);
  txt(ctx, 'Activation · Commandes · Prompts', x + 30, y + 432, font(22, 600, UI), '#C7D2EE');
  txt(ctx, 'Checklist de sécurité', x + 30, y + 464, font(22, 600, UI), '#C7D2EE');
  jumotaMark(ctx, x + 30, y + h - 76, 44);
  txt(ctx, 'JUMOTA AGENCY', x + 88, y + h - 44, font(22, 800, UI), '#FFFFFF', 'left', 2);
  rrect(ctx, x + w - 96, y + h - 78, 66, 46, 8); ctx.fillStyle = C.red; ctx.fill();
  txt(ctx, 'PDF', x + w - 63, y + h - 46, font(22, 900, DISPLAY), '#FFFFFF', 'center');
  ctx.restore();
}
function scene6(ctx, t) {
  const S = S6;
  const tEnd = A(S, 'abonne-toi');
  const out = E.inCubic(prog(t, tEnd - 0.1, tEnd + 0.3));
  if (out < 1) alpha(ctx, 1 - out, () => {
    const kc = sp(t, S.start, SPRING.snappy);
    const x = X0 + 6, y = STAGE_Y + 30, w = 450, h = 620;
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(lerp(0.2, -0.05, kc)); ctx.scale(lerp(0.6, 1, kc), lerp(0.6, 1, kc)); ctx.translate(-(x + w / 2), -(y + h / 2));
    ctx.translate(-out * 300, 0);
    ctx.globalAlpha *= clamp(kc * 1.5);
    pdfCover(ctx, x, y, w, h, t);
    ctx.restore();
    // FREE stamp
    const kg = sp(t, A(S, 'gratuit'), SPRING.bouncy);
    if (kg > 0) {
      ctx.save(); ctx.translate(x + w - 30, y + 60); ctx.rotate(0.22); ctx.scale(lerp(2.2, 1, clamp(kg)), lerp(2.2, 1, clamp(kg))); ctx.globalAlpha *= clamp(kg * 2);
      rrect(ctx, -130, -46, 260, 92, 16); ctx.fillStyle = C.orange; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
      txt(ctx, 'GRATUIT', 0, 22, font(58, 900, DISPLAY), C.bg0, 'center'); ctx.restore();
    }
    // comment bubble
    const tc = A(S, 'ecris'), kb = sp(t, tc - 0.1, SPRING.bouncy);
    if (kb > 0) {
      const bx = X0 + 500, by = STAGE_Y + 430, bw = XW - 500, bh = 200;
      ctx.save(); scaleAt(ctx, kb, bx, by + bh);
      panel(ctx, bx, by, bw, bh, 26, { fillc: '#F4F7FF', stroke: null });
      ctx.beginPath(); ctx.moveTo(bx + 30, by + bh - 4); ctx.lineTo(bx + 10, by + bh + 34); ctx.lineTo(bx + 80, by + bh - 4); ctx.closePath(); ctx.fillStyle = '#F4F7FF'; ctx.fill();
      ctx.beginPath(); ctx.arc(bx + 54, by + 58, 28, 0, M.TAU); ctx.fillStyle = grad(ctx, bx + 26, by + 30, bx + 82, by + 86, [[0, C.violet], [1, C.cyan]]); ctx.fill();
      txt(ctx, 'Commentaire', bx + 96, by + 68, font(26, 700, UI), '#5B6A90');
      const s = typed('GUIDE', t, A(S, 'guide', 1) - 0.1, 14);
      txt(ctx, s, bx + 30, by + 158, font(66, 900, DISPLAY), C.bg0, 'left', 2);
      if (Math.floor(t * 3) % 2 === 0 || s.length < 5) { const cw = measure(ctx, s, font(66, 900, DISPLAY), 2); ctx.fillStyle = C.blue; ctx.fillRect(bx + 36 + cw, by + 104, 6, 64); }
      ctx.restore();
    }
    // sent badge
    const ke = sp(t, A(S, "t'envoie"), SPRING.bouncy);
    if (ke > 0) { const lbl = 'PDF ENVOYÉ'; pill(ctx, lbl, X0 + 500 + (XW - 500) / 2 - pillW(ctx, lbl, 28) / 2, STAGE_Y + 700, ke, { size: 28, bg: C.green }); }
  });
  // end card: logo + subscribe
  const ke = sp(t, tEnd - 0.05, SPRING.bouncy);
  if (ke > 0) {
    const cy = 760;
    ctx.save(); scaleAt(ctx, lerp(0.7, 1, clamp(ke)), W / 2, cy); ctx.globalAlpha *= clamp(ke * 1.6);
    ctx.shadowColor = rgba(C.cyan, 0.6); ctx.shadowBlur = 60;
    jumotaMark(ctx, W / 2 - 110, cy - 250, 220); ctx.shadowBlur = 0;
    txt(ctx, 'JUMOTA', W / 2, cy + 90, font(130, 900, DISPLAY), '#FFFFFF', 'center', -3);
    txt(ctx, 'AGENCY', W / 2, cy + 150, font(40, 800, UI), C.cyan, 'center', 16);
    ctx.restore();
    const kb = sp(t, tEnd + 0.35, SPRING.bouncy);
    if (kb > 0) {
      const bw = 720, bh = 120, bx = W / 2 - bw / 2, by = cy + 220;
      const pulse = 1 + 0.03 * Math.sin((t - tEnd) * 6);
      ctx.save(); scaleAt(ctx, kb * pulse, W / 2, by + bh / 2);
      ctx.shadowColor = rgba(C.red, 0.6); ctx.shadowBlur = 40;
      rrect(ctx, bx, by, bw, bh, bh / 2); ctx.fillStyle = C.red; ctx.fill(); ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.moveTo(bx + 90, by + 38); ctx.lineTo(bx + 90, by + 82); ctx.lineTo(bx + 126, by + 60); ctx.closePath(); ctx.fillStyle = '#FFFFFF'; ctx.fill();
      txt(ctx, 'ABONNE-TOI', bx + bw / 2 + 36, by + 80, font(54, 900, DISPLAY), '#FFFFFF', 'center', 1);
      ctx.restore();
      // cursor click
      const kc = io(t, tEnd + 0.9, 0.5, E.outCubic), click = Math.sin(Math.PI * clamp((t - tEnd - 1.45) / 0.25));
      if (kc > 0) {
        const px = lerp(W / 2 + 380, W / 2 + 200, kc), py = lerp(by + 300, by + bh / 2 + 10, kc);
        ctx.save(); ctx.translate(px, py); ctx.scale(1 - 0.15 * click, 1 - 0.15 * click);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 60); ctx.lineTo(16, 46); ctx.lineTo(28, 72); ctx.lineTo(38, 67); ctx.lineTo(26, 42); ctx.lineTo(46, 42); ctx.closePath();
        ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.bg0; ctx.stroke(); ctx.restore();
        if (t > tEnd + 1.45) { const r = io(t, tEnd + 1.45, 0.5); alpha(ctx, 1 - r, () => { ctx.beginPath(); ctx.arc(px, py, 20 + 60 * r, 0, M.TAU); ctx.lineWidth = 4; ctx.strokeStyle = '#FFFFFF'; ctx.stroke(); }); }
      }
    }
  }
}

const SCENES = [scene0, scene1, scene2, scene3, scene4, scene5, scene6];

// ------------------------------------------------------------------ sound: every accent on picture
const HITS = [];
const hit = (t, label, sfx, opts) => HITS.push([(t - BG.offset) / BG.period, label, sfx, opts]);
function buildHits() {
  hit(0.0, 'hook 3', 'impact');
  hit(0.6, 'EN PREMIER', 'thud', { pitch: 'A2' });
  hit(0.9, 'subtitle', 'blip', { pitch: 'E6' });
  for (let i = 1; i < SC.length; i++) hit(SC[i].start, `cut ${i}`, 'whoosh', { len: 0.35, from: 500, to: 2600 });
  hit(A(S0, 'vrai'), 'gauge 20%', 'boing', { pitch: 'C4', to: 'G3' });
  hit(A(S1, 'apprend'), 'plug', 'thud', { pitch: 'E2' });
  hit(A(S1, 'tache'), 'task chip', 'pop', { pitch: 'A5' });
  hit(A(S1, 'bien'), 'checks', 'bell', { pitch: 'E6' });
  hit(A(S1, 'trois'), 'row 1', 'pop', { pitch: 'E5' });
  hit(A(S1, 'installer'), 'row 2', 'pop', { pitch: 'G#5' });
  hit(A(S1, 'premier'), 'row 3', 'pop', { pitch: 'B5' });
  [S2, S3, S4].forEach((S, i) => { hit(S.start + 0.05, `title ${i + 1}`, 'thud', { pitch: 'E2' }); hit(S.start + 0.3, `badge ${i + 1}`, 'pop', { pitch: 'E6' }); });
  hit(A(S2, 'humanizer'), 'name said', 'blip', { pitch: 'B5' });
  hit(A(S2, '"ia'), 'tells', 'blip', { pitch: 'C5' });
  hit(A(S2, 'reecrit'), 'strike', 'whoosh', { len: 0.5, from: 3000, to: 900 });
  hit(A(S2, 'naturel') - 0.05, 'typing', 'type', { n: 14, len: 1.8 });
  hit(A(S2, 'naturel'), 'natural', 'bell', { pitch: 'B5' });
  ['posts', 'e-mails', 'legendes'].forEach((w, i) => hit(A(S2, w), w, 'pop', { pitch: ['E5', 'G#5', 'B5'][i] }));
    hit(A(S3, 'texte') + 0.2, 'cross', 'click');
  ['word', 'pdf', 'presentations', 'tableurs'].forEach((w, i) => hit(A(S3, w) - 0.05, w, 'pop', { pitch: ['E5', 'F#5', 'G#5', 'B5'][i] }));
  hit(A(S3, 'telecharger'), 'download', 'coins');
    [0, 1, 2].forEach((i) => hit(A(S4, 'repetes') + i * 0.32, `repeat ${i + 1}`, 'tok', { pitch: ['E4', 'E4', 'E4'][i] }));
  hit(A(S4, 'decris-la') + 0.05, 'typing', 'type', { n: 16, len: 1.8 });
  hit(A(S4, 'propre'), 'skill made', 'thud', { pitch: 'E2' });
  hit(A(S4, 'propre') + 0.45, 'button', 'pop', { pitch: 'B5' });
  [0, 1, 2].forEach((i) => hit(A(S4, 'volonte') + i * 0.28, `run ${i + 1}`, 'click'));
  hit(A(S5, 'claude.ai') + 0.2, 'toggle', 'tick');
  hit(A(S5, 'code'), 'typing', 'type', { n: 10, len: 0.8 });
  hit(A(S5, 'regle'), 'golden rule', 'impact');
  ['fiables', 'lis'].forEach((w, i) => hit(A(S5, w) + 0.1, w, 'bell', { pitch: ['E5', 'G#5'][i] }));
  hit(A(S5, 'activer', 1) + 0.1, 'activer', 'bell', { pitch: 'B5' });
  hit(A(S6, 'gratuit'), 'stamp', 'thud', { pitch: 'A2' });
  hit(A(S6, 'guide', 1) - 0.1, 'typing', 'type', { n: 5, len: 0.4 });
  hit(A(S6, "t'envoie"), 'sent', 'bell', { pitch: 'E6' });
  hit(A(S6, 'abonne-toi'), 'end card', 'impact');
  hit(A(S6, 'abonne-toi') + 1.45, 'click', 'click');
  // console lines: soft ticks
  LOG.forEach(([t0, kind]) => hit(t0, 'console', 'tick', { gain: 0.08 }));
}
buildHits();
HITS.sort((a, b) => a[0] - b[0]);

// ------------------------------------------------------------------ compose
M.film({
  fonts: [font(100, 900, DISPLAY), font(40, 800, UI), font(40, 600, UI), font(25, 400, MONO), font(25, 700, MONO)],
  hits: HITS,
  samples: 8,
  draw(ctx, u, t) {
    background(ctx, t);
    const i = sceneAt(t), S = SC[i];
    // stage with a whip between scenes: outgoing slides left over the last 0.3 s, incoming springs in
    const drawScene = (j) => {
      const R = SC[j];
      // incoming: slides in already composed (its state at start + 0.6 s), so the cut frame is never empty
      const kin = j === 0 ? 1 : E.outCubic(prog(t, R.start - 0.3, R.start + 0.25));
      const kout = j === SC.length - 1 ? 0 : E.inCubic(prog(t, R.end - 0.3, R.end));
      if (kin <= 0 || kout >= 1) return;
      ctx.save();
      ctx.translate((1 - kin) * W - kout * W, 0);
      ctx.beginPath(); ctx.rect(0, 190, W, CON_Y - 200); ctx.clip();
      SCENES[j](ctx, j === 0 ? t : Math.max(t, R.start + 0.6));
      ctx.restore();
    };
    drawScene(i);
    if (i + 1 < SC.length && t > SC[i + 1].start - 0.3) drawScene(i + 1);
    header(ctx, t);
    captions(ctx, t);
    // console fades out under the end card
    const tEnd = A(S6, 'abonne-toi');
    alpha(ctx, 1 - E.inCubic(prog(t, tEnd, tEnd + 0.4)) * 0.0, () => consoleBox(ctx, t));
  },
  post(ctx, u, t) {
    // fine grain, seeded per frame
    const f = Math.floor(t * 60);
    ctx.globalAlpha = 0.035;
    for (let i = 0; i < 260; i++) { const x = hash01(i, f) * W, y = hash01(i + 999, f) * H; ctx.fillStyle = i % 2 ? '#FFFFFF' : '#000000'; ctx.fillRect(x, y, 2, 2); }
    ctx.globalAlpha = 1;
  },
});
