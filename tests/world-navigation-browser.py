"""The compact world header leaves destinations on the actual arcade floor."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode=True
from world_navigation_helpers import close_settings,enter_room,open_destination,open_settings,talk_to_musician

_spec=importlib.util.spec_from_file_location('navigation_world_fixture',Path(__file__).with_name('learning-world-browser.py'))
_world=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_world)


class WorldNavigationTests(_world.WorldBrowserCase):
    def visible_header_buttons(self):
        return self.page.locator('body>header button').evaluate_all('''nodes=>nodes
          .filter(node=>node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden')
          .map(node=>node.id)''')

    def test_header_only_has_profile_developer_music_and_settings_at_every_screen_size(self):
        expected={'levelBtn','worldDeveloperBtn','musicBtn','worldMenuBtn'}
        for width,height in [(1550,1050),(390,844),(844,390),(320,780)]:
            self.page.set_viewport_size({'width':width,'height':height});self.page.wait_for_timeout(80)
            self.assertEqual(set(self.visible_header_buttons()),expected)
            self.assertEqual(self.page.locator('#worldLegacyShortcuts button:visible').count(),0)
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
            open_settings(self.page)
            self.assertTrue(self.page.locator('#zoomIn').is_visible())
            self.assertTrue(self.page.locator('#fxBtn').is_visible())
            self.assertTrue(self.page.locator('#accountBtn').is_visible())
            self.assertTrue(self.page.locator('#fs').is_visible())
            previous=self.page.evaluate('CodaArcadeQA.camera().targetZoom')
            self.page.locator('#zoomIn').click()
            self.assertGreater(self.page.evaluate('CodaArcadeQA.camera().targetZoom'),previous)
            self.page.locator('#zoomReset').click();close_settings(self.page)
            self.assertEqual(set(self.visible_header_buttons()),expected)
        self.page.locator('#view').focus();self.page.keyboard.press('Tab')
        self.assertEqual(self.page.locator('#worldMenuBtn').get_attribute('aria-expanded'),'true')
        self.page.keyboard.press('Escape')
        self.assertEqual(self.page.locator('#worldMenuBtn').get_attribute('aria-expanded'),'false')
        self.page.locator('#levelBtn').click();self.assertTrue(self.page.locator('#panel').is_visible())
        self.page.keyboard.press('Escape');self.assertFalse(self.page.locator('#panel').is_visible())
        self.page.locator('#worldDeveloperBtn').click()
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.getState().editing'))

    def test_desktop_piano_zoom_changes_the_room_and_escape_closes_settings_before_leaving(self):
        enter_room(self.page,'piano')
        self.page.wait_for_function('CodaArcadeQA.piano().background.ready')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.piano().camera.zoom'),1)
        self.page.locator('#pianoRoomCanvas').focus();self.page.keyboard.press('Tab')
        self.assertTrue(self.page.evaluate('CodaArcadeQA.piano().menuOpen'))
        self.assertEqual(self.page.evaluate('CodaArcadeQA.piano().mobileView'),'settings')
        self.page.get_by_role('button',name='Zoom piano room in',exact=True).click()
        self.page.wait_for_function('CodaArcadeQA.piano().camera.zoom>1')
        zoom=self.page.evaluate('CodaArcadeQA.piano().camera.zoom')
        self.assertLessEqual(zoom,1.5)
        self.page.keyboard.press('Escape')
        self.assertTrue(self.page.evaluate('CodaArcadeQA.piano().open'))
        self.assertFalse(self.page.evaluate('CodaArcadeQA.piano().menuOpen'))
        self.assertEqual(self.page.evaluate('CodaArcadeQA.piano().camera.zoom'),zoom)
        self.page.keyboard.press('Escape')
        self.assertFalse(self.page.evaluate('CodaArcadeQA.piano().open'))

    def test_an_offsite_unlocked_musician_can_arrive_and_talk_without_spending_notes(self):
        self.page.clock.install();self.page.clock.pause_at(self.page.evaluate('Date.now()/1000')+5)
        self.page.clock.run_for(64)
        visitor=self.page.evaluate('CodaArcadeQA.characters().npcs.find(person=>person.hidden&&person.unlocked)')
        self.assertIsNotNone(visitor,'Some unlocked musicians should be outside the rotating cast')
        balance=self.page.evaluate('CodaArcadeQA.notes().balance')
        talk_to_musician(self.page,visitor['id'])
        self.assertEqual(self.page.evaluate('CodaArcadeQA.conversation().id'),visitor['id'])
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),balance)
        self.assertTrue(self.page.evaluate('CodaArcadeQA.visitors().enabled'))
        self.assertIn(visitor['id'],self.page.evaluate('CodaArcadeQA.visitors().onsite'))

    def test_boutique_notes_shop_dj_and_hall_open_from_their_physical_interaction_points(self):
        for destination,title in [('boutique','Boutique'),('shop','Notes Shop'),('dj','Jukebox'),('fame','Hall of Fame')]:
            open_destination(self.page,destination)
            self.assertIn(title,self.page.locator('#panelTitle').inner_text())
            self.assertEqual(set(self.visible_header_buttons()),{'levelBtn','worldDeveloperBtn','musicBtn','worldMenuBtn'})
            self.page.keyboard.press('Escape');self.assertFalse(self.page.locator('#panel').is_visible())


if __name__=='__main__':unittest.main(verbosity=2)
