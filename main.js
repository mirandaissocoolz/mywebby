import { createPixelBloom } from "./pixel-bloom/pixel-bloom.js";

// Settings from "Save & export" in the Pixel Bloom canvas. The canvas is masked to the
// unicorn shape in styles.css.
const SETTINGS = {
  colors: ["#fe7814", "#fec296", "#FC81C5", "#FFCCE8"],
  size: 0, pattern: 0, scale: 1.2, warp: 1.6, seed: 3.7, steps: 4, contrast: 1.1,
  px: 2, maxLvl: 4, split: 0.45, cluster: 0.8,
  tex: [0, 1], layout: 3, zscale: 1.03, zblend: 0.51, tscale: 1,
  fray: 0.15, grain: 0.51, contour: 0, slices: 8, lineCol: 3, scan: 0,
  animate: true, speed: 0.13,
};

const canvas = document.querySelector(".unicorn canvas");
const bloom = createPixelBloom(canvas, SETTINGS);

// Visitor control: the bloom's bright spot follows the pointer around the page (easing in,
// drifting back to the middle when the pointer leaves), and moving the pointer quickens the
// flow for a moment, so faster movements stir the pattern harder. At rest it keeps its
// slow drift.
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const PUSH = 0.0009;   // extra speed per px/s of pointer movement
const MAX_SPEED = SETTINGS.speed * 6;

let target = null, pos = null, energy = 0, lastMove = null;
const local = (x, y) => {
  const r = canvas.getBoundingClientRect();
  const k = canvas.clientWidth / r.width; // undo the page zoom (--s)
  return [(x - r.left) * k, (y - r.top) * k];
};
const centre = () => [canvas.clientWidth / 2, canvas.clientHeight / 2];

addEventListener("pointermove", (e) => {
  if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
  target = local(e.clientX, e.clientY);
  const now = performance.now();
  if (lastMove) {
    const dt = Math.max(1, now - lastMove.t) / 1000;
    const v = Math.hypot(e.clientX - lastMove.x, e.clientY - lastMove.y) / dt;
    energy = Math.min(MAX_SPEED, Math.max(energy, v * PUSH));
  }
  lastMove = { x: e.clientX, y: e.clientY, t: now };
});
document.documentElement.addEventListener("pointerleave", () => { target = null; lastMove = null; });

let last = performance.now(), raf = 0;
function follow(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const goal = target || centre();
  pos = pos || centre();
  const k = Math.min(1, dt * 3);
  pos = [pos[0] + (goal[0] - pos[0]) * k, pos[1] + (goal[1] - pos[1]) * k];
  energy *= Math.exp(-dt * 1.5); // the stir settles over about a second
  bloom.update({ mouse: pos, speed: SETTINGS.speed + energy });
  raf = requestAnimationFrame(follow);
}
if (!reduceMotion) raf = requestAnimationFrame(follow);

// Stop the shader when the page is torn down (not when it's only tucked into the
// back/forward cache, so coming back still animates).
addEventListener("pagehide", (e) => {
  if (e.persisted) return;
  cancelAnimationFrame(raf);
  bloom.destroy();
});

window.unicornBloom = bloom; // tweak live from the console: unicornBloom.update({ px: 3 })
