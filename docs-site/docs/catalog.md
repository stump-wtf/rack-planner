---
sidebar_position: 3
title: the catalog
---

# the catalog

68 entries: 21 stock 10" devices you buy, 25 parts you print, and 22 19"
rackmount devices. The palette is filtered to the rack you are on — a 10" rack
offers the 46 mini-rack entries, a 19" rack the 22 rackmount ones.

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

## icons

Every device carries an icon, which is either a **library reference** or a plain
Unicode glyph:

| stored value | resolves to |
| --- | --- |
| `sh:jellyfin` | [selfh.st/icons](https://selfh.st/icons/) — self-hosted software |
| `si:docker` | [simpleicons.org](https://simpleicons.org) — brand marks |
| `▦` | taken literally |

Select a device, pick a library, and type a slug — the preview resolves as you
type. Simple Icons are monochrome, so they get tinted to the device's colour;
selfh.st marks are already full-colour and are left alone.

References are stored, never markup. That keeps share URLs short: inlining SVG
would add kilobytes per device to a link that has to fit in an address bar.

:::note browsing
There is no browse-all grid. The two indexes are 845KB and 372KB, which is not a
reasonable download just to pick a picture. The slug field has a datalist of
~55 common homelab icons, and each library's "browse ↗" link opens the real
thing.
:::

Exports resolve differently: `toSvg()` takes a map of pre-fetched icons and
inlines them as data URIs, so a downloaded SVG or PNG keeps working offline. An
icon that fails to fetch falls back to a glyph rather than failing the export.

`make check-icons` probes every curated slug against the live CDNs. It is
deliberately **not** part of `make check` — it needs network, and a flaky gate is
worse than none. Run it when you touch the list; six slugs in the first draft
were wrong because they were guessed rather than verified.

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
