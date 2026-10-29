"""Music history discovery through real conversations, with locked journal entries."""
import importlib.util
from pathlib import Path
import unittest
from world_navigation_helpers import talk_to_musician, open_settings, open_destination, enter_room
spec=importlib.util.spec_from_file_location('history_world',Path(__file__).with_name('learning-world-browser.py'))
world=importlib.util.module_from_spec(spec);spec.loader.exec_module(world)

class MusicHistoryBrowserTests(world.WorldBrowserCase):
    def journal(self):
        open_settings(self.page)
        self.page.locator('#worldMusicHistory').click()
        self.page.locator('.music-history[open]').wait_for()

    def close_history(self):
        self.page.locator('.music-history').get_by_role('button',name='Close',exact=True).click()

    def test_journal_starts_locked_and_search_never_exposes_undiscovered_text(self):
        self.journal()
        journal=self.page.locator('.music-history')
        self.assertIn('0 / 540',journal.inner_text())
        self.assertEqual(journal.locator('.history-fact.locked').count(),540)
        self.assertNotIn('born in Eisenach',journal.text_content())
        journal.get_by_label('Search discovered facts').fill('Eisenach')
        self.assertEqual(journal.locator('.history-fact').count(),0)
        self.assertIn('No discovered facts match',journal.inner_text())
        journal.get_by_label('Search discovered facts').fill('')
        journal.get_by_label('Journal musician').select_option('bach')
        self.assertEqual(journal.locator('.history-fact.locked').count(),30)
        self.page.keyboard.press('Escape')
        self.assertFalse(journal.is_visible())
        self.assertEqual(self.page.evaluate('document.activeElement.id'),'view')

    def test_real_conversation_unlocks_once_per_fact_and_reload_preserves_journal(self):
        talk_to_musician(self.page,'bach')
        self.page.locator('.musician-choices').get_by_role('button',name='Tell me some music history').click()
        journal=self.page.locator('.music-history')
        self.assertIn('born in Eisenach',journal.inner_text())
        self.assertEqual(journal.locator('[data-discovered-fact]').get_attribute('data-discovered-fact'),'bach-01')
        journal.get_by_role('button',name='Tell me another fact').click()
        self.assertEqual(journal.locator('[data-discovered-fact]').get_attribute('data-discovered-fact'),'bach-02')
        journal.get_by_role('button',name='Open Music History Journal').click()
        self.assertEqual(journal.locator('.history-fact:not(.locked)').count(),2)
        self.assertEqual(journal.locator('.history-fact.locked').count(),28)
        self.assertNotIn('In 1723',journal.text_content())
        self.close_history();self.page.reload();self.page.wait_for_function('window.CodaDeveloperConsole?.ready()')
        self.journal();journal.get_by_label('Journal musician').select_option('bach')
        self.assertEqual(journal.locator('.history-fact:not(.locked)').count(),2)

    def test_dj_and_mobile_journal_keep_locks_readable(self):
        open_destination(self.page,'dj')
        self.page.locator('#panel').get_by_role('button',name='Tell me some music history').click()
        journal=self.page.locator('.music-history')
        self.assertIn('fictional arcade host',journal.inner_text())
        journal.get_by_role('button',name='Open Music History Journal').click()
        self.page.set_viewport_size({'width':390,'height':844})
        self.assertEqual(journal.locator('.history-fact.locked').count(),29)
        dimensions=journal.evaluate('(el)=>({width:el.clientWidth,scroll:el.scrollWidth,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right})')
        self.assertLessEqual(dimensions['scroll'],dimensions['width']+1)
        self.assertGreaterEqual(dimensions['left'],0)
        self.assertLessEqual(dimensions['right'],390)
        self.page.screenshot(path='/tmp/testkitchen-history-journal-phone.png')

    def test_haydn_offers_history_in_the_classroom(self):
        enter_room(self.page,'classroom')
        canvas=self.page.locator('#classroomCanvas');canvas.focus();self.page.keyboard.down('w');self.page.wait_for_timeout(900);self.page.keyboard.up('w');self.page.keyboard.press('e')
        self.page.locator('#haydnHistory').click()
        self.assertIn('born in Rohrau',self.page.locator('.music-history').inner_text())
        self.page.keyboard.press('Escape')
        self.assertTrue(self.page.locator('#classroomStart').is_visible())

    def test_chopin_offers_history_without_leaving_his_dialogue(self):
        enter_room(self.page,'piano')
        self.page.clock.install();self.page.clock.run_for(64)
        self.page.wait_for_function('CodaArcadeQA.piano().background.ready')
        self.page.locator('#pianoRoomCanvas').focus()
        for axis,target,negative,positive in [('x',780,'a','d'),('y',306,'w','s')]:
            for _ in range(25):
                distance=target-self.page.evaluate('CodaArcadeQA.piano().player')[axis]
                if abs(distance)<3:break
                key=positive if distance>0 else negative
                self.page.keyboard.down(key);self.page.clock.run_for(max(16,min(300,round(abs(distance)/220*1000))));self.page.keyboard.up(key)
        self.page.keyboard.press('e')
        self.page.locator('[data-piano-dialogue-action="history"]').click()
        self.assertIn('Żelazowa Wola',self.page.locator('.music-history').inner_text())
        self.page.keyboard.press('Escape')
        self.assertTrue(self.page.locator('#pianoDialogueBackdrop').is_visible())

    def test_unlockable_visitor_has_history_and_test_mode_does_not_save_it_to_guest(self):
        self.page.goto(world.WORLD+'?dev-test=1',wait_until='domcontentloaded')
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready()&&window.CodaArcadeQA?.notes()')
        self.page.clock.install();self.page.clock.run_for(64)
        talk_to_musician(self.page,'vee-jay')
        self.page.locator('.musician-choices').get_by_role('button',name='Tell me some music history').click()
        self.assertIn('fictional arcade visitor',self.page.locator('.music-history').inner_text())
        self.assertEqual(self.page.evaluate('JSON.parse(localStorage.getItem("codaMusicHistoryV1")).discovered'),['vee-jay-01'])
        self.close_history()
        self.page.goto(world.WORLD,wait_until='domcontentloaded')
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready()&&window.CodaArcadeQA?.notes()')
        self.journal()
        self.assertIn('0 / 540',self.page.locator('.music-history').inner_text())

if __name__=='__main__':unittest.main(verbosity=2)
