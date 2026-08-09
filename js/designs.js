// designs.js — a library of named rack designs in localStorage.
//
// the app used to persist exactly one anonymous layout. this module wraps that
// into a collection: several named designs, one active at a time, switchable
// without losing the others. the store in state.js routes persistence through
// here; the UI lives in a separate issue.
//
// the wire format is a single JSON object under LIBRARY_KEY. the old
// single-layout key (LEGACY_KEY in state.js) is migrated on first load and
// left in place — a cached service-worker build or a rolled-back deploy must
// still find its rack.

const LIBRARY_KEY = "rackplanner.designs.v1";

import { nextId, LEGACY_KEY, DEFAULTS } from "./state.js";
export { nextId };

/** a fresh library with one empty design — the bottom state, never empty. */
export function emptyLibrary() {
  const now = Date.now();
  const id = nextId();
  return {
    v: 1,
    activeId: id,
    designs: [
      {
        id,
        name: "untitled rack",
        createdAt: now,
        updatedAt: now,
        layout: { ...DEFAULTS, items: [] },
      },
    ],
  };
}

/**
 * names: trim, collapse internal whitespace, cap at 60 chars, and fall back to
 * "untitled rack" when empty. the app is lowercase throughout — device names
 * are lowercased on input — so a design name goes through the same rule.
 */
export function cleanName(raw) {
  const name = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 60)
    .toLowerCase();
  return name || "untitled rack";
}

/**
 * load the library from localStorage, migrating from the legacy single-layout
 * key when the new key does not yet exist. never throws: a corrupt or
 * unreadable store returns a fresh empty library, same defensive posture as
 * restore() in state.js.
 */
export function loadLibrary() {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (raw) {
      const lib = normalize(JSON.parse(raw));
      // null means the stored object was unusable — fall through and seed,
      // rather than handing back a library that is never written down.
      if (lib) return lib;
    }
  } catch {
    // fall through to migration / empty
  }

  // the old single-layout key. wrap it as one design rather than losing the
  // user's rack on upgrade. leave the old key in place — a cached older build
  // still reads it.
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const layout = JSON.parse(legacy);
      if (layout && typeof layout === "object") {
        const now = Date.now();
        const id = nextId();
        const lib = {
          v: 1,
          activeId: id,
          designs: [
            {
              id,
              name: "my rack",
              createdAt: now,
              updatedAt: now,
              layout: {
                chassisId: layout.chassisId ?? DEFAULTS.chassisId,
                depthMm: Number(layout.depthMm) || DEFAULTS.depthMm,
                budgetW: Number(layout.budgetW) || 0,
                items: Array.isArray(layout.items) ? layout.items : [],
              },
            },
          ],
        };
        saveLibrary(lib);
        return lib;
      }
    }
  } catch {
    // fall through to empty
  }

  // seed and persist. an unsaved empty library would mint a brand new id on
  // every load, so two reads before the first write would disagree about which
  // design is active — and the first createDesign() would leave a phantom
  // "untitled rack" nobody asked for beside the one it made.
  const lib = emptyLibrary();
  saveLibrary(lib);
  return lib;
}

/** persist the library. swallows quota / private-mode errors — same contract
 *  as save() in state.js, for the same reason. */
export function saveLibrary(lib) {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib));
  } catch {
    /* private mode / quota — the url share is the real persistence story */
  }
}

/**
 * coerce an unknown JSON object into a valid library, or null when it is not
 * one — the caller seeds a fresh library rather than repairing in place, since
 * a half-parsed store is worse than none, because it looks loaded.
 */
function normalize(lib) {
  if (!lib || typeof lib !== "object") return null;
  if (!Array.isArray(lib.designs) || lib.designs.length === 0) return null;

  const designs = lib.designs
    .filter((d) => d && typeof d === "object" && d.id)
    .map((d) => ({
      id: String(d.id),
      name: cleanName(d.name),
      createdAt: Number(d.createdAt) || Date.now(),
      updatedAt: Number(d.updatedAt) || Date.now(),
      layout: normalizeLayout(d.layout),
    }));

  if (designs.length === 0) return null;

  const ids = new Set(designs.map((d) => d.id));
  const activeId = ids.has(lib.activeId) ? lib.activeId : designs[0].id;

  return { v: 1, activeId, designs };
}

function normalizeLayout(layout) {
  if (!layout || typeof layout !== "object") return { ...DEFAULTS, items: [] };
  return {
    chassisId: layout.chassisId ?? DEFAULTS.chassisId,
    depthMm: Number(layout.depthMm) || DEFAULTS.depthMm,
    budgetW: Number(layout.budgetW) || 0,
    items: Array.isArray(layout.items) ? layout.items : [],
  };
}

/** metadata for every design, most-recently-updated first, without layouts. */
export function listDesigns() {
  const lib = loadLibrary();
  return [...lib.designs]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((d) => ({
      id: d.id,
      name: d.name,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
}

/** the full design record, or null. */
export function getDesign(id) {
  const lib = loadLibrary();
  return lib.designs.find((d) => d.id === id) ?? null;
}

/** create a new design, append it, make it active, and return the record. */
export function createDesign(opts = {}) {
  const lib = loadLibrary();
  const now = Date.now();
  const id = nextId();
  const layout = opts.layout
    ? normalizeLayout(opts.layout)
    : { ...DEFAULTS, items: [] };
  const record = {
    id,
    name: cleanName(opts.name ?? "untitled rack"),
    createdAt: now,
    updatedAt: now,
    layout,
  };
  lib.designs.push(record);
  lib.activeId = id;
  saveLibrary(lib);
  return record;
}

/**
 * deep-copy a design's layout under a new id. every item gets a fresh id —
 * sharing ids between the clone and original means later edits
 * cross-contaminate, which is a data-loss bug, not a nicety.
 *
 * name defaults to "<original> copy", deduped so cloning twice gives
 * "x copy" and "x copy 2" rather than two identically named designs.
 */
export function cloneDesign(id, name) {
  const lib = loadLibrary();
  const src = lib.designs.find((d) => d.id === id);
  if (!src) return null;

  const now = Date.now();
  const newName =
    name != null ? cleanName(name) : dedupeName(lib, `${src.name} copy`);
  const clone = {
    id: nextId(),
    name: newName,
    createdAt: now,
    updatedAt: now,
    layout: {
      chassisId: src.layout.chassisId,
      depthMm: src.layout.depthMm,
      budgetW: src.layout.budgetW,
      items: src.layout.items.map((it) => ({ ...it, id: nextId() })),
    },
  };
  lib.designs.push(clone);
  lib.activeId = clone.id;
  saveLibrary(lib);
  return clone;
}

/**
 * rename bumps updatedAt — the list sorts on it, so renaming surfaces a design
 * to the top, which is what you expect after editing it.
 */
export function renameDesign(id, name) {
  const lib = loadLibrary();
  const d = lib.designs.find((d) => d.id === id);
  if (!d) return null;
  d.name = cleanName(name);
  d.updatedAt = Date.now();
  saveLibrary(lib);
  return d;
}

/**
 * delete must pick a sensible new activeId when the active design is the one
 * removed, and must never leave the library with zero designs (deleting the
 * last leaves a fresh empty design behind).
 */
export function deleteDesign(id) {
  const lib = loadLibrary();
  const idx = lib.designs.findIndex((d) => d.id === id);
  if (idx === -1) return lib;

  lib.designs.splice(idx, 1);

  if (lib.designs.length === 0) {
    // never empty — seed a fresh design so the app always has something to load
    const now = Date.now();
    const fresh = nextId();
    lib.designs.push({
      id: fresh,
      name: "untitled rack",
      createdAt: now,
      updatedAt: now,
      layout: { ...DEFAULTS, items: [] },
    });
    lib.activeId = fresh;
  } else if (lib.activeId === id) {
    // the active one was deleted — fall back to the most-recently-updated
    lib.activeId = [...lib.designs].sort(
      (a, b) => b.updatedAt - a.updatedAt,
    )[0].id;
  }

  saveLibrary(lib);
  return lib;
}

export function setActive(id) {
  const lib = loadLibrary();
  if (lib.designs.some((d) => d.id === id)) {
    lib.activeId = id;
    saveLibrary(lib);
  }
  return lib;
}

export function getActive() {
  // one read, not two — this runs on every render, and getDesign() would parse
  // the whole library a second time to find what we already have in hand.
  const lib = loadLibrary();
  return lib.designs.find((d) => d.id === lib.activeId) ?? null;
}

/** dedupe "x copy" → "x copy 2" when "x copy" already exists. */
function dedupeName(lib, base) {
  const names = new Set(lib.designs.map((d) => d.name));
  if (!names.has(base)) return base;
  let n = 2;
  while (names.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}
