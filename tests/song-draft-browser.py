"""Real Song Machine edits survive closing and reload, without crossing profiles."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
KEY='codaSongMachineDraftV1'


def fixture(name,filename):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(filename))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module


_simple=fixture('draft_song_fixture','song-simple-browser.py')
_world=fixture('draft_world_fixture','learning-world-browser.py')


class SongDraftTests(unittest.TestCase):
    setUpClass=classmethod(_simple.SongSimpleTests.setUpClass.__func__)
    tearDownClass=classmethod(_simple.SongSimpleTests.tearDownClass.__func__)
    setUp=_simple.SongSimpleTests.setUp
    tearDown=_simple.SongSimpleTests.tearDown
    load=_simple.SongSimpleTests.load
    song=_simple.SongSimpleTests.song
    cell=_simple.SongSimpleTests.cell

    def draft(self):
        return self.page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))?.composition',KEY)

    def reload(self):
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('window.songMachineBridge?.get')

    def change(self,selector,value,event='change'):
        self.page.locator(selector).evaluate('''(input,details)=>{
          input.value=String(details.value);input.dispatchEvent(new Event(details.event,{bubbles:true}));
        }''',{'value':value,'event':event})

    def test_simple_notes_drums_sound_bpm_and_undo_restore_after_reload(self):
        initial=self.song()
        self.assertIsNone(self.page.evaluate('(key)=>localStorage.getItem(key)',KEY))
        for _ in range(2):self.page.locator('#songEditorMode').click()
        self.assertIsNone(self.page.evaluate('(key)=>localStorage.getItem(key)',KEY),'View changes should not create a draft')
        self.cell('1',60,16).click();self.cell('d1',0,20).click()
        self.page.locator('#simpleSoundPicker').click()
        self.page.locator('#simpleSoundList [data-sound-option="7"]').click()
        self.change('#bpm',143,'input')
        expected=self.song();self.assertNotEqual(expected,initial);self.assertEqual(self.draft(),expected)
        self.reload();self.assertEqual(self.song(),expected);self.assertIn('saved song',self.page.locator('#status').inner_text())
        self.assertEqual(self.page.locator('#bpm').input_value(),'143')
        self.cell('1',65,24).click();self.assertNotEqual(self.draft(),expected)
        self.page.locator('#simpleUndo').click();self.assertEqual(self.draft(),expected)
        self.reload();self.assertEqual(self.song(),expected)

    def test_advanced_volume_mute_clef_clear_and_undo_are_all_durable(self):
        self.page.locator('#songEditorMode').click()
        self.change('[data-action="volume"][data-id="1"]',31)
        self.change('[data-action="clef"][data-id="1"]','bass')
        self.page.locator('[data-action="mute"][data-id="d2"]').check()
        expected=self.song();self.assertEqual(self.draft(),expected)
        self.assertEqual(expected['tracks'][0]['volume'],.31);self.assertEqual(expected['tracks'][0]['clef'],'bass');self.assertTrue(expected['drums'][2]['mute'])
        clear=self.page.locator('[data-clear="1"]');clear.focus();self.page.keyboard.down('Enter')
        self.page.wait_for_function('songMachineBridge.get().tracks[0].notes.length===0',timeout=4500)
        self.page.keyboard.up('Enter');self.assertEqual(self.draft()['tracks'][0]['notes'],[])
        self.page.locator('#undo').click();self.assertEqual(self.draft(),expected)
        self.reload();self.assertEqual(self.song(),expected)
        self.assertTrue(self.page.locator('[data-action="mute"][data-id="d2"]').is_checked())
        self.assertEqual(self.page.locator('[data-action="clef"][data-id="1"]').input_value(),'bass')

    def test_import_and_jukebox_load_replace_current_draft_and_keep_hidden_notes(self):
        imported=copy.deepcopy(self.song());imported.update({'bpm':92,'bars':1,'meter':'2/4'})
        imported['tracks'][0].update({'sound':17,'clef':'bass','notes':[{'p':36,'t':0,'d':8},{'p':96,'t':240,'d':4}]})
        self.page.locator('#file').set_input_files({'name':'draft-song.json','mimeType':'application/json','buffer':json.dumps(imported).encode()})
        self.page.wait_for_function('songMachineBridge.get().bpm===92')
        self.assertEqual(self.draft(),imported);self.reload();self.assertEqual(self.song(),imported)
        cloud=copy.deepcopy(imported);cloud['bpm']=156;cloud['tracks'][0]['name']='My jukebox tune'
        self.page.evaluate('value=>songMachineBridge.load(value)',cloud)
        self.assertEqual(self.draft(),cloud);self.reload();self.assertEqual(self.song(),cloud)
        self.page.locator('#file').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{invalid'})
        self.page.wait_for_function('document.querySelector("#status").textContent.includes("Could not load")')
        self.assertEqual(self.song(),cloud);self.assertEqual(self.draft(),cloud)

    def test_corruption_quota_and_unavailable_storage_do_not_break_editing(self):
        self.page.evaluate('(key)=>localStorage.setItem(key,"broken draft bytes")',KEY)
        self.reload();self.assertEqual(self.page.evaluate('(key)=>localStorage.getItem(key)',KEY),'broken draft bytes')
        self.assertIn('could not be opened',self.page.locator('#songDraftStatus').inner_text())
        self.cell('1',60,16).click();self.assertEqual(self.draft(),self.song())
        previous=self.page.evaluate('(key)=>localStorage.getItem(key)',KEY)
        self.page.evaluate('''()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){
          if(key==='codaSongMachineDraftV1')throw new DOMException('Storage full','QuotaExceededError');return set.call(this,key,value);
        };}''')
        self.cell('1',65,20).click();self.assertEqual(self.page.evaluate('(key)=>localStorage.getItem(key)',KEY),previous)
        self.assertIn({'p':65,'t':20,'d':4},self.song()['tracks'][0]['notes'])
        self.assertIn('Export a JSON copy',self.page.locator('#songDraftStatus').inner_text());self.assertTrue(self.page.locator('#songDraftStatus').is_visible())
        self.context.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Denied','SecurityError')}})")
        self.reload();self.assertEqual(len(self.song()['tracks']),2)
        self.cell('1',60,16).click();self.assertIn({'p':60,'t':16,'d':4},self.song()['tracks'][0]['notes'])
        self.assertIn('saving is unavailable',self.page.locator('#songDraftStatus').inner_text())


class SongDraftWorldTests(_world.WorldBrowserCase):
    def song_frame(self):
        index=self.page.evaluate('CodaArcadeQA.worldObjects().find(object=>/song/i.test(object.game?.name))?.game.index')
        self.assertIsNotNone(index)
        _world.open_cabinet(self.page,index)
        frame=self.page.locator('#gameiframe').element_handle().content_frame()
        frame.wait_for_function('window.songMachineBridge?.get')
        return frame

    def test_cabinet_close_reopen_page_reload_and_profile_clearing(self):
        frame=self.song_frame()
        frame.locator('#simpleSongGrid .simple-song-cell[data-track="1"][data-pitch="60"][data-step="16"]').click()
        expected=frame.evaluate('songMachineBridge.get()')
        self.page.locator('#returnworld').click();frame=self.song_frame()
        self.assertEqual(frame.evaluate('songMachineBridge.get()'),expected)
        self.page.locator('#returnworld').click();self.load();frame=self.song_frame()
        self.assertEqual(frame.evaluate('songMachineBridge.get()'),expected)
        self.page.locator('#returnworld').click()
        result=self.page.evaluate('CodaClassroomProfileData.apply(localStorage,CodaClassroomProfileData.blank())')
        self.assertTrue(result['ok'])
        self.assertIsNone(self.page.evaluate('(key)=>localStorage.getItem(key)',KEY))
        frame=self.song_frame()
        self.assertNotEqual(frame.evaluate('songMachineBridge.get()'),expected,'A new student must not inherit the preceding student’s song')
        self.assertFalse(frame.evaluate('songMachineBridge.get().tracks[0].notes.some(note=>note.p===60&&note.t===16)'))


if __name__=='__main__':unittest.main(verbosity=2)
