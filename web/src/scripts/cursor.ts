const HOT = "a, button, [role='button']";

const root = document.documentElement;
const fine = window.matchMedia("(pointer: fine)");
const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

const cursor = document.createElement("div");
cursor.className = "mozza-cursor";
cursor.setAttribute("aria-hidden", "true");
cursor.innerHTML = '<span class="mozza-cursor-dot"></span>';
document.body.append(cursor);

function enabled() {
  return fine.matches && !motion.matches;
}

function sync() {
  const on = enabled();
  root.classList.toggle("has-mozza-cursor", on);
  cursor.hidden = !on;
  if (!on) cursor.classList.remove("is-on", "is-down");
}

window.addEventListener("pointermove", (event) => {
  if (!enabled() || event.pointerType !== "mouse") return;
  cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
  const target = event.target;
  const hot = target instanceof Element && Boolean(target.closest(HOT));
  cursor.classList.toggle("is-on", hot);
});

window.addEventListener("pointerdown", (event) => {
  if (!enabled() || event.pointerType !== "mouse") return;
  const target = event.target;
  if (target instanceof Element && target.closest(HOT)) {
    cursor.classList.add("is-down");
  }
});

window.addEventListener("pointerup", () => {
  cursor.classList.remove("is-down");
});

document.addEventListener("mouseleave", () => {
  cursor.classList.remove("is-on", "is-down");
});

fine.addEventListener("change", sync);
motion.addEventListener("change", sync);
sync();
