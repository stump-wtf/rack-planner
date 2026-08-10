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
  assert.equal(metaLine(d), '8u · 10" · 3 devices');
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
  assert.equal(metaLine(d), '4u · 10" · 1 device');
});

test("metaLine shows zero devices for an empty rack", () => {
  const d = design();
  assert.equal(metaLine(d), '8u · 10" · 0 devices');
});

test('metaLine tells a 10" 12u apart from a 19" 12u', () => {
  const at = (chassisId) =>
    metaLine(
      design({ layout: { chassisId, depthMm: 520, budgetW: 0, items: [] } }),
    );
  // both chassis share the label "12u"; the width is the only thing keeping
  // two designs distinguishable in the popover (and its delete confirm)
  assert.notEqual(at("12u"), at("19-12u"));
  assert.equal(at("19-12u"), '12u · 19" · 0 devices');
});

test("metaLine returns empty string for a null design", () => {
  assert.equal(metaLine(null), "");
});
