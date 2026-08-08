---
sidebar_position: 3
title: the catalog
---

# the catalog

46 entries: 21 stock devices you buy, and 25 parts you print.

## stock devices

Grouped as **compute**, **network**, **power** and **passive** — Pi mounts, mini
PCs, switches, patch panels, PDUs, blanks, shelves, cable managers, drawers.
Each carries a typical depth and wattage, and every value is editable once
placed.

## 3d prints

Two MakerWorld collections, shown with a dashed border because you make these
rather than buy them:

- **[10" mini racks](https://makerworld.com/en/collections/25694095-10-mini-racks)** — 6 models
- **[storage rack](https://makerworld.com/en/collections/20342610-storage-rack)** — 20 models

Selecting a printed part shows its maker and links back to the collection.

:::caution estimated heights
MakerWorld blocks automated fetching, so this table was transcribed by hand. Most
models state their height in the title (`2U Mini ITX case for 10" rack…`); five
do not, and those are marked `uExact: false`, shown with a **≈** in the palette,
and carry a warning in the inspector. Check the model page before printing.
:::

## searching

The palette has a filter that matches on name, maker, category and collection —
so `nautilus` finds every Nautilus Forge model across both collections, and
`storage` narrows to that collection.

## adding your own

Two ways.

**Ad hoc** — the "custom" section at the bottom of the palette takes a name,
height (in half-U steps), width, depth, wattage and colour, then drops it
straight into the rack. Nothing is committed to the repo.

**Permanently** — append to `CATALOG` in `js/model.js`:

```js
{
  id: "my-thing",
  name: "my thing",        // lowercase; a test enforces this
  u: 1.5,                  // may be any half-U multiple
  width: "half",           // "full" | "half"
  depthMm: 180,
  watts: 25,
  color: "#4EE6FF",        // must be one of SWATCHES
  cat: "network",
  glyph: "⇄",
}
```

A test asserts every colour comes from `SWATCHES`, so the palette stays
coherent, and another asserts every device fits a 4u rack.
