/** Permanent, local discoveries for The Quiet Bell. No run inventory is kept here. */

const freezeRecords = records => Object.freeze(records.map(record => Object.freeze(record)));

// This catalog describes only the playable opening. Arrival scenes are not endings.
export const OPENING_JOURNEY_MANIFEST = Object.freeze({
  completionReady: false,
  nodes: freezeRecords([
    {id: 'depot', title: 'The Parcel Depot'},
    {id: 'garden-porch', title: 'Iris’s Garden Porch'},
    {id: 'workshop-porch', title: 'Pip’s Bird Workshop'},
    {id: 'canal-porch', title: 'The Canal Storehouse'},
  ]),
  edges: freezeRecords([
    {id: 'depot-garden', from: 'depot', to: 'garden-porch'},
    {id: 'depot-workshop', from: 'depot', to: 'workshop-porch'},
    {id: 'depot-canal', from: 'depot', to: 'canal-porch'},
  ]),
  hints: freezeRecords([
    {
      id: 'nell-route', title: 'Nell · The canal lock',
      text: 'The blue canal door has the ferry keeper’s lock. Choose that door, then play a half note, a quarter note, and paired eighths, in that order. You will need the half note from the chest.',
    },
    {
      id: 'iris-route', title: 'Iris · The garden lock',
      text: 'The ivy-covered garden door asks for two quiet beats followed by two sounding beats: a half rest, then a half note. Choose its lock before arranging that answer. The order matters.',
    },
    {
      id: 'pip-route', title: 'Pip · The workshop lock',
      text: 'Choose the gear-marked workshop door. Its lock wants a half note first, then paired eighths, then four sixteenths. Three tiles, four beats, and little footsteps that grow quicker.',
    },
  ]),
  outcomes: Object.freeze([]),
});

const COMPLETE_SCORE = Object.freeze({id: 'complete-score', title: 'The Complete Score'});
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const isText = value => typeof value === 'string' && value.trim().length > 0;
const isId = value => isText(value) && value === value.trim();

function compileManifest(manifest) {
  if (!isRecord(manifest) || typeof manifest.completionReady !== 'boolean') {
    throw new TypeError('Journey manifest requires a boolean completionReady.');
  }
  const fields = {
    nodes: ['id', 'title'], edges: ['id', 'from', 'to'],
    hints: ['id', 'title', 'text'], outcomes: ['id', 'title'],
  };
  const catalog = {};
  for (const [category, keys] of Object.entries(fields)) {
    if (!Array.isArray(manifest[category])) throw new TypeError(`Journey manifest requires ${category}.`);
    const entries = new Map();
    for (const entry of manifest[category]) {
      if (!isRecord(entry) || !keys.every(key => key === 'title' || key === 'text' ? isText(entry[key]) : isId(entry[key]))) {
        throw new TypeError(`Journey manifest has an invalid ${category} entry.`);
      }
      if (entries.has(entry.id)) throw new TypeError(`Journey manifest has a duplicate ${category} id.`);
      entries.set(entry.id, Object.freeze(Object.fromEntries(keys.map(key => [key, entry[key]]))));
    }
    catalog[category] = entries;
  }
  for (const edge of catalog.edges.values()) {
    if (!catalog.nodes.has(edge.from) || !catalog.nodes.has(edge.to)) {
      throw new TypeError('Journey edge endpoints must be declared nodes.');
    }
  }
  return {...catalog, completionReady: manifest.completionReady};
}

/**
 * Saved records contain observed IDs only; labels and connections always come from
 * the trusted manifest. Calling code records discoveries after actual game events.
 */
export function createJourney({saved, manifest = OPENING_JOURNEY_MANIFEST} = {}) {
  const catalog = compileManifest(manifest);
  const observed = Object.fromEntries(['nodes', 'edges', 'hints', 'outcomes'].map(key => [key, new Set()]));

  function record(category, id) {
    if (typeof id !== 'string' || !catalog[category].has(id) || observed[category].has(id)) return false;
    observed[category].add(id);
    return true;
  }
  function traverse(id) {
    if (typeof id !== 'string' || !catalog.edges.has(id)) return false;
    const edge = catalog.edges.get(id);
    const changed = record('edges', id);
    record('nodes', edge.from);
    record('nodes', edge.to);
    return changed;
  }

  if (isRecord(saved) && saved.version === 1) {
    for (const category of Object.keys(observed)) {
      if (!Array.isArray(saved[category])) continue;
      for (const id of saved[category]) {
        if (category === 'edges') traverse(id);
        else record(category, id);
      }
    }
  }

  const ids = category => [...catalog[category].keys()].filter(id => observed[category].has(id));
  const entries = category => Object.freeze(ids(category).map(id => catalog[category].get(id)));
  // An unfinished catalog, or a catalog without actual rooms, trails and outcomes,
  // cannot award a lifetime completion achievement through an empty comparison.
  const complete = () => catalog.completionReady
    && ['nodes', 'edges', 'outcomes'].every(category => catalog[category].size > 0
      && observed[category].size === catalog[category].size);

  return Object.freeze({
    visit: id => record('nodes', id),
    traverse,
    discoverHint: id => record('hints', id),
    recordOutcome: id => record('outcomes', id),
    get complete() { return complete(); },
    get state() {
      return Object.freeze({
        nodes: entries('nodes'), edges: entries('edges'), hints: entries('hints'), outcomes: entries('outcomes'),
        achievements: Object.freeze(complete() ? [COMPLETE_SCORE] : []),
      });
    },
    serialize() {
      return {version: 1, nodes: ids('nodes'), edges: ids('edges'), hints: ids('hints'), outcomes: ids('outcomes')};
    },
  });
}
