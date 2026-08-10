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
  powerOf,
  RACK_WIDTHS,
  chassisFor,
  catalogFor,
  panelScale,
} from "../js/model.js";
import { rowsFor, rowSpanFor, colSpanFor } from "../js/grid.js";

test('the three 10" sizes are present, and still a t2-family 260mm cabinet', () => {
  assert.deepEqual(
    chassisFor("10").map((c) => c.u),
    [4, 8, 12],
  );
  for (const c of chassisFor("10")) {
    assert.equal(c.depthMm, 260, `${c.id} is a t2-family 260mm cabinet`);
  }
});

test('the 10" ids never change — they travel in share links', () => {
  // a link minted before 19" existed carries c:"8u". Rename these and every
  // link ever shared quietly resolves to the wrong rack.
  assert.deepEqual(
    chassisFor("10").map((c) => c.id),
    ["4u", "8u", "12u"],
  );
});

test('the 19" sizes cover wall, frame, rolling and full height', () => {
  assert.deepEqual(
    chassisFor("19").map((c) => c.u),
    [6, 12, 18, 27, 42],
  );
  // depth is the dimension that bites, and it has to grow with the rack
  const depths = chassisFor("19").map((c) => c.depthMm);
  assert.deepEqual(
    [...depths].sort((a, b) => a - b),
    depths,
  );
  assert.ok(depths.at(-1) >= 1000, "a full-height rack is 1000mm deep");
});

test('19" chassis ids are namespaced, so they cannot collide with the 10" ones', () => {
  for (const c of chassisFor("19")) assert.match(c.id, /^19-/);
  assert.equal(CHASSIS.length, new Set(CHASSIS.map((c) => c.id)).size);
});

test("panelScale is the one ratio both renderers share", () => {
  // ui-rack (440px base) and export (430px base) both scale off this; if it
  // drifts, the screen and the exported svg stop agreeing on proportions
  assert.equal(panelScale("10"), 1);
  assert.equal(panelScale("19"), 482.6 / 254);
  assert.equal(panelScale("nonsense"), 1, 'unknown widths fall back to 10"');
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

test("every catalog device fits the smallest rack of its own width", () => {
  // per width, not globally: a 4u 19" server has no business being measured
  // against a 4u 10" cabinet it can never go in
  for (const w of RACK_WIDTHS) {
    const smallest = Math.min(...chassisFor(w.id).map((c) => c.u));
    const rows = rowsFor(smallest);
    for (const d of catalogFor(w.id)) {
      assert.ok(
        rowSpanFor(d.u) <= rows,
        `${d.id} cannot fit a ${smallest}u ${w.label} rack`,
      );
      assert.ok(colSpanFor(d.width) <= 2);
    }
  }
});

test("every catalog device says which rack width it fits", () => {
  const ids = RACK_WIDTHS.map((w) => w.id);
  for (const d of CATALOG) {
    assert.ok(ids.includes(d.fits), `${d.id} has no rack width`);
  }
});

test("both widths have gear in every category they claim", () => {
  for (const w of RACK_WIDTHS) {
    const cats = new Set(catalogFor(w.id).map((d) => d.cat));
    for (const need of ["compute", "network", "power", "passive"]) {
      assert.ok(cats.has(need), `${w.label} has no ${need} gear`);
    }
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

// ── power ──────────────────────────────────────────────────────────────────
//
// powerOf is the single place that decides what "getting close" means, so the
// inspector meter, the gauge beside the rack and the exported svg cannot drift
// apart. state.derived() and export.toSvg() both read it.

const draw = (...watts) => watts.map((w) => ({ watts: w }));

test("powerOf sums every device's draw", () => {
  assert.equal(powerOf(draw(12, 15, 60), 300).watts, 87);
  assert.equal(powerOf([], 300).watts, 0);
});

test("a rack with headroom has no level", () => {
  assert.equal(powerOf(draw(87), 300).level, "");
  assert.equal(powerOf(draw(87), 300).overBudget, false);
});

test("past 80% it warns, past the budget it is over", () => {
  assert.equal(powerOf(draw(81), 100).level, "is-warn");
  assert.equal(
    powerOf(draw(80), 100).level,
    "",
    "exactly 80% is not yet close",
  );
  assert.equal(powerOf(draw(101), 100).level, "is-bad");
  // exactly on budget is not OVER, but it is certainly close
  assert.equal(powerOf(draw(100), 100).level, "is-warn");
  assert.equal(powerOf(draw(100), 100).overBudget, false);
});

test("no budget is idle, not over — there is nothing to measure against", () => {
  const p = powerOf(draw(500), 0);
  assert.equal(p.level, "is-idle");
  assert.equal(p.overBudget, false);
  assert.equal(p.pct, 0);
});

test("garbage degrades to zero rather than NaN", () => {
  assert.equal(powerOf(draw("x", null, undefined), "nope").watts, 0);
  assert.equal(powerOf(draw(10), -5).budgetW, 0);
});
