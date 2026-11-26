// Notion-style toggles: Work and Play on Home, and each award on About. Clicking the caret (or the
// title) flips aria-expanded; CSS turns the caret and folds the content open or shut (.fold). While
// a fold is shut it is inert, so its contents can't be tabbed into or read out.

function setOpen(btn, open) {
  const fold = document.getElementById(btn.getAttribute("aria-controls"));
  if (!fold) return;
  btn.setAttribute("aria-expanded", String(open));
  fold.inert = !open;
}

const touched = new WeakSet(); // toggles the visitor has clicked themselves
for (const btn of document.querySelectorAll(".section-toggle, .award-row")) {
  btn.addEventListener("click", () => {
    touched.add(btn);
    setOpen(btn, btn.getAttribute("aria-expanded") !== "true");
  });
}

// Home: Play starts closed, so a first-time visitor might never find it. When they scroll to the end
// of Work (Play's title comes up into the lower part of the window), Play opens by itself: the caret
// turns and the cards fold open. It only happens once, only while Work is open, and never if the
// visitor has already opened or closed Play themselves.
const play = document.querySelector('.section-toggle[aria-controls="play-gallery"]');
const work = document.querySelector('.section-toggle[aria-controls="work-gallery"]');
if (play && work && "IntersectionObserver" in window) {
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    if (touched.has(play) || play.getAttribute("aria-expanded") === "true") return io.disconnect();
    if (work.getAttribute("aria-expanded") !== "true") return; // try again next time it comes into view
    io.disconnect();
    setOpen(play, true);
  }, { rootMargin: "0px 0px -25% 0px" }); // once the title is a quarter of the way up from the bottom
  io.observe(play);
}
