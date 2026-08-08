// Validate every curated icon slug against the real CDNs.
//
// Deliberately NOT part of `make check`: it needs network, and a flaky gate is
// worse than no gate. Run it with `make check-icons` when touching SUGGESTIONS,
// or periodically — upstream slugs do get renamed.
//
// Ground truth is the CDN, not the index JSON. simple-icons carries slug
// overrides that a reimplemented slugifier gets wrong, which is exactly how
// four dead slugs shipped in the first draft of this list.

import { SUGGESTIONS, iconUrl } from "../js/icons.js";

const results = await Promise.all(
  SUGGESTIONS.map(async (ref) => {
    const url = iconUrl(ref, "#7D56F4");
    try {
      const res = await fetch(url, { method: "GET" });
      return { ref, url, ok: res.ok, status: res.status };
    } catch (err) {
      return { ref, url, ok: false, status: err.message };
    }
  }),
);

const bad = results.filter((r) => !r.ok);
for (const r of bad)
  console.error(`✗ ${r.ref.padEnd(24)} ${r.status}  ${r.url}`);

console.log(
  `${results.length - bad.length}/${results.length} curated icons resolve`,
);
if (bad.length) {
  console.error(`\n${bad.length} broken. Fix them in js/icons.js SUGGESTIONS.`);
  process.exit(1);
}
