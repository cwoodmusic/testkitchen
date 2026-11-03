"""Real input, native audio grading, and the visible streak/celebration UI.

The existing count-in harness controls only AudioContext.currentTime. These
checks do not call a feedback test API or replace the application's grading.
They never contact public services or write Firebase data.
"""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location(
    'rhythm_count_in_fixture', Path(__file__).with_name('rhythm-count-in-browser.py'))
fixture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fixture)


class RhythmFeedbackTests(unittest.TestCase):
    # Reuse the real browser/audio setup without inheriting and rerunning all
    # count-in test methods in this feedback-specific suite.
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
    pointer = fixture.RhythmCountInTests.pointer
    space = fixture.RhythmCountInTests.space

    def streak(self):
        return int(self.page.locator('#note-streak').inner_text())

    def best(self):
        return int(self.page.locator('#note-streak-best').inner_text())

    def begin(self, index=0):
        self.at(index * 20 + 11)
        result = self.state()['round']
        self.assertEqual(result['index'], index)
        return result

    def hit(self, round_data, target, offset=0, pointer=False):
        self.seconds(round_data['start'] + target + offset)
        self.pointer() if pointer else self.space()

    def finish(self, index=0):
        previous = len(self.state()['history'])
        self.at((index + 1) * 20)
        self.page.wait_for_function('count=>practiceHistory.length===count', arg=previous + 1)

    def perfect(self, index=0):
        round_data = self.begin(index)
        for target in round_data['targets']:
            self.hit(round_data, target)
        self.finish(index)
        return round_data

    def particles(self):
        return self.page.evaluate('''()=>{
          const canvas=document.querySelector('#rhythm-confetti');
          if(canvas.hidden||!canvas.width||!canvas.height)return 0;
          const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
          let visible=0;for(let i=3;i<pixels.length;i+=16)if(pixels[i])visible++;
          return visible;
        }''')

    def assert_quiet_feedback(self):
        self.assertTrue(self.page.locator('#rhythm-confetti').is_hidden())
        self.assertTrue(self.page.locator('#rhythm-perfect').is_hidden())

    def test_perfect_round_splashes_once_and_count_in_warmups_keep_the_streak(self):
        self.select(count=False)
        self.start()
        round_data = self.begin()
        self.hit(round_data, 0, offset=-.15, pointer=True)
        self.assertEqual(self.streak(), 1, 'Opening grace is one matched note')
        self.seconds(round_data['start'])
        self.space()
        self.assertEqual(self.streak(), 1, 'Boundary warmup cannot double-count')
        for target in round_data['targets'][1:]:
            self.hit(round_data, target)
        self.assertEqual(self.streak(), len(round_data['targets']))
        self.finish()
        self.assertTrue(self.page.locator('#rhythm-perfect').is_visible())
        self.assertIn('perfect', self.page.locator('#rhythm-perfect').inner_text().lower())
        self.assertFalse(self.page.locator('#rhythm-confetti').is_hidden())
        self.assertGreater(self.particles(), 0, 'The actual celebration canvas must draw')
        self.assertEqual(len(self.state()['reports']), 1)
        self.assertTrue(self.state()['reports'][0]['result']['perfect'])
        self.assertEqual(self.best(), len(round_data['targets']))
        self.at(28.1)
        self.pointer()
        self.space()
        self.assertEqual(self.streak(), len(round_data['targets']),
                         'Free preparation taps cannot break an earned streak')
        self.page.wait_for_timeout(100)
        self.assertEqual(len(self.state()['reports']), 1)

    def test_live_miss_resets_without_needing_another_tap_and_extra_resets_again(self):
        self.select(count=False)
        self.start()
        r = self.begin()
        self.hit(r, r['targets'][0])
        self.hit(r, r['targets'][1])
        self.assertEqual(self.streak(), 2)
        tolerance = self.page.evaluate('tapRound.tolerance')
        self.seconds(r['start'] + r['targets'][2] + tolerance + .20)
        self.assertEqual(self.streak(), 2, 'Queued input keeps its latency allowance')
        self.seconds(r['start'] + r['targets'][2] + tolerance + .28)
        self.page.wait_for_function("document.querySelector('#note-streak').textContent.trim()==='0'")
        self.hit(r, r['targets'][3])
        self.assertEqual(self.streak(), 1)
        self.seconds(r['start'] + r['targets'][3] + .30)
        self.pointer()
        self.assertEqual(self.streak(), 0)
        self.assertGreaterEqual(self.state()['round']['extras'], 1)
        self.assertEqual(self.best(), 2)
        self.finish()
        self.assert_quiet_feedback()
        self.assertFalse(self.state()['reports'][0]['result']['perfect'])

    def test_accepted_early_or_late_matched_note_earns_perfect_confetti(self):
        for offset in [-.10, .10]:
            with self.subTest(offset=offset):
                if self.page.locator('#home').is_visible():
                    self.select(count=False)
                self.start()
                r = self.begin()
                for i, target in enumerate(r['targets']):
                    self.hit(r, target, offset=offset if i == 2 else 0)
                self.assertEqual(self.streak(), len(r['targets']))
                self.finish()
                report = self.state()['reports'][-1]['result']
                self.assertEqual(report['hits'], report['total'])
                self.assertEqual(report['extra'], 0)
                self.assertGreater(report['early'] + report['late'], 0)
                self.assertTrue(report['perfect'])
                self.assertTrue(self.page.locator('#rhythm-perfect').is_visible())
                self.assertFalse(self.page.locator('#rhythm-confetti').is_hidden())
                self.page.locator('#stop').click()

    def test_extra_tap_after_all_notes_prevents_perfect_splash(self):
        self.select(count=False)
        self.start()
        r = self.begin()
        for target in r['targets']:
            self.hit(r, target)
        self.assertEqual(self.streak(), len(r['targets']))
        self.seconds(r['start'] + r['targets'][-1] + .30)
        self.pointer()
        self.assertEqual(self.streak(), 0)
        self.finish()
        result = self.state()['reports'][0]['result']
        self.assertEqual(result['hits'], result['total'])
        self.assertEqual(result['extra'], 1)
        self.assert_quiet_feedback()

    def test_quiet_rests_do_not_add_notes_or_make_empty_rounds_perfect(self):
        self.select(count=False)
        for checkbox in self.page.locator('#choices input').all():
            checkbox.set_checked(checkbox.get_attribute('id') == 'choose-whole-rest')
        self.start()
        r = self.begin()
        self.assertEqual(r['targets'], [])
        self.assertEqual(self.streak(), 0)
        self.finish()
        self.assertEqual(self.streak(), 0)
        self.assertEqual(self.best(), 0)
        self.assertEqual(self.state()['reports'], [], 'Silence cannot create an achievement round')
        self.assert_quiet_feedback()
        self.page.locator('#home-button').click()
        self.select(count=False, rest=True)
        self.start()
        r = self.begin()
        self.assertGreater(r['targets'][0], 0, 'The deterministic rhythm begins with a rest')
        self.seconds(r['start'] + r['targets'][0] / 2)
        self.assertEqual(self.streak(), 0)
        for target in r['targets']:
            self.hit(r, target)
        self.finish()
        self.assertEqual(self.streak(), len(r['targets']))
        self.assertTrue(self.state()['reports'][-1]['result']['perfect'])
        self.assertTrue(self.page.locator('#rhythm-perfect').is_visible())

    def test_stop_home_new_rhythm_and_tempo_cancel_splash_and_reset_current(self):
        for action in ['stop', 'home', 'generate', 'tempo']:
            with self.subTest(action=action):
                if self.page.locator('#home').is_visible():
                    self.select(count=False)
                self.start()
                self.perfect()
                self.assertTrue(self.page.locator('#rhythm-perfect').is_visible())
                self.assertEqual(self.streak(), 8)
                if action == 'home':
                    self.page.locator('#home-button').click()
                elif action == 'tempo':
                    self.page.locator('#tempo').focus()
                    self.page.keyboard.press('ArrowRight')
                else:
                    self.page.locator('#' + action).click()
                self.assertFalse(self.state()['running'])
                self.assertEqual(self.streak(), 0)
                self.assertEqual(self.best(), 8, 'Best remains visible for this page visit')
                self.assert_quiet_feedback()
                self.page.evaluate('__audioTestTime+=100')
                self.page.wait_for_timeout(80)
                self.assertEqual(self.streak(), 0)
                self.assert_quiet_feedback()

    def test_hidden_page_stops_old_particles_and_follow_mode_has_no_streak_hud(self):
        self.select(count=False)
        self.start()
        self.perfect()
        self.page.evaluate("()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));}")
        self.assertFalse(self.state()['running'])
        self.assertEqual(self.streak(), 0)
        self.assert_quiet_feedback()
        self.page.evaluate("()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));}")
        self.page.locator('#home-button').click()
        self.select('follow', False)
        self.assertTrue(self.page.locator('#rhythm-streak').is_hidden())
        self.assert_quiet_feedback()

    def test_reduced_motion_and_saved_motion_off_use_static_perfect_feedback(self):
        for setting in ['device', 'saved']:
            with self.subTest(setting=setting):
                self.page.emulate_media(reduced_motion='reduce' if setting == 'device' else 'no-preference')
                self.page.evaluate("value=>localStorage.setItem('arcadeAnimations',value)", 'off' if setting == 'saved' else 'on')
                if self.page.locator('#home').is_visible():
                    self.select(count=False)
                self.start()
                self.perfect()
                self.assertTrue(self.page.locator('#rhythm-perfect').is_visible())
                self.assertTrue(self.page.locator('#rhythm-confetti').is_hidden())
                self.assertEqual(self.particles(), 0)
                self.assertTrue(self.state()['running'], 'The next listening round still runs')
                self.page.locator('#stop').click()

    def test_repeated_perfect_rounds_replace_the_splash_without_old_timer_overlap(self):
        self.select(count=False)
        self.start()
        self.perfect()
        self.page.wait_for_timeout(1300)
        self.perfect(1)
        self.assertEqual(self.streak(), 16)
        self.assertEqual(self.best(), 16)
        self.assertEqual(len(self.state()['reports']), 2)
        self.assertNotEqual(self.state()['reports'][0]['id'], self.state()['reports'][1]['id'])
        self.assertEqual(self.page.locator('#rhythm-confetti').count(), 1)
        self.assertEqual(self.page.locator('#rhythm-perfect').count(), 1)
        self.page.wait_for_timeout(800)
        self.assertTrue(self.page.locator('#rhythm-perfect').is_visible(),
                        'The previous celebration cannot hide the new splash')
        self.page.wait_for_timeout(2500)
        self.assert_quiet_feedback()
        self.assertEqual(self.streak(), 16)

    def test_phone_and_landscape_counter_are_large_and_do_not_block_real_touch(self):
        self.select(count=False)
        self.start()
        r = self.begin()
        for size in [{'width': 390, 'height': 844}, {'width': 844, 'height': 390}]:
            with self.subTest(size=size):
                self.page.set_viewport_size(size)
                self.page.locator('#tap-pad').scroll_into_view_if_needed()
                self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), size['width'] + 1)
                hud = self.page.locator('#rhythm-streak').bounding_box()
                pad = self.page.locator('#tap-pad').bounding_box()
                self.assertGreaterEqual(hud['width'], 250)
                self.assertGreaterEqual(hud['height'], 60)
                self.assertGreaterEqual(float(self.page.locator('#note-streak').evaluate('node=>parseFloat(getComputedStyle(node).fontSize)')), 40)
                self.assertGreaterEqual(pad['width'], 250)
                self.assertGreaterEqual(pad['height'], 100)
                x, y = pad['x'] + pad['width'] / 2, pad['y'] + pad['height'] / 2
                self.assertTrue(self.page.evaluate('([x,y])=>document.elementFromPoint(x,y)?.closest("#tap-pad")!==null', [x, y]))
                self.assertGreaterEqual(hud['y'], -1)
                self.assertLessEqual(hud['y'] + hud['height'], size['height'] + 1)
        self.seconds(r['start'])
        pad = self.page.locator('#tap-pad').bounding_box()
        cdp = self.context.new_cdp_session(self.page)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': pad['x'] + pad['width'] / 2, 'y': pad['y'] + pad['height'] / 2, 'id': 1, 'radiusX': 4, 'radiusY': 4, 'force': 1}]})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        self.assertEqual(self.streak(), 1)
        self.assertEqual(self.state()['round']['matched'], [0])
        self.page.screenshot(path='/tmp/rhythm56-feedback-mobile.png')


if __name__ == '__main__':
    unittest.main(verbosity=2)
