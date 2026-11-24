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

- The camera is isometric: turned 32 degrees and tilted, so buildings show two walls and a roof and roads run diagonally.
- Everything standing on the page is real low-poly 3D whose surfaces are written in letters. Each kind of surface has its own symbols and letter size: walls in `H#N[]=I`, roofs in `=^/\A`, leaves in `&%@oO8`, the unwriters in heavy purple `@&%8$#`. The letters live in the surface's own space, so they wrap around towers, lie flat on roofs and move with whatever they are painted on.
- The Scribe is written in the smallest, whitest letters on the page, so nothing else looks like the hero. A dim outline shows through walls and trees.
- The ground is read from one terrain texture through the same camera, as a grid of bold glyphs glued to the world.
- Movement has weight: the coat is a stack of rings on springs, so the hem lags, swings and flares; the scarf and hood trail; the quill leaves a ribbon in the air and a scar of `x = ~` on the ground where it cut.
- Wind crosses the world in bands: grass, wheat, reeds and tree crowns lean with each gust, and grass bends away from your feet.
- Two low-resolution passes of the same scene give shadows on the ground and reflections in water.
- Sound and music are synthesised with Web Audio. There are no image or audio files.

Built with Claude Fable 5.2. Rendering uses [three.js](https://threejs.org) (MIT). Font: [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (SIL OFL 1.1).

The ASCII look was inspired by the ASCII games of @ansenjeo and @ztryfu. World, story, characters and code here are original.
