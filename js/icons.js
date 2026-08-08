// icons.js — device icons, from two upstream libraries plus plain glyphs.
//
// An icon is stored on the device as a short REFERENCE, never as markup:
//
//   "sh:jellyfin"   selfh.st/icons  — the self-hosted software icon set
//   "si:docker"     simpleicons.org — brand marks
//   "▦"             anything else is taken literally as a Unicode glyph
//
// References stay short on purpose: the whole layout rides in a URL fragment,
// and inlining SVG markup would blow that out by kilobytes per device.
//
// The two indexes exist (845KB and 372KB) but are far too heavy to pull on page
// load, so there is no browse-all mode. You type a slug, you see it resolve or
// you don't, and SUGGESTIONS below covers the common homelab cases.

export const SOURCES = {
  sh: {
    id: "sh",
    label: "selfh.st",
    browse: "https://selfh.st/icons/",
    url: (slug) => `https://cdn.jsdelivr.net/gh/selfhst/icons/svg/${slug}.svg`,
  },
  si: {
    id: "si",
    label: "simple icons",
    browse: "https://simpleicons.org",
    // simpleicons renders monochrome, so tint it to match the device colour
    url: (slug, color) =>
      `https://cdn.simpleicons.org/${slug}${color ? "/" + color.replace(/^#/, "") : ""}`,
  },
};

/** hosts the CSP must allow — keep nginx.conf in step with this list. */
export const ICON_HOSTS = [
  "https://cdn.jsdelivr.net",
  "https://cdn.simpleicons.org",
];

const REF = /^(sh|si):([a-z0-9][a-z0-9._-]*)$/i;

/** is this icon a library reference rather than a literal glyph? */
export function isRef(icon) {
  return typeof icon === "string" && REF.test(icon.trim());
}

/** "sh:jellyfin" -> { source: 'sh', slug: 'jellyfin' }, else null. */
export function parseRef(icon) {
  const m = REF.exec(String(icon ?? "").trim());
  if (!m) return null;
  return { source: m[1].toLowerCase(), slug: m[2].toLowerCase() };
}

export function formatRef(source, slug) {
  const s = String(slug ?? "")
    .trim()
    .toLowerCase()
    // tolerate a pasted URL or a Homepage-style "sh-foo" name
    .replace(/^https?:\/\/.*\//, "")
    .replace(/\.(svg|png|webp)$/, "")
    .replace(/^sh-/, "");
  if (!s) return "";
  return `${source}:${s}`;
}

/** CDN url for an icon reference, or null if it is a plain glyph. */
export function iconUrl(icon, color) {
  const ref = parseRef(icon);
  if (!ref) return null;
  return SOURCES[ref.source].url(ref.slug, color);
}

/**
 * Fetch every distinct icon in a layout and return ref -> data: URI.
 *
 * Export has to inline them: a standalone SVG that hotlinks a CDN stops
 * rendering the moment it is opened offline, and canvas refuses to rasterize
 * an SVG containing remote references at all. Both CDNs send
 * Access-Control-Allow-Origin: *, so this is allowed to work.
 *
 * A failed icon resolves to null and the caller falls back to the glyph —
 * one dead slug must not take the whole export down.
 */
export async function resolveIcons(items, fetchImpl = fetch) {
  const refs = [...new Set(items.map((i) => i.icon).filter(isRef))];
  const out = new Map();
  await Promise.all(
    refs.map(async (ref) => {
      const item = items.find((i) => i.icon === ref);
      try {
        const res = await fetchImpl(iconUrl(ref, item?.color));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const svg = await res.text();
        if (!/^\s*<svg/i.test(svg)) throw new Error("not an svg");
        out.set(
          ref,
          "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg),
        );
      } catch {
        out.set(ref, null);
      }
    }),
  );
  return out;
}

/**
 * One element for an icon, whatever kind it is — a tinted <img> for a library
 * reference, a <span> for a glyph.
 *
 * A CDN icon that fails to load (offline, dead slug, blocked) swaps itself for
 * the fallback glyph rather than leaving a broken-image gap in the rack.
 */
export function iconEl(icon, color, className = "g", fallback = "▪") {
  const url = iconUrl(icon, color);
  if (!url) {
    const span = document.createElement("span");
    span.className = className;
    span.textContent = icon || fallback;
    return span;
  }
  const img = document.createElement("img");
  img.className = className + " g--img";
  img.src = url;
  img.alt = "";
  // NOT loading="lazy": the panels re-render wholesale on every state change,
  // so a lazy image can be discarded mid-load and never come back. These are
  // ~2KB and above the fold; the HTTP cache makes the re-renders free anyway.
  img.decoding = "async";
  img.onerror = () => {
    const span = document.createElement("span");
    span.className = className;
    span.textContent = fallback;
    img.replaceWith(span);
  };
  return img;
}

/**
 * Curated autocomplete. Not an index — just the slugs that actually come up
 * when planning a homelab rack, so the common case needs no trip to the browser.
 *
 * Every entry is probed against the live CDN by `make check-icons`. Do not add
 * one by guessing the slug: simple-icons carries overrides a reimplemented
 * slugifier gets wrong, which is how six dead slugs got into the first draft.
 */
export const SUGGESTIONS = [
  // selfh.st — self-hosted software
  "sh:jellyfin",
  "sh:plex",
  "sh:emby",
  "sh:home-assistant",
  "sh:proxmox",
  "sh:truenas-scale",
  "sh:ubiquiti-unifi",
  "sh:pi-hole",
  "sh:adguard-home",
  "sh:portainer",
  "sh:nextcloud",
  "sh:immich",
  "sh:paperless-ngx",
  "sh:gitea",
  "sh:grafana",
  "sh:prometheus",
  "sh:uptime-kuma",
  "sh:sonarr",
  "sh:radarr",
  "sh:qbittorrent",
  "sh:opnsense",
  "sh:pfsense",
  "sh:openwrt",
  "sh:frigate",
  "sh:zigbee2mqtt",
  "sh:minio",
  "sh:vaultwarden",
  "sh:authentik",
  "sh:caddy",
  "sh:traefik",
  // simpleicons — hardware and platform brands
  "si:raspberrypi",
  "si:docker",
  "si:kubernetes",
  "si:synology",
  "si:qnap",
  "si:ubiquiti",
  "si:mikrotik",
  "si:tplink",
  "si:netgear",
  "si:intel",
  "si:amd",
  "si:nvidia",
  "si:asus",
  "si:supermicro",
  "si:dell",
  "si:hp",
  "si:lenovo",
  "sh:unraid",
  "si:seagate",
  "si:samsung",
  "si:schneiderelectric",
  "si:cisco",
  "sh:openmediavault",
  "si:linux",
  "si:proxmox",
];

/** glyphs for things no logo exists for — shelves, blanks, cable managers. */
export const GLYPHS = [
  "▦",
  "▤",
  "▨",
  "▣",
  "▭",
  "●",
  "◆",
  "■",
  "▪",
  "⇄",
  "⌁",
  "⚡",
  "✳",
  "≋",
  "◠◠",
  "⋮⋮",
  "─",
  "☰",
];
