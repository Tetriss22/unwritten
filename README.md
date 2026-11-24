# UNWRITTEN

An ASCII action tale in five chapters. Plays in the browser, no install.

Something is deleting the world one word at a time. You are the last Scribe: find the letters, beat what guards them, and write the world back.

**Play:** https://tetriss22.github.io/unwritten/

## Controls

| | Keyboard / mouse | Phone |
|---|---|---|
| Move | WASD or arrows | left thumb |
| Strike (three-hit combo, third is a spin) | click, J or Space | STRIKE |
| Dash (brief invulnerability) | Shift, K or right click | DASH |
| Sound / pause | M / Esc | buttons, top right |

Striking a red shot sends it back.

## The five chapters

1. **The Margin** — write BRIDGE to cross the river
2. **The Drowned Shelves** — write STONE to raise a road out of the water
3. **Cinder Row** — write RAIN to put out the red ink
4. **Whiteout Pass** — write FIRE to melt the wall
5. **The Blank** — write END, then say it to the Editor

## How the picture is made

Everything on screen is text.

- The ground is a world-anchored grid of large glyphs read from a per-level terrain texture, so it scrolls like a tile map.
- Everything standing on it (the Scribe, enemies, trees, lanterns) is real low-poly 3D, rendered tiny and redrawn as small glyphs chosen by brightness.
- Light, water reflections, weather, the rings from hits and the holes the enemies leave in the page are all done per glyph in one fragment shader.
- Sound and music are synthesised with Web Audio. There are no image or audio files.

Built with Claude Fable 5.2. Rendering uses [three.js](https://threejs.org) (MIT). Font: [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (SIL OFL 1.1).

The ASCII look was inspired by the ASCII games of @ansenjeo and @ztryfu. World, story, characters and code here are original.
