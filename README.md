# rack planner

snap-to-grid planning for 10" mini racks and 19" racks — starting with the DeskPi RackMate T-series form
factor, in 4u, 8u and 12u. drag gear in from a catalog, see what fits, and hand
someone a link to the result.

no build step, no dependencies, no backend. it is a directory of ES modules.

```bash
make dev     # http://localhost:5173
make check   # lint + tests
```

## why it looks the way it does

A 10" rack is small enough that the planning failure is always physical, not
logical: the U count is fine but the box is too deep for a 260mm cabinet, or two
half-width things you assumed would sit side by side actually collide. So the
model refuses to let you draw something you cannot build.

**The grid is half-U by two bays.** 1U is 44.45mm and the T-series ecosystem is
full of 0.5U parts — the PDU Lite, the brush manager, the vented shelf — while
Pi mounts and mini PCs are half-width. Representing a rack as a list of whole Us
would misdescribe most real builds. Internally everything is integers on a
`rows × 2` grid, so nothing in the collision path ever compares floats:

```
row 0 is the bottom half of U1, rows count upward
col 0 is the left bay, col 1 the right
a full-width device is { col: 0, colSpan: 2 }
a 0.5U device is { rowSpan: 1 }
```

**Dragging allows half-U offsets; auto-placement does not.** The rails really do
have half-U holes, so a 1U switch straddling two Us is legal and you can drag it
there. But it is never what someone means by "put this in the rack", so clicking
a catalog entry searches U boundaries first and only falls back to odd rows when
nothing else is free.

**Depth is a first-class constraint.** Every device carries a depth in mm,
checked against the cabinet — 260mm for the T2 and T1 Plus, 198mm for the
shallower T1. This is the constraint that actually bites, and a front elevation
alone will happily let you plan something that does not close.

**Shrinking the rack never silently loses a device.** Going 12u → 4u keeps what
still fits, re-seats what it can, names anything genuinely evicted, and leaves
the whole thing on the undo stack.

## keys

| key | does |
| --- | --- |
| drag | place from the catalog, or move something already racked |
| click | select · click a catalog chip to drop it in the lowest gap |
| `↑` `↓` | nudge a half U |
| `⇧↑` `⇧↓` | nudge a whole U |
| `←` `→` | swap bays (half-width gear) |
| `⌫` | remove |
| `⌘c` / `⌘v` | copy · paste (works across tabs) |
| `⌘d` | duplicate |
| `⌘z` / `⇧⌘z` | undo / redo |
| `esc` | deselect |

## sharing and export

**share** puts the entire layout in the URL fragment — compact JSON, deflated
with the native `CompressionStream` when that comes out shorter, base64url'd.
Nothing reaches a server, there is nothing to host, and the link keeps working
offline. Designs autosave to `localStorage` — the library holds several named
designs, one active at a time, and a share link is how one of them travels.

**svg** / **png** export the elevation. `toSvg()` is a pure function reading the
same model the DOM renders, so an export cannot drift from what is on screen;
PNG is that SVG through a canvas.

## layout

| file | holds |
| --- | --- |
| `js/grid.js` | the geometry core — snap, bounds, collision, fit. pure, and where the tests live |
| `js/model.js` | chassis sizes, physical constants, the device catalog |
| `js/state.js` | the store, undo/redo, autosave |
| `js/designs.js` | the designs library — named racks in localStorage |
| `js/share.js` | layout ⇄ url fragment |
| `js/export.js` | `toSvg()` / `toPng()` |
| `js/ui-*.js` | rack elevation, catalog, inspector, designs bar |
| `js/app.js` | bootstrap, keyboard map, toolbar |

## tests

`make test` runs node's built-in runner over `test/`. There is no test framework
to install. The geometry core is the real gate — half-U snapping, full-vs-half
collision in a shared U, out-of-bounds clamping, share round-trips, and export
escaping.

## adding gear to the catalog

Append to `CATALOG` in [`js/model.js`](js/model.js). `u` may be `0.5`; `width` is
`'full'` or `'half'`; `color` must come from `SWATCHES` (a test enforces this, so
the palette stays coherent). Anything not worth committing can be built in the
"custom" section of the catalog sidebar instead.

## licence

MIT.
