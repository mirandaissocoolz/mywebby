// Contact: clicking the nav's Contact button copies the email straight away, plays the
// celebration sound and turns the button itself into the green "Email Copied" pill
// (Figma 467:382). Clicking Email Copied (or pressing Escape) turns it back into Contact.

import { play } from "./sfx.js";

const btn = document.querySelector(".contact-toggle");
const status = document.getElementById("contact-status");
const EMAIL = btn.dataset.email;

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
// The Contact slot in the nav keeps its width the whole time, so Work / About / Resume never
// move (they used to slide left, out from under the cursor). The wider Email Copied pill grows
// into the empty page margin on the right, and only if that margin is too narrow does it also
// reach a little to the left.
// Widths come from the computed style (CSS px), not getBoundingClientRect, which is in screen
// px and so shrinks with the page zoom (--s).
const wrap = btn.parentElement; // .contact
const cssWidth = () => parseFloat(getComputedStyle(btn).width);
function morph(apply) {
  const from = cssWidth();
  if (!wrap.style.width) wrap.style.width = from + "px"; // lock the slot
  const slot = parseFloat(wrap.style.width);
  btn.style.transition = "none"; // measure the new label's natural width without animating
  btn.style.width = "";
  apply();
  const to = cssWidth();
  btn.style.width = from + "px";
  void btn.offsetWidth;
  btn.style.transition = "";

  let shift = 0;
  const grow = to - slot;
  if (grow > 0) {
    const r = wrap.getBoundingClientRect();
    const k = r.width / slot;                                   // screen px per CSS px
    const room = (document.documentElement.clientWidth - r.right) / k - 6; // margin, minus a sliver
    shift = -Math.max(0, grow - Math.max(0, room));
  }
  btn.style.left = shift + "px";
  btn.style.width = to + "px";
}
btn.addEventListener("transitionend", (e) => {
  if (e.propertyName !== "width") return;
  btn.style.width = ""; // back to hugging its label
  if (!btn.classList.contains("is-copied")) { wrap.style.width = ""; btn.style.left = ""; }
});

function showCopied() {
  morph(() => btn.classList.add("is-copied"));
  btn.setAttribute("aria-label", "Email copied");
  status.textContent = "";
  status.textContent = "Email copied";
}

function reset() {
  if (!btn.classList.contains("is-copied")) return;
  morph(() => btn.classList.remove("is-copied"));
  btn.removeAttribute("aria-label");
}

btn.addEventListener("click", async () => {
  if (btn.classList.contains("is-copied")) { play("click"); reset(); return; } // toggle back
  play("celebrate");
  if (await copyText(EMAIL)) showCopied();
  else location.href = `mailto:${EMAIL}`; // copying blocked: open the mail app instead
});

addEventListener("keydown", (e) => {
  if (e.key === "Escape") reset();
});
