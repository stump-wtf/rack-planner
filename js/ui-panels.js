// ui-panels.js — the catalog on the left, the inspector on the right.
// both are full re-renders on every state change; the dom here is small enough
// that diffing would be more code than it saves.

import {
  CATALOG,
  CATEGORIES,
  COLLECTIONS,
  SWATCHES,
  DEPTH_PRESETS,
  chassisById,
  collectionById,
} from "./model.js";
import { uLabelFor } from "./grid.js";
import { state, commit, derived } from "./state.js";
import { beginNewDrag, addFromCatalog } from "./ui-rack.js";
import { fmtU } from "./export.js";

let paletteEl;
let inspectorEl;
let toast;

export function initPanels(elements) {
  paletteEl = elements.paletteEl;
  inspectorEl = elements.inspectorEl;
  toast = elements.toast;
}

function el(tag, props = {}, children = []) {
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

/** name, maker and collection are all searchable — 46 entries needs a filter. */
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
  renderChips();
}

function renderChips() {
  const kids = [];
  let shown = 0;

  for (const cat of CATEGORIES) {
    const inCat = CATALOG.filter((d) => d.cat === cat.id && matches(d, query));
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
      el("span", { class: "g", text: def.glyph }),
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
        glyph: "▪",
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
      el("div", {}, [el("label", { text: "watts" }), watts]),
    ]),
    el("label", { text: "colour" }),
    swatchRow,
    add,
  ]);
}

// ── inspector ──────────────────────────────────────────────────────────────

export function renderInspector() {
  const d = derived();
  const chassis = chassisById(state.chassisId);
  const sel = state.items.find((i) => i.id === state.selectedId);
  const kids = [];

  kids.push(el("div", { class: "section-title", text: "❯ rack" }));
  kids.push(stat("size", `${chassis.u}u · 10"`));
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
    DEPTH_PRESETS.map((p) =>
      el("option", {
        value: String(p.mm),
        text: p.label,
        selected: p.mm === state.depthMm ? "" : null,
      }),
    ),
  );
  kids.push(depthSel);

  // power
  kids.push(el("label", { text: "power budget (w)" }));
  kids.push(
    el("input", {
      type: "number",
      min: "0",
      step: "10",
      value: String(state.budgetW),
      onchange: (ev) =>
        commit((s) => (s.budgetW = Number(ev.target.value) || 0)),
    }),
  );
  const pct =
    state.budgetW > 0 ? Math.min(100, (d.watts / state.budgetW) * 100) : 0;
  const level = d.overBudget ? "is-bad" : pct > 80 ? "is-warn" : "";
  kids.push(
    el("div", { class: `meter ${level}` }, [
      el("i", { style: { width: `${pct}%` } }),
    ]),
  );
  kids.push(
    stat(
      "draw",
      `${d.watts}w${state.budgetW ? ` / ${state.budgetW}w` : ""}`,
      level,
    ),
  );

  if (d.overBudget) {
    kids.push(
      el("div", {
        class: "alert",
        text: `⚠ over budget by ${d.watts - state.budgetW}w`,
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

  inspectorEl.replaceChildren(...kids);
}

function selectionFields(sel) {
  const patch = (fn) =>
    commit((s) => {
      const it = s.items.find((i) => i.id === sel.id);
      if (it) fn(it);
    });

  const fields = [
    el("label", { text: "name" }),
    el("input", {
      type: "text",
      // onchange, not oninput: a full inspector re-render per keystroke would
      // steal focus mid-word and push one undo entry per letter.
      value: sel.name,
      onchange: (ev) =>
        patch((it) => (it.name = ev.target.value.toLowerCase())),
    }),
    el("div", { class: "row2" }, [
      el("div", {}, [
        el("label", { text: "depth mm" }),
        el("input", {
          type: "number",
          min: "0",
          step: "5",
          value: String(sel.depthMm || 0),
          onchange: (ev) =>
            patch((it) => (it.depthMm = Number(ev.target.value) || 0)),
        }),
      ]),
      el("div", {}, [
        el("label", { text: "watts" }),
        el("input", {
          type: "number",
          min: "0",
          step: "1",
          value: String(sel.watts || 0),
          onchange: (ev) =>
            patch((it) => (it.watts = Number(ev.target.value) || 0)),
        }),
      ]),
    ]),
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
