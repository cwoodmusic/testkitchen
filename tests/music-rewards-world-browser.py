"""Music trivia and real level gains in the assembled connected world.

The public arcade origin serves the checkout through the shared browser
fixture. Cabinet results are authenticated fixtures; Song Machine XP comes
from actual composition edits and playback in its same-origin iframe.
"""
import importlib.util
from pathlib import Path
from world_navigation_helpers import advance_world, enter_room, open_destination, talk_to_musician, open_settings, close_settings, open_cabinet
import sys
import unittest

sys.dont_write_bytecode=True
_spec=importlib.util.spec_from_file_location('learning_world_browser',Path(__file__).with_name('learning-world-browser.py'))
_world=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_world)


class MusicRewardsWorldTests(_world.WorldBrowserCase):
    def notices(self):
        return self.page.evaluate('CodaArcadeQA.rewardNotifications()')

    def show_notice(self,kind):
        for _ in range(15):
            state=self.notices();current=state['current']
            if current and current['kind']==kind:return current
            if not current:break
            self.page.get_by_role('button',name='Dismiss notification',exact=True).click()
        self.fail('Expected '+kind+' notification: '+str(self.notices()))

    def open_cabinet(self,index):
        game=self.page.evaluate('''index=>CodaArcadeQA.worldObjects()
          .find(object=>object.game?.index===index).game''',index)
        self.place(game['npcX'],game['npcY']);self.page.keyboard.press('e')
        self.page.wait_for_function('CodaArcadeQA.menu().gameOpen')

    def open_music_question(self,person):
        talk_to_musician(self.page,person)
        self.page.get_by_role('button',name='Ask me a music question · Earn Notes',exact=True).click()
        self.page.locator('.musician-trivia').wait_for()
        return self.page.evaluate('CodaArcadeQA.trivia()')

    def answer_question(self,index=None):
        state=self.page.evaluate('CodaArcadeQA.trivia()')
        if index is None:index=state['question']['answer']
        self.page.locator('[data-trivia-answer="'+str(index)+'"]').click()
        return self.page.evaluate('CodaArcadeQA.trivia()')

    def test_composer_questions_teach_wrong_answers_and_save_notes_without_repeat_farming(self):
        state=self.open_music_question('bach')
        question=state['question'];wrong=(question['answer']+1)%len(question['choices'])
        self.answer_question(wrong)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),150)
        self.assertIn(question['hint'],self.page.locator('.trivia-feedback').inner_text())
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),0)
        state=self.answer_question()
        self.assertEqual(state['status'],'correct');self.assertEqual(state['amount'],4)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),154)
        self.assertIn(question['explanation'],self.page.locator('.trivia-feedback').inner_text())
        self.assertIn('music-trivia:'+question['id'],self.page.evaluate('CodaArcadeQA.notes().rewards'))
        self.assertTrue(all(self.page.locator('[data-trivia-answer="'+str(index)+'"]').is_disabled() for index in range(3)))
        for _ in range(4):
            self.page.locator('[data-trivia-next]').click();self.answer_question()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),170)
        self.assertIn('all 5 question rewards',self.page.locator('.trivia-complete').inner_text())
        self.page.locator('[data-trivia-next]').click()
        self.assertTrue(self.page.evaluate('CodaArcadeQA.trivia().practice'))
        self.answer_question()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),170)
        self.assertIn('already earned',self.page.locator('.trivia-reward').inner_text())
        self.load();self.open_music_question('bach');self.answer_question()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),170)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),0)

    def test_phone_trivia_explains_steady_beat_versus_rhythm_and_has_large_answers(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.open_music_question('joplin')
        self.page.wait_for_function('!CodaArcadeQA.touch().visible')
        for _ in range(2):self.answer_question();self.page.locator('[data-trivia-next]').click()
        state=self.page.evaluate('CodaArcadeQA.trivia()')
        self.assertEqual(state['question']['id'],'joplin-beat-v-rhythm')
        self.answer_question((state['question']['answer']+1)%3)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),158)
        self.answer_question()
        self.assertIn('foot keeps the steady beat',self.page.locator('.trivia-feedback').inner_text())
        self.assertIn('hands clap the rhythm',self.page.locator('.trivia-feedback').inner_text())
        for viewport in [{'width':390,'height':844},{'width':844,'height':390}]:
            self.page.set_viewport_size(viewport)
            metric=self.page.locator('.musician-trivia').evaluate('''element=>({width:element.scrollWidth,
              viewport:innerWidth,buttons:[...element.querySelectorAll('button')].map(button=>({
                width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height}))})''')
            self.assertLessEqual(metric['width'],metric['viewport'])
            self.assertTrue(all(button['width']>=44 and button['height']>=44 for button in metric['buttons']),metric)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),162)

    def test_a_game_level_up_names_real_prizes_and_opens_the_profile(self):
        self.open_bach_mission();self.page.get_by_role('button',name='Accept mission',exact=True).click()
        self.page.get_by_role('button',name='Play Music Triad',exact=True).click()
        self.assertFalse(self.page.evaluate('CodaArcadeQA.menu().gameOpen'),'The mission points to the physical cabinet')
        open_cabinet(self.page,1)
        self.page.frame_locator('#gameiframe').locator('#finishMatch').click()
        self.page.wait_for_function('CodaArcadeQA.progression().level===2')
        notice=self.show_notice('level')
        self.assertIn('2',notice['title'])
        self.assertIn('Pocket watch chain',notice['message'])
        self.assertIn('Crystal Harp',notice['message'])
        self.assertIn('Song Machine',notice['message'])
        self.assertEqual(self.page.locator('.reward-toast-eyebrow').inner_text(),'LEVEL UP')
        self.page.get_by_role('button',name='View my profile',exact=True).click()
        self.assertFalse(self.page.evaluate('CodaArcadeQA.menu().gameOpen'))
        self.assertEqual(self.page.locator('.profile-level').inner_text(),'Level 2')
        self.assertEqual(self.page.locator('.profile-prize strong').all_inner_texts(),['Artist beret','Neon Marimba','4 new quests at Level 3'])
        saved=self.page.evaluate('CodaArcadeQA.progression().xp')
        self.load()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),saved)
        self.assertIsNone(self.notices()['current'],'Restoring a saved level must not replay its celebration')

    def test_song_machine_composition_xp_announces_a_level_in_the_parent_world(self):
        self.page.evaluate("CodaPlayerProgression.create().awardXP('integration:starting-practice',50,'Earlier practice')")
        self.load()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),50)
        self.assertIsNone(self.notices()['current'])
        self.open_cabinet(3)
        composer=self.page.frame_locator('#gameiframe')
        composer.locator('#simpleSongGrid .cell[data-track="1"][data-pitch="72"][data-step="16"]').click()
        composer.locator('#simpleSongGrid .cell[data-track="1"][data-pitch="74"][data-step="20"]').click()
        composer.locator('#simplePlay').click()
        self.page.wait_for_function('CodaArcadeQA.progression().xp===85')
        notice=self.show_notice('level')
        self.assertIn('2',notice['title']);self.assertIn('Crystal Harp',notice['message'])
        self.page.get_by_role('button',name='Dismiss notification',exact=True).click()
        composer.locator('#simpleStop').click();composer.locator('#simplePlay').click()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),85)
        self.assertIsNone(self.notices()['current'],'Playing the unchanged composition must not repeat its level popup')
        composer.locator('#simpleStop').click();self.page.locator('#returnworld').click()
        self.load();self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().level'),2)
        self.assertIsNone(self.notices()['current'])


if __name__=='__main__':unittest.main(verbosity=2)
