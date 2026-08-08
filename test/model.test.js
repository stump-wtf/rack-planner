import test from "node:test";
import assert from "node:assert/strict";

import {
  U_MM,
  CHASSIS,
  CATALOG,
  CATEGORIES,
  SWATCHES,
  chassisById,
  catalogById,
  heightMm,
  PRINTS,
  COLLECTIONS,
  collectionById,
} from "../js/model.js";
import { rowsFor, rowSpanFor, colSpanFor } from "../js/grid.js";

test("the three chassis sizes joe asked for are present", () => {
  assert.deepEqual(
    CHASSIS.map((c) => c.u),
    [4, 8, 12],
  );
  for (const c of CHASSIS) {
    assert.equal(c.depthMm, 260, `${c.id} is a t2-family 260mm cabinet`);
  }
});

test("chassisById falls back rather than returning undefined", () => {
  assert.equal(chassisById("12u").u, 12);
  assert.equal(chassisById("nonsense").u, 8);
});

test("every catalog device is physically expressible on the grid", () => {
  const seen = new Set();
  for (const d of CATALOG) {
    assert.ok(!seen.has(d.id), `duplicate catalog id ${d.id}`);
    seen.add(d.id);
    assert.ok(
      d.name && d.name === d.name.toLowerCase(),
      `${d.id} name should be lowercase`,
    );
    assert.ok(["full", "half"].includes(d.width), `${d.id} has a bad width`);
    assert.equal(
      d.u * 2,
      Math.round(d.u * 2),
      `${d.id} must be a whole number of half-U`,
    );
    assert.ok(d.u > 0 && d.u <= 4, `${d.id} has an implausible height`);
    assert.ok(d.depthMm >= 0, `${d.id} has a bad depth`);
    assert.ok(d.watts >= 0, `${d.id} has a bad wattage`);
    assert.match(
      d.color,
      /^#[0-9A-F]{6}$/i,
      `${d.id} colour should be a hex triplet`,
    );
    assert.ok(
      CATEGORIES.some((c) => c.id === d.cat),
      `${d.id} is in an unknown category`,
    );
  }
});

test("every catalog device fits in the smallest chassis", () => {
  const rows = rowsFor(4);
  for (const d of CATALOG) {
    assert.ok(rowSpanFor(d.u) <= rows, `${d.id} cannot fit a 4u rack`);
    assert.ok(colSpanFor(d.width) <= 2);
  }
});

test("half-width entries exist — the model would be pointless otherwise", () => {
  assert.ok(CATALOG.some((d) => d.width === "half"));
  assert.ok(CATALOG.some((d) => d.u === 0.5));
});

test("every category has at least one device", () => {
  for (const c of CATEGORIES) {
    assert.ok(
      CATALOG.some((d) => d.cat === c.id),
      `category ${c.id} is empty`,
    );
  }
});

test("catalogById returns null for an unknown id", () => {
  assert.equal(catalogById("pi5").name, "raspberry pi 5");
  assert.equal(catalogById("nope"), null);
});

test("catalog colours come from the theme palette", () => {
  for (const d of CATALOG) {
    assert.ok(SWATCHES.includes(d.color), `${d.id} uses an off-palette colour`);
  }
});

test("both makerworld collections are represented in the prints", () => {
  assert.equal(COLLECTIONS.length, 2);
  for (const c of COLLECTIONS) {
    assert.match(c.url, /^https:\/\/makerworld\.com\/en\/collections\//);
    assert.ok(
      PRINTS.some((p) => p.collection === c.id),
      `collection ${c.id} has no prints`,
    );
  }
  assert.equal(
    PRINTS.length,
    25,
    "25 unique models across the two collections",
  );
});

test("every printed part credits a maker and a real collection", () => {
  for (const p of PRINTS) {
    assert.match(p.id, /^mw-/, `${p.id} should be namespaced mw-`);
    assert.ok(p.maker && p.maker.trim(), `${p.id} is missing its maker`);
    assert.ok(
      collectionById(p.collection),
      `${p.id} points at unknown collection ${p.collection}`,
    );
    assert.equal(p.printed, true);
    assert.equal(p.cat, "printed");
  }
});

test("estimated heights are flagged, and most heights are not estimates", () => {
  const guessed = PRINTS.filter((p) => !p.uExact);
  assert.ok(guessed.length > 0, "some titles genuinely do not state a height");
  assert.ok(
    guessed.length < PRINTS.length / 2,
    "most heights should come from the model title, not a guess",
  );
  // anything flagged exact must have its height in the source title or be a
  // stock size we are confident about — at minimum it must be a real half-U value
  for (const p of PRINTS) {
    assert.equal(
      p.u * 2,
      Math.round(p.u * 2),
      `${p.id} is not a half-U multiple`,
    );
  }
});

test("printed parts are searchable by maker as well as name", () => {
  const hits = PRINTS.filter((p) => p.maker === "Nautilus Forge");
  assert.ok(
    hits.length >= 3,
    "Nautilus Forge shows up across both collections",
  );
});

test("panel height converts U to millimetres", () => {
  assert.equal(U_MM, 44.45);
  assert.equal(heightMm(1), 44.45);
  assert.equal(heightMm(0.5), 22.23);
  assert.equal(heightMm(12), 533.4);
});
