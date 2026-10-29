"""Read-only pixel checks for the scoped smooth arcade floor artwork."""
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import unittest

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ORIGINAL_SHA256 = '0cedb96952e1f046908367b64135ddce3c71bbbee4c8421560ef15b0e8cc584d'
ATLAS_SHA256 = 'ff6ca3f594e2a1f4b84f6d39bcb43a10dd2343d4288ce5c934b5ff5fd6c0aedf'
PROJECT_SHA256 = 'cdfe297b883c232077fc75cc10e1f0f83b2148433dc1ab023f6c721361844038'
PLATE_BASE_REVISION = 'ea6573036eb126abfaeaac21910ef76d6209c1cc'


def inside(px, py, polygon):
    hit = False
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
        if (a[1] > py) != (b[1] > py) and px < (b[0] - a[0]) * (py - a[1]) / (b[1] - a[1]) + a[0]:
            hit = not hit
    return hit


def polygon_mask(mask, width, height, polygon, value):
    for y in range(max(0, min(p[1] for p in polygon)), min(height, max(p[1] for p in polygon))):
        for x in range(max(0, min(p[0] for p in polygon)), min(width, max(p[0] for p in polygon))):
            if inside(x + .5, y + .5, polygon):
                mask[y * width + x] = value


def foreground_parts():
    html = (ROOT / 'world-preview.html').read_text()
    parts = json.loads(re.search(r'const foregroundParts=(\[.*?\]);', html, re.S)[1])
    for match in re.finditer(r'foregroundParts\.push\(\.\.\.(\[.*?\])\);', html):
        parts.extend(json.loads(match[1]))
    for match in re.finditer(r'foregroundParts\.push\((\{[^\n]*?\})\);', html):
        parts.append(json.loads(re.sub(r'([{,])(\w+):', r'\1"\2":', match[1])))
    return parts


def catalog_objects():
    # The catalog is a trusted local data declaration; evaluate it without a
    # browser to recover its polygons, not the user's uploaded world document.
    source = "const fs=require('node:fs'),vm=require('node:vm'),s={window:{}};vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),s,{timeout:1000});process.stdout.write(JSON.stringify(s.window.CodaWorldObjectCatalog));"
    result = subprocess.run(['node', '-e', source, str(ROOT / 'world-object-catalog.js')], check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


def dance_tile_polygon():
    source = "process.stdout.write(JSON.stringify(require(process.argv[1]).VERTEX_ROWS));"
    result = subprocess.run(['node', '-e', source, str(ROOT / 'dance-floor.js')],
                            check=True, capture_output=True, text=True)
    rows = json.loads(result.stdout)
    if len(rows) != 7 or any(len(row) != 14 for row in rows):
        raise AssertionError('The measured 13 by 6 colored dance board changed.')
    return (rows[0] + [row[-1] for row in rows[1:]] +
            list(reversed(rows[-1][:-1])) + [row[0] for row in reversed(rows[1:-1])])


class FlatFloorArtTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original = Image.open(ROOT / 'coda_arcade_world_clean.png').convert('RGBA')
        cls.world = Image.open(ROOT / 'assets/world/arcade-flat-floor-world.png').convert('RGBA')
        cls.plate = Image.open(ROOT / 'assets/world/arcade-flat-floor-plate.png').convert('RGBA')
        cls.original_atlas = Image.open(ROOT / 'coda_arcade_foreground_clean.png').convert('RGBA')
        cls.atlas = Image.open(ROOT / 'assets/world/arcade-flat-floor-foreground.png').convert('RGBA')
        cls.meta = json.loads((ROOT / 'scripts/flat-floor-regions.json').read_text())
        cls.parts = foreground_parts()
        cls.parts_by_name = {part['name']: part for part in cls.parts}
        width, height = cls.meta['worldSize']
        cls.allowed = bytearray(width * height)
        for polygon in cls.meta['floorPolygons']:
            polygon_mask(cls.allowed, width, height, polygon, 1)
        for polygon in cls.meta['protectedPolygons']:
            polygon_mask(cls.allowed, width, height, polygon, 0)
        for x, y, w, h in cls.meta['protectedBounds']:
            for yy in range(max(0, y), min(height, y + h)):
                start = yy * width + max(0, x)
                end = yy * width + min(width, x + w)
                cls.allowed[start:end] = bytes(end - start)
        for y, x0, x1 in cls.meta.get('protectedPixelRuns', []):
            start, end = y * width + x0, y * width + x1
            cls.allowed[start:end] = bytes(end - start)
        catalog = {item['name']: item for item in catalog_objects()}
        for name in cls.meta['protectCatalogObjects']:
            item = catalog[name]
            x, y, w, h = item['bounds']
            polygon_mask(cls.allowed, width, height, item.get('polygon', [[x,y],[x+w,y],[x+w,y+h],[x,y+h]]), 0)
        if cls.meta['preserveForegroundAlpha']:
            alpha = cls.atlas.getchannel('A').load()
            for part in cls.parts:
                x, y, w, h = part['bounds']
                ax, ay, _, _ = part['atlas']
                for yy in range(h):
                    for xx in range(w):
                        if alpha[ax + xx, ay + yy]:
                            cls.allowed[(y + yy) * width + x + xx] = 0

        # Translate each declared world-space floor cut into the immutable
        # atlas layout. Only these apron pixels may become transparent.
        cls.atlas_cuts = bytearray(cls.atlas.width * cls.atlas.height)
        for cut in cls.meta['foregroundFloorCuts']:
            part = cls.parts_by_name[cut['name']]
            x, y, w, h = part['bounds']
            ax, ay, _, _ = part['atlas']
            for yy in range(h):
                for xx in range(w):
                    if any(inside(x + xx + .5, y + yy + .5, polygon) for polygon in cut['polygons']):
                        cls.atlas_cuts[(ay + yy) * cls.atlas.width + ax + xx] = 1

    def test_original_art_atlas_and_every_published_edit_are_retained(self):
        self.assertEqual(hashlib.sha256((ROOT / 'coda_arcade_world_clean.png').read_bytes()).hexdigest(), ORIGINAL_SHA256)
        self.assertEqual(hashlib.sha256((ROOT / 'coda_arcade_foreground_clean.png').read_bytes()).hexdigest(), ATLAS_SHA256)
        project = json.loads((ROOT / 'published-world-project.json').read_text())
        digest = hashlib.sha256(json.dumps(project, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        self.assertEqual(digest, PROJECT_SHA256)
        self.assertEqual(self.world.size, (1672, 941))
        self.assertEqual(self.plate.size, self.world.size)
        self.assertEqual(self.atlas.size, self.original_atlas.size)
        self.assertEqual(self.world.getchannel('A').tobytes(), self.original.getchannel('A').tobytes())

    def test_active_atlas_trims_only_declared_floor_aprons_without_changing_fixture_art(self):
        original = self.original_atlas.tobytes()
        active = self.atlas.tobytes()
        trimmed = 0
        for index, allowed in enumerate(self.atlas_cuts):
            at = index * 4
            if not allowed:
                if active[at:at+4] != original[at:at+4]:
                    self.fail(f'Unrelated foreground pixel changed at {index % self.atlas.width},{index // self.atlas.width}')
            else:
                self.assertEqual(active[at+3], 0, 'Declared floor apron must not occlude the smooth ground')
                # Canvas PNG encoding may zero RGB under a fully clear pixel.
                # The change is invisible; all non-cut colors stay exact above.
                trimmed += original[at+3] > 0
        self.assertGreater(trimmed, 100, 'The former grid patches must actually be removed from foreground masks')
        witnesses = {
            'main_counter': [(1205,540),(1205,565),(1400,545)],
            'main_counter_left_palm': [(1190,480)],
            'dance_east_wall': [(835,445),(835,520)],
        }
        for name, points in witnesses.items():
            x, y, _, _ = self.parts_by_name[name]['bounds']
            ax, ay, _, _ = self.parts_by_name[name]['atlas']
            for wx, wy in points:
                point = (ax + wx - x, ay + wy - y)
                with self.subTest(fixture=name, point=(wx,wy)):
                    self.assertGreater(self.original_atlas.getpixel(point)[3], 0)
                    self.assertEqual(self.atlas.getpixel(point), self.original_atlas.getpixel(point))

    def test_already_approved_main_floor_plate_is_unchanged_outside_the_new_edge_edits(self):
        self.assertEqual(self.meta['plateBaseRevision'], PLATE_BASE_REVISION)
        result = subprocess.run(['git', 'show', PLATE_BASE_REVISION + ':assets/world/arcade-flat-floor-plate.png'],
                                cwd=ROOT, check=True, capture_output=True)
        baseline = Image.open(io.BytesIO(result.stdout)).convert('RGBA')
        self.assertEqual(baseline.size, self.plate.size)
        width, height = baseline.size
        edits = bytearray(width * height)
        for polygon in self.meta['plateEditPolygons']:
            polygon_mask(edits, width, height, polygon, 1)
        old, new = baseline.tobytes(), self.plate.tobytes()
        changed = 0
        for index, allowed in enumerate(edits):
            at = index * 4
            if old[at:at+4] != new[at:at+4]:
                if not allowed:
                    self.fail(f'Previously approved floor plate changed at {index % width},{index // width}')
                changed += 1
        self.assertGreater(changed, 10000, 'The new club apron and local edge edits must be present')

    def test_roof_palm_stays_native_without_a_rectangular_patch_of_grout(self):
        for point in [(463,250),(465,260),(482,262),(470,297),(465,312),(442,309)]:
            self.assertEqual(self.world.getpixel(point), self.original.getpixel(point))
        changed = 0
        for point in [(450,248),(482,248),(490,252),(450,255),(450,260),(480,255),(485,255),(445,270)]:
            self.assertEqual(self.world.getpixel(point), self.plate.getpixel(point))
            changed += self.world.getpixel(point) != self.original.getpixel(point)
        self.assertGreater(changed, 5, 'Remove the old rectangular tile pocket around the protected palm')

    def test_only_authorized_ground_pixels_change_and_their_plate_coordinates_match(self):
        old = self.original.tobytes()
        new = self.world.tobytes()
        plate = self.plate.tobytes()
        changed = 0
        for index, allowed in enumerate(self.allowed):
            at = index * 4
            if not allowed:
                if new[at:at+4] != old[at:at+4]:
                    self.fail(f'Protected non-floor pixel changed at {index % 1672},{index // 1672}')
            else:
                if new[at:at+3] != plate[at:at+3]:
                    self.fail(f'Floor source shifted at {index % 1672},{index // 1672}')
                changed += new[at:at+3] != old[at:at+3]
        self.assertGreater(changed, 100000, 'Replace the floor throughout the hall, not a few isolated tiles')

    def test_independent_lounge_colored_dance_tiles_and_fixture_regions_are_pixel_identical(self):
        # These independent visible-room boxes do not come from the compositor
        # metadata, so a mistakenly widened floor mask cannot relax this check.
        regions = {
            'lounge seating and original carpet': (50, 60, 430, 350),
            'DJ stage and console': (340, 605, 450, 650),
            'right couch cushions and base': (641, 632, 690, 670),
            'left couch cushions': (110, 620, 160, 650),
            'east retaining wall body': (833, 560, 848, 690),
            'main arcade sign': (690, 34, 1040, 90),
            'piano facade': (1230, 0, 1380, 150),
            'hall of fame fixture': (1410, 140, 1555, 290),
        }
        for name, box in regions.items():
            with self.subTest(region=name):
                self.assertEqual(self.world.crop(box).tobytes(), self.original.crop(box).tobytes())
        # Protect the actual fan-shaped tile outline, including its native
        # grout. A rectangular box would also forbid the newly requested apron.
        width, height = self.world.size
        colored_tiles = bytearray(width * height)
        polygon_mask(colored_tiles, width, height, dance_tile_polygon(), 1)
        old, new = self.original.tobytes(), self.world.tobytes()
        count = 0
        for index, protected in enumerate(colored_tiles):
            if protected:
                at = index * 4
                if old[at:at+4] != new[at:at+4]:
                    self.fail(f'Colored dance-board pixel changed at {index % width},{index // width}')
                count += 1
        self.assertGreater(count, 80000, 'Check the full measured colored board, not a few sample tiles')

    def test_smooth_club_apron_reaches_the_colored_tiles_and_local_grid_halos_are_cleared(self):
        groups = {
            'club apron beside the measured colored board': [(143,740),(134,760),(126,800),(654,740),(665,760),(675,800)],
            'Piano Lab landing': [(1280,155),(1290,160),(1378,200)],
            'shop counter floor apron': [(1173,500),(1175,540),(1185,570)],
            'dance entrance wall halos': [(811,444),(800,638),(812,698)],
        }
        for name, points in groups.items():
            changed = 0
            for point in points:
                with self.subTest(region=name, point=point):
                    self.assertTrue(self.allowed[point[1] * 1672 + point[0]], 'Witness must inspect actual exposed ground')
                    self.assertEqual(self.world.getpixel(point), self.plate.getpixel(point))
                    changed += self.world.getpixel(point) != self.original.getpixel(point)
            self.assertGreaterEqual(changed, len(points) - 1, 'Replace the remaining visible grid at the requested edges')

    def test_main_floor_loses_grout_frequency_while_allowing_soft_light_gradients(self):
        old_pixels, new_pixels = self.original.load(), self.world.load()
        old_total = new_total = count = 0
        for left, top, right, bottom in [(900, 540, 1160, 750), (1240, 610, 1490, 725)]:
            for y in range(top + 1, bottom - 1):
                for x in range(left + 1, right - 1):
                    old = [old_pixels[x-1,y], old_pixels[x,y], old_pixels[x+1,y], old_pixels[x,y-1], old_pixels[x,y+1]]
                    new = [new_pixels[x-1,y], new_pixels[x,y], new_pixels[x+1,y], new_pixels[x,y-1], new_pixels[x,y+1]]
                    if any(max(pixel[:3]) > 190 for pixel in old + new):
                        continue  # Bright stars and reflections are intentionally retained.
                    luma = lambda pixel: pixel[1] * .7 + pixel[2] * .3
                    old_luma, new_luma = list(map(luma, old)), list(map(luma, new))
                    old_total += abs(old_luma[0] - 2 * old_luma[1] + old_luma[2]) + abs(old_luma[3] - 2 * old_luma[1] + old_luma[4])
                    new_total += abs(new_luma[0] - 2 * new_luma[1] + new_luma[2]) + abs(new_luma[3] - 2 * new_luma[1] + new_luma[4])
                    count += 1
        self.assertGreater(count, 30000)
        self.assertLess(new_total, old_total * .65, 'The new surface should remove fine tile edges while retaining broad neon lighting')


if __name__ == '__main__':
    unittest.main(verbosity=2)
