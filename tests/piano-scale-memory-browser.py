"""Round-trip scales, memory play, and completion-note release in real Chromium.

Use the production room and keyboard with an isolated wallet/storage fixture.
The completion callbacks must follow played pitches, never demo/recording audio.
"""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location(
    'piano_scale_memory_fixture', Path(__file__).with_name('piano-lab-browser.py'))
_piano = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_piano)
_floor_spec = importlib.util.spec_from_file_location(
    'piano_full_key_floor_fixture', Path(__file__).with_name('piano-scales-browser.py'))
_floor = importlib.util.module_from_spec(_floor_spec)
_floor_spec.loader.exec_module(_floor)


class PianoScaleMemoryTests(unittest.TestCase):
    setUpClass = classmethod(_piano.PianoLabTests.setUpClass.__func__)
    tearDownClass = classmethod(_piano.PianoLabTests.tearDownClass.__func__)
    setUp = _piano.PianoLabTests.setUp
    tearDown = _piano.PianoLabTests.tearDown
    state = _piano.PianoLabTests.state
    menu = _piano.PianoLabTests.menu
    close_panels = _piano.PianoLabTests.close_panels
    play_sequence = _piano.PianoLabTests.play_sequence
    begin_memory = _piano.PianoLabTests.begin_memory
    choose_melody = _piano.PianoLabTests.choose_melody

    def start_scale(self, identifier, play=True):
        self.menu('games')
        self.page.locator('#pianoScale').select_option(identifier)
        self.page.locator('#pianoStartScale').click()
        if play:
            self.page.locator('[data-piano-dialogue-action="play"]').click()
        return self.state()['lessonPitches']

    def test_every_scale_requires_the_whole_ascent_and_descent(self):
        identifiers = self.page.locator('#pianoScale option').evaluate_all(
            'options=>options.map(option=>option.value)')
        self.assertEqual(len(identifiers), 24)
        self.assertEqual(sum(identifier.endswith('-major') for identifier in identifiers), 12)
        self.assertEqual(sum(identifier.endswith('-minor') for identifier in identifiers), 12)
        for identifier in identifiers:
            with self.subTest(scale=identifier):
                pitches = self.start_scale(identifier)
                self.assertEqual(len(pitches), 15)
                self.assertEqual(pitches[7] - pitches[0], 12)
                self.assertEqual(pitches[8:], list(reversed(pitches[:7])))
                pattern = [2, 1, 2, 2, 1, 2, 2] if identifier.endswith('minor') else [2, 2, 1, 2, 2, 2, 1]
                self.assertEqual([b-a for a, b in zip(pitches[:7], pitches[1:8])], pattern)
                for pitch in set(pitches):
                    self.assertEqual(self.page.locator(f'.piano-key[data-midi="{pitch}"]').count(), 1)
                events = self.page.evaluate('challengeCompletions.length')
                rewards = self.page.evaluate('rewards.length')
                self.play_sequence(pitches[:8])
                self.assertEqual(self.state()['lessonStep'], 8)
                self.assertFalse(self.state()['challengeRun']['finished'])
                self.assertEqual(self.page.evaluate('challengeCompletions.length'), events)
                self.assertEqual(self.page.evaluate('rewards.length'), rewards,
                                 'Reaching the top does not finish the round-trip scale')
                self.play_sequence(pitches[8:])
                state = self.state()
                self.assertEqual(state['lessonStep'], 15)
                self.assertTrue(state['challengeRun']['finished'])
                event = self.page.evaluate('challengeCompletions.at(-1)')
                self.assertEqual((event['kind'], event['mode'], event['lessonId'], event['mistakes']),
                                 ('scale', 'guided', identifier, 0))
                self.assertEqual(event['scaleType'], 'minor' if identifier.endswith('minor') else 'major')
                self.assertIn('piano-scale:'+identifier, state['completed'])

    def test_scale_memory_hides_answers_tracks_mistakes_and_pays_once_across_visits(self):
        pitches = self.start_scale('c-minor')
        self.menu('games')
        self.assertTrue(self.page.locator('#pianoMemoryStart').is_disabled())
        self.play_sequence(pitches)
        self.assertEqual(self.page.evaluate('rewards'), [{'id':'piano-scale:c-minor','amount':35}])
        self.assertTrue(self.page.locator('[data-piano-dialogue-action="memory"]').is_visible())
        self.begin_memory()
        run = self.state()['challengeRun']['runId']
        self.assertEqual(self.state()['melodyMode'], 'memory')
        self.assertTrue(self.state()['wallStaff']['answerHidden'])
        self.assertEqual(self.state()['wallStaff']['notes'], [])
        self.assertFalse(self.state()['keyHighlight']['visible'])
        self.menu('keyboard')
        self.assertEqual(self.page.locator('.piano-key.is-next').count(), 0)
        self.assertNotRegex(self.page.locator('#pianoLessonProgress').inner_text(), r'\b[A-G](?:[♯♭])?\b')
        self.play_sequence(pitches[:2])
        self.play_sequence([pitches[0]+1])
        self.assertEqual(self.state()['lessonStep'], 0)
        self.assertEqual(self.state()['challengeRun']['runId'], run)
        self.assertEqual(self.state()['challengeRun']['mistakes'], 1)
        self.assertEqual(self.page.evaluate('challengeCompletions.length'), 1)
        self.assertNotRegex(self.page.locator('#pianoRoomMessage').inner_text(), r'(?:lower|higher|highest) [A-G]')
        self.play_sequence(pitches)
        event = self.page.evaluate('challengeCompletions.at(-1)')
        self.assertEqual((event['kind'], event['mode'], event['lessonId'], event['mistakes']),
                         ('scale', 'memory', 'c-minor', 1))
        expected = [{'id':'piano-scale:c-minor','amount':35},
                    {'id':'piano-scale-memory:c-minor','amount':60}]
        self.assertEqual(self.page.evaluate('rewards'), expected)
        self.page.evaluate('lab.destroy();makeLab();lab.open()')
        self.start_scale('c-minor')
        self.begin_memory()
        self.play_sequence(pitches)
        self.assertEqual(self.page.evaluate('rewards'), expected)
        self.assertIn('piano-scale-memory:c-minor', self.state()['completed'])

    def test_scale_memory_waits_for_a_successfully_saved_guided_reward(self):
        self.page.evaluate("rewardMode='fail'")
        pitches = self.start_scale('g-major')
        self.play_sequence(pitches)
        self.assertEqual(self.page.evaluate('rewards'), [])
        self.assertNotIn('piano-scale:g-major', self.state()['completed'])
        self.assertEqual(self.page.locator('[data-piano-dialogue-action="memory"]').count(), 0)
        self.menu('games')
        self.assertTrue(self.page.locator('#pianoMemoryStart').is_disabled())
        self.page.evaluate("rewardMode='success'")
        self.start_scale('g-major')
        self.play_sequence(pitches)
        self.begin_memory()
        self.assertEqual(self.state()['melodyMode'], 'memory')

    def test_scale_demonstrations_and_recorded_playback_never_answer_the_challenge(self):
        self.page.clock.install()
        self.page.clock.pause_at(self.page.evaluate('Date.now()/1000')+5)
        pitches = self.start_scale('c-major', play=False)
        run = self.state()['challengeRun']['runId']
        self.page.locator('[data-piano-dialogue-action="listen"]').click()
        self.assertTrue(self.state()['listening'])
        self.page.clock.run_for(20000)
        self.assertFalse(self.state()['listening'])
        self.assertEqual(self.state()['lessonStep'], 0)
        self.assertEqual(self.state()['challengeRun']['runId'], run)
        self.assertEqual(self.page.evaluate('rewards'), [])
        self.assertEqual(self.page.evaluate('challengeCompletions'), [])
        self.page.locator('[data-piano-dialogue-action="play"]').click()
        self.play_sequence(pitches)
        self.begin_memory()
        memory_run = self.state()['challengeRun']['runId']
        self.menu('games')
        self.page.locator('#pianoListenMelody').click()
        self.page.clock.run_for(20000)
        self.assertEqual(self.state()['melodyMode'], 'memory')
        self.assertEqual(self.state()['challengeRun']['runId'], memory_run)
        self.assertEqual(self.state()['lessonStep'], 0)
        self.assertEqual(len(self.page.evaluate('challengeCompletions')), 1)
        self.assertTrue(self.state()['wallStaff']['answerHidden'])
        self.page.evaluate('''pitches=>{
          lab.destroy();entries.set('codaPianoTakeV1',JSON.stringify(pitches.map((midi,n)=>({midi,at:n*.05,duration:.03}))));
          makeLab();lab.open();
        }''', pitches)
        self.start_scale('c-major')
        self.begin_memory()
        self.menu('recording')
        self.page.locator('#pianoPlayback').click()
        self.page.clock.run_for(1500)
        self.assertFalse(self.state()['playing'])
        self.assertEqual(self.state()['lessonStep'], 0)
        self.assertEqual(len(self.page.evaluate('challengeCompletions')), 1)
        self.assertEqual(self.page.evaluate('rewards'), [{'id':'piano-scale:c-major','amount':35}])

    def test_completion_dialogue_keeps_the_last_note_ring_and_panic_or_close_stops_it(self):
        pitches = self.start_scale('c-major')
        self.play_sequence(pitches)
        self.assertTrue(self.state()['dialogueOpen'])
        self.assertGreater(self.state()['voiceCount'], 0,
                           'Opening the completion dialogue must not cut off the last note')
        self.assertEqual(self.state()['held'], [], 'No piano input remains held behind the dialogue')
        self.page.wait_for_timeout(150)
        self.assertGreater(self.state()['voiceCount'], 0)
        self.page.wait_for_function('lab.getState().voiceCount===0', timeout=7000)
        self.start_scale('c-major')
        self.play_sequence(pitches)
        self.assertGreater(self.state()['voiceCount'], 0)
        self.menu('settings')
        self.page.locator('#pianoPanic').click()
        self.assertEqual(self.state()['voiceCount'], 0, 'Release all notes always stops completion tails')
        self.start_scale('c-major')
        self.play_sequence(pitches)
        self.assertGreater(self.state()['voiceCount'], 0)
        self.page.evaluate('lab.close()')
        self.assertEqual(self.state()['voiceCount'], 0, 'Leaving the room stops all audio promptly')


class PianoScaleFloorMemoryTests(_floor._world.WorldBrowserCase):
    setUp = _floor.PianoScaleTests.setUp
    state = _floor.PianoScaleTests.state
    totals = _floor.PianoScaleTests.totals
    dismiss_notifications = _floor.PianoScaleTests.dismiss_notifications
    menu = _floor.PianoScaleTests.menu
    close_panels = _floor.PianoScaleTests.close_panels
    walk = _floor.PianoScaleTests.walk
    floor_key = _floor.PianoScaleTests.floor_key
    start_scale = _floor.PianoScaleTests.start_scale

    def full_high_scale(self, touch=False):
        self.start_scale('b-major')
        pitches = [71,73,75,76,78,80,82,83,82,80,78,76,75,73,71]
        self.assertEqual(self.state()['lessonPitches'], pitches)
        self.assertEqual(len(self.state()['floorKeys']), 24)
        self.assertEqual({key['midi'] for key in self.state()['floorKeys']}, set(range(60,84)))
        before = self.totals()
        for index, midi in enumerate(pitches):
            self.floor_key(midi)
            self.assertEqual(self.state()['scaleStep'], index,
                             'Stepping across the new high keys does not submit an answer')
            if touch:
                self.page.locator('.coda-touch-interact').tap()
            else:
                self.page.keyboard.press('e')
            self.page.clock.run_for(32)
            self.assertEqual(self.state()['scaleStep'], index+1)
            if index == 7:
                self.assertNotIn('piano-scale:b-major', self.state()['completed'])
        self.assertIn('piano-scale:b-major', self.state()['completed'])
        self.assertEqual(self.totals(), {'notes':before['notes']+35,'xp':before['xp']+100})
        self.assertGreater(self.state()['voiceCount'], 0,
                           'The final floor-key E release must preserve its completion tail')

    def check_labels_and_artwork(self, suffix):
        self.menu('settings')
        self.page.locator('#pianoKeyNames').check()
        for identifier, midi, spelling in [('f-sharp-major',77,'E♯'),('e-flat-minor',71,'C♭')]:
            self.start_scale(identifier)
            self.page.clock.run_for(64)
            self.assertIn(spelling, self.page.evaluate('__pianoPaint.texts.map(item=>item.text)'),
                          'The painted keyboard should preserve the scale\'s written spelling')
            self.menu('keyboard')
            self.assertIn(spelling, self.page.locator(f'.piano-key[data-midi="{midi}"]').get_attribute('aria-label'))
            self.close_panels()
            self.page.screenshot(path=f'/tmp/piano85-{identifier}-{suffix}.png')
        source = self.page.evaluate('''async()=>{
          const editor=CodaArcadeQA.roomEditor('piano'),source=await editor.getArtworkSource('background.piano');
          const probe=document.createElement('canvas');probe.width=1000;probe.height=620;
          const g=probe.getContext('2d');g.drawImage(source,0,0,1000,620);
          return {canvas:source instanceof HTMLCanvasElement,width:source.width,height:source.height,
            keys:CodaArcadeQA.piano().floorKeys.filter(key=>key.midi>=82).map(key=>{
              const p=key.polygon,x=p.reduce((sum,point)=>sum+point[0],0)/4,
                y=key.black?p.reduce((sum,point)=>sum+point[1],0)/4:Math.max(...p.map(point=>point[1]))-9;
              return {midi:key.midi,rgba:Array.from(g.getImageData(Math.floor(x),Math.floor(y),1,1).data)};
            })};
        }''')
        self.assertTrue(source['canvas'], 'The pixel editor uses the expanded painted keyboard source')
        self.assertGreater(source['width'], 1000)
        black = next(key['rgba'] for key in source['keys'] if key['midi']==82)
        white = next(key['rgba'] for key in source['keys'] if key['midi']==83)
        self.assertLess(sum(black[:3])/3, sum(white[:3])/3-60,
                        'The highest A-sharp and B keep separate black/white artwork')

    def test_high_a_sharp_and_b_are_playable_on_the_painted_floor_and_in_editor(self):
        self.full_high_scale()
        self.check_labels_and_artwork('desktop')

    def test_high_key_scale_and_enharmonic_labels_are_usable_on_phone(self):
        self.full_high_scale(touch=True)
        self.check_labels_and_artwork('phone')
        self.assertLessEqual(self.page.locator('#pianoroom').evaluate('host=>host.scrollWidth'),390)


if __name__ == '__main__':
    unittest.main(verbosity=2)
