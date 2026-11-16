// Claude : Projets, Code, Artéfacts, Tâches planifiées – Jumota Agency.
// STYLE FRAME (test): light gallery background, floating objects with soft shadows, kinetic captions
// where each spoken word lands with its own weight and size. Pure function of time.
import * as M from './lib/motion.js';

const { W, H, E, prog, lerp, clamp, SPRING, font, rrect, TAU } = M;
const C = { bg: '#F2F0F3', ink: '#1C1C1E', grey: '#A3A1A8', soft: '#C9C7CE', blue: '#126BFF', card: '#F3F3F1', white: '#FFFFFF' };
const UI = 'UI';
const sp = (t, t0, cfg = SPRING.snappy) => M.spring(t - t0, cfg);

function shadowCard(ctx, x, y, w, h, r, fillc, lift = 1) {
  ctx.save();
  ctx.shadowColor = 'rgba(30,25,40,0.16)'; ctx.shadowBlur = 90 * lift; ctx.shadowOffsetY = 46 * lift;
  rrect(ctx, x, y, w, h, r); ctx.fillStyle = fillc; ctx.fill();
  ctx.shadowColor = 'rgba(30,25,40,0.10)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8; ctx.fill();
  ctx.restore();
}

// Kinetic caption: lines of [word, style]; style: 'b' bold ink, 'r' regular ink, 'g' regular grey,
// 'B' bold big, 'X' inverted box. Each word blurs in from slightly lower, on its own time.
function caption(ctx, lines, cx, y0, size, t, t0, step = 0.16) {
  let k = 0;
  lines.forEach((line, li) => {
    const parts = line.map(([w, s]) => {
      const sz = s === 'B' ? size * 1.25 : s === 'g' ? size * 0.92 : size;
      const f = font(sz, s === 'b' || s === 'B' || s === 'X' ? 800 : 500, UI);
      ctx.font = f; ctx.letterSpacing = `${-0.02 * sz}px`;
      return { w, s, f, sz, wd: ctx.measureText(w).width };
    });
    const gap = size * 0.26, total = parts.reduce((a, p) => a + p.wd, 0) + gap * (parts.length - 1);
    let x = cx - total / 2; const y = y0 + li * size * 1.22;
    parts.forEach((p, i) => {
      const tw = t0 + k++ * step, q = sp(t, tw, { stiffness: 300, damping: 24 });
      if (q > 0) {
        ctx.save(); ctx.globalAlpha = clamp(q * 1.6);
        const blur = (1 - clamp(q)) * 14; if (blur > 0.3) ctx.filter = `blur(${blur.toFixed(1)}px)`;
        const dy = (1 - q) * size * 0.5 + (p.s === 'g' ? size * 0.08 : 0);
        if (p.s === 'X') {
          ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
          ctx.fillStyle = C.ink; ctx.fillRect(x - size * 0.2, y + dy - p.sz * 0.86, p.wd + size * 0.4, p.sz * 1.16);
          ctx.shadowColor = 'transparent';
        }
        ctx.font = p.f; ctx.letterSpacing = `${-0.02 * p.sz}px`;
        ctx.fillStyle = p.s === 'X' ? C.white : p.s === 'g' ? C.grey : C.ink;
        ctx.fillText(p.w, x, y + dy);
        ctx.restore();
      }
      x += p.wd + gap;
    });
  });
  ctx.letterSpacing = '0px';
}

function draw(ctx, t, IMG) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  // the user's real sidebar, floating
  const im = IMG.sidebar, cw = 860, ch = cw * im.height / im.width;
  const k = sp(t, 0, SPRING.gentle), x = (W - cw) / 2, y = 330 + (1 - k) * 120 + Math.sin(t * 1.3) * 6;
  ctx.save(); ctx.globalAlpha = clamp(k * 2);
  shadowCard(ctx, x, y, cw, ch, 44, C.card);
  ctx.beginPath(); rrect(ctx, x, y, cw, ch, 44); ctx.clip();
  ctx.drawImage(im, x, y, cw, ch);
  ctx.restore();
  // cursor dot on "Code"
  caption(ctx, [[['Tu', 'g'], ['les', 'g'], ['vois', 'r'], ['tous', 'b'], ['les', 'r'], ['jours', 'b']], [['dans', 'g'], ['Claude', 'B'], ['…', 'g']], [['mais', 'r'], ['à quoi ça sert ?', 'X']]],
    W / 2, 1060, 84, t, 0.4);
  ctx.font = font(40, 700, UI); ctx.fillStyle = C.soft; ctx.textAlign = 'center'; ctx.fillText('jumota.', W / 2 - 12, 1420);
  ctx.fillStyle = C.blue; ctx.fillText('', 0, 0); ctx.textAlign = 'left';
}

M.film({
  fonts: [font(80, 800, UI), font(80, 500, UI)],
  images: { sidebar: 'assets/sidebar.jpg' },
  samples: 1,
  draw(ctx, u, t, IMG) { draw(ctx, t, IMG); },
});
