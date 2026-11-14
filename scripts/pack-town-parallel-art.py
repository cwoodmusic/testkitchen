"""Pack accepted image-authored sprites without altering their native pixels.

Input manifests retain original image_gen PNGs and individual acceptance
records. Native output uses lossless crop-and-copy only. The small, separate
overview is a thumbnail, never a substitute for native art in game/export.
"""
from pathlib import Path
from collections import defaultdict
import hashlib
import json
import math
import subprocess
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'town/assets/parallel-art'
OUT = ART / 'packed'
OUT.mkdir(exist_ok=True)
LIMIT = 2048


def digest(data):
    return hashlib.sha256(data).hexdigest()


def group(patch):
    if patch.get('owner'):
        return patch['owner']
    ident = patch['id']
    if ident.startswith(('collection-', 'family-')):
        for owner in OWNERS:
            if ident.startswith(('collection-' + owner + '-', 'family-' + owner + '-')):
                return owner
    if ident.startswith('showroom-'):
        return ident.rsplit('-', 1)[0]
    if ident.startswith('apartment-'):
        return 'legacy-apartment'
    if ident.startswith('furniture-'):
        return 'legacy-core'
    return 'library-decor'


manifest = json.loads((ROOT / 'town/assets/apartment-collections/manifest.json').read_text())
OWNERS = sorted((c['owner'] for c in manifest['collections']), key=len, reverse=True)
patches = []
inputs = []
for path in sorted(ART.glob('*-patches.json')):
    envelope = json.loads(path.read_text())
    rows = envelope if isinstance(envelope, list) else envelope['patches']
    inputs.append({'file': path.name, 'sha256': digest(path.read_bytes()), 'count': len(rows)})
    patches.extend(rows)
assert patches, 'No accepted art manifests'
keys = [(p['id'], p.get('facing', 'south')) for p in patches]
assert len(keys) == len(set(keys)), 'Duplicate asset/facing acceptance records'

groups = defaultdict(dict)
loaded = {}
for patch in patches:
    file = ART / patch['file']
    if file not in loaded:
        loaded[file] = Image.open(file).convert('RGBA')
    image = loaded[file]
    assert image.size == (patch['width'], patch['height']), file
    x, y, w, h = (patch[k] for k in ('x', 'y', 'w', 'h'))
    assert min(x, y) >= 0 and min(w, h) > 0 and x+w <= image.width and y+h <= image.height
    crop = image.crop((x, y, x+w, y+h))
    assert crop.getchannel('A').getbbox(), patch['id']
    assert w+8 <= LIMIT and h+8 <= LIMIT, ('Native crop exceeds page', patch['id'])
    key = digest(f'{w},{h}:'.encode() + crop.tobytes())
    patch['_nativeKey'] = key
    patch['_group'] = group(patch)
    groups[patch['_group']].setdefault(key, crop)
for image in loaded.values():
    image.close()
loaded.clear()

locations = {}
atlas_files = []
for owner, sprites in sorted(groups.items()):
    pages = []
    page = {'image': Image.new('RGBA', (LIMIT, LIMIT)), 'x': 4, 'y': 4, 'row': 0, 'bottom': 4, 'items': []}
    for key, sprite in sorted(sprites.items(), key=lambda kv: (-kv[1].height, -kv[1].width, kv[0])):
        w, h = sprite.size
        if page['x'] + w + 4 > LIMIT:
            page['x'] = 4
            page['y'] += page['row'] + 8
            page['row'] = 0
        if page['y'] + h + 4 > LIMIT:
            pages.append(page)
            page = {'image': Image.new('RGBA', (LIMIT, LIMIT)), 'x': 4, 'y': 4, 'row': 0, 'bottom': 4, 'items': []}
        x, y = page['x'], page['y']
        # No alpha mask: copy the entire RGBA rectangle exactly, including
        # translucent edges and the authored RGB beneath alpha zero.
        page['image'].paste(sprite, (x, y))
        page['items'].append((key, x, y, w, h))
        page['x'] += w + 8
        page['row'] = max(page['row'], h)
        page['bottom'] = max(page['bottom'], y + h + 4)
    if page['items']:
        pages.append(page)
    for n, page in enumerate(pages, 1):
        image = page['image'].crop((0, 0, LIMIT, page['bottom']))
        filename = f'{owner}-{n}-{digest(image.tobytes())[:12]}.webp'
        if not (OUT / filename).exists():
            image.save(OUT / filename, lossless=True, exact=True)
        with Image.open(OUT / filename) as check:
            decoded = check.convert('RGBA')
            for key, x, y, w, h in page['items']:
                assert decoded.crop((x, y, x+w, y+h)).tobytes() == sprites[key].tobytes()
                locations[(owner, key)] = {'file': 'packed/' + filename, 'width': image.width, 'height': image.height, 'x': x, 'y': y, 'w': w, 'h': h}
        atlas_files.append(filename)
        page['image'].close()
        image.close()

unique = {}
for sprites in groups.values():
    unique.update(sprites)
count = len(unique)
thumb_size = min(96, max(32, int(math.sqrt(3_000_000 / count)) - 8))
tile = thumb_size + 8
cols = math.ceil(math.sqrt(count))
overview = Image.new('RGBA', (cols*tile, math.ceil(count/cols)*tile))
assert overview.width * overview.height <= 4*1024*1024
preview_locations = {}
for i, (key, source) in enumerate(sorted(unique.items())):
    thumb = source.copy()
    thumb.thumbnail((thumb_size, thumb_size), Image.Resampling.NEAREST)
    x, y = i % cols * tile + 4, i // cols * tile + 4
    overview.paste(thumb, (x, y))
    preview_locations[key] = {'x': x, 'y': y, 'w': thumb.width, 'h': thumb.height}
    thumb.close()
preview_file = 'preview-' + digest(overview.tobytes())[:12] + '.webp'
if not (OUT / preview_file).exists():
    overview.save(OUT / preview_file, lossless=True, exact=True)
for patch in patches:
    key, owner = patch.pop('_nativeKey'), patch.pop('_group')
    patch['nativePackSource'] = {k: patch[k] for k in ('file', 'width', 'height', 'x', 'y', 'w', 'h')}
    patch['nativePixelSHA256'] = key
    patch.update(locations[(owner, key)])
    patch['preview'] = {'file': 'packed/' + preview_file, 'width': overview.width, 'height': overview.height, **preview_locations[key]}
    for field in ('acceptedFile', 'generatedBoard'):
        if field in patch and str(patch[field]).startswith('/workspace/'):
            del patch[field]

packed = {'version': 1, 'packing': 'Exact native RGBA crop/copy, lossless WebP; separate nearest-neighbor compact overview.', 'inputs': inputs, 'patches': patches}
(ART / 'packed-manifest.json').write_text(json.dumps(packed, indent=2) + '\n')
module = ROOT / 'town/world/parallel-art-data.mjs'
prefix = module.read_text().split('export const')[0]
runtime_fields = ('id', 'facing', 'file', 'width', 'height', 'x', 'y', 'w', 'h', 'draw', 'preview')
runtime_patches = [{key: patch[key] for key in runtime_fields if key in patch} for patch in patches]
module.write_text(prefix + 'export const PARALLEL_ART_PATCHES=Object.freeze(' + json.dumps(runtime_patches, separators=(',', ':')) + ');\n')
# Previously published, fingerprinted files must remain available to cached
# browser modules. Only discard local intermediate packs from this task.
tracked = set(subprocess.check_output(['git', 'ls-files', '--', str(OUT.relative_to(ROOT))], cwd=ROOT, text=True).splitlines())
for old in OUT.glob('*.webp'):
    if old.name not in set(atlas_files + [preview_file]) and str(old.relative_to(ROOT)) not in tracked:
        old.unlink()
print(json.dumps({'patches': len(patches), 'assets': len(set(p['id'] for p in patches)), 'uniqueNativeCrops': count, 'nativeAtlases': len(atlas_files), 'previewPixels': overview.width*overview.height}))
