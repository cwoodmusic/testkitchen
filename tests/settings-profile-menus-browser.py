"""Settings and Profile menus in the assembled game with disposable players.

Requests outside the checkout are blocked by the shared fixture. Browsing tests
read real progress and preferences without modifying saved player records.
"""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True

_spec = importlib.util.spec_from_file_location(
    'settings_profile_world', Path(__file__).with_name('learning-world-browser.py'))
_world = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_world)


class SettingsProfileMenuTests(_world.WorldBrowserCase):
    def settings(self):
        return self.page.locator('#worldMenu')

    def settings_action(self, page):
        return self.settings().locator('[data-settings-action="' + page + '"]')

    def profile(self):
        return self.page.locator('.player-profile')

    def profile_action(self, page):
        return self.profile().locator('[data-profile-action="' + page + '"]')

    def open_settings(self):
        if self.page.locator('#worldMenuBtn').get_attribute('aria-expanded') != 'true':
            self.page.locator('#worldMenuBtn').click()
        self.settings().wait_for(state='visible')

    def saved_player(self):
        return self.page.evaluate('''()=>Object.fromEntries([
          'musicArcadeV1','codaNotesWalletV1','codaPlayerProgressV1',
          'codaClassroomLessonsV1','codaClassroomLearningPathsV1','codaMusicHistoryV1'
        ].map(key=>[key,localStorage.getItem(key)]))''')

    def saved_preferences(self):
        return self.page.evaluate('''()=>Object.fromEntries([
          'codaDialogueTextSpeedV1','codaArcadeFXV1','codaArcadeVibeV1'
        ].map(key=>[key,localStorage.getItem(key)]))''')

    def assert_fits(self, locator, width):
        bounds = locator.evaluate('''node=>({
          client:node.clientWidth,scroll:node.scrollWidth,
          left:node.getBoundingClientRect().left,
          right:node.getBoundingClientRect().right
        })''')
        self.assertLessEqual(bounds['scroll'], bounds['client'] + 1, bounds)
        self.assertGreaterEqual(bounds['left'], -1, bounds)
        self.assertLessEqual(bounds['right'], width + 1, bounds)

    def test_settings_browsing_preserves_player_preferences_and_world_position(self):
        self.open_settings()
        before, preferences = self.saved_player(), self.saved_preferences()
        position = self.page.evaluate('CodaArcadeQA.position()')
        self.assertEqual(self.settings().get_attribute('role'), 'dialog')
        self.assertEqual(self.settings().get_attribute('data-settings-page'), 'home')
        for target, control in [('reading','.dialogue-text-settings'),
                                ('screen','#zoomIn'),('player','#accountBtn'),
                                ('help','#worldChangelog')]:
            self.settings_action(target).click()
            self.assertEqual(self.settings().get_attribute('data-settings-page'), target)
            self.assertTrue(self.settings().locator(control).is_visible())
            self.settings_action('home').click()
        self.page.keyboard.down('d')
        self.page.wait_for_timeout(120)
        self.page.keyboard.up('d')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.position()'), position)
        self.assertFalse(self.page.evaluate('CodaArcadeQA.jukebox().playing'))
        self.assertEqual(self.saved_player(), before)
        self.assertEqual(self.saved_preferences(), preferences)

    def test_reading_preference_saves_and_escape_returns_one_level_at_a_time(self):
        self.open_settings()
        before = self.saved_player()
        self.settings_action('reading').click()
        self.settings().get_by_label('Dialogue text speed', exact=True).select_option('instant')
        self.assertEqual(self.page.evaluate('CodaDialogueText.getSpeed()'), 'instant')
        self.assertEqual(self.page.evaluate('localStorage.getItem("codaDialogueTextSpeedV1")'), 'instant')
        self.assertTrue(self.settings().is_visible())
        self.page.keyboard.press('Escape')
        self.assertEqual(self.settings().get_attribute('data-settings-page'), 'home')
        self.page.keyboard.press('Escape')
        self.assertFalse(self.settings().is_visible())
        self.assertEqual(self.page.locator('#worldMenuBtn').get_attribute('aria-expanded'), 'false')
        self.assertEqual(self.page.evaluate('document.activeElement.id'), 'worldMenuBtn')
        self.assertEqual(self.saved_player(), before)
        self.page.reload()
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready()')
        self.open_settings()
        self.settings_action('reading').click()
        self.assertEqual(self.settings().get_by_label('Dialogue text speed', exact=True).input_value(), 'instant')

    def test_screen_controls_and_music_mirror_act_only_when_selected(self):
        self.open_settings()
        before = self.saved_player()
        self.settings_action('screen').click()
        quality = self.page.evaluate('CodaArcadeQA.atmosphere().quality')
        self.page.locator('#fxBtn').click()
        self.assertNotEqual(self.page.evaluate('CodaArcadeQA.atmosphere().quality'), quality)
        zoom = self.page.evaluate('CodaArcadeQA.camera().targetZoom')
        self.page.locator('#zoomIn').click()
        self.assertGreater(self.page.evaluate('CodaArcadeQA.camera().targetZoom'), zoom)
        self.page.locator('#zoomReset').click()
        self.assertTrue(self.settings().is_visible())
        self.settings_action('home').click()
        self.settings_action('reading').click()
        self.assertEqual(self.page.locator('#worldSettingsMusic').get_attribute('aria-pressed'), 'false')
        self.page.locator('#worldSettingsMusic').click()
        self.page.wait_for_function('CodaArcadeQA.jukebox().playing')
        self.assertEqual(self.page.locator('#musicBtn').get_attribute('aria-pressed'), 'true')
        self.assertEqual(self.page.locator('#worldSettingsMusic').get_attribute('aria-pressed'), 'true')
        self.page.locator('#worldSettingsMusic').click()
        self.page.wait_for_function('!CodaArcadeQA.jukebox().playing')
        self.assertEqual(self.page.locator('#worldSettingsMusic').get_attribute('aria-pressed'), 'false')
        self.assertEqual(self.saved_player(), before)

    def test_player_options_stay_real_controls_and_keyboard_focus_stays_in_settings(self):
        self.open_settings()
        self.settings_action('player').click()
        for selector in ['#accountBtn','#worldLogOut','#worldTitleScreenLink']:
            self.assertEqual(self.page.locator(selector).count(), 1)
            self.assertEqual(self.settings().locator(selector).count(), 1)
        self.assertTrue(self.page.locator('#accountBtn').is_visible())
        self.assertFalse(self.page.locator('#worldLogOut').is_visible(), 'A fresh guest has no classroom logout action')
        self.assertIn('index.html', self.page.locator('#worldTitleScreenLink').get_attribute('href'))
        controls = self.settings().locator('button:not(:disabled):visible,select:not(:disabled):visible,a[href]:visible,summary:visible')
        controls.first.focus()
        self.page.keyboard.press('Shift+Tab')
        self.assertTrue(controls.last.evaluate('node=>node===document.activeElement'))
        self.page.keyboard.press('Tab')
        self.assertTrue(controls.first.evaluate('node=>node===document.activeElement'))
        self.settings_action('close').click()
        self.assertFalse(self.settings().is_visible())

    def test_profile_cards_show_real_progress_without_claiming_rewards(self):
        before = self.saved_player()
        self.page.locator('#levelBtn').click()
        self.assertEqual(self.profile().get_attribute('data-profile-page'), 'home')
        actual = self.page.evaluate('CodaArcadeQA.profile()')
        self.assertEqual(self.profile().locator('.profile-level').inner_text(), 'Level ' + str(actual['level']))
        self.assertIn(str(actual['notes']), self.profile().locator('.profile-notes').inner_text())
        for target, content in [('missions','.profile-missions'),
                                ('prizes','.profile-next-prizes'),
                                ('learning','.profile-lessons'),
                                ('activity','.profile-recent')]:
            self.profile_action(target).click()
            self.assertEqual(self.profile().get_attribute('data-profile-page'), target)
            self.assertTrue(self.profile().locator(content).is_visible())
            self.page.keyboard.press('Escape')
            self.assertEqual(self.profile().get_attribute('data-profile-page'), 'home')
        self.page.locator('#worldMenuBtn').click()
        self.assertTrue(self.page.locator('#panel').is_hidden(), 'Settings replaces the open Profile dialog')
        self.assertTrue(self.settings().is_visible())
        self.page.keyboard.press('Escape')
        self.page.locator('#levelBtn').click()
        self.assertEqual(self.profile().get_attribute('data-profile-page'), 'home')
        self.page.keyboard.press('Escape')
        self.assertTrue(self.page.locator('#panel').is_hidden())
        self.assertEqual(self.saved_player(), before)

    def test_settings_and_profile_pages_fit_phone_and_short_desktop_screens(self):
        for width, height in [(320,740),(390,844),(1366,768)]:
            with self.subTest(width=width):
                self.page.set_viewport_size({'width':width,'height':height})
                self.open_settings()
                for page in ['home','reading','screen','player','help']:
                    if page != 'home':
                        self.settings_action(page).click()
                    self.assert_fits(self.settings(), width)
                    if page != 'home':
                        self.settings_action('home').click()
                self.settings_action('close').click()
                self.page.locator('#levelBtn').click()
                for page in ['home','missions','prizes','learning','activity']:
                    if page != 'home':
                        self.profile_action(page).click()
                    self.assert_fits(self.page.locator('#panel'), width)
                    self.assert_fits(self.profile(), width)
                    if page != 'home':
                        self.profile_action('home').click()
                self.page.locator('#panelClose').click()


if __name__ == '__main__':
    unittest.main(verbosity=2)
