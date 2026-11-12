export function createCddTooltip({ button, tooltip }) {
  let pinned = false;
  let hovered = false;

  function position() {
    const buttonRect = button.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const margin = 8;
    const gap = 8;
    let left = buttonRect.left + buttonRect.width / 2 - tooltipRect.width / 2;
    let top = buttonRect.bottom + gap;

    left = Math.min(
      Math.max(left, margin),
      window.innerWidth - tooltipRect.width - margin
    );

    if (top + tooltipRect.height > window.innerHeight - margin) {
      top = buttonRect.top - tooltipRect.height - gap;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(margin, top)}px`;
  }

  function show() {
    tooltip.hidden = false;
    button.setAttribute("aria-expanded", "true");
    position();
  }

  function hide(force = false) {
    if (!force && (pinned || hovered)) {
      return;
    }

    tooltip.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }

  function wireEvents() {
    button.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "touch") {
        return;
      }

      hovered = true;
      show();
    });

    button.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "touch") {
        return;
      }

      hovered = false;

      if (
        event.relatedTarget instanceof Node &&
        tooltip.contains(event.relatedTarget)
      ) {
        return;
      }

      hide();
    });

    button.addEventListener("click", () => {
      pinned = !pinned;

      if (pinned) {
        show();
      } else {
        hide();
      }
    });

    button.addEventListener("blur", (event) => {
      if (
        event.relatedTarget instanceof Node &&
        tooltip.contains(event.relatedTarget)
      ) {
        return;
      }

      pinned = false;
      hide();
    });

    tooltip.addEventListener("pointerenter", () => {
      hovered = true;
    });

    tooltip.addEventListener("pointerleave", () => {
      hovered = false;
      hide();
    });

    document.addEventListener("click", (event) => {
      if (
        tooltip.hidden ||
        button.contains(event.target) ||
        tooltip.contains(event.target)
      ) {
        return;
      }

      pinned = false;
      hovered = false;
      hide(true);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || tooltip.hidden) {
        return;
      }

      pinned = false;
      hovered = false;
      hide(true);
    });

    window.addEventListener("resize", () => {
      if (!tooltip.hidden) {
        position();
      }
    });

    document.addEventListener(
      "scroll",
      () => {
        if (!tooltip.hidden) {
          position();
        }
      },
      true
    );
  }

  return { wireEvents };
}
