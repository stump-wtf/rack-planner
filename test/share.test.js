import test from "node:test";
import assert from "node:assert/strict";
import { chassisById } from "../js/model.js";

import { encode, decode, toWire, fromWire, SCHEMA } from "../js/share.js";

const sample = {
  chassisId: "12u",
  depthMm: 260,
  budgetW: 300,
  items: [
    {
      id: "x1",
      name: "raspberry pi 5",
      u: 1,
      width: "half",
      depthMm: 120,
      watts: 12,
      color: "#00F0A8",
      row: 0,
      col: 0,
    },
    {
      id: "x2",
      name: "mini pc",
      u: 2,
      width: "half",
      depthMm: 200,
      watts: 45,
      color: "#7D56F4",
      row: 0,
      col: 1,
    },
    {
      id: "x3",
      name: "12-port patch panel",
      u: 0.5,
      width: "full",
      depthMm: 60,
      watts: 0,
      color: "#4EE6FF",
      row: 4,
      col: 0,
    },
  ],
};

test("a layout survives a full encode/decode round trip", async () => {
  const round = await decode(await encode(sample));
  assert.equal(round.chassisId, "12u");
  assert.equal(round.depthMm, 260);
  assert.equal(round.budgetW, 300);
  assert.equal(round.items.length, 3);
  for (let i = 0; i < sample.items.length; i++) {
    const a = sample.items[i];
    const b = round.items[i];
    assert.equal(b.name, a.name);
    assert.equal(b.u, a.u);
    assert.equal(b.width, a.width);
    assert.equal(b.depthMm, a.depthMm);
    assert.equal(b.watts, a.watts);
    assert.equal(b.color, a.color);
    assert.equal(b.row, a.row);
    assert.equal(b.col, a.col);
  }
});

test("an empty rack round trips", async () => {
  const empty = { chassisId: "4u", depthMm: 198, budgetW: 0, items: [] };
  const round = await decode(await encode(empty));
  assert.equal(round.chassisId, "4u");
  assert.equal(round.depthMm, 198);
  assert.deepEqual(round.items, []);
});

test("encoded layouts are url-safe", async () => {
  const s = await encode(sample);
  assert.match(
    s,
    /^[zr][A-Za-z0-9\-_]+$/,
    "tagged base64url, nothing needing escaping",
  );
});

test("encoding picks whichever of raw/deflate is shorter", async () => {
  // an empty rack is too small for deflate to pay for its own header
  const empty = { chassisId: "4u", depthMm: 260, budgetW: 0, items: [] };
  assert.match(await encode(empty), /^r/);

  // a full 12U of devices: deflate should win on the repetition
  const big = {
    chassisId: "12u",
    depthMm: 260,
    budgetW: 300,
    items: Array.from({ length: 24 }, (_, i) => ({
      ...sample.items[0],
      id: `b${i}`,
      row: i,
      col: i % 2,
    })),
  };
  const bigEnc = await encode(big);
  assert.match(bigEnc, /^z/);
  assert.ok(
    bigEnc.length < JSON.stringify(toWire(big)).length,
    "should beat raw json",
  );
  assert.equal((await decode(bigEnc)).items.length, 24);
});

test("the raw fallback encoding decodes too", async () => {
  const raw =
    "r" +
    Buffer.from(JSON.stringify(toWire(sample)), "utf8").toString("base64url");
  const round = await decode(raw);
  assert.equal(round.items.length, 3);
  assert.equal(round.items[0].name, "raspberry pi 5");
});

test("garbage input is rejected rather than silently yielding an empty rack", async () => {
  await assert.rejects(() => decode(""));
  await assert.rejects(() => decode("q!!!not-base64!!!"));
  await assert.rejects(() => decode("znotvaliddeflate"));
});

test("a future schema version is refused", () => {
  assert.throws(
    () => fromWire({ v: SCHEMA + 1, c: "8u", i: [] }),
    /unsupported layout version/,
  );
  assert.throws(() => fromWire({ v: SCHEMA, c: "8u" }), /no items/);
  assert.throws(() => fromWire(null), /not a layout/);
});

test("missing optional fields fall back to sane defaults", () => {
  const got = fromWire({
    v: SCHEMA,
    i: [[undefined, undefined, 0, 0, 0, undefined, 0, 0]],
  });
  assert.equal(got.chassisId, "8u");
  assert.equal(got.depthMm, 260);
  assert.equal(got.items[0].name, "device");
  assert.equal(got.items[0].u, 1);
  assert.equal(got.items[0].width, "full");
});

// ── rack width ─────────────────────────────────────────────────────────────
//
// The wire format carries the chassis id and nothing else about the rack, so
// width rides along for free — but only while the 10" ids stay put. A link
// minted before 19" existed says c:"8u", and it has to keep meaning the 10" 8u
// forever.

test('a link minted before 19" racks existed still opens as a 10" rack', () => {
  const legacy = {
    v: 1,
    c: "8u",
    d: 260,
    b: 300,
    i: [["switch", 1, 0, 130, 10, "#4EE6FF", 0, 0, "⇄"]],
  };
  const layout = fromWire(legacy);
  assert.equal(layout.chassisId, "8u");
  assert.equal(chassisById(layout.chassisId).width, "10");
  assert.equal(chassisById(layout.chassisId).u, 8);
});

test('a 19" rack round-trips through a link', () => {
  const wire = toWire({
    chassisId: "19-42u",
    depthMm: 1000,
    budgetW: 4000,
    items: [
      {
        name: "2u server",
        u: 2,
        width: "full",
        depthMm: 750,
        watts: 350,
        color: "#7D56F4",
        icon: "▭",
        row: 0,
        col: 0,
      },
    ],
  });
  const back = fromWire(wire);
  assert.equal(back.chassisId, "19-42u");
  assert.equal(chassisById(back.chassisId).width, "19");
  assert.equal(back.depthMm, 1000);
  assert.equal(back.items[0].depthMm, 750);
});

test("a link naming a chassis we do not have falls back to a real one", () => {
  const layout = fromWire({ v: 1, c: "48u-mainframe", d: 260, b: 0, i: [] });
  assert.ok(chassisById(layout.chassisId), "never undefined");
  assert.equal(chassisById(layout.chassisId).id, "8u");
});
