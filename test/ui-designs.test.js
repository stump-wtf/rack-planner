// the designs bar renders into the DOM, and the repo has no DOM test harness
// (deliberately — no jsdom). the pure helpers are tested here; the DOM layer
// is thin enough to verify by hand with `make dev`.

import test from "node:test";
import assert from "node:assert/strict";

import { metaLine } from "../js/ui-designs.js";

const design = (over = {}) => ({
  id: "x",
  name: "test",
  createdAt: 0,
  updatedAt: 0,
  layout: { chassisId: "8u", depthMm: 260, budgetW: 300, items: [] },
  ...over,
});

test("metaLine shows chassis size and device count", () => {
  const d = design({
    layout: {
      chassisId: "8u",
      depthMm: 260,
      budgetW: 300,
      items: [{ id: "a" }, { id: "b" }, { id: "c" }],
    },
  });
  assert.equal(metaLine(d), "8u · 3 devices");
});

test("metaLine uses singular 'device' when there is exactly one", () => {
  const d = design({
    layout: {
      chassisId: "4u",
      depthMm: 198,
      budgetW: 0,
      items: [{ id: "a" }],
    },
  });
  assert.equal(metaLine(d), "4u · 1 device");
});

test("metaLine shows zero devices for an empty rack", () => {
  const d = design();
  assert.equal(metaLine(d), "8u · 0 devices");
});

test("metaLine returns empty string for a null design", () => {
  assert.equal(metaLine(null), "");
});
