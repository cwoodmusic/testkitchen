"""Song imports, part history and audible-end scheduling in disposable browsers."""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode=True
_spec=importlib.util.spec_from_file_location('song_audit_fixture',Path(__file__).with_name('song-simple-browser.py'))
fixture=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(fixture)


class SongAuditTests(unittest.TestCase):
    setUpClass=classmethod(fixture.SongSimpleTests.setUpClass.__func__)
    tearDownClass=classmethod(fixture.SongSimpleTests.tearDownClass.__func__)
    setUp=fixture.SongSimpleTests.setUp
    tearDown=fixture.SongSimpleTests.tearDown
    load=fixture.SongSimpleTests.load
    song=fixture.SongSimpleTests.song
    cell=fixture.SongSimpleTests.cell

    def test_invalid_file_and_bridge_imports_keep_the_live_song_and_history_unchanged(self):
        original=self.song()
        for mutate in ('notes','sound','duplicate'):
            bad=copy.deepcopy(original)
            if mutate=='notes':bad['tracks'][0]['notes']=None
            elif mutate=='sound':bad['tracks'][0]['sound']=999
            else:bad['tracks'][1]['id']=bad['tracks'][0]['id']
            result=self.page.evaluate('''song=>{try{songMachineBridge.load(song);return false;}catch{return true;}}''',bad)
            self.assertTrue(result)
            self.assertEqual(self.song(),original)
            self.assertTrue(self.page.locator('#simpleUndo').is_disabled())
        bad=copy.deepcopy(original);bad['tracks'][0]['volume']=3
        self.page.locator('#file').set_input_files({'name':'broken-song.json','mimeType':'application/json','buffer':json.dumps(bad).encode()})
        self.page.wait_for_function('document.querySelector("#status").textContent.includes("Could not load composition")')
        self.assertEqual(self.song(),original)
        self.assertTrue(self.page.locator('#simpleUndo').is_disabled())
        self.page.locator('#file').set_input_files({'name':'too-large.json','mimeType':'application/json','buffer':b' '*(2*1024*1024+1)})
        self.page.wait_for_function('document.querySelector("#status").textContent.includes("2 MB")')
        self.assertEqual(self.song(),original)
        self.cell('1',60,16).click()
        self.assertIn({'p':60,'t':16,'d':4},self.song()['tracks'][0]['notes'],
                      'A rejected file must leave the actual grid usable')

    def test_imported_part_names_render_as_text_instead_of_active_html(self):
        imported=self.song()
        name='<img src=x onerror="window.songImportProbe=1">'
        imported['tracks'][0]['name']=name
        self.page.evaluate('song=>songMachineBridge.load(song)',imported)
        self.page.locator('#songEditorMode').click()
        self.assertEqual(self.page.locator('#tracks>.track').first.locator('.track-head>strong').inner_text(),name)
        self.assertEqual(self.page.locator('#tracks img').count(),0)
        self.assertIsNone(self.page.evaluate('window.songImportProbe??null'))
        self.assertEqual(self.song(),imported)

    def test_import_after_an_edit_does_not_award_experience_for_an_imported_song(self):
        self.cell('1',60,16).click();self.cell('1',62,20).click()
        imported=self.song();imported['tracks'][0]['name']='Imported melody'
        self.page.evaluate('song=>songMachineBridge.load(song)',imported)
        self.page.locator('#simplePlay').click()
        self.assertEqual(self.page.evaluate('songMachineBridge.progression().xp'),0)
        self.page.locator('#simpleStop').click()
        self.cell('1',64,24).click();self.page.locator('#simplePlay').click()
        self.page.wait_for_function('songMachineBridge.progression().xp===35')
        self.page.locator('#simpleStop').click()

    def test_advanced_part_settings_use_the_same_undo_history(self):
        self.page.locator('#songEditorMode').click();original=self.song()
        for label,value,field,expected in [('Melody sound','7','sound',7),('Melody clef','bass','clef','bass')]:
            self.page.get_by_label(label,exact=True).select_option(value)
            self.assertEqual(self.song()['tracks'][0][field],expected)
            self.page.locator('#undo').click();self.assertEqual(self.song(),original)
        self.page.get_by_label('Melody volume',exact=True).evaluate("input=>{input.value='25';input.dispatchEvent(new Event('change',{bubbles:true}));}")
        self.assertEqual(self.song()['tracks'][0]['volume'],.25)
        self.page.locator('#undo').click();self.assertEqual(self.song(),original)
        self.page.locator('[data-action="mute"][data-id="1"]').check()
        self.assertTrue(self.song()['tracks'][0]['mute'])
        self.page.locator('#undo').click();self.assertEqual(self.song(),original)
        self.page.get_by_label('Hi-hat sound',exact=True).select_option('3')
        self.assertEqual(self.song()['drums'][2]['sound'],3)
        self.page.locator('#undo').click();self.assertEqual(self.song(),original)

    def test_zero_volume_parts_do_not_schedule_sounding_voices(self):
        self.context.add_init_script('''(()=>{
          window.songAuditVoices=0;const Base=window.AudioContext;
          window.AudioContext=class extends Base{
            createOscillator(){songAuditVoices++;return super.createOscillator();}
            createBufferSource(){songAuditVoices++;return super.createBufferSource();}
          };
        })()''')
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_function('window.songMachineBridge')
        song=self.song()
        for track in song['tracks']+song['drums']:track['volume']=0
        song['tracks'][1]['sound']=10
        self.page.evaluate('song=>songMachineBridge.load(song)',song)
        self.page.locator('#simplePlay').click()
        self.page.wait_for_function('document.querySelector("#status").textContent.includes("Playing")')
        self.assertEqual(self.page.evaluate('songAuditVoices'),0)
        self.page.locator('#simpleStop').click()
        song['tracks'][0]['volume']=.5
        self.page.evaluate('song=>songMachineBridge.load(song)',song)
        self.page.locator('#simplePlay').click()
        self.page.wait_for_function('songAuditVoices>0')
        self.page.locator('#simpleStop').click()

    def test_nonloop_transport_waits_for_the_written_end_before_stopping_sources(self):
        self.context.add_init_script('''(()=>{
          window.songAuditAudioClock=0;window.songAuditStops=[];window.songAuditStarts=[];
          const Base=window.AudioContext;
          window.AudioContext=class extends Base{
            constructor(...args){super(...args);Object.defineProperty(this,'currentTime',{get:()=>songAuditAudioClock});}
            createOscillator(){const node=super.createOscillator(),start=node.start.bind(node),stop=node.stop.bind(node);
              node.start=time=>{songAuditStarts.push(time);return start(time)};
              node.stop=time=>{songAuditStops.push(time===undefined?'now':time);return stop(time)};return node;}
          };
        })()''')
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_function('window.songMachineBridge')
        song=self.song();song.update(bpm=240,bars=1)
        song['tracks']=song['tracks'][:1];song['tracks'][0]['notes']=[{'p':72,'t':15,'d':1}]
        for drum in song['drums']:drum['notes']=[]
        self.page.evaluate('song=>songMachineBridge.load(song)',song)
        self.page.locator('#simplePlay').click()
        # One 4/4 bar at 240 BPM lasts1second and starts at audioTime.06.
        # The .15slookahead reaches that end while actualtime isstill.94.
        self.page.evaluate('songAuditAudioClock=.94')
        self.page.wait_for_function('songAuditStarts.length===1')
        self.assertIn('Playing',self.page.locator('#status').inner_text())
        self.assertNotIn('now',self.page.evaluate('songAuditStops'))
        self.page.evaluate('songAuditAudioClock=1.08')
        self.page.wait_for_function('document.querySelector("#status").textContent==="Stopped."')
        self.assertIn('now',self.page.evaluate('songAuditStops'))


if __name__=='__main__':unittest.main(verbosity=2)
