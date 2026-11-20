// About → "my media gems": clicking Albums / Books / Movies / Dramas shows that shelf.
// Arrow keys, Home and End move between tabs (WAI-ARIA tabs pattern).

const tabs = [...document.querySelectorAll(".media-tab")];
const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));

// Section highlights: each one draws itself on, left to right, once its heading is mostly on screen.
if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const titles = document.querySelectorAll(".hl-title");
  document.documentElement.classList.add("hl-armed");
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      // draw once it is 60% on screen; one already above the window (jumped past) just shows
      if (e.intersectionRatio < 0.6 && e.boundingClientRect.bottom > 0) continue;
      e.target.classList.add("is-drawn");
      io.unobserve(e.target);
    }
  }, { threshold: [0, 0.6], rootMargin: "0px 0px -8% 0px" });
  titles.forEach((t) => io.observe(t));
}

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

// A cover with a link opens it in a new tab; the click sound comes from sfx.js like every link.
function coverEl(title, sub, src, lazy, w, h, href) {
  const el = document.createElement(href ? "a" : "div");
  el.className = "cover";
  if (href) {
    el.href = href;
    el.target = "_blank";
    el.rel = "noopener";
  }
  const img = document.createElement("img");
  img.src = src;
  img.alt = sub ? `${title} — ${sub}` : title;
  if (lazy) img.loading = "lazy";
  if (+w && +h) { img.width = +w; img.height = +h; } // reserves the cover's shape before it loads
  const cap = document.createElement("span");
  cap.className = "cover-cap";
  const t = document.createElement("span");
  t.className = "cover-title";
  t.textContent = title;
  const s = document.createElement("span");
  s.className = "cover-sub";
  s.textContent = sub;
  cap.append(t, s);
  el.append(img, cap);
  return el;
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
    ...rows.map((row) => coverEl(clean(row.title), clean(sub(row)), coverSrc(table, clean(row.file_name)), panel !== "panel-albums", row.width, row.height,
      clean(row.links || row.link)))
  );
  stagger(el);
}

for (const shelf of SHELVES) loadShelf(shelf).catch((e) => console.warn("media shelf", e));

// play an orb's wiggle clip while it's focused (none for reduced motion)
const calm = matchMedia("(prefers-reduced-motion: reduce)");
function playWiggle(memory, on) {
  const v = memory.querySelector(".memory-wiggle");
  if (!v || calm.matches) return;
  if (!on) return v.pause();
  if (!v.getAttribute("src")) v.src = v.dataset.src;
  v.play().catch(() => {});
}

// About-me photos come from the Supabase "me" table (files in mywebby/me/). Rows with a caption
// are the core-memory orbs; rows without one aren't shown on the page right now. Each row finds its
// spot by file name (data-me in about.html), so the orbs keep their places and colours.
async function loadMe() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/me?select=*`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  if (!r.ok) throw new Error(`me: ${r.status}`);
  for (const row of await r.json()) {
    const file = clean(row.file_name);
    const img = file && document.querySelector(`[data-me="${CSS.escape(file.replace(/\.[^.]+$/, ""))}"]`);
    if (!img) continue;
    img.src = coverSrc("me", file);
    const memory = img.closest(".memory");
    if (!memory) continue;
    img.removeAttribute("style");
    img.classList.add("is-fitted");
    img.alt = ""; // the caption below names it
    const caption = clean(row.caption);
    if (caption) memory.querySelector(".memory-cap").textContent = caption;
    // the wiggle clip that plays on hover; it loads the first time the orb is focused
    const clip = clean(row.heic);
    if (clip && !memory.querySelector(".memory-wiggle")) {
      const v = document.createElement("video");
      v.className = "memory-wiggle";
      v.dataset.src = coverSrc("me", clip);
      v.muted = v.loop = v.playsInline = true;
      v.preload = "none";
      v.setAttribute("aria-hidden", "true");
      v.addEventListener("playing", () => v.classList.add("is-ready"), { once: true });
      img.after(v);
      if (memory.classList.contains("is-focus")) playWiggle(memory, true);
    }
  }
}
loadMe().catch((e) => console.warn("me photos", e));

// Core memories: a carousel. All the orbs ride one big tilted ring, so the ones at the back shrink
// and fade while the front ones come forward, and each breathes a little, out of step with the
// rest. Hover or focus one and the others blur and fade back (blur via CSS .has-focus / .is-focus)
// while the ring eases almost to a stop; the focused orb comes to the front and grows.
// Values tuned in the "Memory orbs motion lab" artifact.
{
  const field = document.querySelector(".memory-field");
  const orbs = field ? [...field.querySelectorAll(".memory")] : [];
  const SPEED = 0.4, SYNC = 0.8, BREATHE = 0.025, SHIMMER = 0.45;
  const DIM = 0.5, BLUR = 6, CALM = 0.9, LIFT = 1.15;
  const DEPTH_BLUR = 5; // px of blur on the orb at the very back of the ring; the front one is sharp
  const SIZE = 256, TAU = Math.PI * 2;
  // the ring: a wide, flat oval tipped a few degrees. Its width is fitted (fit below) so the
  // outermost orbs just reach the field's edges, which sit on the page's 120px side padding.
  const RY = 175, CY = 330;
  let RX = 480, CX = 600;
  const TIP = (-7 * Math.PI) / 180, COS = Math.cos(TIP), SIN = Math.sin(TIP);
  // size by depth: every orb on the front half of the ring is the same size (none swells as it
  // passes the middle); along the back half they ease down to half that at the very back
  const FRONT = 0.92, BACK = 0.48;
  const sizeAt = (d) => { const k = Math.min(1, d / 0.5); return BACK + (FRONT - BACK) * k * k * (3 - 2 * k); };
  // how far the ring reaches from its centre (orb edges included, at full breath) for a given width
  const reach = (rx) => {
    let m = 0;
    for (let a = 0; a < TAU; a += TAU / 360) {
      const ex = rx * Math.cos(a), ey = RY * Math.sin(a);
      m = Math.max(m, Math.abs(ex * COS - ey * SIN) + (SIZE * sizeAt((Math.sin(a) + 1) / 2) * (1 + BREATHE)) / 2);
    }
    return m;
  };
  const fit = () => {
    const half = field.clientWidth / 2;
    CX = half;
    RX = Math.max(0, half - 125);
    for (let i = 0; i < 4; i++) RX = Math.max(0, RX - (reach(RX) - half));
  };
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let focus = -1, t = 0, eff = 1, last = 0, raf = 0, onScreen = true;
  const dims = orbs.map(() => 1); // eases 1 → 0 as an orb fades back for another's focus

  const setFocus = (i) => {
    focus = i;
    field.classList.toggle("has-focus", i >= 0);
    orbs.forEach((o, j) => {
      if (o.classList.contains("is-focus") !== (i === j)) playWiggle(o, i === j);
      o.classList.toggle("is-focus", i === j);
    });
  };
  orbs.forEach((o, i) => {
    o.style.left = o.style.top = "0";
    o.addEventListener("mouseenter", () => setFocus(i));
    o.addEventListener("mouseleave", () => { if (focus === i) setFocus(-1); });
    o.addEventListener("focus", () => setFocus(i));
    o.addEventListener("blur", () => { if (focus === i) setFocus(-1); });
  });

  const place = (dt) => {
    eff += ((focus >= 0 ? 1 - CALM : 1) - eff) * Math.min(1, dt * 3.5);
    if (!still) t += dt * eff * SPEED;
    const n = orbs.length;
    orbs.forEach((o, i) => {
      const phase = (SYNC * i * TAU) / n;
      const ang = t * 0.6 + (i * TAU) / n;
      const d = (Math.sin(ang) + 1) / 2; // 0 at the back of the ring, 1 at the front
      const on = focus === i;
      const breath = 1 + BREATHE * Math.sin(t * 2.2 + phase * 1.3);
      const scale = breath * (on ? LIFT : 1) * sizeAt(d);
      dims[i] += ((focus >= 0 && !on ? 0 : 1) - dims[i]) * Math.min(1, dt * 6);
      const back = 1 - dims[i];
      const ex = RX * Math.cos(ang), ey = RY * Math.sin(ang);
      const x = CX + ex * COS - ey * SIN - SIZE / 2, y = CY + ex * SIN + ey * COS - SIZE / 2;
      o.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(4)})`;
      o.style.opacity = (1 - back * (1 - DIM)).toFixed(3);
      const blur = on ? 0 : (1 - d) * DEPTH_BLUR + back * BLUR;
      o.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "none";
      o.style.zIndex = on ? 200 : Math.round(10 + d * 100);
      o.style.setProperty("--sheen", `${((t * SHIMMER * 90 + i * 47) % 360).toFixed(1)}deg`);
    });
  };
  const frame = (now) => {
    place(Math.min(0.05, (now - last) / 1000 || 0));
    last = now;
    raf = onScreen ? requestAnimationFrame(frame) : 0;
  };

  if (orbs.length) {
    fit();
    addEventListener("resize", () => { fit(); if (still) place(0); });
    place(0); // lay the ring out once, so it's right even before (or without) the motion
    // reduced motion: the ring stands still, and focusing an orb still blurs the rest
    if (!still) {
      // only animate while the field is on screen
      new IntersectionObserver(([e]) => {
        onScreen = e.isIntersecting;
        if (onScreen && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
      }).observe(field);
    } else {
      orbs.forEach((o) => {
        const redo = () => place(1); // dims settle at once
        o.addEventListener("mouseenter", redo); o.addEventListener("mouseleave", redo);
        o.addEventListener("focus", redo); o.addEventListener("blur", redo);
      });
    }
  }
}
