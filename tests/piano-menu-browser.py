"""Child-facing challenge menus use real saved progress, input, and audio."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location(
    'piano_menu_fixture', Path(__file__).with_name('piano-lab-browser.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


class PianoMenuTests(unittest.TestCase):
    setUpClass = classmethod(fixture.PianoLabTests.setUpClass.__func__)
    tearDownClass = classmethod(fixture.PianoLabTests.tearDownClass.__func__)
    setUp = fixture.PianoLabTests.setUp
    tearDown = fixture.PianoLabTests.tearDown
    state = fixture.PianoLabTests.state

    def tools(self, view):
        if self.state()['dialogueOpen']:
            self.page.locator('#pianoDialogueClose').click()
        if not self.state()['menuOpen']:
            self.page.locator('#pianoMenuButton').click()
        if self.state()['mobileView'] != view:
            self.page.locator(f'[data-piano-view="{view}"]').click()

    def challenge(self, screen):
        self.tools('games')
        card = self.page.locator(f'[data-piano-challenge="{screen}"]')
        if not card.is_visible():
            self.page.locator('#pianoChallengeBack').click()
        card.click()

    def play_notes(self, midis):
        self.tools('keyboard')
        self.page.evaluate('''midis=>{
          for(const midi of midis){
            const button=document.querySelector('.piano-key[data-midi="'+midi+'"]');
            button.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
            button.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true}));
          }
        }''', midis)

    def test_four_choices_and_complete_catalogs_do_not_start_challenges(self):
        self.tools('games')
        self.assertEqual(self.page.locator('[data-piano-challenge]').count(), 4)
        self.challenge('melodies')
        identifiers = self.page.locator('#pianoLesson option').evaluate_all(
            'items=>items.map(item=>item.value).filter(Boolean)')
        self.assertEqual(len(identifiers), 9)
        self.assertEqual(self.page.locator('[data-piano-song]').count(), 9)
        for identifier in identifiers:
            self.page.locator(f'[data-piano-song="{identifier}"]').click()
            self.assertEqual(self.page.locator('#pianoLesson').input_value(), identifier)
        self.challenge('scales')
        self.assertEqual(self.page.locator('#pianoScale option').count(), 24)
        self.challenge('intervals')
        self.assertEqual(self.page.locator('#pianoInterval option').count(), 14)
        self.challenge('reading')
        self.assertEqual(self.page.locator('#pianoReadingClef option').evaluate_all(
            'items=>items.map(item=>item.value)'), ['treble', 'bass'])
        self.assertEqual(self.state()['challengeMode'], 'free')
        self.assertEqual(self.page.evaluate('challengeStarts'), [])
        self.assertEqual(self.page.evaluate('rewardCalls'), [])

    def test_selection_and_audio_preview_preserve_a_paused_lesson_and_its_run(self):
        self.challenge('melodies')
        self.page.locator('#pianoLesson').select_option('hot-cross-buns')
        self.page.locator('#pianoLearnMelody').click()
        self.assertFalse(self.state()['menuOpen'])
        self.play_notes([64])
        before = self.state()
        self.assertEqual(before['lessonStep'], 1)
        starts = self.page.evaluate('challengeStarts')
        self.challenge('melodies')
        self.page.locator('#pianoLesson').select_option('mary')
        self.assertEqual(self.state()['lesson'], 'hot-cross-buns')
        self.page.locator('#pianoListenMelody').click()
        self.page.wait_for_function('lab.getState().listening && lab.getState().voiceCount>0')
        self.assertEqual(self.state()['lessonStep'], before['lessonStep'])
        self.assertEqual(self.state()['challengeRun'], before['challengeRun'])
        self.assertEqual(self.page.evaluate('challengeStarts'), starts)
        self.assertEqual(self.page.evaluate('rewardCalls'), [])
        self.page.locator('#pianoChallengeBack').click()
        self.page.wait_for_function('!lab.getState().listening && lab.getState().voiceCount===0')
        self.page.wait_for_timeout(700)
        self.assertEqual(self.state()['voiceCount'], 0,
                         'Canceled preview timers must not start another sound')
        self.assertEqual(self.state()['lessonStep'], 1)
        self.assertEqual(self.page.evaluate('challengeStarts'), starts)

    def test_learning_unlocks_only_that_song_and_survives_recreating_the_lab(self):
        self.challenge('melodies')
        self.page.locator('#pianoLesson').select_option('hot-cross-buns')
        self.assertTrue(self.page.locator('#pianoMemoryStart').is_disabled())
        self.page.locator('#pianoLearnMelody').click()
        self.assertEqual(self.state()['melodyMode'], 'guided')
        self.play_notes(self.state()['lessonPitches'])
        self.assertIn('hot-cross-buns', self.state()['learned'])
        self.assertEqual(self.page.evaluate('rewards'),
                         [{'id': 'piano-lesson:hot-cross-buns', 'amount': 35}])
        self.page.evaluate('lab.destroy();makeLab();lab.open()')
        self.challenge('melodies')
        self.page.locator('#pianoLesson').select_option('mary')
        self.assertTrue(self.page.locator('#pianoMemoryStart').is_disabled())
        self.page.locator('#pianoLesson').select_option('hot-cross-buns')
        self.assertTrue(self.page.locator('#pianoMemoryStart').is_enabled())
        self.page.locator('#pianoMemoryStart').click()
        self.assertFalse(self.state()['menuOpen'])
        self.assertEqual(self.state()['melodyMode'], 'memory')
        self.assertEqual(self.state()['lesson'], 'hot-cross-buns')
        self.assertEqual(len(self.page.evaluate('rewards')), 1,
                         'Starting a memory challenge does not replay the lesson reward')

    def test_scale_memory_and_preview_use_the_selected_scale(self):
        self.challenge('scales')
        self.page.locator('#pianoScale').select_option('c-major')
        self.assertTrue(self.page.locator('#pianoScaleMemory').is_disabled())
        self.page.locator('#pianoScaleListen').click()
        self.page.wait_for_function('lab.getState().listening')
        self.assertEqual(self.page.evaluate('challengeStarts'), [])
        self.page.locator('#pianoChallengeBack').click()
        self.challenge('scales')
        self.page.locator('#pianoStartScale').click()
        self.assertEqual(self.state()['scale'], 'c-major')
        self.play_notes(self.state()['lessonPitches'])
        self.challenge('scales')
        self.page.locator('#pianoScale').select_option('a-minor')
        self.assertTrue(self.page.locator('#pianoScaleMemory').is_disabled())
        self.page.locator('#pianoScale').select_option('c-major')
        self.assertTrue(self.page.locator('#pianoScaleMemory').is_enabled())
        self.page.locator('#pianoScaleMemory').click()
        self.assertEqual(self.state()['scale'], 'c-major')
        self.assertEqual(self.state()['melodyMode'], 'memory')

    def test_blur_cancels_menu_preview_but_does_not_strand_a_preparation_demo(self):
        self.page.clock.install()
        duration = self.page.evaluate('''()=>{
          const tune=CodaPianoMelodies.lessonFor('hot-cross-buns');
          return Math.ceil(tune.totalBeats*60000/tune.quarterBpm)+400;
        }''')
        self.challenge('melodies')
        self.page.locator('#pianoLesson').select_option('hot-cross-buns')
        self.page.locator('#pianoListenMelody').click()
        self.page.clock.run_for(32)
        self.assertTrue(self.state()['listening'])
        self.assertGreater(self.state()['voiceCount'], 0)
        self.page.evaluate("window.dispatchEvent(new Event('blur'))")
        self.assertFalse(self.state()['listening'])
        self.assertEqual(self.state()['voiceCount'], 0)
        self.page.clock.run_for(duration)
        self.assertFalse(self.state()['listening'])
        self.assertEqual(self.state()['voiceCount'], 0,
                         'A canceled menu preview must not restart audio after blur')
        self.assertEqual(self.page.evaluate('challengeStarts'), [])

        self.page.locator('#pianoLearnMelody').click()
        self.challenge('melodies')
        self.page.locator('#pianoLessonRestart').click()
        self.page.locator('[data-piano-dialogue-action="listen"]').click()
        self.page.clock.run_for(32)
        self.assertTrue(self.state()['listening'])
        starts = self.page.evaluate('challengeStarts')
        play = self.page.locator('[data-piano-dialogue-action="play"]')
        self.assertTrue(play.is_disabled())
        self.page.evaluate("window.dispatchEvent(new Event('blur'))")
        self.page.clock.run_for(duration)
        self.assertFalse(self.state()['listening'])
        self.assertTrue(play.is_enabled(),
                        'A preparation demo must finish and restore its play button')
        self.assertEqual(self.page.evaluate('challengeStarts'), starts)
        self.assertEqual(self.page.evaluate('rewardCalls'), [])
        self.assertEqual(self.page.evaluate('challengeCompletions'), [])
        play.click()
        self.assertFalse(self.state()['dialogueOpen'])
        self.assertFalse(self.state()['menuOpen'])
        self.assertEqual(self.state()['lesson'], 'hot-cross-buns')

    def test_back_and_escape_return_one_level_and_keyboard_focus_stays_in_menu(self):
        self.tools('games')
        first = self.page.locator('[data-piano-challenge="reading"]')
        self.assertTrue(first.evaluate('element=>element===document.activeElement'))
        self.page.keyboard.press('Enter')
        self.assertTrue(self.page.locator('#pianoReadingClef').is_visible())
        self.page.keyboard.press('Escape')
        self.assertTrue(first.is_visible())
        self.assertTrue(self.state()['menuOpen'])
        self.assertTrue(first.evaluate('element=>element===document.activeElement'))
        self.page.keyboard.press('Escape')
        self.assertFalse(self.state()['menuOpen'])
        self.assertTrue(self.page.locator('#pianoRoomCanvas').evaluate(
            'element=>element===document.activeElement'))
        self.tools('games')
        controls = self.page.locator('#pianoMenuBackdrop button:visible:not(:disabled), '
                                     '#pianoMenuBackdrop select:visible')
        controls.last.focus()
        self.page.keyboard.press('Tab')
        self.assertTrue(controls.first.evaluate('element=>element===document.activeElement'))
        self.page.keyboard.press('Shift+Tab')
        self.assertTrue(controls.last.evaluate('element=>element===document.activeElement'))

    def test_school_device_sizes_keep_readable_actions_inside_the_dialog(self):
        for width, height in [(1366, 768), (390, 844)]:
            self.page.set_viewport_size({'width': width, 'height': height})
            self.tools('games')
            if not self.page.locator('#pianoChallengeHome').is_visible():
                self.page.locator('#pianoChallengeBack').click()
            for card in self.page.locator('[data-piano-challenge]').all():
                card.scroll_into_view_if_needed()
                box = card.bounding_box()
                self.assertGreaterEqual(box['height'], 48)
                self.assertGreaterEqual(box['x'], 0)
                self.assertLessEqual(box['x'] + box['width'], width)
            self.challenge('melodies')
            primary = self.page.locator('#pianoLearnMelody')
            primary.scroll_into_view_if_needed()
            box = primary.bounding_box()
            self.assertGreaterEqual(box['height'], 48)
            self.assertGreaterEqual(box['y'], 0)
            self.assertLessEqual(box['y'] + box['height'], height)
            self.assertTrue(primary.evaluate('''element=>{
              const r=element.getBoundingClientRect();
              return element.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
            }'''), 'A footer or room overlay must not cover the primary action')
            self.assertLessEqual(self.page.locator('.piano-menu-panel').evaluate(
                'element=>element.scrollWidth'), width)


if __name__ == '__main__':
    unittest.main(verbosity=2)
