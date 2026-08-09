// export.js — the elevation as a standalone svg, and that svg rasterized.
//
// toSvg() is pure and reads the same model the dom renders, so an export can
// never drift from what is on screen. no image library: png is the svg through
// a canvas.

import { chassisById, heightMm, powerOf } from "./model.js";
import { rowSpanFor, colSpanFor } from "./grid.js";

const PAD = 18;
const LABEL_W = 30;
const RACK_W = 430;
const U_H = 46;
const HEAD = 46;
const FOOT = 26;
// the power gauge beside the rack, mirroring the on-screen widget: bar, then a
// gap, then the readout printed bottom-to-top so the column stays narrow
const GAUGE_W = 22;
const GAUGE_GAP = 12;
const READ_W = 18;

const BG = "#0E0E1A";
const INSET = "#0A0A14";
const LINE = "#3A3A66";
const LINE_DIM = "#262645";
const TEXT = "#F4F4FF";
const MUTED = "#8888B0";
const DIM = "#5B5B84";
const TICK = "#8282AF";

// same thresholds-to-colour mapping the stylesheet uses, so a printed plan and
// the screen agree about when a rack is getting tight
const GAUGE_COLORS = {
  "": ["#00F0A8", "#4EE6FF"],
  "is-warn": ["#FFC64B", "#FFC64B"],
  "is-bad": ["#FF6E5E", "#FF6E5E"],
  "is-idle": [DIM, DIM],
};

/**
 * `icons` is a Map of icon-reference -> data: URI, from icons.resolveIcons().
 * Passing it in keeps this function pure and synchronous, which is what makes
 * it testable and what guarantees the export cannot drift from the DOM. Omit it
 * and library icons simply fall back to their glyph.
 */
export function toSvg(state, { title = "rack plan", icons = new Map() } = {}) {
  const chassis = chassisById(state.chassisId);
  const rows = chassis.u * 2;
  const rackH = chassis.u * U_H;
  const w = PAD * 2 + LABEL_W + RACK_W + GAUGE_GAP + GAUGE_W + READ_W;
  const h = PAD * 2 + HEAD + rackH + FOOT;

  // y of the TOP edge of a half-U row, given rows count up from the bottom
  const yOf = (row) => PAD + HEAD + rackH - row * (U_H / 2);
  const x0 = PAD + LABEL_W;

  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="JetBrains Mono, ui-monospace, monospace">`,
  );
  parts.push(`<rect width="${w}" height="${h}" fill="${BG}"/>`);

  // header
  parts.push(
    `<text x="${PAD}" y="${PAD + 18}" fill="${TEXT}" font-size="15" font-weight="700">${esc(title)}</text>`,
  );
  const watts = state.items.reduce((n, i) => n + (Number(i.watts) || 0), 0);
  const budgetW = Math.max(0, Number(state.budgetW) || 0);
  const power = budgetW ? `${watts}w of ${budgetW}w` : `${watts}w`;
  const sub = `${chassis.u}u · 10" · ${state.depthMm}mm deep · ${state.items.length} device${state.items.length === 1 ? "" : "s"} · ${power}`;
  parts.push(
    `<text x="${PAD}" y="${PAD + 36}" fill="${MUTED}" font-size="11">${esc(sub)}</text>`,
  );

  // rack well
  parts.push(
    `<rect x="${x0}" y="${PAD + HEAD}" width="${RACK_W}" height="${rackH}" fill="${INSET}" stroke="${LINE}" stroke-width="1.5" rx="4"/>`,
  );

  // U rules + labels, numbered from the bottom
  for (let u = 0; u < chassis.u; u++) {
    const y = PAD + HEAD + rackH - u * U_H;
    if (u > 0) {
      parts.push(
        `<line x1="${x0}" y1="${y}" x2="${x0 + RACK_W}" y2="${y}" stroke="${LINE_DIM}" stroke-width="1"/>`,
      );
    }
    parts.push(
      `<text x="${x0 - 8}" y="${y - U_H / 2 + 4}" fill="${DIM}" font-size="10" text-anchor="end">${u + 1}</text>`,
    );
  }
  // centre divider showing the two half-width bays
  parts.push(
    `<line x1="${x0 + RACK_W / 2}" y1="${PAD + HEAD}" x2="${x0 + RACK_W / 2}" y2="${PAD + HEAD + rackH}" stroke="${LINE_DIM}" stroke-width="1" stroke-dasharray="3 5"/>`,
  );

  // devices
  for (const it of state.items) {
    const rowSpan = rowSpanFor(it.u);
    const colSpan = colSpanFor(it.width);
    const col = it.width === "half" ? it.col : 0;
    const bw = (RACK_W / 2) * colSpan - 4;
    const bx = x0 + (RACK_W / 2) * col + 2;
    const by = yOf(it.row + rowSpan) + 2;
    const bh = (U_H / 2) * rowSpan - 4;
    const c = it.color || "#7D56F4";

    parts.push(
      `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="3" fill="${c}" fill-opacity="0.16" stroke="${c}" stroke-width="1.5"/>`,
    );
    parts.push(
      `<rect x="${bx}" y="${by}" width="3" height="${bh}" rx="1.5" fill="${c}"/>`,
    );

    const fs = bh < 18 ? 9 : 11;
    const art = icons.get(it.icon);
    let textX = bx + 10;
    if (art) {
      // a resolved library icon renders as an inlined image, so the exported
      // svg stands alone with no network
      const sz = Math.min(14, bh - 8);
      parts.push(
        `<image x="${bx + 9}" y="${by + (bh - sz) / 2}" width="${sz}" height="${sz}" href="${esc(art)}"/>`,
      );
      textX = bx + 9 + sz + 6;
    }
    // no art: a glyph prints as itself; a reference — unresolved, or resolved
    // to null by a failed fetch — prints the fallback glyph, never "sh:foo" as
    // literal text. The docs and the PR both promise a dead icon degrades to a
    // glyph; the icons.has() special-case used to print name-only instead.
    const label = art
      ? it.name
      : `${it.icon ? glyphOf(it.icon) + " " : ""}${it.name}`;
    const avail = Math.max(0, bx + bw - textX - 8);
    parts.push(
      `<text x="${textX}" y="${by + bh / 2 + fs / 3}" fill="${TEXT}" font-size="${fs}">${esc(clip(label, Math.floor(avail / (fs * 0.62))))}</text>`,
    );
    if (bh >= 26) {
      const meta = `${fmtU(it.u)}u${it.watts ? ` · ${it.watts}w` : ""}`;
      parts.push(
        `<text x="${bx + bw - 8}" y="${by + bh / 2 + 4}" fill="${MUTED}" font-size="9" text-anchor="end">${esc(meta)}</text>`,
      );
    }
  }

  // ── power gauge ──────────────────────────────────────────────────────────
  // Stands beside the rack at its full height, so the fill reads as "how much
  // of the budget is spent" at a glance — the same thing the app shows. A plan
  // you hand someone should carry its power story, not just its shelves.
  {
    const gx = x0 + RACK_W + GAUGE_GAP;
    const gy = PAD + HEAD;
    const p = powerOf(state.items, state.budgetW);
    const [gauge, gaugeHi] = GAUGE_COLORS[p.level] ?? GAUGE_COLORS[""];

    parts.push(
      `<rect x="${gx}" y="${gy}" width="${GAUGE_W}" height="${rackH}" rx="4" fill="${INSET}" stroke="${LINE}" stroke-width="1.5"/>`,
    );

    // quarter marks, in a mid-tone that reads against the empty track and the
    // bright fill alike — drawn over the fill so the scale stays continuous
    const ticks = [];
    for (let q = 1; q <= 3; q++) {
      const ty = gy + rackH * (q / 4);
      ticks.push(
        `<line x1="${gx}" y1="${ty}" x2="${gx + GAUGE_W}" y2="${ty}" stroke="${TICK}" stroke-opacity="0.5" stroke-width="1"/>`,
      );
    }

    if (p.budgetW) {
      // over budget pins at full: past 100% there is no more bar to give
      const frac = Math.min(1, p.pct / 100);
      const fh = Math.round(rackH * frac);
      if (fh > 0) {
        parts.push(
          `<defs><linearGradient id="pg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${gauge}"/><stop offset="1" stop-color="${gaugeHi}"/></linearGradient></defs>`,
        );
        parts.push(
          `<rect x="${gx}" y="${gy + rackH - fh}" width="${GAUGE_W}" height="${fh}" fill="url(#pg)"/>`,
        );
        // the bright lip, so it reads as a level rather than a block
        parts.push(
          `<rect x="${gx}" y="${gy + rackH - fh}" width="${GAUGE_W}" height="2" fill="${TEXT}" fill-opacity="0.85"/>`,
        );
      }
    }
    parts.push(...ticks);

    const readout = p.budgetW ? `${p.watts}w / ${p.budgetW}w` : `${p.watts}w`;
    const rx = gx + GAUGE_W + 12;
    const ry = gy + rackH;
    parts.push(
      `<text x="${rx}" y="${ry}" transform="rotate(-90 ${rx} ${ry})" fill="${gauge}" font-size="9" letter-spacing="0.4">${esc(readout)}</text>`,
    );
  }

  // footer
  const totalMm = heightMm(chassis.u);
  parts.push(
    `<text x="${PAD}" y="${h - PAD + 4}" fill="${DIM}" font-size="9">${esc(`${totalMm}mm of panel · 1u = 44.45mm · generated by rack planner`)}</text>`,
  );

  parts.push("</svg>");
  return parts.join("\n");
}

/** an unresolved "sh:foo"/"si:foo" reference must not print as literal text. */
function glyphOf(icon) {
  return /^(sh|si):/i.test(String(icon)) ? "\u25aa" : icon;
}

export function fmtU(u) {
  return Number.isInteger(u) ? String(u) : String(u).replace(/^0\./, ".");
}

function clip(s, max) {
  if (max <= 1) return "";
  return s.length <= max ? s : s.slice(0, Math.max(1, max - 1)) + "…";
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** rasterize an svg string at `scale`x. browser only. */
export function toPng(svg, scale = 2) {
  return new Promise((resolve, reject) => {
    const m = /width="(\d+)" height="(\d+)"/.exec(svg);
    if (!m) return reject(new Error("could not size the svg"));
    const [w, h] = [Number(m[1]), Number(m[2])];
    const img = new Image();
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("canvas produced no blob"))),
        "image/png",
      );
    };
    img.onerror = () => reject(new Error("the svg would not load as an image"));
    img.src = url;
  });
}

export function download(filename, blobOrString, mime = "text/plain") {
  const blob =
    typeof blobOrString === "string"
      ? new Blob([blobOrString], { type: mime })
      : blobOrString;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
