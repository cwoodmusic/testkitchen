"""The lounge wall must cover rugs before foreground painting samples it."""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location(
    'lounge_wall_fixture', Path(__file__).with_name('published-world-browser.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)
ROOT = Path(__file__).resolve().parents[1]


class LoungeWallOcclusionTests(unittest.TestCase):
    setUpClass = classmethod(fixture.PublishedWorldTests.setUpClass.__func__)
    tearDownClass = classmethod(fixture.PublishedWorldTests.tearDownClass.__func__)
    tearDown = fixture.PublishedWorldTests.tearDown
    project = fixture.PublishedWorldTests.project

    def setUp(self):
        fixture.PublishedWorldTests.setUp(self)
        self.current = json.loads((ROOT / 'published-world-project.json').read_text())
        self.published = self.current
        self.context.add_init_script("localStorage.setItem('codaArcadeFXV1','off')")

    def load(self, project):
        self.published = project
        self.page.goto(self.url + '?guest=1', wait_until='domcontentloaded')
        self.page.wait_for_function('CodaDeveloperConsole?.ready() && '
                                   'CodaArcadeQA.characters().spriteState.ready')
        self.page.evaluate('CodaDeveloperConsole.open("objects")')
        if self.page.locator('#assetGuides').is_checked():
            self.page.locator('#assetGuides').uncheck()
        self.page.evaluate('publishFrames(3)')

    def pixels(self, points):
        return self.page.evaluate('''points=>{
          const camera=CodaArcadeQA.camera(),g=view.getContext('2d');
          return points.map(([x,y])=>[...g.getImageData(
            Math.floor((x-camera.x)*camera.zoom),
            Math.floor((y-camera.y)*camera.zoom),1,1).data]);
        }''', points)

    def test_published_rug_stays_below_the_wall_and_visible_on_the_floor(self):
        clean = copy.deepcopy(self.current)
        next(a for a in clean['assets'] if a['id'] == 'asset-103')['visible'] = False
        wall = [[x, y] for y in range(272, 282) for x in range(440, 462)]
        floor = [[x, y] for y in range(255, 267) for x in range(440, 456)]
        self.load(clean)
        expected_wall, bare_floor = self.pixels(wall), self.pixels(floor)
        self.load(self.current)
        self.assertEqual(self.pixels(wall), expected_wall,
                         'The cyan wall cap must hide the overlapping rug fringe')
        self.assertNotEqual(self.pixels(floor), bare_floor,
                            'The rug must remain visible above the wall on the floor')
        self.assertEqual(self.project(), self.current)

    def test_saved_rug_transform_and_foreground_paint_keep_clean_wall_pixels(self):
        moved = copy.deepcopy(self.current)
        rug = next(a for a in moved['assets'] if a['id'] == 'asset-103')
        rug['y'] += 16
        moved['strokes'].append({'tool': 'paint', 'size': 1,
                                'points': [[440, 272]], 'foreground': True,
                                'depth': 1000,
                                'selection': {'x': 440, 'y': 272,
                                              'width': 22, 'height': 24}})
        clean = copy.deepcopy(moved)
        next(a for a in clean['assets'] if a['id'] == 'asset-103')['visible'] = False
        points = [[x, y] for y in range(273, 294) for x in range(440, 462)]
        self.load(clean)
        expected = self.pixels(points)
        self.load(moved)
        self.assertEqual(self.pixels(points), expected,
                         'Foreground painting must promote the wall, not the rug')
        self.assertEqual(self.project(), moved,
                         'Rendering must preserve saved transforms and strokes')
        self.page.evaluate('''project=>new Promise((resolve,reject)=>{
          const request=indexedDB.open('codaArcadeAssetStudioDB',1);
          request.onerror=()=>reject(request.error);
          request.onsuccess=()=>{
            const db=request.result,tx=db.transaction('layouts','readwrite');
            tx.objectStore('layouts').put({...project,savedAt:Date.now()},'codaWorldProjectV1');
            tx.oncomplete=()=>{db.close();resolve();};
            tx.onerror=()=>reject(tx.error);
          };
        })''', moved)
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('CodaDeveloperConsole.ready()')
        self.page.evaluate('publishFrames(3)')
        self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProjectSource()'), 'local')
        self.assertEqual(self.project(), moved)
        self.assertEqual(self.pixels(points), expected)

    def test_boutique_fixtures_remain_in_front_of_the_wall(self):
        bare = copy.deepcopy(self.current)
        next(a for a in bare['assets'] if a['id'] == 'asset-50')['visible'] = False
        points = [[x, y] for y in range(400, 420) for x in range(480, 560)]
        self.load(bare)
        wall = self.pixels(points)
        self.load(self.current)
        self.assertGreater(sum(a != b for a, b in zip(self.pixels(points), wall)), 300,
                           'The wall must not cover the boutique counter against it')
        self.assertEqual(self.project(), self.current)


if __name__ == '__main__':
    unittest.main(verbosity=2)
