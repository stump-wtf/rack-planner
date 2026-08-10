import test from "node:test";
import assert from "node:assert/strict";

import { TAG, serialize, deserialize, isTextTarget } from "../js/clipboard.js";

const device = {
  id: "d1",
  name: "mini pc",
  u: 2,
  width: "half",
  depthMm: 200,
  watts: 45,
  color: "#7D56F4",
  icon: "si:raspberrypi",
  row: 4,
  col: 1,
};

test("a device round-trips through the clipboard", () => {
  const got = deserialize(serialize(device));
  assert.equal(got.name, "mini pc");
  assert.equal(got.u, 2);
  assert.equal(got.width, "half");
  assert.equal(got.depthMm, 200);
  assert.equal(got.watts, 45);
  assert.equal(got.color, "#7D56F4");
  assert.equal(got.icon, "si:raspberrypi");
});

test("the rack width a device fits is carried", () => {
  // without it, a pasted 19" server sheds its width tag and squats in a 10"
  // rack through every later width switch
  const got = deserialize(serialize({ ...device, fits: "19" }));
  assert.equal(got.fits, "19");
});

test("an untagged device stays untagged through the clipboard", () => {
  // custom devices carry no `fits` — pasting one must not invent a width
  const got = deserialize(serialize(device));
  assert.equal(got.fits, undefined);
});

test("position and identity are deliberately not carried", () => {
  const got = deserialize(serialize(device));
  assert.equal(
    got.row,
    undefined,
    "a paste is placed by firstFit, not on top of the original",
  );
  assert.equal(got.col, undefined);
  assert.equal(got.id, undefined, "the paste must get a fresh id");
});

test("the payload is tagged and human-legible", () => {
  const s = serialize(device);
  assert.ok(s.startsWith(TAG + ":"));
  assert.ok(
    s.includes("mini pc"),
    "pasting into an editor should show something readable",
  );
});

test("ordinary text pastes are ignored, not mangled", () => {
  assert.equal(deserialize("hello world"), null);
  assert.equal(deserialize(""), null);
  assert.equal(deserialize(undefined), null);
  assert.equal(deserialize("https://rack-planner.stump.rocks/#zAbC"), null);
});

test("a corrupt payload is rejected rather than throwing", () => {
  assert.equal(deserialize(TAG + ":{not json"), null);
  assert.equal(deserialize(TAG + ":null"), null);
  assert.equal(deserialize(TAG + ":[1,2,3]"), null);
});

test("a hostile payload is clamped to something the grid can express", () => {
  const got = deserialize(
    TAG +
      ":" +
      JSON.stringify({
        name: "x".repeat(500),
        u: 9999,
        width: "diagonal",
        depthMm: -50,
        watts: -1,
        color: "javascript:alert(1)",
        icon: "y".repeat(500),
      }),
  );
  assert.equal(got.name.length, 64, "name is truncated");
  assert.equal(got.u, 4, "height is clamped to what a 4u rack can hold");
  assert.equal(got.width, "full", "an unknown width falls back to full");
  assert.equal(got.depthMm, 0, "negative depth is floored");
  assert.equal(got.watts, 0);
  assert.equal(
    got.color,
    "#7D56F4",
    "a non-hex colour is replaced, never passed through",
  );
  assert.equal(got.icon.length, 64);
});

test("odd heights snap to the half-U grid", () => {
  const paste = (u) =>
    deserialize(TAG + ":" + JSON.stringify({ name: "a", u }));
  assert.equal(paste(1.4).u, 1.5);
  assert.equal(paste(1.1).u, 1);
  assert.equal(paste(0).u, 1, "zero is not a usable height");
  assert.equal(paste("nonsense").u, 1);
});

test("printed-part provenance survives a copy", () => {
  const print = {
    ...device,
    maker: "Nautilus Forge",
    collection: "storage-rack",
    uExact: false,
  };
  const got = deserialize(serialize(print));
  assert.equal(got.maker, "Nautilus Forge");
  assert.equal(got.collection, "storage-rack");
  assert.equal(
    got.uExact,
    false,
    "an estimated height stays flagged after a paste",
  );
});

test("copy/paste inside a text field is left to the browser", () => {
  assert.equal(isTextTarget({ tagName: "INPUT" }), true);
  assert.equal(isTextTarget({ tagName: "TEXTAREA" }), true);
  assert.equal(isTextTarget({ tagName: "SELECT" }), true);
  assert.equal(isTextTarget({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(isTextTarget({ tagName: "DIV" }), false);
  assert.equal(isTextTarget(null), false);
});
