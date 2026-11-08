# Steirische Harmonika

```sh
npm install
npm run dev
npm test
npm run build
```

Tests use Node's native TypeScript support (Node 22.18+; verified on Node 26).

## 3D test page

Choose **3D test page** in the toolbar, or open `/#/3d`. The default `/#/`
view stays 2D. Three.js loads only when visiting the 3D page. Both views share
tuning, tremolo, bellows direction, keyboard mapping and the same audio engine.

All 46 buttons come from the existing layout, including the unmapped top button.
Labels show the current note and keyboard shortcut; `—` means pointer/touch only.
Hold the usual note keys, or press the 3D buttons with a mouse or multiple touches.
Hold Space/Shift for pull (Zug); release to restore the toolbar direction.
Held notes retune when tuning or bellows change. All held buttons depress and glow.
Pointer release/cancel/lost capture, window blur and navigation release their notes.
If WebGL is unavailable or its context is lost, the page offers the 2D instrument.

### Hand shapes

Numbering here is **1 = index, 2 = middle, 3 = ring**; the thumb is separate.

- **1 + 2:** index and middle fingertips down on neighbouring buttons.
- **1 + 3:** index and ring down, middle lifted.
- **1 + 3, upper row:** ring reaches the next raised keyboard row/column.
  At the innermost row, it stays on the last available level.

The procedural hand has a palm, thumb and four fingers with three segments each.
It follows actual held buttons (up to two fingertip targets); remaining held notes
still sound and animate. When only one note is held, the second finger previews
the selected shape on a nearby button, without sounding that note. Releasing all
notes returns the hand to its neutral preview. Two held notes override the preview
targets, so fingertips touch the actual chord even if it spans distant buttons.

This is a basic elastic visual model, not anatomical inverse kinematics or a
fingering tutor. Extreme chords stretch the fingers. There are no external models,
assets, pose-recognition systems or automatic fingering suggestions.

## Verification

`npm test` covers staggered/elevated board positions, preset finger identities,
raised-row geometry, active chord targeting, reset/empty/boundary cases and the
lazy route wiring. A compiled-component setup regression verifies initial retuning
when notes/settings change before the lazy 3D page mounts. `npm run build` checks
Vue/TypeScript and builds both chunks.
Browser QA on Chrome 145 covered real WebGL rendering, all 45 mapped note keys,
held-note tuning/bellows changes, chords, mouse capture/release, emulated multitouch
and cancellation, blur/navigation cleanup, and the 2D fallback after WebGL context
loss. Portrait (375×667) and landscape (667×375) layouts were checked; physical
mobile browsers and audible sound quality were not tested.
