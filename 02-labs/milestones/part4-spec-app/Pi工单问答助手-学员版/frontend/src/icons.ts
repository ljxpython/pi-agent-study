export type IconName =
  | "file"
  | "search"
  | "report"
  | "settings"
  | "chevron-left"
  | "chevron-right"
  | "plus"
  | "close"
  | "send"
  | "message"
  | "info"
  | "check";

const PATHS: Record<IconName, string[]> = {
  file: [
    "M6 2.5h8l4 4V21H6z",
    "M14 2.5V7h4",
    "M9 11h6",
    "M9 15h6",
  ],
  search: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z", "m16.2 16.2 4.3 4.3"],
  report: [
    "M6 2.5h8l4 4V21H6z",
    "M14 2.5V7h4",
    "M9 11h6",
    "M9 15h6",
  ],
  settings: [
    "M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z",
    "m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3h-.2a1.8 1.8 0 0 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z",
  ],
  "chevron-left": ["m15 5-7 7 7 7"],
  "chevron-right": ["m9 5 7 7-7 7"],
  plus: ["M12 5v14", "M5 12h14"],
  close: ["m6 6 12 12", "m18 6-12 12"],
  send: ["m21 3-7.1 18-3.5-7.4L3 10.1 21 3Z", "m10.4 13.6 4-4"],
  message: ["M5 5.5h14v10H9l-4 3v-3H5z", "M8.5 9h7", "M8.5 12h4.5"],
  info: ["M12 11v5", "M12 7.5h.01", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"],
  check: ["m5 12 4.5 4.5L19 7"],
};

export function createIcon(name: IconName, label?: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("focusable", "false");
  if (label) {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", label);
  } else {
    svg.setAttribute("aria-hidden", "true");
  }
  for (const pathData of PATHS[name]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    svg.append(path);
  }
  return svg;
}
