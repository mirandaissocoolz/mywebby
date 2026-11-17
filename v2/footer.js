// Footer stamp collage. The card starts empty; each click on an empty spot (anything but
// the Find Me / Pages links) stamps the next stamp in STAMPS, centred on the click. After
// the first stamp, the next one rides on the cursor, see-through, as a preview. Once every
// stamp has been placed, the collage starts to shimmer and the order starts over.
//
// Add ?stamps=all to the URL to see every stamp where it sits in the Figma design.

// In the order they get stamped. w/h are the SVGs' own sizes, rot is the turn they have
// in Figma, and x/y is where their centre sits on the card in the Figma layout.
const STAMPS = [
  { src: "assets/figma/stamps/good-design.svg", w: 217.215, h: 56.049, rot: 0,  x: 786.21,  y: 322.63 },
  { src: "assets/figma/stamps/progress.svg",    w: 255.732, h: 90.470, rot: 6,  x: 830.53,  y: 425.85 },
  { src: "assets/figma/stamps/arrow.svg",       w: 82.942,  h: 182.719, rot: -6, x: 960.83, y: 299.06 },
  { src: "assets/figma/stamps/circle.svg",      w: 53.755,  h: 53.756, rot: 0,  x: 855.30,  y: 240.75 },
  { src: "assets/figma/stamps/explore.svg",     w: 143.230, h: 143.198, rot: 0, x: 1036,    y: 440 },
  { src: "assets/figma/stamps/star.svg",        w: 95.996,  h: 96.462, rot: 0,  x: 1101.43, y: 318.08 },
];
const CARD_W = 1130;   // the card's width on the Figma grid; the stage is scaled from it
const JITTER = 4;      // stamps after the first round land up to ± this many degrees off

const card = document.querySelector(".footer-card");
const layer = card.querySelector(".footer-stamps");
const ghost = card.querySelector(".stamp-ghost");
// One image per stamp for the ghost, so swapping to the next one never flashes the last.
const ghostImgs = STAMPS.map((st) => {
  const img = document.createElement("img");
  img.alt = "";
  img.dataset.src = st.src;
  return img;
});

let placed = 0;        // how many stamps are on the card
let nextRot = 0;       // the turn the next stamp will have (the ghost shows it too)
let aimX = 0, aimY = 0, aimFrame = 0;

const next = () => STAMPS[placed % STAMPS.length];

// The stamp SVGs are heavy (lots of texture), so fetch them only once the footer is near.
let loaded = false;
function preload() {
  if (loaded) return;
  loaded = true;
  for (const img of ghostImgs) { img.src = img.dataset.src; img.decode().catch(() => {}); }
  setGhost();
}
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { preload(); io.disconnect(); }
  }, { rootMargin: "600px" });
  io.observe(card);
} else {
  preload();
}

function makeStamp(s, x, y, rot) {
  const el = document.createElement("span");
  el.className = "stamp";
  const left = x - s.w / 2, top = y - s.h / 2;
  el.style.cssText =
    `left:${x}px;top:${y}px;width:${s.w}px;height:${s.h}px;--rot:${rot}deg;` +
    `--sx:${left}px;--sy:${top}px;--mask:url("${s.src}")`;
  const img = document.createElement("img");
  img.src = s.src;
  img.alt = "";
  img.draggable = false;
  const shine = document.createElement("span");
  shine.className = "stamp-shine";
  el.append(img, shine);
  layer.append(el);
  return el;
}

function setGhost() {
  const s = next();
  ghost.style.width = `${s.w}px`;
  ghost.style.height = `${s.h}px`;
  ghost.replaceChildren(ghostImgs[placed % STAMPS.length]);
}

function rollRot() {
  const s = next();
  nextRot = placed < STAMPS.length ? s.rot : s.rot + (Math.random() * 2 - 1) * JITTER;
}

// Pointer position on the unscaled card grid.
function toCard(e) {
  const r = card.getBoundingClientRect();
  const k = CARD_W / r.width;
  return [(e.clientX - r.left) * k, (e.clientY - r.top) * k];
}

const overLinks = (e) => e.target.closest(".footer-col");

function moveGhost() {
  aimFrame = 0;
  ghost.style.transform = `translate(${aimX}px, ${aimY}px) translate(-50%, -50%) rotate(${nextRot}deg)`;
}

function aim(e) {
  const canAim = placed > 0 && e.pointerType !== "touch" && !overLinks(e);
  card.classList.toggle("is-aiming", canAim);
  if (!canAim) return;
  [aimX, aimY] = toCard(e);
  if (!aimFrame) aimFrame = requestAnimationFrame(moveGhost);
}

card.addEventListener("pointermove", aim);
card.addEventListener("pointerover", aim);
card.addEventListener("pointerleave", () => card.classList.remove("is-aiming"));

card.addEventListener("click", (e) => {
  if (overLinks(e)) return;
  preload();
  const [x, y] = toCard(e);
  const el = makeStamp(next(), x, y, nextRot);
  el.classList.add("is-new");
  el.addEventListener("animationend", () => el.classList.remove("is-new"), { once: true });

  placed++;
  if (placed === STAMPS.length) card.classList.add("is-complete");
  rollRot();
  setGhost();
  if (e.pointerType !== "touch") {
    aimX = x; aimY = y;
    moveGhost();
    aim(e);
  }
});

rollRot();
setGhost();

if (new URLSearchParams(location.search).get("stamps") === "all") {
  for (const s of STAMPS) makeStamp(s, s.x, s.y, s.rot);
  placed = STAMPS.length;
  card.classList.add("is-complete");
  rollRot();
  setGhost();
}
