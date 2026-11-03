"""Gentler fishing is playable through the connected world and phone practice."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode=True
_spec=importlib.util.spec_from_file_location('difficulty_biome_fixture',Path(__file__).with_name('fishing-biomes-browser.py'))
_biomes=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_biomes)
_world=_biomes._fish
_base=_biomes.FishingBiomeWorldTests


class FishingDifficultyBrowserTests(_world._world.WorldBrowserCase):
    setUp=_base.setUp
    state=_base.state
    portal=_base.portal
    place=_base.place
    enter=_base.enter
    walk_to=_base.walk_to
    board=_base.board
    fishing_action=_base.fishing_action
    fishing_option=_base.fishing_option
    catch_with_actual_keys=_world.FishingWorldTests.catch_with_actual_keys

    def test_legendary_catch_uses_gentler_profile_and_pays_once_after_reload(self):
        self.enter();self.board()
        self.assertEqual(self.state()['biome']['id'],'cave')
        self.assertTrue(self.page.evaluate('''() => {
          const project=CodaArcadeQA.roomProject('fishing');project.entities={};
          for(let slot=0;slot<7;slot++)project.entities['fish-slot-'+slot]=slot===0
            ?{speciesId:'crescendo-coelacanth',x:350,y:410,visible:true}:{visible:false};
          return CodaArcadeQA.applyRoomProject('fishing',project);
        }'''))
        self.page.clock.run_for(32)
        self.assertFalse(self.page.locator('#fishingCast').is_disabled())
        self.fishing_action('#fishingCast');self.page.clock.run_for(1600)
        state=self.state();self.assertEqual(state['phase'],'rhythm')
        challenge=state['challenge']
        self.assertEqual(challenge['fish']['id'],'crescendo-coelacanth')
        self.assertEqual((challenge['tempo']['startQuarterBpm'],challenge['tempo']['endQuarterBpm']),(80,88))
        self.assertEqual(challenge['rarity']['window'],.20)
        self.assertEqual((challenge['rarity']['missLoss'],challenge['rarity']['extraLoss']),(3,2))
        self.page.locator('#fishingRhythmCanvas').focus()
        caught=self.catch_with_actual_keys()
        self.assertEqual(caught['phase'],'caught');self.assertTrue(caught['result']['perfect'])
        self.assertEqual(caught['result']['notes'],64)
        self.assertEqual(caught['collection']['total'],1)
        balance=self.page.evaluate('CodaArcadeQA.notes().balance')
        self.assertEqual(balance,214)
        self.page.clock.run_for(2000)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),balance)
        self.page.locator('#fishingClose').click(force=True)
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('CodaDeveloperConsole.ready()&&CodaArcadeQA.fishing()?.collection.total===1')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),balance)
        self.assertEqual(self.state()['catches'][0]['fishId'],'crescendo-coelacanth')

    def test_phone_practice_uses_the_same_gentler_legendary_profile_without_rewards_phone(self):
        self.enter()
        before=self.page.evaluate('''() => ({notes:CodaArcadeQA.notes().balance,
          xp:CodaArcadeQA.progression().xp,journal:localStorage.getItem('codaRhythmFishingV1')})''')
        for meter in ['4/4','6/8','2/2']:
            self.fishing_action('#fishingPractice')
            self.page.locator('input[name="fishingPracticeMeter"][value="'+meter+'"]').check(force=True)
            self.page.locator('#fishingPracticeNext').click(force=True)
            self.page.locator('input[name="fishingPracticeRarity"][value="legendary"]').check(force=True)
            self.page.locator('#fishingPracticeStart').click(force=True)
            self.page.clock.run_for(64)
            challenge=self.state()['challenge']
            self.assertTrue(challenge['practice']);self.assertEqual(challenge['meter'],meter)
            self.assertLessEqual(max(challenge['tempo']['startQuarterBpm'],challenge['tempo']['endQuarterBpm']),88)
            self.assertEqual(challenge['rarity']['missLoss'],3)
            self.assertEqual(challenge['rarity']['window'],.20)
            self.assertGreaterEqual(self.page.locator('#fishingTap').bounding_box()['height'],44)
            self.page.locator('#fishingCancel').click(force=True);self.page.clock.run_for(32)
            self.assertEqual(self.state()['phase'],'shore')
        self.assertEqual(self.page.evaluate('''() => ({notes:CodaArcadeQA.notes().balance,
          xp:CodaArcadeQA.progression().xp,journal:localStorage.getItem('codaRhythmFishingV1')})'''),before)


# Keep unittest discovery focused on this file's cases rather than the helper
# class imported above from the six-screen navigation fixture.
del _base

if __name__=='__main__':unittest.main(verbosity=2)
