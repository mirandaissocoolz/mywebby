import { createPixelDither } from "./pixel-dither.js";

// Settings from the Pixel Dither lab (pixel-dither.html). The canvas is masked to the
// unicorn shape in styles.css. (The previous shader, Pixel Bloom, is still in pixel-bloom.js.)
const SETTINGS = {
  colors: ["#0CA3FB", "#6DC7FC", "#FFFFFF"], // 3 or 4 colors, dark → light
  small: 8, levels: 5, split: 0.2, group: 0.85, groupSize: 260,
  edges: 0.4, dither: 1, pattern: "noise", scale: 1.2, contrast: 1.8,
  flicker: 0.25, speed: 6, seed: 1,
  reducedMotion: 0.3, // with "reduce motion" on, keep a slow flicker (30% speed) instead of freezing
};

const canvas = document.querySelector(".unicorn canvas");
const fx = createPixelDither(canvas, SETTINGS);

// Stop the animation when the page is torn down (not when it's only tucked into the
// back/forward cache, so coming back still animates).
addEventListener("pagehide", (e) => {
  if (!e.persisted) fx.destroy();
});

window.unicornDither = fx; // tweak live from the console: unicornDither.update({ flicker: 0 })
