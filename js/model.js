// model.js — physical constants, chassis sizes, and the device catalog.

/** 1U = 1.75in. the number everything else hangs off. */
export const U_MM = 44.45;

/**
 * Rack widths.
 *
 * The planner was 10"-only, and PANEL_MM / RAIL_MM were constants nothing ever
 * read — width was a label. It is a real dimension now: it selects the chassis
 * sizes, the depth presets and which catalog gear will physically fit. Height
 * is unaffected, since 1U is 44.45mm in every rack ever made.
 */
export const RACK_WIDTHS = [
  { id: "10", label: '10"', panelMm: 254, railMm: 230 },
  { id: "19", label: '19"', panelMm: 482.6, railMm: 450 },
];

export function widthById(id) {
  return RACK_WIDTHS.find((w) => w.id === id) ?? RACK_WIDTHS[0];
}

/**
 * How much wider a rack of this width draws than the 10" reference. Both the
 * on-screen elevation (ui-rack) and the svg export scale off this one ratio,
 * so the two renderings cannot drift apart on proportions.
 */
export function panelScale(widthId) {
  return widthById(widthId).panelMm / RACK_WIDTHS[0].panelMm;
}

/**
 * Chassis sizes, per width.
 *
 * The three 10" ids predate the 19" work and are load-bearing: they travel in
 * share links, so they can never be renamed. The 19" ids are namespaced for
 * the same reason — a bare "12u" already means the 10" one, forever.
 *
 * The 19" set is the shape of what homelabs actually run: two wall cabinets,
 * an open frame, a rolling half-height and the full-height floor rack. 42u is
 * the one people photograph; 12u wall is the one people own.
 */
export const CHASSIS = [
  { id: "4u", label: "4u", u: 4, width: "10", depthMm: 260 },
  { id: "8u", label: "8u", u: 8, width: "10", depthMm: 260 },
  { id: "12u", label: "12u", u: 12, width: "10", depthMm: 260 },

  { id: "19-6u", label: "6u", u: 6, width: "19", depthMm: 450, note: "wall" },
  {
    id: "19-12u",
    label: "12u",
    u: 12,
    width: "19",
    depthMm: 520,
    note: "wall",
  },
  {
    id: "19-18u",
    label: "18u",
    u: 18,
    width: "19",
    depthMm: 600,
    note: "open frame",
  },
  {
    id: "19-27u",
    label: "27u",
    u: 27,
    width: "19",
    depthMm: 800,
    note: "rolling",
  },
  {
    id: "19-42u",
    label: "42u",
    u: 42,
    width: "19",
    depthMm: 1000,
    note: "full height",
  },
];

/** the chassis a link falls back to when it names one we do not have. */
const DEFAULT_CHASSIS = "8u";

export function chassisById(id) {
  return (
    CHASSIS.find((c) => c.id === id) ??
    CHASSIS.find((c) => c.id === DEFAULT_CHASSIS)
  );
}

export function chassisFor(widthId) {
  return CHASSIS.filter((c) => c.width === widthId);
}

/**
 * Usable depth, per width. This is the dimension that actually bites: a 750mm
 * server does not go in a 450mm switch-depth wall cabinet, and that mismatch is
 * the mistake this planner exists to catch.
 */
const DEPTHS = {
  10: [
    { label: "t2 / t1 plus · 260mm", mm: 260 },
    { label: "t1 · 198mm", mm: 198 },
  ],
  19: [
    { label: "low-profile wall · 300mm", mm: 300 },
    { label: "switch-depth wall · 450mm", mm: 450 },
    { label: "deep wall · 520mm", mm: 520 },
    { label: "rolling · 600mm", mm: 600 },
    { label: "rolling deep · 800mm", mm: 800 },
    { label: "full-depth server · 1000mm", mm: 1000 },
  ],
};

export function depthPresetsFor(widthId) {
  return DEPTHS[widthId] ?? DEPTHS[10];
}

// palette lifted from the stump·wtf theme tokens so the elevation reads as
// part of the same family as everything else.
export const SWATCHES = [
  "#7D56F4", // charm purple
  "#FF5FA2", // charm pink
  "#4EE6FF", // neon cyan
  "#00F0A8", // neon mint
  "#FFC64B", // neon gold
  "#FF6E5E", // neon coral
  "#C8A2FF", // neon lilac
  "#5B5B84", // dim (blanks, shelves, filler)
];

/**
 * seed catalog. `u` may be 0.5. `width` is 'full' or 'half'. depth/watts are
 * best-effort typical values — every one of them is editable once placed.
 */
const STOCK = [
  // ── compute ──────────────────────────────────────────────────────────
  {
    id: "pi5",
    name: "raspberry pi 5",
    u: 1,
    width: "half",
    depthMm: 120,
    watts: 12,
    color: "#00F0A8",
    cat: "compute",
    icon: "si:raspberrypi",
  },
  {
    id: "pi-quad",
    name: "pi 4-bay mount",
    u: 2,
    width: "full",
    depthMm: 180,
    watts: 40,
    color: "#00F0A8",
    cat: "compute",
    icon: "si:raspberrypi",
  },
  {
    id: "sbc-shelf",
    name: "sbc shelf",
    u: 1,
    width: "full",
    depthMm: 200,
    watts: 0,
    color: "#5B5B84",
    cat: "compute",
    icon: "▤",
  },
  {
    id: "mini-pc",
    name: "mini pc",
    u: 2,
    width: "half",
    depthMm: 200,
    watts: 45,
    color: "#7D56F4",
    cat: "compute",
    icon: "●",
  },
  {
    id: "itx",
    name: "mini-itx shelf",
    u: 1,
    width: "full",
    depthMm: 240,
    watts: 90,
    color: "#7D56F4",
    cat: "compute",
    icon: "▤",
  },
  {
    id: "nas",
    name: "nas",
    u: 2,
    width: "full",
    depthMm: 250,
    watts: 60,
    color: "#C8A2FF",
    cat: "compute",
    icon: "▦",
  },

  // ── network ──────────────────────────────────────────────────────────
  {
    id: "switch8",
    name: "8-port switch",
    u: 1,
    width: "full",
    depthMm: 130,
    watts: 10,
    color: "#4EE6FF",
    cat: "network",
    icon: "⇄",
  },
  {
    id: "switch16",
    name: "16-port switch",
    u: 1,
    width: "full",
    depthMm: 180,
    watts: 18,
    color: "#4EE6FF",
    cat: "network",
    icon: "⇄",
  },
  {
    id: "patch12",
    name: "12-port patch panel",
    u: 0.5,
    width: "full",
    depthMm: 60,
    watts: 0,
    color: "#4EE6FF",
    cat: "network",
    icon: "⋮⋮",
  },
  {
    id: "router",
    name: "router / firewall",
    u: 1,
    width: "half",
    depthMm: 160,
    watts: 15,
    color: "#4EE6FF",
    cat: "network",
    icon: "⌁",
  },

  // ── power ────────────────────────────────────────────────────────────
  {
    id: "pdu-dc",
    name: "dc pdu lite 7-ch",
    u: 0.5,
    width: "full",
    depthMm: 90,
    watts: 0,
    color: "#FFC64B",
    cat: "power",
    icon: "⚡",
  },
  {
    id: "pdu-ac",
    name: "ac pdu",
    u: 1,
    width: "full",
    depthMm: 120,
    watts: 0,
    color: "#FFC64B",
    cat: "power",
    icon: "⚡",
  },
  {
    id: "ups",
    name: "ups",
    u: 2,
    width: "full",
    depthMm: 250,
    watts: 0,
    color: "#FFC64B",
    cat: "power",
    icon: "▣",
  },

  // ── passive ──────────────────────────────────────────────────────────
  {
    id: "blank1",
    name: "blank panel",
    u: 1,
    width: "full",
    depthMm: 10,
    watts: 0,
    color: "#5B5B84",
    cat: "passive",
    icon: "─",
  },
  {
    id: "blank-half",
    name: "blank panel ½u",
    u: 0.5,
    width: "full",
    depthMm: 10,
    watts: 0,
    color: "#5B5B84",
    cat: "passive",
    icon: "─",
  },
  {
    id: "shelf1",
    name: "rack shelf",
    u: 1,
    width: "full",
    depthMm: 200,
    watts: 0,
    color: "#5B5B84",
    cat: "passive",
    icon: "▤",
  },
  {
    id: "shelf-vent",
    name: "vented shelf ½u",
    u: 0.5,
    width: "full",
    depthMm: 180,
    watts: 0,
    color: "#5B5B84",
    cat: "passive",
    icon: "▨",
  },
  {
    id: "brush",
    name: "brush cable manager",
    u: 0.5,
    width: "full",
    depthMm: 40,
    watts: 0,
    color: "#5B5B84",
    cat: "passive",
    icon: "≋",
  },
  {
    id: "dring",
    name: "d-ring manager",
    u: 0.5,
    width: "full",
    depthMm: 60,
    watts: 0,
    color: "#5B5B84",
    cat: "passive",
    icon: "◠◠",
  },
  {
    id: "drawer",
    name: "lockable drawer",
    u: 2,
    width: "full",
    depthMm: 240,
    watts: 0,
    color: "#5B5B84",
    cat: "passive",
    icon: "▭",
  },
  {
    id: "fan",
    name: "fan panel",
    u: 1,
    width: "full",
    depthMm: 60,
    watts: 5,
    color: "#FF6E5E",
    cat: "passive",
    icon: "✳",
  },
];

// ── 3d-printable parts ─────────────────────────────────────────────────────
//
// Joe's two MakerWorld collections. These are things you print rather than buy,
// so they are kept visually distinct in the palette and carry their maker.
//
// MakerWorld blocks automated fetching (403), so this table was transcribed
// from the collection exports by hand. Where a model's title does not state its
// height, `uExact: false` marks the value as an estimate — the palette shows
// those with a ≈ so nobody plans a build around a number we guessed.

export const COLLECTIONS = [
  {
    id: "mini-racks",
    label: '10" mini racks',
    url: "https://makerworld.com/en/collections/25694095-10-mini-racks",
  },
  {
    id: "storage-rack",
    label: "storage rack",
    url: "https://makerworld.com/en/collections/20342610-storage-rack",
  },
];

export function collectionById(id) {
  return COLLECTIONS.find((c) => c.id === id) ?? null;
}

/** a printed part's kind drives its icon and colour, same as the stock catalog. */
const KINDS = {
  compute: { icon: "●", color: "#7D56F4" },
  network: { icon: "⇄", color: "#4EE6FF" },
  power: { icon: "⚡", color: "#FFC64B" },
  storage: { icon: "▦", color: "#C8A2FF" },
  passive: { icon: "▤", color: "#5B5B84" },
};

// id · name · u · width · kind · maker · collection · depthMm · watts · uExact
// prettier-ignore
const PRINT_ROWS = [
  // 10" mini racks
  ['mw-usw-lite-8',   'unifi usw-lite-8 mount',        1,   'full', 'network', 'Nautilus Forge', 'mini-racks',   130, 0],
  ['mw-keystone',     'keystone patch panel bonanza',  1,   'full', 'network', 'Nautilus Forge', 'mini-racks',    60, 0],
  ['mw-vent-blank',   'customizable vent/blank panel', 1,   'full', 'passive', 'Kiwiworks',      'mini-racks',    20, 0],
  ['mw-itx-1u',       'mini-itx case 1u',              1,   'full', 'compute', 'Servben',        'mini-racks',   240, 90],
  ['mw-flexatx-1u',   'flex atx psu panel',            1,   'full', 'power',   'RiHi36',         'mini-racks',   160, 0],
  ['mw-airflow',      'airflow panel 1u/2u/3u',        1,   'full', 'passive', 'RiHi36',         'mini-racks',    20, 0],

  // storage rack
  ['mw-itx-tray-2u',  'mini-itx pc rack tray',         2,   'full', 'compute', 'hybridcraftsman','storage-rack', 240, 90],
  ['mw-itx-dualgpu',  'mini-itx dual-gpu rackmount',   3,   'full', 'compute', 'RiHi36',         'storage-rack', 250, 300],
  ['mw-itx-pcie-2u',  'mini-itx panel with pcie',      2,   'full', 'compute', 'mr4lexndr',      'storage-rack', 250, 120],
  ['mw-itx-sffgpu',   'mini-itx case, psu + sff gpu',  3,   'full', 'compute', 'heliocentrique', 'storage-rack', 250, 250, false],
  ['mw-4x525-tfx',    '4x 5.25 bay + tfx psu bracket', 3,   'full', 'storage', 'slodriver',      'storage-rack', 250, 0],
  ['mw-itx-nas-4x35', 'itx nas, 4x 3.5" hdd',          3,   'full', 'storage', 'Rouloy',         'storage-rack', 250, 100],
  ['mw-525-offset',   '5.25 offset bay (lab rax)',     1,   'full', 'storage', 'sleyshaw24',     'storage-rack', 200, 0],
  ['mw-dual-525',     'dual 5.25 bay rackmount',       2,   'full', 'storage', 'slodriver',      'storage-rack', 220, 0, false],
  ['mw-2hu-525',      '2u mount, two 5.25 drives',     2,   'full', 'storage', 'bastian123f',    'storage-rack', 220, 0],
  ['mw-1hu-525',      '1u mount, one 5.25 drive',      1,   'full', 'storage', 'bastian123f',    'storage-rack', 220, 0],
  ['mw-pc-lpgpu',     'pc case, itx + lp gpu + psu',   3,   'full', 'compute', 'foreverfuture',  'storage-rack', 250, 250, false],
  ['mw-seer-k1',      'seer-k1 8-disk 2.5" cage',      2,   'full', 'storage', '先知de迷',        'storage-rack', 220, 40, false],
  ['mw-itx-keystone', 'mini-itx case with keystones',  2,   'full', 'compute', 'SATOS',          'storage-rack', 250, 90],
  ['mw-atx-psu',      'atx psu panel (+2 ssd)',        2,   'full', 'power',   'RiHi36',         'storage-rack', 180, 0, false],
  ['mw-nas-7bay',     'seven bay nas shelf',           3,   'full', 'storage', 'RagingRoosevelt','storage-rack', 250, 105],
  ['mw-itx-nas-2x25', 'itx nas, 2x 2.5" hdd',          2,   'full', 'storage', 'Rouloy',         'storage-rack', 240, 60],
  ['mw-hotswap-4x25', 'hot-swap 4x 2.5" hdd/ssd',      1,   'full', 'storage', 'Nautilus Forge', 'storage-rack', 200, 20],
  ['mw-hotswap-6x35', 'hot-swap 6x 3.5" hdd',          2,   'full', 'storage', 'Nautilus Forge', 'storage-rack', 250, 60],
  ['mw-dual-flexatx', 'dual flex atx panel',           1,   'full', 'power',   'RiHi36',         'storage-rack', 160, 0],
];

// a handful of prints are for one specific, identifiable box
const PRINT_ICONS = { "mw-usw-lite-8": "sh:ubiquiti-unifi" };

export const PRINTS = PRINT_ROWS.map(
  ([
    id,
    name,
    u,
    width,
    kind,
    maker,
    collection,
    depthMm,
    watts,
    uExact = true,
  ]) => ({
    id,
    name,
    u,
    width,
    depthMm,
    watts,
    cat: "printed",
    kind,
    maker,
    collection,
    uExact,
    printed: true,
    ...KINDS[kind],
    ...(PRINT_ICONS[id] ? { icon: PRINT_ICONS[id] } : {}),
  }),
);

// ── 19" gear ───────────────────────────────────────────────────────────────
//
// A starter set, not a pretence at a full catalog: the things that actually go
// in a homelab rack, at depths that make the too-deep warning mean something.
// Full-width by default — at 19" a half-width bay is a real 9.5", which most of
// this gear is not.
//
// prettier-ignore
const STOCK_19_ROWS = [
  // id · name · u · width · depthMm · watts · color · cat · icon
  ['r-1u-server',   '1u server',            1,   'full', 750, 200, '#7D56F4', 'compute', '▭'],
  ['r-2u-server',   '2u server',            2,   'full', 750, 350, '#7D56F4', 'compute', '▭'],
  ['r-4u-server',   '4u server / storage',  4,   'full', 700, 400, '#C8A2FF', 'compute', '▦'],
  ['r-nas-4bay',    '4-bay nas',            2,   'full', 550,  60, '#C8A2FF', 'compute', '▦'],
  ['r-disk-shelf',  '12-bay disk shelf',    2,   'full', 600, 200, '#C8A2FF', 'compute', '▦'],
  ['r-mini-shelf',  '1u shelf for minis',   1,   'full', 400,  90, '#7D56F4', 'compute', '▤'],

  ['r-switch-24',   '24-port switch',       1,   'full', 300,  40, '#4EE6FF', 'network', '⇄'],
  ['r-switch-48',   '48-port switch',       1,   'full', 400,  80, '#4EE6FF', 'network', '⇄'],
  ['r-switch-poe',  '24-port poe switch',   1,   'full', 400, 250, '#4EE6FF', 'network', '⇄'],
  ['r-patch-24',    '24-port patch panel',  1,   'full',  80,   0, '#4EE6FF', 'network', '⋮⋮'],
  ['r-patch-48',    '48-port patch panel',  2,   'full',  80,   0, '#4EE6FF', 'network', '⋮⋮'],
  ['r-firewall',    'rackmount firewall',   1,   'full', 400,  35, '#4EE6FF', 'network', '⌁'],

  ['r-ups-1500',    'ups 1500va',           2,   'full', 600,   0, '#FFC64B', 'power',   '▣'],
  ['r-ups-3000',    'ups 3000va',           3,   'full', 700,   0, '#FFC64B', 'power',   '▣'],
  ['r-pdu',         'rackmount pdu',        1,   'full', 100,   0, '#FFC64B', 'power',   '⚡'],
  ['r-pdu-vert',    'vertical pdu (0u)',    1,   'full',  60,   0, '#FFC64B', 'power',   '⚡'],

  ['r-blank-1u',    'blank panel',          1,   'full',  10,   0, '#5B5B84', 'passive', '─'],
  ['r-blank-2u',    'blank panel 2u',       2,   'full',  10,   0, '#5B5B84', 'passive', '─'],
  ['r-shelf',       'rack shelf',           1,   'full', 450,   0, '#5B5B84', 'passive', '▤'],
  ['r-shelf-deep',  'deep rack shelf',      2,   'full', 700,   0, '#5B5B84', 'passive', '▤'],
  ['r-fan-panel',   'fan panel',            1,   'full', 120,  15, '#FF6E5E', 'passive', '✳'],
  ['r-cable-1u',    'cable manager',        1,   'full',  80,   0, '#5B5B84', 'passive', '≋'],
];

const STOCK_19 = STOCK_19_ROWS.map(
  ([id, name, u, width, depthMm, watts, color, cat, icon]) => ({
    id,
    name,
    u,
    width,
    depthMm,
    watts,
    color,
    cat,
    icon,
  }),
);

/**
 * Every entry carries the rack width it fits. Without it the 19" chassis would
 * have shipped a palette of 10" printed pi mounts, which is a rack you cannot
 * build.
 */
export const CATALOG = [
  ...STOCK.map((d) => ({ ...d, fits: "10" })),
  ...PRINTS.map((d) => ({ ...d, fits: "10" })),
  ...STOCK_19.map((d) => ({ ...d, fits: "19" })),
];

export function catalogFor(widthId) {
  return CATALOG.filter((d) => d.fits === widthId);
}

export const CATEGORIES = [
  { id: "compute", label: "compute" },
  { id: "network", label: "network" },
  { id: "power", label: "power" },
  { id: "passive", label: "passive" },
  { id: "printed", label: "3d prints" },
];

export function catalogById(id) {
  return CATALOG.find((d) => d.id === id) ?? null;
}

/** mm of front panel a device occupies, for the depth/height readouts. */
export function heightMm(u) {
  return +(u * U_MM).toFixed(2);
}

/**
 * The whole-rack power picture, from items and a budget.
 *
 * One place decides the thresholds so the inspector meter, the gauge beside the
 * rack and the exported svg cannot disagree about what counts as "getting
 * close". `level` is "" while there is headroom, and "is-idle" means no budget
 * is set — nothing to measure against, so the gauge stays quiet.
 */
export function powerOf(items, budget) {
  const watts = items.reduce((n, i) => n + (Number(i.watts) || 0), 0);
  const budgetW = Math.max(0, Number(budget) || 0);
  const overBudget = budgetW > 0 && watts > budgetW;
  const pct = budgetW > 0 ? (watts / budgetW) * 100 : 0;
  return {
    watts,
    budgetW,
    overBudget,
    pct,
    level: !budgetW
      ? "is-idle"
      : overBudget
        ? "is-bad"
        : pct > 80
          ? "is-warn"
          : "",
  };
}
