"""Exercise real WASD/arrow input and Space jumping in the connected world.

Jumping lifts the drawing while the player's walking position remains subject
to the same collision map. Tests use disposable browser profiles and real key
events; no network services or repository dependencies are needed.
"""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import math
from pathlib import Path
from world_navigation_helpers import advance_world, enter_room, open_destination, talk_to_musician, open_settings, close_settings
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class PlayerControlTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(
            ('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(
            executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width':1600, 'height':1000})
        self.context.route('https://**/*', lambda route:route.abort())
        self.context.add_init_script('''window.controlFrames=count=>new Promise(resolve=>{
          const next=()=>{if(--count<=0)resolve();else requestAnimationFrame(next);};
          requestAnimationFrame(next);
        });''')
        self.page = self.context.new_page()
        self.page.set_default_timeout(7000)
        self.errors, self.failures = [], []
        self.page.on('pageerror', lambda error:self.errors.append(str(error)))
        self.page.on('console', lambda message:self.errors.append(message.text)
                     if 'Arcade frame error:' in message.text else None)
        self.page.on('response', lambda response:self.failures.append(response.url)
                     if response.status>=400 and '127.0.0.1' in response.url
                     and not response.url.endswith('favicon.ico') else None)
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/world-preview.html',
                       wait_until='domcontentloaded')
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready() && CodaArcadeQA?.characters().spriteState.ready')
        open_settings(self.page)
        for _ in range(3):
            if self.page.locator('#fxBtn').inner_text().endswith('Off'):
                break
            self.page.locator('#fxBtn').click()
        self.assertTrue(self.page.locator('#fxBtn').inner_text().endswith('Off'))
        close_settings(self.page)
        self.place()

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], 'Control input must not cause frame or page errors')
        self.assertEqual(self.failures, [], 'Failed local resources')

    def state(self):
        return self.page.evaluate('({...CodaArcadeQA.characters().player,time:CodaArcadeQA.time()})')

    def frames(self, count):
        self.page.evaluate('controlFrames', count)

    def place(self, x=950, y=420):
        self.assertTrue(self.page.evaluate('([x,y])=>CodaArcadeQA.place(x,y)', [x,y]))
        self.page.locator('#view').focus()
        self.frames(2)

    def move(self, keys, frames=12):
        self.place()
        before = self.state()
        try:
            for key in keys:
                self.page.keyboard.down(key)
            self.frames(frames)
            after = self.state()
        finally:
            for key in keys:
                self.page.keyboard.up(key)
        return before, after

    def test_wasd_and_arrows_move_in_four_directions_without_faster_diagonals(self):
        for key, axis, sign in [('w','y',-1), ('a','x',-1), ('s','y',1), ('d','x',1),
                                ('ArrowUp','y',-1), ('ArrowLeft','x',-1),
                                ('ArrowDown','y',1), ('ArrowRight','x',1)]:
            with self.subTest(key=key):
                before, after = self.move([key])
                self.assertGreater((after[axis]-before[axis])*sign, 15)
                other = 'y' if axis=='x' else 'x'
                self.assertAlmostEqual(after[other], before[other], delta=.5)
                self.assertTrue(after['walking'])
        before, cardinal = self.move(['d'], 18)
        distance = math.hypot(cardinal['x']-before['x'], cardinal['y']-before['y'])
        cardinal_speed = distance / (cardinal['time']-before['time'])
        before, diagonal = self.move(['d','s'], 18)
        diagonal_distance = math.hypot(diagonal['x']-before['x'], diagonal['y']-before['y'])
        self.assertGreater(diagonal['x'], before['x']+15)
        self.assertGreater(diagonal['y'], before['y']+15)
        # RAF counts cover different elapsed times under shared browser load.
        # Compare distance per simulation second, including the game's dt cap.
        diagonal_speed = diagonal_distance / (diagonal['time']-before['time'])
        self.assertTrue(.8<diagonal_speed/cardinal_speed<1.2,
                        'Diagonal input must be normalized instead of moving sqrt(2) times faster')

    def test_space_makes_one_grounded_hop_without_scrolling_or_air_jumps(self):
        before = self.state()
        scroll = self.page.evaluate('scrollY')
        self.page.keyboard.down('Space')
        self.page.wait_for_function('CodaArcadeQA.characters().player.jumpHeight>5')
        rising = self.state()
        self.assertTrue(rising['airborne'])
        self.assertGreater(rising['jumpVelocity'], 0)
        self.assertEqual(rising['jumps'], before['jumps']+1)
        self.assertAlmostEqual(rising['x'], before['x'], delta=.1)
        self.assertAlmostEqual(rising['y'], before['y'], delta=.1)
        # A new press while airborne and repeats while held cannot launch again.
        self.page.keyboard.up('Space')
        self.page.keyboard.down('Space')
        self.page.keyboard.down('Space')
        self.page.wait_for_function('''()=>{const p=CodaArcadeQA.characters().player;
          return p.airborne && p.jumpVelocity<0}''')
        falling = self.state()
        self.assertGreater(falling['jumpHeight'], 0)
        self.assertLess(falling['jumpHeight'], 100)
        self.assertEqual(falling['jumps'], before['jumps']+1)
        self.page.wait_for_function('!CodaArcadeQA.characters().player.airborne')
        self.page.keyboard.down('Space')  # Browser key repeat after landing.
        self.frames(10)
        landed = self.state()
        self.assertEqual(landed['jumpHeight'], 0)
        self.assertEqual(landed['jumpVelocity'], 0)
        self.assertEqual(landed['jumps'], before['jumps']+1)
        self.assertAlmostEqual(self.page.evaluate('scrollY'), scroll, delta=.1)
        self.page.keyboard.up('Space')
        self.page.keyboard.press('Space')
        self.page.wait_for_function('CodaArcadeQA.characters().player.jumpHeight>0')
        self.assertEqual(self.state()['jumps'], before['jumps']+2)

    def test_walking_continues_midair_but_solid_map_collision_still_blocks_it(self):
        before = self.state()
        self.page.keyboard.down('d')
        self.page.keyboard.press('Space')
        self.frames(10)
        moving = self.state()
        self.page.keyboard.up('d')
        self.assertTrue(moving['airborne'])
        self.assertGreater(moving['jumpHeight'], 0)
        self.assertGreater(moving['x'], before['x']+20)
        self.assertAlmostEqual(moving['y'], before['y'], delta=.1)
        boundary = self.page.evaluate('''()=>{
          for(let y=190;y<800;y+=10)for(let x=120;x<1500;x+=10){
            if(CodaArcadeQA.walkable(x,y)&&CodaArcadeQA.walkable(x,y+10)&&
               !CodaArcadeQA.walkable(x,y-30)&&!CodaArcadeQA.physical(x,y-30))
              return {x,y,blockedY:y-30};
          }return null;
        }''')
        self.assertIsNotNone(boundary, 'The fixture must exercise an actual solid map boundary')
        self.place(boundary['x'], boundary['y'])
        self.page.keyboard.down('w')
        self.page.keyboard.press('Space')
        self.frames(12)
        blocked = self.state()
        self.page.keyboard.up('w')
        self.assertTrue(blocked['airborne'])
        self.assertGreaterEqual(blocked['y'], boundary['blockedY'],
                                'A hop must not let the walking position cross a solid wall')
        self.assertTrue(self.page.evaluate('([x,y])=>CodaArcadeQA.walkable(x,y)',
                                           [blocked['x'],blocked['y']]))

    def test_forms_buttons_dialogs_and_editors_do_not_trigger_gameplay_keys(self):
        before = self.state()
        self.page.locator('#levelBtn').focus()
        self.page.keyboard.press('Space')
        self.assertTrue(self.page.locator('#panel').is_visible(),
                        'Space must retain normal button activation')
        self.assertEqual(self.state()['jumps'],before['jumps'])
        self.page.locator('#panelClose').click()
        open_destination(self.page,'boutique');before=self.state()
        nickname = self.page.get_by_label('Arcade nickname', exact=True)
        nickname.fill('Keys ')
        nickname.press_sequentially('wasd ')
        self.frames(10)
        self.assertEqual(nickname.input_value(), 'Keys wasd ')
        current = self.state()
        self.assertEqual(current['jumps'], before['jumps'])
        self.assertEqual((current['x'],current['y']), (before['x'],before['y']))
        self.page.get_by_role('button', name='Cancel', exact=True).click()
        self.page.keyboard.press('F2')
        self.assertTrue(self.page.locator('#assetStudio').is_visible())
        self.page.locator('#view').focus()
        self.page.keyboard.press('Space')
        self.page.keyboard.down('w')
        self.frames(8)
        self.page.keyboard.up('w')
        current = self.state()
        self.assertEqual(current['jumps'], before['jumps'])
        self.assertEqual((current['x'],current['y']), (before['x'],before['y']))
        self.page.keyboard.press('F2')
        # A conversation is a gameplay pause even though it is not a full panel.
        self.assertTrue(self.page.evaluate('''()=>{
          for(const p of CodaArcadeQA.characters().npcs)if(!p.hidden)
            for(const [dx,dy]of [[30,0],[-30,0],[0,30],[0,-30]])
              if(CodaArcadeQA.place(p.x+dx,p.y+dy))return true;
          return false;
        }'''))
        self.frames(3)
        self.page.locator('#view').focus()
        self.page.keyboard.press('e')
        self.page.wait_for_function('CodaArcadeQA.conversation().open')
        self.page.locator('#view').focus()
        before_dialog = self.state()
        self.page.keyboard.press('Space')
        self.page.keyboard.down('d')
        self.frames(8)
        self.page.keyboard.up('d')
        current = self.state()
        self.assertEqual(current['jumps'], before_dialog['jumps'])
        self.assertEqual((current['x'],current['y']), (before_dialog['x'],before_dialog['y']))

    def test_a_cabinet_receives_its_keys_without_moving_or_jumping_the_world_player(self):
        self.page.route('**/song-machine/index.html*', lambda route:route.fulfill(
            content_type='text/html', body='''<!doctype html><body tabindex="0">Cabinet test
<script>window.gameKeys=[];addEventListener('keydown',event=>{
gameKeys.push(event.code);event.preventDefault();});</script>'''))
        game = self.page.evaluate('''CodaArcadeQA.worldObjects()
          .find(object=>object.name==='cabinet_song_machine').game''')
        self.place(game['npcX'],game['npcY'])
        self.page.keyboard.press('e')
        self.page.wait_for_function('CodaArcadeQA.menu().gameOpen')
        before = self.state()
        cabinet = self.page.frame_locator('#gameiframe').locator('body')
        cabinet.focus()
        self.page.keyboard.press('w')
        self.page.keyboard.press('Space')
        self.frames(8)
        keys = cabinet.evaluate('()=>window.gameKeys')
        self.assertIn('KeyW', keys)
        self.assertIn('Space', keys, 'The active game must retain its own Space controls')
        current = self.state()
        self.assertEqual(current['jumps'], before['jumps'])
        self.assertEqual((current['x'],current['y']), (before['x'],before['y']))

    def test_losing_focus_does_not_leave_a_movement_key_held(self):
        self.page.keyboard.down('d')
        self.frames(8)
        self.assertTrue(self.state()['walking'])
        self.page.evaluate("window.dispatchEvent(new Event('blur'))")
        self.frames(2)
        stopped = self.state()
        self.frames(10)
        current = self.state()
        self.page.keyboard.up('d')
        self.assertFalse(current['walking'])
        self.assertAlmostEqual(current['x'], stopped['x'], delta=.1)
        self.assertAlmostEqual(current['y'], stopped['y'], delta=.1)
        self.page.locator('#view').focus()
        self.page.keyboard.press('Space')
        self.page.wait_for_function('CodaArcadeQA.characters().player.airborne')


if __name__=='__main__':
    unittest.main(verbosity=2)
