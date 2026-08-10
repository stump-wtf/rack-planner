// clipboard.js — copy/paste a device.
//
// Rides the browser's own `copy` and `paste` events rather than the async
// Clipboard API. That matters: clipboardData on a real user-initiated event
// needs no permission prompt and works cross-tab, whereas
// navigator.clipboard.readText() prompts in Firefox and is blocked outright
// when the document is not focused.
//
// The payload is tagged plain text, so pasting into an editor shows something
// legible and pasting arbitrary text back in is rejected cleanly.

export const TAG = "rack-planner/device";

/** the fields worth carrying — never the instance id or its position. */
export function serialize(item) {
  if (!item) return "";
  return (
    TAG +
    ":" +
    JSON.stringify({
      name: item.name,
      u: item.u,
      width: item.width,
      depthMm: item.depthMm || 0,
      watts: item.watts || 0,
      color: item.color,
      icon: item.icon ?? item.glyph ?? "▪",
      maker: item.maker,
      collection: item.collection,
      uExact: item.uExact,
      // the rack width this device fits — without it a pasted 19" server
      // sheds its tag and squats in a 10" rack through every width switch
      fits: item.fits,
    })
  );
}

/**
 * Parse a pasted payload back into a device, or null if it is not ours.
 * Null is the normal case — most pastes are just text — so this never throws.
 */
export function deserialize(text) {
  const s = String(text ?? "").trim();
  if (!s.startsWith(TAG + ":")) return null;
  let raw;
  try {
    raw = JSON.parse(s.slice(TAG.length + 1));
  } catch {
    return null;
  }
  // note: an array is typeof "object" and truthy, so exclude it explicitly
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const u = Number(raw.u);
  return {
    name: String(raw.name ?? "device").slice(0, 64),
    // a pasted payload is untrusted: clamp to something the grid can express
    u: Number.isFinite(u) && u > 0 ? Math.min(4, Math.round(u * 2) / 2) : 1,
    width: raw.width === "half" ? "half" : "full",
    depthMm: Math.max(0, Number(raw.depthMm) || 0),
    watts: Math.max(0, Number(raw.watts) || 0),
    color: /^#[0-9a-f]{6}$/i.test(String(raw.color)) ? raw.color : "#7D56F4",
    icon:
      typeof raw.icon === "string" && raw.icon ? raw.icon.slice(0, 64) : "▪",
    maker: raw.maker ? String(raw.maker).slice(0, 64) : undefined,
    collection: raw.collection
      ? String(raw.collection).slice(0, 32)
      : undefined,
    uExact: raw.uExact === false ? false : undefined,
    fits:
      typeof raw.fits === "string" && raw.fits
        ? String(raw.fits).slice(0, 8)
        : undefined,
  };
}

/** should a copy/paste be treated as text editing rather than a device op? */
export function isTextTarget(el) {
  if (!el || !el.tagName) return false;
  if (/^(input|textarea|select)$/i.test(el.tagName)) return true;
  return el.isContentEditable === true;
}
