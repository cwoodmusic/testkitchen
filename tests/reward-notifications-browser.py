"""Exercise reward cards with the real DOM, keyboard focus, and phone layouts."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
HARNESS = """<!doctype html>
<html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reward notification browser fixture</title>
<link rel="stylesheet" href="/reward-notifications.css">
<style>
  :root { --coda-touch-controls-height: 174px; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100dvh; background: #080b24; color: white; }
  #outside { position: absolute; top: 12px; left: 12px; min-height: 44px; }
  #fakePad { position: fixed; inset: auto 0 0; height: var(--coda-touch-controls-height);
             background: #185085; }
  #fakePad[hidden] { display: none; }
  @media (orientation: landscape) { :root { --coda-touch-controls-height: 144px; } }
</style>
<button id="outside">Keep playing</button>
<div id="fakePad" hidden>Touch movement controls</div>
<script src="/reward-notifications.js"></script>
<script>
  window.touchState = { visible: false };
  window.actionLog = [];
  window.configurePopups = function (options = {}) {
    if (window.popups) window.popups.dispose();
    window.popups = createCodaRewardNotifications({
      duration: options.duration || 5500,
      getTouchState: () => window.touchState,
      onAction: (action, item) => window.actionLog.push({ action, item })
    });
  };
  configurePopups();
  document.querySelector('#outside').focus();
</script></html>"""


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path != '/reward-popup-fixture':
            return super().do_GET()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(HARNESS.encode())


class RewardNotificationBrowserTests(unittest.TestCase):
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
        self.errors = []
        self.failed_assets = []
        self.context = None
        self.load_fixture()

    def load_fixture(self, viewport=None, mobile=False, reduced_motion='no-preference'):
        if self.context:
            self.context.close()
        self.context = self.browser.new_context(
            viewport=viewport or {'width': 1200, 'height': 850},
            is_mobile=mobile, has_touch=mobile, device_scale_factor=1,
            reduced_motion=reduced_motion)
        self.page = self.context.new_page()
        self.page.set_default_timeout(5000)
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('response', lambda response: self.failed_assets.append(
            f'{response.status} {response.url}') if response.status >= 400
            and not response.url.endswith('/favicon.ico') else None)
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/reward-popup-fixture')
        self.page.wait_for_function('window.popups && typeof popups.getState === "function"')

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], 'Reward cards must not cause browser exceptions')
        self.assertEqual(self.failed_assets, [], 'Reward card assets must load locally')

    def wait_for_current(self, item_id):
        self.page.wait_for_function(
            '(id) => (popups.getState().current?.id || null) === id', arg=item_id)

    def dismiss(self):
        self.page.get_by_role('button', name='Dismiss notification', exact=True).click()

    def test_queue_deduplicates_and_actions_do_not_steal_game_focus(self):
        self.page.evaluate("""() => {
          popups.notify({id:'first',kind:'achievement',title:'First skill',
            message:'You earned 50 XP',action:{id:'profile',label:'View profile'}});
          popups.notify({id:'second',kind:'mission',title:'Visit Bach',
            message:'Go back to Bach to collect your Notes.'});
          popups.notify({id:'first',kind:'achievement',title:'Duplicate'});
          popups.notify({id:'silent',kind:'achievement',title:'Previously earned',announce:false});
        }""")
        self.wait_for_current('first')
        self.assertEqual(self.page.evaluate('document.activeElement.id'), 'outside')
        self.assertEqual(len(self.page.evaluate('popups.getState().queued')), 1)
        self.assertEqual(self.page.locator('.reward-toast').count(), 1)
        self.page.get_by_role('button', name='View profile', exact=True).click()
        log = self.page.evaluate('actionLog')
        self.assertEqual(len(log), 1)
        self.assertEqual(log[0]['action']['id'], 'profile')
        self.assertEqual(log[0]['item']['id'], 'first')
        self.wait_for_current('second')
        self.dismiss()
        self.wait_for_current(None)
        self.page.evaluate("popups.notify({id:'first',title:'Duplicate after dismissal'})")
        self.assertIsNone(self.page.evaluate('popups.getState().current'))
        self.assertEqual(self.page.locator('.reward-toast').count(), 0)

    def test_expiry_pauses_for_keyboard_and_pointer_and_disposal_removes_cards(self):
        self.page.evaluate("""() => {
          configurePopups({duration:250});
          popups.notify({id:'paused',title:'Take time to read',message:'Keyboard and touch friendly'});
        }""")
        self.wait_for_current('paused')
        close = self.page.get_by_role('button', name='Dismiss notification', exact=True)
        close.focus()
        self.page.wait_for_timeout(450)
        self.assertEqual(self.page.evaluate('popups.getState().current.id'), 'paused')
        self.page.locator('#outside').focus()
        self.page.mouse.move(0, 0)
        self.wait_for_current(None)
        self.page.evaluate("popups.notify({id:'touch-paused',title:'Touch and read'})")
        self.wait_for_current('touch-paused')
        target = self.page.get_by_role('button', name='Dismiss notification', exact=True).bounding_box()
        self.page.mouse.move(target['x'] + target['width'] / 2, target['y'] + target['height'] / 2)
        self.page.mouse.down()
        self.page.locator('#outside').focus()
        # Drag outside: hover has ended, but the held pointer must still pause expiry.
        self.page.mouse.move(0, 0)
        self.page.wait_for_timeout(450)
        self.assertEqual(self.page.evaluate('popups.getState().current.id'), 'touch-paused')
        self.page.mouse.up()
        self.wait_for_current(None)
        self.page.evaluate("""() => {
          popups.notify({id:'dispose-current',title:'Current'});
          popups.notify({id:'dispose-queued',title:'Queued'});
          popups.dispose();
        }""")
        self.assertEqual(self.page.locator('.reward-toast').count(), 0)
        self.page.wait_for_timeout(350)
        self.assertEqual(self.page.locator('.reward-toast').count(), 0)

    def assert_phone_geometry(self):
        self.page.wait_for_function("""() => {
          const card = document.querySelector('.reward-toast')?.getBoundingClientRect();
          const pad = document.querySelector('#fakePad').getBoundingClientRect();
          return card && card.bottom <= pad.top - 8;
        }""")
        geometry = self.page.evaluate("""() => {
          const card=document.querySelector('.reward-toast').getBoundingClientRect();
          return {left:card.left,right:card.right,top:card.top,bottom:card.bottom,
            width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,
            targets:[...document.querySelectorAll('.reward-toast button')].map(button=>{
              const rect=button.getBoundingClientRect(); return {width:rect.width,height:rect.height};
            })};
        }""")
        self.assertGreaterEqual(geometry['left'], 0)
        self.assertLessEqual(geometry['right'], geometry['width'])
        self.assertGreaterEqual(geometry['top'], 0)
        self.assertLessEqual(geometry['bottom'], geometry['height'])
        self.assertFalse(geometry['overflow'], 'Reward cards must fit the phone viewport')
        self.assertGreaterEqual(len(geometry['targets']), 2)
        for target in geometry['targets']:
            # Chromium can report 43.99997 while a translated 44px target animates.
            self.assertGreaterEqual(target['width'], 43.99)
            self.assertGreaterEqual(target['height'], 43.99)

    def test_phone_cards_clear_movement_controls_in_both_orientations(self):
        self.load_fixture({'width': 390, 'height': 844}, mobile=True)
        self.page.evaluate("""() => {
          touchState.visible=true; document.querySelector('#fakePad').hidden=false;
          popups.notify({id:'phone',kind:'mission',title:'A wonderful musical achievement',
            message:'Go back to Professor Haydn in the music classroom to collect 120 Notes.',
            action:{id:'missions',label:'View active missions'}});
        }""")
        self.wait_for_current('phone')
        self.assert_phone_geometry()
        self.page.set_viewport_size({'width': 844, 'height': 390})
        self.page.evaluate("document.documentElement.style.setProperty('--coda-touch-controls-height','200px')")
        self.assert_phone_geometry()
        self.assertGreaterEqual(self.page.locator('.reward-toast').bounding_box()['y'], 48,
                                'A landscape reward must leave the room header visible')
        self.page.evaluate("touchState.visible=false; document.querySelector('#fakePad').hidden=true")
        self.page.wait_for_function("""() => {
          const card=document.querySelector('.reward-toast').getBoundingClientRect();
          return card.bottom > innerHeight-30 && card.bottom <= innerHeight;
        }""")

    def test_completion_collecting_and_achievement_copy_are_accessible(self):
        self.load_fixture(reduced_motion='reduce')
        self.page.evaluate("""() => popups.missionComplete({id:'bach-win',
          title:'Counterpoint champion',giver:'Bach',reward:90})""")
        self.page.wait_for_function('popups.getState().current !== null')
        text = self.page.locator('.reward-toast').inner_text()
        self.assertIn('Bach', text)
        self.assertRegex(text, r'90\s+Notes')
        self.assertRegex(text.lower(), r'(go back|return)')
        self.assertNotIn('collected', text.lower())
        self.assertEqual(self.page.evaluate('document.activeElement.id'), 'outside')
        self.assertGreater(self.page.locator('[role="status"][aria-live="polite"]').count(), 0)
        self.assertEqual(self.page.locator('[role="alert"], [aria-modal="true"]').count(), 0)
        motion = self.page.locator('.reward-toast').evaluate("""element => {
          const style=getComputedStyle(element);
          return {animation:style.animationName,transitions:style.transitionDuration.split(',').map(parseFloat)};
        }""")
        self.assertEqual(motion['animation'], 'none')
        self.assertTrue(all(duration <= .01 for duration in motion['transitions']))
        self.dismiss()
        self.page.evaluate("""() => {
          popups.missionReward({id:'bach-win',title:'Counterpoint champion',notes:90,xp:100});
          popups.achievement({id:'note-naming',title:'Note names',xp:50});
        }""")
        self.page.wait_for_function('popups.getState().current !== null')
        claimed = self.page.locator('.reward-toast').inner_text()
        self.assertRegex(claimed.lower(), r'collected\s+90\s+notes')
        self.dismiss()
        self.page.wait_for_function("document.querySelector('.reward-toast')?.textContent.includes('Note names')")
        earned = self.page.locator('.reward-toast').inner_text()
        self.assertRegex(earned, r'50\s+XP')
        self.assertNotRegex(earned, r'\d+\s+Notes')

    def test_short_landscape_preserves_complete_buttons_above_real_touch_actions(self):
        self.load_fixture({'width': 568, 'height': 320}, mobile=True, reduced_motion='reduce')
        self.page.add_style_tag(url=f'http://127.0.0.1:{self.server.server_port}/mobile-controls.css')
        self.page.evaluate("""() => {
          document.documentElement.style.setProperty('--coda-touch-controls-height','220px');
          const pad=document.createElement('div');pad.className='coda-touch-controls';
          pad.innerHTML='<div class="coda-dpad">'+Array.from({length:9},(_,i)=>
            '<button class="coda-touch-button">'+i+'</button>').join('')+'</div>'+
            '<div class="coda-touch-actions"><button class="coda-touch-button">Enter</button>'+
            '<button class="coda-touch-button">Jump</button>'+
            '<button class="coda-touch-button coda-touch-emote">Emote</button></div>';
          document.body.append(pad);touchState.visible=true;
          popups.missionComplete({id:'short-phone',title:'A wonderful musical achievement',
            giver:'Professor Haydn in the music classroom',reward:120,
            action:{id:'missions',label:'View active missions'}});
        }""")
        self.wait_for_current('mission-complete:short-phone')
        self.page.wait_for_function("document.querySelector('.reward-notifications').classList.contains('has-touch-controls')")
        geometry=self.page.evaluate("""() => {
          const card=document.querySelector('.reward-toast').getBoundingClientRect();
          const rect=node=>node.getBoundingClientRect().toJSON();
          return {card:card.toJSON(),buttons:[...document.querySelectorAll('.reward-toast button')].map(rect),
            controls:[...document.querySelectorAll('.coda-touch-button')].map(rect)};
        }""")
        card=geometry['card']
        self.assertGreaterEqual(card['top'],48,'The room header must remain visible')
        self.assertLessEqual(card['bottom'],320)
        self.assertEqual(len(geometry['buttons']),2)
        for button in geometry['buttons']:
            self.assertGreaterEqual(button['width'],44)
            self.assertGreaterEqual(button['height'],44)
            self.assertGreaterEqual(button['top'],card['top'])
            self.assertLessEqual(button['bottom'],card['bottom'],'No popup button may be clipped')
            for control in geometry['controls']:
                overlaps=(button['left']<control['right'] and button['right']>control['left']
                          and button['top']<control['bottom'] and button['bottom']>control['top'])
                self.assertFalse(overlaps,'Popup buttons must not cover movement or action controls')
        self.page.get_by_role('button',name='View active missions',exact=True).tap()
        self.assertEqual(self.page.evaluate('actionLog[0].action.id'),'missions')

    def test_level_up_names_real_prizes_and_keeps_profile_action_accessible_on_phones(self):
        for viewport in [{'width':390,'height':844},{'width':844,'height':390}]:
            with self.subTest(viewport=viewport):
                self.load_fixture(viewport,mobile=True,reduced_motion='reduce')
                self.page.evaluate("""() => {
                  document.documentElement.style.setProperty('--coda-touch-controls-height','220px');
                  touchState.visible=true;document.querySelector('#fakePad').hidden=false;
                  window.levelNotice={level:2,fromLevel:1,
                    prizes:[{label:'Pocket watch chain'},'Crystal Harp · Song Machine sound'],
                    action:{id:'profile',label:'View profile'}};
                  popups.levelUp(levelNotice);
                }""")
                self.wait_for_current('level:2')
                self.assertEqual(self.page.locator('.reward-toast-title').inner_text(),'Level 2!')
                self.assertEqual(self.page.locator('.reward-toast-eyebrow').inner_text(),'LEVEL UP')
                message=self.page.locator('.reward-toast-message').inner_text()
                self.assertIn('Pocket watch chain',message)
                self.assertIn('Crystal Harp · Song Machine sound',message)
                self.assertNotRegex(message,r'\d+\s+(Notes|XP)')
                self.assertEqual(self.page.evaluate('document.activeElement.id'),'outside')
                self.assertEqual(self.page.locator('.reward-toast').get_attribute('role'),'status')
                self.assert_phone_geometry()
                self.assertFalse(self.page.evaluate('popups.levelUp(levelNotice)'))
                self.assertEqual(self.page.evaluate('popups.getState().queued'),[])
                self.page.get_by_role('button',name='View profile',exact=True).tap()
                self.assertEqual(self.page.evaluate('actionLog[0].action.id'),'profile')
                self.wait_for_current(None)
                self.assertFalse(self.page.evaluate('popups.levelUp(levelNotice)'))

    def test_mission_returns_take_priority_and_collecting_removes_stale_returns(self):
        self.page.evaluate("""() => {
          popups.achievement({id:'current',title:'Currently celebrating',xp:20});
          popups.achievement({id:'waiting-one',title:'First waiting achievement',xp:20});
          popups.achievement({id:'waiting-two',title:'Second waiting achievement',xp:20});
          popups.missionComplete({id:'miles-one',title:'Miles mission',giver:'Miles Davis',reward:80});
        }""")
        self.assertEqual(self.page.evaluate('popups.getState().queued[0].kind'), 'mission-complete')
        self.dismiss()
        self.page.wait_for_function("popups.getState().current?.kind === 'mission-complete'")
        self.assertIn('Miles Davis', self.page.locator('.reward-toast').inner_text())
        self.page.evaluate("popups.missionReward({id:'miles-one',title:'Miles mission',notes:80,xp:25})")
        self.page.wait_for_function("popups.getState().current?.kind === 'mission-reward'")
        self.assertRegex(self.page.locator('.reward-toast').inner_text().lower(), r'collected\s+80\s+notes')
        self.dismiss()
        self.page.wait_for_function("popups.getState().current?.kind === 'achievement'")
        self.page.evaluate("""() => {
          popups.missionComplete({id:'bach-two',title:'Bach mission',giver:'Bach',reward:44});
          popups.missionReward({id:'bach-two',title:'Bach mission',notes:44,xp:30});
        }""")
        queued = self.page.evaluate('popups.getState().queued')
        self.assertEqual(sum(item['kind'] == 'mission-reward' for item in queued), 1)
        self.assertFalse(any(item['kind'] == 'mission-complete' for item in queued),
                         'Collecting a reward must remove its queued return-to-musician card')
        displayed = []
        for _ in range(8):
            current = self.page.evaluate('popups.getState().current')
            if current is None:
                break
            displayed.append(current)
            self.dismiss()
        self.assertIsNone(self.page.evaluate('popups.getState().current'))
        self.assertEqual(sum(item['kind'] == 'mission-reward' for item in displayed), 1)
        self.assertFalse(any(item['kind'] == 'mission-complete' for item in displayed),
                         'A collected mission must never later ask the player to return')
        self.page.evaluate("""() => {
          popups.missionReward({id:'paid-first',title:'Already collected',notes:12});
          popups.missionComplete({id:'paid-first',title:'Delayed completion event',giver:'Bach',reward:12});
        }""")
        self.assertEqual(self.page.evaluate('popups.getState().current.kind'), 'mission-reward')
        self.assertEqual(self.page.evaluate('popups.getState().queued'), [],
                         'A delayed completion event cannot follow an already collected reward')
        self.dismiss()
        self.wait_for_current(None)


if __name__ == '__main__':
    unittest.main(verbosity=2)
