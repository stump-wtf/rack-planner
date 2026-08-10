---
sidebar_position: 1
title: getting started
slug: /
---

# rack planner

Snap-to-grid planning for 10" mini racks — the DeskPi RackMate T-series form
factor, in 4u, 8u and 12u. Drag gear in from a catalog, see what actually fits,
and hand someone a link to the result.

👉 **[open the planner](https://rack-planner.stump.rocks)**

## why

A 10" rack is small enough that the planning failure is always physical, never
logical. The U count is fine but the box is too deep for a 260mm cabinet. Two
half-width things you assumed would sit side by side actually collide. You buy
the parts, then find out.

So the model refuses to let you draw something you cannot build. The rack knows
its own depth, every device carries a footprint, and an illegal drop is refused
while you are still dragging.

## the shape of it

| | |
| --- | --- |
| **chassis** | 10": 4u · 8u · 12u — 19": 6u · 12u · 18u · 27u · 42u, depth configurable per width |
| **grid** | half-U rows × two half-width bays |
| **catalog** | 21 stock 10" devices + 25 3D-printable parts + 22 19" rackmount devices, filtered to the rack you are on, plus anything you define |
| **budgets** | power draw against a target, depth against the cabinet |
| **output** | shareable URL, SVG, PNG |

## running it locally

```bash
git clone https://gitea.stump.rocks/stump.wtf/rack-planner
cd rack-planner
make dev
```

Then open `http://localhost:5173`.

:::warning don't open index.html directly
ES modules are blocked over `file://` by CORS. It has to be served over http —
which is all `make dev` does.
:::

There is no build step and there are no JavaScript dependencies. `js/` ships
exactly as written.

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

## 10" and 19"

The planner started 10"-only and now does both. Width is a real dimension, not
a label: it selects the chassis sizes, the depth presets and which catalog gear
is offered.

| | 10" | 19" |
| --- | --- | --- |
| panel | 254mm | 482.6mm |
| sizes | 4u · 8u · 12u | 6u · 12u · 18u · 27u · 42u |
| depths | 198–260mm | 300–1000mm |

The 19" sizes are the shape of what homelabs actually run: two wall cabinets, an
open frame, a rolling half-height, and the full-height floor rack. 42u is the one
people photograph; 12u wall is the one people own.

**Depth is the dimension that bites.** A 750mm server does not go in a 450mm
switch-depth wall cabinet, and at 19" that mismatch is easy to make and
expensive to discover. Set the rack depth and the planner flags anything deeper.

Switching width empties the rack of gear that cannot follow — a 10" printed pi
mount has no place in a 19" rack — and says what it removed. Cmd-Z puts it back.
Devices you defined yourself are never assumed to be one width or the other, so
they survive the switch.
