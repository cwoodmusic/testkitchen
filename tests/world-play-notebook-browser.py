"""Play notes through the actual arcade, DJ game, settings, and Piano Lab.

The shared world fixture routes the public origin to this checkout, blocks
external services, and uses disposable browser storage. No notebook or game
shortcut is added to production code.
"""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
from world_navigation_helpers import enter_room, open_destination, open_settings

spec = importlib.util.spec_from_file_location('notebook_world_fixture', Path(__file__).with_name('learning-world-browser.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


class WorldPlayNotebookTests(fixture.WorldBrowserCase):
    def notebook(self):
        return self.page.locator('.play-notebook')

    def notes(self):
        return self.page.get_by_role('textbox', name='Bugs and future changes')

    def saved_text(self, expected):
        self.page.wait_for_function('''expected=>
          JSON.parse(localStorage.getItem(CodaPlayNotebook.KEY)||'null')?.text===expected
          &&document.querySelector('.play-notebook-status').dataset.saved==='true' ''', arg=expected)

    def journal(self):
        return self.page.evaluate('localStorage.getItem("codaPlayerProgressV1")')

    def test_p_stops_held_world_movement_keeps_typed_p_and_autosaves_across_reload(self):
        before_journal = self.journal()
        self.page.locator('#view').focus()
        self.page.keyboard.down('d')
        self.page.wait_for_timeout(80)
        self.page.keyboard.press('p')
        self.page.keyboard.up('d')
        self.assertTrue(self.notebook().is_visible())
        self.assertTrue(self.notes().evaluate('node=>node===document.activeElement'))
        position = self.page.evaluate('CodaArcadeQA.position()')

        text = 'Bug: the dance room door.\nFuture idea: a new song.'
        self.notes().fill(text)
        self.page.keyboard.type(' pwasd')
        self.page.keyboard.press('p')
        expected = text+' pwasdp'
        self.page.keyboard.press('ArrowLeft')
        self.page.keyboard.press('ArrowUp')
        self.page.keyboard.press('ArrowRight')
        self.page.keyboard.press('ArrowDown')
        self.saved_text(expected)
        self.assertTrue(self.notebook().is_visible(), 'P typed into notes must not close the pad.')
        self.assertEqual(self.notes().input_value(), expected)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.position()'), position)
        self.assertEqual(self.journal(), before_journal, 'Writing play notes awards no XP.')

        self.page.keyboard.press('Escape')
        self.assertFalse(self.notebook().is_visible())
        self.assertEqual(self.page.evaluate('document.activeElement.id'), 'view')
        self.page.wait_for_timeout(100)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.position()'), position, 'The old held movement must stay released.')

        self.load()
        self.page.locator('#view').focus()
        self.page.keyboard.press('p')
        self.assertTrue(self.notebook().is_visible())
        self.assertEqual(self.notes().input_value(), expected)
        self.assertEqual(self.page.locator('.play-notebook-status').get_attribute('data-saved'), 'true')

    def test_settings_changelog_shows_the_bundled_current_release_and_notes_button(self):
        before_journal = self.journal()
        open_settings(self.page)
        self.page.get_by_role('button', name='Changelog', exact=True).click()
        self.assertTrue(self.notebook().is_visible())
        self.assertEqual(self.page.locator('[data-notebook-tab="changelog"]').get_attribute('aria-selected'), 'true')
        releases = self.page.locator('.play-notebook-release')
        self.assertGreaterEqual(releases.count(), 2)
        current_title=self.page.evaluate('CodaChangelog.entries[0].title')
        self.assertEqual(releases.first.locator('h3').inner_text(), current_title)
        self.assertIn('Play notes', current_title)
        self.assertIn('Hard dance mode is now 88 BPM.', releases.first.inner_text())
        self.assertIn('Sixteenth-note runs keep one arrow direction.', releases.first.inner_text())
        self.assertFalse(self.page.locator('body').evaluate('node=>node.classList.contains("world-menu-open")'))
        self.page.keyboard.press('Escape')

        self.page.set_viewport_size({'width':390,'height':844})
        open_settings(self.page)
        menu=self.page.locator('#worldMenu').bounding_box()
        self.assertGreaterEqual(menu['x'],0)
        self.assertLessEqual(menu['x']+menu['width'],390)
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        for identifier in ['worldPlayNotes','worldChangelog']:
            option=self.page.locator('#'+identifier)
            option.scroll_into_view_if_needed()
            bounds=option.bounding_box()
            self.assertGreaterEqual(bounds['y'],0)
            self.assertLessEqual(bounds['y']+bounds['height'],844)
        self.page.get_by_role('button', name='Play notes (P)', exact=True).click()
        self.assertTrue(self.notes().is_visible())
        self.assertEqual(self.page.locator('[data-notebook-tab="notes"]').get_attribute('aria-selected'), 'true')
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        self.assertEqual(self.journal(), before_journal)

    def test_p_during_a_dance_cancels_audio_and_scoring_before_opening_notes(self):
        before_journal = self.journal()
        open_destination(self.page, 'dj')
        self.page.locator('[data-start-dance]').click()
        self.page.locator('[data-dance-mode="hard"]').click()
        self.page.wait_for_function('CodaArcadeQA.danceGame().stage.active')
        self.assertTrue(self.page.evaluate('CodaArcadeQA.danceGame().game.audioPlaying'))

        self.page.keyboard.press('p')
        self.assertTrue(self.notebook().is_visible())
        scene = self.page.evaluate('CodaArcadeQA.danceGame()')
        self.assertFalse(scene['active'])
        self.assertFalse(scene['stage']['active'])
        self.assertFalse(scene['game']['audioPlaying'])
        self.assertEqual(self.journal(), before_journal)
        self.notes().fill('Bug: pause here before the next dance.')
        self.page.keyboard.press('Escape')
        self.assertFalse(self.notebook().is_visible())
        self.assertFalse(self.page.evaluate('CodaArcadeQA.danceGame().active'))
        self.assertFalse(self.page.locator('#panel').is_visible())
        self.page.wait_for_timeout(350)
        self.assertEqual(self.journal(), before_journal, 'An interrupted dance must never finish in the background.')

    def test_escape_closes_notes_before_the_underlying_world_panel(self):
        open_destination(self.page, 'fame')
        title = self.page.locator('#panelTitle').inner_text()
        self.page.keyboard.press('p')
        self.assertTrue(self.notebook().is_visible())
        self.page.keyboard.press('Escape')
        self.assertFalse(self.notebook().is_visible())
        self.assertTrue(self.page.locator('#panel').is_visible())
        self.assertEqual(self.page.locator('#panelTitle').inner_text(), title)
        self.page.keyboard.press('Escape')
        self.assertFalse(self.page.locator('#panel').is_visible())

    def test_notes_in_piano_lab_do_not_play_typing_or_close_the_room(self):
        enter_room(self.page, 'piano')
        self.page.wait_for_function('CodaArcadeQA.piano().background.ready')
        self.page.locator('#pianoRoomCanvas').focus()
        before = self.page.evaluate('CodaArcadeQA.piano()')
        self.assertEqual(before['held'], [])
        self.page.keyboard.press('p')
        self.assertTrue(self.notebook().is_visible())
        self.notes().fill('Piano bug: ')
        self.page.keyboard.type('pwasdefghjkl')
        self.page.keyboard.press('ArrowLeft')
        self.page.keyboard.press('ArrowRight')
        self.saved_text('Piano bug: pwasdefghjkl')
        during = self.page.evaluate('CodaArcadeQA.piano()')
        self.assertTrue(during['open'])
        self.assertEqual(during['held'], [])
        self.assertEqual(during['recorded'], before['recorded'])
        self.assertEqual((during['player']['x'],during['player']['y']), (before['player']['x'],before['player']['y']))
        self.page.keyboard.press('Escape')
        self.assertFalse(self.notebook().is_visible())
        self.assertTrue(self.page.evaluate('CodaArcadeQA.piano().open'))
        self.assertEqual(self.page.evaluate('document.activeElement.id'), 'pianoRoomCanvas')


if __name__ == '__main__':
    unittest.main(verbosity=2)
