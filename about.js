// About → "my media gems": clicking Albums / Books / Movies / Dramas shows that shelf.
// Arrow keys, Home and End move between tabs (WAI-ARIA tabs pattern).

const tabs = [...document.querySelectorAll(".media-tab")];
const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));

const stagger = (panel) => [...panel.children].forEach((el, i) => el.style.setProperty("--i", i));
panels.forEach(stagger);

function select(i, focus) {
  tabs.forEach((tab, j) => {
    const on = i === j;
    tab.classList.toggle("is-active", on);
    tab.setAttribute("aria-selected", String(on));
    tab.tabIndex = on ? 0 : -1;
    panels[j].hidden = !on;
    panels[j].classList.remove("is-entering");
  });
  glide();
  void panels[i].offsetWidth; // restart the deal-in animation
  panels[i].classList.add("is-entering");
  if (focus) tabs[i].focus();
}

// The grey pill behind the selected tab. Tabs change width as their icons open and close, so each
// frame the pill eases a share of the way toward wherever the selected tab is right now, and it
// rides along with that resize instead of aiming at a spot that is still moving.
const pill = document.querySelector(".media-pill");
const still = matchMedia("(prefers-reduced-motion: reduce)");
let pillX = 0, pillW = 0, gliding = 0;
function placePill() {
  const tab = tabs.find((t) => t.classList.contains("is-active"));
  pill.style.top = `${tab.offsetTop}px`;
  pill.style.height = `${tab.offsetHeight}px`;
  pill.style.transform = `translateX(${pillX}px)`;
  pill.style.width = `${pillW}px`;
}
function glide() {
  cancelAnimationFrame(gliding);
  const step = () => {
    const tab = tabs.find((t) => t.classList.contains("is-active"));
    const x = tab.offsetLeft, w = tab.offsetWidth;
    if (still.matches) { pillX = x; pillW = w; placePill(); return; }
    pillX += (x - pillX) * 0.2;
    pillW += (w - pillW) * 0.2;
    const done = Math.abs(x - pillX) < 0.3 && Math.abs(w - pillW) < 0.3;
    if (done) { pillX = x; pillW = w; }
    placePill();
    if (!done) gliding = requestAnimationFrame(step);
  };
  gliding = requestAnimationFrame(step);
}
{
  const tab = tabs.find((t) => t.classList.contains("is-active"));
  pillX = tab.offsetLeft; pillW = tab.offsetWidth; placePill();
  document.fonts?.ready.then(() => { pillX = tab.offsetLeft; pillW = tab.offsetWidth; placePill(); glide(); });
  addEventListener("resize", glide);
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

// Media shelves come from Supabase: one table per tab, one row per cover. Hovering a cover shows
// its title plus the artist (albums), author (books) or year (movies, dramas). created_at holds the
// release date, so it sets the order (newest first) and the year. If a request fails, the covers
// already in about.html stay as they are.
const SUPABASE_URL = "https://nioduagbvcawrgfhjfog.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pb2R1YWdidmNhd3JnZmhqZm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4OTA3NjksImV4cCI6MjA5NzQ2Njc2OX0.PcgwFXrTjJpSWHbmwMkS2wtJtzlHki8WtYG95FP9I3k";
const COVER_BUCKET = "mywebby"; // covers live in a folder per table: mywebby/albums/…, mywebby/books/…

const SHELVES = [
  { table: "albums", panel: "panel-albums", sub: (r) => r.artist },
  { table: "books", panel: "panel-books", sub: (r) => r.author },
  { table: "movies", panel: "panel-movies", sub: (r) => r.year || clean(r.created_at).slice(0, 4) },
  { table: "dramas", panel: "panel-dramas", sub: (r) => r.year || clean(r.created_at).slice(0, 4) },
];

const clean = (v) => (v == null ? "" : String(v).trim());
const coverSrc = (folder, file) =>
  /^(https?:)?\/\//.test(file) || file.startsWith("assets/")
    ? file
    : `${SUPABASE_URL}/storage/v1/object/public/${COVER_BUCKET}/${folder}/${encodeURIComponent(file)}`;

function coverEl(title, sub, src, lazy, w, h) {
  const fig = document.createElement("figure");
  fig.className = "cover";
  fig.tabIndex = 0;
  const img = document.createElement("img");
  img.src = src;
  img.alt = sub ? `${title} — ${sub}` : title;
  if (lazy) img.loading = "lazy";
  if (+w && +h) { img.width = +w; img.height = +h; } // reserves the cover's shape before it loads
  const cap = document.createElement("figcaption");
  const t = document.createElement("span");
  t.className = "cover-title";
  t.textContent = title;
  const s = document.createElement("span");
  s.className = "cover-sub";
  s.textContent = sub;
  cap.append(t, s);
  fig.append(img, cap);
  return fig;
}

async function loadShelf({ table, panel, sub }) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=created_at.desc.nullslast`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  if (!r.ok) throw new Error(`${table}: ${r.status}`);
  const rows = (await r.json()).filter((row) => clean(row.file_name));
  if (!rows.length) return;
  const el = document.getElementById(panel);
  el.replaceChildren(
    ...rows.map((row) => coverEl(clean(row.title), clean(sub(row)), coverSrc(table, clean(row.file_name)), panel !== "panel-albums", row.width, row.height))
  );
  stagger(el);
}

for (const shelf of SHELVES) loadShelf(shelf).catch((e) => console.warn("media shelf", e));
