/*
 * Pixel Bloom — Miranda's shader from the Pixel Bloom playground, unchanged except:
 *   - `mouse` setting: the bloom highlight follows a point (CSS px inside the canvas)
 *     instead of sitting in the centre;
 *   - it stops drawing while off screen;
 *   - `reducedMotion` setting: how fast it still drifts (0–1 of normal) for visitors with
 *     "reduce motion" on. 0 freezes it, as the original does.
 * Kept in step with ../pixel-bloom/pixel-bloom.js (the playground export).
 *   import { createPixelBloom } from './pixel-bloom.js';
 *   const bloom = createPixelBloom(canvas, SETTINGS);
 *   bloom.update({ speed: 0.2 });   bloom.destroy();
 */

export const DEFAULTS = {
  colors: ['#F7F6F9', '#FFB8DA', '#FF6FB8', '#FF3D9A'],
  pattern: 0, scale: 1.2, warp: 1.6, seed: 3.7, steps: 4, contrast: 1.1,
  px: 3, maxLvl: 3, split: 0.5, cluster: 0.6, tex: [1, 2, 4, 5, 7], layout: 1, zscale: 1.2, zblend: 0.5, tscale: 2,
  fray: 0.25, grain: 0.15, contour: 0, slices: 8, lineCol: 3, scan: 0, animate: true, speed: 0.4,
  mouse: null, reducedMotion: 0
};

const VERT = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';
const FRAG = `
precision highp float;
uniform vec2 uRes; uniform vec2 uMouse;
uniform float uTime; uniform float uPx; uniform float uMaxLvl; uniform float uSplit; uniform float uCluster;
uniform float uScale; uniform float uWarp; uniform float uSeed;
uniform float uPattern; uniform float uSteps; uniform float uContrast;
uniform float uLayout; uniform float uZScale; uniform float uZBlend; uniform float uTScale;
uniform float uTex[9]; uniform float uTexCount;
uniform float uFray; uniform float uGrain;
uniform float uContour; uniform float uSlices; uniform vec3 uLineCol; uniform float uScan;
uniform vec3 uPal[4];

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(17.1, 9.7); a *= 0.5; }
  return v;
}
float bayer2(vec2 a){ a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a){ return bayer4(0.5 * a) * 0.25 + bayer2(a); }
float tri(float x){ return abs(fract(x) - 0.5) * 2.0; }

vec2 toP(vec2 px){ return (px - 0.5 * uRes) / uRes.y; }

float field(vec2 cell){
  vec2 p = toP(cell);
  vec2 m = toP(uMouse);
  float T = uTime;
  float t = 0.0;
  if (uPattern < 0.5) {
    vec2 q = p * uScale * 1.6 + uSeed;
    vec2 a = vec2(fbm(q + T * 0.12), fbm(q + vec2(5.2, 1.3) - T * 0.1));
    vec2 b = vec2(fbm(q + uWarp * a + vec2(1.7, 9.2) + T * 0.08), fbm(q + uWarp * a + vec2(8.3, 2.8)));
    t = fbm(q + uWarp * b);
    t += 0.3 * exp(-12.0 * dot(p - m, p - m));
    t = smoothstep(0.25, 0.75, t);
  } else if (uPattern < 1.5) {
    float x = p.x * uScale * 2.0;
    float col = floor(x);
    float h = hash(vec2(col, uSeed));
    float y = p.y * uScale * 0.6 + h * 4.0 + T * (h - 0.5) * 0.4 + uWarp * 0.12 * fbm(vec2(col * 3.1, p.y * 3.0 + T * 0.1));
    t = fract(y + fract(x) * 0.12);
    t += 0.25 * exp(-10.0 * dot(p - m, p - m));
  } else if (uPattern < 2.5) {
    vec2 c = vec2(m.x, -0.42);
    vec2 d = (p - c) * vec2(0.9, 1.3) / max(uScale * 0.7, 0.2);
    float r = length(d);
    t = 1.0 - r * 0.85 + uWarp * 0.12 * (fbm(p * 3.0 + T * 0.15 + uSeed) - 0.5);
    float ang = atan(d.x, d.y);
    t += 0.18 * pow(max(cos(ang * 12.0 + uSeed + T * 0.2), 0.0), 24.0) * (1.0 - smoothstep(0.2, 1.4, r));
    t *= mix(0.6, 1.0, step(c.y, p.y));
  } else if (uPattern < 3.5) {
    vec2 d = p - m;
    float r = length(d) + uWarp * 0.08 * fbm(p * 4.0 + uSeed + T * 0.2);
    t = 0.5 + 0.5 * sin(r * uScale * 18.0 - T * 2.0);
  } else if (uPattern < 4.5) {
    vec2 q = p * uScale * 3.0;
    float v = sin(q.x + T) + sin(q.y * 1.3 - T * 0.8) + sin((q.x + q.y) * 0.7 + T * 0.6 + uSeed)
            + sin(length(q - m * uScale * 3.0) * 1.5 - T);
    v += uWarp * 2.4 * (fbm(q * 0.5 + uSeed) - 0.5);
    t = 0.5 + 0.125 * v;
  } else {
    vec2 q = p * uScale * 1.2 + uSeed;
    vec2 w = vec2(fbm(q + T * 0.05), fbm(q + vec2(3.1, 7.7) - T * 0.04));
    t = fbm(q + uWarp * 0.35 * w);
    t += 0.2 * exp(-8.0 * dot(p - m, p - m));
    t = smoothstep(0.2, 0.8, t);
  }
  return t;
}

float voronoiId(vec2 p){
  vec2 g = floor(p); vec2 f = fract(p);
  float best = 9.0; vec2 bid = g;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec2 pt = vec2(hash(g + o + uSeed), hash(g + o + uSeed + 7.1));
      vec2 d = o + pt - f;
      float dd = dot(d, d);
      if (dd < best) { best = dd; bid = g + o; }
    }
  }
  return hash(bid + 3.3);
}

float zoneValue(vec2 cell){
  vec2 p = toP(cell);
  vec2 m = toP(uMouse);
  float N = uTexCount;
  if (uLayout < 0.5) return field(cell) * N * 0.999;
  if (uLayout < 1.5) return fbm(p * uZScale * 2.0 + uSeed * 1.7 + uTime * 0.04) * N * 1.8;
  if (uLayout < 2.5) return voronoiId(p * uZScale * 3.0) * N;
  if (uLayout < 3.5) return (p.x * 0.8 + p.y * 0.5) * uZScale * 3.0 + uTime * 0.1;
  return length(p - m) * uZScale * 5.0 - uTime * 0.2;
}

vec3 ramp(float t){
  t = clamp(t, 0.0, 1.0) * 3.0;
  vec3 c = uPal[0];
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    if (t >= fk) { c = mix(uPal[k], uPal[k + 1], clamp(t - fk, 0.0, 1.0)); }
  }
  return c;
}

float tone(vec2 samplePx, vec2 cellId){
  float t = field(samplePx) + (hash(cellId + floor(uTime * 8.0) * 0.37 + uSeed) - 0.5) * uFray * 0.6;
  return clamp((t - 0.5) * uContrast + 0.5, 0.0, 1.0);
}

void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 cellId = floor(fc / uPx);
  vec2 cell = (cellId + 0.5) * uPx;
  float S = uPx * (1.5 + 1.5 * uTScale);
  float L = max(uSteps - 1.0, 1.0);

  float zb = uPx * 4.0;
  vec2 zcell = (floor(fc / zb) + 0.5) * zb;
  float zc = zoneValue(zcell);
  float zi = mod(floor(zc + (bayer8(cellId) - 0.5) * uZBlend * 1.6), uTexCount);
  float id = 0.0;
  for (int i = 0; i < 9; i++) { if (float(i) == zi) id = uTex[i]; }

  vec3 col;
  if (id < 0.5) {
    col = ramp(tone(fc, cellId));
  } else {
    vec2 sp = cell;
    float th = 0.5;
    vec2 q = cell;
    if (id < 1.5) {
      float sz = uPx * pow(2.0, uMaxLvl);
      vec2 bId = floor(fc / sz);
      for (int l = 0; l < 5; l++) {
        if (float(l) >= uMaxLvl) break;
        vec2 bc = (bId + 0.5) * sz;
        float region = noise(toP(bc) * 2.5 + uSeed * 0.7 + uTime * 0.03);
        float chance = clamp(uSplit + (region - 0.5) * 1.6 * uCluster, 0.0, 1.0);
        if (hash(bId * 1.31 + float(l) * 7.7 + uSeed) < chance) {
          sz *= 0.5;
          bId = floor(fc / sz);
        } else {
          break;
        }
      }
      sp = (bId + 0.5) * sz;
      cellId = bId + sz * 0.731;
      th = 0.5;
    } else if (id < 2.5) {
      th = bayer4(cellId);
    } else if (id < 3.5) {
      th = hash(cellId + 0.17 + uSeed);
    } else if (id < 4.5) {
      mat2 R = mat2(0.7071, -0.7071, 0.7071, 0.7071);
      vec2 r = R * q / S;
      vec2 rc = floor(r) + 0.5;
      sp = (rc * S) * R;
      float d = length(fract(r) - 0.5);
      th = d * d * 2.0;
    } else if (id < 5.5) {
      th = tri((q.x + q.y) / S);
    } else if (id < 6.5) {
      th = min(tri((q.x + q.y) / S), tri((q.x - q.y) / S)) * 1.4;
    } else if (id < 7.5) {
      vec2 rc = floor(q / (S * 1.6));
      sp = (rc + 0.5) * S * 1.6;
      th = tri(length(fract(q / (S * 1.6)) - 0.5) * 3.0);
    } else {
      th = tri(q.y / S + 0.6 * sin(q.x / S * 1.3));
    }
    float t = tone(sp, cellId);
    float s = t * L;
    float lo = floor(s);
    float up = (th < fract(s)) ? 1.0 : 0.0;
    col = ramp((lo + up) / L);
  }

  if (uContour > 0.001) {
    vec2 c0 = (floor(fc / uPx) + 0.5) * uPx;
    float b0 = floor(field(c0) * uSlices);
    float bx = floor(field(c0 + vec2(uPx, 0.0)) * uSlices);
    float by = floor(field(c0 + vec2(0.0, uPx)) * uSlices);
    float edge = (b0 != bx || b0 != by) ? 1.0 : 0.0;
    col = mix(col, uLineCol, edge * uContour);
  }

  col *= 1.0 - uScan * 0.35 * mod(floor(fc.y / uPx), 2.0);
  col += (hash(fc + fract(uTime * 7.0) * 91.0) - 0.5) * uGrain * 0.2;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function createPixelBloom(canvas, settings = {}) {
  let s = Object.assign({}, DEFAULTS, settings);
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gl = canvas.getContext('webgl', { antialias: false }) || canvas.getContext('experimental-webgl');
  if (!gl) { console.warn('[PixelBloom] WebGL unavailable'); return { update() {}, destroy() {} }; }

  const compile = (type, src) => {
    const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error('[PixelBloom]', gl.getShaderInfoLog(sh));
    return sh;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const names = ['uRes', 'uMouse', 'uTime', 'uPx', 'uMaxLvl', 'uSplit', 'uCluster', 'uScale', 'uWarp', 'uSeed', 'uPattern',
    'uSteps', 'uContrast', 'uLayout', 'uZScale', 'uZBlend', 'uTScale', 'uTex', 'uTexCount', 'uFray', 'uGrain',
    'uContour', 'uSlices', 'uLineCol', 'uScan', 'uPal'];
  const u = {};
  names.forEach((n) => { u[n] = gl.getUniformLocation(prog, n); });

  // Size from the on-screen box (getBoundingClientRect respects CSS zoom on the page).
  let cssW = 1;
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = Math.max(1, r.width);
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  };
  resize();
  const ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(canvas);
  // page zoom changes the on-screen size without a layout resize, so watch the window too
  window.addEventListener('resize', resize);

  let visible = true;
  const io = window.IntersectionObserver ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; }) : null;
  if (io) io.observe(canvas);

  let time = 0, last = performance.now(), raf = 0, drawn = false;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!visible && drawn) return;
    if (s.animate) time += dt * s.speed * 2.5 * (reduceMotion ? s.reducedMotion : 1);
    drawn = true;
    const dpr = canvas.width / cssW;
    const rgb = s.colors.map(hexToRgb);
    const tex = (s.tex && s.tex.length ? s.tex : [1]).slice(0, 9);
    const texArr = new Float32Array(9); tex.forEach((t, i) => { texArr[i] = t; });
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    // mouse is in CSS px from the canvas's top-left; GL's y runs bottom-up
    if (s.mouse) gl.uniform2f(u.uMouse, s.mouse[0] * dpr, canvas.height - s.mouse[1] * dpr);
    else gl.uniform2f(u.uMouse, canvas.width / 2, canvas.height / 2);
    gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uPx, Math.max(1, Math.round(s.px * dpr)));
    gl.uniform1f(u.uMaxLvl, s.maxLvl);
    gl.uniform1f(u.uSplit, s.split);
    gl.uniform1f(u.uCluster, s.cluster);
    gl.uniform1f(u.uScale, s.scale);
    gl.uniform1f(u.uWarp, s.warp);
    gl.uniform1f(u.uSeed, s.seed);
    gl.uniform1f(u.uPattern, s.pattern);
    gl.uniform1f(u.uSteps, s.steps);
    gl.uniform1f(u.uContrast, s.contrast);
    gl.uniform1f(u.uLayout, s.layout);
    gl.uniform1f(u.uZScale, s.zscale);
    gl.uniform1f(u.uZBlend, s.zblend);
    gl.uniform1f(u.uTScale, s.tscale);
    gl.uniform1fv(u.uTex, texArr);
    gl.uniform1f(u.uTexCount, tex.length);
    gl.uniform1f(u.uFray, s.fray);
    gl.uniform1f(u.uGrain, s.grain);
    gl.uniform1f(u.uContour, s.contour);
    gl.uniform1f(u.uSlices, s.slices);
    gl.uniform3fv(u.uLineCol, new Float32Array(rgb[s.lineCol] || rgb[3]));
    gl.uniform1f(u.uScan, s.scan);
    gl.uniform3fv(u.uPal, new Float32Array([].concat(...rgb)));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  raf = requestAnimationFrame(frame);

  return {
    update(next) { s = Object.assign({}, s, next); },
    get settings() { return { ...s }; },
    destroy() { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); if (ro) ro.disconnect(); if (io) io.disconnect(); }
  };
}
