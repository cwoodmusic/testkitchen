"""Meter, counts under the written rhythm, and real tap input on the native audio clock.

Only AudioContext.currentTime is controlled. The production rhythm generator,
notation, audio scheduling, input, grading, streaks, and reward bridge remain
active. Public services are blocked; no student accounts or Firebase are used.
"""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location(
    'rhythm_meter_fixture', Path(__file__).with_name('rhythm-count-in-browser.py'))
fixture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fixture)

METERS = {
    '4/4': {'measure': 4, 'pulse': 1, 'listen': 8, 'prepare': 4, 'round': 20},
    '2/2': {'measure': 4, 'pulse': 2, 'listen': 8, 'prepare': 8, 'round': 24},
    '6/8': {'measure': 3, 'pulse': 1.5, 'listen': 6, 'prepare': 6, 'round': 18},
}


class RhythmMetersTests(unittest.TestCase):
    setUpClass = classmethod(fixture.RhythmCountInTests.setUpClass.__func__)
    tearDownClass = classmethod(fixture.RhythmCountInTests.tearDownClass.__func__)
    tearDown = fixture.RhythmCountInTests.tearDown
    route = fixture.RhythmCountInTests.route
    start = fixture.RhythmCountInTests.start
    seconds = fixture.RhythmCountInTests.seconds
    pointer = fixture.RhythmCountInTests.pointer
    space = fixture.RhythmCountInTests.space

    def setUp(self):
        fixture.RhythmCountInTests.setUp(self)
        self.page.wait_for_selector('#meter', state='attached')
        self.page.wait_for_selector('#counting', state='attached')

    def state(self):
        return self.page.evaluate('''()=>({running,loading,practiceMode,origin,
          meter:$('meter').value,count:$('count').checked,
          phase:$('tap-pad').dataset.phase||null,
          round:tapRound?{index:tapRound.index,start:tapRound.start,
            targets:tapRound.targets,matched:[...tapRound.matched],
            extras:tapRound.extras,taps:tapRound.taps}:null,
          history:practiceHistory,reports:__reports})''')

    def choose_meter(self,meter):
        self.page.locator('#time-signature-control').click()
        self.page.locator('[data-meter-choice="'+meter+'"]').click()

    def configure(self,**values):
        return fixture.RhythmCountInTests.configure(self,**values)

    def choose(self, meter='4/4', blocks=None, mode='tap', count=False):
        if self.page.locator('#home').is_visible():
            self.page.locator('#choose-' + ('tap' if mode == 'tap' else 'follow')).click()
        RhythmMetersTests.choose_meter(self,meter)
        RhythmMetersTests.configure(self,count=count)
        selected = blocks or ['quarter' if meter == '4/4' else
                              'half' if meter == '2/2' else 'compound-dotted-quarter']
        if meter=='6/8':
            aliases={'eighth':'compound-three-eighths','eighths':'compound-three-eighths','quarter':'compound-quarter-eighth','dotted-quarter':'compound-dotted-quarter','sixteenths':'compound-six-sixteenths'}
            selected=[aliases.get(value,value) for value in selected]
            if any(value in selected for value in self.page.evaluate("RhythmRoomMeter.COMPOUND_BLOCKS.filter(b=>b.group==='advanced').map(b=>b.id)")):
                self.page.locator('#compound-advanced').evaluate('node=>node.open=true')
        for checkbox in self.page.locator('#choices input[type=checkbox]').all():
            if checkbox.is_enabled():
                desired=checkbox.get_attribute('id').removeprefix('choose-') in selected
                if checkbox.is_checked()!=desired:checkbox.set_checked(desired)
        self.page.locator('#generate').click()
        self.assertFalse(self.page.locator('#play').is_disabled(),
                         'A compatible rhythm selection must be playable')

    def at(self, quarter_beat, paint=True):
        # A BPM is one primary pulse: quarter note, half note, or dotted quarter.
        self.page.evaluate('''({beat,meters})=>{
          const m=meters[$('meter').value],spq=(60/+$('tempo').value)/m.pulse;
          __audioTestTime=origin+(($('count').checked?m.prepare:0)+beat)*spq;
        }''', {'beat': quarter_beat, 'meters': METERS})
        if paint:
            self.page.wait_for_timeout(45)

    def count_tokens(self):
        return self.page.locator('#staff #rhythm-counts [data-count-index]').evaluate_all("nodes=>nodes.filter(node=>Number(node.dataset.countBeat)<currentMeter().measureBeats).map(node=>node.textContent)")

    def active_count(self):
        return self.page.locator('#staff #rhythm-counts [data-count-index].active').all_text_contents()

    def test_meter_choice_changes_real_notation_and_measure_lengths(self):
        for meter, spec in METERS.items():
            with self.subTest(meter=meter):
                self.choose(meter)
                score = self.page.evaluate('''()=>({
                  measures:staffLayout.measures.map(m=>m.notes.map(n=>({
                    beat:n.beat,duration:n.duration,rest:n.rest}))),
                  glyphs:[...document.querySelectorAll('#staff [data-time-signature]')]
                    .map(node=>node.dataset.glyph),
                  description:document.querySelector('#staff').getAttribute('aria-label'),
                  counts:[...document.querySelectorAll('#staff #rhythm-counts text')].length,oldBoxes:document.querySelectorAll('#staff .beatbox').length,separateGuide:!!document.querySelector('#rhythm-counting')
                })''')
                self.assertEqual(len(score['measures']), 2)
                for bar, notes in enumerate(score['measures']):
                    self.assertTrue(notes)
                    self.assertAlmostEqual(notes[0]['beat'], bar * spec['measure'])
                    self.assertAlmostEqual(sum(n['duration'] for n in notes), spec['measure'])
                    self.assertAlmostEqual(notes[-1]['beat'] + notes[-1]['duration'],
                                           (bar + 1) * spec['measure'])
                    for note in notes:
                        self.assertGreater(note['duration'], 0)
                        self.assertLessEqual(note['beat'] + note['duration'],
                                             (bar + 1) * spec['measure'])
                numerator, denominator = meter.split('/')
                self.assertIn(chr(0xE080 + int(numerator)), score['glyphs'])
                self.assertIn(chr(0xE080 + int(denominator)), score['glyphs'])
                self.assertEqual(score['counts'], 8 if meter == '4/4' else 4,
                                 'Long holds keep main-beat counts beneath the staff')
                self.assertEqual(score['oldBoxes'],0)
                self.assertFalse(score['separateGuide'],'There is no separate count panel')

    def test_eighth_and_sixteenth_counts_track_audio_and_restart_each_measure(self):
        self.choose('4/4', ['eighths'])
        self.assertEqual(self.count_tokens(), ['1', '&', '2', '&', '3', '&', '4', '&'])
        self.start()
        for beat, token in [(0.01, '1'), (.51, '&'), (1.01, '2'),
                            (3.51, '&'), (4.01, '1')]:
            self.at(beat)
            self.assertEqual(self.active_count(), [token])
            self.assertEqual(self.page.locator('#rhythm-counts .active').get_attribute('data-count-beat'), str(int(beat) if beat % 1 < .5 else int(beat) + .5))
            before = self.active_count()
            self.page.wait_for_timeout(120)
            self.assertEqual(self.active_count(), before,
                             'The count must use the audio clock, not elapsed wall time')
        self.page.locator('#stop').click()
        self.assertEqual(self.active_count(), [])
        self.choose('4/4', ['sixteenths'])
        self.assertEqual(self.count_tokens(),
                         ['1', 'e', '&', 'a', '2', 'e', '&', 'a',
                          '3', 'e', '&', 'a', '4', 'e', '&', 'a'])
        self.start()
        for beat, token in [(.01, '1'), (.26, 'e'), (.51, '&'), (.76, 'a'), (1.01, '2')]:
            self.at(beat)
            self.assertEqual(self.active_count(), [token])

    def test_cut_time_counts_half_note_pulses_and_six_eight_counts_three_parts(self):
        self.choose('2/2', ['quarter'])
        self.assertEqual(self.count_tokens(), ['1', '&', '2', '&'])
        self.start()
        for beat, token in [(.01, '1'), (1.01, '&'), (2.01, '2'), (3.01, '&'), (4.01, '1')]:
            self.at(beat)
            self.assertEqual(self.active_count(), [token])
        self.page.locator('#stop').click()
        self.choose('6/8', ['eighth'])
        self.page.evaluate('Math.random=()=>0')
        self.page.locator('#generate').click()
        self.assertEqual(self.count_tokens(), ['1', 'la', 'li', '2', 'la', 'li'])
        beams = self.page.evaluate('''()=>notationBeams(events).map(group=>
          group.map(index=>({beat:events[index].beat,duration:events[index].duration})))''')
        self.assertEqual(len(beams), 4)
        self.assertTrue(all(len(group) == 3 for group in beams),
                        'Six eighth notes are grouped as three plus three in each bar')
        self.start()
        for beat, token in [(.01, '1'), (.51, 'la'), (1.01, 'li'),
                            (1.51, '2'), (2.01, 'la'), (2.51, 'li'), (3.01, '1')]:
            self.at(beat)
            self.assertEqual(self.active_count(), [token])

    def test_new_meters_count_four_primary_pulses_then_grade_one_perfect_result(self):
        for meter in ['2/2', '6/8']:
            with self.subTest(meter=meter):
                self.choose(meter)
                spec = METERS[meter]
                previous = len(self.state()['history'])
                reports = len(self.state()['reports'])
                self.start()
                for index, cue in enumerate(['1', '2', 'READY!', 'GO!']):
                    self.at(spec['listen'] + index * spec['pulse'] + .02)
                    self.assertEqual(self.state()['phase'], 'count-in')
                    self.assertEqual(self.page.locator('#rhythm-count-in strong').inner_text(), cue)
                    if index < 3:
                        self.pointer()
                        self.assertEqual(self.state()['round']['extras'], 0)
                        self.assertEqual(self.state()['round']['taps'], [])
                round_data = self.state()['round']
                self.seconds(round_data['start'] - .15)
                self.space()
                self.assertEqual(self.state()['round']['matched'], [0])
                self.seconds(round_data['start'])
                self.pointer()
                self.assertEqual(self.state()['round']['matched'], [0])
                self.assertEqual(self.state()['round']['extras'], 0)
                for target in round_data['targets'][1:]:
                    self.seconds(round_data['start'] + target)
                    self.space()
                self.at(spec['round'] + .01)
                self.page.wait_for_function('n=>practiceHistory.length===n', arg=previous + 1)
                result = self.state()['history'][-1]
                self.assertEqual(result['hits'], 4)
                self.assertEqual(result['missed'], 0)
                self.assertEqual(result['extra'], 0)
                self.assertEqual(len(self.state()['reports']), reports + 1)
                self.assertTrue(self.state()['reports'][-1]['result']['perfect'])
                self.page.evaluate('''()=>{
                  const event=new PointerEvent('pointerdown',{
                    bubbles:true,cancelable:true,pointerId:7,isPrimary:true,button:0});
                  Object.defineProperty(event,'timeStamp',{value:performance.now()-100});
                  $('tap-pad').dispatchEvent(event);
                }''')
                self.page.wait_for_timeout(100)
                self.assertEqual(len(self.state()['reports']), reports + 1)
                self.assertEqual(len(self.state()['history']), previous + 1,
                                 'A queued old tap cannot reopen a completed meter-aware round')
                clicks = self.page.evaluate('__audioProbe.oscillators.filter(item=>[850,1200].includes(item.frequency))')
                spq = self.page.evaluate('60/+$('+'"tempo"'+').value') / spec['pulse']
                for index in range(4):
                    expected = self.state()['origin'] + (spec['listen'] + index * spec['pulse']) * spq
                    self.assertEqual(sum(abs(click['time'] - expected) < 1e-8 for click in clicks), 1,
                                     'One metronome click per half/dotted-quarter pulse')
                self.page.locator('#stop').click()

    def test_optional_initial_count_uses_the_same_four_primary_pulses(self):
        for meter in ['2/2', '6/8']:
            with self.subTest(meter=meter):
                self.choose(meter, count=True)
                spec = METERS[meter]
                self.start()
                for index in range(4):
                    self.at(-spec['prepare'] + index * spec['pulse'] + .02)
                    self.assertEqual(self.state()['phase'], 'initial-count')
                    self.assertIn(str(index + 1), self.page.locator('#status').inner_text())
                    self.assertTrue(self.page.locator('#rhythm-count-in').is_hidden(),
                                    'The turn countdown belongs only before the player turn')
                    self.pointer()
                    self.assertIsNone(self.state()['round'])
                    self.assertEqual(self.state()['reports'], [])
                self.at(.01)
                self.assertEqual(self.state()['phase'], 'listen')
                self.assertEqual(self.active_count(), ['1'])
                self.page.locator('#stop').click()

    def test_follow_mode_has_no_extra_preparation_in_new_meters(self):
        for meter in ['2/2', '6/8']:
            with self.subTest(meter=meter):
                self.choose(meter, mode='follow')
                spec = METERS[meter]
                self.start()
                self.at(spec['listen'] - .01)
                self.assertEqual(self.page.locator('#status').inner_text(), 'Listen')
                self.at(spec['listen'] + .01)
                self.assertIn('Your turn', self.page.locator('#status').inner_text())
                self.assertTrue(self.page.locator('#rhythm-count-in').is_hidden())
                self.assertTrue(self.page.locator('#tap-panel').is_hidden())
                self.at(spec['listen'] * 2 + .01)
                self.assertEqual(self.page.evaluate('shownRound'), 1)
                self.assertEqual(self.state()['history'], [])
                self.assertEqual(self.state()['reports'], [])
                self.page.locator('#stop').click()

    def test_counting_includes_silent_rests_and_can_be_hidden_without_stopping(self):
        self.choose('4/4', ['quarter-rest'])
        self.start()
        self.at(12.51)
        self.assertEqual(self.active_count(), ['(1)'])
        self.assertEqual(self.state()['round']['targets'], [])
        self.assertEqual(self.state()['round']['extras'], 0)
        RhythmMetersTests.configure(self,counting='off')
        self.assertTrue(self.state()['running'])
        self.assertTrue(self.page.locator('#rhythm-counts').is_hidden())
        self.assertTrue(self.page.locator('#n0').is_visible())
        RhythmMetersTests.configure(self,counting='on')
        self.at(13.51)
        self.assertTrue(self.page.locator('#rhythm-counts').is_visible())
        self.assertEqual(self.active_count(), ['(2)'])
        self.assertEqual(self.state()['reports'], [])

    def test_changing_meter_stops_previous_audio_and_mobile_controls_remain_usable(self):
        self.choose('4/4', ['sixteenths'])
        self.start()
        self.at(9.2)
        self.assertTrue(self.page.locator('#rhythm-count-in').is_visible())
        RhythmMetersTests.choose_meter(self,'6/8')
        self.assertFalse(self.state()['running'])
        self.assertFalse(self.state()['loading'])
        self.assertTrue(self.page.evaluate('ctx===null'))
        self.assertIsNone(self.state()['round'])
        self.assertTrue(self.page.locator('#rhythm-count-in').is_hidden())
        self.assertEqual(self.state()['reports'], [])
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.choose('6/8', ['eighth'])
        RhythmMetersTests.configure(self,counting='on')
        self.start()
        self.at(7.6)
        self.page.locator('#tap-pad').scroll_into_view_if_needed()
        self.assertFalse(self.page.locator('#tap-pad').is_disabled())
        for selector in ['#time-signature-control', '#practice-settings-button', '.staff']:
            with self.subTest(selector=selector):
                box = self.page.locator(selector).bounding_box()
                self.assertGreaterEqual(box['x'], -1)
                self.assertLessEqual(box['x'] + box['width'], 391)
        pad = self.page.locator('#tap-pad').bounding_box()
        self.assertGreaterEqual(pad['width'], 250)
        self.assertGreaterEqual(pad['height'], 100)
        x, y = pad['x'] + pad['width'] / 2, pad['y'] + pad['height'] / 2
        self.assertTrue(self.page.evaluate('([x,y])=>!!document.elementFromPoint(x,y)?.closest("#tap-pad")', [x, y]))
        cdp = self.context.new_cdp_session(self.page)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints':
                 [{'x': x, 'y': y, 'id': 1, 'radiusX': 4, 'radiusY': 4, 'force': 1}]})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        cdp.detach()
        self.assertEqual(self.state()['round']['extras'], 0)
        self.page.screenshot(path='/tmp/rhythm-meters-phone.png')


if __name__ == '__main__':
    unittest.main(verbosity=2)
