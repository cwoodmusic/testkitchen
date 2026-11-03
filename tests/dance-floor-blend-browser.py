"""The localized dance-room floor blend preserves architecture and saved edits."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location(
    'dance_blend_world_fixture', Path(__file__).with_name('published-world-browser.py'))
_fixture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_fixture)
PUBLISHED_SHA256 = '90b0319e0102c454c0f3217576c0ac5e157101952136a9584b4b4ae8d33a5b2b'
FINISHING_METADATA = [
    'scripts/passage-lantern-cleanup-regions.json',
    'scripts/lounge-center-wall-regions.json',
    'scripts/passage-transition-cleanup-regions.json',
    'scripts/northwest-neon-cap-regions.json',
    'scripts/west-neon-uniform-regions.json',
]


def finishing_masks():
    return [{key: meta.get(key, []) for key in ['polygons', 'protectedPolygons']}
            for filename in FINISHING_METADATA
            for meta in [json.loads((ROOT / filename).read_text())]]


def paint_pixel(texture, x, y, color):
    key = f'{x // 64},{y // 64}'
    pixels = {index: value for start, length, value in texture['tiles'].get(key, [])
              for index in range(start, start + length)}
    pixels[y % 64 * 64 + x % 64] = color
    runs = []
    for index, value in sorted(pixels.items()):
        if runs and runs[-1][0] + runs[-1][1] == index and runs[-1][2] == value:
            runs[-1][1] += 1
        else:
            runs.append([index, 1, value])
    texture['tiles'][key] = runs


class DanceFloorBlendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        _fixture.PublishedWorldTests.setUpClass.__func__(cls)
        cls.published = json.loads((ROOT / 'published-world-project.json').read_text())

    tearDownClass = classmethod(_fixture.PublishedWorldTests.tearDownClass.__func__)
    tearDown = _fixture.PublishedWorldTests.tearDown
    load = _fixture.PublishedWorldTests.load
    project = _fixture.PublishedWorldTests.project

    def setUp(self):
        _fixture.PublishedWorldTests.setUp(self)
        self.meta = json.loads((ROOT / 'scripts/dance-floor-blend-regions.json').read_text())
        self.reflections = json.loads((ROOT / 'scripts/reflection-floor-regions.json').read_text())
        self.dance_reflections = json.loads((ROOT / 'scripts/dance-reflection-floor-regions.json').read_text())
        self.east_floor = json.loads((ROOT / 'scripts/east-floor-cleanup-regions.json').read_text())
        self.lounge_floor = json.loads((ROOT / 'scripts/lounge-floor-regions.json').read_text())
        self.finishing_masks = finishing_masks()
        script = (ROOT / 'developer-console.js').read_text() + '''
(() => { const original = window.createCodaDeveloperConsole;
window.createCodaDeveloperConsole = api => {
 const instance = original(api); window.__danceBlendConsole = instance; return instance;
}; })();
'''
        self.context.route('**/developer-console.js*', lambda route: route.fulfill(
            status=200, content_type='text/javascript', body=script))

    def frames(self):
        self.page.evaluate('publishFrames(3)')

    def storage_record(self):
        return self.page.evaluate('''() => new Promise((resolve, reject) => {
 const open = indexedDB.open('codaArcadeAssetStudioDB', 1);
 open.onerror = () => reject(open.error);
 open.onsuccess = () => {
  const db = open.result, tx = db.transaction('layouts', 'readonly');
  const get = tx.objectStore('layouts').get('codaWorldProjectV1');
  get.onsuccess = () => resolve(JSON.stringify(get.result));
  tx.oncomplete = () => db.close();
 };
})''')

    def seed(self, project):
        stored = self.page.evaluate('''project => new Promise((resolve, reject) => {
 const open = indexedDB.open('codaArcadeAssetStudioDB', 1);
 open.onerror = () => reject(open.error);
 open.onsuccess = () => {
  const db = open.result, tx = db.transaction('layouts', 'readwrite');
  const record = {...project, savedAt: 123456789};
  tx.objectStore('layouts').put(record, 'codaWorldProjectV1');
  tx.oncomplete = () => { db.close(); resolve(JSON.stringify(record)); };
  tx.onerror = () => reject(tx.error);
 };
})''', project)
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('CodaDeveloperConsole.ready()&&CodaArcadeQA.characters().spriteState.ready')
        self.frames()
        return stored

    def test_repair_changes_only_reviewed_glass_and_keeps_the_actor_above_it(self):
        self.assertEqual(hashlib.sha256((ROOT / 'published-world-project.json').read_bytes()).hexdigest(),
                         PUBLISHED_SHA256, 'The uploaded world project must remain byte-for-byte intact')
        self.load()
        self.assertEqual(self.project(), self.published)
        result = self.page.evaluate('''async ({meta,reflections,danceReflections,eastFloor,loungeFloor,finishingMasks}) => {
 const load = async url => { const image = new Image(); image.src = url; await image.decode(); return image; };
 const before = await load(meta.before), after = await load(meta.output);
 const make = image => { const c = document.createElement('canvas'); c.width = image.naturalWidth;
  c.height = image.naturalHeight; c.getContext('2d').drawImage(image, 0, 0); return c; };
 const a = make(before), b = make(after), old = a.getContext('2d').getImageData(0, 0, a.width, a.height).data;
 const current = b.getContext('2d').getImageData(0, 0, b.width, b.height).data;
 const inside = (polygon, x, y) => { let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
   const [ax, ay] = polygon[i], [bx, by] = polygon[j];
   if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) hit = !hit;
  } return hit;
 };
 const [left, top, width, height] = meta.repairBounds;
 const inFinishing = (x,y) => finishingMasks.some(mask => mask.polygons.some(polygon => inside(polygon,x,y))
  && !mask.protectedPolygons.some(polygon => inside(polygon,x,y)));
 let changed = 0, danceChanged = 0, reflectionChanged = 0, outside = 0, protectedChanges = 0;
 for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
  const at = (y * a.width + x) * 4;
  if (![0, 1, 2, 3].some(channel => old[at + channel] !== current[at + channel])) continue;
  changed++;
  const glass = CodaWallReflections.isGlassFloor(x + .5, y + .5);
  const danceAllowed = x >= left && x < left + width && y >= top && y < top + height
   && glass
   && !meta.protectedPolygons.some(polygon => inside(polygon, x + .5, y + .5));
  // Subsequent approved cleanup removes orphaned reflections from the same
  // native backdrop. Its compositor clips these exact bounds to the shared
  // glass geometry; neither pass owns architecture outside that union.
  const reflectionAllowed = glass && [...reflections.passes,...danceReflections.passes,...eastFloor.passes].some(pass => {
   const [left,top,width,height] = pass.repairBounds;
   return x >= left && x < left + width && y >= top && y < top + height;
  });
  // The later lounge update has its own floor-only polygon. Carpet was not
  // in the old reflection-glass mask; do not exempt its bar, walls or caps.
  const loungeAllowed = loungeFloor.polygons.some(polygon => inside(polygon, x + .5, y + .5))
   && !loungeFloor.protectedPolygons.some(polygon => inside(polygon, x + .5, y + .5));
  if (danceAllowed) danceChanged++;
  if (reflectionAllowed) reflectionChanged++;
  if (!danceAllowed && !reflectionAllowed && !loungeAllowed && !inFinishing(x+.5,y+.5)) outside++;
  // Independent architectural witnesses: the stage, east wall, colored
  // dance panels and complete red front rail must not inherit generated art.
  if (!inFinishing(x+.5,y+.5) && ((x >= 236 && x <= 724 && y >= 507 && y < 649)
   || (x >= 808 && x < 859 && y >= 435 && y < 819)
   || (x >= 181 && x < 610 && y >= 680 && y < 814)
   || (x >= 119 && x < 808 && y >= 837 && y < 884))) protectedChanges++;
 }
 return {beforeSize: [a.width, a.height], afterSize: [b.width, b.height], changed, danceChanged, reflectionChanged, outside, protectedChanges};
}''', {'meta': self.meta, 'reflections': self.reflections, 'danceReflections': self.dance_reflections,
       'eastFloor': self.east_floor, 'loungeFloor': self.lounge_floor, 'finishingMasks': self.finishing_masks})
        self.assertEqual(result['beforeSize'], [1672, 941])
        self.assertEqual(result['afterSize'], [1672, 941])
        self.assertGreater(result['danceChanged'], 1000, 'The reviewed dance-room floor must still receive the blended texture')
        self.assertEqual(result['outside'], 0, 'No pixel outside the approved floor-blend and reflection-cleanup masks may change')
        self.assertEqual(result['protectedChanges'], 0, 'Preserve walls, dance tiles and neon borders exactly')
        self.assertTrue(self.page.evaluate('CodaArcadeQA.place(760,710)'))
        self.frames()
        visible = self.page.evaluate('''() => {
 const base = document.createElement('canvas'); base.width = 1672; base.height = 941;
 __danceBlendConsole.renderBase(base.getContext('2d'));
 const bg = base.getContext('2d'), ctx = view.getContext('2d'), cam = CodaArcadeQA.camera();
 let count = 0;
 for (let y = 666; y < 704; y++) for (let x = 750; x < 770; x++) {
  const actual = ctx.getImageData(Math.floor((x - cam.x) * cam.zoom), Math.floor((y - cam.y) * cam.zoom), 1, 1).data;
  const expected = bg.getImageData(x, y, 1, 1).data;
  if (Math.abs(actual[0] - expected[0]) + Math.abs(actual[1] - expected[1]) + Math.abs(actual[2] - expected[2]) > 40) count++;
 } return count;
}''')
        self.assertGreater(visible, 300, 'Repaired background floor must remain behind the avatar')
        self.assertEqual(self.project(), self.published)
        self.assertIsNone(self.page.evaluate('localStorage.getItem("codaWorldProjectV1")'))

    def test_an_older_local_layout_and_custom_floor_paint_keep_priority_after_reload(self):
        self.load()
        local = copy.deepcopy(self.published)
        # The reported browser retains older furniture placements. Preserve
        # those choices alongside its original wall selections and collision.
        couch = next(asset for asset in local['assets'] if asset.get('origin', {}).get('name') == 'dance_right_couch')
        couch['visible'] = True
        couch['name'] = 'My saved dance-room sofa'
        patch = local['artwork']['background.world']
        paint_pixel(patch, 760, 740, '#17c379ff')
        paint_pixel(patch, 1100, 650, '#a342c6ff')
        stored = self.seed(local)
        for _ in range(2):
            self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProjectSource()'), 'local')
            self.assertEqual(self.project(), local)
            self.assertEqual(self.storage_record(), stored, 'Rendering must not rewrite the local journal')
            pixels = self.page.evaluate('''() => {
 const c = document.createElement('canvas'); c.width = 1672; c.height = 941;
 const g = c.getContext('2d'); __danceBlendConsole.renderBase(g);
 return [[760,740],[1100,650]].map(([x,y]) => [...g.getImageData(x,y,1,1).data]);
}''')
            self.assertEqual(pixels, [[23, 195, 121, 255], [163, 66, 198, 255]],
                             'Intentional local paint remains above the repaired native backdrop')
            self.page.reload(wait_until='domcontentloaded')
            self.page.wait_for_function('CodaDeveloperConsole.ready()&&CodaArcadeQA.characters().spriteState.ready')
            self.frames()
        self.assertEqual(hashlib.sha256((ROOT / 'published-world-project.json').read_bytes()).hexdigest(),
                         PUBLISHED_SHA256)

    def test_full_and_lite_room_washes_fade_into_the_floor_without_tinting_the_hall(self):
        html = (ROOT / 'world-preview.html').read_text()
        probe = '''window.__danceWashProbe = quality => {
 const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
 const previous = g, oldQuality = fxMode, oldClock = clock;
 try {
  g = canvas.getContext('2d'); fxMode = quality; clock = 20.5;
  const beat = {on: false};
  nightclubColorwash(beat); clubRoomHeartbeat(beat); clubRoomVeil(beat); clubRoomHeartbeat(beat, true);
  const pixels = g.getImageData(0, 0, W, H).data;
  const alpha = (x, y) => pixels[(y * W + x) * 4 + 3];
  let ink = 0, hallInk = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
   if (!alpha(x, y)) continue;
   ink++;
   if (x >= 730 && x < 803 && y >= 535 && y < 649) hallInk++;
  }
  return {ink, hallInk, outside: [[760,600],[790,620],[750,640]].map(([x,y]) => alpha(x,y)),
   edge: Array.from({length: 75}, (_, index) => alpha(760, 646 + index)),
   interior: [[760,700],[760,740],[600,600]].map(([x,y]) => alpha(x,y))};
 } finally {g = previous; fxMode = oldQuality; clock = oldClock;}
};
'''
        marker = 'window.CodaArcadeQA=Object.freeze({'
        self.assertEqual(html.count(marker), 1)
        html = html.replace(marker, probe + marker, 1)
        self.context.route('**/world-preview.html*', lambda route: route.fulfill(
            status=200, content_type='text/html', body=html))
        self.load()
        observed = {quality: self.page.evaluate('__danceWashProbe', quality)
                    for quality in ['full', 'lite', 'off']}
        for quality in ['full', 'lite']:
            result = observed[quality]
            self.assertGreater(result['ink'], 1000, 'Keep the live nightclub lighting inside its room')
            self.assertEqual(result['hallInk'], 0, 'The exposed hall beside the stage must not get a clipped wash')
            self.assertEqual(result['outside'], [0, 0, 0])
            self.assertGreater(max(result['interior']), 0)
            self.assertLessEqual(max(result['edge'][:4]), 2,
                                 'The first floor row must fade in instead of starting with a visible block')
            jumps = [abs(after - before) for before, after in zip(result['edge'], result['edge'][1:])]
            self.assertLessEqual(max(jumps), 4, 'Adjacent floor pixels must not reveal a hard wash boundary')
        self.assertLess(max(observed['lite']['interior']), max(observed['full']['interior']))
        self.assertEqual(observed['off']['ink'], 0)
        self.assertEqual(self.project(), self.published)


if __name__ == '__main__':
    unittest.main(verbosity=2)
