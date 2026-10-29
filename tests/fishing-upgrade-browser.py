"""Exercise live fish battles, silent rests, and meter-specific encounters."""
import importlib.util
import math
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode=True
_spec=importlib.util.spec_from_file_location('fishing_upgrade_world',Path(__file__).with_name('fishing-world-browser.py'))
_fish=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_fish)


class FishingUpgradeTests(_fish._world.WorldBrowserCase):
    state=_fish.FishingWorldTests.state
    portal=_fish.FishingWorldTests.portal
    place=_fish.FishingWorldTests.place
    enter=_fish.FishingWorldTests.enter
    walk_to=_fish.FishingWorldTests.walk_to
    board=_fish.FishingWorldTests.board

    def setUp(self):
        _fish.FishingWorldTests.setUp(self)
        # Freeze between protocol calls so Presto's narrow note windows do not
        # absorb unrelated browser automation latency. Actual input is retained.
        self.page.clock.pause_at(self.page.evaluate('Date.now()/1000')+5)
        self.page.wait_for_function('CodaRhythmFishing.availableFish&&CodaFishingBattle')
        self.page.evaluate('''()=>{
          window.fishingRestInk=[];window.fishingToneStarts=[];
          const fill=CanvasRenderingContext2D.prototype.fillText;
          CanvasRenderingContext2D.prototype.fillText=function(text,...args){
            const glyph=String(text).codePointAt(0);
            if(this.canvas.id==='fishingRhythmCanvas'&&glyph>=0xe4e3&&glyph<=0xe4e7)
              fishingRestInk.push(glyph);
            return fill.call(this,text,...args);
          };
          const Audio=window.AudioContext||window.webkitAudioContext;
          if(Audio){const create=Audio.prototype.createOscillator;
            Audio.prototype.createOscillator=function(...args){const osc=create.apply(this,args),start=osc.start;
              osc.start=function(...times){fishingToneStarts.push({frequency:osc.frequency.value,
                clock:CodaArcadeQA.fishing().clock});return start.apply(this,times);};return osc;};}
        }''')

    def start_exploring(self,meter='4/4'):
        self.enter();self.page.locator('#fishingMeter').select_option(meter)
        self.board();self.assertEqual(self.state()['phase'],'explore')

    def fish(self,rarity='common',meter='4/4',exclusive=False):
        return self.page.evaluate('''([rarity,meter,exclusive])=>CodaRhythmFishing.availableFish(meter)
          .find(f=>f.rarity===rarity&&(!exclusive||f.meters.length===1))''',[rarity,meter,exclusive])

    def place_single_fish(self,fish_id):
        result=self.page.evaluate('''fish=>{
          const p=CodaArcadeQA.roomProject('fishing');p.entities={};
          for(let i=0;i<7;i++)p.entities['fish-slot-'+i]=i===0?
            {speciesId:fish,x:350,y:410,visible:true}:{visible:false};
          return CodaArcadeQA.applyRoomProject('fishing',p);
        }''',fish_id)
        self.assertTrue(result);self.page.clock.run_for(32)

    def cast_prepared(self):
        self.assertFalse(self.page.locator('#fishingCast').is_disabled())
        self.page.locator('#fishingCast').click();self.page.clock.run_for(1400)
        self.assertEqual(self.state()['phase'],'rhythm')
        self.assertIsNotNone(self.state()['challenge'])
        self.page.locator('#fishingRhythmCanvas').focus()
        return self.state()

    def advance_to(self,time):
        current=self.state()['clock']
        if time>current:self.page.clock.run_for(max(1,math.floor((time-current)*1000)))
        for _ in range(20):
            if self.state()['clock']>=time-.000001:return
            self.page.clock.run_for(1)
        self.fail('The controlled game clock should reach the rhythm target')

    def tap_note(self,maintain=False):
        state=self.state();note=next(note for note in state['challenge']['notes']
            if note['judgement']=='pending' and note['time']>=state['clock']-.03)
        self.advance_to(note['time']);self.page.locator('#fishingRhythmCanvas').focus()
        self.page.keyboard.down('Space')
        head=self.state()
        holding=note.get('requiresHold',note.get('duration',0)>=2)
        gain=head['challenge']['rarity']['hitGain'] if holding else 0
        if maintain and head['phase']=='rhythm' and head['challenge']['progress']+gain>65:
            self.page.keyboard.press('Enter')
        if holding:self.advance_to(note.get('holdEndTime',note['time']+note['durationSeconds']))
        self.page.keyboard.up('Space')
        self.page.clock.run_for(16)
        return self.state()

    def play_until(self,time):
        for _ in range(80):
            state=self.state()
            if state['clock']>=time:return
            self.assertEqual(state['phase'],'rhythm')
            notes=[note for note in state['challenge']['notes'] if note['judgement']=='pending'
                and note['time']>=state['clock']-.03 and note['time']<time]
            if notes:self.tap_note(maintain=True)
            else:self.advance_to(time);return
        self.fail('The real rhythm should advance to the requested battle time')

    def battle_hash(self):
        return self.page.locator('#fishingBattle canvas').evaluate('''c=>{
          const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
          let n=2166136261;for(const x of a)n=Math.imul(n^x,16777619);return n>>>0;
        }''')

    def test_battle_fish_and_line_react_to_real_taps_and_pause_with_the_game(self):
        self.page.locator('#fxBtn').click()  # Off -> Full, so animated reactions are visible.
        self.start_exploring();self.place_single_fish(self.fish()['id'])
        before=self.cast_prepared()['battle']
        self.assertTrue(before['active']);self.assertFalse(before['announcementVisible'])
        self.assertFalse(self.page.locator('.fishing-battle-announcement').is_visible())
        hit=self.tap_note()['battle']
        self.assertEqual(hit['reaction'],'hit');self.assertGreater(hit['progress'],before['progress'])
        self.assertLess(hit['tension'],before['tension']);self.assertLess(hit['fishX'],before['fishX'])
        hit_hash=self.battle_hash();self.page.keyboard.press('Space');self.page.clock.run_for(16)
        bad=self.state()['battle']
        self.assertEqual(bad['reaction'],'extra','An extra tap between quarter notes must pull the fish away')
        self.assertGreater(bad['tension'],hit['tension'])
        self.assertGreater(bad['fishX'],hit['fishX']);self.assertNotEqual(hit_hash,self.battle_hash())
        self.assertGreater(bad['line']['mouth']['x'],bad['line']['rod']['x'])
        self.page.locator('#fishingPause').click();self.page.clock.run_for(16)
        frozen=self.state();picture=self.battle_hash()
        self.page.clock.run_for(5000);paused=self.state()
        self.assertEqual(paused['clock'],frozen['clock'])
        self.assertEqual(paused['battle']['elapsed'],frozen['battle']['elapsed'])
        self.assertEqual(self.battle_hash(),picture)
        self.page.locator('#fishingCancel').click();self.page.clock.run_for(32)
        self.assertFalse(self.state()['battle']['active'])
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),150)
        self.assertEqual(self.state()['collection']['total'],0)

    def test_rare_epic_and_legendary_announcements_are_once_per_encounter_and_pause_aware(self):
        self.start_exploring()
        for rarity in ['rare','epic','legendary']:
            fish=self.fish(rarity);self.assertIsNotNone(fish)
            self.place_single_fish(fish['id'])
            count=self.state()['battle'].get('announcements',0)
            state=self.cast_prepared();battle=state['battle']
            self.assertEqual(battle['announcements'],count+1)
            self.assertTrue(battle['announcementVisible'])
            popup=self.page.locator('.fishing-battle-announcement')
            self.assertTrue(popup.is_visible());self.assertIn(rarity.upper()+' FISH!',popup.inner_text())
            self.assertIn(fish['name'],popup.inner_text())
            self.page.locator('#fishingPause').click();self.page.clock.run_for(16)
            remaining=self.state()['battle']['announcementRemaining']
            self.page.clock.run_for(7000)
            self.assertEqual(self.state()['battle']['announcementRemaining'],remaining)
            self.assertTrue(popup.is_visible())
            self.page.locator('#fishingPause').click()
            self.play_until(battle['startedTime']+3.65)
            self.assertFalse(self.state()['battle']['announcementVisible']);self.assertFalse(popup.is_visible())
            count=self.state()['battle']['announcements']
            self.page.locator('#fishingPause').click();self.page.locator('#fishingPause').click()
            self.page.clock.run_for(48)
            self.assertEqual(self.state()['battle']['announcements'],count)
            self.assertFalse(popup.is_visible(),'Resuming must not repeat the rarity notice')
            self.page.locator('#fishingCancel').click();self.page.clock.run_for(32)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),150)

    def test_exclusive_species_wait_for_their_meter_and_use_that_meter_when_hooked(self):
        self.start_exploring()
        for meter in ['4/4','6/8','2/2']:
            fish=self.fish('rare',meter,exclusive=True);self.assertIsNotNone(fish)
            wrong='6/8' if meter=='4/4' else '4/4'
            self.page.locator('#fishingMeter').select_option(wrong)
            self.place_single_fish(fish['id'])
            saved=self.page.evaluate("CodaArcadeQA.roomProject('fishing').entities['fish-slot-0']")
            shadow=self.state()['shadows'][0]
            self.assertEqual(shadow['fishId'],fish['id']);self.assertFalse(shadow['meterAvailable'])
            self.assertTrue(self.page.locator('#fishingCast').is_disabled(),
                'An out-of-meter developer fish must not be catchable')
            self.page.locator('#fishingMeter').select_option(meter);self.page.clock.run_for(32)
            self.assertEqual(self.page.evaluate("CodaArcadeQA.roomProject('fishing').entities['fish-slot-0']"),saved)
            self.assertTrue(self.state()['shadows'][0]['meterAvailable'])
            state=self.cast_prepared();self.assertEqual(state['challenge']['fish']['id'],fish['id'])
            self.assertEqual(state['challenge']['meter'],meter)
            self.page.locator('#fishingCancel').click();self.page.clock.run_for(32)
        self.assertEqual(self.state()['collection']['total'],0)

    def test_wild_encounters_and_collection_hints_follow_the_selected_meter(self):
        self.enter()
        for meter in ['4/4','6/8','2/2']:
            self.page.locator('#fishingMeter').select_option(meter);self.page.clock.run_for(100)
            actual=self.page.evaluate('''()=>{const s=CodaArcadeQA.fishing();return s.shadows
              .filter(f=>f.visible&&f.meterAvailable).map(f=>CodaRhythmFishing.canFishInMeter(f.fishId,s.meter));}''')
            self.assertEqual(len(actual),7);self.assertTrue(all(actual))
        self.page.locator('#fishingCollection').click()
        self.assertNotIn('Every fish can be caught in each',self.page.locator('#fishingCollectionPanel').inner_text())
        fish=self.page.evaluate('CodaRhythmFishing.FISH')
        self.assertEqual(self.page.locator('[data-fish-id]').count(),30)
        for entry in fish:
            card=self.page.locator('[data-fish-id="'+entry['id']+'"]')
            self.assertEqual(card.get_attribute('data-meters'),' '.join(entry['meters']))
            text=card.locator('.fishing-fish-habitat').inner_text()
            if len(entry['meters'])==3:self.assertIn('All three meters',text)
            else:
                for meter in entry['meters']:
                    self.assertIn('Cut time' if meter=='2/2' else meter,text)
        self.assertTrue(any(len(f['meters'])==1 for f in fish))
        self.assertTrue(any(len(f['meters'])==3 for f in fish))

    def test_written_rests_are_engraved_and_silent_without_lowering_progress(self):
        self.start_exploring();self.place_single_fish('rainbow-trout')
        state=self.cast_prepared();rest=next(n for n in state['challenge']['notes'] if n['rest'])
        while True:
            upcoming=[n for n in self.state()['challenge']['notes'] if n['judgement']=='pending' and n['time']<rest['time']]
            if not upcoming:break
            self.tap_note()
        before=self.state()['challenge'];self.page.evaluate('fishingToneStarts=[]')
        self.advance_to(rest['time']+rest['durationSeconds']/2)
        quiet=self.state()['challenge']
        self.assertEqual(quiet['progress'],before['progress']);self.assertEqual(quiet['hits'],before['hits'])
        self.assertEqual(quiet['misses'],before['misses']);self.assertEqual(quiet['extras'],before['extras'])
        self.assertIn(0xe4e5,self.page.evaluate('fishingRestInk'),'Quarter rests must use the bundled music glyph')
        frequencies=self.page.evaluate('fishingToneStarts.map(t=>t.frequency)')
        self.assertFalse(any(abs(f-523.25)<1 or abs(f-660)<1 for f in frequencies),
            'The metronome may continue, but a written rest must not trigger a fish-note tone')
        self.page.keyboard.press('Space');after=self.state()['challenge']
        self.assertEqual(after['hits'],quiet['hits']);self.assertGreater(after['extras'],quiet['extras'])
        self.assertLess(after['progress'],quiet['progress'])

    def test_phone_battle_graphic_leaves_readable_staff_and_a_large_tap_target_phone(self):
        self.start_exploring();self.place_single_fish(self.fish()['id']);self.cast_prepared()
        for size in [{'width':390,'height':844},{'width':844,'height':390}]:
            self.page.set_viewport_size(size);self.page.clock.run_for(64)
            self.assertLessEqual(self.page.locator('#rhythmFishing').evaluate('e=>e.scrollWidth'),size['width']+1)
            battle=self.page.locator('#fishingBattle').bounding_box();tap=self.page.locator('#fishingTap').bounding_box()
            self.assertGreaterEqual(battle['height'],60);self.assertLessEqual(battle['height'],112)
            self.assertGreaterEqual(tap['height'],144 if size['height']>size['width'] else 112)
            self.assertGreaterEqual(tap['y'],0)
            self.assertLessEqual(tap['y']+tap['height'],size['height']+1,
                'The full rhythm button must fit beside the battle graphic without scrolling')
            box=self.page.locator('#fishingTap').bounding_box()
            self.assertGreaterEqual(box['y'],0);self.assertLessEqual(box['y']+box['height'],size['height']+1)
        self.page.set_viewport_size({'width':390,'height':844});self.page.clock.run_for(32)
        self.page.screenshot(path='/tmp/coda-fishing34-battle-phone.png',full_page=True)


if __name__=='__main__':unittest.main(verbosity=2)
