// state.js — the store. one mutable object, a subscriber list, an undo stack,
// and autosave. no framework; `commit()` is the only way anything changes.

import {
  rowsFor,
  rowSpanFor,
  colSpanFor,
  findConflicts,
  freeU,
} from "./grid.js";
import { chassisById } from "./model.js";

const KEY = "rackplanner.v1";
const UNDO_LIMIT = 60;

let seq = 0;
export function nextId() {
  return `d${Date.now().toString(36)}${(seq++).toString(36)}`;
}

export const state = {
  chassisId: "8u",
  depthMm: 260,
  budgetW: 300,
  items: [],
  selectedId: null,
};

const listeners = new Set();
let undoStack = [];
let redoStack = [];

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(state);
}

/** the persisted slice — selection and transient drag state stay out of it. */
function snapshot() {
  return JSON.stringify({
    chassisId: state.chassisId,
    depthMm: state.depthMm,
    budgetW: state.budgetW,
    items: state.items,
  });
}

function restore(json) {
  const s = JSON.parse(json);
  state.chassisId = s.chassisId;
  state.depthMm = s.depthMm;
  state.budgetW = s.budgetW;
  state.items = s.items;
  if (!state.items.some((i) => i.id === state.selectedId))
    state.selectedId = null;
}

/**
 * mutate, then push the PREVIOUS state onto the undo stack. pass
 * {undoable:false} for things like selection that should not cost a Cmd-Z.
 */
export function commit(mutator, { undoable = true } = {}) {
  const before = undoable ? snapshot() : null;
  mutator(state);
  if (undoable) {
    if (snapshot() !== before) {
      undoStack.push(before);
      if (undoStack.length > UNDO_LIMIT) undoStack.shift();
      redoStack = [];
    }
  }
  save();
  emit();
}

export function undo() {
  if (!undoStack.length) return false;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  save();
  emit();
  return true;
}

export function redo() {
  if (!redoStack.length) return false;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  save();
  emit();
  return true;
}

export function canUndo() {
  return undoStack.length > 0;
}
export function canRedo() {
  return redoStack.length > 0;
}

function save() {
  try {
    localStorage.setItem(KEY, snapshot());
  } catch {
    /* private mode / quota — the url share is the real persistence story */
  }
}

export function loadSaved() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    restore(raw);
    return true;
  } catch {
    return false;
  }
}

/** replace everything — used by share-link load and json import. */
export function loadLayout(layout) {
  commit((s) => {
    s.chassisId = layout.chassisId;
    s.depthMm = layout.depthMm;
    s.budgetW = layout.budgetW;
    s.items = layout.items.map((i) => ({ ...i, id: i.id || nextId() }));
    s.selectedId = null;
  });
}

// ── derived ────────────────────────────────────────────────────────────────

export function rectOf(item) {
  return {
    id: item.id,
    row: item.row,
    col: item.width === "half" ? item.col : 0,
    rowSpan: rowSpanFor(item.u),
    colSpan: colSpanFor(item.width),
  };
}

export function rackRows() {
  return rowsFor(chassisById(state.chassisId).u);
}

export function rectsExcept(id) {
  return state.items.filter((i) => i.id !== id).map(rectOf);
}

export function derived() {
  const rows = rackRows();
  const rects = state.items.map(rectOf);
  const watts = state.items.reduce((n, i) => n + (Number(i.watts) || 0), 0);
  const tooDeep = state.items.filter((i) => Number(i.depthMm) > state.depthMm);
  return {
    rows,
    freeU: freeU(rows, rects),
    usedU: chassisById(state.chassisId).u - freeU(rows, rects),
    watts,
    overBudget: state.budgetW > 0 && watts > state.budgetW,
    tooDeep,
    conflicts: findConflicts(rects),
  };
}
