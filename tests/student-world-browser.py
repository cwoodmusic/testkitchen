"""Student lessons, profile, and reward turn-ins in the assembled arcade world."""
import importlib.util
from pathlib import Path
import sys
import unittest
from world_navigation_helpers import enter_room,open_cabinet

sys.dont_write_bytecode=True
from classroom_quiz_helpers import answer_quiz
_spec=importlib.util.spec_from_file_location('learning_world_browser',Path(__file__).with_name('learning-world-browser.py'))
_world=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_world)

class StudentWorldTests(_world.WorldBrowserCase):
    def notifications(self):return self.page.evaluate('CodaArcadeQA.rewardNotifications()')

    def reveal_notification(self,kind):
        for _ in range(12):
            state=self.notifications();current=state['current']
            if current and current['kind']==kind:return current
            if not current:break
            self.page.get_by_role('button',name='Dismiss notification',exact=True).click()
        self.fail('Expected '+kind+' notification: '+str(self.notifications()))

    def open_remote_bach_mission(self):
        # Mission details remain in Profile; viewing them never moves the player.
        if self.page.locator('#panel').is_visible():self.page.locator('#panelClose').click()
        if self.page.locator('#dialog').is_visible():self.page.locator('#close').click()
        before=self.page.evaluate('CodaArcadeQA.position()')
        self.page.locator('#levelBtn').click()
        self.page.locator('[data-mission-id="bach-triad-win"]').get_by_role('button',name='Open Counterpoint Champion mission',exact=True).click()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.position()'),before)

    def test_live_mission_popup_profile_return_and_saved_one_time_collection(self):
        self.open_bach_mission();self.leave_musician('bach')
        self.page.get_by_role('button',name='Accept mission',exact=True).click()
        self.page.get_by_role('button',name='Play Music Triad',exact=True).click()
        self.assertFalse(self.page.evaluate('CodaArcadeQA.menu().gameOpen'),'The mission points to a cabinet instead of starting it remotely')
        open_cabinet(self.page,1)
        self.page.frame_locator('#gameiframe').locator('#finishMatch').click()
        self.page.wait_for_function("CodaArcadeQA.missions().missions.find(m=>m.person==='bach').status==='complete'")
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),166)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),162,'Only the match and its achievements pay before turn-in')
        notice=self.reveal_notification('mission-complete')
        self.assertIn('J. S. Bach',notice['message']);self.assertIn('90 Notes',notice['message'])
        self.page.wait_for_function("(()=>{const toast=document.querySelector('.reward-toast');return toast&&getComputedStyle(toast).opacity==='1'&&toast.getBoundingClientRect().bottom<=innerHeight;})()")
        rectangle=self.page.locator('.reward-toast').bounding_box()
        self.assertGreater(rectangle['y'],self.page.viewport_size['height']*.55)
        self.assertLessEqual(rectangle['y']+rectangle['height'],self.page.viewport_size['height'])
        self.assertEqual(self.page.locator('.reward-toast').get_attribute('role'),'status')
        self.page.get_by_role('button',name='View mission',exact=True).click()
        self.assertFalse(self.page.evaluate('CodaArcadeQA.menu().gameOpen'),'The popup returns from the cabinet before showing the mission')
        self.assertTrue(self.page.get_by_role('button',name='Collect reward',exact=True).is_disabled())
        self.page.locator('#panelClose').click();self.page.locator('#levelBtn').click()
        card=self.page.locator('[data-mission-id="bach-triad-win"]')
        self.assertIn('Return to J. S. Bach',card.inner_text())
        card.get_by_role('button',name='Open Counterpoint Champion mission',exact=True).click()
        self.assertTrue(self.page.get_by_role('button',name='Collect reward',exact=True).is_disabled())
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),166)
        self.load()
        self.assertIsNone(self.notifications()['current'],'A saved completed mission does not repeat its completion popup')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),166)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),162)
        self.open_bach_mission();self.leave_musician('bach');self.open_remote_bach_mission()
        self.assertTrue(self.page.get_by_role('button',name='Collect reward',exact=True).is_disabled())
        self.approach_musician('mozart');self.open_remote_bach_mission()
        self.assertTrue(self.page.get_by_role('button',name='Collect reward',exact=True).is_disabled(),'The wrong quest giver cannot pay Bach\'s mission')
        self.approach_musician('bach');self.open_bach_mission()
        self.page.get_by_role('button',name='Collect reward',exact=True).click()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),256)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),262)
        self.assertIn('Collected 90 Notes',self.reveal_notification('mission-reward')['message'])
        self.assertIn('Notes collected',self.page.locator('.musician-mission').inner_text())
        self.open_bach_mission();self.assertEqual(self.page.get_by_role('button',name='Collect reward',exact=True).count(),0)
        self.load();self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),256)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),262)
        self.assertIsNone(self.notifications()['current'])
        self.page.locator('#levelBtn').click();self.assertEqual(self.page.locator('.profile-completed summary').inner_text(),'1 finished mission')

    def test_note_lesson_teaches_without_octave_numbers_and_updates_the_saved_profile(self):
        enter_room(self.page,'classroom');self.page.locator('[data-start-lesson="note-naming"]').click()
        self.assertEqual(self.page.locator('.lesson-key-name:visible').count(),0)
        self.page.get_by_label('Show note letters',exact=True).check()
        self.assertEqual(self.page.locator('.lesson-key-name:visible').count(),8)
        self.assertNotRegex(self.page.locator('#classroomBook').inner_text(),r'\b[A-G][0-8]\b')
        self.page.locator('[data-note-answer="F"]').first.click()
        self.assertTrue(self.page.locator('[data-tutorial-next]').is_disabled())
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),0)
        for letter in ['C','F','D','A','E','F','G','A','B','C']:
            self.page.locator('[data-note-answer="'+letter+'"]').first.click()
            self.page.locator('[data-tutorial-next]').click()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.tutorials().active.phase'),'quiz')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),0)
        answer_quiz(self.page,'note-naming')
        self.assertIn('note-naming',self.page.evaluate('CodaArcadeQA.tutorials().completed'))
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),50)
        self.assertIn('note names',self.reveal_notification('achievement')['title'])
        self.page.keyboard.press('Escape');self.page.locator('#levelBtn').click()
        self.assertEqual(self.page.locator('.profile-level').inner_text(),'Level 1')
        self.assertEqual(self.page.locator('.profile-xp-to-go').inner_text(),'30 XP to go!')
        self.assertEqual(self.page.locator('.profile-prize strong').all_inner_texts(),['Pocket watch chain','Crystal Harp'])
        self.assertIn('Note naming · Finished',self.page.locator('.profile-lessons').inner_text())
        self.assertEqual(self.page.evaluate('CodaArcadeQA.profile().notes'),150,'Learning rewards XP without silently changing the Notes balance')
        self.page.set_viewport_size({'width':390,'height':844})
        self.assertLessEqual(self.page.locator('.player-profile').evaluate('(element)=>element.scrollWidth'),390)
        self.page.screenshot(path='/tmp/coda-student-profile-world-29.png')
        self.page.set_viewport_size({'width':1550,'height':1050});self.load()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),50);self.assertIsNone(self.notifications()['current'])
        enter_room(self.page,'classroom');self.page.locator('[data-start-lesson="note-naming"]').click()
        self.assertTrue(self.page.evaluate('CodaArcadeQA.tutorials().active.complete'))
        self.page.locator('[data-tutorial-replay]').click()
        for letter in ['C','F','D','A','E','F','G','A','B','C']:
            self.page.locator('[data-note-answer="'+letter+'"]').first.click();self.page.locator('[data-tutorial-next]').click()
        answer_quiz(self.page,'note-naming')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),50,'Replaying the lesson cannot farm its achievement')
        self.assertIsNone(self.notifications()['current'])

    def test_rhythm_tree_practice_rewards_only_a_correct_finished_lesson(self):
        enter_room(self.page,'classroom');self.page.locator('[data-start-lesson="rhythm-tree"]').click()
        for _ in range(4):self.page.locator('[data-tree-split]').click()
        self.assertIn('16 sixteenth notes',self.page.locator('.lesson-tree-caption').inner_text())
        self.assertIn('four beats',self.page.locator('.lesson-tree-caption').inner_text())
        self.page.locator('[data-tutorial-next]').click()
        self.page.locator('[data-rhythm-answer="2"]').click();self.page.locator('[data-tutorial-next]').click()
        self.page.locator('[data-rhythm-answer="2"]').click();self.page.locator('[data-tutorial-next]').click()
        self.page.get_by_text('Other note lengths (optional)',exact=True).click();self.page.locator('[data-add-value="16"]').click();self.page.locator('[data-check-rhythm]').click()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),0)
        self.page.get_by_role('button',name='Clear bar',exact=True).click()
        for units in [4,2,2,8]:self.page.locator('[data-add-value="'+str(units)+'"]').click()
        self.page.get_by_role('button',name='Listen and clap along',exact=True).click()
        self.assertTrue(self.page.evaluate('CodaArcadeQA.tutorials().active.audioPlaying'))
        self.page.locator('[data-check-rhythm]').click()
        self.assertFalse(self.page.evaluate('CodaArcadeQA.tutorials().active.audioPlaying'))
        self.assertEqual(self.page.evaluate('CodaArcadeQA.tutorials().active.phase'),'quiz')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),0)
        answer_quiz(self.page,'rhythm-tree')
        self.assertIn('rhythm-tree',self.page.evaluate('CodaArcadeQA.tutorials().completed'))
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),50)
        self.assertIn('rhythm tree',self.reveal_notification('achievement')['title'])
        self.page.keyboard.press('Escape');self.page.locator('#levelBtn').click()
        self.assertIn('The rhythm tree · Finished',self.page.locator('.profile-lessons').inner_text())

if __name__=='__main__':unittest.main(verbosity=2)
