# UNWRITTEN

An ASCII action game set in one small open world of five lands. Plays in the browser, no install.

Something is deleting the world one word at a time. You are the last Scribe: walk the lands in any order, find the letters, beat what guards them, and write the world back.

**Play:** https://tetriss22.github.io/unwritten/

## Controls

| | Keyboard / mouse | Phone |
|---|---|---|
| Move | WASD or arrows | left thumb |
| Strike (three-hit combo, third is a spin) | click, J or Space | STRIKE |
| Dash (brief invulnerability) | Shift, K or right click | DASH |
| Zoom | mouse wheel, + and - | pinch, or the + and - buttons |
| Whole-world map | Z, or the MAP button | MAP |
| Sound / pause | M / Esc | buttons, top right |

Striking a red shot sends it back. Progress is saved in the browser, so a reload offers CONTINUE.

## The world

Four lands sit around a hole in the middle of the page, joined by a ring road. Each land hides the letters of one word; writing the word opens the way to that land's lantern. Light all four and the road into the middle gets written.

1. **The Margin** (south-west, where you start): write BRIDGE to cross the river
2. **The Drowned Shelves** (north-west): write STONE to raise a road out of the water
3. **Cinder Row** (north-east): write RAIN to put out the red ink
4. **Whiteout Pass** (south-east): write FIRE to melt the wall
5. **The Blank** (the middle): write END, then say it to the Editor

A lit lantern makes its whole land brighter, which you can see from the map view.

## How the picture is made

Everything on screen is text.

- The ground is a world-anchored grid of large glyphs read from one terrain texture for the whole world, so it scrolls like a tile map. Zooming out makes one glyph stand for a larger block of ground, so it stays text at any distance.
- Everything standing on it (the Scribe, enemies, trees, lanterns) is real low-poly 3D, rendered tiny and redrawn as small glyphs chosen by brightness.
- Light, water reflections, weather, the rings from hits and the holes the enemies leave in the page are all done per glyph in one fragment shader.
- Sound and music are synthesised with Web Audio. There are no image or audio files.

Built with Claude Fable 5.2. Rendering uses [three.js](https://threejs.org) (MIT). Font: [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (SIL OFL 1.1).

The ASCII look was inspired by the ASCII games of @ansenjeo and @ztryfu. World, story, characters and code here are original.
