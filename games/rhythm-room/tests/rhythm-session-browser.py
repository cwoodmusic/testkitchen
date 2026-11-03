"""Completed Tap Practice rounds cannot be reopened by delayed input events.

Uses the production audio timeline and input handlers in a disposable browser.
No public services, credentials, or existing classroom profiles are used.
"""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location(
    'rhythm_session_fixture', Path(__file__).with_name('rhythm-count-in-browser.py'))
fixture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fixture)


class RhythmSessionTests(unittest.TestCase):
    setUpClass = classmethod(fixture.RhythmCountInTests.setUpClass.__func__)
    tearDownClass = classmethod(fixture.RhythmCountInTests.tearDownClass.__func__)
    setUp = fixture.RhythmCountInTests.setUp
    tearDown = fixture.RhythmCountInTests.tearDown
    route = fixture.RhythmCountInTests.route
    state = fixture.RhythmCountInTests.state
    select = fixture.RhythmCountInTests.select
    start = fixture.RhythmCountInTests.start
    at = fixture.RhythmCountInTests.at
    seconds = fixture.RhythmCountInTests.seconds
    space = fixture.RhythmCountInTests.space

    def complete(self, index):
        self.at(index * 20 + 11.8)
        round_data = self.state()['round']
        self.assertEqual(round_data['index'], index)
        for target in round_data['targets']:
            self.seconds(round_data['start'] + target)
            self.space()
        self.at((index + 1) * 20 + .04)
        self.page.wait_for_function('count=>practiceHistory.length===count', arg=index + 1)

    def test_bundled_font_recordings_and_visible_sound_credits_load(self):
        responses = []
        self.page.on('response', lambda response: responses.append(
            response.url) if response.status == 200 else None)
        self.assertTrue(self.page.evaluate("async()=>{await document.fonts.load('64px Bravura');return document.fonts.check('64px Bravura')}"))
        self.select(count=False)
        for instrument, file in [('sample', 'snare.wav'),
                                 ('piano', 'piano-C4.mp3'),
                                 ('organ', 'organ-C4.mp3')]:
            with self.subTest(instrument=instrument):
                fixture.RhythmCountInTests.configure(self,sound=instrument)
                before = self.page.evaluate('__audioProbe.buffers.length')
                self.page.locator('#play').click()
                self.page.wait_for_function('running&&!loading&&ctx')
                self.at(0)
                self.page.wait_for_function('count=>__audioProbe.buffers.length>count', arg=before)
                self.assertTrue(any(url.endswith('/' + file) for url in responses),
                                'Recorded instruments must load the bundled local file')
                self.assertTrue(self.page.evaluate('__audioProbe.buffers.at(-1).length>1000'))
                self.page.locator('#stop').click()
        self.assertEqual(self.page.evaluate('__audioProbe.decoded.length'), 3)
        self.page.get_by_role('link', name='Sound credits').click()
        self.page.wait_for_url('**/CREDITS.txt')
        self.assertGreater(len(self.page.locator('body').inner_text()), 100)

    def test_delayed_input_does_not_reopen_or_report_a_completed_round(self):
        self.select(count=False)
        self.start()
        self.complete(0)
        before = self.state()
        self.assertEqual(len(before['reports']), 1)
        self.assertTrue(before['reports'][0]['result']['perfect'])
        streak = self.page.locator('#note-streak').inner_text()

        # The audio clock has crossed into listening, but this recent queued
        # event's timestamp still belongs to the previous playing phase.
        self.page.evaluate('''()=>{
          const event=new PointerEvent('pointerdown',{
            bubbles:true,cancelable:true,pointerId:7,isPrimary:true,button:0
          });
          Object.defineProperty(event,'timeStamp',{value:performance.now()-100});
          document.querySelector('#tap-pad').dispatchEvent(event);
        }''')
        self.page.wait_for_timeout(100)
        after = self.state()
        self.assertEqual(after['history'], before['history'],
                         'A completed rhythm must remain one practice-history entry')
        self.assertEqual(after['reports'], before['reports'],
                         'One rhythm must never send a second reward result')
        self.assertEqual(self.page.locator('#note-streak').inner_text(), streak)
        self.assertIsNone(after['round'])
        self.assertEqual(after['phase'], 'listen')

        self.complete(1)
        final = self.state()
        self.assertEqual(len(final['history']), 2)
        self.assertEqual(len(final['reports']), 2)
        self.assertTrue(all(report['result']['perfect'] for report in final['reports']))
        self.assertEqual(len({report['id'] for report in final['reports']}), 2)


if __name__ == '__main__':
    unittest.main(verbosity=2)
