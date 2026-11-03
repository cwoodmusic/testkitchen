"""Exercise dialogue timing, saved settings, room cleanup, and phone readability."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
from world_navigation_helpers import close_settings, enter_room, talk_to_musician

_spec = importlib.util.spec_from_file_location('dialogue_world', Path(__file__).with_name('learning-world-browser.py'))
_world = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_world)


class DialogueTextTests(_world.WorldBrowserCase):
    def revealing(self, selector):
        return self.page.evaluate('selector=>CodaDialogueText.isRevealing(document.querySelector(selector))', selector)

    def test_letter_reveal_preserves_layout_and_click_or_e_finishes_before_closing(self):
        self.page.evaluate("CodaDialogueText.setSpeed('slow')")
        talk_to_musician(self.page, 'bach')
        self.assertTrue(self.revealing('#words'))
        words = self.page.locator('#words')
        self.assertEqual(words.evaluate('el=>getComputedStyle(el).fontSize'), '20px')
        self.assertEqual(self.page.locator('#dialog').evaluate('el=>el.scrollTop'), 0)
        visible = lambda: words.evaluate("el=>[...el.children].filter(span=>getComputedStyle(span).opacity==='1').length")
        initial = visible()
        geometry = words.bounding_box()
        self.page.wait_for_timeout(200)
        self.assertGreater(visible(), initial)
        self.assertLess(visible(), words.locator('span').count())
        self.assertEqual(words.bounding_box(), geometry)
        words.click()
        self.assertFalse(self.revealing('#words'))
        self.assertTrue(self.page.locator('#dialog').is_visible())
        # Selecting a new reply replaces the finished line with a fresh reveal.
        self.page.locator('.musician-choices button').first.click()
        self.assertTrue(self.revealing('#words'))
        self.page.keyboard.press('e')
        self.assertFalse(self.revealing('#words'))
        self.assertTrue(self.page.locator('#dialog').is_visible())
        self.page.keyboard.press('e')
        self.assertTrue(self.page.locator('#dialog').is_hidden())

    def test_speed_saves_and_room_menus_share_the_preference(self):
        self.page.locator('#worldMenuBtn').click()
        self.page.locator('[data-settings-action="reading"]').click()
        self.page.locator('#worldMenu').get_by_label('Dialogue text speed').select_option('instant')
        close_settings(self.page)
        self.page.reload()
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready()')
        self.assertEqual(self.page.evaluate('CodaDialogueText.getSpeed()'), 'instant')
        enter_room(self.page, 'piano')
        self.page.locator('#pianoMenuButton').click()
        self.page.locator('#pianoTalkChopin').click()
        self.assertFalse(self.revealing('#pianoDialogueText'))
        self.assertEqual(self.page.locator('#pianoDialogueText').evaluate('el=>getComputedStyle(el).fontSize'), '20px')
        self.page.keyboard.press('Escape')
        self.page.keyboard.press('Escape')
        enter_room(self.page, 'fishing')
        self.page.locator('#fishingMenuButton').click()
        preference = self.page.locator('#fishingMenuOptions').get_by_label('Dialogue text speed')
        self.assertEqual(preference.input_value(), 'instant')
        preference.select_option('slow')
        self.page.locator('#fishingTalkCaptain').click()
        self.assertTrue(self.revealing('#fishingCaptainWords'))
        self.assertEqual(self.page.locator('#fishingCaptainWords').evaluate('el=>getComputedStyle(el).fontSize'), '20px')
        self.page.keyboard.press('Escape')
        self.assertFalse(self.revealing('#fishingCaptainWords'))
        self.page.keyboard.press('Escape')
        self.page.locator('#worldMenuBtn').click()
        self.page.locator('[data-settings-action="reading"]').click()
        self.assertEqual(self.page.locator('#worldMenu').get_by_label('Dialogue text speed').input_value(), 'slow')

    def test_scholar_speaks_but_record_stays_instant_and_changing_pages_cancels_speech(self):
        self.page.evaluate("CodaDialogueText.setSpeed('slow')")
        point = self.page.evaluate('CodaArcadeQA.scholar().approach')
        self.place(point['x'], point['y'])
        self.page.keyboard.press('e')
        journal = self.page.locator('.music-history[open]')
        journal.wait_for()
        self.page.evaluate("window.previousScholarLine=document.querySelector('.music-history [role=status]')")
        self.assertTrue(self.page.evaluate('CodaDialogueText.isRevealing(previousScholarLine)'))
        journal.locator('[data-scholar-action="record"]').click()
        self.assertFalse(self.page.evaluate('CodaDialogueText.isRevealing(previousScholarLine)'))
        self.assertEqual(journal.locator('.history-fact.locked').count(), 180)
        self.assertEqual(journal.locator('.history-fact span[style]').count(), 0)

    def test_phone_chat_fits_portrait_and_landscape_and_close_remains_reachable(self):
        self.context.close()
        self.context = self.browser.new_context(viewport={'width':390, 'height':844}, is_mobile=True, has_touch=True)
        self.context.route('https://**/*', lambda route:route.abort())
        self.context.route('https://cwoodmusic.github.io/**', self.route_checkout)
        self.context.add_init_script("localStorage.setItem('codaArcadeFXV1','off')")
        self.page = self.context.new_page()
        self.page.set_default_timeout(10000)
        self.page.on('pageerror', lambda error:self.errors.append(str(error)))
        self.load()
        self.page.evaluate("CodaDialogueText.setSpeed('slow')")
        for width, height in [(390,844), (844,390)]:
            with self.subTest(width=width):
                self.page.set_viewport_size({'width':width, 'height':height})
                talk_to_musician(self.page, 'bach')
                dialog = self.page.locator('#dialog')
                box = dialog.bounding_box()
                self.assertGreaterEqual(box['x'], 0)
                self.assertGreaterEqual(box['y'], 0)
                self.assertLessEqual(box['x']+box['width'], width+1)
                self.assertLessEqual(box['y']+box['height'], height+1)
                self.assertEqual(dialog.evaluate('el=>el.scrollTop'), 0)
                self.assertLessEqual(dialog.evaluate('el=>el.scrollWidth-el.clientWidth'), 1)
                self.assertEqual(self.page.locator('#words').evaluate('el=>getComputedStyle(el).fontSize'), '20px')
                self.page.locator('#close').scroll_into_view_if_needed()
                self.page.locator('#close').click()
                self.assertTrue(dialog.is_hidden())


if __name__ == '__main__':
    unittest.main(verbosity=2)
