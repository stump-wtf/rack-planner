// the power budget is a whole-rack number, and the inspector now writes to it
// on every keystroke — so the undo coalescing that keeps a typed value to one
// Cmd-Z is load-bearing, not a nicety.

import test from "node:test";
import assert from "node:assert/strict";

import {
  state,
  commit,
  undo,
  endEditRun,
  derived,
  loadLayout,
} from "../js/state.js";

/**
 * the store is a module singleton. drain the undo stack first, then assign
 * directly rather than through commit() — a commit would leave an entry of its
 * own, and these tests count entries.
 */
function reset(over = {}) {
  while (undo());
  Object.assign(state, {
    chassisId: "8u",
    depthMm: 260,
    budgetW: 300,
    items: [],
    selectedId: null,
    ...over,
  });
  endEditRun();
}

const dev = (id, watts, over = {}) => ({
  id,
  name: id,
  u: 1,
  width: "full",
  depthMm: 100,
  watts,
  row: 0,
  col: 0,
  ...over,
});

test("draw is the sum of every device in the rack, not one of them", () => {
  reset({ items: [dev("a", 12), dev("b", 30, { row: 2 })] });
  const d = derived();
  assert.equal(d.watts, 42);
  assert.equal(d.budgetW, 300);
  assert.equal(d.headroomW, 258);
  assert.equal(d.overBudget, false);
});

test("percent, level and headroom track the whole-rack budget", () => {
  reset({ budgetW: 100, items: [dev("a", 50)] });
  assert.equal(derived().pct, 50);
  assert.equal(derived().powerLevel, "");

  commit((s) => (s.items[0].watts = 85));
  assert.equal(derived().powerLevel, "is-warn");

  commit((s) => (s.items[0].watts = 130));
  const over = derived();
  assert.equal(over.powerLevel, "is-bad");
  assert.equal(over.overBudget, true);
  assert.equal(over.headroomW, -30);
  assert.equal(over.pct, 130);
});

test("a zero budget means unmeasured, not over budget", () => {
  reset({ budgetW: 0, items: [dev("a", 500)] });
  const d = derived();
  assert.equal(d.watts, 500);
  assert.equal(d.overBudget, false);
  assert.equal(d.pct, 0);
  assert.equal(d.headroomW, null);
  assert.equal(d.powerLevel, "");
});

test("a garbage budget degrades to zero rather than NaN", () => {
  reset({ budgetW: undefined, items: [dev("a", 10)] });
  assert.equal(derived().budgetW, 0);
  assert.equal(Number.isNaN(derived().pct), false);
});

test("typing a budget digit by digit costs one undo, not three", () => {
  reset({ budgetW: 0 });
  for (const v of [7, 75, 750])
    commit((s) => (s.budgetW = v), { coalesce: "budget" });
  assert.equal(state.budgetW, 750);

  assert.equal(undo(), true);
  assert.equal(state.budgetW, 0);
  assert.equal(undo(), false);
});

test("leaving the field ends the run, so the next visit undoes separately", () => {
  reset({ budgetW: 0 });
  commit((s) => (s.budgetW = 100), { coalesce: "budget" });
  endEditRun();
  commit((s) => (s.budgetW = 200), { coalesce: "budget" });

  undo();
  assert.equal(state.budgetW, 100);
  undo();
  assert.equal(state.budgetW, 0);
});

test("an unrelated commit between runs also ends the run", () => {
  reset({ budgetW: 0, items: [dev("a", 5)] });
  commit((s) => (s.budgetW = 100), { coalesce: "budget" });
  commit((s) => (s.items[0].watts = 9), { coalesce: "watts:a" });
  commit((s) => (s.budgetW = 200), { coalesce: "budget" });

  undo();
  assert.equal(state.budgetW, 100);
  undo();
  assert.equal(state.items[0].watts, 5);
  undo();
  assert.equal(state.budgetW, 0);
});

test("two fields never share a run even when edited back to back", () => {
  reset({ items: [dev("a", 1), dev("b", 2, { row: 2 })] });
  commit((s) => (s.items[0].watts = 10), { coalesce: "watts:a" });
  commit((s) => (s.items[1].watts = 20), { coalesce: "watts:b" });

  undo();
  assert.equal(state.items[1].watts, 2);
  assert.equal(state.items[0].watts, 10);
});

test("a layout missing a budget loads as zero, not undefined", () => {
  reset();
  loadLayout({ chassisId: "4u", depthMm: 198, items: [] });
  assert.equal(state.budgetW, 0);
  assert.equal(state.depthMm, 198);
  assert.equal(derived().budgetW, 0);
});

test("a layout naming an unknown chassis loads as the fallback, not verbatim", () => {
  // the bogus id must not squat in state: it would leave no size button
  // pressed, ride into the autosaved design, and be re-encoded into the next
  // share link — normalizing at load stops the propagation
  reset();
  loadLayout({ chassisId: "48u-mainframe", depthMm: 260, items: [] });
  assert.equal(state.chassisId, "8u");
});
