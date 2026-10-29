"""Real touch input stays precise when the fishing RAF is deliberately late."""
import importlib.util
import math
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode=True
_spec=importlib.util.spec_from_file_location('rhythm_input_world',Path(__file__).with_name('fishing-upgrade-browser.py'))
_upgrade=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_upgrade)


class FishingRhythmInputTests(_upgrade._fish._world.WorldBrowserCase):
    state=_upgrade.FishingUpgradeTests.state
    portal=_upgrade.FishingUpgradeTests.portal
    place=_upgrade.FishingUpgradeTests.place
    enter=_upgrade.FishingUpgradeTests.enter
    walk_to=_upgrade.FishingUpgradeTests.walk_to
    board=_upgrade.FishingUpgradeTests.board
    fishing_option = _upgrade._fish.FishingWorldTests.fishing_option
    fishing_action = _upgrade._fish.FishingWorldTests.fishing_action
    fishing_meter = _upgrade._fish.FishingWorldTests.fishing_meter
    place_single_fish=_upgrade.FishingUpgradeTests.place_single_fish

    def start_exploring(self,meter='4/4'):
        self.enter();self.fishing_meter(meter);self.board()
        self.assertEqual(self.state()['phase'],'explore')

    def setUp(self):
        _upgrade._fish.FishingWorldTests.setUp(self)
        self.page.clock.pause_at(self.page.evaluate('Date.now()/1000')+5)
        self.client=self.context.new_cdp_session(self.page)
        self.points={}
        self.page.wait_for_function("!!(window.CodaFishingRhythmInput&&typeof CodaRhythmFishing.createSession==='function')")

    def tearDown(self):
        self.client.detach()
        super().tearDown()

    def begin(self,fish='starlight-sturgeon',meter='6/8'):
        self.start_exploring(meter);self.place_single_fish(fish)
        self.fishing_action('#fishingCast');self.page.clock.run_for(1400)
        self.assertEqual(self.state()['phase'],'rhythm')
        self.page.locator('#fishingTap').scroll_into_view_if_needed()
        self.page.evaluate('''()=>{
          const real=requestAnimationFrame;window.deferFishingFrames=false;window.deferredFishingFrame=null;
          window.requestAnimationFrame=function(callback){
            if(deferFishingFrames&&callback.name==='tick'){deferredFishingFrame=callback;return 2147483000;}
            return real.call(window,callback);
          };
          window.resumeFishingFrame=()=>{deferFishingFrames=false;const callback=deferredFishingFrame;
            deferredFishingFrame=null;if(callback)real.call(window,callback);};
          window.deferFishingFrames=true;
        }''')
        self.page.clock.run_for(32)
        # An innocuous actual touch during count-in also establishes the exact
        # source-clock offset, without directly advancing the game session.
        self.down(11);self.up(11)
        self.assertEqual(self.state()['challenge']['hits'],0)
        self.offset=self.page.evaluate('performance.now()/1000')-self.state()['clock']

    def source_to(self,game_time):
        current=self.page.evaluate('performance.now()/1000')-self.offset
        self.page.clock.run_for(max(0,round((game_time+.002-current)*1000)))

    def target_point(self,target='pad',fraction=.5):
        node=self.page.locator('#fishingTap' if target=='pad' else '#fishingRhythmCanvas')
        box=node.bounding_box()
        return {'x':box['x']+box['width']*fraction,'y':box['y']+box['height']*.65}

    def down(self,identifier,target='pad',fraction=.5):
        self.points[identifier]={'id':identifier,**self.target_point(target,fraction)}
        self.client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':list(self.points.values())})

    def up(self,identifier):
        ended=self.points.pop(identifier,None)
        # CDP's targeted TouchEnd describes the contact being lifted, rather
        # than the contacts that stay down. An empty list ends the final one.
        self.client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[ended] if self.points else []})

    def test_three_fast_alternating_touches_hit_capped_sixteenths_with_delayed_frames_phone(self):
        self.begin()
        initial=self.state();notes=[note for note in initial['challenge']['notes'] if not note['rest']][:3]
        self.assertTrue(all(note['duration']<1 for note in notes))
        # The authored 100-quarter-BPM cap makes the fastest permitted
        # sixteenths150ms apart; the old Presto-only expectation is obsolete.
        self.assertLessEqual(initial['challenge']['quarterBpm'],100)
        self.assertAlmostEqual(notes[1]['time']-notes[0]['time'],.15,places=8)
        self.assertAlmostEqual(notes[2]['time']-notes[1]['time'],.15,places=8)
        self.assertEqual(self.page.locator('#fishingTap').evaluate('e=>getComputedStyle(e).touchAction'),'none')
        scale=self.page.evaluate('visualViewport.scale');scroll=self.page.locator('#rhythmFishing').evaluate('e=>e.scrollTop')
        self.source_to(notes[0]['time']);self.down(1,fraction=.35)
        self.assertEqual(self.state()['challenge']['hits'],1)
        self.source_to(notes[1]['time']);self.down(2,fraction=.65)
        self.assertEqual(self.state()['challenge']['hits'],2)
        self.up(1)
        self.source_to(notes[2]['time']);self.down(3,fraction=.35)
        after=self.state();self.assertEqual(after['challenge']['hits'],3)
        self.assertEqual(after['challenge']['extras'],0);self.assertEqual(after['challenge']['misses'],0)
        self.assertGreater(after['clock'],initial['clock']+.5,'Scoring must advance even though the render frame is still deferred')
        self.assertLess(abs(after['clock']-notes[2]['time']),notes[2]['window'])
        self.up(2);self.up(3)
        self.assertEqual(self.state()['challenge']['pressedSources'],[])
        self.assertEqual(self.page.evaluate('visualViewport.scale'),scale)
        self.assertEqual(self.page.locator('#rhythmFishing').evaluate('e=>e.scrollTop'),scroll)
        # Compatibility clicks and pointer releases must not generate extra hits.
        self.page.locator('#fishingTap').dispatch_event('click',{'detail':1})
        self.assertEqual(self.state()['challenge']['hits'],3);self.assertEqual(self.state()['challenge']['extras'],0)
        before=self.state()['clock'];self.page.evaluate('resumeFishingFrame()');self.page.clock.run_for(16)
        self.assertLess(self.state()['clock']-before,.025,'The resumed frame must not count the tap elapsed time twice')

    def test_fast_staff_taps_do_not_turn_late_presses_or_mashing_into_hits_phone(self):
        self.begin();notes=[note for note in self.state()['challenge']['notes'] if not note['rest']]
        for index,note in enumerate(notes[:3]):
            self.source_to(note['time']);self.down(index+1,'staff',.6);self.up(index+1)
        self.assertEqual(self.state()['challenge']['hits'],3)
        for identifier in [10,20]:self.down(identifier,'staff');self.up(identifier)
        state=self.state()['challenge'];self.assertEqual(state['hits'],3);self.assertEqual(state['extras'],2)
        late=notes[3];self.source_to(late['time']+late['window']+.015)
        self.down(21,'staff');self.up(21)
        after=self.state()['challenge'];self.assertEqual(after['hits'],3)
        self.assertGreater(after['misses'],state['misses']);self.assertGreater(after['extras'],state['extras'])
        self.assertLess(after['progress'],state['progress']);self.assertEqual(self.state()['collection']['total'],0)

    def test_long_touch_holds_award_at_the_tail_and_early_lift_misses_once_phone(self):
        self.begin('silver-minnow','2/2');note=self.state()['challenge']['notes'][0]
        self.assertTrue(note['requiresHold'])
        self.source_to(note['time']);self.down(1)
        head=self.state()['challenge'];self.assertEqual(head['hits'],0);self.assertEqual(head['progress'],45)
        self.assertEqual(len(head['activeHolds']),1)
        self.source_to(note['holdEndTime']);self.up(1)
        held=self.state()['challenge'];self.assertEqual(held['hits'],1);self.assertEqual(held['misses'],0)
        second=next(n for n in held['notes'] if n['judgement']=='pending')
        self.source_to(second['time']);self.down(2)
        self.source_to(second['time']+second['durationSeconds']*.25);self.up(2)
        early=self.state()['challenge'];self.assertEqual(early['hits'],1);self.assertEqual(early['misses'],1)
        self.page.locator('#fishingTap').dispatch_event('pointerup',{'pointerId':999,'button':0})
        self.assertEqual(self.state()['challenge']['misses'],1);self.assertEqual(self.state()['challenge']['pressedSources'],[])

    def test_hold_pause_and_touch_cancel_release_sources_without_sticking_phone(self):
        self.begin('silver-minnow','2/2');note=self.state()['challenge']['notes'][0]
        self.source_to(note['time']);self.down(1)
        self.page.locator('#fishingPause').click(force=True)
        paused=self.state();self.assertTrue(paused['paused']);self.assertEqual(paused['challenge']['pressedSources'],[])
        self.page.clock.run_for(3000);self.assertEqual(self.state()['clock'],paused['clock'])
        self.up(1)
        self.page.locator('#fishingPause').click(force=True)
        self.page.evaluate('resumeFishingFrame()');self.page.clock.run_for(math.ceil(note['durationSeconds']*1000)+20)
        after=self.state()['challenge'];self.assertEqual(after['hits'],1);self.assertEqual(after['misses'],0)
        second=next(n for n in after['notes'] if n['judgement']=='pending')
        self.page.locator('#fishingRhythmCanvas').focus();self.page.keyboard.down('Space')
        self.page.keyboard.down('Space')
        self.assertEqual(self.state()['challenge']['extras'],0,'Keyboard auto-repeat must not mash a held head')
        self.page.clock.run_for(120)
        self.page.keyboard.up('Space')
        self.assertEqual(self.state()['challenge']['misses'],1)
        self.assertEqual(self.state()['challenge']['pressedSources'],[])
        third=next(n for n in self.state()['challenge']['notes'] if n['judgement']=='pending')
        self.page.clock.run_for(max(1,math.ceil((third['time']-self.state()['clock'])*1000)))
        for _ in range(100):
            if self.state()['clock']>=third['time']:break
            self.page.clock.run_for(5)
        self.down(2)
        self.page.clock.run_for(100)
        self.points.clear();self.client.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]})
        self.assertEqual(self.state()['challenge']['misses'],2)
        self.assertEqual(self.state()['challenge']['pressedSources'],[])

    def assert_hold_transition(self,fish,meter,release_early,press_late,keyboard=False):
        self.begin(fish,meter)
        notes=self.state()['challenge']['notes']
        index=next(i for i,note in enumerate(notes[:-1])
            if note['requiresHold'] and not notes[i+1]['rest']
            and abs(note['holdEndTime']-notes[i+1]['time'])<.000001)
        held,following=notes[index:index+2]
        for prior in notes[:index]:
            if prior['rest']:continue
            self.source_to(prior['time']);self.down(1)
            if prior['requiresHold']:self.source_to(prior['holdEndTime'])
            self.up(1)
        before=self.state()['challenge']
        self.source_to(held['time'])
        if keyboard:
            self.page.locator('#fishingRhythmCanvas').focus();self.page.keyboard.down('Space')
        else:self.down(1)
        self.page.evaluate('resumeFishingFrame()')
        self.source_to(held['holdEndTime']-release_early)
        self.assertIn('Release when ready',self.page.locator('#fishingTap').inner_text())
        if keyboard:self.page.keyboard.up('Space')
        else:self.up(1)
        released=self.state()['challenge']
        self.assertEqual(released['hits'],before['hits'],'Safe early release must not award before the written tail')
        self.assertEqual(released['misses'],before['misses'])
        self.assertEqual(released['extras'],before['extras'])
        self.assertTrue(released['activeHolds'][0]['holdReleased'])
        self.assertEqual(released['pressedSources'],[])
        self.assertIn('Ready for next note',self.page.locator('#fishingTap').inner_text())
        # Let real room frames cross the tail and the following note head.
        # The following note still needs a fresh press, even during grace.
        self.source_to(following['time']+press_late)
        waiting=self.state()['challenge']
        self.assertEqual(waiting['hits'],before['hits']+1)
        self.assertEqual(waiting['misses'],before['misses'])
        target=next(note for note in waiting['notes'] if note['id']==following['id'])
        self.assertEqual(target['judgement'],'pending','Holding one note must never collect the next automatically')
        self.assertEqual(target['holdTransitionFrom'],held['id'])
        self.assertGreaterEqual(target['lateWindow'],press_late)
        if keyboard:self.page.keyboard.down('Space')
        else:self.down(1)
        pressed=self.state()['challenge']
        self.assertEqual(pressed['misses'],before['misses']);self.assertEqual(pressed['extras'],before['extras'])
        if following['requiresHold']:
            self.assertEqual(pressed['hits'],before['hits']+1)
            self.source_to(following['holdEndTime'])
        if keyboard:self.page.keyboard.up('Space')
        else:self.up(1)
        final=self.state()['challenge']
        self.assertEqual(final['hits'],before['hits']+2)
        self.assertEqual(final['misses'],before['misses']);self.assertEqual(final['extras'],before['extras'])
        self.assertEqual(final['pressedSources'],[])
        return following

    def test_same_thumb_can_release_half_early_then_tap_the_next_note_phone(self):
        self.assert_hold_transition('copper-catfish','4/4',release_early=.16,press_late=.12)

    def test_after_a_half_note_rare_followup_accepts_a_small_late_touch_phone(self):
        following=self.assert_hold_transition('amethyst-koi','2/2',release_early=.16,press_late=.12)
        self.assertGreaterEqual(following['lateWindow'],.12,'The easier rare rhythm must retain time to lift and press again')

    def test_keyboard_can_release_and_repress_between_adjacent_half_notes_phone(self):
        self.assert_hold_transition('silver-minnow','2/2',release_early=.16,press_late=.12,keyboard=True)

    def test_quarters_and_dotted_quarters_are_taps_in_compound_meter_phone(self):
        self.begin('cave-guppy','6/8')
        notes=[note for note in self.state()['challenge']['notes'] if not note['rest']][:5]
        self.assertEqual([note['duration'] for note in notes],[1,.5,1,.5,1.5])
        for index,note in enumerate(notes):
            self.assertFalse(note['requiresHold'])
            self.source_to(note['time']);self.down(1);self.up(1)
            state=self.state()['challenge']
            self.assertEqual(state['hits'],index+1);self.assertEqual(state['misses'],0)
            self.assertEqual(state['activeHolds'],[])
        dotted=next(note for note in self.state()['challenge']['notes'] if note['duration']==1.5)
        self.assertFalse(dotted['requiresHold'],'A dotted quarter remains shorter than a half note')

    def test_long_touch_blocks_native_menu_selection_and_drag_gestures_phone(self):
        self.begin('silver-minnow','2/2');note=self.state()['challenge']['notes'][0]
        self.source_to(note['time']);self.down(1)
        # CDP sends a genuine held contact; allow browser gesture timers as
        # well as the game's controlled clock to pass the long-press threshold.
        self.page.wait_for_timeout(800)
        self.page.clock.run_for(800)
        self.assertEqual(len(self.state()['challenge']['activeHolds']),1)
        prevented=self.page.evaluate('''()=>{
          const result={};
          for(const id of ['fishingTap','fishingRhythmCanvas']){
            const node=document.getElementById(id);result[id]={};
            for(const type of ['contextmenu','selectstart','dragstart']){
              const event=new Event(type,{bubbles:true,cancelable:true});
              node.dispatchEvent(event);result[id][type]=event.defaultPrevented;
            }
            result[id].callout=getComputedStyle(node).webkitTouchCallout;
            result[id].selection=getComputedStyle(node).userSelect;
          }
          result.selected=String(getSelection());return result;
        }''')
        for target in ['fishingTap','fishingRhythmCanvas']:
            for event in ['contextmenu','selectstart','dragstart']:
                self.assertTrue(prevented[target][event],target+' must suppress '+event)
            self.assertEqual(prevented[target]['selection'],'none')
        self.assertEqual(prevented['selected'],'')
        self.source_to(note['holdEndTime']);self.up(1)
        self.assertEqual(self.state()['challenge']['hits'],1)
        self.assertEqual(self.state()['challenge']['misses'],0)


if __name__=='__main__':unittest.main(verbosity=2)
