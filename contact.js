// Contact: clicking the nav's Contact button copies the email straight away, plays the
// celebration sound and turns the button itself into the green "Email Copied" pill
// (Figma 467:382). It eases back to Contact after a few seconds, on a click elsewhere, or
// on Escape. Clicking it again copies and celebrates again.

import { play } from "./sfx.js";

const btn = document.querySelector(".contact-toggle");
const status = document.getElementById("contact-status");
const EMAIL = btn.dataset.email;
const SHOW_FOR = 3000; // ms the Email Copied state stays up
let timer = 0;

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / insecure origins: fall back to a hidden textarea.
    const ta = Object.assign(document.createElement("textarea"), { value: text });
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

// Swap the button's state and ease its width from the old label's size to the new one's. The
// label stays full size; the button just widens (clipping it) until it fits.
// Widths come from the computed style (CSS px), not getBoundingClientRect, which is in screen
// px and so shrinks with the page zoom (--s).
const cssWidth = () => parseFloat(getComputedStyle(btn).width);
function morph(apply) {
  const from = cssWidth();
  btn.style.transition = "none"; // measure the new label's natural width without animating
  btn.style.width = "";
  apply();
  const to = cssWidth();
  btn.style.width = from + "px";
  void btn.offsetWidth;
  btn.style.transition = "";
  btn.style.width = from + "px";
  void btn.offsetWidth;
  btn.style.width = to + "px";
}
btn.addEventListener("transitionend", (e) => {
  if (e.propertyName === "width") btn.style.width = ""; // back to hugging its label
});

function showCopied() {
  clearTimeout(timer);
  if (!btn.classList.contains("is-copied")) morph(() => btn.classList.add("is-copied"));
  btn.setAttribute("aria-label", "Email copied");
  status.textContent = "";
  status.textContent = "Email copied";
  timer = setTimeout(reset, SHOW_FOR);
}

function reset() {
  clearTimeout(timer);
  if (!btn.classList.contains("is-copied")) return;
  morph(() => btn.classList.remove("is-copied"));
  btn.removeAttribute("aria-label");
}

btn.addEventListener("click", async () => {
  play("celebrate");
  if (await copyText(EMAIL)) showCopied();
  else location.href = `mailto:${EMAIL}`; // copying blocked: open the mail app instead
});

addEventListener("keydown", (e) => {
  if (e.key === "Escape") reset();
});
addEventListener("pointerdown", (e) => {
  if (!e.target.closest(".contact")) reset();
});
