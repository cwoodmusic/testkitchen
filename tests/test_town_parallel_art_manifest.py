import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from PIL import Image

spec = importlib.util.spec_from_file_location('town_art_manifest', Path(__file__).resolve().parents[1] / 'scripts/town_parallel_art_manifest.py')
manifest = importlib.util.module_from_spec(spec)
spec.loader.exec_module(manifest)


class AcceptedArtRevisions(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        Image.new('RGBA', (4, 3), (90, 50, 20, 255)).save(self.root / 'old.png')
        Image.new('RGBA', (4, 3), (80, 90, 40, 255)).save(self.root / 'new.png')
        self.old = dict(id='cabinet', facing='south', file='old.png', width=4, height=3, x=0, y=0, w=4, h=3, draw=dict(x=0, y=0, w=40, h=30))
        self.write('z-original-patches.json', [self.old])

    def tearDown(self):
        self.temp.cleanup()

    def write(self, name, value):
        (self.root / name).write_text(json.dumps(value))

    def replacement(self):
        return dict(self.old, file='new.png', supersedes={'revision': 1, 'nativeSource': {k: self.old[k] for k in manifest.NATIVE_FIELDS}, 'nativePixelSHA256': manifest.pixel_digest(self.root, self.old)})

    def test_revision_wins_independent_of_filename_order_and_keeps_unrelated_views(self):
        east = dict(self.old, facing='east')
        self.write('z-original-patches.json', [self.old, east])
        self.write('a-repair-patches.json', {'revision': 2, 'patches': [self.replacement()]})
        result, inputs = manifest.accepted_patches(self.root)
        by_key = {(r['id'], r['facing']): r for r in result}
        self.assertEqual(by_key['cabinet', 'south']['file'], 'new.png')
        self.assertEqual(by_key['cabinet', 'east'], east)
        self.assertEqual(by_key['cabinet', 'south']['draw'], self.old['draw'])
        self.assertEqual(len(inputs), 2)

    def test_implicit_duplicate_cannot_silently_replace_art(self):
        self.write('a-repair-patches.json', [dict(self.old, file='new.png')])
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            manifest.accepted_patches(self.root)

    def test_wrong_prior_source_or_changed_pixels_are_rejected(self):
        new = self.replacement()
        new['supersedes']['nativeSource']['x'] = 1
        self.write('a-repair-patches.json', {'revision': 2, 'patches': [new]})
        with self.assertRaisesRegex(ValueError, 'exact prior source'):
            manifest.accepted_patches(self.root)
        self.write('a-repair-patches.json', {'revision': 2, 'patches': [self.replacement()]})
        Image.new('RGBA', (4, 3), (1, 2, 3, 255)).save(self.root / 'old.png')
        with self.assertRaisesRegex(ValueError, 'pixels changed'):
            manifest.accepted_patches(self.root)


if __name__ == '__main__':
    unittest.main()
