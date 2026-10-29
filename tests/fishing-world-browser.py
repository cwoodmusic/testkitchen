"""The world trapdoor, real rhythm catches, and saved fishing rewards work together."""
import importlib.util
from pathlib import Path
import sys
import unittest
from world_navigation_helpers import enter_room

sys.dont_write_bytecode=True
from classroom_quiz_helpers import answer_quiz
_spec=importlib.util.spec_from_file_location('learning_world_browser',Path(__file__).with_name('learning-world-browser.py'))
_world=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_world)


class FishingWorldTests(_world.WorldBrowserCase):
    def setUp(self):
        phone=self._testMethodName.endswith('_phone')
        self.context=self.browser.new_context(viewport={'width':390,'height':844} if phone else {'width':1550,'height':1050},is_mobile=phone,has_touch=phone)
        self.context.route('https://**/*',lambda route:route.abort())
        self.context.route('https://cwoodmusic.github.io/**',self.route_checkout)
        # A common shadow makes the timing/reward assertions deterministic;
        # the catch still needs real keyboard/touch hits at its written onsets.
        self.context.add_init_script("localStorage.setItem('codaArcadeFXV1','off');Math.random=()=>0.01;")
        self.page=self.context.new_page();self.page.set_default_timeout(10000)
        self.errors=[];self.failures=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.on('console',lambda message:self.errors.append(message.text) if 'Arcade frame error:' in message.text else None)
        self.page.on('response',lambda response:self.failures.append(response.url) if response.status>=400 and 'cwoodmusic.github.io/coda-arcade/' in response.url and not response.url.endswith('favicon.ico') else None)
        self.load()
        self.page.wait_for_function('CodaArcadeQA.fishing()?.phase&&CodaArcadeQA.fishingEntrance()?.visible')
        self.assertTrue(self.page.evaluate('CodaMusicNotation.load()'))
        self.page.clock.install();self.page.clock.run_for(64)

    def test_time_signature_lesson_awards_real_profile_xp_once(self):
        enter_room(self.page,'classroom')
        self.page.locator('[data-start-lesson="time-signatures"]').click()
        steps=self.page.evaluate('CodaTimeSignatureLesson.STEPS')
        self.page.locator('[data-signature-answer="1"]').click()
        self.assertTrue(self.page.locator('#classroomBook [data-tutorial-next]').is_disabled())
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),0)
        for step in steps:
            if step['kind']=='choice':
                self.page.locator('[data-signature-answer="'+str(step['correct'])+'"]').click()
            else:
                for beats in step['recipe']:
                    self.page.locator('[data-signature-add="'+str(beats)+'"]').click()
                self.page.locator('[data-signature-check]').click()
            self.page.locator('#classroomBook [data-tutorial-next]').click()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.tutorials().active.phase'),'quiz')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),0)
        answer_quiz(self.page,'time-signatures')
        self.assertIn('time-signatures',self.page.evaluate('CodaArcadeQA.tutorials().completed'))
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),50)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),150)
        self.page.locator('#classroomClose').click();self.page.locator('#levelBtn').click()
        self.assertIn('Time signatures · Finished',self.page.locator('.profile-lessons').inner_text())
        self.load()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),50)
        self.assertIsNone(self.page.evaluate('CodaArcadeQA.rewardNotifications().current'))

    def state(self):return self.page.evaluate('CodaArcadeQA.fishing()')
    def portal(self):return self.page.evaluate('CodaArcadeQA.fishingEntrance()')
    def project(self):return self.page.evaluate('CodaDeveloperConsole.getProject()')

    def place(self,x,y):
        self.assertTrue(self.page.evaluate('([x,y])=>CodaArcadeQA.place(x,y)',[x,y]))
        self.page.clock.run_for(80);self.page.locator('#view').focus()

    def enter(self):
        portal=self.portal();self.place(portal['x'],portal['y']);self.page.keyboard.press('e');self.page.clock.run_for(64)
        self.assertTrue(self.state()['open']);self.assertTrue(self.page.locator('#rhythmFishing').is_visible())

    def fishing_option(self,selector):
        option=self.page.locator(selector)
        if not option.is_visible():self.page.locator('#fishingMenuButton').click()
        return option

    def fishing_action(self,selector):
        self.fishing_option(selector).click()

    def fishing_meter(self,meter):
        self.fishing_option('#fishingMeter').select_option(meter)
        self.page.locator('#fishingMenuClose').click()

    def field(self,selector,value):
        control=self.page.locator('#'+selector);control.fill(str(value));control.dispatch_event('change');self.page.clock.run_for(32)

    def walk_to(self,x,y):
        canvas=self.page.locator('#fishingLakeCanvas');canvas.scroll_into_view_if_needed();box=canvas.bounding_box()
        touch=self.page.evaluate('navigator.maxTouchPoints>0')
        def target():
            box=canvas.bounding_box();scene=self.page.locator('.fishing-cave-scene').bounding_box()
            state=self.state();camera=state.get('camera',{'x':0,'y':0,'zoom':1});actor=state['player']
            px=box['x']+(x-camera['x'])*camera['zoom']/1000*box['width']
            py=box['y']+(y-camera['y'])*camera['zoom']/620*box['height']
            ax=box['x']+(actor['x']-camera['x'])*camera['zoom']/1000*box['width']
            ay=box['y']+(actor['y']-camera['y'])*camera['zoom']/620*box['height']
            bottom=scene['y']+scene['height']-12
            if touch and self.page.viewport_size['height']>self.page.viewport_size['width']:
                # The overlay host reserves space for three actions even when
                # this room only shows one. Use visible controls rather than
                # treating that transparent host space as an obstruction.
                controls_top=self.page.evaluate("""()=>Math.min(innerHeight,...[
                  ...document.querySelectorAll('.coda-joystick,.coda-touch-actions')]
                  .filter(node=>node.getClientRects().length)
                  .map(node=>node.getBoundingClientRect().top))""")
                bottom=min(bottom,controls_top-10)
            scale=1;dx,dy=px-ax,py-ay
            if dx>0:scale=min(scale,(scene['x']+scene['width']-12-ax)/dx)
            elif dx<0:scale=min(scale,(scene['x']+12-ax)/dx)
            if dy>0:scale=min(scale,(bottom-ay)/dy)
            elif dy<0:scale=min(scale,(scene['y']+16-ay)/dy)
            return {'id':1,'x':ax+dx*max(0,scale),'y':ay+dy*max(0,scale)}
        point=target()
        client=self.context.new_cdp_session(self.page) if touch else None
        if client:client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point]})
        else:self.page.mouse.click(point['x'],point['y'])
        try:
            for _ in range(30):
                self.page.clock.run_for(120);player=self.state()['player']
                if (player['x']-x)**2+(player['y']-y)**2<64:break
                point=target()
                # A mouse click already sets a destination. Re-clicking the
                # same floor point near Captain Cadence would talk to him.
                if client:client.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[point]})
        finally:
            if client:client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});client.detach()
        self.page.clock.run_for(32)

    def board(self):
        if self.page.locator('#fishingBoatBoard').is_disabled():
            landing=self.state().get('shore',{}).get('spawn',{'x':135,'y':285});self.walk_to(landing['x'],landing['y'])
        pier=self.state().get('boardingPoint',{'x':218,'y':380});self.walk_to(pier['x'],pier['y'])
        self.assertFalse(self.page.locator('#fishingBoatBoard').is_disabled())
        self.fishing_action('#fishingBoatBoard');self.page.clock.run_for(40)

    def approach_shadow(self):
        for _ in range(16):
            if not self.page.locator('#fishingCast').is_disabled():return
            state=self.state();boat=state['boat'];fish=min((item for item in state['shadows'] if item['visible']),key=lambda item:(item['x']-boat['x'])**2+(item['y']-boat['y'])**2)
            dx,dy=fish['x']-boat['x'],fish['y']-boat['y'];directions=(['d' if dx>0 else 'a'] if abs(dx)>8 else [])+(['s' if dy>0 else 'w'] if abs(dy)>8 else [])
            self.page.locator('#fishingLakeCanvas').focus()
            for key in directions:self.page.keyboard.down(key)
            self.page.clock.run_for(200)
            for key in directions:self.page.keyboard.up(key)
        self.fail('Swimming fish should remain approachable within casting range')

    def cast(self,meter='4/4'):
        # Freeze before entering the room, outside the playable rhythm, so
        # browser protocol latency cannot consume adjacent hold-note windows.
        self.page.clock.pause_at(self.page.evaluate('Date.now()/1000')+5)
        self.enter();self.fishing_meter(meter)
        self.board();self.approach_shadow()
        self.fishing_action('#fishingCast');self.page.clock.run_for(2400)
        self.assertEqual(self.state()['phase'],'rhythm');self.page.locator('#fishingTap').focus()

    def catch_with_actual_keys(self):
        def advance_to(target):
            delta=target-self.state()['clock']
            if delta>0:self.page.clock.run_for(max(1,int(delta*1000)))
            for _ in range(20):
                if self.state()['clock']>=target-.000001:return
                self.page.clock.run_for(1)
            self.fail('The controlled game clock should reach the note target')
        for _ in range(200):
            state=self.state();challenge=state['challenge']
            if challenge['phase'] in ['caught','escaped']:return state
            upcoming=[note for note in challenge['notes'] if note['judgement']=='pending'
                and note['time']+note.get('window',challenge['window'])>=state['clock']]
            self.assertTrue(upcoming,state)
            note=upcoming[0]
            advance_to(note['time'])
            if self.state()['phase'] in ['caught','escaped']:return self.state()
            self.page.keyboard.down('Space')
            if note.get('requiresHold',note.get('duration',0)>=2):
                end=note.get('holdEndTime',note['time']+note['durationSeconds'])
                advance_to(end)
            self.page.keyboard.up('Space');self.page.clock.run_for(1)
        self.fail('The real rhythm did not finish')

    def test_trapdoor_enters_the_cave_captain_and_boat_pause_the_world_and_exit_cleans_up(self):
        self.assertEqual((self.portal()['x'],self.portal()['y']),(928,760))
        self.enter();outside=self.page.evaluate('CodaArcadeQA.position()')
        self.assertEqual(self.state()['phase'],'shore');self.assertTrue(self.state()['background']['ready'])
        self.fishing_action('#fishingTalkCaptain');self.assertEqual(self.state()['phase'],'captain')
        self.assertIn('Captain Cadence',self.page.locator('#fishingCaptainName').inner_text())
        self.page.locator('[data-captain-topic="rhythm"]').click();lesson=self.page.locator('#fishingCaptainWords').inner_text().lower()
        self.assertIn('tap',lesson);self.assertIn('rest',lesson);self.assertIn('bar',lesson)
        self.page.keyboard.press('Escape');self.assertEqual(self.state()['phase'],'shore')
        self.board();before=self.state()['boat'];self.page.locator('#fishingLakeCanvas').focus()
        self.page.keyboard.down('d');self.page.clock.run_for(300);self.page.keyboard.up('d')
        self.assertGreater(self.state()['boat']['x'],before['x']+20)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.position()'),outside)
        self.page.locator('#fishingClose').click();self.page.clock.run_for(64)
        self.assertFalse(self.state()['open']);self.assertEqual(self.state()['voiceCount'],0)
        self.assertIn(self.state()['audioState'],['closed','suspended']);self.assertEqual(self.page.evaluate('CodaArcadeQA.position()'),outside)
        self.page.clock.run_for(250);self.assertEqual(self.page.evaluate('CodaArcadeQA.position()'),outside)

    def test_native_trapdoor_move_hide_restore_and_undo_preserve_layout_and_walking(self):
        before=self.project();walk_before=self.page.evaluate('''()=>{
          const values=[];for(const [cx,cy]of [[928,760],[1100,730]])for(let y=-30;y<=30;y+=10)for(let x=-40;x<=40;x+=10)values.push(CodaArcadeQA.walkable(cx+x,cy+y));return values;
        }''')
        self.page.evaluate('CodaDeveloperConsole.open("objects")')
        self.page.locator('#devCatalog').select_option('rhythm_fishing_trapdoor');self.page.locator('#devLift').click()
        asset=self.project()['assets'][-1];self.assertEqual(asset['origin']['name'],'rhythm_fishing_trapdoor')
        self.assertFalse(asset.get('releaseCollision',False));self.assertNotIn('collider',asset)
        self.field('assetX',1100);self.field('assetY',730)
        self.assertEqual((self.portal()['x'],self.portal()['y']),(1100,730))
        self.page.locator('#assetVisible').uncheck();self.assertFalse(self.portal()['visible'])
        self.page.locator('#devRestore').click();self.assertEqual((self.portal()['x'],self.portal()['y']),(928,760));self.assertTrue(self.portal()['visible'])
        self.page.locator('#devUndo').click();self.assertEqual((self.portal()['x'],self.portal()['y']),(1100,730));self.assertFalse(self.portal()['visible'])
        self.page.locator('#assetVisible').check();self.page.locator('#assetClose').click();self.page.clock.run_for(64)
        after=self.project();self.assertEqual(after['collision'],before['collision']);self.assertEqual(after['strokes'],before['strokes'])
        self.assertEqual(self.page.evaluate('''()=>{
          const values=[];for(const [cx,cy]of [[928,760],[1100,730]])for(let y=-30;y<=30;y+=10)for(let x=-40;x<=40;x+=10)values.push(CodaArcadeQA.walkable(cx+x,cy+y));return values;
        }'''),walk_before,'Moving a native hatch must not clone floor patches or change collision')
        self.enter();self.assertTrue(self.state()['open'],'Interaction follows the moved hatch, using the same transform as its artwork')

    def test_real_catch_pays_notes_xp_and_achievements_once_and_restores_quietly(self):
        self.cast();finished=self.catch_with_actual_keys();self.assertEqual(finished['phase'],'caught');self.assertEqual(finished['result']['fishId'],'silver-minnow')
        self.assertTrue(finished['result']['perfect']);self.assertEqual(finished['collection']['total'],1);self.assertTrue(finished['catches'][0]['rewarded'])
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),154)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),108)
        earned=self.page.evaluate('CodaArcadeQA.fishingAchievements().filter(item=>item.earned).map(item=>item.id)')
        self.assertIn('fishing-first-catch',earned);self.assertIn('fishing-perfect-catch',earned)
        notification=self.page.evaluate('CodaArcadeQA.rewardNotifications()');titles=[item['title'] for item in [notification['current'],*notification['queued']] if item]
        self.assertIn('First Catch',titles);self.assertIn('In Perfect Time',titles)
        self.page.locator('#fishingReturnLake').click();self.fishing_action('#fishingCollection')
        self.assertEqual(self.page.locator('#fishingCollectionGrid article').count(),30)
        self.page.locator('#fishingClose').click();self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('CodaDeveloperConsole?.ready()&&CodaArcadeQA.fishing()?.collection.total===1')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),154);self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),108)
        self.assertIsNone(self.page.evaluate('CodaArcadeQA.rewardNotifications().current'),'Reload must not repeat fishing achievements or level-up popups')
        enter_room(self.page,'fishing');self.fishing_action('#fishingCollection')
        self.assertIn('Silver Minnow',self.page.locator('[data-fish-id="silver-minnow"]').inner_text())
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),154)

    def test_leaving_a_held_fish_and_reopening_does_not_strand_its_hidden_slot(self):
        self.cast('2/2');cast=self.state()
        slot,original=next((index,shadow) for index,shadow in enumerate(cast['shadows']) if not shadow['visible'])
        note=next(note for note in cast['challenge']['notes'] if note['judgement']=='pending')
        self.assertTrue(note['requiresHold'])
        delta=note['time']-self.state()['clock']
        if delta>0:self.page.clock.run_for(max(1,int(delta*1000)))
        for _ in range(20):
            if self.state()['clock']>=note['time']-.000001:break
            self.page.clock.run_for(1)
        self.page.keyboard.down('Space')
        self.assertEqual(len(self.state()['challenge']['activeHolds']),1)
        self.page.locator('#fishingClose').click(force=True)
        self.page.keyboard.up('Space');self.page.clock.run_for(64)
        closed=self.state()
        self.assertFalse(closed['open']);self.assertIsNone(closed['challenge'])
        self.assertEqual(closed['voiceCount'],0)
        self.assertIn(closed['audioState'],['closed','suspended'])
        self.assertEqual(self.page.evaluate('CodaArcadeQA.touch().held'),[])
        self.assertEqual(closed['fingerWalk']['pointerCount'],0)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),150)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),0)
        self.enter()
        self.assertFalse(self.state()['shadows'][slot]['visible'])
        # No recast changes the selected slot. The ordinary cooldown alone
        # must let it recover after leaving a battle with a held note.
        self.page.clock.run_for(9000)
        recovered=self.state();replacement=recovered['shadows'][slot]
        self.assertEqual(recovered['phase'],'shore');self.assertIsNone(recovered['challenge'])
        self.assertTrue(replacement['visible']);self.assertNotEqual(replacement['id'],original['id'])
        self.assertEqual(recovered['collection']['total'],0)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),150)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),0)
        self.page.locator('#fishingClose').click(force=True);self.page.clock.run_for(32)
        self.assertEqual(self.state()['voiceCount'],0)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.touch().held'),[])

    def test_escaped_fish_disappears_and_a_different_shadow_replaces_it_later(self):
        self.cast();cast=self.state()
        slot,original=next((index,shadow) for index,shadow in enumerate(cast['shadows']) if not shadow['visible'])
        balance=self.page.evaluate('CodaArcadeQA.notes().balance')
        for _ in range(30):
            if self.state()['phase']=='escaped':break
            self.page.clock.run_for(500)
        lost=self.state();self.assertEqual(lost['phase'],'escaped')
        escaped=lost['shadows'][slot]
        self.assertFalse(escaped['visible']);self.assertTrue(escaped['escaped'])
        self.assertEqual(escaped['id'],original['id'])
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),balance)
        self.assertEqual(lost['collection']['total'],0)
        self.page.locator('#fishingReturnLake').click()
        self.page.clock.run_for(23000)
        self.assertFalse(any(shadow['id']==original['id'] and shadow['visible'] for shadow in self.state()['shadows']))
        self.page.clock.run_for(1500)
        replacement=self.state()['shadows'][slot]
        self.assertTrue(replacement['visible']);self.assertFalse(replacement['escaped'])
        self.assertNotEqual(replacement['id'],original['id'])
        self.assertGreater((replacement['x']-original['x'])**2+(replacement['y']-original['y'])**2,25)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),balance)

    def test_touch_entry_held_boat_steering_release_and_compound_meter_phone(self):
        self.enter();self.page.clock.run_for(100);self.assertEqual(self.page.evaluate('CodaArcadeQA.touch().context'),'fishing')
        self.board();self.page.clock.run_for(64);before=self.state()['boat']
        box=self.page.locator('#fishingLakeCanvas').bounding_box();client=self.context.new_cdp_session(self.page)
        camera=self.state()['camera'];target={'x':before['x']+45,'y':before['y']}
        point={'x':box['x']+(target['x']-camera['x'])*camera['zoom']/1000*box['width'],
               'y':box['y']+(target['y']-camera['y'])*camera['zoom']/620*box['height'],'id':1}
        client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point]});self.page.clock.run_for(300)
        self.assertGreater(self.state()['boat']['x'],before['x']+15);self.assertTrue(self.state()['fingerWalk']['following'])
        client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});self.page.clock.run_for(32);stopped=self.state()['boat'];self.page.clock.run_for(200)
        self.assertEqual(self.state()['boat'],stopped);self.assertFalse(self.state()['fingerWalk']['following']);client.detach()
        self.fishing_meter('6/8');self.approach_shadow();self.fishing_action('#fishingCast');self.page.clock.run_for(1800)
        challenge=self.state()['challenge'];self.assertEqual(challenge['meter'],'6/8');self.assertEqual(challenge['pulseUnit'],'dotted-quarter');self.assertEqual(challenge['countInBeats'],2)
        self.assertFalse(self.page.evaluate('CodaArcadeQA.touch().visible'),'The rhythm tap surface replaces movement controls during the challenge')
        self.assertGreaterEqual(self.page.locator('#fishingTap').bounding_box()['height'],64)
        self.assertLessEqual(self.page.locator('#rhythmFishing').evaluate('(host)=>host.scrollWidth'),390)
        self.page.locator('#fishingClose').tap();self.page.clock.run_for(100);self.assertEqual(self.page.evaluate('CodaArcadeQA.touch().context'),'world')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.touch().held'),[]);self.assertEqual(self.state()['voiceCount'],0)


if __name__=='__main__':unittest.main(verbosity=2)
