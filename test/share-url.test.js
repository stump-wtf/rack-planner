import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// boot() prefers a layout in the URL fragment over the saved design. That is
// right for opening someone's link and wrong for your own tab: the share button
// writes the fragment, so after sharing once, every later edit was reverted on
// refresh — and loadLayout() commits, so the stale layout was written straight
// over the saved design. Editing a device's draw and reloading lost the number
// in both places.
//
// The fix is that the fragment only survives while it still describes what is
// on screen. app.js is DOM-bound and the repo has no jsdom, so these pin the
// wiring the same way tooling.test.js pins the prettier version.

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const state = readFileSync(new URL("../js/state.js", import.meta.url), "utf8");

test("sharing records the layout the link stands for", () => {
  const handler = app.slice(app.indexOf('$("share").addEventListener'));
  assert.match(
    handler.slice(0, handler.indexOf("});")),
    /urlLayout = snapshot\(\)/,
    "the share handler must remember what it encoded, or nothing can tell later whether the link went stale",
  );
});

test("loading from a link records it too", () => {
  const boot = app.slice(app.indexOf("async function boot()"));
  assert.match(boot, /urlLayout = snapshot\(\)/);
});

test("every render checks whether the link has gone stale", () => {
  const render = app.slice(app.indexOf("function renderAll()"));
  assert.match(render.slice(0, render.indexOf("\n}")), /dropStaleHash\(\)/);
});

test("a stale link is removed from the address bar", () => {
  const fn = app.slice(app.indexOf("function dropStaleHash()"));
  const body = fn.slice(0, fn.indexOf("\n}"));
  assert.match(body, /replaceState/);
  // compared against the store's own snapshot, so the two cannot disagree
  // about what counts as a change — and a bare selection is not one
  assert.match(body, /snapshot\(\) === urlLayout/);
});

test("state.js exports the snapshot the comparison relies on", () => {
  assert.match(state, /export function snapshot\(\)/);
});
