"""Earn DJ rewards through real arrow inputs in the assembled world.

Playwright's clock advances only between notes; external services are blocked
by the existing disposable-world fixture. No production scoring hooks are used.
"""
import importlib.util
import math
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
from world_navigation_helpers import open_destination

spec = importlib.util.spec_from_file_location('dance_rewards_world', Path(__file__).with_name('learning-world-browser.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


class DanceRewardTests(fixture.WorldBrowserCase):
    def setUp(self):
        self.clock_installed = False
        super().setUp()
        self.page.clock.pause_at(self.page.evaluate('Date.now()/1000') + 1)

    def load(self):
        if not self.clock_installed:
            self.page.clock.install()
            self.clock_installed = True
        super().load()

    def state(self):
        return self.page.evaluate('CodaArcadeQA.danceGame().game')

    def start(self, difficulty):
        open_destination(self.page, 'dj')
        self.page.locator('[data-start-dance]').click()
        self.page.locator('[data-dance-mode="'+difficulty+'"]').click()
        self.assertEqual(self.state()['phase'], 'countin')
        return self.state()

    def advance_to(self, target):
        now = self.page.evaluate('performance.now()/1000')
        self.page.clock.fast_forward(max(0, math.ceil((target-now)*1000)))

    def play_note(self, note, engine):
        self.advance_to(engine['startedAt']+(engine['chart']['countInBeats']+note['beat'])*engine['beatSeconds'])
        self.page.keyboard.press('Arrow'+note['direction'].capitalize())

    def finish(self, engine):
        self.advance_to(engine['startedAt']+(engine['chart']['countInBeats']+engine['chart']['totalBeats'])*engine['beatSeconds']+.02)
        self.assertEqual(self.state()['phase'], 'result')

    def journal(self):
        return self.page.evaluate('JSON.parse(localStorage.getItem("codaPlayerProgressV1")||"null")')

    def test_completed_dances_earn_saved_tracks_and_gear_without_spending_or_equipping(self):
        before = self.page.evaluate('({avatar:localStorage.getItem("musicArcadeV1"),notes:CodaArcadeQA.notes()})')
        runs = []
        expected_unlocks = {'easy':['First Steps DJ track','Roller skates'],
                            'normal':['Shutter shades'],
                            'hard':['Midnight Headliner DJ track','Boombox']}
        for difficulty in ['easy', 'normal', 'hard']:
            game = self.start(difficulty)
            runs.append(game['runId'])
            for note in game['engine']['notes']:
                self.play_note(note, game['engine'])
            self.finish(game['engine'])
            self.assertTrue(self.state()['engine']['perfect'])
            reward_text = self.page.locator('.dance-rhythm-rewards').inner_text()
            self.assertIn('XP', reward_text)
            for label in expected_unlocks[difficulty]:
                self.assertIn(label, reward_text)
            self.assertIn('Score ', self.page.locator('.dance-rhythm-help').inner_text())
            self.page.locator('[data-dance-done]').click()

        self.assertEqual(len(set(runs)), 3)
        saved = self.journal()
        ids = [event['id'] for event in saved['events']]
        for run in runs:
            self.assertEqual(ids.count('game:dance:'+run), 1)
        achievements = self.page.evaluate('CodaArcadeQA.achievements().items.filter(item=>item.category==="dance")')
        self.assertEqual(len(achievements), 6)
        self.assertTrue(all(item['earned'] for item in achievements))
        progress = self.page.evaluate('CodaArcadeQA.progression()')
        self.assertTrue({'shutter','rollerskates','boombox'}.issubset(set(progress['unlockedCosmetics'])))
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().spent'), before['notes']['spent'])
        self.assertEqual(self.page.evaluate('localStorage.getItem("musicArcadeV1")'), before['avatar'])

        self.page.clock.resume()
        self.load()
        self.page.clock.pause_at(self.page.evaluate('Date.now()/1000')+1)
        self.assertEqual(self.journal(), saved)
        open_destination(self.page, 'dj')
        for song in ['first-steps','midnight-headliner']:
            self.assertFalse(self.page.locator('[data-jukebox-track="'+song+'"]').is_disabled())
        open_destination(self.page, 'boutique')
        for field, item in [('eyewear','shutter'),('shoes','rollerskates'),('accessory','boombox')]:
            self.assertFalse(self.page.locator('#boutique-'+field+' option[value="'+item+'"]').is_disabled())
        self.assertTrue(self.page.evaluate('CodaClassroomProfileData.capture(localStorage).ok'))

    def test_exiting_mid_dance_and_replaying_uses_fresh_runs_without_partial_rewards(self):
        before = self.journal()
        first = self.start('easy')
        self.play_note(first['engine']['notes'][0], first['engine'])
        self.page.keyboard.press('Escape')
        self.assertEqual(self.journal(), before)
        second = self.start('easy')
        self.assertNotEqual(first['runId'], second['runId'])
        self.page.keyboard.press('Escape')
        self.assertEqual(self.journal(), before)

    def test_leaving_every_arrow_unplayed_does_not_earn_a_completion_or_unlock(self):
        before = self.journal()
        game = self.start('hard')
        self.finish(game['engine'])
        self.assertEqual(self.state()['engine']['hits'], 0)
        self.assertEqual(self.journal(), before)
        self.assertEqual(self.page.locator('.dance-rhythm-rewards').count(), 0)
        self.assertFalse(any(item['earned'] for item in self.page.evaluate('CodaArcadeQA.achievements().items.filter(item=>item.category==="dance")')))


if __name__ == '__main__':
    unittest.main(verbosity=2)
