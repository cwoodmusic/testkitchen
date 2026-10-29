"""Four relocated cabinets: retained edits, physical walking and game entrances.

Uses disposable local browser contexts and the real published world. External
games are replaced with inert documents; Song Machine loads its actual iframe.
No account credentials or public services are used.
"""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from urllib.parse import urlparse

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location(
    'published_world_fixture', Path(__file__).with_name('published-world-browser.py'))
_fixture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_fixture)

BOUNDS = {
    'cabinet_pitch_race': [682, 166, 95, 138],
    'cabinet_music_triad': [791, 166, 104, 138],
    'cabinet_rhythm_room': [912, 166, 104, 138],
    'cabinet_song_machine': [1028, 166, 107, 138],
}
SHIFT = 48
MOVED_STROKES = {8, 9, 10, 15}


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True,
                                    separators=(',', ':')).encode()).hexdigest()


def outside_old_cabinets(entry):
    index, _ = entry
    x, y = index % 168 * 10 + 5, index // 168 * 10 + 5
    return not any(bx - 8 <= x < bx + w + 8 and by - 8 <= y < by + h + 8
                   for bx, by, w, h in BOUNDS.values())


class CabinetRelocationTests(unittest.TestCase):
    setUpClass = classmethod(_fixture.PublishedWorldTests.setUpClass.__func__)
    tearDownClass = classmethod(_fixture.PublishedWorldTests.tearDownClass.__func__)
    tearDown = _fixture.PublishedWorldTests.tearDown
    load = _fixture.PublishedWorldTests.load
    project = _fixture.PublishedWorldTests.project

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1600, 'height': 1000})
        self.context.route('https://**/*', lambda route: route.abort())
        # The frame navigation case also opens cross-origin opaque documents.
        # Fixture-only local storage and frame controls belong to the world,
        # not those documents. Production child scripts remain unmodified.
        self.context.add_init_script('''(()=>{
          if(window!==window.top)return;
          localStorage.setItem('codaArcadeFXV1','off');
          window.publishFrames=count=>new Promise(resolve=>{
            const next=()=>{if(--count<=0)resolve();else requestAnimationFrame(next);};
            requestAnimationFrame(next);
          });
        })()''')
        self.page = self.context.new_page()
        self.page.set_default_timeout(8000)
        self.errors = []
        self.failures = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('console', lambda message: self.errors.append(message.text)
                     if 'Arcade frame error:' in message.text else None)
        self.page.on('response', lambda response: self.failures.append(response.url)
                     if response.status >= 400 and '127.0.0.1' in response.url
                     and not response.url.endswith('favicon.ico') else None)

    def games(self):
        return self.page.evaluate('''()=>CodaArcadeQA.worldObjects()
          .filter(object=>object.game).map(object=>object.game)''')

    def walkable(self, x, y):
        return self.page.evaluate('([x,y])=>CodaArcadeQA.walkable(x,y)', [x, y])

    def test_published_cabinet_layout_keeps_the_uploaded_world_edits_intact(self):
        project = copy.deepcopy(self.published)
        self.assertEqual((len(project['assets']), len(project['collision']),
                          len(project['strokes'])), (13, 1394, 763))
        unrelated = [asset for asset in project['assets']
                     if asset.get('origin', {}).get('name') not in BOUNDS]
        self.assertEqual(digest(unrelated),
                         '8191f815cc0be71ad86747a16f9a0fea685159db4f0b46f1048d4549cf12a999',
                         'Keep the nine unrelated assets exactly as exported')
        self.assertEqual(digest([stroke for i, stroke in enumerate(project['strokes'])
                                 if i not in MOVED_STROKES]),
                         '84e0856978c74b68ce7e935a56e99563ec83550b3151c231d36eee8f00479cdd',
                         'Keep all 759 uploaded layer strokes outside the cabinet-row depth edits')
        self.assertEqual(digest([entry for entry in project['collision']
                                 if outside_old_cabinets(entry)]),
                         '56f2cbbb9370c76d7ac4cd78ebc60d228ed937907db5c220793b009635ac1894',
                         'Keep collision edits outside the former cabinet row')
        self.assertEqual(len({asset['id'] for asset in project['assets']}), 13)
        for name, bounds in BOUNDS.items():
            with self.subTest(cabinet=name):
                asset = next(asset for asset in project['assets']
                             if asset.get('origin', {}).get('name') == name)
                x, y, w, h = bounds
                self.assertEqual(asset['origin']['bounds'], bounds,
                                 'The original art remains the cabinet source')
                self.assertEqual([asset['x'], asset['y'], asset['w'], asset['h']],
                                 [x + w / 2, y + h / 2 - SHIFT, w, h])
                self.assertTrue(asset['releaseCollision'])
                self.assertTrue(asset['visible'])
        for index, old_depth in [(8, 294), (9, 290), (10, 289), (15, 291)]:
            self.assertEqual(project['strokes'][index]['depth'], old_depth - SHIFT)
        self.load()
        self.assertEqual(self.project(), self.published)
        self.assertIsNone(self.page.evaluate('localStorage.getItem("codaWorldProjectV1")'),
                          'The shared default must not become a private override')

    def test_rebuilt_old_floor_is_walkable_and_new_fronts_stop_real_movement(self):
        self.load()
        games = self.games()
        self.assertEqual(len(games), 4)
        for game in games:
            with self.subTest(game=game['name']):
                self.assertEqual(game['y'], [313, 314, 315, 315][game['index']] - SHIFT)
                self.assertEqual(game['npcY'], 275)
                self.assertTrue(self.walkable(game['npcX'], game['npcY']))
                self.assertGreater(len(self.page.evaluate(
                    'game=>CodaArcadeQA.route(1180,388,game.npcX,game.npcY)', game)), 0)
                for y in [275, 285, 295, 305]:
                    self.assertTrue(self.walkable(game['x'], y),
                                    f"Old {game['name']} floor remains blocked at {y}")
                self.assertFalse(self.walkable(game['x'], 252),
                                 'The new visible cabinet front must be solid')
                self.assertTrue(self.page.evaluate(
                    'game=>CodaArcadeQA.place(game.x,315)', game))
                self.page.locator('#view').focus()
                self.page.keyboard.down('w')
                try:
                    self.page.evaluate('publishFrames(48)')
                finally:
                    self.page.keyboard.up('w')
                player = self.page.evaluate('CodaArcadeQA.position()')
                self.assertLess(player['y'], 270,
                                'Walking must cross the vacated cabinet footprint')
                self.assertGreaterEqual(player['y'], 260,
                                        'Walking must stop at the relocated cabinet')
        self.assertFalse(self.walkable(1128, 240),
                         'Song Machine right-hand body must not be walk-through')
        self.assertFalse(self.walkable(1145, 205),
                         'Moving cabinets must preserve the neighboring speaker')

    def test_all_four_moved_cabinets_open_their_games_from_the_new_positions(self):
        for path in ('Pitch-Race', 'musictriad', 'rhythmroom'):
            self.context.route('https://cwoodmusic.github.io/' + path + '/**',
                               lambda route: route.fulfill(
                                   status=200, content_type='text/html',
                                   body='<!doctype html><title>Isolated cabinet game</title>'))
        self.load()
        paths = {0: '/Pitch-Race/', 1: '/musictriad/', 2: '/rhythmroom/',
                 3: '/song-machine/index.html'}
        for game in self.games():
            with self.subTest(game=game['name']):
                self.assertTrue(self.page.evaluate(
                    'game=>CodaArcadeQA.place(game.npcX,game.npcY)', game))
                self.page.evaluate('publishFrames(4)')
                self.page.locator('#view').focus()
                self.page.keyboard.press('e')
                self.page.wait_for_function('!document.querySelector("#gameoverlay").hidden')
                self.assertEqual(self.page.locator('#activegame').inner_text(), game['name'])
                url = self.page.locator('#gameiframe').get_attribute('src')
                self.assertTrue(urlparse(url).path.endswith(paths[game['index']]), url)
                self.assertIn('classroom=1', url,
                              'Moving a cabinet must retain classroom privacy')
                if game['index'] == 3:
                    heading = self.page.frame_locator('#gameiframe').locator('h1')
                    heading.wait_for(state='visible')
                    self.assertIn('SONG MACHINE', heading.inner_text().upper())
                self.page.locator('#returnworld').click()
                self.page.wait_for_function('document.querySelector("#gameoverlay").hidden')

    def test_ceiling_disco_ball_remains_in_front_of_the_moved_music_triad_cabinet(self):
        self.load()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.atmosphere().quality'), 'off')
        self.page.evaluate('''async()=>{
          const image=new Image();
          await new Promise((resolve,reject)=>{
            image.onload=resolve;image.onerror=reject;image.src='coda_arcade_world_clean.png';
          });
          const reference=document.createElement('canvas');reference.width=1672;reference.height=941;
          const context=reference.getContext('2d');context.drawImage(image,0,0);
          window.ceilingBallWitness=()=>{
            const cam=CodaArcadeQA.camera(),view=document.querySelector('#view').getContext('2d');
            if(cam.zoom!==1)throw Error('Pixel witness requires the default 100% zoom');
            const left=870,top=125,width=19,height=20,
              expected=context.getImageData(left,top,width,height).data,
              actual=view.getImageData(Math.round(left-cam.x),Math.round(top-cam.y),width,height).data;
            let changed=0;const failures=[];
            for(let at=0;at<expected.length;at+=4){
              if(expected.subarray(at,at+4).some((value,index)=>value!==actual[at+index])){
                changed++;if(failures.length<5)failures.push({x:left+at/4%width,
                  y:top+Math.floor(at/4/width),expected:Array.from(expected.subarray(at,at+4)),
                  actual:Array.from(actual.subarray(at,at+4))});
              }
            }
            return {changed,failures};
          };
        }''')
        self.assertEqual(self.page.evaluate('ceilingBallWitness()'), {'changed': 0, 'failures': []},
                         'The visible relocated Triad cabinet must not cover the ceiling sphere')
        self.page.evaluate('CodaDeveloperConsole.open("objects")')
        self.page.locator('#assetList').select_option('asset-6')
        self.page.locator('#assetVisible').uncheck()
        self.page.locator('#view').focus()
        self.page.keyboard.press('F2')
        self.page.evaluate('publishFrames(4)')
        self.assertEqual(self.page.evaluate('ceilingBallWitness()'), {'changed': 0, 'failures': []},
                         'Hiding the cabinet must leave exactly the same ceiling pixels')


if __name__ == '__main__':
    unittest.main(verbosity=2)
