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
| Switch weapon | Q | WPN |
| Cast fire / lightning | 1 / 2 | FLAME / BOLT |
| Call your horse / get down | R | HORSE |
| Climb a tower, climb down, talk | E | USE |
| Light a campfire (checkpoint, heals you) | F | FIRE |
| Zoom | mouse wheel, + and - | pinch, or the + and - buttons |
| Whole-world map | Z, or the MAP button | MAP |
| Sound / pause | M / Esc | buttons, top right |

## Weapons, magic, elixirs

- **QUILL** (from the start): quick three-hit combo ending in a spin.
- **BLADE** (level 2): a broad letter-opener. Slow, triple damage, and it shakes the page where it lands.
- **NIBS** (level 4): twin blades. Short reach, very fast.
- **FIRE** (key 1, 20 ink): a fireball that bursts and leaves the ground burning. The ground letters themselves turn into `^ * ~` flames and keep hurting whatever stands in them.
- **BOLT** (key 2, 30 ink, level 3): lightning that jumps between up to four enemies, drawn as jagged `/ \ #` strokes on the ground and in the air.
- **Elixirs** are scattered over the whole world, about ninety of them: gold gives experience, blue refills ink, red heals. Kills and letters give experience too.
- Each level adds 20% damage and 10 ink, and every second level adds a point of health. Levels, weapon and collected elixirs are saved.

## Towns, makers and crafting

Five towns stand between the old places: **Wheatham** and **Fordmill** in the Margin, **Stillwater** in the Drowned Shelves, **Emberwick** in Cinder Row and **Coldharbour** in Whiteout Pass. Each has a square with a well, a ring of houses, townsfolk to talk to and makers at stalls (33 people in the world, 10 of them makers).

Makers work for **dust** (from kills and from salvaging gear) and **essence** (from gold and orange gear, Redactors, Mimics, buried caches and the Editor):

- **Smiths** make five weapons: **SWORD** (twice the quill), **SABRE** (fast, wide, +20% crit), **PIKE** (double reach, pierces a line), **BOW** (arrows pass through two and can be shot from tower tops) and **HAMMER** (slow, hits everything near the impact). There is a smith in the first village.
- **Outfitters** make magic, rare and legendary gear, and reforge the stats of what you wear.
- **Alchemists** sell a mending draught, a draught of experience and Deep ink (+10 max ink for good, five times).

## Wheat burns

There are many more wheat fields in the Margin. A fireball, a lightning strike or the Cinder Mantle sets wheat alight; the fire runs from stalk to stalk until the whole field is ash, and hurts every unwriter standing in it.

## Music

ESC (or the note button) opens the pause screen with a music volume slider, a sound volume slider and a track switch: LAND (each land's own score), WALTZ, MARCH, BELLS, DRIFT. **N** jumps to the next track. All of it is synthesised; the choice is remembered.

## The wilds

The world is 237 x 170 units, 1.75 times its first size: each land now covers about as much ground as a third of the old map. Between the roads live five more unwriters:

- **Typo**: small and quick, comes in fours, weaves as it runs at you.
- **Asterisk**: a footnote with a fuse. It runs up, swells and bursts; the blast hurts other unwriters too, and a hit stops the fuse.
- **Ghostwriter**: fades out, steps in next to you and fires three shots. It can only be hit while you can see it.
- **Redactor**: a slab that slams the ground around it and, at half health, calls three Typos. Always drops something.
- **Mimic**: some chests bite.

## Hidden loot

46 caches lie off the roads, counted in the HUD as SECRETS. **Chests** stand out in the wilds; some are guarded by a Redactor and some are Mimics. **Buried** caches show nothing until you stand almost on them, then glint: press E to dig. From the top of any tower, thin lights mark every buried cache nearby. Buried caches give two items and the best odds of gold and orange.

## Loot

Unwriters drop gear, in four rarities: grey **common**, blue **magic**, gold **rare** and orange **legendary**. A drop stands under a pillar of letters in its colour, taller the rarer it is. Walk over it to pick it up; **I** (or the BAG button) opens your bag, where you wear it or salvage it for experience.

- Three slots: **robe**, **ring**, **charm**. A worn robe tints the Scribe's coat in its colour.
- Stats: damage, hearts, max ink, ink per second, crit chance (crits deal double), move speed, fire damage, lightning damage, ink on hit, experience.
- Items from later lands and stronger enemies roll higher; brutes drop often, the Editor always drops a legendary.
- Six legendaries, each with its own effect: **The Last Draft** (dashing cuts), **Cinder Mantle** (dash leaves fire), **Red Pen** (every 4th strike calls lightning), **Run-On Sentence** (kills burst into the enemies next to them), **Comma Splice** (fireballs split in three), **Margin of Error** (one hit in four misses you).
- The bag shows whether an item is better or worse than what you wear, stat by stat. Gear and bag are saved.

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
