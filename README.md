# UNWRITTEN

An ASCII action game in one open world of five lands. Plays in the browser, no install.

Something is deleting the world one word at a time. You are the last Scribe. There are no walls: walk or ride anywhere, in any order, find the letters, beat what guards them, and write the world back.

**Play:** https://tetriss22.github.io/unwritten/

## Controls

| | Keyboard / mouse | Phone |
|---|---|---|
| Move | WASD or arrows | left thumb |
| Strike (three-hit combo, third is a spin) | click, J or Space | STRIKE |
| Dash (brief invulnerability) | Shift, K or right click | DASH |
| Call your horse / get down | R | HORSE |
| Climb a tower, climb down, talk | E | USE |
| Light a campfire (checkpoint, heals you) | F | FIRE |
| Zoom | mouse wheel, + and - | pinch, or the + and - buttons |
| Whole-world map | Z, or the MAP button | MAP |
| Sound / pause | M / Esc | buttons, top right |

Striking a red shot sends it back. Striking from the saddle jumps you off swinging. Progress is saved in the browser, so a reload offers CONTINUE.

## The world

Four lands sit around a hole in the middle of the page. Roads join them, but you do not have to use them: meadows, forests, ponds and ruins are all open ground. Only the cut places stop you, a river, a lake, a wall of fire, a wall of ice, and each one is crossed by writing its word.

1. **The Margin** (south-west, where you start): write BRIDGE to cross the river
2. **The Drowned Shelves** (north-west): write STONE to raise a road across the lake
3. **Cinder Row** (north-east): write RAIN to put out the red ink
4. **Whiteout Pass** (south-east): write FIRE to melt the wall
5. **The Blank** (the middle): opens when four lanterns burn. Write END, then say it to the Editor

Towers can be climbed: nothing reaches you on high ground, and the camera pulls back so you can read the land. People who stayed behind will tell you what they know. A lit lantern makes its whole land brighter.

## How the picture is made

Everything on screen is text.

- The camera is isometric: turned 32 degrees and tilted, so buildings show two walls and a roof and roads run diagonally.
- Stone, ash and snow are dense running text: a noise decides how heavy each letter is, from `. : -` up to `W N M @ B`, and brighter stone gets heavier letters.
- Grass is its own finer, staggered layer of blades (`/ | \ ! '`) drawn over the ground. Every blade leans with the wind as gusts cross the world, bends away from your feet, and takes the colour of nearby light. Wheat is the same layer in gold.
- Everything standing on the page is real low-poly 3D whose surfaces are written in letters, heavier on the lit side. Each kind of surface has its own symbols and letter size; the Scribe is written in the smallest, whitest letters on the page, and a dim outline shows through walls and trees.
- Fights read like an RPG: dotted `o` rings show where an attack will land, hits throw numbers, awake enemies carry a name and a health bar, and every hit, kill and slam flashes its own light across the ground.
- Movement has weight: the coat is a stack of rings on springs, the scarf and hood trail, and the quill leaves a ribbon in the air and a scar of `x = ~` on the ground.
- Two low-resolution passes of the same scene give shadows on the ground and reflections in water.
- Sound and music are synthesised with Web Audio. There are no image or audio files.

Built with Claude Fable 5.2. Rendering uses [three.js](https://threejs.org) (MIT). Font: [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (SIL OFL 1.1).

The ASCII look was inspired by the ASCII games of @ansenjeo and @ztryfu. World, story, characters and code here are original.
