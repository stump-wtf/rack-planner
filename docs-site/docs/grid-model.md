---
sidebar_position: 2
title: the grid model
---

# the grid model

Everything is integers on a half-U × two-bay grid. Nothing in the collision path
ever compares floats.

```
rows = rackU * 2      row 0 is the bottom half of U1, rows count upward
cols = 2              col 0 is the left bay, col 1 the right
```

A full-width device is `{ col: 0, colSpan: 2 }`. A 0.5U part is `{ rowSpan: 1 }`.

## why half-U

The T-series ecosystem is full of 0.5U parts — the DC PDU Lite, the brush cable
manager, the vented shelf — while Pi mounts and mini PCs are half-width. A model
built on whole Us would misdescribe most real builds.

```
        pointer position (float)
                  │
                  ▼
        snapRect()  ── round + clamp into bounds
                  │
                  ▼
             isValid()
             ╱        ╲
   in bounds and       otherwise
   nothing overlaps        │
        │                  ▼
        ▼            ✗ coral ghost
  ✓ mint ghost         drop refused
   drop allowed
```

That single predicate drives the drag ghost colour, the drop guard, and the
keyboard nudge — so what you see while dragging is decided by exactly the code
the tests cover.

## dragging vs auto-placement

The rails really do have half-U holes, so a 1U switch mounted half a U off a
boundary is physically legal. Dragging honours that.

**Auto-placement does not.** Clicking a catalog chip searches U boundaries
first, and only falls back to odd rows when nothing else is free. A whole-U
device straddling two Us is never what someone means by "just put it in the
rack" — the first version of `firstFit` did it by default and it read as a bug.

```js
// js/grid.js
export function candidateRows(rows, rowSpan) {
  const all = [];
  for (let row = 0; row + rowSpan <= rows; row++) all.push(row);
  if (rowSpan % 2 !== 0) return all;
  return [...all.filter((r) => r % 2 === 0), ...all.filter((r) => r % 2 === 1)];
}
```

## depth

Depth is the constraint that actually bites on a 260mm cabinet, and a front
elevation alone will happily let you plan something that does not close. Every
device carries a depth in mm, checked against the chassis:

| chassis | usable depth |
| --- | --- |
| RackMate T2 · T1 Plus | 260mm |
| RackMate T1 | 198mm |

Anything over gets named in an inspector warning.

## shrinking a rack

Going 12u → 4u keeps what still fits where it is, re-seats what it can with
`firstFit`, and names anything genuinely evicted. The whole operation is one
undo step, so `⌘z` brings back both the chassis size and the devices.

Nothing is ever silently dropped.

## physical constants

| | |
| --- | --- |
| 1U | 44.45mm |
| 10" panel width | 254mm |
| rail-to-rail | ~230mm |
