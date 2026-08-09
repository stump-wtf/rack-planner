// the designs library holds many named racks in localStorage. the store below
// stubs localStorage so migration and CRUD are genuinely covered end to end —
// the same approach the state tests take, just with a store that persists
// across calls.

import test from "node:test";
import assert from "node:assert/strict";

import {
  loadLibrary,
  saveLibrary,
  listDesigns,
  getDesign,
  createDesign,
  cloneDesign,
  renameDesign,
  deleteDesign,
  setActive,
  getActive,
  emptyLibrary,
  cleanName,
} from "../js/designs.js";

function makeStore() {
  const data = {};
  const store = {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    removeItem: (k) => {
      delete data[k];
    },
    clear: () => {
      for (const k of Object.keys(data)) delete data[k];
    },
    _raw: data,
  };
  return store;
}

async function withStore(store, fn) {
  const prev = globalThis.localStorage;
  globalThis.localStorage = store;
  try {
    return await fn();
  } finally {
    globalThis.localStorage = prev;
  }
}

test("a v1 single-layout key migrates into a one-design library", () => {
  const store = makeStore();
  store.setItem(
    "rackplanner.v1",
    JSON.stringify({
      chassisId: "8u",
      depthMm: 260,
      budgetW: 300,
      items: [{ id: "x", name: "switch", u: 1, width: "full", row: 0, col: 0 }],
    }),
  );

  withStore(store, () => {
    const lib = loadLibrary();
    assert.equal(lib.designs.length, 1);
    assert.equal(lib.designs[0].name, "my rack");
    assert.equal(lib.designs[0].layout.items[0].name, "switch");
  });
});

test("the old key survives migration — a cached older build still reads it", () => {
  const store = makeStore();
  store.setItem(
    "rackplanner.v1",
    JSON.stringify({ chassisId: "4u", depthMm: 198, budgetW: 0, items: [] }),
  );

  withStore(store, () => {
    loadLibrary();
    assert.notEqual(store.getItem("rackplanner.v1"), null);
  });
});

test("migration is idempotent — running twice does not duplicate the design", () => {
  const store = makeStore();
  store.setItem(
    "rackplanner.v1",
    JSON.stringify({ chassisId: "8u", depthMm: 260, budgetW: 300, items: [] }),
  );

  withStore(store, () => {
    loadLibrary();
    loadLibrary();
    const lib = loadLibrary();
    assert.equal(lib.designs.length, 1);
  });
});

test("garbage in the legacy key yields a fresh library instead of throwing", () => {
  const store = makeStore();
  store.setItem("rackplanner.v1", "{not json");

  withStore(store, () => {
    const lib = loadLibrary();
    assert.equal(lib.designs.length, 1);
    assert.equal(lib.designs[0].name, "untitled rack");
  });
});

test("garbage in the library key yields a fresh library instead of throwing", () => {
  const store = makeStore();
  store.setItem("rackplanner.designs.v1", "}}corrupt");

  withStore(store, () => {
    const lib = loadLibrary();
    assert.equal(lib.designs.length, 1);
  });
});

test("a missing store yields a fresh library with one empty design", () => {
  const store = makeStore();

  withStore(store, () => {
    const lib = loadLibrary();
    assert.equal(lib.designs.length, 1);
    assert.equal(lib.designs[0].layout.items.length, 0);
  });
});

test("cloneDesign gives every item a fresh id", () => {
  const store = makeStore();
  withStore(store, () => {
    const a = createDesign({
      name: "original",
      layout: {
        chassisId: "8u",
        depthMm: 260,
        budgetW: 300,
        items: [
          { id: "item1", name: "a", u: 1, width: "full", row: 0, col: 0 },
          { id: "item2", name: "b", u: 1, width: "full", row: 2, col: 0 },
        ],
      },
    });

    const copy = cloneDesign(a.id);
    assert.notEqual(copy.id, a.id);

    const orig = getDesign(a.id);
    const clone = getDesign(copy.id);
    assert.notEqual(orig.layout.items[0].id, clone.layout.items[0].id);
    assert.notEqual(orig.layout.items[1].id, clone.layout.items[1].id);
  });
});

test("mutating a clone's items does not touch the original", () => {
  const store = makeStore();
  withStore(store, () => {
    const a = createDesign({
      name: "original",
      layout: {
        chassisId: "8u",
        depthMm: 260,
        budgetW: 300,
        items: [
          { id: "x", name: "switch", u: 1, width: "full", row: 0, col: 0 },
        ],
      },
    });

    const copy = cloneDesign(a.id);
    getDesign(copy.id).layout.items[0].name = "changed";
    getDesign(copy.id).layout.items[0].row = 99;

    const orig = getDesign(a.id);
    assert.equal(orig.layout.items[0].name, "switch");
    assert.equal(orig.layout.items[0].row, 0);
  });
});

test("clone naming dedupes — cloning twice gives distinct names", () => {
  const store = makeStore();
  withStore(store, () => {
    const a = createDesign({ name: "homelab" });
    const c1 = cloneDesign(a.id);
    const c2 = cloneDesign(a.id);

    assert.equal(c1.name, "homelab copy");
    assert.equal(c2.name, "homelab copy 2");
  });
});

test("deleting the active design picks a new active one", () => {
  const store = makeStore();
  withStore(store, () => {
    // start from a clean library so we control the count
    const lib = loadLibrary();
    const a = createDesign({ name: "a" });
    const b = createDesign({ name: "b" });
    setActive(a.id);

    deleteDesign(a.id);
    const after = loadLibrary();
    assert.notEqual(after.activeId, a.id);
    // the initial empty design + b remain
    assert.equal(after.designs.length, lib.designs.length + 1);
  });
});

test("deleting the last design leaves one empty design behind", () => {
  const store = makeStore();
  withStore(store, () => {
    const a = createDesign({ name: "a" });
    deleteDesign(a.id);

    const lib = loadLibrary();
    assert.equal(lib.designs.length, 1);
    assert.equal(lib.designs[0].name, "untitled rack");
    assert.equal(lib.designs[0].layout.items.length, 0);
  });
});

test("listDesigns is sorted by updatedAt descending and carries no layouts", async () => {
  const store = makeStore();
  await withStore(store, async () => {
    const a = createDesign({ name: "alpha" });
    const b = createDesign({ name: "beta" });
    // renaming a bumps its updatedAt above b — needs a real time gap so the
    // millisecond timestamps actually differ
    await new Promise((r) => setTimeout(r, 2));
    renameDesign(a.id, "alpha-renamed");

    const list = listDesigns();
    assert.equal(list[0].name, "alpha-renamed");

    for (const d of list) {
      assert.equal("layout" in d, false);
    }
  });
});

test("cleanName trims, collapses whitespace, caps length, and lowercases", () => {
  assert.equal(cleanName("  My   Rack  "), "my rack");
  assert.equal(cleanName("X".repeat(100)).length, 60);
  assert.equal(cleanName(""), "untitled rack");
  assert.equal(cleanName(null), "untitled rack");
  assert.equal(cleanName(undefined), "untitled rack");
});

test("getActive returns the active design record", () => {
  const store = makeStore();
  withStore(store, () => {
    const a = createDesign({ name: "a" });
    assert.equal(getActive().id, a.id);

    const b = createDesign({ name: "b" });
    assert.equal(getActive().id, b.id);

    setActive(a.id);
    assert.equal(getActive().id, a.id);
  });
});

test("saveLibrary and loadLibrary round-trip", () => {
  const store = makeStore();
  withStore(store, () => {
    const lib = emptyLibrary();
    saveLibrary(lib);
    const loaded = loadLibrary();
    assert.equal(loaded.designs.length, 1);
    assert.equal(loaded.designs[0].name, lib.designs[0].name);
  });
});
