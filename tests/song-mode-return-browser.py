"""Both composer views keep an obvious way back without changing the song."""
import copy
import importlib.util
from pathlib import Path
import unittest

_spec=importlib.util.spec_from_file_location('mode_song_fixture',Path(__file__).with_name('song-simple-browser.py'))
_fixture=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_fixture)


class SongModeReturnTests(unittest.TestCase):
    setUpClass=classmethod(_fixture.SongSimpleTests.setUpClass.__func__)
    tearDownClass=classmethod(_fixture.SongSimpleTests.tearDownClass.__func__)
    setUp=_fixture.SongSimpleTests.setUp
    tearDown=_fixture.SongSimpleTests.tearDown
    load=_fixture.SongSimpleTests.load
    song=_fixture.SongSimpleTests.song
    cell=_fixture.SongSimpleTests.cell

    def switch(self,destination):
        action=self.page.get_by_role('button',name='Switch to '+destination+' mode',exact=True)
        self.assertTrue(action.is_visible())
        action.click()
        self.assertEqual(self.page.evaluate('songMachineBridge.getEditorMode()'),destination.lower())

    def test_saved_advanced_view_has_a_clear_visible_return_to_simple(self):
        self.assertEqual(self.page.evaluate('songMachineBridge.getEditorMode()'),'simple')
        self.switch('Advanced')
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('window.songMachineBridge?.getEditorMode')
        self.assertEqual(self.page.evaluate('songMachineBridge.getEditorMode()'),'advanced')
        button=self.page.get_by_role('button',name='Switch to Simple mode',exact=True)
        bounds=button.bounding_box()
        self.assertGreaterEqual(bounds['y'],0)
        self.assertLessEqual(bounds['y']+bounds['height'],1000)
        self.assertTrue(button.evaluate('node=>!!(node.compareDocumentPosition(document.querySelector(".song-master-volume"))&Node.DOCUMENT_POSITION_FOLLOWING)'))
        self.switch('Simple')
        self.assertTrue(self.page.locator('#simpleSongEditor').is_visible())
        self.assertFalse(self.page.locator('#tracks').is_visible())

    def test_mode_changes_keep_notes_instruments_settings_draft_volume_and_undo(self):
        self.cell('1',60,16).click();self.cell('d1',0,16).click()
        self.page.locator('#simpleBpm').evaluate('node=>{node.value="132";node.dispatchEvent(new Event("input",{bubbles:true}));}')
        self.page.locator('#simpleSoundPicker').click()
        self.page.locator('[data-sound-option="7"]').click()
        self.page.locator('#songMasterVolume').evaluate('node=>{node.value="37";node.dispatchEvent(new Event("input",{bubbles:true}));}')
        before=self.song()
        self.switch('Advanced')
        self.page.locator('select[data-action="clef"][data-id="1"]').select_option('bass')
        self.page.locator('input[data-action="volume"][data-id="1"]').evaluate('node=>{node.value="56";node.dispatchEvent(new Event("change",{bubbles:true}));}')
        self.page.locator('input[data-action="mute"][data-id="1"]').check()
        changed=self.song();draft=self.page.evaluate('localStorage.getItem("codaSongMachineDraftV1")')
        self.assertEqual(changed['bpm'],132);self.assertEqual(changed['tracks'][0]['sound'],7)
        self.assertEqual(changed['tracks'][0]['clef'],'bass');self.assertAlmostEqual(changed['tracks'][0]['volume'],.56)
        self.assertTrue(changed['tracks'][0]['mute'])
        self.switch('Simple')
        self.assertEqual(self.song(),changed)
        self.assertEqual(self.page.evaluate('localStorage.getItem("codaSongMachineDraftV1")'),draft)
        self.assertEqual(self.page.evaluate('songMachineBridge.getMasterVolume()'),37)
        self.page.locator('#simpleUndo').click()
        expected=copy.deepcopy(changed);expected['tracks'][0]['mute']=False
        self.assertEqual(self.song(),expected,'View changes must not enter the Undo history')
        self.switch('Advanced');self.page.locator('#undo').click()
        expected['tracks'][0]['volume']=before['tracks'][0]['volume'];self.assertEqual(self.song(),expected)
        self.switch('Simple')
        self.assertEqual(self.song(),expected)
        self.assertEqual(self.page.evaluate('JSON.parse(localStorage.getItem("codaSongMachineDraftV1")).composition'),expected)

    def test_return_control_fits_phone_and_landscape_and_supports_keyboard(self):
        for width,height in [(320,780),(390,844),(844,390)]:
            self.load(width,height,True);original=self.song()
            for destination in ['Advanced','Simple','Advanced','Simple']:
                action=self.page.get_by_role('button',name='Switch to '+destination+' mode',exact=True)
                bounds=action.bounding_box()
                self.assertGreaterEqual(bounds['width'],44);self.assertGreaterEqual(bounds['height'],44)
                self.assertGreaterEqual(bounds['x'],0);self.assertGreaterEqual(bounds['y'],0)
                self.assertLessEqual(bounds['x']+bounds['width'],width)
                self.assertLessEqual(bounds['y']+bounds['height'],height)
                self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
                action.focus();self.page.keyboard.press('Enter')
                self.assertEqual(self.page.evaluate('songMachineBridge.getEditorMode()'),destination.lower())
                self.assertEqual(self.song(),original)
                self.assertEqual(self.page.locator('#songEditorMode').count(),1)
                self.assertEqual(self.page.locator('#simpleSongEditor').count(),1)
            self.switch('Advanced')
            if width==390:self.page.screenshot(path='/tmp/song-mode-return-phone.png')

    def test_switching_views_does_not_restart_or_stop_playback(self):
        self.page.locator('#simplePlay').click()
        self.page.wait_for_function('document.querySelector("#status").textContent.includes("Playing")')
        self.switch('Advanced')
        self.assertIn('Playing',self.page.locator('#status').inner_text())
        self.switch('Simple')
        self.assertIn('Playing',self.page.locator('#simpleStatus').inner_text())
        self.page.locator('#simpleStop').click()
        self.assertIn('Stopped',self.page.locator('#simpleStatus').inner_text())


if __name__=='__main__':unittest.main(verbosity=2)
