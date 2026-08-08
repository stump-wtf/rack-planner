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
| **chassis** | 4u · 8u · 12u, 10" wide, depth configurable (260mm T2/T1 Plus, 198mm T1) |
| **grid** | half-U rows × two half-width bays |
| **catalog** | 21 stock devices + 25 3D-printable parts, plus anything you define |
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
| `⌘d` | duplicate |
| `⌘z` / `⇧⌘z` | undo / redo |
| `esc` | deselect |
