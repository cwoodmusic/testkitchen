"""Maximize the developer console without losing edits or child-editor state."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location(
    'fullscreen_world_fixture', Path(__file__).with_name('learning-world-browser.py'))
_world = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_world)


class DeveloperConsoleFullscreenTests(_world.WorldBrowserCase):
    maxDiff = 800

    def state(self):
        return self.page.evaluate('CodaDeveloperConsole.getState()')

    def project_fingerprint(self):
        data = self.page.evaluate('CodaDeveloperConsole.getProject()')
        return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()

    def open_console(self):
        self.page.keyboard.press('F2')
        self.page.locator('#assetStudio').wait_for()
        self.assertTrue(self.state()['open'])

    def expand(self):
        button = self.page.get_by_role('button', name='Make developer console fullscreen', exact=True)
        button.click()
        self.page.wait_for_function('CodaDeveloperConsole.getState().fullscreen')
        self.assertEqual(self.page.locator('#devFullscreen').get_attribute('aria-pressed'), 'true')
        self.assertEqual(self.page.locator('#devFullscreen').inner_text(), 'Restore window')
        self.assertIn('dev-fullscreen', self.page.locator('#assetStudio').get_attribute('class'))

    def assert_fits_viewport(self):
        bounds = self.page.locator('#assetStudio').bounding_box()
        viewport = self.page.viewport_size
        self.assertAlmostEqual(bounds['x'], 0, delta=1)
        self.assertAlmostEqual(bounds['y'], 0, delta=1)
        self.assertAlmostEqual(bounds['width'], viewport['width'], delta=1)
        self.assertAlmostEqual(bounds['height'], viewport['height'], delta=1)
        metrics = self.page.locator('#assetStudio').evaluate('''el=>({
          width:el.clientWidth, scroll:el.scrollWidth,
          viewportWidth:innerWidth, documentWidth:document.documentElement.scrollWidth
        })''')
        self.assertLessEqual(metrics['scroll'], metrics['width'] + 1)
        self.assertLessEqual(metrics['documentWidth'], metrics['viewportWidth'] + 1)
        for selector in ['#devFullscreen', '#assetClose']:
            button = self.page.locator(selector).bounding_box()
            self.assertGreaterEqual(button['x'], 0)
            self.assertGreaterEqual(button['y'], 0)
            self.assertLessEqual(button['x'] + button['width'], viewport['width'] + 1)
            self.assertLessEqual(button['y'] + button['height'], viewport['height'] + 1)

    def test_fullscreen_restore_and_input_escape_keep_selected_fact_and_draft(self):
        self.open_console()
        self.page.locator('#devTab-facts').click()
        self.page.get_by_label('Fact musician', exact=True).select_option('vivaldi')
        selected = self.page.get_by_label('Music fact', exact=True).input_value()
        fact = self.page.get_by_label('Music fact text', exact=True)
        draft = 'Vivaldi wrote lively music for many instruments. This is an unsaved draft.'
        fact.fill(draft)
        project = self.project_fingerprint()
        history = self.page.evaluate('localStorage.getItem("codaMusicHistoryV1")')
        self.expand()
        self.assert_fits_viewport()
        self.assertEqual(self.state()['tab'], 'facts')
        self.assertEqual(self.page.get_by_label('Music fact', exact=True).input_value(), selected)
        self.assertEqual(fact.input_value(), draft)
        self.page.get_by_role('button', name='Restore developer console window', exact=True).click()
        self.assertFalse(self.state()['fullscreen'])
        self.assertTrue(self.state()['open'])
        self.assertEqual(fact.input_value(), draft)
        self.expand()
        fact.focus()
        self.page.keyboard.press('Escape')
        self.assertFalse(self.state()['fullscreen'])
        self.assertTrue(self.state()['open'], 'Escape restores the window before closing the console')
        self.assertEqual(fact.input_value(), draft)
        self.assertEqual(self.project_fingerprint(), project, 'Changing the view must not commit an unsaved fact')
        self.assertEqual(self.page.evaluate('localStorage.getItem("codaMusicHistoryV1")'), history)

    def test_close_button_and_f2_clear_fullscreen_and_reopen_windowed(self):
        self.open_console();self.expand()
        project = self.project_fingerprint()
        self.page.locator('#assetClose').click()
        self.assertFalse(self.state()['open'])
        self.assertFalse(self.state()['fullscreen'])
        self.assertNotIn('dev-fullscreen', self.page.locator('#assetStudio').get_attribute('class'))
        self.open_console()
        self.assertFalse(self.state()['fullscreen'])
        self.assertEqual(self.page.locator('#devFullscreen').get_attribute('aria-pressed'), 'false')
        self.expand()
        self.page.keyboard.press('F2')
        self.assertFalse(self.state()['open'])
        self.assertFalse(self.state()['fullscreen'])
        self.open_console()
        self.page.locator('#devTab-facts').click()
        self.page.get_by_label('Music fact text', exact=True).scroll_into_view_if_needed()
        self.assertFalse(self.state()['fullscreen'])
        self.assertTrue(self.page.locator('#assetStudio').is_visible())
        button = self.page.locator('#devFullscreen')
        button.focus();self.page.keyboard.press('Enter')
        self.assertTrue(self.state()['fullscreen'], 'Enter activates the fullscreen control')
        targets = '''()=>[...document.querySelector('#assetStudio').querySelectorAll(
          'button,input,select,textarea,a[href],summary,[tabindex]')].filter(
          el=>!el.disabled&&el.tabIndex>=0&&el.getClientRects().length&&
            getComputedStyle(el).visibility!=='hidden')'''
        self.page.evaluate('(' + targets + ')().at(-1).focus()')
        self.page.keyboard.press('Tab')
        self.assertTrue(self.page.evaluate('(' + targets + ')()[0]===document.activeElement'))
        self.page.keyboard.press('Shift+Tab')
        self.assertTrue(self.page.evaluate('(' + targets + ')().at(-1)===document.activeElement'))
        button.focus();self.page.keyboard.press('Space')
        self.assertFalse(self.state()['fullscreen'], 'Space restores the console window')
        button.focus();self.page.keyboard.press('Enter')
        self.page.locator('#devPlaytest').focus();self.page.keyboard.press('Space')
        self.assertTrue(self.state()['playtest'])
        self.assertFalse(self.state()['fullscreen'], 'Playtest must reveal the game canvas')
        self.assertTrue(self.state()['open'])
        self.page.keyboard.press('Escape')
        self.assertFalse(self.state()['playtest'])
        self.assertTrue(self.state()['open'])
        self.page.locator('#devTab-objects').click()
        self.expand();self.page.locator('#devPan').click()
        self.assertFalse(self.state()['fullscreen'], 'Panning requires the world canvas to be visible')
        self.assertTrue(self.state()['open'])
        self.page.locator('#devPan').click()
        self.expand();self.page.locator('#devLiftRegion').click()
        self.assertFalse(self.state()['fullscreen'], 'Region selection must expose the map')
        self.page.keyboard.press('Escape')
        self.assertTrue(self.state()['open'], 'Escape cancels the selection before closing the console')
        self.assertEqual(self.project_fingerprint(), project)

    def test_child_editors_exit_before_the_fullscreen_console(self):
        self.open_console();self.expand()
        project = self.project_fingerprint()
        for tab, state_key, child in [
                ('artwork', 'artwork', '[data-artwork-editor].is-expanded'),
                ('education', 'education', '[data-education-editor].is-expanded')]:
            with self.subTest(tab=tab):
                self.page.locator('#devTab-' + tab).click()
                self.page.wait_for_function(
                    'key=>CodaDeveloperConsole.getState()[key]?.expanded', arg=state_key)
                self.assertTrue(self.page.locator(child).is_visible())
                self.page.keyboard.press('Escape')
                self.page.wait_for_function(
                    'key=>!CodaDeveloperConsole.getState()[key]?.expanded', arg=state_key)
                self.assertTrue(self.state()['open'])
                self.assertTrue(self.state()['fullscreen'], 'First Escape belongs to the child editor')
                self.page.wait_for_function(
                    'document.querySelector("#assetStudio").contains(document.activeElement)')
                self.assert_fits_viewport()
        self.page.locator('#devFullscreen').focus()
        self.page.keyboard.press('Escape')
        self.assertFalse(self.state()['fullscreen'])
        self.assertTrue(self.state()['open'])
        self.assertEqual(self.project_fingerprint(), project)

    def test_phone_and_short_landscape_scroll_and_resize_keep_header_reachable(self):
        self.page.set_viewport_size({'width':390, 'height':844})
        self.open_console();self.expand()
        self.page.locator('#devTab-facts').click()
        for viewport in [{'width':390, 'height':844}, {'width':844, 'height':390},
                         {'width':1280, 'height':720}]:
            with self.subTest(viewport=viewport):
                self.page.set_viewport_size(viewport)
                self.assert_fits_viewport()
                self.page.get_by_label('Music fact text', exact=True).scroll_into_view_if_needed()
                self.assert_fits_viewport()
                scroll = self.page.locator('#assetStudio .dev-content')
                scroll.evaluate('el=>el.scrollTop=el.scrollHeight')
                self.assertGreater(scroll.evaluate('el=>el.scrollTop'), 0,
                                   'The full-window content area should scroll while its header stays visible')
                self.assert_fits_viewport()
        self.page.screenshot(path='/tmp/coda-developer-console-fullscreen.png')
        self.page.get_by_role('button', name='Restore developer console window', exact=True).click()
        self.assertFalse(self.state()['fullscreen'])
        self.assertTrue(self.state()['open'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
