"""Resolve explicit accepted-art revisions without silently replacing a view."""
from collections import defaultdict
from pathlib import Path
import hashlib
import json
from PIL import Image

NATIVE_FIELDS = ('file', 'width', 'height', 'x', 'y', 'w', 'h')


def pixel_digest(root, patch):
    with Image.open(root / patch['file']) as image:
        assert image.size == (patch['width'], patch['height'])
        x, y, w, h = (patch[k] for k in ('x', 'y', 'w', 'h'))
        assert min(x, y) >= 0 and min(w, h) > 0 and x+w <= image.width and y+h <= image.height
        crop = image.convert('RGBA').crop((x, y, x+w, y+h))
        return hashlib.sha256(f'{w},{h}:'.encode() + crop.tobytes()).hexdigest()


def accepted_patches(root):
    root = Path(root)
    claims = defaultdict(list)
    inputs = []
    for path in sorted(root.glob('*-patches.json')):
        data = path.read_bytes()
        envelope = json.loads(data)
        rows = envelope if isinstance(envelope, list) else envelope['patches']
        revision = 1 if isinstance(envelope, list) else envelope.get('revision', 1)
        if type(revision) is not int or revision < 1:
            raise ValueError('Invalid accepted-art revision: ' + path.name)
        inputs.append({'file': path.name, 'sha256': hashlib.sha256(data).hexdigest(), 'count': len(rows), 'revision': revision})
        for row in rows:
            key = (row['id'], row.get('facing', 'south'))
            claims[key].append((revision, path.name, row))
    result = []
    for key, versions in claims.items():
        versions.sort(key=lambda v: v[0])
        for old, new in zip(versions, versions[1:]):
            old_revision, old_file, previous = old
            revision, new_file, replacement = new
            if revision == old_revision:
                raise ValueError(f'Duplicate accepted-art view at revision {revision}: {key}')
            proof = replacement.get('supersedes')
            expected = {k: previous[k] for k in NATIVE_FIELDS}
            if not isinstance(proof, dict) or proof.get('revision') != old_revision or proof.get('nativeSource') != expected:
                raise ValueError(f'Art replacement lacks its exact prior source: {key} in {new_file}')
            if proof.get('nativePixelSHA256') != pixel_digest(root, previous):
                raise ValueError(f'Art replacement prior pixels changed: {key} in {old_file}')
        result.append(versions[-1][2])
    if not result:
        raise ValueError('No accepted art manifests')
    return result, inputs
