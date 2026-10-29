/** Desktop-only resizing. Collapsed state stays owned by the application. */
export function setupLayout(workspace: HTMLElement, collapsed: () => [boolean, boolean]) {
  const widths = [280, 280];
  const minimum = 220, maximum = 440, rail = 44, center = 480, handles = 12;
  const separators = ["资料", "成果"].map((name, index) => {
    const el = document.createElement("div");
    el.className = `panel-separator separator-${index}`;
    el.tabIndex = 0;
    el.setAttribute("role", "separator");
    el.setAttribute("aria-orientation", "vertical");
    el.setAttribute("aria-label", `调整${name}栏宽度`);
    workspace.append(el);
    return el;
  });
  const mobile = () => window.innerWidth < 1100;
  function limit(index: number) {
    const other = 1 - index;
    return Math.min(maximum, workspace.clientWidth - handles - center - (collapsed()[other] ? rail : widths[other]));
  }
  function sync() {
    if (mobile()) return;
    widths[0] = Math.max(minimum, Math.min(widths[0], limit(0)));
    widths[1] = Math.max(minimum, Math.min(widths[1], limit(1)));
    const closed = collapsed();
    workspace.style.setProperty("--left-width", `${closed[0] ? rail : widths[0]}px`);
    workspace.style.setProperty("--right-width", `${closed[1] ? rail : widths[1]}px`);
    separators.forEach((el, i) => {
      el.tabIndex = closed[i] ? -1 : 0;
      el.setAttribute("aria-disabled", String(closed[i]));
      el.setAttribute("aria-valuemin", String(minimum));
      el.setAttribute("aria-valuemax", String(limit(i)));
      el.setAttribute("aria-valuenow", String(widths[i]));
      el.setAttribute("aria-valuetext", closed[i] ? "已收起" : `${widths[i]}像素`);
    });
  }
  separators.forEach((el, i) => {
    let drag: { id: number; x: number; width: number } | null = null;
    el.addEventListener("pointerdown", event => {
      if (mobile() || collapsed()[i] || event.button !== 0) return;
      event.preventDefault(); el.focus();
      drag = { id: event.pointerId, x: event.clientX, width: widths[i] };
      el.setPointerCapture(event.pointerId); el.classList.add("dragging");
    });
    el.addEventListener("pointermove", event => {
      if (!drag || event.pointerId !== drag.id || mobile() || collapsed()[i]) return;
      widths[i] = Math.max(minimum, Math.min(limit(i), drag.width + (event.clientX - drag.x) * (i === 0 ? 1 : -1)));
      sync();
    });
    const end = () => { drag = null; el.classList.remove("dragging"); };
    el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end); el.addEventListener("lostpointercapture", end);
    el.addEventListener("dblclick", () => { if (!collapsed()[i]) { widths[i] = 280; sync(); } });
    el.addEventListener("keydown", event => {
      if (mobile() || collapsed()[i] || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const delta = (event.key === "ArrowRight" ? 20 : -20) * (i === 0 ? 1 : -1);
      widths[i] = event.key === "Home" ? minimum : event.key === "End" ? limit(i) : Math.max(minimum, Math.min(limit(i), widths[i] + delta));
      sync();
    });
  });
  window.addEventListener("resize", sync);
  return sync;
}
