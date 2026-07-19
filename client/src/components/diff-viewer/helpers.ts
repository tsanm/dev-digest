/** Pure helpers for the DiffViewer. */
import { HUNK_HEADER_RE } from "./constants";

export interface Line {
  kind: "add" | "del" | "ctx" | "hunk";
  text: string;
  oldNo?: number;
  newNo?: number;
}

/** Parse unified-diff patch text into renderable lines with old/new line numbers. */
export function parsePatch(patch: string | null | undefined): Line[] {
  if (!patch) return [];
  const out: Line[] = [];
  let oldNo = 0;
  let newNo = 0;
  for (const raw of patch.split("\n")) {
    if (raw.startsWith("@@")) {
      const m = raw.match(HUNK_HEADER_RE);
      if (m) {
        oldNo = parseInt(m[1]!, 10);
        newNo = parseInt(m[2]!, 10);
      }
      out.push({ kind: "hunk", text: raw });
    } else if (raw.startsWith("+")) {
      out.push({ kind: "add", text: raw.slice(1), newNo });
      newNo++;
    } else if (raw.startsWith("-")) {
      out.push({ kind: "del", text: raw.slice(1), oldNo });
      oldNo++;
    } else {
      out.push({ kind: "ctx", text: raw.slice(raw.startsWith(" ") ? 1 : 0), oldNo, newNo });
      oldNo++;
      newNo++;
    }
  }
  return out;
}

/** Stable DOM id for a rendered diff line (Smart Diff click-to-line anchor). */
export function diffLineAnchorId(path: string, line: number): string {
  return `dl-${path}-${line}`;
}

/** Scroll a diff line into view + brief flash (used by the "N findings" badge). */
export function scrollToDiffLine(path: string, line: number): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(diffLineAnchorId(path, line));
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.setAttribute("data-diff-line-flash", "1");
  setTimeout(() => el.removeAttribute("data-diff-line-flash"), 1200);
}
