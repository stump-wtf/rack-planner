// state.js — the store. one mutable object, a subscriber list, an undo stack,
// and autosave. no framework; `commit()` is the only way anything changes.

import {
  rowsFor,
  rowSpanFor,
  colSpanFor,
  findConflicts,
  freeU,
} from "./grid.js";
import { chassisById, powerOf } from "./model.js";
import { loadLibrary, saveLibrary, getActive, setActive } from "./designs.js";

const KEY = "rackplanner.v1";
export { KEY as LEGACY_KEY };
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
let coalesceKey = null;

const DEFAULTS = { chassisId: "8u", depthMm: 260, budgetW: 300 };
export { DEFAULTS };

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(state);
}

/**
 * the persisted slice — selection and transient drag state stay out of it.
 * exported so app.js can tell whether the layout still matches the one its
 * share link encodes, without duplicating the shape and letting it drift.
 */
export function snapshot() {
  return JSON.stringify({
    chassisId: state.chassisId,
    depthMm: state.depthMm,
    budgetW: state.budgetW,
    items: state.items,
  });
}

/**
 * a snapshot written by an older build can be missing a field entirely, and an
 * undefined budget renders as "undefined" in a number input and a dead meter —
 * which reads as a broken widget rather than as missing data. fall back.
 */
function restore(json) {
  const s = JSON.parse(json);
  state.chassisId = s.chassisId ?? DEFAULTS.chassisId;
  state.depthMm = Number(s.depthMm) || DEFAULTS.depthMm;
  state.budgetW = Number(s.budgetW) || 0;
  state.items = s.items ?? [];
  if (!state.items.some((i) => i.id === state.selectedId))
    state.selectedId = null;
}

/**
 * mutate, then push the PREVIOUS state onto the undo stack. pass
 * {undoable:false} for things like selection that should not cost a Cmd-Z.
 *
 * `coalesce` names an edit run — a field key like `watts:d3f`. consecutive
 * commits sharing a key push only one undo entry, so typing "250" into a box
 * that commits per keystroke costs one Cmd-Z, not three. any other commit in
 * between (a different field, a selection, a drop) ends the run.
 */
export function commit(mutator, { undoable = true, coalesce = null } = {}) {
  const before = undoable ? snapshot() : null;
  mutator(state);
  if (undoable) {
    if (snapshot() !== before) {
      if (!coalesce || coalesce !== coalesceKey) {
        undoStack.push(before);
        if (undoStack.length > UNDO_LIMIT) undoStack.shift();
      }
      redoStack = [];
    }
  }
  coalesceKey = coalesce;
  save();
  emit();
}

/**
 * end the current coalesced edit run, so the next keystroke starts a fresh undo
 * entry. call it when a field loses focus — otherwise two separate visits to
 * the same box merge into one Cmd-Z.
 */
export function endEditRun() {
  coalesceKey = null;
}

export function undo() {
  if (!undoStack.length) return false;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  coalesceKey = null;
  save();
  emit();
  return true;
}

export function redo() {
  if (!redoStack.length) return false;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  coalesceKey = null;
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
  // route through the designs store: update the active design's layout and
  // bump its updatedAt. swallow quota / private-mode errors the way the old
  // single-key save did — the url share is the real persistence story.
  try {
    const lib = loadLibrary();
    const d = lib.designs.find((d) => d.id === lib.activeId);
    if (d) {
      d.layout = JSON.parse(snapshot());
      d.updatedAt = Date.now();
      saveLibrary(lib);
    }
  } catch {
    /* private mode / quota */
  }
}

export function loadSaved() {
  try {
    const d = getActive();
    if (!d) return false;
    restore(JSON.stringify(d.layout));
    return true;
  } catch {
    return false;
  }
}

/** replace everything — used by share-link load and json import. */
export function loadLayout(layout) {
  commit((s) => {
    s.chassisId = layout.chassisId ?? DEFAULTS.chassisId;
    s.depthMm = Number(layout.depthMm) || DEFAULTS.depthMm;
    s.budgetW = Number(layout.budgetW) || 0;
    s.items = layout.items.map((i) => ({ ...i, id: i.id || nextId() }));
    s.selectedId = null;
  });
}

/**
 * switch to a different design in the library. loads its layout, resets
 * selection, and clears the undo/redo stacks — undoing across a design switch
 * would silently rewrite a different rack, which is a data-loss bug, not a
 * nicety. leaves the stacks in the same clean state loadLayout does.
 */
export function switchDesign(id) {
  setActive(id);
  const d = getActive();
  if (!d) return;
  restore(JSON.stringify(d.layout));
  state.selectedId = null;
  undoStack = [];
  redoStack = [];
  coalesceKey = null;
  // no save() — setActive() already wrote which design is active, and the
  // layout we just restored came straight out of the store unchanged. saving
  // here would bump updatedAt, so merely looking at an old design would jump
  // it to the top of a list that sorts on it.
  emit();
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
  // the budget is for the whole rack: every device's draw, summed. the rule
  // lives in model.powerOf so the meter, the gauge and the svg export cannot
  // drift apart on what counts as "getting close".
  const { watts, budgetW, overBudget, pct, level } = powerOf(
    state.items,
    state.budgetW,
  );
  const tooDeep = state.items.filter((i) => Number(i.depthMm) > state.depthMm);
  return {
    rows,
    freeU: freeU(rows, rects),
    usedU: chassisById(state.chassisId).u - freeU(rows, rects),
    watts,
    budgetW,
    overBudget,
    pct,
    // "is-idle" is the gauge's business — the inspector only cares whether the
    // budget is being approached, and treats no-budget as no warning
    powerLevel: level === "is-idle" ? "" : level,
    headroomW: budgetW > 0 ? budgetW - watts : null,
    tooDeep,
    conflicts: findConflicts(rects),
  };
}
