"""Exercise the DJ dance game in the assembled arcade, with real keyboard timing."""
import importlib.util
import math
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('dance_world_fixture', Path(__file__).with_name('learning-world-browser.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)
from world_navigation_helpers import open_destination

KEYS = {'left': 'ArrowLeft', 'right': 'ArrowRight', 'up': 'ArrowUp', 'down': 'ArrowDown'}


class DanceFloorWorldTests(fixture.WorldBrowserCase):
    def setUp(self):
        super().setUp()
        self.page.wait_for_function('window.CodaArcadeQA?.danceGame?.()')
        self.page.on('console', lambda message: self.errors.append(message.text)
                     if message.type == 'error' and 'Dance callback failed:' in message.text else None)

    def state(self):
        return self.page.evaluate('CodaArcadeQA.danceGame()')

    def chooser(self):
        open_destination(self.page, 'dj')
        self.assertIn('Jukebox', self.page.locator('#panelTitle').inner_text())
        self.page.locator('[data-start-dance]').click()
        self.page.wait_for_function('CodaArcadeQA.danceGame().game.phase==="menu"')
        self.assertFalse(self.page.locator('#panel').is_visible())
        self.assertEqual(self.page.locator('[data-dance-mode]').count(), 3)

    def start(self, mode='normal'):
        self.chooser()
        before = self.page.evaluate('''()=>({position:CodaArcadeQA.position(),camera:CodaArcadeQA.camera(),
          npcs:CodaArcadeQA.characters().npcs,jukebox:CodaArcadeQA.jukebox()})''')
        self.page.locator('[data-dance-mode="' + mode + '"]').click()
        self.page.wait_for_function('CodaArcadeQA.danceGame().stage.active')
        self.page.wait_for_timeout(65)
        return before

    def floor_projection(self):
        return self.page.evaluate('''()=>{
          const cam=CodaArcadeQA.camera(),floor=CodaArcadeQA.danceGame().stage.floorBounds,
            image=document.querySelector('#view').getBoundingClientRect(),stage=document.querySelector('#worldStage').getBoundingClientRect(),
            viewport=stage.width>0&&stage.height>0?stage:image,
            project=(x,y)=>({x:image.left+(x-cam.x)*cam.zoom*image.width/1672,
              y:image.top+(y-cam.y)*cam.zoom*image.height/941});
          return {corners:[project(floor.x,floor.y),project(floor.x+floor.width,floor.y),
            project(floor.x+floor.width,floor.y+floor.height),project(floor.x,floor.y+floor.height)],
            viewport:{left:Math.max(0,viewport.left),right:Math.min(innerWidth,viewport.right),
              top:Math.max(0,viewport.top),bottom:Math.min(innerHeight,viewport.bottom)},
            overlay:(()=>{const b=document.querySelector('.dance-rhythm-game').getBoundingClientRect();
              return {left:b.left,right:b.right,top:b.top,bottom:b.bottom};})()};
        }''')

    def assert_floor_fits(self):
        projection = self.floor_projection()
        for corner in projection['corners']:
            self.assertGreaterEqual(corner['x'], projection['viewport']['left'] - .5)
            self.assertLessEqual(corner['x'], projection['viewport']['right'] + .5)
            self.assertGreaterEqual(corner['y'], projection['viewport']['top'] - .5)
            self.assertLessEqual(corner['y'], projection['viewport']['bottom'] + .5)
        self.assertGreaterEqual(projection['overlay']['left'], 0)
        self.assertLessEqual(projection['overlay']['right'], self.page.viewport_size['width'])
        self.assertGreaterEqual(min(corner['y'] for corner in projection['corners']),
                                projection['overlay']['bottom'] - .5,
                                'The rhythm panel must leave the colored dance floor visible.')

    def assert_directional_pad(self):
        boxes=self.page.locator('[data-dance-arrow]').evaluate_all('''buttons=>Object.fromEntries(buttons.map(button=>{
          const b=button.getBoundingClientRect();return [button.dataset.danceArrow,
            {x:b.x,y:b.y,width:b.width,height:b.height,cx:b.x+b.width/2,cy:b.y+b.height/2}];
        }))''')
        self.assertEqual(set(boxes),{'up','down','left','right'})
        up,down,left,right=(boxes[key] for key in ['up','down','left','right'])
        self.assertAlmostEqual(up['cx'],down['cx'],delta=1)
        self.assertAlmostEqual(left['cy'],right['cy'],delta=1)
        self.assertLess(left['cx'],up['cx'])
        self.assertLess(up['cx'],right['cx'])
        self.assertLessEqual(up['y']+up['height'],left['y']+1)
        self.assertLessEqual(left['y']+left['height'],down['y']+1)
        for box in boxes.values():
            self.assertGreaterEqual(box['width'],44)
            self.assertGreaterEqual(box['height'],44)
            self.assertGreaterEqual(box['x'],0)
            self.assertGreaterEqual(box['y'],0)
            self.assertLessEqual(box['x']+box['width'],self.page.viewport_size['width']+1)
            self.assertLessEqual(box['y']+box['height'],self.page.viewport_size['height']+1)

    def press_at_note(self, note, direction=None, animate=False):
        timing = self.page.evaluate('''beat=>{
          const state=CodaArcadeQA.danceGame().game.engine;
          return {target:state.startedAt+(state.chart.countInBeats+beat)*state.beatSeconds,
            now:performance.now()/1000};
        }''', note['beat'])
        delay = timing['target'] - timing['now']
        self.assertGreater(delay, -.08, 'The real keyboard action must reach a live note, not replay a past score.')
        if self.page.evaluate('typeof globalThis.__pwClock!=="undefined"'):
            advance=self.page.clock.run_for if animate else self.page.clock.fast_forward
            advance(max(0,round(delay*1000)))
        elif delay > .012:
            self.page.wait_for_timeout((delay - .012) * 1000)
        self.page.keyboard.press(KEYS[direction or note['direction']])

    def test_the_physical_dj_offers_three_difficulties_and_stages_three_unique_npcs(self):
        for mode, bpm in [('easy', 80), ('normal', 92), ('hard', 88)]:
            with self.subTest(mode=mode):
                before = self.start(mode)
                state = self.state()
                self.assertTrue(state['active'])
                self.assertEqual(state['game']['difficulty'], mode)
                self.assertEqual(state['game']['engine']['bpm'], bpm)
                self.assertEqual(state['game']['engine']['chart']['bars'], 8)
                dancers = state['stage']['dancers']
                self.assertEqual(len(dancers), 4)
                self.assertEqual(sum(dancer['isPlayer'] for dancer in dancers), 1)
                ids = [dancer['id'] for dancer in dancers if not dancer['isPlayer']]
                self.assertEqual(len(set(ids)), 3)
                available = {person['id'] for person in before['npcs'] if not person['hidden']}
                self.assertTrue(set(ids).issubset(available))
                player = next(dancer for dancer in dancers if dancer['isPlayer'])
                self.assertAlmostEqual(player['base']['x'], 395, delta=24)
                self.assertAlmostEqual(player['base']['y'], 755, delta=24)
                for dancer in dancers:
                    self.assertTrue(self.page.evaluate('p=>CodaArcadeQA.walkable(p.x,p.y)', dancer['base']))
                    self.assertEqual(state['stage']['poses'][dancer['id']]['facing'], 'down')
                for index, dancer in enumerate(dancers):
                    for other in dancers[index+1:]:
                        self.assertGreaterEqual(math.hypot(dancer['base']['x']-other['base']['x'],
                                                          dancer['base']['y']-other['base']['y']), 44)
                bystanders = self.page.evaluate('CodaArcadeQA.characters().npcs')
                for person in bystanders:
                    if person['hidden'] or person['id'] in ids:
                        continue
                    for dancer in dancers:
                        self.assertGreaterEqual(math.hypot(person['x']-dancer['base']['x'],
                                                          person['y']-dancer['base']['y']), 44,
                                                'A nonparticipant must not stand inside a dancer.')
                self.assert_floor_fits()
                self.assert_directional_pad()
                self.page.keyboard.press('Escape')
                self.assertFalse(self.state()['active'])

    def test_correct_and_wrong_arrow_inputs_make_visible_steps_and_a_recovering_fall(self):
        self.page.clock.install()
        self.page.clock.pause_at(self.page.evaluate('Date.now()/1000')+1)
        self.start('normal')
        state = self.state()
        notes = state['game']['engine']['notes']
        first,second = notes[:2]
        staff = self.page.locator('.dance-rhythm-staff')
        self.assertTrue(staff.is_visible())
        self.page.wait_for_function('Number(document.querySelector(".dance-rhythm-staff").dataset.visibleNotes)>0')
        self.press_at_note(first)
        self.assertEqual(self.state()['game']['engine']['hits'], 1)
        self.page.clock.run_for(100)
        stepped = self.state()['stage']
        self.assertEqual(stepped['poses']['player']['direction'], first['direction'])
        self.assertFalse(stepped['poses']['player']['falling'])
        self.assertEqual(stepped['dancers'][0]['steps'], 1)
        self.assertGreater(math.hypot(stepped['poses']['player']['x']-stepped['dancers'][0]['base']['x'],
                                      stepped['poses']['player']['y']-stepped['dancers'][0]['base']['y']), .5)
        wrong = next(direction for direction in KEYS if direction != second['direction'])
        self.press_at_note(second, wrong, animate=True)
        failed = self.state()
        self.assertEqual(failed['game']['engine']['wrongInputs'], 1)
        self.assertTrue(failed['stage']['poses']['player']['falling'])
        self.assertEqual(failed['game']['engine']['hits'], 1)
        self.page.clock.run_for(120)
        falling = self.state()['stage']
        self.assertGreater(abs(falling['poses']['player']['rotation']), .1)
        for dancer in falling['dancers']:
            if dancer['isPlayer']:
                continue
            self.assertGreaterEqual(dancer['steps'], 2, 'The other dancers keep the beat when the player misses.')
            self.assertFalse(falling['poses'][dancer['id']]['falling'])
        # Randomized charts may have more arrows before the fall ends. Hit
        # those arrows too so an unrelated missed note cannot restart it.
        engine=state['game']['engine']
        recovery_end=engine['startedAt']+(engine['chart']['countInBeats']+second['beat'])*engine['beatSeconds']+.8
        for note in notes[2:]:
            target=engine['startedAt']+(engine['chart']['countInBeats']+note['beat'])*engine['beatSeconds']
            if target>recovery_end:break
            self.press_at_note(note, animate=True)
        now=self.page.evaluate('performance.now()/1000')
        self.page.clock.run_for(max(0,round((recovery_end-now)*1000)))
        self.assertFalse(self.state()['stage']['poses']['player']['falling'])
        # Capture after the timed presses; screenshots can take longer than a beat.
        self.page.screenshot(path='/tmp/coda-dance-desktop.png')
        self.page.keyboard.press('Escape')

    def test_phone_keeps_the_whole_floor_visible_and_replaces_world_movement_with_touch_arrows(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.wait_for_function('CodaArcadeQA.touch().mobile')
        before = self.start('easy')
        self.assert_floor_fits()
        self.assert_directional_pad()
        buttons = self.page.locator('[data-dance-arrow]')
        self.assertEqual(buttons.count(), 4)
        for button in buttons.all():
            bounds = button.bounding_box()
            self.assertGreaterEqual(bounds['width'], 44)
            self.assertGreaterEqual(bounds['height'], 44)
            self.assertGreaterEqual(bounds['x'], 0)
            self.assertLessEqual(bounds['x']+bounds['width'], 390)
        self.assertFalse(self.page.locator('body').evaluate('element=>element.scrollWidth>innerWidth'))
        self.assertFalse(self.page.evaluate('CodaArcadeQA.touch().visible'))
        engine = self.state()['game']['engine']
        first = engine['notes'][0]
        control = self.page.locator('[data-dance-arrow="'+first['direction']+'"]').bounding_box()
        timing = self.page.evaluate('''beat=>{const engine=CodaArcadeQA.danceGame().game.engine;
          return (engine.startedAt+(engine.chart.countInBeats+beat)*engine.beatSeconds-performance.now()/1000)*1000;}''', first['beat'])
        if timing > 15:
            self.page.wait_for_timeout(timing-15)
        self.page.mouse.click(control['x']+control['width']/2, control['y']+control['height']/2)
        self.assertEqual(self.state()['game']['engine']['hits'], 1)
        self.page.screenshot(path='/tmp/coda-dance-phone.png')
        for width,height in [(844,390),(320,568)]:
            with self.subTest(width=width,height=height):
                self.page.set_viewport_size({'width':width,'height':height})
                self.page.wait_for_timeout(80)
                self.assert_floor_fits()
                self.assert_directional_pad()
        self.page.locator('[data-dance-close]').click()
        self.assertFalse(self.state()['active'])
        self.assertEqual(self.page.evaluate('CodaArcadeQA.position()'), before['position'])

    def test_closing_restores_the_original_camera_player_npcs_and_looping_jukebox_track(self):
        open_destination(self.page, 'dj')
        self.page.locator('[data-jukebox-track="neon-afterhours"]').click()
        self.page.wait_for_function('CodaArcadeQA.jukebox().playing')
        before = self.page.evaluate('''()=>({position:CodaArcadeQA.position(),camera:CodaArcadeQA.camera(),
          npcs:CodaArcadeQA.characters().npcs,jukebox:CodaArcadeQA.jukebox()})''')
        self.page.locator('[data-start-dance]').click()
        self.page.locator('[data-dance-mode="easy"]').click()
        self.page.wait_for_function('CodaArcadeQA.danceGame().stage.active')
        dancers = self.state()['stage']['dancers']
        self.assertFalse(self.page.evaluate('CodaArcadeQA.jukebox().playing'))
        restored = self.page.evaluate('''()=>{
          document.querySelector('[data-dance-close]').click();
          return {game:CodaArcadeQA.danceGame(),position:CodaArcadeQA.position(),camera:CodaArcadeQA.camera(),
            npcs:CodaArcadeQA.characters().npcs};
        }''')
        self.assertFalse(restored['game']['active'])
        self.assertFalse(restored['game']['stage']['active'])
        self.assertFalse(restored['game']['game']['audioPlaying'])
        self.assertEqual(restored['position'], before['position'])
        for key in ['x','y','zoom','targetZoom']:
            self.assertEqual(restored['camera'][key], before['camera'][key])
        prior_npcs = {person['id']: person for person in before['npcs']}
        after_npcs = {person['id']: person for person in restored['npcs']}
        for dancer in before['npcs']:
            for key in ['x','y','facing','activity','hidden']:
                self.assertEqual(after_npcs[dancer['id']][key], prior_npcs[dancer['id']][key])
        self.page.wait_for_function('CodaArcadeQA.jukebox().playing&&CodaArcadeQA.jukebox().looping')
        resumed = self.page.evaluate('CodaArcadeQA.jukebox()')
        self.assertEqual(resumed['title'], before['jukebox']['title'])
        self.assertEqual(resumed['source'], before['jukebox']['source'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
