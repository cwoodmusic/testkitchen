"""Resume real cloud profiles whose earned outfits must not rewrite ownership.

Uses the production world, classroom Boot/service, wallet, Firebase SDK and
disposable loopback emulators. No deployed profiles or authentication are used.
"""
import importlib.util
from pathlib import Path
import unittest

_spec=importlib.util.spec_from_file_location('profile_loop_world',Path(__file__).with_name('classroom-world-browser.py'))
_world=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_world)


class ProfileOpenLoopTests(_world.ClassroomWorldBrowserTests):
    def assert_stable_open(self,page,card,expected_wallet):
        self.open_card_ui(page)
        page.locator('#classpassJoinInput').fill(card['pass'])
        with page.expect_navigation(wait_until='load'):
            page.locator('#classpassJoin').click()
        page.wait_for_timeout(4500)
        self.assertEqual(len(self.world_navigations),2,
            'A profile join must cause one identity reload, then remain in the arcade')
        self.ready(page,card)
        self.assertFalse(page.evaluate('CodaClassroomBoot.getState().preparing'))
        self.assertTrue(page.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        self.assertEqual(page.evaluate('CodaArcadeQA.classroomSession().alias'),card['alias'])
        self.assertEqual(page.evaluate('CodaClassroomProfileData.capture(localStorage).data.wallet'),expected_wallet,
            'Restoring earned equipment must not alter ownership or the currency journal')
        self.assertTrue(page.locator('#classroom-session-notice').is_hidden())
        self.assertEqual(self.failed_assets,[])
        navigations=len(self.world_navigations)
        page.reload(wait_until='load');self.ready(page,card)
        page.wait_for_timeout(2000)
        self.assertEqual(len(self.world_navigations),navigations+1,
            'An ordinary profile reload must not restart identity restoration')
        self.assertTrue(page.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        self.assertEqual(page.evaluate('CodaClassroomProfileData.capture(localStorage).data.wallet'),expected_wallet)

    def test_level_earned_cape_and_non_shop_ownership_resume_without_a_gate_loop(self):
        path='classroomV1/classes/'+self.class_id+'/profiles/'+self.card['profileId']+'/state'
        saved=self.cloud()['state']
        saved['data']['progression']={'version':1,'xp':720,'bestPitchLevel':0,
            'events':[{'id':'game:profile-loop-fixture','xp':720}]}
        saved['data']['avatar']['accessory']='cape'
        saved['data']['wallet']['owned']=['halo','cap','short']
        # Firebase omits empty lists from its JSON snapshots.
        saved['data']['wallet'].setdefault('rewards',[])
        _world.fixture.database(path,saved,'PUT')
        page=self.world()
        self.assert_stable_open(page,self.card,saved['data']['wallet'])
        self.assertEqual(page.evaluate('CodaClassroomProfileData.capture(localStorage).data.avatar.accessory'),'cape')
        self.assertFalse(page.evaluate('CodaArcadeQA.notes().owned.includes("cape")'),
            'An earned outfit is usable without inventing a shop purchase')


if __name__=='__main__':
    unittest.main(defaultTest='ProfileOpenLoopTests.test_level_earned_cape_and_non_shop_ownership_resume_without_a_gate_loop',verbosity=2)
