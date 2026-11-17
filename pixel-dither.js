// pixel-dither.js — pixel / dithered-square shader on a 2D canvas. No dependencies.
//
// Usage:
//   import { createPixelDither } from './pixel-dither.js';
//   const fx = createPixelDither(document.querySelector('canvas'), { colors: ['#0CA3FB', '#6DC7FC', '#FFFFFF'] });
//   fx.update({ small: 6, levels: 6 });   // change any option live
//   fx.destroy();                          // stop animation + resize observer
//
// The canvas fills its parent: give the parent a size (e.g. width:100%; height:100vh).

const DEFAULTS = {
  colors: ['#0CA3FB', '#6DC7FC', '#FFFFFF'], // 3 or 4 colors, dark → light
  small: 8,          // smallest square, px
  levels: 5,         // largest square = small * 2^(levels-1)
  split: 0.2,        // random splits 0–1
  group: 0.85,       // how much big squares clump together 0–1
  groupSize: 260,    // size of clumps, px
  edges: 0.4,        // extra splitting where colors meet 0–1
  dither: 1,         // checker dither strength 0–1.5
  pattern: 'noise',  // 'noise' | 'radial' | 'linear'
  scale: 1.2,        // pattern zoom
  contrast: 1.8,
  mx: 0,             // move x
  my: 0,             // move y
  flicker: 0.25,     // 0 = still
  speed: 6,          // flicker steps per second
  reducedMotion: 0,  // with "reduce motion" on, flicker at this fraction of speed (0 = still)
  seed: 1
};

function hash(x, y, z) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

function noise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, y, seed) {
  let sum = 0, amp = 0.5, tot = 0, f = 1;
  for (let o = 0; o < 4; o++) {
    sum += noise(x * f, y * f, seed + o * 17.3) * amp;
    tot += amp; amp *= 0.5; f *= 2.03;
  }
  return sum / tot;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function createPixelDither(canvas, options = {}) {
  let o = { ...DEFAULTS, ...options };
  const ctx = canvas.getContext('2d');
  let leaves = [];
  let step = 0;
  let raf = 0;

  canvas.style.imageRendering = 'pixelated';

  function field(px, py) {
    let v;
    if (o.pattern === 'radial') v = 1 - Math.hypot(px, py) / 1.6;
    else if (o.pattern === 'linear') v = (py + 1) / 2;
    else v = fbm(px * 1.5 + 50, py * 1.5 + 50, o.seed * 13.7);
    return clamp01((v - 0.5) * o.contrast + 0.5);
  }

  function build() {
    const W = canvas.width, H = canvas.height;
    const small = Math.max(2, Math.round(o.small));
    const big = small * Math.pow(2, Math.max(1, Math.round(o.levels)) - 1);
    const N = o.colors.length;
    const U = (Math.min(W, H) / 2) * o.scale;
    const cx0 = W / 2, cy0 = H / 2;
    const at = (x, y) => field((x - cx0) / U + o.mx, (y - cy0) / U + o.my);
    leaves = [];

    const visit = (x, y, size) => {
      const vc = at(x + size / 2, y + size / 2);
      if (size > small) {
        const vs = [vc, at(x, y), at(x + size, y), at(x, y + size), at(x + size, y + size)];
        const lo = Math.min(...vs), hi = Math.max(...vs);
        const crosses = Math.round(lo * (N - 1) - 0.25) !== Math.round(hi * (N - 1) + 0.25);
        const depth = Math.round(Math.log2(big / size));
        const p = (o.split + (crosses ? o.edges : 0)) * Math.pow(0.7, depth);
        let r = hash(x * 0.37 + size, y * 0.91 - size, o.seed);
        if (o.group > 0) {
          const g = clamp01((fbm((x + size / 2) / o.groupSize + 7, (y + size / 2) / o.groupSize + 3, o.seed * 5.1 + 99) - 0.5) * 3 + 0.5);
          r = r * (1 - o.group) + g * o.group;
        }
        if (r < p) {
          const h = size / 2;
          visit(x, y, h); visit(x + h, y, h); visit(x, y + h, h); visit(x + h, y + h, h);
          return;
        }
      }
      const parity = (Math.floor(x / size) + Math.floor(y / size)) & 1;
      leaves.push({ x, y, s: size, v: vc, t: parity ? 0.75 : 0.25 });
    };

    for (let y = 0; y < H; y += big) for (let x = 0; x < W; x += big) visit(x, y, big);
    paint();
  }

  function paint() {
    const N = o.colors.length;
    const buckets = o.colors.map(() => []);
    for (const lf of leaves) {
      let th = lf.t;
      if (o.flicker > 0) th += (hash(lf.x + 0.5, lf.y + 0.5, step + lf.s) - 0.5) * o.flicker * 2;
      let lvl = Math.round(lf.v * (N - 1) + (th - 0.5) * o.dither);
      lvl = Math.max(0, Math.min(N - 1, lvl));
      buckets[lvl].push(lf);
    }
    buckets.forEach((list, i) => {
      ctx.fillStyle = o.colors[i];
      for (const lf of list) ctx.fillRect(lf.x, lf.y, lf.s, lf.s);
    });
  }

  function fit() {
    const parent = canvas.parentElement || canvas;
    const w = Math.max(1, Math.round(parent.clientWidth));
    const h = Math.max(1, Math.round(parent.clientHeight));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    build();
  }

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
  if (ro && canvas.parentElement) ro.observe(canvas.parentElement);
  fit();

  const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start = performance.now();
  const loop = (now) => {
    const speed = reduceMotion ? o.speed * o.reducedMotion : o.speed;
    if (o.flicker > 0 && speed > 0) {
      const s = Math.floor(((now - start) / 1000) * speed);
      if (s !== step) { step = s; paint(); }
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return {
    update(next) { o = { ...o, ...next }; build(); },
    get options() { return { ...o }; },
    destroy() { cancelAnimationFrame(raf); if (ro) ro.disconnect(); }
  };
}
