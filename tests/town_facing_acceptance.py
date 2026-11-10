"""Shared read-only gates for final native collection browser acceptance."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
MAP = ROOT / 'town/maps/coda-town-uploaded-3.json'
MAP_SHA256 = 'c1eaa096ff14b3a4d2b66ba85a87eb9cfda95027e6d138162c27c8c1e73277b9'
DIRECTIONS = ('south', 'west', 'north', 'east')


def collection_graph():
    base = ROOT / 'town/assets/apartment-collections'
    paths = [base / 'manifest.json', base / 'directions-manifest.json']
    front, sides = [json.loads(p.read_text()) for p in paths]
    owners = front['collections']
    assert len(owners) == 31, f'Expected31 owner collections, got{len(owners)}'
    expected = {}
    for owner in owners:
        assert len(owner['cells']) == 32, owner['owner']
        expected[owner['owner']] = {c.get('id') or 'collection-' + owner['owner'] + '-' + c['slot'] for c in owner['cells']}
        assert len(expected[owner['owner']]) == 32
    assert len(set().union(*expected.values())) == 992
    available = {c['owner']: c for c in sides['collections']}
    missing = []
    for owner, ids in expected.items():
        for direction in DIRECTIONS[1:]:
            view = available.get(owner, {}).get('views', {}).get(direction, {})
            actual = {c.get('id') or 'collection-' + owner + '-' + c['slot'] for c in view.get('cells', [])}
            if actual != ids:
                missing.append({'owner': owner, 'direction': direction, 'missing': sorted(ids - actual), 'unexpected': sorted(actual - ids)})
    assert not missing, 'Final native manifest is incomplete: ' + json.dumps(missing[:8])
    overview = sides.get('overview') or front.get('overview')
    assert overview and overview.get('file'), 'Complete collection overview has not been published'
    assert overview['width'] * overview['height'] <= 4 * 1024 * 1024
    actual_keys = [(c['id'], c.get('facing', c.get('direction', 'south'))) for c in overview['cells']]
    expected_keys = {(asset, direction) for ids in expected.values() for asset in ids for direction in DIRECTIONS}
    assert len(actual_keys) == len(set(actual_keys)) == 3968
    assert set(actual_keys) == expected_keys
    assert hashlib.sha256(MAP.read_bytes()).hexdigest() == MAP_SHA256
    return {'owners': 31, 'assets': 992, 'views': 3968, 'overviewViews': len(actual_keys), 'manifestHashes': {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}}


def assert_frozen(graph):
    assert hashlib.sha256(MAP.read_bytes()).hexdigest() == MAP_SHA256
    for path, before in graph['manifestHashes'].items():
        assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == before, 'Source manifest changed during acceptance: ' + path
