# Repository review — release 65

Reviewed the connected Coda Arcade (including Song Machine), Pitch Race,
Music Triad, and Rhythm Room. The changes fix reproduced defects and remove
proven duplication; existing source artwork, historical assets, published world
layout, collision data, and older project exports remain available.

## Foreground editing

The arcade now samples the current authored scene without characters, including
moved/imported assets and pixel edits. Painting no longer copies an obsolete
background or silently excludes lifted objects. New strokes default to
**Foreground · above characters**. **Actor depth** retains explicit depth-offset
behavior, and existing strokes keep their saved settings.

World-space erase clips work at exact brush pixels even when a low-resolution
asset is enlarged or animated. Piano Lab and Fishing Cave also sample the
current artwork and honor Paint/Erase across asset layers. Inspection tint is
separate from the actual artwork. Cached scene samples are bounded to one per
rendered frame, not one per saved stroke.

Room editing now cancels drafts when editing access is revoked. Complete-world
autosaves use committed room snapshots, so cancelled pointer strokes cannot
leak into a queued save.

## Connected games and cleanup

- **Song Machine:** validate both import paths before replacing state; render
  imported labels as text; avoid composition XP for imported songs; include
  Advanced part controls in Undo; finish playback at the written end; respect
  zero volume. Both loading paths share `song-machine/composition.js`.
- **Pitch Race:** cancel abandoned Create/Join requests; stop race audio and
  score syncing when a room or membership ends; remove unused duplicate
  notation data and legacy state.
- **Music Triad:** detach abandoned online listeners and invalidate delayed
  startup, result, and tutorial-return callbacks; display tournament labels as
  text; keep match addresses locally derived. Tournament capacity is now the
  engine's supported **2–4 players**; larger lobbies previously stalled and are
  rejected before starting, using the existing database paths.
- **Rhythm Room:** finalized rounds cannot be reopened by a delayed tap event
  or reported twice. Load the identical bundled font/audio files directly,
  reducing the HTML from about 1.52 MB to 57 KB. Repair the sound-credits link.
- Replace obsolete prototype instructions and correct stale test fixtures
  against current controls, locked-item behavior, bar-based fishing battles,
  and the 100 BPM limit for sixteenth-note fishing rhythms.

## Validation and scope

- **492 unit checks:** 438 arcade, 17 Pitch Race, 19 Music Triad, 18 Rhythm Room.
- More than **200 browser checks**, including real canvas pixels, Web Audio,
  mobile input/fullscreen, collision, editor history and JSON persistence,
  progression/reward bridges, and classroom privacy flows.
- **98 JavaScript/inline-script syntax checks** and **160 local HTML/CSS
  resource links** across the four repositories.
- New regressions reject the original faulty foreground, import, timing, and
  session-handling implementations. Existing floor, couch, artwork editor,
  collision, room, and private-profile entry checks remain green.

Online lifecycle tests use isolated Firebase-shaped doubles. This review does
not change Firebase configuration, deployed rules, credentials, or live data,
and does not claim to verify live multiplayer service availability. Guest and
private-classroom local flows remain covered by the existing checks.
