---
sidebar_position: 4
title: sharing & export
---

# sharing & export

## share links

**share** puts the entire layout in the URL fragment. Compact JSON, deflated with
the native `CompressionStream` when that comes out shorter than plain base64url,
then tagged so the decoder knows which it got.

```
https://rack-planner.stump.rocks/#zTc9LboMwGATgq1jDdtL-dsAl3qVRuARi...
```

Because it rides in the fragment, **the layout never reaches a server**. There
is nothing to host, nothing logged, and the link keeps working offline.

:::tip why not always compress
Deflate costs more in header than it saves below a few hundred bytes. An empty
rack encodes shorter raw, so `encode()` produces both and returns the winner.
:::

Layouts also autosave to `localStorage`, so a reload picks up where you left off.
A link in the URL wins over the saved layout.

## svg and png

`toSvg()` is a pure function reading the same model the DOM renders, so an
export cannot drift from what is on screen. PNG is that SVG through a canvas at
2× — no image library involved.

Both are useful for dropping an elevation into an Outline page, a Cairn share, or
a parts order.

## json

The layout format is versioned. `fromWire()` refuses a schema version it does
not recognise rather than silently producing an empty rack — a corrupt link
should say so, not quietly lose your plan.
