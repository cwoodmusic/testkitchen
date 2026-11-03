"""The child's count-in and no-missed-note celebration on the real audio timeline.

Only AudioContext.currentTime is controlled by the existing native-audio
fixture. Production input, grading, DOM, local samples, and animation frames
remain active. Public services are blocked and no student profiles are used.
"""
import importlib.util
from pathlib import Path
import re
import sys
import unittest

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location(
    'rhythm_turn_fixture', Path(__file__).with_name('rhythm-count-in-browser.py'))
fixture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fixture)


class RhythmTurnCountdownTests(unittest.TestCase):
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

    def countdown(self):
        return self.page.locator('#rhythm-count-in')

    def assert_cue(self, text):
        self.assertTrue(self.countdown().is_visible())
        cue = self.countdown().locator('strong')
        self.assertEqual(cue.inner_text().rstrip('!').upper(), text.upper())
        self.assertEqual(cue.evaluate('node=>getComputedStyle(node).pointerEvents'), 'none')

    def begin(self):
        self.at(11.8)
        self.assertEqual(self.state()['round']['index'], 0)
        return self.state()['round']

    def hit(self, round_data, target, offset=0):
        self.seconds(round_data['start'] + target + offset)
        self.space()

    def finish(self):
        previous = len(self.state()['history'])
        self.at(20)
        self.page.wait_for_function('count=>practiceHistory.length===count', arg=previous + 1)

    def assert_no_celebration(self):
        self.assertTrue(self.page.locator('#rhythm-perfect').is_hidden())
        self.assertTrue(self.page.locator('#rhythm-confetti').is_hidden())

    def assert_translucent(self, overlay):
        style = overlay.evaluate('''node=>{const style=getComputedStyle(node);return {
          opacity:Number(style.opacity),background:style.backgroundColor,
          image:style.backgroundImage,blur:style.backdropFilter,pointer:style.pointerEvents
        }}''')
        self.assertGreater(style['opacity'], 0)
        self.assertLess(style['opacity'], 1, 'The lettering itself lets notation show through')
        self.assertIn(style['blur'], ['none', ''], 'The underlying staff must stay sharp')
        self.assertEqual(style['pointer'], 'none')
        paints = re.findall(r'rgba?\(([^)]+)\)', style['background'] + ' ' + style['image'])
        self.assertTrue(paints, 'Inspect the actual rendered backdrop paint')
        for paint in paints:
            channels = paint.split(',')
            alpha = float(channels[-1]) if len(channels) == 4 else 1
            self.assertLess(alpha, .5, 'An opaque backdrop would cover the music staff')

    def test_your_turn_has_four_big_cues_and_go_is_the_fourth_count(self):
        self.select(count=True)
        self.start()
        for beat in [-3.5, -2.5, -.5, 0, 4, 7.9]:
            self.at(beat)
            self.assertTrue(self.countdown().is_hidden(),
                            'Initial listening count-in and listening are not the player countdown')
        for beat, text in [(8, '1'), (9, '2'), (10, 'READY'), (11, 'GO')]:
            self.at(beat)
            self.assert_cue(text)
            self.assertEqual(self.state()['phase'], 'count-in')
        self.at(12)
        self.assertTrue(self.countdown().is_hidden(), 'The four-beat overlay clears when tapping begins')
        self.assertEqual(self.state()['phase'], 'play')
        self.assertTrue(self.page.locator('#n0.active').is_visible(),
                        'The real notation still highlights the first playable note')
        self.at(13)
        self.assertTrue(self.countdown().is_hidden())
        self.assertEqual(self.state()['history'], [])

    def test_warmup_pointer_and_keyboard_work_through_the_overlay_without_a_penalty(self):
        self.select(count=False)
        self.start()
        for beat, text in [(8.2, '1'), (9.2, '2'), (10.2, 'READY')]:
            self.at(beat)
            self.assert_cue(text)
            self.assertFalse(self.state()['disabled'])
            before = self.page.evaluate('__audioProbe.buffers.length')
            self.pointer()
            self.space()
            self.assertEqual(self.page.evaluate('__audioProbe.buffers.length'), before + 2)
            self.assertEqual(self.state()['round']['matched'], [])
            self.assertEqual(self.state()['round']['extras'], 0)
            self.assertEqual(self.state()['round']['taps'], [])
        self.assertEqual(self.state()['history'], [])
        self.assertEqual(self.state()['reports'], [])

    def test_listen_and_follow_never_gets_the_tap_countdown(self):
        self.select('follow', count=True)
        self.start()
        for beat in [-3.5, 0, 8, 9, 10, 11, 12, 16, 24]:
            self.at(beat)
            self.assertTrue(self.countdown().is_hidden())
        self.assertTrue(self.page.locator('#tap-panel').is_hidden())
        self.assertEqual(self.state()['history'], [])
        self.assertEqual(self.state()['reports'], [])

    def test_stopping_switching_home_tempo_and_new_rhythm_clear_old_cues(self):
        for action in ['stop', 'home', 'generate', 'tempo', 'hidden']:
            with self.subTest(action=action):
                if self.page.locator('#home').is_visible():
                    self.select(count=False)
                self.start()
                self.at(9.1)
                self.assert_cue('2')
                if action == 'home':
                    self.page.locator('#home-button').click()
                elif action == 'tempo':
                    self.page.locator('#tempo').focus()
                    self.page.keyboard.press('ArrowRight')
                elif action == 'hidden':
                    self.page.evaluate("()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));}")
                else:
                    self.page.locator('#' + action).click()
                self.page.wait_for_function('!running&&!loading&&ctx===null')
                self.assertTrue(self.countdown().is_hidden())
                self.assert_no_celebration()
                self.page.evaluate('__audioTestTime+=100')
                self.page.wait_for_timeout(60)
                self.assertTrue(self.countdown().is_hidden())
                self.assertEqual(self.state()['reports'], [])
                if action == 'hidden':
                    self.page.evaluate("()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));}")

    def test_all_notes_hit_get_perfect_even_with_an_accepted_early_or_late_tap(self):
        for offset in [-.12, .12]:
            with self.subTest(offset=offset):
                if self.page.locator('#home').is_visible():
                    self.select(count=False)
                self.start()
                round_data = self.begin()
                for index, target in enumerate(round_data['targets']):
                    self.hit(round_data, target, offset if index == 2 else 0)
                self.finish()
                result = self.state()['reports'][-1]['result']
                self.assertEqual(result['hits'], result['total'])
                self.assertEqual(result['extra'], 0)
                self.assertGreater(result['early'] + result['late'], 0,
                                   'Timing advice remains available despite matching the note')
                self.assertTrue(result['perfect'])
                self.assertTrue(self.page.locator('#rhythm-perfect').is_visible())
                self.assertIn('PERFECT', self.page.locator('#rhythm-perfect').inner_text())
                self.assertFalse(self.page.locator('#rhythm-confetti').is_hidden())
                self.assertEqual(self.state()['history'][-1]['missed'], 0)
                self.assert_translucent(self.page.locator('#rhythm-perfect'))
                self.assertTrue(self.page.locator('#staff').is_visible())
                self.page.locator('#stop').click()

    def test_missed_note_or_extra_tap_does_not_award_a_perfect_round(self):
        for mistake in ['miss', 'extra']:
            with self.subTest(mistake=mistake):
                if self.page.locator('#home').is_visible():
                    self.select(count=False)
                self.start()
                round_data = self.begin()
                for index, target in enumerate(round_data['targets']):
                    if mistake == 'miss' and index == 2:
                        continue
                    self.hit(round_data, target)
                if mistake == 'extra':
                    self.hit(round_data, round_data['targets'][-1], .30)
                self.finish()
                self.assertFalse(self.state()['reports'][-1]['result']['perfect'])
                self.assertEqual(self.state()['history'][-1]['missed'], 1 if mistake == 'miss' else 0)
                self.assertEqual(self.state()['history'][-1]['extra'], 1 if mistake == 'extra' else 0)
                self.assert_no_celebration()
                self.page.locator('#stop').click()

    def test_empty_rest_round_cannot_award_perfect(self):
        self.select(count=False)
        for checkbox in self.page.locator('#choices input').all():
            checkbox.set_checked(checkbox.get_attribute('id') == 'choose-whole-rest')
        self.start()
        self.assertEqual(self.begin()['targets'], [])
        self.finish()
        self.assertEqual(self.state()['reports'], [])
        self.assert_no_celebration()

    def test_countdown_fits_phone_and_landscape_and_does_not_intercept_real_touch(self):
        self.select(count=False)
        self.start()
        for size in [{'width': 390, 'height': 844}, {'width': 844, 'height': 390}]:
            with self.subTest(size=size):
                self.page.set_viewport_size(size)
                self.at(9.2)
                self.page.locator('#tap-pad').scroll_into_view_if_needed()
                self.assert_cue('2')
                self.assert_translucent(self.countdown())
                self.assertTrue(self.page.locator('#staff').is_visible())
                cue = self.countdown().locator('strong')
                self.assertGreaterEqual(cue.evaluate('node=>parseFloat(getComputedStyle(node).fontSize)'), 64)
                box = cue.bounding_box()
                self.assertGreaterEqual(box['x'], -1)
                self.assertLessEqual(box['x'] + box['width'], size['width'] + 1)
                self.assertGreaterEqual(box['y'], -1)
                self.assertLessEqual(box['y'] + box['height'], size['height'] + 1)
                pad = self.page.locator('#tap-pad').bounding_box()
                x, y = pad['x'] + pad['width'] / 2, pad['y'] + pad['height'] / 2
                self.assertTrue(self.page.evaluate('([x,y])=>document.elementFromPoint(x,y)?.closest("#tap-pad")!==null', [x, y]))
                cdp = self.context.new_cdp_session(self.page)
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y, 'id': 1, 'radiusX': 4, 'radiusY': 4, 'force': 1}]})
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
                cdp.detach()
                self.assertEqual(self.state()['round']['extras'], 0)
                self.assertEqual(self.state()['round']['taps'], [])
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.at(10.2)
        self.page.screenshot(path='/tmp/rhythm-turn-countdown-mobile.png')
        self.page.set_viewport_size({'width': 1400, 'height': 1050})
        self.at(11.2)
        self.assert_cue('GO')
        self.page.screenshot(path='/tmp/rhythm-turn-countdown-desktop.png')

    def test_reduced_motion_keeps_the_big_cue_and_static_perfect_feedback(self):
        self.page.emulate_media(reduced_motion='reduce')
        self.select(count=False)
        self.start()
        self.at(9.2)
        self.assert_cue('2')
        self.assertEqual(self.countdown().evaluate('node=>node.getAnimations({subtree:true}).filter(value=>value.playState==="running").length'), 0)
        round_data = self.begin()
        for target in round_data['targets']:
            self.hit(round_data, target)
        self.finish()
        self.assertTrue(self.page.locator('#rhythm-perfect').is_visible())
        self.assertTrue(self.page.locator('#rhythm-confetti').is_hidden())
        self.assertTrue(self.state()['reports'][-1]['result']['perfect'])

    def test_fullscreen_owns_overlay_and_returning_to_normal_does_not_duplicate_it(self):
        self.select(count=False)
        self.start()
        self.at(9.2)
        self.assert_cue('2')
        self.page.evaluate('document.querySelector("#practice").requestFullscreen()')
        self.page.wait_for_function('document.fullscreenElement===document.querySelector("#practice")')
        self.at(9.3)
        self.assert_cue('2')
        self.assertTrue(self.page.evaluate('document.fullscreenElement.contains(document.querySelector("#rhythm-count-in"))'))
        self.page.evaluate('document.exitFullscreen()')
        self.page.wait_for_function('document.fullscreenElement===null')
        self.at(10.2)
        self.assert_cue('READY')
        self.assertEqual(self.page.locator('#rhythm-count-in').count(), 1)
        self.page.locator('#stop').click()
        self.assertTrue(self.countdown().is_hidden())


if __name__ == '__main__':
    unittest.main(verbosity=2)
