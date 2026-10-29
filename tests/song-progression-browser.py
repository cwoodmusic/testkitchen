"""Verify real Song Machine sound unlocks, synthesis, and import compatibility."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest
import re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

class SongProgressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.playwright=sync_playwright().start()
        cls.browser=cls.playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.playwright.stop();cls.server.shutdown();cls.server.server_close()
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1400,'height':1000})
        self.context.route('https://**/*',lambda route:route.abort())
        self.context.add_init_script('''(()=>{
          window.testVoices=[];window.testAudioContexts=[];
          const Original=window.AudioContext;
          window.AudioContext=class extends Original{
            constructor(...args){super(...args);testAudioContexts.push(this);}
            createOscillator(){const voice=super.createOscillator(),start=voice.start.bind(voice),setFrequency=voice.frequency.setValueAtTime.bind(voice.frequency);let scheduledFrequency=440;voice.frequency.setValueAtTime=(value,...args)=>{scheduledFrequency=value;return setFrequency(value,...args);};
              voice.start=(...args)=>{testVoices.push({type:voice.type,frequency:scheduledFrequency});return start(...args);};return voice;}
          };
        })()''')
        self.page=self.context.new_page();self.errors=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/song-machine/index.html',wait_until='domcontentloaded')
        self.page.wait_for_function('window.songMachineBridge&&window.CodaSongSounds')
        self.page.evaluate("songMachineBridge.setEditorMode('advanced')")
    def tearDown(self):
        self.context.close();self.assertEqual(self.errors,[])
    def test_pitch_labels_use_letters_and_friendly_ranges_without_changing_song_pitches(self):
        labels=self.page.locator('#tracks>.track').first.locator('.pitch-label')
        text=labels.all_inner_texts()
        self.assertTrue(all(re.fullmatch(r'[A-G][♯♭]?',value) for value in text),text)
        hints=labels.evaluate_all('(nodes)=>nodes.map(node=>node.title)')
        self.assertTrue(all(not re.search(r'[A-G][♯♭]?\d',value) for value in hints),hints)
        for hint in ['C, low notes','C, middle notes','C, high notes','C, highest note']:
            self.assertIn(hint,hints)
        before=self.page.evaluate('songMachineBridge.get()')
        self.assertEqual([note['p'] for note in before['tracks'][0]['notes']],[72,74,76,79])
        self.page.evaluate('''()=>{const song=songMachineBridge.get();song.tracks[0].notes=[{p:61,t:0,d:4},{p:73,t:4,d:4}];songMachineBridge.load(song);}''')
        self.assertEqual([note['p'] for note in self.page.evaluate('songMachineBridge.get()')['tracks'][0]['notes']],[61,73])

    def test_starter_instruments_stay_available_and_bonus_sounds_show_level_locks(self):
        options=self.page.get_by_label('Melody sound').locator('option')
        self.assertEqual(options.count(),18)
        self.assertEqual(options.evaluate_all('(list)=>list.filter(option=>option.disabled).length'),8)
        self.assertIn('Level 2',options.nth(10).inner_text())
        self.page.locator('#add').click();self.assertEqual(self.page.locator('#tracks>.track').count(),3)
        self.page.locator('#undo').click();self.assertEqual(self.page.locator('#tracks>.track').count(),2)
        self.assertIn('0 / 8',self.page.locator('#song-level-summary').inner_text())
    def test_earning_a_level_unlocks_a_real_playable_instrument_and_survives_reload(self):
        self.page.evaluate("CodaPlayerProgression.create().recordQuest('browser-piano-melody',100)")
        self.assertFalse(self.page.get_by_label('Melody sound').locator('option[value="10"]').evaluate('(option)=>option.disabled'))
        self.assertTrue(self.page.get_by_label('Melody sound').locator('option[value="11"]').evaluate('(option)=>option.disabled'))
        self.page.get_by_label('Melody sound').select_option('10')
        self.page.locator('#play').click();self.page.wait_for_function('testVoices.length>=3')
        voices=self.page.evaluate('testVoices')
        self.assertTrue(any(abs(voice['frequency']-1046.5)<5 for voice in voices),voices)
        self.assertEqual(self.page.evaluate('testAudioContexts[0].state'),'running')
        self.page.locator('#stop').click();self.assertIn('Stopped',self.page.locator('#status').inner_text())
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_function('window.songMachineBridge');self.page.evaluate("songMachineBridge.setEditorMode('advanced')")
        self.assertIn('level 2',self.page.locator('#song-level-summary').inner_text())
        self.assertFalse(self.page.get_by_label('Melody sound').locator('option[value="10"]').evaluate('(option)=>option.disabled'))
    def test_imported_bonus_voices_are_preserved_and_a_selection_lock_cannot_replace_them(self):
        self.page.evaluate('''()=>{const song=songMachineBridge.get();song.tracks[0].sound=17;
          songMachineBridge.load(song);}''')
        self.assertEqual(self.page.get_by_label('Melody sound').input_value(),'17')
        self.page.locator('#play').click();self.page.wait_for_function('testVoices.length>=3')
        self.assertEqual(self.page.evaluate('songMachineBridge.get().tracks[0].sound'),17)
        self.assertEqual(self.page.evaluate('songMachineBridge.progression().xp'),0,'Opening and playing an imported song must not grant unearned composition XP')
        self.page.locator('#stop').click()
        self.page.get_by_label('Melody sound').evaluate("select=>{select.value='16';select.dispatchEvent(new Event('change',{bubbles:true}));}")
        self.assertEqual(self.page.evaluate('songMachineBridge.get().tracks[0].sound'),17)
        self.assertIn('level 10',self.page.locator('#status').inner_text())
    def test_composing_and_playing_real_edits_earns_xp_once_for_that_composition(self):
        self.page.locator('#tracks .cell[data-track="1"][data-pitch="72"][data-step="16"]').click()
        self.page.locator('#tracks .cell[data-track="1"][data-pitch="74"][data-step="20"]').click()
        self.assertEqual(self.page.evaluate('songMachineBridge.get().tracks.reduce((n,t)=>n+t.notes.length,0)'),8)
        self.page.locator('#play').click();self.page.wait_for_function('songMachineBridge.progression().xp===35')
        self.page.locator('#stop').click();self.page.locator('#play').click()
        self.assertEqual(self.page.evaluate('songMachineBridge.progression().xp'),35)
        self.page.locator('#stop').click()

if __name__=='__main__':unittest.main(verbosity=2)
