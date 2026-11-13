"""The existing cave boating flow catches fish into the cave/coast journal."""
import importlib.util
import json
import math
from pathlib import Path
import unittest

_spec = importlib.util.spec_from_file_location('cave_coast_fixture', Path(__file__).with_name('fishing-biomes-browser.py'))
_fixture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_fixture)

class CaveCoastJournalTests(_fixture._fish._world.WorldBrowserCase):
    setUp = _fixture.FishingBiomeWorldTests.setUp
    state = _fixture.FishingBiomeWorldTests.state
    portal = _fixture.FishingBiomeWorldTests.portal
    place = _fixture.FishingBiomeWorldTests.place
    enter = _fixture.FishingBiomeWorldTests.enter
    walk_to = _fixture.FishingBiomeWorldTests.walk_to
    board = _fixture.FishingBiomeWorldTests.board
    fishing_option = _fixture.FishingBiomeWorldTests.fishing_option
    fishing_action = _fixture.FishingBiomeWorldTests.fishing_action
    approach_shadow = _fixture.FishingBiomeWorldTests.approach_shadow

    def advance_to(self, target):
        current = self.state()['clock']
        if target > current:
            self.page.clock.run_for(max(1, math.floor((target-current)*1000)))
        for _ in range(30):
            if self.state()['clock'] >= target-.000001:
                return
            self.page.clock.run_for(1)
        self.fail('The cave clock must reach the written note')

    def test_cave_catch_preserves_coastal_catches_and_rewards_once(self):
        old = {'id':'previous-coastal-catch', 'fishId':'copper-sprat', 'size':20, 'at':1,
               'rewarded':False, 'result':{'id':'previous-coastal-catch'}}
        self.page.evaluate('value=>localStorage.setItem("codaRhythmFishingV1",value)', json.dumps({'version':1,'catches':[old]}))
        self.enter()
        self.board()
        self.approach_shadow()
        balance = self.page.evaluate('CodaArcadeQA.notes().balance')
        self.fishing_action('#fishingCast')
        self.page.clock.run_for(1400)
        self.assertEqual(self.state()['phase'], 'rhythm')
        fish = self.state()['challenge']['fish']
        for _ in range(150):
            state = self.state()
            if state['phase'] != 'rhythm':
                break
            note = next((n for n in state['challenge']['notes'] if n['judgement']=='pending'), None)
            self.advance_to(note['time'] if note else state['clock']+.2)
            if self.state()['phase'] != 'rhythm':
                break
            if note:
                self.page.locator('#fishingRhythmCanvas').focus()
                self.page.keyboard.down('Space')
                if note['requiresHold']:
                    self.advance_to(note['holdEndTime'])
                self.page.keyboard.up('Space')
        caught = self.state()
        self.assertEqual(caught['phase'], 'caught')
        self.assertTrue(caught['result']['perfect'])
        self.assertEqual(caught['collection']['counts']['copper-sprat'], 1)
        self.assertEqual(caught['collection']['counts'][fish['id']], 1)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'), balance+fish['notes'])
        self.page.locator('#fishingResultCollection').click()
        self.assertEqual(self.page.locator('.fishing-fish-card').count(), 54)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'), balance+fish['notes'])
        self.page.reload()
        self.page.wait_for_function('!!window.CodaArcadeQA?.fishing()')
        self.assertEqual(self.state()['collection']['counts']['copper-sprat'], 1)
        self.assertEqual(self.state()['collection']['counts'][fish['id']], 1)

if __name__ == '__main__':
    unittest.main(verbosity=2)
