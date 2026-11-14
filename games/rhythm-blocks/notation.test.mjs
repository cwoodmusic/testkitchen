import test from 'node:test';
import assert from 'node:assert/strict';
import {symbolMarkup} from './notation.mjs';

const kinds = ['quarter', 'eighth-pair', 'sixteenth-pair', 'sixteenth-group', 'half', 'eighth', 'quarter-rest', 'half-rest', 'dotted-half'];
const count = (markup, part) => [...markup.matchAll(new RegExp(`data-part="${part}"`, 'g'))].length;

test('all nine symbols are standalone scalable currentColor SVG without font or external requests', () => {
  for (const kind of kinds) {
    const markup = symbolMarkup(kind);
    assert.match(markup, /^<svg /);
    assert.match(markup, /viewBox="0 0 64 64"/);
    assert.match(markup, /aria-hidden="true"/);
    assert.match(markup, /focusable="false"/);
    assert.match(markup, /fill="currentColor"/);
    assert.doesNotMatch(markup, /<(?:text|image|script|style)\b|href=|url\(/);
    assert.doesNotMatch(markup, /fill="(?:white|black|#)/);
  }
});

test('beamed groups represent the requested number of attacks and beam levels', () => {
  const pair = symbolMarkup('eighth-pair');
  assert.equal(count(pair, 'notehead'), 2);
  assert.equal(count(pair, 'stem'), 2);
  assert.equal(count(pair, 'beam'), 1);
  assert.equal(count(pair, 'flag'), 0);
  const sixteenthPair = symbolMarkup('sixteenth-pair');
  assert.equal(count(sixteenthPair, 'notehead'), 2);
  assert.equal(count(sixteenthPair, 'stem'), 2);
  assert.equal(count(sixteenthPair, 'beam'), 2);
  assert.equal(count(sixteenthPair, 'flag'), 0);
  assert.notEqual(sixteenthPair, pair, 'Two sixteenths need a second beam; two eighths keep one.');
  const sixteenths = symbolMarkup('sixteenth-group');
  assert.equal(count(sixteenths, 'notehead'), 4);
  assert.equal(count(sixteenths, 'stem'), 4);
  assert.equal(count(sixteenths, 'beam'), 2);
  assert.equal(count(sixteenths, 'flag'), 0);
});

test('single note values retain hollow heads, stems, flags and a separate augmentation dot', () => {
  assert.equal(count(symbolMarkup('eighth'), 'flag'), 1);
  assert.equal(count(symbolMarkup('eighth'), 'notehead'), 1);
  assert.equal(count(symbolMarkup('quarter'), 'flag'), 0);
  assert.match(symbolMarkup('quarter'), /data-hollow="false"/);
  for (const kind of ['half', 'dotted-half']) assert.match(symbolMarkup(kind), /data-hollow="true"/);
  assert.equal(count(symbolMarkup('half'), 'stem'), 1);
  assert.equal(count(symbolMarkup('dotted-half'), 'augmentation-dot'), 1);
  assert.equal(count(symbolMarkup('half'), 'augmentation-dot'), 0);
});

test('half rest sits above its reference line and quarter rest keeps its engraved outline', () => {
  const markup = symbolMarkup('half-rest');
  assert.match(markup, /d="M14 33H50"/);
  assert.match(markup, /data-part="rest-block" x="22" y="24" width="20" height="9"/);
  assert.equal(count(markup, 'notehead'), 0);
  assert.equal(count(symbolMarkup('quarter-rest'), 'quarter-rest'), 1);
  assert.equal(count(symbolMarkup('quarter-rest'), 'notehead'), 0);
});

test('removed whole values and unknown or hostile IDs cannot become inline markup', () => {
  for (const value of ['whole', 'whole-rest', 'sixteenth', '', '__proto__', '<script>alert(1)</script>', null, undefined]) {
    assert.throws(() => symbolMarkup(value), RangeError);
  }
});
