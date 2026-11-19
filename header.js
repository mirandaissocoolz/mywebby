// Header click states. Clicking Work / About / Resume makes it the current page (plain ink,
// Medium). The shooting star toggles on click (on = plain ink at full opacity, no glow). The
// moon switches the site between light and dark mode (Figma "Home — Dark Mode" 472:304) and
// remembers the choice for the next visit.

const links = document.querySelectorAll(".nav a");
for (const link of links) {
  link.addEventListener("click", () => {
    for (const l of links) l.removeAttribute("aria-current");
    link.setAttribute("aria-current", "page");
  });
}

const star = document.querySelector(".shooting-star");
star?.addEventListener("click", (e) => {
  e.preventDefault(); // no page yet: don't jump to the top
  const on = star.classList.toggle("is-active");
  star.setAttribute("aria-pressed", String(on));
});

const root = document.documentElement;
const moon = document.querySelector(".moon");
function setDark(on) {
  if (on) root.dataset.theme = "dark"; else delete root.dataset.theme;
  moon.classList.toggle("is-active", on);
  moon.setAttribute("aria-pressed", String(on));
  try { localStorage.setItem("theme", on ? "dark" : "light"); } catch {}
}
if (moon) { // About has no moon; it just follows the saved theme
  moon.classList.toggle("is-active", root.dataset.theme === "dark");
  moon.setAttribute("aria-pressed", String(root.dataset.theme === "dark"));
  moon.addEventListener("click", () => setDark(root.dataset.theme !== "dark"));
}

// turn on the theme cross-fade only after the first paint
requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("theme-ready")));
