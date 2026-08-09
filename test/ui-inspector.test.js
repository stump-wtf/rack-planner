import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The inspector's numeric boxes commit on every keystroke, which re-renders the
// whole panel and replaces the input node. renderKeepingFocus puts the caret
// back afterwards — but only if the input will tell it where the caret was.
//
// `<input type="number">` will not: selectionStart reads null and
// setSelectionRange throws InvalidStateError. So the restore silently did
// nothing, the caret snapped to 0, and each digit landed in front of the last —
// typing 1, 2, 0, 0 into the power budget produced 0021.
//
// The DOM layer has no test harness here (deliberately — no jsdom), so this
// guards the one property that keeps the caret restorable, the same way
// tooling.test.js guards the prettier pin: by reading the source.

const source = readFileSync(
  new URL("../js/ui-panels.js", import.meta.url),
  "utf8",
);

/** the body of numberField(), where the inspector's numeric inputs are built */
function numberFieldBody() {
  const start = source.indexOf("function numberField(");
  assert.notEqual(start, -1, "numberField must exist in js/ui-panels.js");
  const end = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, end === -1 ? undefined : end);
}

test("the inspector's numeric fields are not type=number", () => {
  const body = numberFieldBody();
  assert.ok(
    !/type:\s*"number"/.test(body),
    'numberField must not use type="number" — its caret cannot be restored ' +
      "across the per-keystroke re-render, so digits reverse as you type",
  );
  assert.ok(/type:\s*"text"/.test(body), 'numberField should use type="text"');
});

test("they still ask for a numeric keypad on touch", () => {
  assert.match(numberFieldBody(), /inputmode:\s*"numeric"/);
});

test("arrow keys still step the value, since the spinners are gone", () => {
  const body = numberFieldBody();
  assert.match(body, /ArrowUp/);
  assert.match(body, /ArrowDown/);
});

test("the caret restore ignores an input that reports no selection", () => {
  // A null selectionStart must not be stored as a caret: setSelectionRange
  // would throw on it, and the catch would swallow the failure.
  const start = source.indexOf("function renderKeepingFocus(");
  assert.notEqual(start, -1, "renderKeepingFocus must exist");
  const body = source.slice(start, source.indexOf("\nfunction ", start + 1));
  assert.match(body, /selectionStart\s*!=\s*null/);
});
