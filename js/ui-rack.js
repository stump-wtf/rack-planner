// ui-rack.js — the elevation: render placements, and drag them around.
//
// all snapping goes through grid.snapRect/isValid, so the ghost you see and the
// drop you get are decided by exactly the code the tests cover.

import {
  snapRect,
  isValid,
  firstFit,
  rowSpanFor,
  colSpanFor,
  COLS,
} from "./grid.js";
import { chassisById } from "./model.js";
import {
  state,
  commit,
  rectsExcept,
  rackRows,
  derived,
  nextId,
} from "./state.js";
import { fmtU } from "./export.js";

let rackEl;
let rulerEl;
let ghostEl = null;
let drag = null; // { mode:'move'|'new', item, rowSpan, colSpan, grabRow, grabCol, ok, rect }

export function initRack(elements) {
  rackEl = elements.rackEl;
  rulerEl = elements.rulerEl;

  rackEl.addEventListener("pointerdown", onRackPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", cancelDrag);
}

/** start dragging a brand-new device in from the catalog. */
export function beginNewDrag(def, ev) {
  const rowSpan = rowSpanFor(def.u);
  const colSpan = colSpanFor(def.width);
  drag = {
    mode: "new",
    item: { ...def, id: nextId(), defId: def.id, row: 0, col: 0 },
    rowSpan,
    colSpan,
    // centre a new device under the cursor
    grabRow: rowSpan / 2,
    grabCol: colSpan / 2,
    ok: false,
    rect: null,
    moved: false,
  };
  rackEl.classList.add("is-target");
  updateGhost(ev);
}

function onRackPointerDown(ev) {
  const el = ev.target.closest(".dev");
  if (!el) {
    // clicking bare rack clears the selection
    commit((s) => (s.selectedId = null), { undoable: false });
    return;
  }
  const item = state.items.find((i) => i.id === el.dataset.id);
  if (!item) return;

  ev.preventDefault();
  commit((s) => (s.selectedId = item.id), { undoable: false });
  rackEl.focus();

  const rowSpan = rowSpanFor(item.u);
  const colSpan = colSpanFor(item.width);
  const { rowFloat, colFloat } = pointerGrid(ev);
  drag = {
    mode: "move",
    item,
    rowSpan,
    colSpan,
    // keep the grab point under the cursor so the device does not jump
    grabRow: rowFloat - item.row,
    grabCol: colFloat - (item.width === "half" ? item.col : 0),
    ok: true,
    rect: null,
    moved: false,
  };
  document
    .querySelector(`.dev[data-id="${item.id}"]`)
    ?.classList.add("is-dragging");
}

function onPointerMove(ev) {
  if (!drag) return;
  drag.moved = true;
  updateGhost(ev);
}

function onPointerUp() {
  if (!drag) return;
  const d = drag;
  drag = null;
  rackEl.classList.remove("is-target");
  ghostEl?.remove();
  ghostEl = null;

  if (d.mode === "move" && !d.moved) {
    render(); // a plain click: just re-render to clear the drag styling
    return;
  }
  if (d.mode === "new" && !d.moved) {
    // tapped a catalog chip instead of dragging it — drop it in the lowest gap
    addFromCatalog(d.item);
    return;
  }
  if (!d.rect || !d.ok) {
    render();
    return;
  }

  if (d.mode === "new") {
    const item = { ...d.item, row: d.rect.row, col: d.rect.col };
    commit((s) => {
      s.items.push(item);
      s.selectedId = item.id;
    });
  } else {
    commit((s) => {
      const it = s.items.find((i) => i.id === d.item.id);
      if (it) {
        it.row = d.rect.row;
        it.col = d.rect.col;
      }
    });
  }
}

function cancelDrag() {
  drag = null;
  ghostEl?.remove();
  ghostEl = null;
  rackEl.classList.remove("is-target");
  render();
}

/** pointer position expressed in half-U rows (from the bottom) and bay columns. */
function pointerGrid(ev) {
  const r = rackEl.getBoundingClientRect();
  const rows = rackRows();
  const rowPx = r.height / rows;
  const colPx = r.width / COLS;
  return {
    rowFloat: (r.bottom - ev.clientY) / rowPx,
    colFloat: (ev.clientX - r.left) / colPx,
  };
}

function updateGhost(ev) {
  const rows = rackRows();
  const { rowFloat, colFloat } = pointerGrid(ev);
  const rect = snapRect(
    { rowFloat: rowFloat - drag.grabRow, colFloat: colFloat - drag.grabCol },
    { rows, rowSpan: drag.rowSpan, colSpan: drag.colSpan },
  );
  const others =
    drag.mode === "move" ? rectsExcept(drag.item.id) : state.items.map(toRect);
  drag.rect = rect;
  drag.ok = isValid(rect, rows, others);

  if (!ghostEl) {
    ghostEl = document.createElement("div");
    ghostEl.className = "ghost";
    rackEl.appendChild(ghostEl);
  }
  ghostEl.classList.toggle("is-bad", !drag.ok);
  place(ghostEl, rect, rows);
}

function toRect(i) {
  return {
    id: i.id,
    row: i.row,
    col: i.width === "half" ? i.col : 0,
    rowSpan: rowSpanFor(i.u),
    colSpan: colSpanFor(i.width),
  };
}

function place(el, rect, rows) {
  el.style.bottom = `calc(${(rect.row / rows) * 100}% + 2px)`;
  el.style.height = `calc(${(rect.rowSpan / rows) * 100}% - 4px)`;
  el.style.left = `calc(${(rect.col / COLS) * 100}% + 2px)`;
  el.style.width = `calc(${(rect.colSpan / COLS) * 100}% - 4px)`;
}

export function render() {
  const chassis = chassisById(state.chassisId);
  const rows = rackRows();
  const { conflicts } = derived();

  rackEl.style.height = `calc(${chassis.u} * var(--u-h))`;

  // ruler: U1 at the bottom (the column is reversed in css)
  rulerEl.replaceChildren(
    ...Array.from({ length: chassis.u }, (_, i) => {
      const d = document.createElement("div");
      d.textContent = String(i + 1);
      return d;
    }),
  );

  for (const el of rackEl.querySelectorAll(".dev")) el.remove();

  for (const it of state.items) {
    const rect = toRect(it);
    const el = document.createElement("div");
    el.className = "dev";
    el.dataset.id = it.id;
    el.style.setProperty("--c", it.color || "#7D56F4");
    if (it.id === state.selectedId) el.classList.add("is-selected");
    if (conflicts.has(it.id)) el.classList.add("is-conflict");
    if (rect.rowSpan < 2) el.classList.add("is-short");

    const g = document.createElement("span");
    g.className = "g";
    g.textContent = it.glyph || "▪";
    const n = document.createElement("span");
    n.className = "n";
    n.textContent = it.name;
    const m = document.createElement("span");
    m.className = "m";
    m.textContent = `${fmtU(it.u)}u${it.watts ? ` · ${it.watts}w` : ""}`;
    el.append(g, n, m);

    place(el, rect, rows);
    rackEl.appendChild(el);
  }
}

/**
 * drop a device into the lowest gap that fits it. returns false when the rack
 * is too full, so the caller can say so rather than silently doing nothing.
 */
export function addFromCatalog(def) {
  const rows = rackRows();
  const spot = firstFit(
    rows,
    state.items.map(toRect),
    rowSpanFor(def.u),
    colSpanFor(def.width),
  );
  if (!spot) return false;
  const item = {
    ...def,
    id: nextId(),
    defId: def.defId ?? def.id,
    row: spot.row,
    col: spot.col,
  };
  commit((s) => {
    s.items.push(item);
    s.selectedId = item.id;
  });
  return true;
}

/** keyboard nudge. returns true if the move was legal and applied. */
export function nudge(dRow, dCol) {
  const it = state.items.find((i) => i.id === state.selectedId);
  if (!it) return false;
  const rows = rackRows();
  const cand = {
    row: it.row + dRow,
    col: (it.width === "half" ? it.col : 0) + dCol,
    rowSpan: rowSpanFor(it.u),
    colSpan: colSpanFor(it.width),
  };
  if (!isValid(cand, rows, rectsExcept(it.id))) return false;
  commit((s) => {
    const t = s.items.find((i) => i.id === it.id);
    t.row = cand.row;
    t.col = cand.col;
  });
  return true;
}
