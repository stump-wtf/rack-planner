---
sidebar_position: 5
title: designs
---

# designs

A design is one complete rack — the chassis size, depth, power budget and every
placed device. You can have several of them.

The library lives in the topbar. The current design's name sits next to the
wordmark; the **▾ designs** button opens a list of everything you have made.

## creating and switching

**+ new rack** starts an empty design. **⧉ duplicate this rack** clones the
active one — useful for trying a variant without touching the original. Every
cloned device gets a fresh id, so editing the copy never leaks back into the
source.

Click any design in the list to switch to it. The page reloads into the
design you were last on.

## renaming

Click the design name in the topbar to edit it in place. Enter or clicking
away commits; Escape cancels. Names are trimmed and lowercased to match the
rest of the app.

## deleting

The **✗** next to a design in the list removes it. An empty rack goes without
asking; a rack with devices asks for confirmation, because undo does not cross
a design switch — once it is gone, it is gone.

The library never drops to zero. Deleting your last design leaves a fresh empty
one behind.

## where designs live

**Browser localStorage, on that one browser.** Designs are not synced, not
backed up, and clearing site data destroys them. This is the single most
important fact on this page.

A share link is how a design travels between machines or reaches another
person — see [sharing & export](./sharing). The link carries one design, and
opening one does not add it to your library; it loads into the active slot.

:::caution clearing site data removes every design
Because the library is in localStorage, clearing your browser's site data —
or using a different browser, or a private window — starts you from scratch.
Share links are the durable copy. If a design matters, share it to yourself.
:::
