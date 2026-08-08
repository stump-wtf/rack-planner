// model.js — physical constants, chassis sizes, and the device catalog.

/** 1U = 1.75in. the number everything else hangs off. */
export const U_MM = 44.45;
/** 10" rack front panel width. */
export const PANEL_MM = 254;
/** rail-to-rail mounting width inside a 10" rack. */
export const RAIL_MM = 230;

/**
 * chassis sizes. the rackmate t2 family is 260mm deep; the shallower t1
 * (~198mm) is offered as a depth preset rather than a separate chassis, since
 * the only thing that actually differs for planning is how deep a device can be.
 */
export const CHASSIS = [
  { id: "4u", label: "4u", u: 4, depthMm: 260 },
  { id: "8u", label: "8u", u: 8, depthMm: 260 },
  { id: "12u", label: "12u", u: 12, depthMm: 260 },
];

export const DEPTH_PRESETS = [
  { label: "t2 / t1 plus · 260mm", mm: 260 },
  { label: "t1 · 198mm", mm: 198 },
];

export function chassisById(id) {
  return CHASSIS.find((c) => c.id === id) ?? CHASSIS[1];
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

export const CATALOG = [...STOCK, ...PRINTS];

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
