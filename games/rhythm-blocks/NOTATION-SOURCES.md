# Musical notation outlines

`notation.mjs` embeds five Bravura glyph outlines from the repository's existing
`../rhythm-room/Bravura.woff`: SMuFL `noteheadWhole` (U+E0A2), `noteheadHalf`
(U+E0A3), `noteheadBlack` (U+E0A4), `flag8thUp` (U+E240), and `restQuarter`
(U+E4E5). Stem, beam, dot and half/whole-rest reference geometry uses SVG shapes.

Bravura is by Steinberg Media Technologies GmbH and licensed under the SIL Open
Font License 1.1. The complete notice and license accompany these outlines in
`NOTATION-LICENSE.txt`. Upstream: <https://github.com/steinbergmedia/bravura>.

The source WOFF SHA-256 is
`f685bde197e1b56495284b201f5317e44e28a52d4a741a4553f7b53ac3a41c23`.
Outlines are copied from those glyphs without changing their contours; SVG
translation and uniform scaling compose them with stems and beams.

These are inline vector outlines, with no runtime font or network dependency.
The SVG uses the caller's `currentColor` and transparent hollow noteheads.
The caller supplies accessible labels outside these decorative SVGs.
