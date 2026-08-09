// ui-designs.js — the designs library bar in the topbar.
//
// two elements after the eyebrow: the active design's name (click to rename
// in place) and a "▾ designs" button opening the library popover. the bar
// lives in a fixed container in index.html — this module fills it once on
// init and updates the name text on each render, but the rename input and
// the popover are managed outside the re-render cycle so the caret never
// gets torn out from under a focus.

import { el, say } from "./ui-panels.js";
import { state, switchDesign } from "./state.js";
import { chassisById } from "./model.js";
import {
  listDesigns,
  getDesign,
  getActive,
  createDesign,
  cloneDesign,
  renameDesign,
  deleteDesign,
} from "./designs.js";

let barEl;
let nameEl;
let dropdownBtn;
let popover = null;

export function initDesignsBar(elements) {
  barEl = elements.barEl;
  build();
}

/**
 * update the active design name text. exported so app.js can call it from
 * renderAll() after state changes — but it only updates text content, never
 * replaces the element, so a rename input focused inside it survives.
 */
export function renderDesignsBar() {
  if (!nameEl) return;
  // if the user is renaming right now, do not clobber the input
  if (nameEl.querySelector("input")) return;
  const d = getActive();
  nameEl.textContent = d ? d.name : "untitled rack";
}

function build() {
  nameEl = el("button", {
    type: "button",
    class: "designs-name",
    title: "rename this design",
    onclick: () => beginRename(),
  });
  nameEl.textContent = getActive()?.name ?? "untitled rack";

  dropdownBtn = el(
    "button",
    {
      type: "button",
      class: "btn designs-trigger",
      "aria-haspopup": "menu",
      "aria-expanded": "false",
      onclick: (ev) => {
        ev.stopPropagation();
        togglePopover();
      },
    },
    "▾ designs",
  );

  barEl.replaceChildren(nameEl, dropdownBtn);
  renderDesignsBar();

  // click-outside / escape to close
  document.addEventListener("click", (ev) => {
    if (!popover) return;
    if (popover.contains(ev.target)) return;
    if (barEl.contains(ev.target)) return;
    closePopover();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && popover) {
      ev.stopPropagation();
      closePopover();
      dropdownBtn.focus();
    }
  });
}

// ── rename ────────────────────────────────────────────────────────────────

/**
 * turning the name button into a text input. the input lives inside nameEl,
 * which is a stable DOM node — renderDesignsBar sees the input and skips the
 * text update, so the caret is safe while the user types.
 */
function beginRename() {
  const d = getActive();
  if (!d) return;

  const input = el("input", {
    type: "text",
    class: "designs-rename",
    value: d.name,
    maxlength: "60",
    "aria-label": "design name",
  });

  nameEl.replaceChildren(input);
  input.focus();
  input.select();

  let committed = false;
  const commit_ = () => {
    if (committed) return;
    committed = true;
    renameDesign(d.id, input.value);
    nameEl.textContent = "";
    renderDesignsBar();
  };

  input.addEventListener("change", commit_);
  input.addEventListener("blur", commit_);
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      input.blur();
    } else if (ev.key === "Escape") {
      committed = true;
      ev.preventDefault();
      nameEl.textContent = "";
      renderDesignsBar();
    }
  });
}

// ── popover ───────────────────────────────────────────────────────────────

function togglePopover() {
  if (popover) closePopover();
  else openPopover();
}

function openPopover() {
  dropdownBtn.setAttribute("aria-expanded", "true");
  popover = buildPopover();
  barEl.appendChild(popover);
}

function closePopover() {
  dropdownBtn.setAttribute("aria-expanded", "false");
  popover?.remove();
  popover = null;
}

function buildPopover() {
  const designs = listDesigns();
  const active = getActive();

  const kids = [
    el("button", {
      type: "button",
      class: "btn designs-action",
      text: "+ new rack",
      onclick: () => {
        createDesign();
        closePopover();
        reloadActive("new rack created");
      },
    }),
    el("button", {
      type: "button",
      class: "btn designs-action",
      text: "⧉ duplicate this rack",
      onclick: () => {
        if (active) {
          cloneDesign(active.id);
          closePopover();
          reloadActive("rack duplicated");
        }
      },
    }),
    el("div", { class: "section-title", text: "designs" }),
  ];

  // each design row — name, meta line, delete control. active row marked.
  for (const d of designs) {
    const isActive = active && d.id === active.id;
    const full = getDesign(d.id);
    const meta = metaLine(full);

    const row = el(
      "div",
      {
        class: "designs-row" + (isActive ? " is-active" : ""),
        "aria-current": isActive ? "true" : null,
      },
      [
        el(
          "button",
          {
            type: "button",
            class: "designs-row__select",
            onclick: () => {
              switchDesign(d.id);
              closePopover();
            },
          },
          [
            el("div", { class: "designs-row__name", text: d.name }),
            el("div", { class: "designs-row__meta", text: meta }),
          ],
        ),
      ],
    );

    // delete control — needs a real label, ✗ alone is not one
    const del = el("button", {
      type: "button",
      class: "btn btn--danger designs-row__del",
      "aria-label": `delete ${d.name}`,
      text: "✗",
      onclick: (ev) => {
        ev.stopPropagation();
        const target = getDesign(d.id);
        if (target && target.layout.items.length > 0) {
          if (
            !confirm(
              `delete "${d.name}" and its ${target.layout.items.length} devices?`,
            )
          )
            return;
        }
        deleteDesign(d.id);
        reloadActive("design deleted");
        // rebuild the popover to reflect the new list
        closePopover();
        openPopover();
      },
    });

    row.appendChild(del);
    kids.push(row);
  }

  return el(
    "div",
    {
      class: "designs-popover",
      role: "menu",
      "aria-label": "designs library",
    },
    kids,
  );
}

/**
 * the meta line for a design row: chassis size and device count, e.g.
 * "8u · 6 devices". exported so tests can cover it without a DOM.
 */
export function metaLine(design) {
  if (!design) return "";
  const chassis = chassisById(design.layout.chassisId);
  const count = design.layout.items.length;
  const devWord = count === 1 ? "device" : "devices";
  return `${chassis.u}u · ${count} ${devWord}`;
}

/**
 * after a create/clone/delete: the active design changed without going through
 * switchDesign, so load it into state and re-render.
 */
function reloadActive(toast) {
  switchDesign(getActive().id);
  renderDesignsBar();
  if (toast) say(toast);
}
