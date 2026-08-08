import test from "node:test";
import assert from "node:assert/strict";

import {
  SOURCES,
  ICON_HOSTS,
  SUGGESTIONS,
  GLYPHS,
  isRef,
  parseRef,
  formatRef,
  iconUrl,
  resolveIcons,
} from "../js/icons.js";

test("library references are recognised, glyphs are not", () => {
  assert.equal(isRef("sh:jellyfin"), true);
  assert.equal(isRef("si:docker"), true);
  assert.equal(isRef("SH:Jellyfin"), true, "case-insensitive");
  assert.equal(isRef("▦"), false);
  assert.equal(isRef(""), false);
  assert.equal(isRef(undefined), false);
  assert.equal(isRef("mdi:server"), false, "only the two supported libraries");
  assert.equal(isRef("sh:"), false, "a source with no slug is not a reference");
});

test("references parse to a source and slug", () => {
  assert.deepEqual(parseRef("sh:jellyfin"), { source: "sh", slug: "jellyfin" });
  assert.deepEqual(parseRef("  SI:Docker  "), { source: "si", slug: "docker" });
  assert.equal(parseRef("▦"), null);
});

test("formatRef tolerates the ways people actually supply a slug", () => {
  assert.equal(formatRef("sh", "jellyfin"), "sh:jellyfin");
  assert.equal(formatRef("sh", "  Jellyfin "), "sh:jellyfin");
  // a pasted CDN url
  assert.equal(
    formatRef(
      "sh",
      "https://cdn.jsdelivr.net/gh/selfhst/icons/svg/proxmox.svg",
    ),
    "sh:proxmox",
  );
  // a Homepage-style name, as used in dub.yaml
  assert.equal(formatRef("sh", "sh-bentopdf"), "sh:bentopdf");
  assert.equal(formatRef("si", "docker.svg"), "si:docker");
  // empty means "no logo"
  assert.equal(formatRef("sh", ""), "");
  assert.equal(formatRef("sh", "   "), "");
});

test("urls point at the documented CDNs", () => {
  assert.equal(
    iconUrl("sh:jellyfin"),
    "https://cdn.jsdelivr.net/gh/selfhst/icons/svg/jellyfin.svg",
  );
  assert.equal(iconUrl("si:docker"), "https://cdn.simpleicons.org/docker");
  assert.equal(iconUrl("▦"), null, "a glyph has no url");
});

test("simple icons are tinted to the device colour", () => {
  assert.equal(
    iconUrl("si:docker", "#4EE6FF"),
    "https://cdn.simpleicons.org/docker/4EE6FF",
  );
  // selfh.st marks are already full-colour, so the tint is not applied
  assert.equal(
    iconUrl("sh:jellyfin", "#4EE6FF"),
    "https://cdn.jsdelivr.net/gh/selfhst/icons/svg/jellyfin.svg",
  );
});

test("every url stays on a host the CSP allows", () => {
  for (const ref of SUGGESTIONS) {
    const url = iconUrl(ref, "#7D56F4");
    assert.ok(url, `${ref} produced no url`);
    assert.ok(
      ICON_HOSTS.some((h) => url.startsWith(h)),
      `${ref} -> ${url} is not on an allowed host`,
    );
  }
});

test("the curated suggestions are well-formed and cover both libraries", () => {
  assert.ok(SUGGESTIONS.length >= 40);
  assert.equal(new Set(SUGGESTIONS).size, SUGGESTIONS.length, "no duplicates");
  for (const ref of SUGGESTIONS) {
    assert.ok(isRef(ref), `${ref} is not a valid reference`);
    assert.equal(
      formatRef(...Object.values(parseRef(ref))),
      ref,
      `${ref} does not round-trip`,
    );
  }
  assert.ok(SUGGESTIONS.some((r) => r.startsWith("sh:")));
  assert.ok(SUGGESTIONS.some((r) => r.startsWith("si:")));
});

test("every source declares a browse link on an https host", () => {
  for (const s of Object.values(SOURCES)) {
    assert.match(s.browse, /^https:\/\//);
    assert.ok(s.label && s.id);
  }
  assert.ok(GLYPHS.length > 0);
});

test("resolveIcons inlines each distinct reference exactly once", async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    return {
      ok: true,
      text: async () => '<svg xmlns="http://www.w3.org/2000/svg"/>',
    };
  };
  const items = [
    { icon: "sh:jellyfin", color: "#fff" },
    { icon: "sh:jellyfin", color: "#fff" }, // duplicate: must not refetch
    { icon: "si:docker", color: "#4EE6FF" },
    { icon: "▦", color: "#fff" }, // glyph: never fetched
  ];
  const got = await resolveIcons(items, fakeFetch);
  assert.equal(calls.length, 2, "one fetch per distinct reference");
  assert.equal(got.size, 2);
  assert.match(got.get("sh:jellyfin"), /^data:image\/svg\+xml;charset=utf-8,/);
  assert.equal(got.has("▦"), false);
});

test("a dead icon degrades to null instead of failing the export", async () => {
  const fakeFetch = async (url) => {
    if (url.includes("nope")) return { ok: false, status: 404 };
    return { ok: true, text: async () => "<svg/>" };
  };
  const got = await resolveIcons(
    [
      { icon: "sh:nope", color: "#fff" },
      { icon: "si:docker", color: "#fff" },
    ],
    fakeFetch,
  );
  assert.equal(got.get("sh:nope"), null);
  assert.ok(got.get("si:docker"), "the healthy icon still resolves");
});

test("a non-svg response is rejected rather than inlined", async () => {
  const fakeFetch = async () => ({
    ok: true,
    text: async () => "<html>login</html>",
  });
  const got = await resolveIcons(
    [{ icon: "sh:jellyfin", color: "#fff" }],
    fakeFetch,
  );
  assert.equal(got.get("sh:jellyfin"), null);
});

test("a fetch that throws does not reject the whole resolve", async () => {
  const fakeFetch = async () => {
    throw new Error("offline");
  };
  const got = await resolveIcons(
    [{ icon: "sh:jellyfin", color: "#fff" }],
    fakeFetch,
  );
  assert.equal(got.get("sh:jellyfin"), null);
});
