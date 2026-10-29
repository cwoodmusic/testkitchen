"""Escape closes the topmost arcade dialogue, including shops and room menus."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
from world_navigation_helpers import enter_room, open_destination, talk_to_musician

_spec = importlib.util.spec_from_file_location('escape_world', Path(__file__).with_name('learning-world-browser.py'))
_world = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_world)


class EscapeDialoguesTests(_world.WorldBrowserCase):
    def assert_world_ready(self):
        self.assertTrue(self.page.locator('#panel').is_hidden())
        self.assertEqual(self.page.evaluate('document.activeElement.id'), 'view')
        self.assertFalse(self.page.evaluate('CodaArcadeQA.conversation().open'))
        self.assertEqual(self.page.evaluate('CodaArcadeQA.joystick().strength'), 0)

    def test_escape_closes_boutique_and_notes_store_from_text_fields(self):
        for destination, title in [('boutique', 'Boutique'), ('shop', 'Notes Shop')]:
            with self.subTest(destination=destination):
                open_destination(self.page, destination)
                self.assertIn(title, self.page.locator('#panelTitle').inner_text())
                field = self.page.locator('#panel input:not([type=color]):not([type=range])').first
                self.assertTrue(field.is_visible())
                field.focus()
                self.page.keyboard.press('Escape')
                self.assert_world_ready()

    def test_escape_closes_profile_conversation_and_music_trivia(self):
        self.page.locator('#levelBtn').click()
        self.page.locator('#view').focus()
        self.page.keyboard.press('Escape')
        self.assert_world_ready()

        talk_to_musician(self.page, 'bach')
        self.assertTrue(self.page.evaluate('CodaArcadeQA.conversation().open'))
        self.page.locator('#view').focus()
        self.page.keyboard.press('Escape')
        self.assert_world_ready()
        talk_to_musician(self.page, 'bach')
        self.page.get_by_role('button', name='Ask me a music question · Earn Notes', exact=True).click()
        self.assertTrue(self.page.locator('.musician-trivia').is_visible())
        self.page.keyboard.press('Escape')
        self.assert_world_ready()

    def test_escape_closes_settings_above_store_before_closing_store(self):
        open_destination(self.page, 'boutique')
        self.page.locator('#worldMenuBtn').click()
        self.assertTrue(self.page.locator('body').evaluate("node=>node.classList.contains('world-menu-open')"))
        self.page.keyboard.press('Escape')
        self.assertFalse(self.page.locator('body').evaluate("node=>node.classList.contains('world-menu-open')"))
        self.assertTrue(self.page.locator('#panel').is_visible(), 'Closing Settings must preserve the store beneath it')
        self.page.keyboard.press('Escape')
        self.assert_world_ready()

    def test_escape_closes_chopin_dialogue_and_menu_before_leaving_piano(self):
        enter_room(self.page, 'piano')
        self.page.locator('#pianoMenuButton').click()
        self.page.locator('#pianoTalkChopin').click()
        self.assertTrue(self.page.evaluate('CodaArcadeQA.piano().dialogueOpen'))
        self.page.keyboard.press('Escape')
        state = self.page.evaluate('CodaArcadeQA.piano()')
        self.assertTrue(state['open'])
        self.assertFalse(state['dialogueOpen'])
        self.page.locator('#pianoMenuButton').click()
        self.page.keyboard.press('Escape')
        state = self.page.evaluate('CodaArcadeQA.piano()')
        self.assertTrue(state['open'])
        self.assertFalse(state['menuOpen'])
        self.page.keyboard.press('Escape')
        self.assertFalse(self.page.evaluate('CodaArcadeQA.piano().open'))
        self.assert_world_ready()

    def test_escape_closes_cave_audio_practice_captain_and_menu_one_at_a_time(self):
        enter_room(self.page, 'fishing')
        for option in ['fishingLakeAudio', 'fishingPractice', 'fishingTalkCaptain']:
            with self.subTest(option=option):
                self.page.locator('#fishingMenuButton').click()
                self.page.locator('#'+option).click()
                self.page.keyboard.press('Escape')
                state = self.page.evaluate('CodaArcadeQA.fishing()')
                self.assertTrue(state['open'])
                self.assertEqual(state['phase'], 'shore')
                self.assertFalse(state['menuOpen'])
                self.assertFalse(state['audio']['settingsOpen'])
                self.assertFalse(state['practiceSettingsOpen'])
        self.page.locator('#fishingMenuButton').click()
        self.page.keyboard.press('Escape')
        self.assertTrue(self.page.evaluate('CodaArcadeQA.fishing().open'))
        self.assertFalse(self.page.evaluate('CodaArcadeQA.fishing().menuOpen'))
        self.page.keyboard.press('Escape')
        self.assertFalse(self.page.evaluate('CodaArcadeQA.fishing().open'))
        self.assert_world_ready()


if __name__ == '__main__':
    unittest.main(verbosity=2)
