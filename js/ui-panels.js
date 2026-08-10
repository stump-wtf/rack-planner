// ui-panels.js — the catalog on the left, the inspector on the right.
// both are full re-renders on every state change; the dom here is small enough
// that diffing would be more code than it saves.

import {
  CATEGORIES,
  COLLECTIONS,
  SWATCHES,
  catalogFor,
  chassisById,
  collectionById,
  depthPresetsFor,
  widthById,
} from "./model.js";
import { uLabelFor } from "./grid.js";
import { state, commit, derived, endEditRun } from "./state.js";
import { beginNewDrag, addFromCatalog } from "./ui-rack.js";
import { fmtU } from "./export.js";
import {
  iconEl,
  SOURCES,
  SUGGESTIONS,
  GLYPHS,
  parseRef,
  formatRef,
} from "./icons.js";

let paletteEl;
let inspectorEl;
let toast;

export function initPanels(elements) {
  paletteEl = elements.paletteEl;
  inspectorEl = elements.inspectorEl;
  toast = elements.toast;

  // leaving a field ends its undo run. the container outlives every re-render,
  // and focusout bubbles, so this survives the inspector being rebuilt — but a
  // focusout caused BY that rebuild is not the user leaving, so ignore it.
  inspectorEl.addEventListener("focusout", () => {
    if (!building) endEditRun();
  });
}

export function el(tag, props = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (k === "style") Object.assign(n.style, v);
    else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v);
  }
  n.append(...[].concat(children).filter(Boolean));
  return n;
}

// ── palette ────────────────────────────────────────────────────────────────

let chipsEl;
let query = "";

/** the width the chips currently show, so we only rebuild when it changes */
let paletteWidth = null;

/**
 * The palette is built once at boot, but its contents depend on the rack you
 * are on. Called from the render loop; rebuilds only when the width actually
 * changed, since a drag commits on every pointer move and 46 chips is not free.
 */
export function syncPalette() {
  const width = chassisById(state.chassisId).width;
  if (width === paletteWidth) return;
  paletteWidth = width;
  if (chipsEl) renderChips();
}

/** name, maker and collection are all searchable — the catalog needs a filter. */
export function matches(def, q) {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    def.name,
    def.maker,
    def.cat,
    collectionById(def.collection)?.label,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return needle.split(/\s+/).every((word) => hay.includes(word));
}

export function renderPalette() {
  // the search box is built once and never replaced, so typing in it cannot
  // lose focus when the results below re-render
  const search = el("input", {
    type: "text",
    placeholder: "search gear…",
    "aria-label": "search the catalog",
    oninput: (ev) => {
      query = ev.target.value;
      renderChips();
    },
  });
  chipsEl = el("div", {});
  paletteEl.replaceChildren(search, chipsEl);
  paletteWidth = chassisById(state.chassisId).width;
  renderChips();
}

function renderChips() {
  const kids = [];
  let shown = 0;

  // only gear that fits the rack you are on — a 19" rack full of 10" printed
  // pi mounts is not a rack you can build
  const fitting = catalogFor(chassisById(state.chassisId).width);

  for (const cat of CATEGORIES) {
    const inCat = fitting.filter((d) => d.cat === cat.id && matches(d, query));
    if (!inCat.length) continue;
    shown += inCat.length;
    kids.push(el("div", { class: "section-title", text: `❯ ${cat.label}` }));

    if (cat.id !== "printed") {
      kids.push(...inCat.map(chip));
      continue;
    }
    // printed parts are grouped by the makerworld collection they came from,
    // with the collection itself linked so you can go and print the thing
    for (const coll of COLLECTIONS) {
      const inColl = inCat.filter((d) => d.collection === coll.id);
      if (!inColl.length) continue;
      kids.push(
        el("a", {
          class: "coll-link",
          href: coll.url,
          target: "_blank",
          rel: "noopener noreferrer",
          text: `${coll.label} ↗`,
        }),
      );
      kids.push(...inColl.map(chip));
    }
  }

  if (!shown) {
    kids.push(
      el("div", { class: "empty", text: `nothing matches “${query}”` }),
    );
  }

  kids.push(el("div", { class: "section-title", text: "❯ custom" }));
  kids.push(customForm());
  chipsEl.replaceChildren(...kids);
}

function chip(def) {
  // "≈" marks a height we inferred rather than read off the model's title
  const uText = `${def.uExact === false ? "≈" : ""}${fmtU(def.u)}u${def.width === "half" ? "½" : ""}`;
  const bits = [
    def.name,
    `${fmtU(def.u)}u ${def.width}-width${def.uExact === false ? " (estimated)" : ""}`,
    def.depthMm ? `${def.depthMm}mm deep` : null,
    def.watts ? `${def.watts}w` : null,
    def.maker ? `printed · by ${def.maker}` : null,
  ].filter(Boolean);

  const c = el(
    "button",
    {
      class: `chip${def.printed ? " chip--printed" : ""}`,
      type: "button",
      title: bits.join(" · "),
      onpointerdown: (ev) => {
        ev.preventDefault();
        beginNewDrag(def, ev);
      },
    },
    [
      iconEl(def.icon, def.color, "g"),
      el("span", { class: "n", text: def.name }),
      el("span", { class: "u", text: uText }),
    ],
  );
  c.style.setProperty("--chip", def.color);
  return c;
}

function customForm() {
  const name = el("input", { type: "text", placeholder: "thing", value: "" });
  const u = el(
    "select",
    {},
    ["0.5", "1", "1.5", "2", "3", "4"].map((v) =>
      el("option", {
        value: v,
        text: `${v}u`,
        selected: v === "1" ? "" : null,
      }),
    ),
  );
  const width = el("select", {}, [
    el("option", { value: "full", text: "full width" }),
    el("option", { value: "half", text: "half width" }),
  ]);
  const depth = el("input", {
    type: "number",
    min: "0",
    step: "5",
    value: "150",
  });
  const watts = el("input", {
    type: "number",
    min: "0",
    step: "1",
    value: "0",
  });

  let color = SWATCHES[0];
  const swatchRow = el(
    "div",
    { class: "swatches" },
    SWATCHES.map((s) =>
      el("button", {
        class: "swatch",
        type: "button",
        "aria-pressed": s === color ? "true" : "false",
        style: { background: s },
        title: s,
        onclick: (ev) => {
          color = s;
          for (const b of swatchRow.children)
            b.setAttribute("aria-pressed", "false");
          ev.currentTarget.setAttribute("aria-pressed", "true");
        },
      }),
    ),
  );

  const add = el("button", {
    class: "btn btn--go",
    type: "button",
    text: "+ add to rack",
    style: { width: "100%", marginTop: "10px" },
    onclick: () => {
      const def = {
        id: "custom",
        name: (name.value || "thing").toLowerCase(),
        u: Number(u.value),
        width: width.value,
        depthMm: Number(depth.value) || 0,
        watts: Number(watts.value) || 0,
        color,
        icon: "▪",
        cat: "custom",
      };
      if (!addFromCatalog(def)) say("no room left for that");
      else name.value = "";
    },
  });

  return el("div", {}, [
    el("label", { text: "name" }),
    name,
    el("div", { class: "row2" }, [
      el("div", {}, [el("label", { text: "height" }), u]),
      el("div", {}, [el("label", { text: "width" }), width]),
    ]),
    el("div", { class: "row2" }, [
      el("div", {}, [el("label", { text: "depth mm" }), depth]),
      el("div", {}, [el("label", { text: "draw (w)" }), watts]),
    ]),
    el("label", { text: "colour" }),
    swatchRow,
    add,
  ]);
}

// ── inspector ──────────────────────────────────────────────────────────────

/**
 * A number box that writes through on every keystroke.
 *
 * `change` alone is not enough: it fires on blur, so typing a value and hitting
 * enter — or just typing it and looking at the rack — left the box showing your
 * number while the state kept the old one. Committing on `input` fixes that,
 * at the price of re-rendering the inspector mid-word; `field` is what
 * renderInspector uses to put the caret back, and `coalesce` keeps the whole
 * run to a single undo entry.
 *
 * It is `type="text"` with a numeric inputmode, NOT `type="number"`, and that
 * is the whole reason typing works. The spec refuses selectionStart/
 * setSelectionRange on a number input — reading returns null, writing throws
 * InvalidStateError — so renderKeepingFocus below could not put the caret
 * back after its per-keystroke re-render. The caret landed at 0 instead and
 * every digit went in front of the last: typing 1, 2, 0, 0 into the budget
 * produced 0021. inputmode keeps the numeric keypad on touch, and the
 * keydown handler keeps ArrowUp/ArrowDown stepping, which is what the
 * spinners were actually for.
 */
function numberField(field, value, apply, { step = 1, ...attrs } = {}) {
  // `step` is consumed here rather than passed through: on a text input the
  // attribute does nothing, and the arrow keys are the only thing left that
  // needs to know the budget nudges by 10 and a draw by 1.
  const by = Math.max(1, Number(step) || 1);
  const nudge = (node, dir) => {
    const next = Math.max(0, (Number(node.value) || 0) + dir * by);
    node.value = String(next);
    apply(next);
  };
  return el("input", {
    type: "text",
    inputmode: "numeric",
    autocomplete: "off",
    "data-field": field,
    ...attrs,
    value: String(value),
    oninput: (ev) => apply(Math.max(0, Number(ev.target.value) || 0)),
    onkeydown: (ev) => {
      if (ev.key !== "ArrowUp" && ev.key !== "ArrowDown") return;
      ev.preventDefault();
      nudge(ev.target, ev.key === "ArrowUp" ? 1 : -1);
    },
  });
}

/**
 * The inspector is a full re-render, so a field that commits per keystroke gets
 * torn out from under the caret. Remember which field had focus, what raw text
 * was in it and where the caret sat, then restore all three on the fresh node.
 *
 * The raw text matters: state holds a parsed number, so an emptied box would
 * come back as "0" and the next digit would land after it.
 */
function renderKeepingFocus(container, kids) {
  const prev = document.activeElement;
  const field = container.contains(prev) ? prev.dataset.field : null;
  const text = field ? prev.value : null;
  // Guarded because not every input exposes a selection — a number input
  // returns null and throws on write, which is exactly why numberField above
  // does not use one. A null caret here means the restore below silently does
  // nothing and the caret snaps to 0, so this staying quiet is a real hazard.
  let caret = null;
  try {
    if (field && prev.selectionStart != null)
      caret = [prev.selectionStart, prev.selectionEnd];
  } catch {
    caret = null;
  }

  container.replaceChildren(...kids);

  if (!field) return;
  const next = container.querySelector(`[data-field="${field}"]`);
  if (!next) return;
  next.value = text;
  next.focus();
  try {
    if (caret) next.setSelectionRange(caret[0], caret[1]);
  } catch {
    /* number input — nothing to restore */
  }
}

/**
 * Removing a dirty input fires its `change`, whose handler commits and calls us
 * again — from inside our own replaceChildren, which then throws because the
 * children moved underneath it. Collapse the nested call into a re-run once the
 * outer one has finished, capped so a handler that always dirties something
 * cannot spin.
 */
let building = false;
let buildAgain = false;

export function renderInspector() {
  if (building) {
    buildAgain = true;
    return;
  }
  building = true;
  try {
    for (let pass = 0; pass < 3; pass++) {
      buildAgain = false;
      buildInspector();
      if (!buildAgain) break;
    }
  } finally {
    building = false;
  }
}

function buildInspector() {
  const d = derived();
  const chassis = chassisById(state.chassisId);
  const sel = state.items.find((i) => i.id === state.selectedId);
  const kids = [];

  kids.push(el("div", { class: "section-title", text: "❯ rack" }));
  kids.push(stat("size", `${chassis.u}u · ${widthById(chassis.width).label}`));
  kids.push(stat("used", `${fmtNum(d.usedU)}u of ${chassis.u}u`));
  kids.push(
    stat("free", `${fmtNum(d.freeU)}u`, d.freeU === 0 ? "is-warn" : ""),
  );
  kids.push(stat("devices", String(state.items.length)));

  kids.push(el("label", { text: "usable depth (mm)" }));
  const depthSel = el(
    "select",
    {
      onchange: (ev) => commit((s) => (s.depthMm = Number(ev.target.value))),
    },
    depthPresetsFor(chassisById(state.chassisId).width).map((p) =>
      el("option", {
        value: String(p.mm),
        text: p.label,
        selected: p.mm === state.depthMm ? "" : null,
      }),
    ),
  );
  kids.push(depthSel);

  // power — one budget for the whole rack, measured against every device's draw
  kids.push(el("label", { text: "power budget — whole rack (w)" }));
  kids.push(
    numberField(
      "budget",
      d.budgetW,
      (v) => commit((s) => (s.budgetW = v), { coalesce: "budget" }),
      { step: "10" },
    ),
  );
  kids.push(
    el("div", { class: `meter ${d.powerLevel}` }, [
      el("i", { style: { width: `${Math.min(100, d.pct)}%` } }),
    ]),
  );
  kids.push(
    stat(
      "total draw",
      `${d.watts}w${d.budgetW ? ` / ${d.budgetW}w` : ""}`,
      d.powerLevel,
    ),
  );
  if (d.budgetW) {
    kids.push(
      stat(
        "headroom",
        `${d.headroomW}w`,
        d.headroomW < 0 ? "is-bad" : d.powerLevel,
      ),
    );
  }
  kids.push(
    el("div", {
      class: "hint",
      text: d.budgetW
        ? `sum of all ${state.items.length} device${state.items.length === 1 ? "" : "s"}. set a device's draw under ❯ selected.`
        : "set a budget to size the gauge beside the rack.",
    }),
  );

  if (d.overBudget) {
    kids.push(
      el("div", {
        class: "alert",
        text: `⚠ over budget by ${d.watts - d.budgetW}w`,
      }),
    );
  }
  if (d.tooDeep.length) {
    kids.push(
      el("div", {
        class: "alert is-warn",
        text: `⚠ too deep for ${state.depthMm}mm: ${d.tooDeep.map((i) => i.name).join(", ")}`,
      }),
    );
  }
  if (d.conflicts.size) {
    kids.push(
      el("div", {
        class: "alert",
        text: `✗ ${d.conflicts.size} devices overlap`,
      }),
    );
  }

  // selection
  kids.push(el("div", { class: "section-title", text: "❯ selected" }));
  if (!sel) {
    kids.push(
      el("div", {
        class: "empty",
        text: "nothing selected. click a device in the rack.",
      }),
    );
  } else {
    kids.push(...selectionFields(sel));
  }

  renderKeepingFocus(inspectorEl, kids);
}

function selectionFields(sel) {
  const patch = (fn, coalesce) =>
    commit(
      (s) => {
        const it = s.items.find((i) => i.id === sel.id);
        if (it) fn(it);
      },
      { coalesce },
    );

  const fields = [
    el("label", { text: "name" }),
    el("input", {
      type: "text",
      "data-field": "name",
      value: sel.name,
      oninput: (ev) =>
        patch(
          (it) => (it.name = ev.target.value.toLowerCase()),
          `name:${sel.id}`,
        ),
    }),
    el("div", { class: "row2" }, [
      el("div", {}, [
        el("label", { text: "depth mm" }),
        numberField(
          "depth",
          sel.depthMm || 0,
          (v) => patch((it) => (it.depthMm = v), `depth:${sel.id}`),
          { step: "5" },
        ),
      ]),
      el("div", {}, [
        el("label", { text: "draw (w)" }),
        numberField("watts", sel.watts || 0, (v) =>
          patch((it) => (it.watts = v), `watts:${sel.id}`),
        ),
      ]),
    ]),
    el("label", { text: "icon" }),
    iconPicker(sel, patch),
    el("label", { text: "colour" }),
  ];

  const row = el(
    "div",
    { class: "swatches" },
    SWATCHES.map((s) =>
      el("button", {
        class: "swatch",
        type: "button",
        "aria-pressed":
          s.toLowerCase() === String(sel.color).toLowerCase()
            ? "true"
            : "false",
        style: { background: s },
        onclick: () => patch((it) => (it.color = s)),
      }),
    ),
  );
  fields.push(row);

  fields.push(
    stat(
      "position",
      `u${uLabelFor(sel.row)}${sel.row % 2 ? " (upper ½)" : ""}`,
    ),
    stat("footprint", `${fmtU(sel.u)}u · ${sel.width}`),
  );

  if (sel.maker) {
    const coll = collectionById(sel.collection);
    fields.push(stat("printed by", sel.maker));
    if (sel.uExact === false) {
      fields.push(
        el("div", {
          class: "alert is-warn",
          text: "⚠ height estimated — the model title does not state it. check before printing.",
        }),
      );
    }
    if (coll) {
      fields.push(
        el("a", {
          class: "coll-link",
          href: coll.url,
          target: "_blank",
          rel: "noopener noreferrer",
          text: `${coll.label} on makerworld ↗`,
        }),
      );
    }
  }

  fields.push(
    el("div", { class: "row2", style: { marginTop: "10px" } }, [
      el("button", {
        class: "btn",
        type: "button",
        text: "⧉ duplicate",
        onclick: () => {
          if (!addFromCatalog({ ...sel })) say("no room for a copy");
        },
      }),
      el("button", {
        class: "btn btn--danger",
        type: "button",
        text: "✗ remove",
        onclick: () =>
          commit((s) => {
            s.items = s.items.filter((i) => i.id !== sel.id);
            s.selectedId = null;
          }),
      }),
    ]),
  );

  return fields;
}

/**
 * Icon picker: pick a library, type a slug, see it resolve live.
 *
 * There is deliberately no browse-all grid — the selfh.st and simple-icons
 * indexes are 845KB and 372KB, which is not a reasonable thing to download so
 * someone can pick a picture. The datalist covers the common homelab cases and
 * the "browse ↗" link covers everything else.
 */
function iconPicker(sel, patch) {
  const current = parseRef(sel.icon);
  const source = current?.source ?? "sh";
  const listId = "iconsuggest";

  const preview = el("span", { class: "icon-preview" }, [
    iconEl(sel.icon, sel.color, "g"),
  ]);

  const browse = el("a", {
    class: "coll-link",
    href: SOURCES[source].browse,
    target: "_blank",
    rel: "noopener noreferrer",
    text: `browse ${SOURCES[source].label} ↗`,
  });

  const srcSel = el(
    "select",
    {
      // Switching library does NOT commit: the slug typed so far belongs to the
      // old library, so applying here would rewrite the device's icon to a slug
      // that does not exist in the new one (sh:truenas-scale → si:truenas-scale,
      // a 404). It just re-aims the browse link; the next slug edit commits.
      onchange: () => {
        browse.href = SOURCES[srcSel.value].browse;
        browse.textContent = `browse ${SOURCES[srcSel.value].label} ↗`;
      },
      "aria-label": "icon library",
    },
    Object.values(SOURCES).map((s) =>
      el("option", {
        value: s.id,
        text: s.label,
        selected: s.id === source ? "" : null,
      }),
    ),
  );

  const slug = el("input", {
    type: "text",
    list: listId,
    placeholder: "slug, e.g. jellyfin",
    value: current?.slug ?? "",
    "aria-label": "icon slug",
    onchange: () => apply(),
  });

  // a shared datalist; harmless to re-add, the browser dedupes by id
  const list = el(
    "datalist",
    { id: listId },
    SUGGESTIONS.map((r) => el("option", { value: parseRef(r).slug })),
  );

  function apply() {
    const ref = formatRef(srcSel.value, slug.value);
    // an empty slug means "no logo" — fall back to a plain glyph
    patch((it) => (it.icon = ref || "▪"));
  }

  const glyphRow = el(
    "div",
    { class: "swatches" },
    GLYPHS.map((g) =>
      el("button", {
        class: "swatch swatch--glyph",
        type: "button",
        text: g,
        title: `use the ${g} glyph`,
        "aria-pressed": sel.icon === g ? "true" : "false",
        onclick: () => patch((it) => (it.icon = g)),
      }),
    ),
  );

  return el("div", {}, [
    el("div", { class: "icon-row" }, [preview, srcSel, slug, list]),
    browse,
    el("div", { class: "hint", text: "…or a plain glyph:" }),
    glyphRow,
  ]);
}

function stat(k, v, cls = "") {
  return el("div", { class: `stat ${cls}` }, [
    el("span", { text: k }),
    el("b", { text: v }),
  ]);
}

function fmtNum(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

let toastTimer;
export function say(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.hidden = true), 2200);
}
