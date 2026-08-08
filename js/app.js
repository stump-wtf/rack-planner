// app.js — bootstrap. wires the dom together, owns the keyboard map, and
// handles share/export. everything else lives in its own module.

import { CHASSIS, chassisById } from "./model.js";
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
  renderInspector,
  say,
} from "./ui-panels.js";
import { encode, decode } from "./share.js";
import { toSvg, toPng, download } from "./export.js";
import { resolveIcons } from "./icons.js";
import { serialize, deserialize, isTextTarget } from "./clipboard.js";

const $ = (id) => document.getElementById(id);

const rackEl = $("rack");
const rulerEl = $("ruler");
const toast = Object.assign(document.createElement("div"), {
  className: "toast",
  hidden: true,
});
document.body.appendChild(toast);

initRack({ rackEl, rulerEl });
initPanels({ paletteEl: $("palette"), inspectorEl: $("inspector"), toast });

// ── chassis switcher ───────────────────────────────────────────────────────

function renderChassis() {
  const wrap = $("chassis");
  wrap.replaceChildren(
    ...CHASSIS.map((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = c.label;
      b.setAttribute(
        "aria-pressed",
        c.id === state.chassisId ? "true" : "false",
      );
      b.addEventListener("click", () => switchChassis(c.id));
      return b;
    }),
  );
}

/**
 * shrinking the rack can orphan devices. keep everything that still fits where
 * it is, re-seat what it can, and report anything genuinely evicted — never
 * silently vanish a device.
 */
function switchChassis(id) {
  if (id === state.chassisId) return;
  const rows = rowsFor(chassisById(id).u);
  commit((s) => {
    s.chassisId = id;
    const kept = [];
    const evicted = [];
    for (const it of s.items) {
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
      queueMicrotask(() =>
        say(
          `no room in ${chassisById(id).label} for ${evicted.map((e) => e.name).join(", ")}`,
        ),
      );
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

$("share").addEventListener("click", async () => {
  try {
    const hash = await encode(state);
    const url = `${location.origin}${location.pathname}#${hash}`;
    history.replaceState(null, "", `#${hash}`);
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
  renderChassis();
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
