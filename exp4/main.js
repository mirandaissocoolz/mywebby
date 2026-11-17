import { createPixelBloom } from "./pixel-bloom.js";

// Settings from "Save & export" in the Pixel Bloom playground.
const SETTINGS = {
  colors: ["#FE7814", "#FEC296", "#FC81C5", "#FFCCE8"],
  pattern: 0, scale: 1.2, warp: 1.6, seed: 3.7, steps: 4, contrast: 1.1,
  px: 2, maxLvl: 4, split: 0.45, cluster: 0.8,
  tex: [0, 1], layout: 3, zscale: 1.03, zblend: 1, tscale: 6,
  fray: 0.15, grain: 0.51, contour: 0, slices: 8, lineCol: 3, scan: 0,
  animate: true, speed: 0.15,
  reducedMotion: 0.4, // with "reduce motion" on, keep a slow drift instead of freezing
};

const el = document.querySelector(".unicorn");
const canvas = el.querySelector("canvas");
const bloom = createPixelBloom(canvas, SETTINGS);

// The bloom highlight drifts toward the pointer while it's over the hero, then settles
// back to the middle; the shimmer quickens a little on hover.
const hero = document.querySelector(".hero");
let target = null, pos = null, speed = SETTINGS.speed, hovering = false;
const centre = () => { const r = canvas.getBoundingClientRect(); return [r.width / 2, r.height / 2]; };

hero.addEventListener("pointermove", (e) => {
  const r = canvas.getBoundingClientRect();
  target = [e.clientX - r.left, e.clientY - r.top];
  hovering = true;
});
hero.addEventListener("pointerleave", () => { target = null; hovering = false; });

let last = performance.now(), followRaf = 0;
(function follow(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const goal = target || centre();
  pos = pos || centre();
  const k = Math.min(1, dt * 3);
  pos = [pos[0] + (goal[0] - pos[0]) * k, pos[1] + (goal[1] - pos[1]) * k];
  speed += ((hovering ? SETTINGS.speed * 1.8 : SETTINGS.speed) - speed) * Math.min(1, dt * 2);
  bloom.update({ mouse: pos, speed });
  followRaf = requestAnimationFrame(follow);
})(last);

// Stop the shader and the follow loop when the page is torn down (not when it's only
// tucked into the back/forward cache, so coming back still animates).
addEventListener("pagehide", (e) => {
  if (e.persisted) return;
  cancelAnimationFrame(followRaf);
  bloom.destroy();
});

window.unicornBloom = bloom; // tweak live from the console: unicornBloom.update({ px: 3 })
