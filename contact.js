// Contact: clicking the nav's Contact button copies the email straight away, plays the
// celebration sound and bounces a green "Email Copied" pill (Figma "Button/Style8") up into
// place under it. Clicking Contact again copies and celebrates again; a click elsewhere or
// Escape hides the pill.

import { play } from "./sfx.js";

const toggle = document.querySelector(".contact-toggle");
const pill = document.getElementById("contact-copied");
const status = document.getElementById("contact-status");
const EMAIL = toggle.dataset.email;

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

function show() {
  pill.hidden = false;
  pill.classList.remove("is-in");
  void pill.offsetWidth; // restart the bounce on every click
  pill.classList.add("is-in");
  status.textContent = "";
  status.textContent = "Email copied";
}

function hide() {
  pill.hidden = true;
  pill.classList.remove("is-in");
}

toggle.addEventListener("click", async () => {
  play("celebrate");
  if (await copyText(EMAIL)) show();
  else location.href = `mailto:${EMAIL}`; // copying blocked: open the mail app instead
});

addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !pill.hidden) hide();
});
addEventListener("pointerdown", (e) => {
  if (!pill.hidden && !e.target.closest(".contact")) hide();
});
