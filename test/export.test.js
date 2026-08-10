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

test('a 19" rack exports wider than a 10" one, and says so', () => {
  const svg19 = toSvg(rack({ chassisId: "19-12u", items: [] }));
  const svg10 = toSvg(rack({ chassisId: "12u", items: [] }));
  const widthOf = (svg) => Number(/width="(\d+)"/.exec(svg)[1]);
  assert.ok(
    widthOf(svg19) > widthOf(svg10),
    'same u, but the 19" canvas must be wider',
  );
  // 430px is the 10" elevation; 19" scales by panel width, 482.6/254
  assert.match(svg19, /width="817"/, 'the 19" rack body is 817px');
  // the sub line names the width — esc() turns the inch mark into &quot;
  assert.ok(svg19.includes("19&quot;"));
  assert.ok(svg10.includes("10&quot;"));
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

// ── power gauge ────────────────────────────────────────────────────────────
//
// A plan you hand someone should carry its power story, not just its shelves.
// The export used to say "87w of 300w" in the header and then draw nothing, so
// the gauge the budget exists for was missing from every png anyone downloaded.
//
// The fixture rack draws 87w across its three devices.

/** the fill rect's height, or 0 when there is no fill at all */
const fillHeight = (svg) => {
  const m = svg.match(/<rect[^>]*height="(\d+)" fill="url\(#pg\)"/);
  return m ? Number(m[1]) : 0;
};
/** the gauge track's height, which the fill is a fraction of */
const trackHeight = (svg) => {
  const m = svg.match(/<rect x="\d+" y="\d+" width="22" height="(\d+)" rx="4"/);
  return m ? Number(m[1]) : 0;
};

test("a budgeted rack exports a gauge, filled to the fraction drawn", () => {
  const svg = toSvg(rack());
  const track = trackHeight(svg);
  assert.ok(track > 0, "the gauge track should be drawn");
  assert.equal(fillHeight(svg), Math.round(track * (87 / 300)));
});

test("the readout beside the gauge reads draw over budget", () => {
  assert.match(toSvg(rack()), />87w \/ 300w</);
});

test("over budget pins the fill at full and turns coral", () => {
  const svg = toSvg(rack({ budgetW: 10 }));
  assert.equal(
    fillHeight(svg),
    trackHeight(svg),
    "past 100% there is no more bar to give",
  );
  assert.match(svg, /stop-color="#FF6E5E"/);
});

test("getting close turns gold before it turns coral", () => {
  // 87w of 100w is 87% — warn, not bad
  const svg = toSvg(rack({ budgetW: 100 }));
  assert.match(svg, /stop-color="#FFC64B"/);
  assert.ok(!svg.includes("#FF6E5E"), "87% is not over budget");
});

test("no budget draws the track but nothing to measure against", () => {
  const svg = toSvg(rack({ budgetW: 0 }));
  assert.ok(trackHeight(svg) > 0, "the track is still drawn");
  assert.equal(fillHeight(svg), 0);
  assert.match(
    svg,
    /letter-spacing="0.4">87w</,
    "the readout falls back to the draw alone",
  );
});

test("the canvas is wide enough for the gauge and its readout", () => {
  const svg = toSvg(rack());
  const w = Number(svg.match(/<svg[^>]*width="(\d+)"/)[1]);
  const gx = Number(svg.match(/<rect x="(\d+)" y="\d+" width="22"/)[1]);
  assert.ok(gx + 22 < w, "the gauge must not run off the canvas");
});

test("the gauge has no quarter marks", () => {
  // Deliberate: they were tried, and on a bar this narrow they read as stray
  // lines through the fill rather than as a scale. The readout beside the
  // gauge is what gives you the actual number.
  const svg = toSvg(rack());
  const gx = svg.match(/<rect x="(\d+)" y="\d+" width="22"/)[1];
  const across = svg
    .match(/<line[^>]*>/g)
    .filter((l) => l.includes(`x1="${gx}"`));
  assert.deepEqual(across, [], "nothing should be drawn across the gauge");
});
