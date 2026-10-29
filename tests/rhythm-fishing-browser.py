"""Real cave, boat, rhythm input, and saved catches in Chromium.

The browser clock advances the production RAF loop; catches still require real
keyboard/touch input at the engine's published note times.
"""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import threading
from pathlib import Path
import unittest

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path != '/fishing-fixture':
            return super().do_GET()
        html = '''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Rhythm Fishing browser checks</title>
<link rel="stylesheet" href="/rhythm-fishing.css">
<link rel="stylesheet" href="/music-notation.css">
<link rel="stylesheet" href="/fishing-battle.css">
<link rel="stylesheet" href="/cave-camera.css">
<style>*{box-sizing:border-box}body{margin:0;background:#0c1329;color:#fff;font:15px system-ui}#enter{min-height:44px} :root{--coda-touch-controls-height:190px}</style>
<button id="enter">Enter the cave</button><section id="fishing" hidden></section>
<script src="/character-renderer.js"></script><script src="/finger-follow.js"></script>
<script src="/music-notation.js"></script>
<script src="/rhythm-fishing-engine.js"></script><script src="/fishing-cave-layout.js"></script><script src="/fishing-cave-effects.js"></script><script src="/fish-shadow-motion.js"></script><script src="/rhythm-beaming.js"></script><script src="/cave-camera.js"></script><script src="/fishing-battle.js"></script><script src="/fishing-music.js"></script><script src="/fishing-boat.js"></script><script src="/fishing-rhythm-input.js"></script><script src="/fishing-practice.js"></script><script src="/rhythm-fishing.js"></script>
<script>
window.rewards=[];window.rewardCalls=[];window.challengeStarts=[];window.exits=0;window.failReward=false;
window.failStorage=false;
window.fishingInk=[];
const originalFillText=CanvasRenderingContext2D.prototype.fillText;
CanvasRenderingContext2D.prototype.fillText=function(value,x,y,...rest){
 const first=String(value).codePointAt(0);
 if(this.canvas.id==='fishingRhythmCanvas'&&/CodaBravura/.test(this.font)
    &&first>=0xe1d2&&first<=0xe1da){
  fishingInk.push({time:performance.now(),x,y,glyph:first});
  if(fishingInk.length>2000)fishingInk.splice(0,1000);
 }
 return originalFillText.call(this,value,x,y,...rest);
};
window.lab=createCodaRhythmFishing({host:document.querySelector('#fishing'),
 renderer:createCodaCharacterRenderer(),getAvatar:()=>({}),getVibe:()=>window.fixtureVibe||null,random:()=>0.01,
 backgroundSrc:'/assets/world/rhythm-fishing-cave.png',
 storage:{getItem:key=>localStorage.getItem(key),setItem:(key,value)=>{
  if(failStorage)throw Error('Storage unavailable for this check');localStorage.setItem(key,value);
 }},
 onChallengeStart:event=>challengeStarts.push(event),
 onClose:()=>exits++,onCatch:(fish,result)=>{
  rewardCalls.push({fish:fish.id,result});
  if(failReward)return {ok:false,error:'Reward saving is temporarily unavailable.'};
  const ledger=JSON.parse(localStorage.getItem('fixtureFishingRewards')||'[]');
  const id=result.id;
  if(ledger.includes(id))return {ok:true,alreadyAwarded:true,amount:0};
  ledger.push(id);localStorage.setItem('fixtureFishingRewards',JSON.stringify(ledger));
  const amount=fish.notes||fish.reward||result.notes||0;rewards.push({id,fish:fish.id,amount});
  return {ok:true,amount};
 }});
document.querySelector('#enter').onclick=()=>lab.open();
</script></html>'''
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode())


class RhythmFishingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(
            ('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
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
        self.context = self.browser.new_context(
            viewport={'width': 1300, 'height': 1000}, accept_downloads=True)
        self.page = self.context.new_page()
        self.errors, self.failures = [], []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('response', lambda response: self.failures.append(response.url)
                     if response.status >= 400 and not response.url.endswith('favicon.ico') else None)
        self.page.set_default_timeout(6000)
        self.url = f'http://127.0.0.1:{self.server.server_port}/fishing-fixture'
        self.load()

    def load(self):
        self.page.goto(self.url, wait_until='domcontentloaded')
        self.page.wait_for_function('window.lab && window.CodaRhythmFishing')
        self.assertTrue(self.page.evaluate('CodaMusicNotation.load()'),
                        'Fishing notation must use the real bundled music font')
        self.page.clock.install()
        self.page.locator('#enter').click()
        self.page.clock.run_for(50)

    def tearDown(self):
        if self.page and not self.page.is_closed():
            self.page.evaluate('lab.destroy()')
        self.context.close()
        self.assertEqual(self.errors, [], 'Fishing must not raise browser errors')
        self.assertEqual(self.failures, [], 'Local fishing resources must load')

    def state(self):
        return self.page.evaluate('lab.getState()')

    def walk_to(self, x, y):
        canvas = self.page.locator('#fishingLakeCanvas')
        canvas.scroll_into_view_if_needed()
        box = canvas.bounding_box()
        touch = self.page.evaluate('navigator.maxTouchPoints>0')
        def target():
            box=canvas.bounding_box();scene=self.page.locator('.fishing-cave-scene').bounding_box()
            state=self.state();camera=state.get('camera',{'x':0,'y':0,'zoom':1});actor=state['player']
            px=box['x']+(x-camera['x'])*camera['zoom']/1000*box['width']
            py=box['y']+(y-camera['y'])*camera['zoom']/620*box['height']
            ax=box['x']+(actor['x']-camera['x'])*camera['zoom']/1000*box['width']
            ay=box['y']+(actor['y']-camera['y'])*camera['zoom']/620*box['height']
            bottom=scene['y']+scene['height']-12
            if touch and self.page.viewport_size['height']>self.page.viewport_size['width']:
                controls_height=self.page.evaluate("parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--coda-touch-controls-height'))||220")
                bottom=min(bottom,self.page.viewport_size['height']-controls_height-10)
            scale=1;dx,dy=px-ax,py-ay
            if dx>0:scale=min(scale,(scene['x']+scene['width']-12-ax)/dx)
            elif dx<0:scale=min(scale,(scene['x']+12-ax)/dx)
            if dy>0:scale=min(scale,(bottom-ay)/dy)
            elif dy<0:scale=min(scale,(scene['y']+16-ay)/dy)
            return {'id':1,'x':ax+dx*max(0,scale),'y':ay+dy*max(0,scale)}
        point=target()
        client = self.context.new_cdp_session(self.page) if touch else None
        if client:
            client.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[point]})
        else:
            self.page.mouse.click(point['x'],point['y'])
        try:
            for _ in range(30):
                self.page.clock.run_for(120)
                player = self.state()['player']
                if (player['x']-x)**2+(player['y']-y)**2 < 8**2:
                    break
                point=target()
                if client:client.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[point]})
                else:self.page.mouse.click(point['x'],point['y'])
        finally:
            if client:
                client.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
                client.detach()
        self.page.clock.run_for(32)

    def board(self):
        if self.page.locator('#fishingBoatBoard').is_disabled():
            landing=self.state().get('shore',{}).get('spawn',{'x':135,'y':285})
            self.walk_to(landing['x'],landing['y'])
        pier=self.state().get('boardingPoint',{'x':218,'y':380})
        self.walk_to(pier['x'],pier['y'])
        self.assertFalse(self.page.locator('#fishingBoatBoard').is_disabled(),
                         'Walking to the pier should make the boat reachable')
        self.page.locator('#fishingLakeCanvas').focus();self.page.keyboard.press('e')
        self.page.clock.run_for(40)

    def approach_shadow(self):
        for _ in range(16):
            if not self.page.locator('#fishingCast').is_disabled():
                return
            state=self.state();boat=state['boat']
            fish=min((item for item in state['shadows'] if item['visible']),
                     key=lambda item:(item['x']-boat['x'])**2+(item['y']-boat['y'])**2)
            dx,dy=fish['x']-boat['x'],fish['y']-boat['y']
            directions=(['d' if dx>0 else 'a'] if abs(dx)>8 else [])+(['s' if dy>0 else 'w'] if abs(dy)>8 else [])
            self.page.locator('#fishingLakeCanvas').focus()
            for key in directions:self.page.keyboard.down(key)
            self.page.clock.run_for(200)
            for key in directions:self.page.keyboard.up(key)
        self.fail('Swimming fish should remain approachable within casting range')

    def cast(self):
        if self.state()['phase'] == 'shore':
            self.board()
        self.approach_shadow()
        self.page.locator('#fishingLakeCanvas').focus();self.page.keyboard.press('e')
        self.page.clock.run_for(2400)
        state = self.state()
        self.assertIsNotNone(state.get('challenge'), state)
        self.page.locator('#fishingRhythmCanvas').focus()
        return state

    def test_optional_vibe_covers_the_cave_and_tracks_shore_and_boat_rider_scales(self):
        self.page.evaluate('''()=>{window.vibeCalls=[];window.fixtureVibe={
          drawAtmosphere:(g,frame)=>{vibeCalls.push({kind:'atmosphere',...frame});return false;},
          drawCharacterGlow:(g,actor)=>{vibeCalls.push({kind:'glow',...actor,transform:{a:g.getTransform().a,e:g.getTransform().e,f:g.getTransform().f}});return false;}
        };}''')
        self.page.clock.run_for(32)
        calls=self.page.evaluate('vibeCalls')
        self.assertEqual((calls[0]['width'],calls[0]['height'],calls[0]['lights']),(1000,620,[]))
        self.assertGreaterEqual(len([call for call in calls if call['kind']=='glow' and call['scale']==1]),2)
        self.board();self.page.clock.run_for(32)
        rider=self.page.evaluate('vibeCalls.findLast(call=>call.kind==="glow"&&call.scale===.72)')
        self.assertIsNotNone(rider);self.assertEqual((rider['x'],rider['y']),(0,3))
        self.page.evaluate('window.fixtureVibe=null');before=len(self.page.evaluate('vibeCalls'));self.page.clock.run_for(32)
        self.assertEqual(len(self.page.evaluate('vibeCalls')),before)
        self.page.evaluate("()=>{const host=document.createElement('section');document.body.append(host);const bare=createCodaRhythmFishing({host,getAvatar:()=>({})});bare.open();bare.destroy();host.remove();}")

    def test_challenge_start_fires_once_for_real_bites_and_never_for_practice(self):
        self.assertEqual(self.page.evaluate('challengeStarts'),[])
        self.page.locator('#fishingMenuButton').click();self.page.locator('#fishingPractice').click()
        self.page.locator('#fishingPracticeStart').click(force=True);self.page.clock.run_for(64)
        self.assertTrue(self.state()['practice']);self.assertEqual(self.page.evaluate('challengeStarts'),[])
        self.page.locator('#fishingCancel').click(force=True);self.page.clock.run_for(32)
        state=self.cast();events=self.page.evaluate('challengeStarts')
        self.assertEqual(len(events),1)
        self.assertEqual(events[0]['runId'],state['challenge']['id'])
        self.assertEqual(events[0]['fishId'],state['challenge']['fish']['id'])
        self.assertEqual(events[0]['meter'],state['challenge']['meter'])
        self.assertFalse(events[0]['practice'])
        self.page.clock.run_for(1000);self.assertEqual(len(self.page.evaluate('challengeStarts')),1)

    def advance_to(self, target):
        clock = self.state()['clock']
        # Deliver slightly after the strike line so the previous RAF cannot
        # leave the first onset a fraction of a frame inside its count-in.
        self.page.clock.run_for(max(1, round((target+.025-clock)*1000)))

    def play_note(self, note):
        self.advance_to(note['time'])
        # Four perfect bars can finish during the RAF advance before the next
        # published note. Do not send that new press to the result screen's
        # focused Return to lake button.
        if self.state()['phase'] != 'rhythm':
            return
        self.page.keyboard.down('Space')
        if note.get('requiresHold', note.get('duration', 0)>=2):
            self.advance_to(note.get('holdEndTime',note['time']+note['durationSeconds']))
        self.page.keyboard.up('Space')
        self.page.clock.run_for(1)

    def finish_with_hits(self):
        for _ in range(100):
            state = self.state()
            challenge = state.get('challenge')
            if not challenge or challenge['phase'] in ['caught', 'escaped']:
                return state
            notes = [note for note in challenge['notes']
                     if not note.get('rest') and note.get('judgement') in [None, 'pending']
                     and note['time'] >= state['clock']-.03]
            self.assertTrue(notes, state)
            self.play_note(notes[0])
        self.fail('A common fish must be catchable by its actual rhythm')

    def test_cast_bite_count_in_and_real_rhythm_progress_then_escape(self):
        self.assertEqual(self.state()['phase'], 'shore')
        self.board()
        self.assertEqual(self.state()['phase'], 'explore')
        state = self.cast()
        initial = state['challenge']['progress']
        before_ink = self.page.evaluate('''()=>{
          const time=fishingInk.at(-1)?.time;
          return fishingInk.filter(item=>item.time===time).map(item=>item.x);
        }''')
        self.page.clock.run_for(150)
        after_ink = self.page.evaluate('''()=>{
          const time=fishingInk.at(-1)?.time;
          return fishingInk.filter(item=>item.time===time).map(item=>item.x);
        }''')
        self.assertTrue(before_ink and after_ink, 'The staff must draw real note glyphs')
        self.assertLess(after_ink[0], before_ink[0], 'Music notation must scroll left toward the strike line')
        self.page.keyboard.press('Space')
        self.assertEqual(self.state()['challenge']['progress'], initial,
                         'The count-in is a preparation period, not a penalty')
        note = next(note for note in state['challenge']['notes'] if not note.get('rest'))
        self.play_note(note)
        self.assertGreater(self.state()['challenge']['progress'], initial)
        after_hit = self.state()['challenge']['progress']
        self.page.keyboard.press('Space')
        self.assertLess(self.state()['challenge']['progress'], after_hit,
                        'An extra press between notes must lower the reel progress')
        self.page.clock.run_for(16000)
        self.assertEqual(self.state()['challenge']['phase'], 'escaped')
        self.assertEqual(self.page.evaluate('rewards'), [])

    def test_clean_catch_pays_once_and_collection_survives_reload(self):
        self.cast()
        state = self.finish_with_hits()
        self.assertEqual(state['challenge']['phase'], 'caught')
        self.assertTrue(state['result']['perfect'])
        self.assertEqual(state['challenge']['completedBars'], 4)
        self.assertEqual(len(self.page.evaluate('rewards')), 1)
        self.assertGreater(self.page.evaluate('rewards[0].amount'), 0)
        self.page.evaluate('lab.control(" ",true);lab.control(" ",false)')
        self.assertEqual(len(self.page.evaluate('rewards')), 1)
        self.page.locator('#fishingReturnLake').click()
        self.page.locator('#fishingMenuButton').click()
        self.page.locator('#fishingCollection').click()
        self.assertEqual(self.page.locator('[data-fish-id]').count(), 30)
        self.assertIn('1', self.page.locator('#fishing').inner_text())
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('window.lab')
        self.page.locator('#enter').click()
        self.assertEqual(self.page.evaluate('rewardCalls.length'), 0,
                         'Opening a saved collection must not replay a reward')
        self.page.locator('#fishingMenuButton').click()
        self.page.locator('#fishingCollection').click()
        self.assertEqual(self.page.locator('[data-fish-id]').count(), 30)

    def test_failed_reward_can_retry_same_catch_without_repeating_payment(self):
        self.page.evaluate('failReward=true')
        self.cast()
        state = self.finish_with_hits()
        self.assertEqual(state['challenge']['phase'], 'caught')
        self.assertEqual(self.page.evaluate('rewards.length'), 0)
        self.page.locator('#fishingRewardRetry').wait_for(state='visible')
        original = self.page.evaluate('rewardCalls[0].result.id')
        self.page.evaluate('failReward=false')
        self.page.locator('#fishingRewardRetry').click()
        self.assertEqual(self.page.evaluate('rewards.length'), 1)
        self.assertEqual(self.page.evaluate('rewards[0].id'), original)
        self.page.locator('#fishingClose').click()
        self.page.locator('#enter').click()
        self.assertEqual(self.page.evaluate('rewards.length'), 1)

    def test_unavailable_journal_never_pays_an_unsaved_catch_and_can_retry(self):
        self.page.evaluate('failStorage=true')
        self.cast()
        state=self.finish_with_hits()
        self.assertEqual(state['challenge']['phase'],'caught')
        self.assertEqual(self.page.evaluate('rewardCalls.length'),0,
                         'A catch must reach its journal before a reward is requested')
        self.assertEqual(state['collection']['total'],0)
        self.page.locator('#fishingRewardRetry').wait_for(state='visible')
        self.page.evaluate('failStorage=false')
        self.page.locator('#fishingRewardRetry').click()
        self.assertEqual(self.page.evaluate('rewards.length'),1)
        self.assertEqual(self.state()['collection']['total'],1)

    def test_boat_keyboard_collision_and_close_clear_controls(self):
        self.board()
        start = self.state()['boat']
        self.page.locator('#fishingLakeCanvas').focus()
        self.page.keyboard.down('d')
        self.page.clock.run_for(250)
        self.page.keyboard.up('d')
        moved = self.state()['boat']
        self.assertGreater(moved['x'], start['x']+15)
        self.page.keyboard.down('d')
        self.page.clock.run_for(10000)
        self.page.keyboard.up('d')
        edge = self.state()['boat']
        self.assertLess(edge['x'], 920)
        self.page.clock.run_for(500)
        self.assertAlmostEqual(self.state()['boat']['x'], edge['x'], delta=.01)
        self.page.keyboard.press('Escape')
        self.assertFalse(self.state()['open'])
        self.assertEqual(self.page.evaluate('exits'), 1)
        self.assertEqual(self.state()['voiceCount'],0)

    def test_captain_teaches_meter_and_the_selected_meter_reaches_the_challenge(self):
        self.page.locator('#fishingMeter').select_option('6/8')
        self.page.locator('#fishingTalkCaptain').click()
        self.page.locator('[data-captain-topic="meters"]').click()
        self.assertIn('three eighth notes', self.page.locator('#fishingCaptainWords').inner_text())
        self.page.locator('#fishingCaptainClose').click()
        state = self.cast()
        meter = state.get('meter', state['challenge'].get('meter'))
        if isinstance(meter, dict):
            meter = meter.get('id', meter.get('meter'))
        self.assertEqual(meter, '6/8')

    def test_hiding_the_page_pauses_a_hooked_fish_and_escape_stops_audio(self):
        self.cast()
        before = self.state()
        self.page.evaluate('''()=>{
          Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
          document.dispatchEvent(new Event('visibilitychange'));
        }''')
        self.page.clock.run_for(7000)
        hidden = self.state()
        self.assertEqual(hidden['challenge']['progress'], before['challenge']['progress'])
        self.assertEqual(hidden['challenge']['phase'], before['challenge']['phase'])
        self.page.evaluate('''()=>{
          delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));
        }''')
        self.page.clock.run_for(100)
        self.assertNotEqual(self.state()['challenge']['phase'], 'escaped')
        self.page.keyboard.press('Escape')
        self.assertFalse(self.state()['open'])
        self.assertEqual(self.page.evaluate('rewards'), [])
        self.assertEqual(self.state()['voiceCount'],0)

    def test_phone_touch_boat_and_layout_and_large_rhythm_tap_target(self):
        self.context.close()
        self.context = self.browser.new_context(
            viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.load()
        self.board()
        canvas = self.page.locator('#fishingLakeCanvas')
        box = canvas.bounding_box()
        client = self.context.new_cdp_session(self.page)
        before = self.state()['boat']
        camera=self.state().get('camera',{'x':0,'y':0,'zoom':1})
        point = {'id':1,'x':box['x']+(before['x']+40-camera['x'])*camera['zoom']/1000*box['width'],
                 'y':box['y']+(before['y']-camera['y'])*camera['zoom']/620*box['height']}
        client.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[point]})
        self.page.clock.run_for(500)
        client.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
        self.assertGreater(self.state()['boat']['x'], before['x']+10)
        after = self.state()['boat']
        self.page.clock.run_for(300)
        self.assertAlmostEqual(self.state()['boat']['x'], after['x'], delta=.01)
        client.detach()
        self.page.screenshot(path='/tmp/coda-rhythm-fishing-lake-phone.png',full_page=True)
        self.cast()
        tap_box=self.page.locator('#fishingTap').bounding_box()
        self.assertGreaterEqual(tap_box['height'],72,'Rhythm tapping needs a large mobile target')
        for size in [{'width':390,'height':844},{'width':844,'height':390}]:
            self.page.set_viewport_size(size)
            self.page.clock.run_for(100)
            self.assertLessEqual(self.page.locator('#fishing').evaluate('(host)=>host.scrollWidth'),size['width']+1)
            targets=self.page.locator('#fishing button:visible').evaluate_all(
                '(buttons)=>buttons.map(b=>({label:b.textContent,h:b.getBoundingClientRect().height,w:b.getBoundingClientRect().width}))')
            self.assertTrue(all(item['h']>=44 and item['w']>=44 for item in targets),targets)
        self.page.screenshot(path='/tmp/coda-rhythm-fishing-phone.png',full_page=True)


if __name__ == '__main__':
    unittest.main(verbosity=2)
