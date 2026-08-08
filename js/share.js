// share.js — layout ⇄ url hash.
//
// the whole plan rides in the fragment, so it never reaches a server. json is
// deflated with the native CompressionStream where available (every current
// browser, and node 18+) and falls back to plain base64url otherwise.

export const SCHEMA = 1;

/** compact wire form — short keys, no defaults, so short racks make short urls. */
export function toWire(state) {
  return {
    v: SCHEMA,
    c: state.chassisId,
    d: state.depthMm,
    b: state.budgetW,
    i: state.items.map((it) => [
      it.name,
      it.u,
      it.width === "half" ? 1 : 0,
      it.depthMm || 0,
      it.watts || 0,
      it.color,
      it.row,
      it.col,
      // index 8 appended in place rather than bumping SCHEMA: a v1 link without
      // it still decodes (a[8] is undefined and falls back to the glyph), and
      // older code simply ignores the extra element.
      it.icon ?? "▪",
    ]),
  };
}

export function fromWire(w) {
  if (!w || typeof w !== "object") throw new Error("not a layout");
  if (w.v !== SCHEMA) throw new Error(`unsupported layout version ${w.v}`);
  if (!Array.isArray(w.i)) throw new Error("layout has no items");
  return {
    chassisId: String(w.c ?? "8u"),
    depthMm: Number(w.d) || 260,
    budgetW: Number(w.b) || 0,
    items: w.i.map((a, idx) => ({
      id: `i${idx}`,
      name: String(a[0] ?? "device"),
      u: Number(a[1]) || 1,
      width: a[2] ? "half" : "full",
      depthMm: Number(a[3]) || 0,
      watts: Number(a[4]) || 0,
      color: String(a[5] ?? "#7D56F4"),
      row: Number(a[6]) || 0,
      col: Number(a[7]) || 0,
      icon: a[8] ? String(a[8]).slice(0, 64) : "▪",
    })),
  };
}

const hasCompression = typeof CompressionStream === "function";

/**
 * deflate only wins above a few hundred bytes — below that its header costs
 * more than it saves. emit whichever form is actually shorter so a two-device
 * rack gets a short url and a packed 12U one still gets compressed.
 */
export async function encode(state) {
  const json = JSON.stringify(toWire(state));
  const raw = "r" + b64urlFromBytes(utf8(json));
  if (!hasCompression) return raw;
  const packed = await streamThrough(
    new CompressionStream("deflate-raw"),
    utf8(json),
  );
  const zipped = "z" + b64urlFromBytes(packed);
  return zipped.length < raw.length ? zipped : raw;
}

export async function decode(str) {
  if (!str) throw new Error("empty layout");
  const tag = str[0];
  const bytes = bytesFromB64url(str.slice(1));
  let json;
  if (tag === "z") {
    if (!hasCompression)
      throw new Error("this browser cannot read compressed layouts");
    json = fromUtf8(
      await streamThrough(new DecompressionStream("deflate-raw"), bytes),
    );
  } else if (tag === "r") {
    json = fromUtf8(bytes);
  } else {
    throw new Error("unrecognised layout encoding");
  }
  return fromWire(JSON.parse(json));
}

async function streamThrough(transform, bytes) {
  const writer = transform.writable.getWriter();
  // on malformed input the reader throws first and the writable side rejects
  // separately; swallow that one so it cannot surface as an unhandledRejection
  // long after the caller has already dealt with the read error.
  const written = writer
    .write(bytes)
    .then(() => writer.close())
    .catch(() => {});
  const chunks = [];
  const reader = transform.readable.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  await written;
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

function utf8(s) {
  return new TextEncoder().encode(s);
}
function fromUtf8(b) {
  return new TextDecoder().decode(b);
}

function b64urlFromBytes(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesFromB64url(s) {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
