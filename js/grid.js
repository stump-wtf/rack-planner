// grid.js — the geometry core. pure functions, no dom, no state.
//
// everything is normalized to an integer half-U grid so nothing in the
// collision path ever compares floats:
//
//   row 0 is the BOTTOM half of U1. rows increase upward.
//   col 0 is the left half-width bay, col 1 the right.
//   a full-width device is { col: 0, colSpan: 2 }.
//   a 0.5U device is { rowSpan: 1 }.

export const COLS = 2;

/** half-U rows in a rack of `rackU` units. */
export function rowsFor(rackU) {
  return rackU * COLS;
}

/** device height in U (may be 0.5) -> rowSpan in half-U rows. */
export function rowSpanFor(u) {
  return Math.max(1, Math.round(u * 2));
}

/** 'full' | 'half' -> colSpan. */
export function colSpanFor(width) {
  return width === "half" ? 1 : COLS;
}

/** the U label (1-based, counting from the bottom) a row belongs to. */
export function uLabelFor(row) {
  return Math.floor(row / 2) + 1;
}

/** half-open rect overlap on both axes. */
export function rectsOverlap(a, b) {
  return (
    a.row < b.row + b.rowSpan &&
    b.row < a.row + a.rowSpan &&
    a.col < b.col + b.colSpan &&
    b.col < a.col + a.colSpan
  );
}

export function inBounds(rect, rows) {
  return (
    rect.row >= 0 &&
    rect.col >= 0 &&
    rect.row + rect.rowSpan <= rows &&
    rect.col + rect.colSpan <= COLS
  );
}

/**
 * can `rect` sit here? `others` is every OTHER placement — callers filter the
 * moving device out themselves, which keeps this honest for both drop and nudge.
 */
export function isValid(rect, rows, others) {
  if (!inBounds(rect, rows)) return false;
  return !others.some((o) => rectsOverlap(rect, o));
}

/**
 * snap a floating grid position to the nearest legal integer cell.
 * clamps into bounds; does NOT check collision (the caller wants to render an
 * invalid ghost, not a teleporting one).
 */
export function snapRect({ rowFloat, colFloat }, { rows, rowSpan, colSpan }) {
  const maxRow = Math.max(0, rows - rowSpan);
  const maxCol = Math.max(0, COLS - colSpan);
  return {
    row: clamp(Math.round(rowFloat), 0, maxRow),
    col: clamp(Math.round(colFloat), 0, maxCol),
    rowSpan,
    colSpan,
  };
}

function clamp(n, lo, hi) {
  if (Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

/**
 * row search order for auto-placement.
 *
 * the rails allow half-U offsets and dragging honours that, but a whole-U
 * device straddling two Us is not what anyone means by "just put it in the
 * rack". so whole-U devices try U boundaries (even rows) first and only fall
 * back to odd rows when nothing else is free. half-U parts take any row.
 */
export function candidateRows(rows, rowSpan) {
  const all = [];
  for (let row = 0; row + rowSpan <= rows; row++) all.push(row);
  if (rowSpan % 2 !== 0) return all;
  return [...all.filter((r) => r % 2 === 0), ...all.filter((r) => r % 2 === 1)];
}

/**
 * lowest free cell that fits, scanning bottom-up then left-to-right.
 * used when you click a catalog entry instead of dragging it.
 */
export function firstFit(rows, others, rowSpan, colSpan) {
  for (const row of candidateRows(rows, rowSpan)) {
    for (let col = 0; col + colSpan <= COLS; col++) {
      const rect = { row, col, rowSpan, colSpan };
      if (isValid(rect, rows, others)) return rect;
    }
  }
  return null;
}

/** unoccupied space, in U. a lone half-width device leaves 0.5U free beside it. */
export function freeU(rows, placements) {
  const used = new Uint8Array(rows * COLS);
  for (const p of placements) {
    for (let r = p.row; r < p.row + p.rowSpan; r++) {
      for (let c = p.col; c < p.col + p.colSpan; c++) {
        if (r >= 0 && r < rows && c >= 0 && c < COLS) used[r * COLS + c] = 1;
      }
    }
  }
  let free = 0;
  for (let i = 0; i < used.length; i++) if (!used[i]) free++;
  return free / (COLS * 2); // cells -> half-U rows -> U
}

/** every placement that overlaps another. shown as a conflict badge. */
export function findConflicts(placements) {
  const bad = new Set();
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      if (rectsOverlap(placements[i], placements[j])) {
        bad.add(placements[i].id);
        bad.add(placements[j].id);
      }
    }
  }
  return bad;
}
