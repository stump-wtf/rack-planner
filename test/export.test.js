import test from "node:test";
import assert from "node:assert/strict";

import { toSvg, fmtU } from "../js/export.js";

const rack = (over = {}) => ({
  chassisId: "8u",
  depthMm: 260,
  budgetW: 300,
  items: [
    {
      name: "raspberry pi 5",
      u: 1,
      width: "half",
      depthMm: 120,
      watts: 12,
      color: "#00F0A8",
      icon: "◆",
      row: 0,
      col: 0,
    },
    {
      name: "router / firewall",
      u: 1,
      width: "half",
      depthMm: 160,
      watts: 15,
      color: "#4EE6FF",
      icon: "⌁",
      row: 0,
      col: 1,
    },
    {
      name: "nas",
      u: 2,
      width: "full",
      depthMm: 250,
      watts: 60,
      color: "#C8A2FF",
      icon: "▦",
      row: 2,
      col: 0,
    },
  ],
  ...over,
});

test("the export is a well-formed standalone svg", () => {
  const svg = toSvg(rack());
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.ok(svg.trimEnd().endsWith("</svg>"));
  // every element opened is closed — no stray fragments
  assert.equal(
    (svg.match(/<rect/g) || []).length,
    (svg.match(/<rect[^>]*\/>/g) || []).length,
  );
  assert.equal(
    (svg.match(/<text/g) || []).length,
    (svg.match(/<\/text>/g) || []).length,
  );
});

test("every placed device appears in the export", () => {
  const svg = toSvg(rack());
  for (const it of rack().items)
    assert.ok(svg.includes(it.name), `${it.name} is missing`);
  assert.ok(svg.includes("#00F0A8"), "device colours should carry over");
});

test("the header summarises the rack", () => {
  const svg = toSvg(rack(), { title: "homelab" });
  assert.ok(svg.includes("homelab"));
  assert.ok(svg.includes("8u · 10&quot; · 260mm deep · 3 devices · 87w"));
});

test("one device is not pluralised", () => {
  const svg = toSvg(rack({ items: [rack().items[0]] }));
  assert.ok(svg.includes("1 device ·"));
});

test("the canvas grows with the rack", () => {
  const h4 = Number(/height="(\d+)"/.exec(toSvg(rack({ chassisId: "4u" })))[1]);
  const h12 = Number(
    /height="(\d+)"/.exec(toSvg(rack({ chassisId: "12u" })))[1],
  );
  assert.ok(h12 > h4, "12u should render taller than 4u");
  assert.equal(h12 - h4, 8 * 46, "exactly eight more U of rack");
});

test("device names cannot inject markup", () => {
  const svg = toSvg(
    rack({
      items: [
        { ...rack().items[0], name: "<script>alert(1)</script>", icon: "&" },
      ],
    }),
  );
  assert.ok(!svg.includes("<script>"), "raw markup must be escaped");
  assert.ok(
    svg.includes("&lt;script&gt;") || svg.includes("&lt;scrip"),
    "escaped form expected",
  );
  assert.ok(svg.includes("&amp;"), "ampersands must be escaped");
});

test("an empty rack still exports a frame", () => {
  const svg = toSvg(rack({ items: [] }));
  assert.ok(svg.includes("0 devices"));
  assert.match(svg, /<\/svg>$/m);
});

test("a dead icon falls back to the glyph, never to literal ref text", () => {
  // The docs promise "an icon that fails to fetch falls back to a glyph".
  // resolveIcons() records a failed fetch as null IN the map, so the export
  // has to treat a mapped null the same as an unmapped reference.
  const device = { ...rack().items[0], icon: "sh:nope" };
  const failed = toSvg(rack({ items: [device] }), {
    icons: new Map([["sh:nope", null]]),
  });
  assert.ok(!failed.includes("sh:nope"), "the reference must not print");
  assert.ok(failed.includes("\u25aa"), "the fallback glyph prints instead");

  const unresolved = toSvg(rack({ items: [device] }));
  assert.ok(!unresolved.includes("sh:nope"));
  assert.ok(unresolved.includes("\u25aa"));
});

test("half-U heights render as .5u, whole ones without a decimal", () => {
  assert.equal(fmtU(1), "1");
  assert.equal(fmtU(2), "2");
  assert.equal(fmtU(0.5), ".5");
  assert.equal(fmtU(1.5), "1.5");
});
