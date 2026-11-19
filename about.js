// About → "my media gems": clicking Albums / Books / Movies / Dramas shows that shelf.
// Arrow keys, Home and End move between tabs (WAI-ARIA tabs pattern).

const tabs = [...document.querySelectorAll(".media-tab")];
const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));

for (const panel of panels) [...panel.children].forEach((img, i) => img.style.setProperty("--i", i));

function select(i, focus) {
  tabs.forEach((tab, j) => {
    const on = i === j;
    tab.classList.toggle("is-active", on);
    tab.setAttribute("aria-selected", String(on));
    tab.tabIndex = on ? 0 : -1;
    panels[j].hidden = !on;
    panels[j].classList.remove("is-entering");
  });
  void panels[i].offsetWidth; // restart the deal-in animation
  panels[i].classList.add("is-entering");
  if (focus) tabs[i].focus();
}

tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => { if (!tab.classList.contains("is-active")) select(i); });
  tab.addEventListener("keydown", (e) => {
    const n = tabs.length;
    const to = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    select(to, true);
  });
});

// Intro photos: the strip scrolls sideways with a trackpad, touch or the arrow keys. With a
// mouse you can also grab it and drag; letting go snaps to the nearest photo.
const strip = document.querySelector(".intro-strip");
let drag = null;
strip.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "mouse" || e.button !== 0) return;
  drag = { x: e.clientX, left: strip.scrollLeft, k: strip.clientWidth / strip.getBoundingClientRect().width };
  strip.setPointerCapture(e.pointerId);
  strip.classList.add("is-dragging");
});
strip.addEventListener("pointermove", (e) => {
  if (!drag) return;
  strip.scrollLeft = drag.left - (e.clientX - drag.x) * drag.k; // k undoes the page zoom (--s)
});
const endDrag = () => {
  if (!drag) return;
  drag = null;
  strip.classList.remove("is-dragging"); // snapping comes back on and settles on a photo
};
strip.addEventListener("pointerup", endDrag);
strip.addEventListener("pointercancel", endDrag);
