import test from 'node:test';
import assert from 'node:assert/strict';
import {createJourney, OPENING_JOURNEY_MANIFEST, CHAPTER_JOURNEY_MANIFEST} from './journey.mjs';
import {PEOPLE} from './opening.mjs';
import {CHAPTER_LORE, ROOM_CONTENT} from './chapter-content.mjs';
import {PARTY_ROUTE_HINTS} from './party-content.mjs';
import {CHAPTER_ROOMS, CHAPTER_DOORS, CHAPTER_PREVIEWS, CHAPTER_TERMINALS} from './chapter.mjs';

const manifest = () => ({
  completionReady: true,
  nodes: [{id: 'start', title: 'Start'}, {id: 'garden', title: 'Garden'}, {id: 'canal', title: 'Canal'}, {id: 'hidden', title: 'Hidden room'}],
  edges: [{id: 'start-garden', from: 'start', to: 'garden'}, {id: 'start-canal', from: 'start', to: 'canal'}, {id: 'garden-canal', from: 'garden', to: 'canal'}],
  hints: [{id: 'garden-hint', title: 'A gardener’s clue', text: 'Listen for a breath.'}, {id: 'canal-hint', title: 'A canal clue', text: 'Follow the steady beat.'}],
  outcomes: [{id: 'home', title: 'Home'}, {id: 'school', title: 'School'}],
});
const discoverAll = journey => {
  for (const node of manifest().nodes) journey.visit(node.id);
  for (const edge of manifest().edges) journey.traverse(edge.id);
  for (const outcome of manifest().outcomes) journey.recordOutcome(outcome.id);
  return journey;
};

test('the opening catalog contains real arrivals and trusted route clues, with no endings', () => {
  const journey = createJourney();
  assert.deepEqual(journey.state, {nodes: [], edges: [], hints: [], outcomes: [], achievements: []});
  assert.deepEqual(OPENING_JOURNEY_MANIFEST.edges, [
    {id: 'depot-garden', from: 'depot', to: 'garden-porch'},
    {id: 'depot-workshop', from: 'depot', to: 'workshop-porch'},
    {id: 'depot-canal', from: 'depot', to: 'canal-porch'},
  ]);
  assert.deepEqual(OPENING_JOURNEY_MANIFEST.outcomes, []);
  for (const person of PEOPLE) {
    const hint = OPENING_JOURNEY_MANIFEST.hints.find(hint => hint.id === `${person.id}-route`);
    assert.equal(hint.text, person.route);
  }
  assert(Object.isFrozen(OPENING_JOURNEY_MANIFEST));
  assert(Object.isFrozen(OPENING_JOURNEY_MANIFEST.nodes));
  assert(Object.isFrozen(OPENING_JOURNEY_MANIFEST.hints[0]));
});

test('visited endpoints reveal no connection until that particular edge was traversed', () => {
  const journey = createJourney({manifest: manifest()});
  for (const id of ['start', 'garden', 'canal']) assert.equal(journey.visit(id), true);
  assert.deepEqual(journey.state.edges, []);
  assert.equal(journey.traverse('start-garden'), true);
  assert.deepEqual(journey.state.edges, [{id: 'start-garden', from: 'start', to: 'garden'}]);
  assert.equal(journey.state.nodes.some(node => node.id === 'hidden'), false);
  assert.equal(JSON.stringify(journey.state).includes('start-canal'), false);
  assert.equal(JSON.stringify(journey.state).includes('garden-canal'), false);
});

test('traversal records its two endpoints but no other room or trail', () => {
  const journey = createJourney({manifest: manifest()});
  assert.equal(journey.traverse('start-canal'), true);
  assert.deepEqual(journey.state.nodes, [{id: 'start', title: 'Start'}, {id: 'canal', title: 'Canal'}]);
  assert.deepEqual(journey.state.edges, [{id: 'start-canal', from: 'start', to: 'canal'}]);
});

test('permanent discoveries accumulate across reloads and duplicate events are harmless', () => {
  const first = createJourney({manifest: manifest()});
  assert.equal(first.traverse('start-garden'), true);
  assert.equal(first.discoverHint('garden-hint'), true);
  assert.equal(first.recordOutcome('home'), true);
  const saved = JSON.parse(JSON.stringify(first.serialize()));
  assert.deepEqual(saved, {version: 1, nodes: ['start', 'garden'], edges: ['start-garden'], hints: ['garden-hint'], outcomes: ['home']});
  const next = createJourney({manifest: manifest(), saved});
  assert.deepEqual(next.state, first.state);
  for (let i = 0; i < 3; i++) {
    assert.equal(next.visit('garden'), false);
    assert.equal(next.traverse('start-garden'), false);
    assert.equal(next.discoverHint('garden-hint'), false);
    assert.equal(next.recordOutcome('home'), false);
  }
  next.traverse('start-canal');
  assert.equal(next.state.nodes.length, 3);
  assert.equal(next.state.edges.length, 2);
  assert.equal(first.state.edges.length, 1);
  assert.deepEqual(next.state.hints, first.state.hints);
  assert.deepEqual(next.state.outcomes, first.state.outcomes);
});

test('saved IDs are filtered and all display data comes from the manifest', () => {
  const journey = createJourney({manifest: manifest(), saved: {
    version: 1,
    nodes: ['start', 'unknown', {id: 'hidden', title: 'Spoofed'}],
    edges: ['start-canal', 'future-trail', {id: 'garden-canal', from: 'start', to: 'hidden'}],
    hints: ['garden-hint', 'spoiler', {id: 'canal-hint', text: 'Spoofed'}],
    outcomes: ['home', 'future-ending', {id: 'school', title: 'Spoofed'}],
    achievements: [{id: 'complete-score', title: 'Spoofed'}],
  }});
  assert.deepEqual(journey.state.nodes, [{id: 'start', title: 'Start'}, {id: 'canal', title: 'Canal'}]);
  assert.deepEqual(journey.state.edges, [{id: 'start-canal', from: 'start', to: 'canal'}]);
  assert.deepEqual(journey.state.hints, [manifest().hints[0]]);
  assert.deepEqual(journey.state.outcomes, [manifest().outcomes[0]]);
  assert.deepEqual(journey.state.achievements, []);
  assert.equal(JSON.stringify(journey.state).includes('Spoofed'), false);
});

test('malformed or incompatible save records disclose nothing', () => {
  const bad = [null, [], 1, 'journal', true, {version: 2, nodes: ['start']}, {nodes: ['start']},
    {version: '1', nodes: ['start']}, {version: 1, nodes: 'start', edges: {}, hints: null, outcomes: 2}];
  for (const saved of bad) {
    const journey = createJourney({manifest: manifest(), saved});
    assert.deepEqual(journey.state, {nodes: [], edges: [], hints: [], outcomes: [], achievements: []});
  }
  const journey = createJourney({manifest: manifest(), saved: {version: 1, edges: ['start-garden']}});
  assert.deepEqual(journey.serialize().nodes, ['start', 'garden']);
  assert.deepEqual(journey.serialize().edges, ['start-garden']);
});

test('unknown event IDs never create discoveries or expose catalog entries', () => {
  const journey = createJourney({manifest: manifest()});
  for (const id of ['future', '__proto__', 'constructor', null, {}, 1, undefined, ['start'], ' start ']) {
    assert.equal(journey.visit(id), false);
    assert.equal(journey.traverse(id), false);
    assert.equal(journey.discoverHint(id), false);
    assert.equal(journey.recordOutcome(id), false);
  }
  assert.deepEqual(journey.serialize(), {version: 1, nodes: [], edges: [], hints: [], outcomes: []});
});

test('only explicitly discovered clues appear in state and save data', () => {
  const journey = createJourney({manifest: manifest()});
  journey.traverse('start-garden');
  assert.deepEqual(journey.state.hints, []);
  assert.equal(journey.discoverHint('garden-hint'), true);
  assert.deepEqual(journey.state.hints, [manifest().hints[0]]);
  assert.deepEqual(journey.serialize().hints, ['garden-hint']);
  assert.equal(JSON.stringify(journey.state).includes('Follow the steady beat.'), false);
});

test('state snapshots are deeply frozen and remain unchanged after later discoveries', () => {
  const journey = createJourney({manifest: manifest()});
  journey.traverse('start-garden');
  journey.discoverHint('garden-hint');
  journey.recordOutcome('home');
  const before = journey.state;
  for (const collection of Object.values(before)) {
    assert(Object.isFrozen(collection));
    for (const item of collection) assert(Object.isFrozen(item));
    assert.throws(() => collection.push({id: 'hidden'}), TypeError);
  }
  assert(Object.isFrozen(before));
  assert.throws(() => { before.nodes[0].title = 'Spoofed'; }, TypeError);
  assert.throws(() => { before.hints[0].text = 'Spoofed'; }, TypeError);
  journey.traverse('start-canal');
  assert.equal(before.nodes.length, 2);
  assert.equal(journey.state.nodes.length, 3);
  const saved = journey.serialize();
  saved.nodes.push('hidden');
  saved.edges.length = 0;
  assert.equal(journey.state.nodes.some(node => node.id === 'hidden'), false);
  assert.equal(journey.state.edges.length, 2);
});

test('caller mutation of the supplied manifest cannot alter the compiled catalog', () => {
  const source = manifest();
  const journey = createJourney({manifest: source});
  source.nodes[0].title = 'Spoofed';
  source.edges[0].to = 'hidden';
  source.hints[0].text = 'Spoofed';
  source.outcomes[0].title = 'Spoofed';
  source.nodes.push({id: 'later', title: 'Later'});
  source.completionReady = false;
  journey.traverse('start-garden');
  journey.discoverHint('garden-hint');
  journey.recordOutcome('home');
  assert.deepEqual(journey.state.nodes, [{id: 'start', title: 'Start'}, {id: 'garden', title: 'Garden'}]);
  assert.equal(journey.state.hints[0].text, 'Listen for a breath.');
  assert.equal(journey.state.outcomes[0].title, 'Home');
  assert.equal(journey.visit('later'), false);
  discoverAll(journey);
  assert.equal(journey.complete, true);
});

test('the opening cannot award completion after every available trail and clue', () => {
  const journey = createJourney();
  for (const node of OPENING_JOURNEY_MANIFEST.nodes) journey.visit(node.id);
  for (const edge of OPENING_JOURNEY_MANIFEST.edges) journey.traverse(edge.id);
  for (const hint of OPENING_JOURNEY_MANIFEST.hints) journey.discoverHint(hint.id);
  assert.equal(journey.complete, false);
  assert.deepEqual(journey.state.achievements, []);
  assert.deepEqual(journey.state.outcomes, []);
});

test('completionReady false blocks the award even for a fully observed ending catalog', () => {
  const source = manifest();
  source.completionReady = false;
  const journey = discoverAll(createJourney({manifest: source}));
  assert.equal(journey.complete, false);
  assert.deepEqual(journey.state.achievements, []);
});

test('the ultimate award independently requires every node, trail and outcome, but not every clue', () => {
  for (const category of ['nodes', 'edges', 'outcomes']) {
    const source = manifest();
    const last = source[category].at(-1).id;
    const saved = {version: 1, nodes: source.nodes.map(node => node.id), edges: source.edges.map(edge => edge.id), hints: [], outcomes: source.outcomes.map(outcome => outcome.id)};
    saved[category] = saved[category].filter(id => id !== last);
    const journey = createJourney({manifest: source, saved});
    assert.equal(journey.complete, false, `missing ${category}`);
    assert.deepEqual(journey.state.achievements, []);
    const action = {nodes: 'visit', edges: 'traverse', outcomes: 'recordOutcome'}[category];
    assert.equal(journey[action](last), true);
    assert.equal(journey.complete, true);
    assert.deepEqual(journey.state.hints, []);
    assert.deepEqual(journey.state.achievements, [{id: 'complete-score', title: 'The Complete Score'}]);
    assert.equal(createJourney({manifest: source, saved: journey.serialize()}).complete, true);
    assert(Object.isFrozen(journey.state.achievements[0]));
  }
});

test('completion cannot be awarded from empty room, trail or outcome comparisons', () => {
  for (const source of [
    {completionReady: true, nodes: [], edges: [], hints: [], outcomes: []},
    {completionReady: true, nodes: [{id: 'only', title: 'Only'}], edges: [], hints: [], outcomes: [{id: 'end', title: 'End'}]},
    {...manifest(), outcomes: []},
  ]) {
    const journey = createJourney({manifest: source});
    for (const node of source.nodes) journey.visit(node.id);
    for (const edge of source.edges) journey.traverse(edge.id);
    for (const outcome of source.outcomes) journey.recordOutcome(outcome.id);
    assert.equal(journey.complete, false);
  }
});

test('invalid trusted manifests fail early instead of silently exposing malformed content', () => {
  const bad = [null, [], {}, {...manifest(), completionReady: undefined}, {...manifest(), completionReady: 'true'},
    {...manifest(), nodes: null}, {...manifest(), edges: {}}, {...manifest(), hints: 'clue'}, {...manifest(), outcomes: false},
    {...manifest(), nodes: [...manifest().nodes, {id: 'start', title: 'Duplicate'}]},
    {...manifest(), edges: [...manifest().edges, {id: 'start-garden', from: 'start', to: 'canal'}]},
    {...manifest(), hints: [...manifest().hints, {id: 'garden-hint', title: 'Duplicate', text: 'Duplicate'}]},
    {...manifest(), outcomes: [...manifest().outcomes, {id: 'home', title: 'Duplicate'}]},
    {...manifest(), edges: [{id: 'broken', from: 'start', to: 'unknown'}]},
    {...manifest(), edges: [{id: 'broken', from: 'unknown', to: 'start'}]},
    {...manifest(), hints: [{id: 'bad', title: 'Missing text'}]},
    {...manifest(), nodes: [{id: ' ', title: 'Invalid ID'}]},
    {...manifest(), outcomes: [{id: 'end', title: ''}]},
  ];
  for (const source of bad) assert.throws(() => createJourney({manifest: source}), TypeError);
});

test('the chapter catalog follows all shipped rooms and keys but excludes future routes', () => {
  const source = CHAPTER_JOURNEY_MANIFEST;
  assert.equal(source.completionReady, false);
  assert.deepEqual(source.nodes, [...Object.values(CHAPTER_ROOMS), ...Object.values(CHAPTER_PREVIEWS),
    ...Object.values(CHAPTER_TERMINALS)].map(({id, title}) => ({id, title})));
  assert.equal(source.nodes.length, 10);
  assert.deepEqual(source.edges, Object.values(CHAPTER_DOORS).map(door => ({
    id: door.canonicalId, from: door.from, to: door.to,
  })));
  assert.equal(source.edges.length, 9);
  assert.deepEqual(source.outcomes.map(outcome => outcome.id), ['dead-brambles', 'dead-aviary', 'dead-ferry']);
  assert.equal(source.hints.length, 27);
  for (const hint of PARTY_ROUTE_HINTS) assert.deepEqual(source.hints.find(entry => entry.id === hint.id), hint);
  assert.deepEqual(source.hints.slice(0, OPENING_JOURNEY_MANIFEST.hints.length), OPENING_JOURNEY_MANIFEST.hints);
  for (const observation of CHAPTER_LORE) {
    assert.deepEqual(source.hints.find(hint => hint.id === `lore-${observation.id}`), {
      id: `lore-${observation.id}`, title: observation.title, text: observation.text,
    });
  }
  for (const [roomId, room] of Object.entries(ROOM_CONTENT).filter(([id]) => id !== 'depot')) {
    for (const person of room.people) {
      assert.equal(source.hints.find(hint => hint.id === `${roomId}-${person.id}-route`).text, person.route);
    }
  }
  for (const collection of ['nodes', 'edges', 'hints', 'outcomes']) {
    assert.equal(new Set(source[collection].map(entry => entry.id)).size, source[collection].length);
    assert(Object.isFrozen(source[collection]));
    source[collection].forEach(entry => assert(Object.isFrozen(entry)));
  }
  assert.equal(createJourney({manifest: source}).visit('garden-alcove'), false);
  assert.equal(createJourney({manifest: source}).traverse('garden-secret-branch'), false);
});

test('a porch clue or inspection reveals no new room, trail or ending', () => {
  const journey = createJourney({manifest: CHAPTER_JOURNEY_MANIFEST});
  journey.traverse('depot-garden');
  assert.equal(journey.discoverHint('garden-porch-iris-route'), true);
  assert.equal(journey.discoverHint('lore-garden-porch-second-cup'), true);
  assert.deepEqual(journey.serialize(), {
    version: 1, nodes: ['depot', 'garden-porch'], edges: ['depot-garden'],
    hints: ['garden-porch-iris-route', 'lore-garden-porch-second-cup'], outcomes: [],
  });
  const state = JSON.stringify(journey.state);
  for (const hidden of ['garden-fork', 'workshop-porch', 'canal-porch', 'garden-porch-forward', 'dead-brambles']) {
    assert.equal(state.includes(`"${hidden}"`), false);
  }
});

test('a reached continuation preview is a chart destination without an ending award', () => {
  const journey = createJourney({manifest: CHAPTER_JOURNEY_MANIFEST});
  journey.traverse('depot-workshop');
  journey.traverse('workshop-porch-forward');
  assert.deepEqual(journey.serialize().nodes, ['depot', 'workshop-porch', 'workshop-fork']);
  assert.deepEqual(journey.serialize().edges, ['depot-workshop', 'workshop-porch-forward']);
  assert.equal(journey.recordOutcome('workshop-fork'), false);
  assert.deepEqual(journey.state.outcomes, []);
  assert.deepEqual(journey.state.achievements, []);
  assert.equal(journey.complete, false);
  assert.equal(JSON.stringify(journey.state).includes('workshop-secret-branch'), false);
});

test('only an explicitly observed dead end enters outcomes and survives a reload', () => {
  const first = createJourney({manifest: CHAPTER_JOURNEY_MANIFEST});
  first.traverse('depot-canal');
  first.traverse('canal-porch-dead');
  assert.deepEqual(first.state.outcomes, []);
  assert.equal(first.recordOutcome('dead-ferry'), true);
  assert.equal(first.recordOutcome('dead-ferry'), false);
  assert.deepEqual(first.state.outcomes, [{id: 'dead-ferry', title: 'The Empty Ferry'}]);
  const next = createJourney({manifest: CHAPTER_JOURNEY_MANIFEST, saved: JSON.parse(JSON.stringify(first.serialize()))});
  assert.deepEqual(next.state, first.state);
  next.traverse('depot-garden');
  next.traverse('garden-porch-dead');
  next.recordOutcome('dead-brambles');
  assert.deepEqual(next.serialize().outcomes, ['dead-brambles', 'dead-ferry']);
  assert.deepEqual(first.serialize().outcomes, ['dead-ferry']);
  assert.equal(next.state.nodes.some(node => node.id === 'dead-aviary'), false);
});

test('opening discoveries migrate into the expanded catalog without revealing other branches', () => {
  const opening = createJourney();
  opening.traverse('depot-garden');
  opening.discoverHint('iris-route');
  opening.discoverHint('lore-route-orrery');
  const chapter = createJourney({manifest: CHAPTER_JOURNEY_MANIFEST, saved: opening.serialize()});
  assert.deepEqual(chapter.state, opening.state);
  chapter.discoverHint('garden-porch-iris-route');
  chapter.traverse('garden-porch-forward');
  assert.deepEqual(chapter.serialize().nodes, ['depot', 'garden-porch', 'garden-fork']);
  assert.deepEqual(chapter.serialize().edges, ['depot-garden', 'garden-porch-forward']);
  assert.deepEqual(chapter.serialize().hints, ['iris-route', 'lore-route-orrery', 'garden-porch-iris-route']);
  assert.deepEqual(chapter.state.outcomes, []);
});

test('the chapter ignores future and forged saved IDs while restoring only known observations', () => {
  const journey = createJourney({manifest: CHAPTER_JOURNEY_MANIFEST, saved: {
    version: 1,
    nodes: ['depot', 'garden-alcove', {id: 'garden-fork', title: 'Invented'}],
    edges: ['depot-canal', 'canal-secret', {id: 'canal-porch-forward'}],
    hints: ['lore-canal-porch-mooring-bell', 'garden-alcove-secret', {id: 'garden-porch-iris-route'}],
    outcomes: ['dead-ferry', 'all-four-together', 'canal-fork', {id: 'dead-brambles'}],
    achievements: ['complete-score'],
  }});
  assert.deepEqual(journey.serialize(), {
    version: 1, nodes: ['depot', 'canal-porch'], edges: ['depot-canal'],
    hints: ['lore-canal-porch-mooring-bell'], outcomes: ['dead-ferry'],
  });
  assert.equal(JSON.stringify(journey.state).includes('Invented'), false);
  assert.deepEqual(journey.state.achievements, []);
});

test('observing every shipped boundary cannot complete the unfinished dungeon', () => {
  const source = CHAPTER_JOURNEY_MANIFEST;
  const journey = createJourney({manifest: source});
  source.nodes.forEach(node => journey.visit(node.id));
  source.edges.forEach(edge => journey.traverse(edge.id));
  source.hints.forEach(hint => journey.discoverHint(hint.id));
  source.outcomes.forEach(outcome => journey.recordOutcome(outcome.id));
  assert.equal(journey.state.nodes.length, 10);
  assert.equal(journey.state.edges.length, 9);
  assert.equal(journey.state.outcomes.length, 3);
  assert.equal(journey.complete, false);
  assert.deepEqual(journey.state.achievements, []);
  assert.equal(createJourney({manifest: source, saved: journey.serialize()}).complete, false);
});

test('companion conversations preserve only learned route clues across reloads', () => {
  const journey = createJourney({manifest: CHAPTER_JOURNEY_MANIFEST});
  journey.visit('depot');
  journey.traverse('depot-canal');
  const before = journey.serialize();
  for (const hint of PARTY_ROUTE_HINTS.filter(entry => entry.id.startsWith('canal-porch-'))) {
    assert.equal(journey.discoverHint(hint.id), true);
    assert.equal(journey.discoverHint(hint.id), false);
  }
  assert.deepEqual(journey.serialize().nodes, before.nodes);
  assert.deepEqual(journey.serialize().edges, before.edges);
  assert.deepEqual(journey.serialize().outcomes, before.outcomes);
  assert.deepEqual(journey.state.achievements, []);
  const restored = createJourney({manifest: CHAPTER_JOURNEY_MANIFEST, saved: journey.serialize()});
  assert.deepEqual(restored.state, journey.state);
  assert.equal(restored.state.hints.length, 3);
  assert(restored.state.hints.every(hint => hint.id.startsWith('canal-porch-')));
});
