"""Child-friendly activity menus against the assembled game and real storage.

All outside requests are blocked by the shared world fixture. These checks use
disposable guest players and the physical DJ, shop, boutique, and scholar.
"""
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
from world_navigation_helpers import open_destination, _close_world_panels

_spec = importlib.util.spec_from_file_location(
    'activity_menu_world_fixture', Path(__file__).with_name('learning-world-browser.py'))
_world = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_world)


class ActivityMenuTests(_world.WorldBrowserCase):
    def saved_rewards(self):
        return self.page.evaluate('''()=>({
          wallet:localStorage.getItem('codaNotesWalletV1'),
          progression:localStorage.getItem('codaPlayerProgressV1'),
          history:localStorage.getItem('codaMusicHistoryV1')
        })''')

    def dj_action(self, action):
        return self.page.locator('.dj-menu [data-dj-action="' + action + '"]')

    def shop_action(self, page):
        return self.page.locator('.notes-shop [data-shop-page="' + page + '"]')

    def scholar(self):
        _close_world_panels(self.page)
        point = self.page.evaluate('CodaArcadeQA.scholar().approach')
        self.place(point['x'], point['y'])
        self.page.keyboard.press('e')
        self.page.locator('.music-history[open]').wait_for()
        return self.page.locator('.music-history')

    def assert_fits_width(self, locator, width):
        dimensions = locator.evaluate('''node=>({
          width:node.clientWidth,scroll:node.scrollWidth,
          left:node.getBoundingClientRect().left,
          right:node.getBoundingClientRect().right
        })''')
        self.assertLessEqual(dimensions['scroll'], dimensions['width'] + 1)
        self.assertGreaterEqual(dimensions['left'], -1)
        self.assertLessEqual(dimensions['right'], width + 1)

    def test_dj_home_does_not_start_music_and_back_keeps_playback_controls_available(self):
        open_destination(self.page, 'dj')
        before = self.saved_rewards()
        self.assertEqual(self.page.locator('.dj-menu').get_attribute('data-dj-page'), 'home')
        for action in ('dance', 'music', 'songs', 'history'):
            self.assertTrue(self.dj_action(action).is_visible())
        self.assertFalse(self.page.evaluate('CodaArcadeQA.jukebox().playing'))
        self.dj_action('music').click()
        self.assertEqual(self.page.locator('[data-house-track]').count(), 17)
        self.assertTrue(self.page.locator('[data-jukebox-track="lanternwake-shanty"]').is_disabled())
        self.page.locator('[data-jukebox-track="neon-afterhours"]').click()
        self.page.wait_for_function('CodaArcadeQA.jukebox().playing')
        self.page.keyboard.press('Escape')
        self.assertEqual(self.page.locator('.dj-menu').get_attribute('data-dj-page'), 'home')
        self.assertTrue(self.page.evaluate('CodaArcadeQA.jukebox().playing'))
        self.assertTrue(self.page.locator('#jukeboxStop').is_visible())
        self.page.locator('#jukeboxStop').click()
        self.assertFalse(self.page.evaluate('CodaArcadeQA.jukebox().playing'))
        self.assertEqual(self.saved_rewards(), before)

    def test_dj_song_import_stays_in_my_songs_and_needs_explicit_play(self):
        open_destination(self.page, 'dj')
        self.dj_action('songs').click()
        self.assertEqual(self.page.locator('.dj-menu').get_attribute('data-dj-page'), 'songs')
        song = self.page.evaluate('CodaDJLibrary.songs[0].composition')
        self.page.locator('#djSongImport').set_input_files({
            'name': 'My first song.json', 'mimeType': 'application/json',
            'buffer': json.dumps(song).encode()
        })
        self.page.wait_for_function('''()=>JSON.parse(localStorage.getItem('codaDJLibraryV1')||'[]')
          .some(record=>record.title==='My first song')''')
        self.assertFalse(self.page.evaluate('CodaArcadeQA.jukebox().playing'))
        imported = self.page.get_by_role('button', name='Play My first song', exact=True)
        self.assertTrue(imported.is_visible())
        imported.click()
        self.page.wait_for_function('CodaArcadeQA.jukebox().playing')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.jukebox().title'), 'My first song')
        self.page.locator('#jukeboxStop').click()

    def test_notes_shop_browsing_and_coin_purse_do_not_spend_or_award_notes(self):
        open_destination(self.page, 'shop')
        before = self.saved_rewards()
        shop = self.page.locator('.notes-shop')
        self.assertEqual(shop.get_attribute('data-shop-view'), 'home')
        for destination in ('categories', 'premium', 'wallet', 'wardrobe'):
            self.assertTrue(self.shop_action(destination).is_visible())
        self.shop_action('categories').click()
        self.page.locator('[data-shop-category="headwear"]').click()
        self.page.evaluate('document.querySelector("#panel").scrollTop=100000')
        self.assertGreater(self.page.locator('#panel').evaluate('node=>node.scrollTop'), 0)
        self.page.keyboard.press('Escape')
        self.assertEqual(self.page.locator('#panel').evaluate('node=>node.scrollTop'), 0)
        self.page.locator('[data-shop-category="headwear"]').click()
        self.page.get_by_label('Search shop', exact=True).fill('witch')
        self.assertEqual(self.page.locator('[data-shop-item="witch"]').count(), 1)
        self.assertIn('80 Notes', self.page.locator('[data-shop-item="witch"]').inner_text())
        self.page.keyboard.press('Escape')
        self.assertEqual(shop.get_attribute('data-shop-view'), 'categories')
        self.page.keyboard.press('Escape')
        self.assertEqual(shop.get_attribute('data-shop-view'), 'home')
        self.shop_action('wallet').click()
        self.assertTrue(self.page.get_by_role('list', name='Notes coin purse').is_visible())
        self.assertEqual(self.saved_rewards(), before)

    def test_boutique_navigation_keeps_try_on_draft_until_cancel(self):
        open_destination(self.page, 'boutique')
        before = self.page.evaluate('CodaArcadeQA.characters().player.appearance')
        saved = self.saved_rewards()
        self.page.locator('[data-boutique-page="hair"]').click()
        self.page.get_by_label('Hair color', exact=True).evaluate(
            "node=>{node.value='#69e0ff';node.dispatchEvent(new Event('input',{bubbles:true}));}")
        self.page.keyboard.press('Escape')
        self.page.locator('[data-boutique-page="clothes"]').click()
        self.page.keyboard.press('Escape')
        self.page.locator('[data-boutique-page="hair"]').click()
        self.assertEqual(self.page.get_by_label('Hair color', exact=True).input_value(), '#69e0ff')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.characters().player.appearance'), before)
        self.assertEqual(self.saved_rewards(), saved)
        self.page.get_by_role('button', name='Cancel', exact=True).click()
        open_destination(self.page, 'boutique')
        self.page.locator('[data-boutique-page="hair"]').click()
        self.assertEqual(self.page.get_by_label('Hair color', exact=True).input_value(), before['hair'])

    def test_scholar_home_routes_without_recording_facts_or_unlocking_quizzes(self):
        scholar = self.scholar()
        before = self.saved_rewards()
        for action in ('pouch', 'record', 'quizzes', 'help'):
            self.assertTrue(scholar.locator('[data-scholar-action="' + action + '"]').is_visible())
        scholar.locator('[data-scholar-action="help"]').click()
        self.page.keyboard.press('Escape')
        self.assertEqual(scholar.get_attribute('data-history-view'), 'scholar')
        scholar.locator('[data-scholar-action="pouch"]').click()
        self.assertIn('empty', scholar.inner_text())
        self.page.keyboard.press('Escape')
        scholar.locator('[data-scholar-action="quizzes"]').click()
        self.assertTrue(scholar.locator('[data-history-quiz="bach"] button').is_disabled())
        self.assertEqual(self.saved_rewards(), before)

    def test_all_four_home_menus_fit_small_phone_width(self):
        self.page.set_viewport_size({'width': 320, 'height': 740})
        for kind in ('dj', 'shop', 'boutique'):
            with self.subTest(menu=kind):
                open_destination(self.page, kind)
                self.assert_fits_width(self.page.locator('#panel'), 320)
                self.assert_fits_width(self.page.locator('#panelBody'), 320)
                self.assertGreaterEqual(self.page.locator('#panel .kids-menu-card:visible').count(), 4)
        scholar = self.scholar()
        self.assert_fits_width(scholar, 320)
        self.assertEqual(scholar.locator('.kids-menu-card').count(), 4)


if __name__ == '__main__':
    unittest.main(verbosity=2)
