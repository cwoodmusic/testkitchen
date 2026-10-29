"""Practice uses the real fishing room without changing catch progress or rewards."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode=True
_spec=importlib.util.spec_from_file_location('fishing_practice_upgrade',Path(__file__).with_name('fishing-upgrade-browser.py'))
_upgrade=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_upgrade)


class FishingPracticeWorldTests(_upgrade._fish._world.WorldBrowserCase):
    state=_upgrade.FishingUpgradeTests.state
    portal=_upgrade.FishingUpgradeTests.portal
    place=_upgrade.FishingUpgradeTests.place
    enter=_upgrade.FishingUpgradeTests.enter
    walk_to=_upgrade.FishingUpgradeTests.walk_to
    board=_upgrade.FishingUpgradeTests.board
    fishing_action=_upgrade._fish.FishingWorldTests.fishing_action
    fishing_option=_upgrade._fish.FishingWorldTests.fishing_option
    fishing_meter=_upgrade._fish.FishingWorldTests.fishing_meter
    place_single_fish=_upgrade.FishingUpgradeTests.place_single_fish
    advance_to=_upgrade.FishingUpgradeTests.advance_to

    def setUp(self):
        _upgrade._fish.FishingWorldTests.setUp(self)
        self.page.clock.pause_at(self.page.evaluate('Date.now()/1000')+5)
        self.page.wait_for_function('!!window.createCodaFishingPractice')

    def start_exploring(self,meter='4/4'):
        self.enter();self.fishing_meter(meter);self.board()
        self.assertEqual(self.state()['phase'],'explore')

    def rewards(self):
        return self.page.evaluate('''()=>({notes:CodaArcadeQA.notes().balance,
          xp:CodaArcadeQA.progression().xp,catches:CodaArcadeQA.fishing().catches,
          achievements:CodaArcadeQA.fishingAchievements().filter(item=>item.earned).map(item=>item.id)})''')

    def fish_slots(self):
        return [(fish['id'],fish['fishId'],fish['visible'],fish['escaped']) for fish in self.state()['shadows']]

    def choose_practice(self,meter='4/4',rarity='common'):
        self.fishing_action('#fishingPractice')
        self.assertTrue(self.state()['practiceSettingsOpen'])
        self.page.locator('input[name="fishingPracticeMeter"][value="'+meter+'"]').check(force=True)
        self.page.locator('input[name="fishingPracticeRarity"][value="'+rarity+'"]').check(force=True)
        self.page.locator('#fishingPracticeStart').click(force=True)
        self.page.clock.run_for(32)
        state=self.state()
        self.assertTrue(state['practice']);self.assertFalse(state['practiceSettingsOpen'])
        self.assertTrue(state['challenge']['practice'])
        self.assertEqual(state['challenge']['meter'],meter)
        self.assertEqual(state['challenge']['fish']['rarity'],rarity)
        self.assertEqual(self.page.locator('#fishingCancel').inner_text(),'End practice')
        return state

    def play_pending_note(self):
        state=self.state()
        note=next(note for note in state['challenge']['notes'] if note['judgement']=='pending'
            and note['time']+note.get('lateWindow',note['window'])>=state['clock'])
        self.advance_to(note['time']);self.page.locator('#fishingRhythmCanvas').focus()
        self.page.keyboard.down('Space')
        if note['requiresHold']:self.advance_to(note['holdEndTime'])
        self.page.keyboard.up('Space');self.page.clock.run_for(1)
        return self.state()

    def end_practice(self,phase,meter):
        self.page.locator('#fishingCancel').click(force=True);self.page.clock.run_for(32)
        state=self.state()
        self.assertFalse(state['practice']);self.assertIsNone(state['challenge'])
        self.assertEqual(state['phase'],phase);self.assertEqual(state['meter'],meter)
        self.assertEqual(state['mobileView'],'room')
        return state

    def test_meter_and_difficulty_choices_start_real_practice_and_restore_shore(self):
        self.enter();before=self.rewards();slots=self.fish_slots()
        for meter,rarity in [('4/4','common'),('6/8','uncommon'),('2/2','rare'),('4/4','epic'),('6/8','legendary')]:
            self.choose_practice(meter,rarity)
            self.end_practice('shore','4/4')
            self.assertEqual(self.rewards(),before)
            self.assertEqual(self.fish_slots(),slots,'Practice must not hook, replace, or hide a wild fish')

    def test_practice_keeps_playing_at_zero_and_full_progress_without_rewards_then_normal_cast_works(self):
        self.start_exploring('2/2');before=self.rewards();slots=self.fish_slots()
        self.choose_practice('4/4','common')
        self.page.clock.run_for(35000)
        zero=self.state();self.assertEqual(zero['challenge']['progress'],0)
        self.assertEqual(zero['phase'],'rhythm');self.assertIsNone(zero['challenge']['result'])
        self.assertGreater(zero['challenge']['misses'],10)
        self.assertTrue(any(note['bar']>=8 for note in zero['challenge']['notes']))
        # Progress is earned per written bar, not per tap. Recovery from
        # zero needs more than the old fixed35-note budget after longer battles.
        recovery_bar_limit=zero['challenge']['completedBars']+zero['challenge']['targetBars']*2+2
        for _ in range(128):
            state=self.state()
            if state['challenge']['progress']==100:break
            self.assertLess(state['challenge']['completedBars'],recovery_bar_limit,
                            'Correct practice input must recover within the written-bar budget')
            self.play_pending_note()
        full=self.state();self.assertEqual(full['challenge']['progress'],100)
        hits=full['challenge']['hits']
        for _ in range(5):self.play_pending_note()
        ongoing=self.state()
        self.assertEqual(ongoing['phase'],'rhythm');self.assertTrue(ongoing['practice'])
        self.assertIsNone(ongoing['challenge']['result']);self.assertGreater(ongoing['challenge']['hits'],hits)
        self.assertEqual(self.rewards(),before);self.assertEqual(self.fish_slots(),slots)
        self.end_practice('explore','2/2')
        self.assertEqual(self.rewards(),before);self.assertEqual(self.fish_slots(),slots)
        self.place_single_fish('silver-minnow');self.fishing_action('#fishingCast')
        self.page.clock.run_for(1400)
        normal=self.state();self.assertFalse(normal['practice']);self.assertFalse(normal['challenge']['practice'])
        self.assertEqual(normal['phase'],'rhythm');self.assertEqual(normal['meter'],'2/2')
        self.assertEqual(self.page.locator('#fishingCancel').inner_text(),'Let it go')
        initial=normal['challenge']['progress'];self.play_pending_note()
        self.assertGreater(self.state()['challenge']['progress'],initial)

    def test_phone_practice_picker_and_end_action_remain_usable_phone(self):
        self.enter();self.page.clock.run_for(500)  # Let the cave drop-in scale settle.
        before=self.rewards()
        for size in [{'width':390,'height':844},{'width':844,'height':390}]:
            self.page.set_viewport_size(size);self.page.clock.run_for(32)
            self.fishing_action('#fishingPractice')
            panel=self.page.locator('#fishingPracticePanel');box=panel.bounding_box()
            self.assertGreaterEqual(box['x'],0);self.assertGreaterEqual(box['y'],0)
            self.assertLessEqual(box['x']+box['width'],size['width']+1)
            self.assertLessEqual(box['y']+box['height'],size['height']+1)
            self.page.locator('#fishingPracticeStart').tap();self.page.clock.run_for(32)
            self.assertTrue(self.state()['challenge']['practice'])
            button=self.page.locator('#fishingCancel').bounding_box()
            self.assertGreaterEqual(button['height'],44)
            self.page.locator('#fishingCancel').tap();self.page.clock.run_for(32)
            self.assertEqual(self.state()['phase'],'shore');self.assertFalse(self.state()['practice'])
            self.assertEqual(self.rewards(),before)


if __name__=='__main__':unittest.main(verbosity=2)
