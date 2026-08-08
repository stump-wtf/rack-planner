import test from "node:test";
import assert from "node:assert/strict";

import {
  COLS,
  rowsFor,
  rowSpanFor,
  colSpanFor,
  uLabelFor,
  rectsOverlap,
  inBounds,
  isValid,
  snapRect,
  firstFit,
  candidateRows,
  freeU,
  findConflicts,
} from "../js/grid.js";

const full = (row, u) => ({ row, col: 0, rowSpan: u * 2, colSpan: 2 });
const half = (row, col, u) => ({ row, col, rowSpan: u * 2, colSpan: 1 });

test("rack geometry converts U to half-U rows", () => {
  assert.equal(rowsFor(4), 8);
  assert.equal(rowsFor(12), 24);
  assert.equal(rowSpanFor(0.5), 1);
  assert.equal(rowSpanFor(1), 2);
  assert.equal(rowSpanFor(2), 4);
  assert.equal(colSpanFor("half"), 1);
  assert.equal(colSpanFor("full"), COLS);
});

test("rowSpan never collapses to zero", () => {
  // a nonsense height must still occupy a cell rather than becoming intangible
  assert.equal(rowSpanFor(0), 1);
  assert.equal(rowSpanFor(0.1), 1);
});

test("U labels count from 1 at the bottom", () => {
  assert.equal(uLabelFor(0), 1);
  assert.equal(uLabelFor(1), 1);
  assert.equal(uLabelFor(2), 2);
  assert.equal(uLabelFor(23), 12);
});

test("two half-width devices share one U without colliding", () => {
  const left = half(0, 0, 1);
  const right = half(0, 1, 1);
  assert.equal(rectsOverlap(left, right), false);
  assert.equal(isValid(right, rowsFor(8), [left]), true);
});

test("a full-width device blocks both bays of the U it sits in", () => {
  const panel = full(0, 1);
  assert.equal(isValid(half(0, 0, 1), rowsFor(8), [panel]), false);
  assert.equal(isValid(half(0, 1, 1), rowsFor(8), [panel]), false);
  // ...but the U above is untouched
  assert.equal(isValid(half(2, 0, 1), rowsFor(8), [panel]), true);
});

test("half-U parts stack two to a U", () => {
  const rows = rowsFor(4);
  const lower = { row: 0, col: 0, rowSpan: 1, colSpan: 2 };
  const upper = { row: 1, col: 0, rowSpan: 1, colSpan: 2 };
  assert.equal(rectsOverlap(lower, upper), false);
  assert.equal(isValid(upper, rows, [lower]), true);
  // and a 1U device can no longer start at row 0
  assert.equal(isValid(full(0, 1), rows, [lower]), false);
});

test("bounds reject a device taller than the space above it", () => {
  const rows = rowsFor(4);
  assert.equal(inBounds(full(4, 2), rows), true); // 2U at U3 in a 4U rack: fits
  assert.equal(inBounds(full(6, 2), rows), false); // 2U starting at U4: overhangs
  assert.equal(inBounds(full(-1, 1), rows), false);
  assert.equal(
    inBounds({ row: 0, col: 1, rowSpan: 2, colSpan: 2 }, rows),
    false,
  );
});

test("a 3U device only fits low enough in a 4U rack to clear the roof", () => {
  const rows = rowsFor(4);
  assert.equal(isValid(full(0, 3), rows, []), true); // U1-U3
  assert.equal(isValid(full(2, 3), rows, []), true); // U2-U4, exactly flush
  assert.equal(isValid(full(4, 3), rows, []), false); // would need U3-U5
});

test("snapping rounds to the nearest cell and clamps into the rack", () => {
  const rows = rowsFor(8);
  const opts = { rows, rowSpan: 2, colSpan: 1 };
  assert.deepEqual(snapRect({ rowFloat: 3.4, colFloat: 0.2 }, opts), {
    row: 3,
    col: 0,
    rowSpan: 2,
    colSpan: 1,
  });
  assert.deepEqual(snapRect({ rowFloat: 3.6, colFloat: 0.7 }, opts), {
    row: 4,
    col: 1,
    rowSpan: 2,
    colSpan: 1,
  });
  // above the roof clamps to the highest legal row, not out of bounds
  assert.deepEqual(snapRect({ rowFloat: 99, colFloat: 9 }, opts), {
    row: 14,
    col: 1,
    rowSpan: 2,
    colSpan: 1,
  });
  assert.deepEqual(snapRect({ rowFloat: -9, colFloat: -9 }, opts), {
    row: 0,
    col: 0,
    rowSpan: 2,
    colSpan: 1,
  });
});

test("snapping a full-width device always lands in column 0", () => {
  const snapped = snapRect(
    { rowFloat: 1, colFloat: 1 },
    { rows: 16, rowSpan: 2, colSpan: 2 },
  );
  assert.equal(snapped.col, 0);
});

test("snapping survives a NaN pointer", () => {
  const snapped = snapRect(
    { rowFloat: NaN, colFloat: NaN },
    { rows: 8, rowSpan: 2, colSpan: 2 },
  );
  assert.deepEqual(snapped, { row: 0, col: 0, rowSpan: 2, colSpan: 2 });
});

test("firstFit packs bottom-up and reports a full rack", () => {
  const rows = rowsFor(4);
  const placed = [];
  for (let i = 0; i < 4; i++) {
    const spot = firstFit(rows, placed, 2, 2);
    assert.ok(spot, `1U device ${i} should fit`);
    assert.equal(spot.row, i * 2);
    placed.push({ id: `d${i}`, ...spot });
  }
  assert.equal(firstFit(rows, placed, 2, 2), null);
});

test("auto-placement lands whole-U devices on U boundaries, not straddling two", () => {
  const rows = rowsFor(8);
  // a 0.5U patch panel in the bottom half of U1 leaves an awkward gap above it
  const placed = [{ id: "p", row: 0, col: 0, rowSpan: 1, colSpan: 2 }];
  const spot = firstFit(rows, placed, 2, 2); // a 1U switch
  assert.equal(spot.row % 2, 0, "should sit on a U boundary");
  assert.equal(spot.row, 2, "the bottom of U2, not the top half of U1");
});

test("auto-placement still uses an odd row when that is the only gap left", () => {
  const rows = rowsFor(2);
  // fill row 0 and rows 3.. leaving exactly rows 1-2 free
  const placed = [
    { id: "a", row: 0, col: 0, rowSpan: 1, colSpan: 2 },
    { id: "b", row: 3, col: 0, rowSpan: 1, colSpan: 2 },
  ];
  const spot = firstFit(rows, placed, 2, 2);
  assert.deepEqual(spot, { row: 1, col: 0, rowSpan: 2, colSpan: 2 });
});

test("candidateRows prefers even rows only for whole-U heights", () => {
  assert.deepEqual(candidateRows(6, 2), [0, 2, 4, 1, 3]);
  assert.deepEqual(candidateRows(4, 1), [0, 1, 2, 3]); // a ½U part takes any row
});

test("firstFit slots a half-width device beside an existing one", () => {
  const rows = rowsFor(4);
  const existing = [{ id: "a", ...half(0, 0, 1) }];
  const spot = firstFit(rows, existing, 2, 1);
  assert.deepEqual(spot, { row: 0, col: 1, rowSpan: 2, colSpan: 1 });
});

test("free space is reported in U, counting part-used rows", () => {
  const rows = rowsFor(4);
  assert.equal(freeU(rows, []), 4);
  assert.equal(freeU(rows, [{ id: "a", ...full(0, 1) }]), 3);
  // one half-width device leaves half a U free in that row
  assert.equal(freeU(rows, [{ id: "a", ...half(0, 0, 1) }]), 3.5);
});

test("overlapping placements are reported as conflicts on both sides", () => {
  const a = { id: "a", ...full(0, 2) };
  const b = { id: "b", ...full(2, 1) };
  const c = { id: "c", ...full(6, 1) };
  const bad = findConflicts([a, b, c]);
  assert.deepEqual([...bad].sort(), ["a", "b"]);
});

test("a clean rack reports no conflicts", () => {
  const bad = findConflicts([
    { id: "a", ...full(0, 1) },
    { id: "b", ...half(2, 0, 1) },
    { id: "c", ...half(2, 1, 1) },
  ]);
  assert.equal(bad.size, 0);
});
