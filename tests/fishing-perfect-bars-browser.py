"""Four-bar perfect catches and eight-bar recovery use actual rhythm input."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location('perfect_bars_tempo', Path(__file__).with_name('fishing-tempo-browser.py'))
_tempo = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_tempo)
_base = _tempo.FishingTempoTests


class FishingPerfectBarsTests(_tempo._upgrade._fish._world.WorldBrowserCase):
    setUp = _base.setUp
    state = _base.state
    portal = _base.portal
    place = _base.place
    enter = _base.enter
    walk_to = _base.walk_to
    board = _base.board
    start_exploring = _base.start_exploring
    place_single_fish = _base.place_single_fish
    fishing_option = _base.fishing_option
    fishing_action = _base.fishing_action
    fishing_meter = _base.fishing_meter
    begin_fish = _base.begin_fish
    time_at_beat = _base.time_at_beat
    advance_to = _base.advance_to

    def fish(self, name):
        return self.page.evaluate('name=>CodaRhythmFishing.FISH.find(fish=>fish.id===name)', name)

    def strike(self, note):
        self.advance_to(note['time'])
        if self.state()['phase'] != 'rhythm':
            return False
        before = self.state()['challenge']['hits']
        self.page.locator('#fishingRhythmCanvas').focus()
        self.page.keyboard.down('Space')
        if note['requiresHold']:
            self.advance_to(note['holdEndTime'])
        self.page.keyboard.up('Space')
        after = self.state()
        self.assertEqual(after['challenge']['hits'], before + 1)
        return True

    def play_until(self, beat):
        target = self.time_at_beat(beat)
        for _ in range(200):
            state = self.state()
            if state['phase'] != 'rhythm' or state['clock'] >= target:
                return state
            notes = [note for note in state['challenge']['notes']
                     if note['judgement'] == 'pending' and note['time'] < target]
            if notes:
                self.strike(notes[0])
            else:
                self.advance_to(target)
                return self.state()
        self.fail('The written phrase should reach the requested bar')

    def test_four_clean_bars_finish_the_last_rest_and_pay_only_once(self):
        fish = self.fish('bluegill')
        initial = self.begin_fish(fish, '4/4')['challenge']
        self.assertEqual(initial['targetBars'], 4)
        self.assertTrue(initial['perfectEligible'])
        self.assertIn('0 / 4 bars', self.page.locator('#fishingProgressLabel').inner_text())
        # Bluegill's fourth bar is a whole-bar rest; it must finish silently.
        self.play_until(12)
        end = self.time_at_beat(16)
        self.advance_to(end - .08)
        before = self.state()
        self.assertEqual(before['phase'], 'rhythm')
        self.assertEqual(before['challenge']['completedBars'], 3)
        self.assertIn('3 / 4 bars', self.page.locator('#fishingProgressLabel').inner_text())
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'), 150)
        self.advance_to(end + .032)
        caught = self.state()
        self.assertEqual(caught['phase'], 'caught')
        self.assertTrue(caught['result']['perfect'])
        self.assertEqual(caught['challenge']['completedBars'], 4)
        self.assertAlmostEqual(caught['result']['duration'], end - initial['musicStart'], places=6)
        balance = 150 + fish['notes']
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'), balance)
        self.assertEqual(caught['collection']['total'], 1)
        xp = self.page.evaluate('CodaArcadeQA.progression().xp')
        self.assertGreater(xp, 0)
        self.page.clock.run_for(2000)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'), balance)
        self.page.locator('#fishingReturnLake').click(force=True)
        self.page.locator('#fishingClose').click(force=True)
        self.load()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'), balance)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'), xp)
        self.assertEqual(self.state()['collection']['total'], 1)

    def test_one_extra_tap_removes_the_shortcut_and_keeps_eight_bar_recovery(self):
        self.begin_fish(self.fish('silver-minnow'), '4/4')
        note = next(note for note in self.state()['challenge']['notes'] if note['judgement'] == 'pending')
        self.strike(note)
        self.page.keyboard.press('Enter')
        failed = self.state()['challenge']
        self.assertEqual(failed['extras'], 1)
        self.assertFalse(failed['perfectEligible'])
        self.assertEqual(failed['targetBars'], 8)
        self.assertIn('Keep going', self.page.locator('#fishingProgressLabel').inner_text())
        self.play_until(16)
        self.assertEqual(self.state()['phase'], 'rhythm', 'Four later clean bars cannot erase the mistake')
        self.play_until(32)
        self.assertEqual(self.state()['phase'], 'rhythm', 'An extra tap still needs the original progress recovery')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'), 150)
        final = self.play_until(48)
        self.assertEqual(final['phase'], 'caught')
        self.assertFalse(final['result']['perfect'])
        self.assertEqual(final['result']['extras'], 1)
        self.assertGreater(final['result']['duration'], self.time_at_beat(32) - final['challenge']['musicStart'])

    def test_phone_counter_is_clear_and_practice_stays_endless_phone(self):
        self.begin_fish(self.fish('silver-minnow'), '4/4')
        self.play_until(8)
        self.assertIn('2 / 4 bars', self.page.locator('#fishingProgressLabel').inner_text())
        self.assertLessEqual(self.page.locator('#rhythmFishing').evaluate('e=>e.scrollWidth'), 390)
        button = self.page.locator('#fishingTap').bounding_box()
        self.assertGreaterEqual(button['height'], 64)
        self.page.screenshot(path='/tmp/fishing47-perfect-counter-phone.png')
        self.page.locator('#fishingCancel').click(force=True)
        self.fishing_action('#fishingPractice')
        self.page.locator('#fishingPracticeStart').click(force=True)
        self.page.clock.run_for(32)
        initial = self.state()['challenge']
        self.assertTrue(initial['practice'])
        self.assertFalse(initial['perfectEligible'])
        ongoing = self.play_until(initial['barBeats'] * 10)
        self.assertEqual(ongoing['phase'], 'rhythm')
        self.assertIsNone(ongoing['challenge']['result'])
        self.assertEqual(ongoing['challenge']['misses'], 0)
        self.assertEqual(ongoing['challenge']['extras'], 0)
        self.assertIn('Practice', self.page.locator('#fishingProgressLabel').inner_text())
        self.assertEqual(ongoing['collection']['total'], 0)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'), 150)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'), 0)


# Keep unittest discovery limited to these focused checks, not the imported
# tempo suite whose helpers are reused above.
del _base

if __name__ == '__main__':
    unittest.main(verbosity=2)
