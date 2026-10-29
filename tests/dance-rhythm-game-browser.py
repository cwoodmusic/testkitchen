"""The dance game's real notation, input, audio lifecycle, and phone controls."""
import json
import mimetypes
from itertools import groupby
from pathlib import Path
import sys
import unittest
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://cwoodmusic.github.io/coda-arcade/'
HARNESS = '''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="music-notation.css"><link rel="stylesheet" href="dance-rhythm-game.css">
<style>body{margin:0;background:#0f2130;color:white}#arcade{width:100vw;height:100vh}#launch{margin:450px 20px 0}</style>
<main id="arcade"><button id="launch">Talk to DJ</button></main>
<script src="music-notation.js"></script><script src="rhythm-beaming.js"></script>
<script src="dance-rhythm-engine.js"></script><script src="dance-rhythm-game.js"></script><script>
window.gameTime=100;window.canPlay=true;window.blockStart=false;window.steps=[];window.misses=[];window.cues=[];window.results=[];window.closes=[];
window.game=CodaDanceRhythmGame.create({now:()=>gameTime,seed:123,canPlay:()=>canPlay,onStart:()=>!blockStart,onStep:e=>steps.push(e),onMiss:e=>misses.push(e),onCue:e=>cues.push(e),onFinish:e=>results.push(e),onClose:e=>closes.push(e)});
launch.onclick=()=>game.open();
window.advanceDance=async seconds=>{gameTime=seconds;await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);};
</script>'''


class DanceRhythmGameTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.p = sync_playwright().start()
        cls.browser = cls.p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.p.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width':1200,'height':900})
        self.context.route('https://**/*',lambda route:route.abort())
        self.context.route(BASE+'**',self.route)
        self.page = self.context.new_page()
        self.errors=[]
        self.missing=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.on('response',lambda response:self.missing.append(response.url) if response.status>=400 else None)
        self.page.goto(BASE+'dance-test.html',wait_until='domcontentloaded')
        self.page.locator('#launch').click()

    def route(self,route):
        name = urlparse(route.request.url).path.removeprefix('/coda-arcade/')
        if name=='dance-test.html':
            return route.fulfill(status=200,content_type='text/html',body=HARNESS)
        file=(ROOT/name).resolve()
        if not file.is_relative_to(ROOT) or not file.is_file():
            return route.fulfill(status=404,body='Missing resource')
        route.fulfill(path=str(file),content_type=mimetypes.guess_type(str(file))[0] or 'application/octet-stream')

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors,[])
        self.assertEqual(self.missing,[])

    def state(self):
        return self.page.evaluate('game.getState()')

    def start(self,mode='normal'):
        self.page.locator('[data-dance-mode="'+mode+'"]').click()
        self.assertEqual(self.state()['phase'],'countin')

    def advance(self,value):
        self.page.evaluate('advanceDance',value)

    def event_time(self,event):
        state=self.state()['engine']
        return state['startedAt']+(4+event['beat'])*state['beatSeconds']

    def assert_directional_pad(self):
        boxes=self.page.locator('[data-dance-arrow]').evaluate_all('''buttons=>Object.fromEntries(buttons.map(button=>{
          const box=button.getBoundingClientRect();return [button.dataset.danceArrow,
            {x:box.x,y:box.y,width:box.width,height:box.height,cx:box.x+box.width/2,cy:box.y+box.height/2}];
        }))''')
        self.assertEqual(set(boxes),{'up','down','left','right'})
        up,down,left,right=(boxes[direction] for direction in ['up','down','left','right'])
        self.assertAlmostEqual(up['cx'],down['cx'],delta=1)
        self.assertAlmostEqual(left['cy'],right['cy'],delta=1)
        self.assertLess(left['cx'],up['cx'])
        self.assertLess(up['cx'],right['cx'])
        self.assertLessEqual(up['y']+up['height'],left['y']+1)
        self.assertLessEqual(left['y']+left['height'],down['y']+1)
        for direction,box in boxes.items():
            self.assertGreaterEqual(box['width'],44,direction)
            self.assertGreaterEqual(box['height'],44,direction)
            self.assertGreaterEqual(box['x'],0,direction)
            self.assertGreaterEqual(box['y'],0,direction)
            self.assertLessEqual(box['x']+box['width'],self.page.viewport_size['width']+1,direction)
            self.assertLessEqual(box['y']+box['height'],self.page.viewport_size['height']+1,direction)

    def test_directional_pad_matches_compass_on_desktop_and_phone_orientations(self):
        self.start('hard')
        self.assertEqual(self.state()['engine']['bpm'],88)
        for width,height in [(1200,900),(390,844),(844,390),(320,568)]:
            with self.subTest(width=width,height=height):
                self.page.set_viewport_size({'width':width,'height':height})
                self.page.wait_for_timeout(40)
                self.assert_directional_pad()
                self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))

    def test_real_key_timing_repeat_guard_fall_and_end_cleanup(self):
        self.start()
        state=self.state()['engine']
        self.assertEqual(self.page.locator('.dance-rhythm-count').inner_text(),'1')
        self.advance(state['startedAt']+3*state['beatSeconds'])
        self.assertEqual(self.page.locator('.dance-rhythm-count').inner_text(),'GO')
        note=state['notes'][0]
        self.advance(self.event_time(note))
        key='Arrow'+note['direction'].capitalize()
        self.page.keyboard.down(key)
        self.page.keyboard.down(key)
        self.assertEqual(self.state()['engine']['hits'],1)
        self.assertEqual(self.state()['engine']['misses'],0,'Auto-repeat must not make a second tap')
        self.page.keyboard.up(key)
        second=state['notes'][1]
        self.advance(self.event_time(second))
        wrong=next(direction for direction in ['up','down','left','right'] if direction!=second['direction'])
        self.page.keyboard.press('Arrow'+wrong.capitalize())
        self.assertEqual(self.page.evaluate('misses.length'),1)
        self.assertIn('Whoops',self.page.locator('.dance-rhythm-feedback').inner_text())
        self.advance(state['startedAt']+36*state['beatSeconds']+.01)
        self.assertEqual(self.state()['phase'],'result')
        self.assertFalse(self.state()['audioPlaying'])
        self.assertEqual(self.page.evaluate('results.length'),1)
        self.advance(self.page.evaluate('gameTime')+10)
        self.assertEqual(self.page.evaluate('results.length'),1)
        self.page.locator('[data-dance-done]').click()
        self.assertFalse(self.state()['open'])
        self.assertEqual(self.page.evaluate('document.activeElement.id'),'launch')

    def test_perfect_round_visible_notation_beams_and_npc_cues(self):
        self.start('hard')
        self.assertTrue(self.page.evaluate('async()=>{await CodaMusicNotation.load(document);return CodaMusicNotation.isReady(document)}'))
        self.assertGreater(int(self.page.locator('.dance-rhythm-staff').get_attribute('data-beam-groups')),0)
        state=self.state()['engine']
        sixteenth_runs=[list(notes) for is_sixteenth,notes in groupby(
            state['chart']['events'],lambda note:not note['rest'] and note['duration']==.25)
            if is_sixteenth]
        self.assertTrue({2,4}.issubset({len(notes) for notes in sixteenth_runs}))
        for notes in sixteenth_runs:
            self.assertEqual(len({note['direction'] for note in notes}),1,
                             'Quick sixteenth taps must stay on the same arrow.')
        for note in state['notes']:
            self.advance(self.event_time(note))
            self.page.keyboard.press('Arrow'+note['direction'].capitalize())
        self.advance(state['startedAt']+36*state['beatSeconds']+.01)
        result=self.page.evaluate('results[0]')
        self.assertTrue(result['perfect'])
        self.assertEqual(result['accuracy'],1)
        self.assertEqual(result['hits'],len(state['notes']))
        self.assertEqual(self.page.evaluate('cues.length'),len(state['notes']))
        self.assertEqual(self.page.evaluate('cues.map(cue=>cue.direction)'),
                         [note['direction'] for note in state['notes']])
        self.assertIn('Perfect dance!',self.page.locator('.dance-rhythm-result').inner_text())

    def test_mobile_arrow_buttons_contextmenu_resize_and_profile_pause(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.start('easy')
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        note=self.state()['engine']['notes'][0]
        self.advance(self.event_time(note))
        control=self.page.locator('[data-dance-arrow="'+note['direction']+'"]')
        box=control.bounding_box()
        self.assertGreaterEqual(box['height'],48)
        self.assertGreaterEqual(box['width'],48)
        control.click()
        self.assertEqual(self.state()['engine']['hits'],1)
        self.assertFalse(control.evaluate("node=>node.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))"))
        self.page.screenshot(path='/tmp/dance-rhythm-phone.png')
        self.page.evaluate('canPlay=false')
        self.advance(self.page.evaluate('gameTime')+.1)
        self.assertFalse(self.state()['open'])
        self.assertFalse(self.state()['audioPlaying'])
        self.assertEqual(self.page.evaluate('closes.at(-1).reason'),'profile-changed')

    def test_escape_and_background_leave_no_running_audio_or_held_controls(self):
        self.start()
        self.assertTrue(self.state()['audioPlaying'])
        self.page.keyboard.press('Escape')
        self.assertFalse(self.state()['open'])
        self.assertFalse(self.state()['audioPlaying'])
        self.page.locator('#launch').click()
        self.start()
        self.page.evaluate('dispatchEvent(new Event("blur"))')
        self.assertFalse(self.state()['open'])
        self.assertFalse(self.state()['audioPlaying'])
        self.assertEqual(self.page.evaluate('closes.at(-1).reason'),'paused')

    def test_blocked_dance_floor_keeps_the_menu_and_stops_audio(self):
        self.page.evaluate('blockStart=true')
        self.page.locator('[data-dance-mode="easy"]').click()
        self.assertEqual(self.state()['phase'],'menu')
        self.assertFalse(self.state()['audioPlaying'])
        self.assertIsNone(self.state()['engine'])
        self.assertIn('more space',self.page.locator('.dance-rhythm-feedback').inner_text())
        self.page.evaluate('blockStart=false')
        self.start('easy')
        self.assertTrue(self.state()['audioPlaying'])


if __name__=='__main__':
    unittest.main(verbosity=2)
