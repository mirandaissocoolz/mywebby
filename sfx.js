// UI sound effects: a tap when the pointer moves onto anything hoverable, a toggle click when a nav link
// is pressed, and a celebration when Contact copies the email (played from contact.js).
// Uses Web Audio so the very short tap plays with no delay. Browsers keep audio muted until the
// visitor's first click, tap or key press on the page, so hover sounds start after that.

const SOUNDS = {
  hover: "soundeffects/tap_05.wav",
  click: "soundeffects/toggle_off.wav",
  celebrate: "soundeffects/celebration.wav",
};
// Every hoverable thing on the site plays the tap when the pointer moves onto it: links, buttons,
// media tabs, media covers, memory photos and cards. When one sits inside another (a link inside a
// card), only the outer one counts, so moving within it stays quiet.
const HOVER_TARGETS = "a, button, [role='tab'], .cover, .memory, .card";
const CLICK_TARGETS = ".nav a, .media-tab";           // Contact plays the celebration instead

const Ctx = window.AudioContext || window.webkitAudioContext;
const ctx = Ctx ? new Ctx() : null;
const buffers = {};

if (ctx) {
  for (const [name, url] of Object.entries(SOUNDS)) {
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((buf) => { buffers[name] = buf; })
      .catch(() => {}); // a missing sound should never break the page
  }

  // Wake the audio context on the first gesture (browsers start it suspended).
  const unlock = () => { if (ctx.state === "suspended") ctx.resume(); };
  addEventListener("pointerdown", unlock, { capture: true });
  addEventListener("keydown", unlock, { capture: true });
}

function start(name) {
  const buf = buffers[name];
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start();
}

// Plays a sound now, or once the audio context has woken up (on the visitor's first click).
export function play(name) {
  if (!ctx) return;
  if (ctx.state === "running") start(name);
  else ctx.resume().then(() => start(name));
}

// One listener for the whole page, so covers added later (the media shelves load from Supabase)
// play too. Some things lift on hover and can slip out from under a still cursor for a moment;
// the short cooldown stops that from sounding like a double tap.
function hoverTarget(node) {
  let hit = null;
  for (let el = node instanceof Element ? node : null; el && el !== document.body; el = el.parentElement) {
    if (el.matches(HOVER_TARGETS)) hit = el; // keep climbing: the outermost match wins
  }
  return hit;
}
let current = null, lastEl = null, lastAt = 0;
addEventListener("pointerover", (e) => {
  if (e.pointerType !== "mouse") return;
  const el = hoverTarget(e.target);
  if (el === current) return;
  current = el;
  if (!el || ctx?.state !== "running") return;
  const now = performance.now();
  if (el === lastEl && now - lastAt < 250) return;
  lastEl = el; lastAt = now;
  start("hover"); // hover never wakes audio itself, so it stays silent until the first click
});
addEventListener("pointerout", (e) => { if (!e.relatedTarget) current = null; });

for (const el of document.querySelectorAll(CLICK_TARGETS)) {
  el.addEventListener("pointerdown", () => play("click"));
}
