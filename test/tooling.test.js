import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// The Makefile and CI have to agree about prettier. They drifted once — CI
// pinned 3.3.3 while `make fmt` ran whatever was on PATH, and a newer prettier
// rewrapped a multi-value background-image that CI then rejected. These gates
// keep the pin in exactly one place.

const makefile = readFileSync(new URL("../Makefile", import.meta.url), "utf8");

const WORKFLOWS = new URL("../.gitea/workflows/", import.meta.url);
const workflows = readdirSync(WORKFLOWS).map((name) => ({
  name,
  body: readFileSync(new URL(name, WORKFLOWS), "utf8"),
}));

test("the Makefile owns the prettier pin", () => {
  const pin = makefile.match(/^PRETTIER_VERSION \?= (\S+)$/m);
  assert.ok(pin, "Makefile must define PRETTIER_VERSION");
  assert.match(pin[1], /^\d+\.\d+\.\d+$/, "the pin is exact, not a range");
});

test("no workflow pins a prettier of its own", () => {
  for (const { name, body } of workflows) {
    assert.equal(
      /prettier@/.test(body),
      false,
      `${name} invokes a versioned prettier directly — it must call make instead`,
    );
  }
});

test("CI runs formatting strictly, so a missing prettier cannot pass", () => {
  const ci = workflows.find((w) => w.name === "ci.yaml");
  assert.ok(ci, "ci.yaml exists");
  assert.match(
    ci.body,
    /make lint PRETTIER_STRICT=1/,
    "the lint job must run make lint with PRETTIER_STRICT=1",
  );
});
