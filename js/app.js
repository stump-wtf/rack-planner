// app.js — bootstrap. wires the dom together, owns the keyboard map, and
// handles share/export. everything else lives in its own module.

import { RACK_WIDTHS, chassisById, chassisFor, widthById } from "./model.js";
import { rowsFor, rowSpanFor, colSpanFor, isValid, firstFit } from "./grid.js";
import {
  state,
  subscribe,
  commit,
  undo,
  redo,
  canUndo,
  canRedo,
  loadSaved,
  loadLayout,
  rectOf,
  nextId,
  snapshot,
} from "./state.js";
import {
  initRack,
  render as renderRack,
  nudge,
  addFromCatalog,
} from "./ui-rack.js";
import {
  initPanels,
  renderPalette,
  syncPalette,
  renderInspector,
  say,
} from "./ui-panels.js";
import { encode, decode } from "./share.js";
import { toSvg, toPng, download } from "./export.js";
import { resolveIcons } from "./icons.js";
import { serialize, deserialize, isTextTarget } from "./clipboard.js";
import { initDesignsBar, renderDesignsBar } from "./ui-designs.js";

const $ = (id) => document.getElementById(id);

const rackEl = $("rack");
const rulerEl = $("ruler");
const toast = Object.assign(document.createElement("div"), {
  className: "toast",
  hidden: true,
});
document.body.appendChild(toast);

initRack({
  rackEl,
  rulerEl,
  powerEl: $("power"),
  gaugeEl: $("power-gauge"),
  fillEl: $("power-fill"),
  readEl: $("power-read"),
});
initPanels({ paletteEl: $("palette"), inspectorEl: $("inspector"), toast });
initDesignsBar({ barEl: $("designs-bar") });

// ── chassis switcher ───────────────────────────────────────────────────────

/** the size we land on when you switch widths — the one people actually own. */
const DEFAULT_FOR_WIDTH = { 10: "8u", 19: "19-12u" };

function seg(items, isOn, onPick) {
  const g = document.createElement("div");
  g.className = "seg";
  for (const it of items) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = it.label;
    if (it.title) b.title = it.title;
    b.setAttribute("aria-pressed", isOn(it) ? "true" : "false");
    b.addEventListener("click", () => onPick(it));
    g.appendChild(b);
  }
  return g;
}

function renderChassis() {
  const current = chassisById(state.chassisId);
  const width = widthById(current.width);
  $("rack-eyebrow").textContent =
    width.id === "10" ? '10" mini rack' : '19" rack';
  $("chassis").replaceChildren(
    seg(
      RACK_WIDTHS,
      (w) => w.id === current.width,
      (w) => switchChassis(DEFAULT_FOR_WIDTH[w.id]),
    ),
    // only the sizes for the width you are on — 8 buttons in one row is a
    // soup, and nobody is comparing a 10" 4u against a 42u floor rack
    seg(
      chassisFor(current.width).map((c) => ({
        ...c,
        title: c.note ? `${c.u}u · ${c.note} · ${c.depthMm}mm deep` : null,
      })),
      (c) => c.id === state.chassisId,
      (c) => switchChassis(c.id),
    ),
  );
}

/**
 * shrinking the rack can orphan devices. keep everything that still fits where
 * it is, re-seat what it can, and report anything genuinely evicted — never
 * silently vanish a device.
 *
 * Changing WIDTH orphans differently: a 10" printed pi mount does not belong in
 * a 19" rack no matter how much room is left. Those go too, and are named in
 * the same toast. Items with no `fits` predate the 19" work — they come from an
 * older share link or a saved design, and are left alone rather than
 * second-guessed.
 */
function switchChassis(id) {
  if (id === state.chassisId) return;
  const next = chassisById(id);
  const rows = rowsFor(next.u);
  const widthChanged = next.width !== chassisById(state.chassisId).width;
  commit((s) => {
    s.chassisId = id;
    // picking a rack tells you its depth — a 6u wall cabinet really is
    // shallower than a 42u floor rack. All three 10" sizes share 260mm, so
    // this is a no-op for anyone who never leaves 10".
    s.depthMm = next.depthMm;
    const kept = [];
    const evicted = [];
    for (const it of s.items) {
      if (it.fits && it.fits !== next.width) {
        evicted.push(it);
        continue;
      }
      const rect = rectOf(it);
      if (isValid(rect, rows, kept.map(rectOf))) {
        kept.push(it);
        continue;
      }
      const spot = firstFit(
        rows,
        kept.map(rectOf),
        rowSpanFor(it.u),
        colSpanFor(it.width),
      );
      if (spot) kept.push({ ...it, row: spot.row, col: spot.col });
      else evicted.push(it);
    }
    s.items = kept;
    if (!kept.some((i) => i.id === s.selectedId)) s.selectedId = null;
    if (evicted.length) {
      const names = evicted.map((e) => e.name).join(", ");
      const why = widthChanged
        ? `${widthById(next.width).label} racks do not take`
        : `no room in ${next.label} for`;
      queueMicrotask(() => say(`${why} ${names} — cmd+z to put it back`));
    }
  });
}

// ── toolbar ────────────────────────────────────────────────────────────────

$("undo").addEventListener("click", () => undo());
$("redo").addEventListener("click", () => redo());

$("clear").addEventListener("click", () => {
  if (!state.items.length) return;
  if (!confirm(`remove all ${state.items.length} devices?`)) return;
  commit((s) => {
    s.items = [];
    s.selectedId = null;
  });
  say("rack cleared — cmd+z to undo");
});

/**
 * The layout the URL fragment stands for, as of the moment it was put there —
 * or null when the URL carries no layout.
 *
 * A fragment is a frozen snapshot, but boot() prefers it over the saved design.
 * So once you shared a link (or opened someone's) and then changed anything,
 * a refresh silently reverted the change AND wrote the stale layout over your
 * saved design: edit a device's draw, reload, and both the number on screen and
 * the one in localStorage were back to what they had been at share time.
 *
 * Rather than stop putting the link in the address bar — being able to see and
 * copy it is the point — drop it the moment it stops describing what is on
 * screen. Compared against the same snapshot() the store persists, so the two
 * cannot disagree about what counts as a change. Selecting a device is not a
 * change, so the link survives a click on the way to copying it.
 */
let urlLayout = null;

function dropStaleHash() {
  if (urlLayout === null || snapshot() === urlLayout) return;
  urlLayout = null;
  history.replaceState(null, "", location.pathname + location.search);
}

$("share").addEventListener("click", async () => {
  try {
    const hash = await encode(state);
    const url = `${location.origin}${location.pathname}#${hash}`;
    history.replaceState(null, "", `#${hash}`);
    urlLayout = snapshot();
    try {
      await navigator.clipboard.writeText(url);
      say("link copied to the clipboard");
    } catch {
      say("link is in the address bar — clipboard was blocked");
    }
  } catch (err) {
    say(`could not build a link: ${err.message}`);
  }
});

$("svg").addEventListener("click", async () => {
  download(filename("svg"), await renderSvg(), "image/svg+xml");
});

/** resolve library icons to data URIs so the exported file needs no network. */
async function renderSvg() {
  let icons = new Map();
  try {
    icons = await resolveIcons(state.items);
  } catch {
    say("icons could not be fetched — exporting with glyphs");
  }
  return toSvg(state, { icons });
}

$("png").addEventListener("click", async () => {
  try {
    download(filename("png"), await toPng(await renderSvg(), 2));
  } catch (err) {
    say(`png export failed: ${err.message}`);
  }
});

function filename(ext) {
  return `rack-${chassisById(state.chassisId).label}-${state.items.length}dev.${ext}`;
}

// ── keyboard ───────────────────────────────────────────────────────────────

window.addEventListener("keydown", (ev) => {
  const t = ev.target;
  const typing =
    t instanceof HTMLElement && /^(input|select|textarea)$/i.test(t.tagName);
  const mod = ev.metaKey || ev.ctrlKey;

  if (mod && ev.key.toLowerCase() === "z") {
    ev.preventDefault();
    const ok = ev.shiftKey ? redo() : undo();
    if (!ok) say(ev.shiftKey ? "nothing to redo" : "nothing to undo");
    return;
  }
  if (typing) return;

  if (mod && ev.key.toLowerCase() === "d") {
    ev.preventDefault();
    const sel = state.items.find((i) => i.id === state.selectedId);
    if (!sel) return say("select a device first");
    if (!addFromCatalog({ ...sel })) say("no room for a copy");
    return;
  }

  if (ev.key === "Backspace" || ev.key === "Delete") {
    if (!state.selectedId) return;
    ev.preventDefault();
    commit((s) => {
      s.items = s.items.filter((i) => i.id !== s.selectedId);
      s.selectedId = null;
    });
    return;
  }

  if (ev.key === "Escape") {
    commit((s) => (s.selectedId = null), { undoable: false });
    return;
  }

  const step = ev.shiftKey ? 2 : 1; // shift moves a whole U
  const moves = {
    ArrowUp: [step, 0],
    ArrowDown: [-step, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  };
  const m = moves[ev.key];
  if (!m || !state.selectedId) return;
  ev.preventDefault();
  if (!nudge(m[0], m[1])) say("blocked");
});

// ── copy / paste ───────────────────────────────────────────────────────────
//
// These ride the browser's own copy/paste events rather than
// navigator.clipboard, which needs a permission prompt to READ and refuses
// outright when the document is not focused. clipboardData on a real user
// event needs neither, and works across tabs and windows for free.

document.addEventListener("copy", (ev) => {
  if (isTextTarget(ev.target)) return; // let the browser copy the text
  const sel = state.items.find((i) => i.id === state.selectedId);
  if (!sel) return;
  ev.preventDefault();
  ev.clipboardData.setData("text/plain", serialize(sel));
  say(`copied ${sel.name}`);
});

document.addEventListener("paste", (ev) => {
  if (isTextTarget(ev.target)) return;
  const def = deserialize(ev.clipboardData.getData("text/plain"));
  if (!def) return; // not one of ours; leave the paste alone
  ev.preventDefault();
  if (!addFromCatalog(def)) say("no room to paste that");
  else say(`pasted ${def.name}`);
});

// ── render loop ────────────────────────────────────────────────────────────

function renderAll() {
  dropStaleHash();
  renderChassis();
  syncPalette();
  renderDesignsBar();
  renderRack();
  renderInspector();
  $("undo").disabled = !canUndo();
  $("redo").disabled = !canRedo();
}

subscribe(renderAll);

// ── boot ───────────────────────────────────────────────────────────────────

async function boot() {
  renderPalette();

  const hash = location.hash.slice(1);
  if (hash) {
    try {
      loadLayout(await decode(hash));
      // the link describes what is on screen right now, so it stays in the bar
      // until the first edit — see dropStaleHash
      urlLayout = snapshot();
      say("layout loaded from link");
    } catch (err) {
      say(`that link is not a layout: ${err.message}`);
      loadSaved();
    }
  } else {
    loadSaved();
  }
  renderAll();
}

boot();

// a couple of internals for browser-console poking and smoke tests
window.rackPlanner = { state, commit, nextId, toSvg, encode, decode };
