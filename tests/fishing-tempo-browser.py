"""Exercise changing fish tempos through real game input, sound, and notation.

The site runs at its public origin routed to this checkout in disposable guest
profiles. Time is controlled, but catches still require actual keyboard taps.
"""
import importlib.util
import math
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location('fishing_tempo_upgrade', Path(__file__).with_name('fishing-upgrade-browser.py'))
_upgrade = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_upgrade)


class FishingTempoTests(_upgrade._fish._world.WorldBrowserCase):
    portal = _upgrade.FishingUpgradeTests.portal
    place = _upgrade.FishingUpgradeTests.place
    enter = _upgrade.FishingUpgradeTests.enter
    walk_to = _upgrade.FishingUpgradeTests.walk_to
    board = _upgrade.FishingUpgradeTests.board
    fishing_option = _upgrade._fish.FishingWorldTests.fishing_option
    fishing_action = _upgrade._fish.FishingWorldTests.fishing_action
    fishing_meter = _upgrade._fish.FishingWorldTests.fishing_meter

    def start_exploring(self, meter='4/4'):
        self.enter()
        self.fishing_meter(meter)
        self.board()
        self.assertEqual(self.state()['phase'], 'explore')
    place_single_fish = _upgrade.FishingUpgradeTests.place_single_fish

    def setUp(self):
        _upgrade._fish.FishingWorldTests.setUp(self)
        self.expected_pulses = {}
        # Pause before entering a room; generous headroom avoids protocol
        # latency making pause_at itself target an already-passed instant.
        self.page.clock.pause_at(self.page.evaluate('Date.now()/1000')+5)
        self.page.wait_for_function('CodaRhythmFishing.FISH.some(f=>f.tempo)')
        self.page.evaluate('''()=>{
          window.tempoSounds=[];window.tempoInk=[];window.tempoBars=[];
          const paths=new WeakMap(),Proto=CanvasRenderingContext2D.prototype;
          const begin=Proto.beginPath,move=Proto.moveTo,line=Proto.lineTo,stroke=Proto.stroke;
          Proto.beginPath=function(...args){paths.set(this,[]);return begin.apply(this,args);};
          Proto.moveTo=function(x,y){paths.set(this,[[x,y]]);return move.call(this,x,y);};
          Proto.lineTo=function(x,y){paths.get(this)?.push([x,y]);return line.call(this,x,y);};
          Proto.stroke=function(...args){
            const points=paths.get(this);
            if(this.canvas.id==='fishingRhythmCanvas'&&points?.length===2&&
              Math.abs(points[0][0]-points[1][0])<1e-8&&Math.abs(points[0][1]-points[1][1])===54){
              tempoBars.push({x:points[0][0],clock:CodaArcadeQA.fishing().clock});
              if(tempoBars.length>600)tempoBars.shift();
            }
            return stroke.apply(this,args);
          };
          const Audio=window.AudioContext||window.webkitAudioContext;
          if(Audio){const create=Audio.prototype.createOscillator;
            Audio.prototype.createOscillator=function(...args){
              const osc=create.apply(this,args),ctx=this,start=osc.start,stop=osc.stop;
              let entry=null,frequency=osc.frequency.value;
              const setFrequency=osc.frequency.setValueAtTime;
              osc.frequency.setValueAtTime=function(value,...times){frequency=value;return setFrequency.call(this,value,...times);};
              osc.start=function(when,...rest){
                const state=CodaArcadeQA.fishing();
                entry={frequency,clock:state.clock,audioNow:ctx.currentTime,
                  when:when??ctx.currentTime,phase:state.phase,canceled:false};
                entry.gameTime=entry.clock+Math.max(0,entry.when-entry.audioNow);
                tempoSounds.push(entry);return start.call(this,when,...rest);
              };
              osc.stop=function(when,...rest){
                if(entry&&when===undefined&&entry.gameTime>CodaArcadeQA.fishing().clock+1e-7)entry.canceled=true;
                return stop.call(this,when,...rest);
              };
              return osc;
            };
          }
          const draw=CodaRhythmBeaming.draw;
          CodaRhythmBeaming.draw=function(ctx,options){
            const result=draw.call(this,ctx,options);
            if(ctx.canvas.id==='fishingRhythmCanvas'){
              const state=CodaArcadeQA.fishing();
              tempoInk.push({clock:state.clock,beat:state.challenge?.beat,width:ctx.canvas.width,
                positions:(options.notes||[]).map((note,index)=>({id:note.id,onset:note.onset,
                  time:note.time,rest:note.rest,x:options.xForNote(note,index)}))});
              if(tempoInk.length>400)tempoInk.shift();
            }
            return result;
          };
        }''')

    def state(self):
        value = self.page.evaluate('CodaArcadeQA.fishing()')
        for pulse in (value.get('challenge') or {}).get('pulses', []):
            self.expected_pulses[round(pulse['time'], 8)] = pulse
        return value

    def choose(self, change='steady', rarity='rare', meter=None):
        fish = self.page.evaluate('''([change,rarity,meter])=>CodaRhythmFishing.FISH.find(f=>
          f.rarity===rarity&&f.tempo?.change===change&&(!meter||f.meters.includes(meter)))''',
          [change, rarity, meter])
        self.assertIsNotNone(fish, [change, rarity, meter])
        return fish

    def begin_fish(self, fish, meter=None):
        selected = meter or fish['meters'][0]
        if not self.state()['open']:
            self.start_exploring(selected)
        else:
            self.fishing_meter(selected)
        self.place_single_fish(fish['id'])
        self.assertFalse(self.page.locator('#fishingCast').is_disabled())
        self.fishing_action('#fishingCast')
        self.page.clock.run_for(1400)
        state = self.state()
        self.assertEqual(state['phase'], 'rhythm')
        self.assertEqual(state['challenge']['fish']['id'], fish['id'])
        self.page.locator('#fishingRhythmCanvas').focus()
        return state

    def time_at_beat(self, beat):
        state = self.state()['challenge']
        return self.page.evaluate('''([fish,meter,startTime,beat])=>
          CodaRhythmFishing.createSession({fish,meter,startTime,id:'read-only-tempo-reference'}).timeAtBeat(beat)''',
          [state['fish']['id'], state['meter'], state['startTime'], beat])

    def advance_to(self, target):
        # requestAnimationFrame visits a 16ms grid. Drive its first frame at or
        # just after the intended instant instead of adding25ms to every hit.
        current = self.state()['clock']
        if target > current:
            self.page.clock.run_for(max(1, math.floor((target-current)*1000)))
        for _ in range(20):
            if self.state()['clock'] >= target-.000001:
                return
            self.page.clock.run_for(1)
        self.fail('The controlled game clock must reach the requested target')

    def tap_next(self, maintain=False):
        before = self.state()
        self.assertEqual(before['phase'], 'rhythm')
        self.assertLessEqual(before['challenge']['quarterBpm'], 100)
        notes = [note for note in before['challenge']['notes']
                 if note['judgement']=='pending' and note['time'] >= before['clock']-.02]
        self.assertTrue(notes, before)
        note = notes[0]
        self.advance_to(note['time'])
        # A clean final rest can finish the catch before the next note.
        # Do not send that next Space to the newly focused result button.
        advanced = self.state()
        if advanced['phase'] != 'rhythm':
            self.assertEqual(advanced['phase'], 'caught')
            return advanced, note
        ready = advanced['challenge']
        window = note.get('window', ready['window'])
        self.assertLess(abs(self.state()['clock']-note['time']), window+.000001)
        self.page.locator('#fishingRhythmCanvas').focus()
        self.page.keyboard.down('Space')
        self.last_onset_drawing=self.page.evaluate('tempoInk.at(-1)')
        self.last_onset_state=self.state()
        holding=note.get('requiresHold',note.get('duration',0)>=2)
        gain=before['challenge']['rarity']['hitGain'] if holding else 0
        if maintain and self.state()['challenge']['progress']+gain>65:
            extras=self.state()['challenge']['extras']
            self.page.keyboard.press('Enter')
            self.assertEqual(self.state()['challenge']['extras'],extras+1)
        if holding:self.advance_to(note.get('holdEndTime',note['time']+note['durationSeconds']))
        self.page.keyboard.up('Space')
        after = self.state()
        hits = (after['challenge'] or after['result'])['hits']
        self.assertEqual(hits, before['challenge']['hits']+1,
                         'An actual tap on a fast moving target must hit exactly once')
        return after, note

    def play_through_beat(self, beat):
        target = self.time_at_beat(beat)
        for _ in range(150):
            state = self.state()
            if state['clock'] >= target:
                return state
            self.assertEqual(state['phase'], 'rhythm')
            notes = [note for note in state['challenge']['notes']
                     if note['judgement']=='pending' and note['time'] < target]
            if notes:
                self.tap_next(maintain=True)
            else:
                self.advance_to(target)
                return self.state()
        self.fail('A bounded phrase should reach its requested tempo point')

    def cancel(self):
        self.page.locator('#fishingCancel').click(force=True)
        self.page.clock.run_for(32)
        self.assertEqual(self.state()['phase'], 'explore')

    def test_accelerando_and_ritardando_follow_actual_notes_and_named_tempos(self):
        for change in ['accelerando', 'ritardando']:
            fish = self.choose(change)
            initial = self.begin_fish(fish)['challenge']
            first = initial['tempo']
            self.assertEqual(first['change'], change)
            cue = self.page.locator('#fishingTempoChange').inner_text().lower()
            self.assertIn('faster' if change=='accelerando' else 'slower', cue)
            state = self.play_through_beat(first['startBeat']+(first['endBeat']-first['startBeat'])*.7)
            tempo = state['challenge']['tempo']
            self.assertTrue(tempo['active'])
            if change=='accelerando':self.assertGreater(tempo['currentQuarterBpm'],first['currentQuarterBpm']+5)
            else:self.assertLess(tempo['currentQuarterBpm'],first['currentQuarterBpm']-5)
            self.assertAlmostEqual(tempo['currentPulseBpm']*state['challenge']['meterInfo']['pulseBeats'],
                                   tempo['currentQuarterBpm'],places=6)
            live = self.page.locator('#fishingTempoLabel').inner_text()
            self.assertIn(tempo['marking'], live)
            self.assertEqual(self.page.locator('#fishingTempoChange').get_attribute('role'),'status')
            self.cancel()
        self.assertEqual(self.state()['collection']['total'],0)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),150)

    def test_audio_pulses_and_scrolling_targets_share_the_integrated_tempo_clock(self):
        fish = self.choose('accelerando', rarity='epic')
        self.begin_fish(fish)
        tempo = self.state()['challenge']['tempo']
        self.play_through_beat(tempo['startBeat']+(tempo['endBeat']-tempo['startBeat'])*.55)
        state, note = self.tap_next(maintain=True)
        self.page.clock.run_for(1)
        drawing = self.last_onset_drawing
        drawn = next(item for item in drawing['positions'] if item['id']==note['id'])
        frame = self.last_onset_state['beaming']
        self.assertAlmostEqual(drawn['x'], frame['strike']+(drawn['onset']-drawing['beat'])*frame['spacing'],delta=.15)
        self.assertAlmostEqual(drawn['x'],frame['strike'],delta=frame['spacing']*.09,
                               msg='At its exact timed onset, the real scrolling note must cross the strike line')
        bars=self.page.evaluate('clock=>tempoBars.filter(b=>Math.abs(b.clock-clock)<1e-8)',drawing['clock'])
        expected_bars=[frame['strike']+(bar['layoutBeat']-drawing['beat'])*frame['spacing']
            for bar in frame['barLines']
            if 55<=frame['strike']+(bar['layoutBeat']-drawing['beat'])*frame['spacing']<=drawing['width']]
        for bar in frame['barLines']:
            self.assertAlmostEqual(bar['beat'],bar['bar']*state['challenge']['barBeats'],places=8)
            self.assertGreater(bar['paddingBeats'],0)
            self.assertAlmostEqual(bar['layoutBeat']+bar['paddingBeats'],bar['beat'],places=8)
        self.assertTrue(bars);self.assertTrue(expected_bars)
        for bar in bars:self.assertLess(min(abs(bar['x']-expected) for expected in expected_bars),.15,
            'Visible bar lines must keep their engraving space before the timed measure boundary')
        sounds = self.page.evaluate('tempoSounds.filter(s=>[480,680].includes(s.frequency)&&!s.canceled)')
        self.assertGreater(len(sounds),6)
        expected = list(self.expected_pulses.values())
        for sound in sounds:
            pulse = min(expected,key=lambda value:abs(value['time']-sound['gameTime']))
            self.assertAlmostEqual(sound['gameTime'],pulse['time'],delta=.045)
            self.assertEqual(sound['frequency'],680 if pulse['strong'] else 480)
        regular = sorted([pulse for pulse in expected if not pulse.get('countIn')],key=lambda value:value['beat'])
        intervals = [b['time']-a['time'] for a,b in zip(regular,regular[1:]) if a['beat']>=tempo['startBeat']]
        self.assertGreater(max(intervals)-min(intervals),.02,'The pulse intervals must actually accelerate')
        self.cancel()

    def test_pause_and_hidden_page_freeze_tempo_without_replaying_played_beats(self):
        fish = self.choose('ritardando',rarity='legendary')
        self.begin_fish(fish)
        tempo = self.state()['challenge']['tempo']
        self.play_through_beat(tempo['startBeat']+1)
        self.tap_next(maintain=True)
        self.page.locator('#fishingPause').click(force=True)
        frozen = self.state()
        count = self.page.evaluate('tempoSounds.length')
        self.page.clock.run_for(6000)
        paused = self.state()
        self.assertEqual(paused['clock'],frozen['clock'])
        self.assertEqual(paused['challenge']['tempo'],frozen['challenge']['tempo'])
        self.assertEqual(self.page.evaluate('tempoSounds.length'),count)
        self.page.locator('#fishingPause').click(force=True)
        self.page.clock.run_for(16)
        self.page.evaluate("()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));}")
        hidden = self.state()
        self.page.clock.run_for(4000)
        self.assertEqual(self.state()['clock'],hidden['clock'])
        self.assertEqual(self.state()['challenge']['tempo'],hidden['challenge']['tempo'])
        self.page.evaluate("()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));}")
        self.page.clock.run_for(16)
        self.tap_next(maintain=True)
        sounds = self.page.evaluate('tempoSounds.filter(s=>[480,680].includes(s.frequency)&&!s.canceled)')
        self.assertGreater(len(sounds),2)
        times = [sound['gameTime'] for sound in sounds]
        for at,time in enumerate(times):
            self.assertFalse(any(abs(time-other)<.005 for other in times[at+1:]),
                             'A played metronome click must not replay after resuming')
        self.cancel()

    def test_legendary_sixteenth_rhythms_stay_at_or_below_100_bpm_and_pay_once(self):
        fish = self.choose('accelerando',rarity='legendary',meter='2/2')
        state = self.begin_fish(fish)
        self.assertLessEqual(state['challenge']['tempo']['currentQuarterBpm'],100)
        self.assertLessEqual(max(state['challenge']['tempo']['startQuarterBpm'],state['challenge']['tempo']['endQuarterBpm']),100)
        for _ in range(60):
            if self.state()['phase']!='rhythm':break
            self.tap_next()
        caught = self.state()
        self.assertEqual(caught['phase'],'caught')
        self.assertTrue(caught['result']['perfect'])
        self.assertEqual(caught['collection']['total'],1)
        balance = self.page.evaluate('CodaArcadeQA.notes().balance')
        self.assertEqual(balance,150+fish['notes'])
        self.page.clock.run_for(2000)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),balance)
        self.page.locator('#fishingReturnLake').click(force=True)
        self.place_single_fish('silver-minnow')
        self.fishing_meter('4/4')
        self.fishing_action('#fishingCast');self.page.clock.run_for(1400)
        beginner = self.state()['challenge']
        self.assertEqual(beginner['tempo']['currentQuarterBpm'],76)
        self.assertEqual(beginner['tempo']['change'],'steady')
        self.cancel()

    def test_phone_tempo_labels_keep_the_full_rhythm_button_visible_phone(self):
        for change,meter in [('ritardando','6/8'),('accelerando','2/2')]:
            self.page.set_viewport_size({'width':390,'height':844});self.page.clock.run_for(32)
            fish = self.choose(change,rarity='legendary',meter=meter)
            self.begin_fish(fish,meter)
            for size in [{'width':390,'height':844},{'width':844,'height':390}]:
                self.page.set_viewport_size(size);self.page.clock.run_for(32)
                self.assertLessEqual(self.page.locator('#rhythmFishing').evaluate('e=>e.scrollWidth'),size['width']+1)
                text = self.page.locator('#fishingTempoLabel').inner_text()
                self.assertIn(self.state()['challenge']['tempo']['marking'],text)
                self.assertLessEqual(self.state()['challenge']['tempo']['currentQuarterBpm'],100)
                self.assertTrue('quarter' in text.lower() or '♩' in text,text)
                self.assertIn('dotted-quarter' if meter=='6/8' else 'half-note',text)
                button = self.page.locator('#fishingTap').bounding_box()
                self.assertGreaterEqual(button['height'],64)
                self.assertGreaterEqual(button['y'],0)
                self.assertLessEqual(button['y']+button['height'],size['height']+1)
            self.page.screenshot(path='/tmp/coda-fishing35-tempo-'+meter.replace('/','-')+'-phone.png')
            self.cancel()


if __name__=='__main__':
    unittest.main(verbosity=2)
