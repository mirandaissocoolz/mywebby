// UI sound effects: a tap when the pointer moves onto a nav item or header icon, a toggle click when a nav link
// is pressed, and a celebration when Contact copies the email (played from contact.js).
// Uses Web Audio so the very short tap plays with no delay. Browsers keep audio muted until the
// visitor's first click, tap or key press on the page, so hover sounds start after that.

const SOUNDS = {
  hover: "soundeffects/tap_05%20copy.wav",
  click: "soundeffects/toggle_off%20copy.wav",
  celebrate: "soundeffects/celebration%20copy.wav",
};
// These elements never move on hover (only what's inside them lifts), so pointerenter fires
// reliably once per visit instead of flickering when an item lifts out from under the cursor.
const HOVER_TARGETS = ".nav a, .contact, .shooting-star, .moon"; // nav links, Contact and the two icons
const CLICK_TARGETS = ".nav a";            // Contact plays the celebration instead

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

for (const el of document.querySelectorAll(HOVER_TARGETS)) {
  // pointerenter fires once per entry (not for every child), and only for a real pointer.
  // Hover never wakes audio itself, so it stays silent until the first click.
  el.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "mouse" && ctx?.state === "running") start("hover");
  });
}
for (const el of document.querySelectorAll(CLICK_TARGETS)) {
  el.addEventListener("pointerdown", () => play("click"));
}
