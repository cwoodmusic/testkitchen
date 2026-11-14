/**
 * Self-contained musical engraving for Rhythm Blocks.
 * Bravura outlines: noteheadWhole E0A2, noteheadHalf E0A3,
 * noteheadBlack E0A4, flag8thUp E240 and restQuarter E4E5.
 * Copyright Steinberg Media Technologies GmbH; SIL OFL 1.1.
 * See NOTATION-LICENSE.txt and NOTATION-SOURCES.md. No font is loaded at runtime.
 */

const BLACK_HEAD = 'M97 -125C186 -125 295 -43 295 42C295 93 255 125 198 125C88 125 0 44 0 -42C0 -94 43 -125 97 -125Z';
const HALF_HEAD = 'M97 -125C262 -125 295 9 295 42C295 93 254 125 196 125C47 125 0 10 0 -42C0 -95 42 -125 97 -125ZM173 -46C128 -76 97 -87 75 -87C54 -87 42 -76 35 -64C32 -58 29 -51 29 -44C29 -22 51 5 120 45C170 74 201 84 221 84C240 84 251 75 258 63C261 57 264 51 264 44C264 24 243 0 173 -46Z';
const WHOLE_HEAD = 'M216 125C83 125 0 70 0 2C0 -65 57 -125 206 -125C370 -125 422 -68 422 2C422 73 309 125 216 125ZM111 63C122 98 159 103 190 103C259 103 314 29 314 -31C314 -38 313 -44 312 -50C307 -75 293 -92 268 -98C258 -101 247 -102 237 -102C228 -102 220 -101 211 -98C194 -93 178 -84 164 -72C156 -65 149 -58 143 -50C123 -27 108 7 108 39C108 47 109 55 111 63Z';
const EIGHTH_FLAG = 'M238 -790C238 -790 264 -695 264 -617C264 -492 212 -374 149 -274C98 -195 56 -109 40 -13C37 3 29 9 19 9C8 9 0 6 0 -6V-245C66 -257 161 -393 197 -478C212 -512 221 -569 221 -628C221 -673 214 -720 197 -765C195 -771 194 -776 194 -780C194 -796 204 -805 210 -809C211 -810 213 -810 215 -810C222 -810 234 -804 238 -790Z';
const QUARTER_REST = 'M78 -38C94 -58 108 -77 121 -98C123 -102 127 -110 127 -112C127 -113 127 -115 126 -116C124 -120 120 -121 115 -121C111 -121 103 -119 99 -118C94 -118 88 -115 83 -115C40 -115 1 -158 1 -211C1 -261 44 -310 117 -366C125 -372 135 -375 143 -375C150 -375 157 -373 158 -369C159 -366 160 -364 160 -362C160 -353 152 -345 144 -338C131 -338 120 -311 118 -302C115 -294 114 -285 114 -276C114 -245 129 -210 161 -204C166 -203 171 -203 177 -203C206 -203 239 -214 255 -220C256 -220 257 -221 258 -221C261 -222 263 -222 265 -222C268 -222 270 -221 270 -218C270 -206 244 -173 233 -161C195 -115 164 -78 164 -22C164 -18 165 -13 165 -9C169 49 205 97 231 138C234 143 235 148 235 153C235 163 231 172 231 172C231 172 83 348 66 365C61 370 54 373 48 373C38 373 28 366 28 352C28 347 29 342 32 336C36 325 93 274 93 202C93 165 78 122 33 75C23 65 19 54 19 46C19 32 29 22 29 22Z';

function head(x, y, scale = .07, hollow = false) {
  return `<path data-part="notehead" data-hollow="${hollow}" d="${hollow ? HALF_HEAD : BLACK_HEAD}" transform="translate(${x} ${y}) scale(${scale} -${scale})"/>`;
}

function stem(x, top = 12, bottom = 45, width = 3) {
  return `<rect data-part="stem" x="${x - width / 2}" y="${top}" width="${width}" height="${bottom - top}"/>`;
}

function beam(x, y, width, height = 6) {
  return `<rect data-part="beam" x="${x}" y="${y}" width="${width}" height="${height}"/>`;
}

function restBlock(hangs) {
  // The shared reference line makes the otherwise similar rest blocks distinct.
  const y = hangs ? 33 : 24;
  return `<path data-part="rest-line" d="M14 33H50" fill="none" stroke="currentColor" stroke-width="2.5"/><rect data-part="rest-block" x="22" y="${y}" width="20" height="9"/>`;
}

const single = stem(36) + head(17, 47);
const half = stem(36) + head(17, 47, .07, true);
const symbols = new Map([
  ['quarter', single],
  ['eighth-pair',
    stem(21, 14, 45, 2.8) + stem(51, 14, 45, 2.8) +
    beam(19.6, 14, 32.8, 6.5) + head(7, 47, .05) + head(37, 47, .05)],
  ['sixteenth-group',
    [12, 27, 42, 57].map(x => stem(x, 13, 47, 2.5)).join('') +
    beam(10.75, 13, 47.5) + beam(10.75, 24, 47.5, 5.5) +
    [1.2, 16.2, 31.2, 46.2].map(x => head(x, 49, .038)).join('')],
  ['half', half],
  ['whole', `<path data-part="notehead" data-hollow="true" d="${WHOLE_HEAD}" transform="translate(17.23 34) scale(.07 -.07)"/>`],
  ['eighth', single + `<path data-part="flag" d="${EIGHTH_FLAG}" transform="translate(34.5 12) scale(.038 -.038)"/>`],
  ['quarter-rest', `<path data-part="quarter-rest" d="${QUARTER_REST}" transform="translate(23.46 32) scale(.063 -.063)"/>`],
  ['half-rest', restBlock(false)],
  ['whole-rest', restBlock(true)],
  ['dotted-half', stem(32) + head(13, 47, .07, true) + '<circle data-part="augmentation-dot" cx="46" cy="47" r="3.5"/>'],
]);

/** Trusted inline SVG for a known kind. The caller owns labels, color and size. */
export function symbolMarkup(kind) {
  if (!symbols.has(kind)) throw new RangeError('Unknown rhythm symbol: ' + String(kind));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false" fill="currentColor">${symbols.get(kind)}</svg>`;
}
