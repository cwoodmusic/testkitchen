"""Flat-floor loading gates, animated light effects and mobile guest rendering."""
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location('flat_floor_fixture', Path(__file__).with_name('arcade-floor-grid-browser.py'))
fixture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fixture)


class FlatFloorBrowserTests(unittest.TestCase):
    setUpClass = classmethod(fixture.ArcadeFloorGridTests.setUpClass.__func__)
    tearDownClass = classmethod(fixture.ArcadeFloorGridTests.tearDownClass.__func__)
    setUp = fixture.ArcadeFloorGridTests.setUp
    tearDown = fixture.ArcadeFloorGridTests.tearDown
    load = fixture.ArcadeFloorGridTests.load

    def quality(self, name):
        self.page.locator('#worldMenuBtn').click()
        for _ in range(3):
            if self.page.evaluate('CodaArcadeQA.atmosphere().quality') == name:
                break
            self.page.locator('#fxBtn').click()
        self.page.locator('#worldMenuBtn').click()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.atmosphere().quality'), name)

    def test_guest_movement_waits_for_the_clean_floor_plate_to_decode(self):
        pending = []
        self.page.clock.install()
        self.context.route('**/arcade-flat-floor-plate.png*', lambda route: pending.append(route))
        self.page.goto(self.url, wait_until='domcontentloaded')
        self.page.wait_for_function('window.CodaDeveloperConsole&&!CodaDeveloperConsole.ready()&&window.CodaArcadeQA')
        self.assertEqual(len(pending), 1)
        before = self.page.evaluate('CodaArcadeQA.characters().player')
        self.page.locator('#view').focus()
        self.page.keyboard.down('d')
        self.page.keyboard.press('Space')
        self.page.evaluate('publishFrames(8)')
        self.page.keyboard.up('d')
        waiting = self.page.evaluate('CodaArcadeQA.characters().player')
        self.assertEqual([waiting['x'], waiting['y'], waiting['jumps'], waiting['jumpHeight']],
                         [before['x'], before['y'], before['jumps'], 0])
        self.page.clock.fast_forward(31000)
        self.assertTrue(self.page.evaluate('CodaArcadeQA.floorGrid().slowLoading'))
        self.assertFalse(self.page.evaluate('CodaDeveloperConsole.ready()'))
        pending[0].fulfill(path=str(fixture.ROOT / fixture.FLOOR_PLATE), content_type='image/png')
        self.page.wait_for_function('CodaDeveloperConsole.ready()&&CodaArcadeQA.floorGrid()?.artReady')
        self.assertFalse(self.page.evaluate('CodaArcadeQA.floorGrid().slowLoading'))
        self.assertTrue(self.page.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        self.assertTrue(self.page.evaluate('CodaArcadeQA.place(950,420)'))
        self.page.keyboard.press('Space')
        self.page.wait_for_function('CodaArcadeQA.characters().player.jumpHeight>3')

    def test_failed_floor_load_shows_recovery_without_overwriting_saved_edits(self):
        saved = json.dumps(self.published)
        self.context.add_init_script('localStorage.setItem("codaWorldProjectV1",%s)' % json.dumps(saved))
        self.context.route('**/arcade-flat-floor-plate.png*', lambda route: route.abort('failed'))
        self.page.goto(self.url, wait_until='domcontentloaded')
        self.page.wait_for_function('window.CodaArcadeQA?.floorGrid()?.error')
        self.assertFalse(self.page.evaluate('CodaDeveloperConsole.ready()'))
        self.page.wait_for_function('document.querySelector("#status").textContent.includes("Reload to try again")')
        self.assertFalse(self.page.evaluate('CodaDeveloperConsole.save()'))
        self.assertEqual(self.page.evaluate('localStorage.getItem("codaWorldProjectV1")'), saved)

    def test_full_and_lite_keep_moving_disco_pins_beams_and_floor_sparkles(self):
        self.page.emulate_media(reduced_motion='no-preference')
        # The sparkle function lives in the game's private closure. This
        # fixture-only accessor samples its real output without changing it.
        source = (fixture.ROOT / 'world-preview.html').read_text()
        accessor = '''window.floorSparkleSample=()=>{
            const canvas=document.createElement('canvas');canvas.width=1672;canvas.height=941;
            const previous=g;try{g=canvas.getContext('2d');openFloorTwinkles(beatInfo());}finally{g=previous;}
            const pixels=canvas.getContext('2d').getImageData(823,340,725,459).data;
            let hash=2166136261,ink=0;for(let i=0;i<pixels.length;i++){hash=Math.imul(hash^pixels[i],16777619);if(i%4===3&&pixels[i])ink++;}
            return {hash:hash>>>0,ink};
          };\n'''
        hook = 'function openFloorTwinkles(beat){'
        self.assertEqual(source.count(hook), 1)
        source = source.replace(hook, accessor + hook, 1)
        self.context.route('**/world-preview.html*', lambda route: route.fulfill(
            status=200, content_type='text/html', body=source))
        self.load()
        self.page.clock.install()
        counts = {}
        for quality in ('full', 'lite'):
            with self.subTest(quality=quality):
                self.quality(quality)
                self.page.clock.run_for(80)
                before = self.page.evaluate('({lights:CodaArcadeQA.lighting(),sparks:floorSparkleSample()})')
                self.page.clock.run_for(600)
                after = self.page.evaluate('({lights:CodaArcadeQA.lighting(),sparks:floorSparkleSample()})')
                self.assertGreater(before['lights']['spotCount'], 0)
                self.assertGreater(before['lights']['rayCount'], 0)
                self.assertNotEqual(before['lights']['spots'], after['lights']['spots'])
                self.assertNotEqual(before['lights']['beams'], after['lights']['beams'])
                self.assertGreater(before['sparks']['ink'], 0)
                self.assertNotEqual(before['sparks']['hash'], after['sparks']['hash'])
                counts[quality] = before['lights']['spotCount']
        self.assertLess(counts['lite'], counts['full'])

    def test_mobile_portrait_and_landscape_keep_the_flat_floor_and_playable_world(self):
        self.context.close()
        self.context = self.browser.new_context(viewport={'width':390,'height':844},
                                                is_mobile=True, has_touch=True)
        self.context.route('https://**/*', lambda route: route.abort())
        self.context.add_init_script('''(()=>{
          localStorage.setItem('codaArcadeFXV1','off');
          window.publishFrames=count=>new Promise(resolve=>{
            const next=()=>{if(--count<=0)resolve();else requestAnimationFrame(next);};
            requestAnimationFrame(next);
          });
        })()''')
        self.page = self.context.new_page()
        self.page.set_default_timeout(12000)
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('console', lambda message: self.errors.append(message.text)
                     if 'Arcade frame error:' in message.text else None)
        self.page.on('response', lambda response: self.failures.append(response.url)
                     if response.status >= 400 and '127.0.0.1' in response.url
                     and not response.url.endswith('favicon.ico') else None)
        self.load()
        self.assertTrue(self.page.evaluate('navigator.maxTouchPoints>0'))
        for size in ({'width': 390, 'height': 844}, {'width': 844, 'height': 390}):
            with self.subTest(viewport=size):
                self.page.set_viewport_size(size)
                self.page.evaluate('publishFrames(3)')
                state = self.page.evaluate('({floor:CodaArcadeQA.floorGrid(),canPlay:CodaArcadeQA.classroomSession().canPlay})')
                self.assertTrue(state['floor']['ready'])
                self.assertEqual(state['floor']['mode'], 'flat-floor-plate')
                self.assertTrue(state['canPlay'])
                self.assertEqual(self.page.locator('#view').evaluate('canvas=>getComputedStyle(canvas).imageRendering'), 'pixelated')
                self.assertIsNone(self.page.evaluate('localStorage.getItem("codaWorldProjectV1")'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
