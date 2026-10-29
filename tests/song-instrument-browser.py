"""Instrument choice and real note previews in the Simple Song Machine.

Run with Python Playwright and Chromium. External services are blocked; these
checks use isolated guest storage and native Web Audio nodes, never live saves.
"""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
import sys
import threading
import unittest

sys.dont_write_bytecode = True
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
LEVELS = {10: 2, 11: 3, 12: 4, 13: 5, 14: 6, 15: 8, 16: 10, 17: 12}
NAMES = {10: 'Crystal Harp', 11: 'Neon Marimba', 12: 'Cathedral Organ',
         13: 'Glass Choir', 14: 'Velvet Pad', 15: 'Starlight Lead',
         16: 'FM Electric Piano', 17: 'Music Box'}

AUDIO_PROBE = """(()=>{
 const Native=window.AudioContext||window.webkitAudioContext;
 window.songInstrumentAudio={starts:[],gains:[],contexts:[]};
 if(!Native)return;
 class ObservedAudio extends Native{
  constructor(...args){super(...args);songInstrumentAudio.contexts.push(this);}
  createGain(){
   const node=super.createGain(),record={values:[]};songInstrumentAudio.gains.push(record);
   for(const method of ['setValueAtTime','linearRampToValueAtTime','exponentialRampToValueAtTime']){
    const original=node.gain[method].bind(node.gain);
    node.gain[method]=(value,...args)=>{record.values.push(value);return original(value,...args)};
   }
   return node;
  }
  createOscillator(){
   const node=super.createOscillator(),start=node.start.bind(node);
   let frequency=node.frequency.value;
   const set=node.frequency.setValueAtTime.bind(node.frequency);
   node.frequency.setValueAtTime=(value,...args)=>{frequency=value;return set(value,...args)};
   node.start=(...args)=>{songInstrumentAudio.starts.push({kind:'oscillator',type:node.type,
     frequency,context:this.state,time:this.currentTime});return start(...args)};
   return node;
  }
  createBufferSource(){
   const node=super.createBufferSource(),start=node.start.bind(node);
   node.start=(...args)=>{songInstrumentAudio.starts.push({kind:'buffer',
     context:this.state,time:this.currentTime});return start(...args)};
   return node;
  }
 }
 window.AudioContext=ObservedAudio;
 if(window.webkitAudioContext)window.webkitAudioContext=ObservedAudio;
})()"""


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class SongInstrumentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0),
            functools.partial(QuietHandler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(executable_path='/usr/bin/chromium',
            args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = None
        self.errors = []
        self.failures = []
        self.load()

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], 'No uncaught browser errors')
        self.assertEqual(self.failures, [], 'No missing local resources')

    def load(self, width=1440, height=1000, mobile=False):
        if self.context:
            self.context.close()
        self.context = self.browser.new_context(viewport={'width': width, 'height': height},
            is_mobile=mobile, has_touch=mobile)
        self.context.route('https://**/*', lambda route: route.abort())
        self.context.add_init_script(AUDIO_PROBE)
        self.page = self.context.new_page()
        self.page.set_default_timeout(10000)
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('response', lambda response: self.failures.append(response.url)
            if response.status >= 400 and '127.0.0.1' in response.url
            and not response.url.endswith('favicon.ico') else None)
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/song-machine/index.html',
            wait_until='domcontentloaded')
        self.page.wait_for_function('window.songMachineBridge?.getSimpleState')
        self.assertEqual(self.page.evaluate('songMachineBridge.getEditorMode()'), 'simple')

    def song(self):
        return self.page.evaluate('songMachineBridge.get()')

    def cell(self, track, pitch, step):
        return self.page.locator(f'#simpleSongGrid .simple-song-cell[data-track="{track}"]'
            f'[data-pitch="{pitch}"][data-step="{step}"]')

    def option(self, sound):
        return self.page.locator(f'#simpleSoundList [data-sound-option="{sound}"]')

    def open_sounds(self, touch=False):
        if not self.page.locator('#simpleSoundList').is_visible():
            button = self.page.locator('#simpleSoundPicker')
            button.tap() if touch else button.click()
        self.page.locator('#simpleSoundList').wait_for(state='visible')

    def choose(self, sound, touch=False):
        self.open_sounds(touch)
        self.option(sound).tap() if touch else self.option(sound).click()

    def voices(self):
        return self.page.evaluate('songInstrumentAudio.starts')

    def count(self):
        return len(self.voices())

    def new_voices(self, before, count=None):
        self.page.wait_for_function('before=>songInstrumentAudio.starts.length>before', arg=before)
        values = self.voices()[before:]
        if count is not None:
            self.assertEqual(len(values), count, 'One gesture must not audition twice')
        self.assertTrue(all(value['context'] == 'running' for value in values))
        return values

    def unlock_dialog(self):
        return self.page.locator('#simpleUnlockBackdrop[role="dialog"],'
            '#simpleUnlockBackdrop [role="dialog"]')

    def assert_centered(self, dialog):
        bounds = dialog.bounding_box()
        viewport = self.page.viewport_size
        self.assertIsNotNone(bounds)
        self.assertGreaterEqual(bounds['x'], -1)
        self.assertGreaterEqual(bounds['y'], -1)
        self.assertLessEqual(bounds['x'] + bounds['width'], viewport['width'] + 1)
        self.assertLessEqual(bounds['y'] + bounds['height'], viewport['height'] + 1)
        self.assertAlmostEqual(bounds['x'] + bounds['width']/2, viewport['width']/2, delta=18)
        self.assertAlmostEqual(bounds['y'] + bounds['height']/2, viewport['height']/2, delta=35)

    def test_all_eighteen_sounds_change_the_selected_track_in_place_and_undo(self):
        before = self.song()
        self.open_sounds()
        self.assertEqual(self.page.locator('#simpleSoundList [data-sound-option]').count(), 18)
        self.assertFalse(self.page.locator('#settings-panel').is_visible(),
            'Sound selection belongs beside the grid, without opening Song menu')
        self.choose(1)
        changed = self.song()
        self.assertEqual(len(changed['tracks']), 2)
        self.assertEqual(changed['tracks'][0]['sound'], 1)
        self.assertEqual(changed['tracks'][0]['notes'], before['tracks'][0]['notes'])
        self.assertEqual(changed['tracks'][1], before['tracks'][1])
        self.assertEqual(changed['drums'], before['drums'])
        self.page.locator('#simpleUndo').click()
        self.assertEqual(self.song(), before)
        self.page.locator('#simpleInstrument').select_option('2')
        self.choose(8)
        changed = self.song()
        self.assertEqual(changed['tracks'][1]['sound'], 8)
        self.assertEqual(changed['tracks'][0], before['tracks'][0])
        self.assertEqual(changed['tracks'][1]['notes'], before['tracks'][1]['notes'])
        self.page.locator('#simpleUndo').click()
        self.assertEqual(self.song(), before)
        self.page.locator('#songEditorMode').click()
        self.assertEqual(self.page.evaluate('songMachineBridge.getEditorMode()'), 'advanced')
        self.assertEqual(self.song(), before)
        self.page.locator('#songEditorMode').click()
        self.assertEqual(self.song(), before)

    def test_locked_sounds_show_exact_requirements_without_editing_or_playing(self):
        before = self.song()
        before_audio = self.count()
        self.open_sounds()
        unlocked_style = self.option(0).evaluate('node=>({color:getComputedStyle(node).color,opacity:getComputedStyle(node).opacity})')
        for sound, required in LEVELS.items():
            with self.subTest(sound=sound):
                self.open_sounds()
                option = self.option(sound)
                self.assertIn('🔒', option.inner_text())
                self.assertFalse(option.evaluate('node=>node.disabled===true'))
                style = option.evaluate('node=>({color:getComputedStyle(node).color,opacity:getComputedStyle(node).opacity})')
                self.assertNotEqual(style, unlocked_style, 'Locked rows have a visible muted treatment')
                option.click()
                dialog = self.unlock_dialog()
                dialog.wait_for(state='visible')
                text = dialog.inner_text()
                self.assertIn(NAMES[sound], text)
                self.assertRegex(text.lower(), rf'level\s+{required}\b')
                self.assert_centered(dialog)
                self.assertEqual(self.song(), before)
                self.assertEqual(self.count(), before_audio, 'Locked choices never audition')
                self.assertTrue(self.page.locator('#simpleUndo').is_disabled())
                self.page.keyboard.press('Escape')
                self.assertFalse(self.page.locator('#simpleUnlockBackdrop').is_visible())
                self.assertTrue(self.page.evaluate('''()=>document.activeElement?.id==='simpleSoundPicker'||
                  document.activeElement?.dataset.soundOption!==undefined'''))

    def test_grid_insert_erase_keyboard_and_all_drum_rows_audition_real_audio(self):
        self.choose(1)
        self.page.locator('#simpleNotePalette [data-duration="1"]').click()
        for activation in ['mouse-add', 'mouse-erase', 'keyboard-add', 'keyboard-erase']:
            before = self.count()
            note = self.cell('1', 60, 24)
            if activation.startswith('mouse'):
                note.click()
            else:
                note.focus()
                self.page.keyboard.press('Enter' if activation.endswith('add') else 'Space')
            voice = self.new_voices(before, count=1)[0]
            self.assertEqual(voice['kind'], 'oscillator')
            self.assertEqual(voice['type'], 'triangle')
            self.assertAlmostEqual(voice['frequency'], 261.625565, delta=.1)
        self.assertNotIn({'p': 60, 't': 24, 'd': 1}, self.song()['tracks'][0]['notes'])
        gains = self.page.evaluate('songInstrumentAudio.gains.flatMap(gain=>gain.values)')
        self.assertTrue(any(.001 < value < 1 for value in gains), 'Preview gains are audible and bounded')
        for row in range(3):
            for _ in range(2):
                before = self.count()
                self.cell('d'+str(row), 0, 28).click()
                voices = self.new_voices(before)
                self.assertTrue(any(voice['kind'] == ('oscillator' if row == 0 else 'buffer') for voice in voices))
        self.page.locator('#simpleInstrument').select_option('2')
        self.choose(0)
        before = self.count()
        self.cell('2', 48, 28).click()
        voice = self.new_voices(before, count=1)[0]
        self.assertEqual(voice['type'], 'square')
        self.assertAlmostEqual(voice['frequency'], 130.812783, delta=.1)

    def test_earning_a_level_unlocks_an_actual_synthesized_sound_for_cell_preview(self):
        self.page.evaluate("CodaPlayerProgression.create().recordQuest('sound-picker-browser',100)")
        self.choose(10)
        self.assertEqual(self.song()['tracks'][0]['sound'], 10)
        self.assertEqual(len(self.song()['tracks']), 2)
        before = self.count()
        self.cell('1', 62, 24).click()
        voices = self.new_voices(before, count=3)
        self.assertEqual(sorted(voice['type'] for voice in voices), ['sine', 'sine', 'triangle'])
        frequencies = sorted(voice['frequency'] for voice in voices)
        for actual, expected in zip(frequencies, [293.664768, 587.329536, 880.994304]):
            self.assertAlmostEqual(actual, expected, delta=.1)
        self.assertEqual(self.page.evaluate('songMachineBridge.progression().xp'), 100,
            'Choosing and previewing a voice does not award composition XP')

    def test_keyboard_picker_navigation_and_unlock_dialog_restore_focus(self):
        before = self.song()
        self.page.locator('#simpleSoundPicker').focus()
        self.page.keyboard.press('Enter')
        self.page.keyboard.press('End')
        self.assertEqual(self.page.evaluate('document.activeElement?.dataset.soundOption'), '17')
        self.page.keyboard.press('Enter')
        dialog = self.unlock_dialog()
        dialog.wait_for(state='visible')
        for key in ['Tab', 'Shift+Tab']:
            self.page.keyboard.press(key)
            self.assertTrue(self.page.evaluate("!!document.activeElement?.closest('#simpleUnlockBackdrop')"))
        self.page.keyboard.press('Escape')
        self.assertFalse(self.page.locator('#simpleUnlockBackdrop').is_visible())
        self.page.keyboard.press('Escape')
        self.assertFalse(self.page.locator('#simpleSoundList').is_visible())
        self.assertEqual(self.page.evaluate('document.activeElement?.id'), 'simpleSoundPicker')
        self.open_sounds()
        self.page.keyboard.press('Home')
        self.page.keyboard.press('ArrowDown')
        self.assertEqual(self.page.evaluate('document.activeElement?.dataset.soundOption'), '1')
        self.page.keyboard.press('Enter')
        self.assertEqual(self.song()['tracks'][0]['sound'], 1)
        self.assertEqual(self.song()['tracks'][0]['notes'], before['tracks'][0]['notes'])

    def test_phone_and_landscape_touch_picker_dialog_and_grid_preview_fit(self):
        for width, height in [(390, 844), (844, 390)]:
            with self.subTest(width=width):
                self.load(width, height, True)
                picker = self.page.locator('#simpleSoundPicker')
                self.assertGreaterEqual(picker.bounding_box()['height'], 44)
                self.open_sounds(touch=True)
                self.option(17).tap()
                self.assert_centered(self.unlock_dialog())
                self.page.locator('#simpleUnlockClose').tap()
                self.choose(1, touch=True)
                cell = self.cell('1', 72, 24)
                cell.scroll_into_view_if_needed()
                before = self.count()
                cell.tap()
                voice = self.new_voices(before, count=1)[0]
                self.assertEqual(voice['type'], 'triangle')
                self.assertAlmostEqual(voice['frequency'], 523.25113, delta=.1)
                self.assertIn({'p': 72, 't': 24, 'd': 4}, self.song()['tracks'][0]['notes'])
                before = self.count()
                self.cell('1', 72, 24).tap()
                self.new_voices(before, count=1)
                self.assertNotIn({'p': 72, 't': 24, 'd': 4}, self.song()['tracks'][0]['notes'])
                self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width+1)
                self.page.screenshot(path=f'/tmp/song-instruments-{width}.png')


if __name__ == '__main__':
    unittest.main(verbosity=2)
