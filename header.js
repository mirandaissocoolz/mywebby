// Header click states. Clicking Work / About / Resume makes it the current page (plain black,
// Medium, no glow). The shooting star and moon toggle on click: on = plain black at full
// opacity with no glow, click again to turn it off.

const links = document.querySelectorAll(".nav a");
for (const link of links) {
  link.addEventListener("click", () => {
    for (const l of links) l.removeAttribute("aria-current");
    link.setAttribute("aria-current", "page");
  });
}

for (const icon of document.querySelectorAll(".shooting-star, .moon")) {
  icon.addEventListener("click", (e) => {
    if (icon.matches("a[href='#']")) e.preventDefault(); // no page yet: don't jump to the top
    const on = icon.classList.toggle("is-active");
    icon.setAttribute("aria-pressed", String(on));
  });
}
