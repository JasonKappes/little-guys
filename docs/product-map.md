# little guys product map

This document maps what the studio can do today. It is written for product and design ideation, not implementation. Domain vocabulary and persistence rules still live in [CONTEXT.md](../CONTEXT.md). Setup and commands live in [README.md](../README.md). Accepted architecture decisions live in [docs/adr/](./adr/).

README and CONTEXT describe the original studio. Some newer work (extra body parts, render styles, stage color, speech) is in the app and is included here.

## What it is

little guys is a browser-only authoring studio for procedural 2D mascot avatars. Characters are not drawn bitmaps. They are generated from 3D-inspired shapes, projected to SVG, then styled.

A creator can:

1. Build a character body
2. Set a lasting resting look (colors and default eyes)
3. Save named facial poses (expressions)
4. String those into playable animations
5. Export a small player that can run without the studio

There is no account, no server, and no cloud save in this repository. The whole project lives in the browser. JSON export/import is the backup. The license is AGPL-3.0.

The studio is the authoring tool. Exported packages are the runtime. Those are different products sharing one geometry engine.

## Who it is for

Current product: creators and developers making a mascot and dropping it into a site or React app.

Recent studio work also treats it as a proving ground for a talking mascot (Azure speech and mouth shapes). That talk path is studio-only. It is not in the exported player, and the Azure key is not saved.

## Core ideas

**Avatar** — A character you keep. Owns body, colors, default eyes, render finish, and optionally its own expression/animation library.

**Neutral appearance** — The avatar’s lasting rest look. Not a saved pose.

**Pose** — What you see right now. Temporary. Not saved as its own object.

**Expression** — A named saved face/head preset. Eye numbers are relative to that avatar’s default eyes, so the same expression can sit on a sphere or a cube. Optional body/eye colors on an expression are temporary overrides.

**Animation** — An ordered list of expressions, plus hold time, transition style, loop mode, and blink settings. The user-facing word is Animation. Older internals still say “state” or “sequence.”

**Playback** — One animation running. While it runs, it owns the live pose. If the user grabs the face or edits numbers, playback pauses.

**Base behavior library** — Bundled expressions and animations shared by avatars that have not been customized yet.

**Avatar behavior library** — Private copy created the first time that avatar’s expressions or animations are edited. After that, edits only affect that avatar. Duplicate an avatar and you duplicate its custom library too. Move an animation and you must move every expression it uses.

**Primary surface** — The main head/body shape. It owns the face frame and the eyes.

**Secondary primitives** — Extra 3D-ish solids (up to 16) placed around the primary.

**Limbs** — Grown-on extras (tail, ear, horn, belly). Not separate floating solids. They fuse into the body fill so they look attached.

## Workspace layout

Left: live stage (the character).
Right: inspector.
Bottom: mode tabs and a compact animation player.

Main modes:

1. **Avatars** — pick or create characters, stage background
2. **Pose** — current look, or open the body editor
3. **Expressions** — library of saved faces
4. **Animations** — timelines
5. **Export** — packages, Photo Mode, full project JSON

Interface language: English, French, Simplified Chinese. Copy is kept in sync.

The stage background is a studio-wide hex color saved with the project. It is not part of the exported character.

The stage can be scroll-zoomed far in or out. Photo Mode and exports still use their own size settings.

## Avatars

Bundled starter cast (22), including five 3-form families sitting next to each other:

- Strobi → Strobek → Strobar (water)
- Cubee → Cuborn → Cuboss (fire)
- Onee → Onex → Onara (ice)
- Zappi → Zapplin → Zapperon (electric)
- Budi → Budwick → Bloomarch (grass)

The other seven stay single-form: Freddy, Citrus, Nova, Grok bot, Sunee, Kirby, Cloudee.

These families are content only. There is no evolve engine. Form 1 is the simplest. Mid and final grow parts, get bigger, and gain more color detail (tips, rings, markings, shading). All forms share the base expression and animation library. The studio still opens on Strobi.

You can:

- Create, rename, duplicate, reorder, and delete
- Deleting an avatar deletes its private expressions and animations; the shared base library stays
- You cannot delete the last remaining avatar
- Switching avatar keeps the current animation slot if that animation still exists

Each avatar stores:

- Body (primary, extra solids, and limbs, each part with an optional color)
- Body color and eye color
- Palette: two accent colors
- Markings on the primary head
- Cartoon shading settings
- Default eye shape and placement
- Render style
- Optional private behavior library

## Body construction

### Primary head

One main surface. Types include sphere, cube, capsule, cylinder, cone, and diamond, plus a couple of special presets (Mickey, Cursor).

Tunable: width, height, depth, roundness, and extra roundness knobs on some shapes (cone tip/base, cylinder morph).

This surface is the face. Eyes live on it in a shared facial coordinate system, so expressions stay compatible when you swap head shapes.

### Extra solids

Up to 16 extra primitives: sphere, cube, capsule, cylinder, cone, diamond.

Each has its own size, roundness, 3D position, and local rotation. They can be named, selected, duplicated, or deleted.

On the canvas you can:

- Select a part
- Drag it in plane
- Translate along local axes
- Rotate around local axes

Inspector numbers match the gizmos.

### Limbs

Up to 8 limbs. Kinds: tail, ear, horn, belly.

Presets:

- Short curly tail
- Long thin tail
- Thick stub tail
- Ear
- Horn
- Belly

A limb is a spine of handles (points and thickness), not a separate mesh. You can add handles (max 12), change thickness, sculpt on the stage, duplicate, or delete.

They are meant to look grown out of the body. The renderer merges limb and body into one fill so seams do not show as holes.

### Colors

An avatar has a lasting body color and eye color.
A live pose or a saved expression can override those colors temporarily.

## Colors and markings

Everything here is part of the avatar's lasting look and works with every render style (including pixel).

### Palette

Two accent colors (Accent and Accent 2) sit next to Body and Eyes. Anything colorable picks one of these four roles, or a custom hex. Changing a role recolors everything that uses it.

Harmony helpers suggest accents from the body color: complementary, analogous, triadic, split complementary, tonal, pastel, and ember. "Surprise palette" rolls a new body color plus a matching harmony.

### Part colors

- Extra solids: one color each.
- Limbs: a base color, an optional **tip** (the last part of the spine, with a length slider), and optional **rings** (1–6 alternating bands along the spine). Good for flame tails, dark ear tips, striped tails, and tipped horns.

Parts are layered by real depth, so a tail behind the head stays behind it once it has its own color.

### Markings

Up to 12 markings on the primary head. They are placed by direction on the 3D surface (horizontal and vertical angle, size in degrees, rotation) and wrap around the shape as it turns, hiding when they face away.

Presets: belly patch, muzzle, mask, cheeks, gem, star, heart, moon, spots, stripes, two-tone top, two-tone bottom, shine.

Kinds:

- **Decal** — one shape: oval, diamond, soft square, star, heart, or crescent
- **Spots** — a seeded scatter of small ovals (count, reroll)
- **Stripes** — parallel bands around an axis (count, span, thickness)

Every marking has a color role, opacity, and an optional mirror copy. Markings sit under the eyes and under front parts, and are clipped to the head.

### Cartoon shading

A crisp shadow band and a highlight rim that follow the whole silhouette. Controls: shadow amount, shine amount, shadow depth, light direction, and shadow color. It stacks on top of any render style, including Borderlands.

### Wireframe

Optional wire overlay for editing the surface.

## Render styles

The geometry stays the same. The finish changes:

| Style | What it does |
| --- | --- |
| Vector | Clean flat SVG fill (default) |
| Outline | Thick clean outline; width is tunable |
| Borderlands | Outline-style stroke around the edge, plus comic wobble, inner ink marks, pickable ink color and width |
| Soft shade | Soft lighting; strength tunable |
| Glow | Soft glow; size tunable |
| Pixel | Quantized pixel-art look; grid size 8–192 |

Pixel is a special path: canvas quantization, not the same SVG mouth/eye treatment. Talking mouths are skipped in pixel mode.

Render style is per avatar and does export with the character.

## Pose

Pose is what the character looks like right now, not a saved asset.

You can change:

- Temporary body color, or inherit the avatar color
- Head rotation X/Y/Z (scrubbable, like Figma)
- Eyes: width, height, proportional size, position, spacing, per-eye rotation
- Link left/right width, height, size, and rotation so they stay mirrored
- Perspective
- Wireframe on/off

On the stage:

- Drag the head with a rotation gizmo (camera orbit and X/Y/Z rings)
- Reset head rotation
- Direct eye handles when editing
- Body-part gizmos when a solid or limb is selected

Ambient motion can be on the current expression:

- Eyes: none, tiny saccades, or shake
- Body: none, slow drift, or shake

These are subtle idle life, not full animation.

Editing a pose pauses the running animation so the user’s hands win.

## Default eyes

Separate from a temporary pose. This is the avatar’s rest face that expressions are measured against.

Same eye controls as pose (size, place, angle, color), but they belong to the character. Changing them changes how every relative expression lands on that character.

## Expressions

A bundled catalog of roughly two dozen numbered face presets, plus a named neutral.

You can:

- Browse, select, and apply (transitions to that face)
- Create, rename, duplicate, reorder, and delete
- Open a dedicated expression editor (save or cancel; unsaved work is reversible)
- Add temporary body/eye color overrides
- Add ambient eye/body motion to that expression

Deleting an expression warns if animations use it. Those steps are removed or given a fallback so the animation still plays.

Expressions are eyes, head, optional colors, and optional ambient motion.
They are not a mouth library. The mouth is a talking overlay, not a saved expression channel.

## Animations

Bundled set: 23 animations in two groups.

**Life cycle:** sleeping, waking, idle, listening, thinking, searching, working

**Reactions:** excited, surprised, suspicious, angry, drowsy, happy, curious, confused, bored, proud, shy, sad, laughing, scared, playful, celebrate

User-made animations go in a Custom group.

Each animation has:

- Name, group, description
- Steps: each step is one expression, a hold time, a transition time, and a transition feel (spring, smooth, or snappy)
- Playback: loop, play once, or ping-pong
- Blink: on/off, delay, min/max interval, blink duration

Studio player:

- Play, pause, resume, and stop
- Pick which animation is active
- Expand details
- Drag to reorder steps in the editor
- Dedicated animation editor with save/cancel
- Duplicate and delete, with confirm

While an animation plays, it drives the live pose. Touch the character or inspector numbers and it pauses.

## Speech and mouth

Studio-only proving ground. Not a shipped export feature.

### How talk works

1. Paste an Azure Speech key (password field, session only, never saved)
2. Region (default `eastus`)
3. Type a line
4. Choose language, speed, and tone
5. Play generates audio and a viseme tape, then plays them together
6. Stop cancels and hides the mouth

If the line and settings did not change, Play reuses the last generated audio. Change text, speed, tone, or language and it generates again.

### Languages and voices

- English → Ava (female, `en-US-AvaNeural`)
- Spanish → Jorge (male Mexican Spanish, `es-MX-JorgeNeural`)

### Speed

Slow (0.7), Easy (0.85), Normal, Fast (1.2)

### Tone

Depends on the voice:

- English: Neutral, Friendly, Cheerful, Excited, Whisper
- Spanish: Neutral, Cheerful, Excited, Whisper (Friendly is not supported, so it falls back)

Sentences get a short pause after `. ? !`

### Mouth behavior

The mouth is a talk overlay, like blink: it appears while talking, then goes away.

- Drawn on the face below the eyes, clipped to the head
- Same color as the eyes
- Hidden when not talking
- Hidden in pixel render style
- Not stored on expressions
- Not in the export `play(animation)` API

Lip-sync is Duolingo-like:

- Vowels blend
- P/F-style shapes snap and hold briefly
- About 40ms lookahead so the mouth starts before the sound
- Close, then hide (about 70ms) when the line ends
- Stop hides immediately

Azure viseme IDs 0–21 map to 8 mouth drawings: closed, pressed, teeth, slight, smile, wide, open, round. Those drawings have width, height, and a smile lift.

The intended split for a product like trywisp is: backend makes audio and visemes; little guys only plays the mouth. This studio currently also calls Azure itself so the author can test. The key lives only in that browser session.

## Stage and Photo Mode

**Stage**

- Live SVG character
- Optional pixel canvas overlay
- Rotation gizmo
- Photo button
- Stage background color (studio chrome, saved in the project)

**Photo Mode**

Takes a still of the current render:

- PNG or SVG
- 512 / 1024 / 2048
- Background: transparent, solid, linear gradient, or radial gradient
- Color stops for solid and gradients

This is a snapshot of now, not a full animation export.

## Export

### React package

A ZIP with a reusable TypeScript/React component and the selected animations. The host app does not get the studio UI.

Runtime handle: `play(name)`, `pause()`, `stop()`.
Props: which animation, playing, loop, size, end callback.

### JavaScript / HTML package

A framework-free ES module and HTML demo. Mount into a DOM node and play named animations.

### What an export contains

- Avatar name
- Primary surface, extra solids, and limbs (with part colors)
- Colors, palette, markings, and cartoon shading
- Render style
- Only the expressions used by the selected animations
- Those animations (steps, timing, blink, loop mode)

Eye values in the package are already baked against that avatar’s default eyes.

### What an export does not contain

- Studio UI
- Azure, speech, or mouth player
- Stage background
- Full unused expression catalog, unless an exported animation uses them
- Project JSON of every avatar

The exported player is animation playback, not a talk engine.

### Full Studio project JSON

The portable backup of everything: all avatars, base and private libraries, expressions, animations, playback choice, and stage color.

Import replaces the current local project after confirm. Version 2 only. No old-schema migrations.

## Persistence and privacy

Saved in localStorage:

- Whole studio document (version 2)
- UI language

Not saved:

- Azure key, region, talk line, speed, tone, or language
- Generated speech audio

Clearing site data wipes the project. JSON export is the backup.

Pre-release schema: only the current version is supported.

The document also stores a look version. When a newer bundled look ships, bundled avatars that still have no markings, part colors, or shading adopt it once on load. Their shape, colors, and behavior are kept.

## Bundled content

| Thing | Count / examples |
| --- | --- |
| Starter avatars | 22 named characters (5 evolution lines + 7 singles) |
| Marking presets | 13 (patches, cheeks, gem, star, heart, moon, spots, stripes, two-tone, shine) |
| Expression presets | About two dozen numbered faces plus neutral |
| Animations | 23 built-ins (7 life-cycle and 16 reactions) |
| Head/body solids | sphere, cube, capsule, cylinder, cone, diamond, plus Mickey and Cursor on primary |
| Limb presets | 3 tails, ear, horn, belly |
| UI languages | English, French, Simplified Chinese |
| Render finishes | 6 |

## How the system is split

Three layers:

1. **Authoring studio** — rich editor, local save, speech test bench
2. **Document** — one versioned JSON of avatars and behavior
3. **Runtime package** — show this character, play this animation name

Geometry, playback math, and document rules stay UI-free, so a game or site can run the same character without the React studio.

Durable things (which avatar, which saved expression) are editor state.
High-frequency things (blink, playback frames, mouth blend) are continuous animation values.

## Hard product rules

- Eyes live on the primary face only
- Extra solids do not get their own faces
- Expressions do not store mouths
- First behavior edit copies the whole library for that avatar
- Playback owns the pose until the user interrupts
- Export is given explicit data; it does not read localStorage
- Pixel style does not show the talk mouth
- Speech is generate-then-play (full tape), not live streaming visemes
- No backend in this repository
- AGPL: a hosted modified studio must share corresponding source

## Evolution lines

Content only. No evolve button, no runtime `setStage`, no shared species object.

Five families of three avatars sit next to each other in the drawer:

| Form 1 | Form 2 | Form 3 | Face | What grows |
| --- | --- | --- | --- | --- |
| Strobi | Strobek | Strobar | Sphere | Belly patch; ringed tail; navy shell, gold-tipped horns, gem |
| Cubee | Cuborn | Cuboss | Cube | Cream belly; orange nubs + flame star; tiger stripes, mask, gem |
| Onee | Onex | Onara | Cone | Pink cheeks; ice-tipped tail + moon; frost belly, tipped fins |
| Zappi | Zapplin | Zapperon | Sphere → capsule | Dark ear tips + red cheeks; back stripes; bolt gem, antennae, Borderlands ink |
| Budi | Budwick | Bloomarch | Sphere | Leaf sprout + spots; twin leaves; pink petal crown + star |

Rules:

- Same face type (or a close one), same signature read across a family
- Body grows about 1.2× then 1.45×; default eyes scale with the head
- Each form adds color detail: tips and rings on parts, more markings, stronger shading
- All forms share the base behavior library
- Studio still opens on Strobi

## What this repo is not yet

- Not a multiplayer or cloud studio
- Not a learner-facing language app
- Not a general illustration tool
- Not a phoneme or mouth expression editor
- Not a video or GIF exporter
- Not a voice-cloning or custom-voice pipeline
- Not an exported `speak()` API
- Not an in-game evolution system (the 3-form lines are separate avatars, not a morph)
- Not a backend for TTS (the studio can call Azure; a real product is expected to do TTS elsewhere)

## Strongest extension surfaces

Natural edges from what exists today:

1. **Talking mascot runtime** — take the viseme mouth player out of the studio and into the export, fed by a backend tape (audio and viseme times), with no Azure key in the client.
2. **Narrator vs player avatar** — same body system; one locked narrator look, one user-customizable little guy.
3. **Language-learning pacing** — speed and sentence pauses already exist; could become lesson-aware (slow new words, hold visemes on target syllables).
4. **More languages and voices** — the language switch is a small table; Spanish male is already a second voice.
5. **Expression and talk together** — today talk overlays a still face; a lesson could play `listening` or `happy` while the mouth talks.
6. **Limb/body as species kit** — tails, ears, and horns are already grown on, good for a small species creator rather than a full 3D doll.
7. **Render styles as brand skins** — Borderlands, pixel, and glow are finishes on one rig, useful for game vs lesson vs marketing.
8. **Photo Mode to stickers or cards** — still export is already there; could become shareable lesson rewards.
9. **Animation as emotion API** — exported `play('proud')` is already the integration surface for a game.
10. **Keep studio as the authoring island** — learners never see it; teachers and designers build the cast here, then ship packages or a thinner player.

## One-sentence summary

little guys is a local, AGPL, procedural mascot studio: sculpt a 2D character from fused 3D-ish parts, give it relative facial expressions and loopable emotion animations, finish it in several graphic styles, export a tiny `play(animation)` runtime — and, only inside the studio, test Azure-driven lip-sync that is not part of that runtime yet.
