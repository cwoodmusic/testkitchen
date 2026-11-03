"""Use the arcade's physical exit without clearing its same-tab progress."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location(
    'arcade_exit_world_fixture', Path(__file__).with_name('fishing-world-browser.py'))
_fish = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_fish)


class ArcadeExitTests(_fish._world.WorldBrowserCase):
    setUp = _fish.FishingWorldTests.setUp
    place = _fish.FishingWorldTests.place

    def approach_exit(self):
        point = self.page.evaluate('CodaArcadeExit.TARGET')
        self.place(point['x'], point['y'] - 28)
        self.page.clock.run_for(96)
        state = self.page.evaluate('CodaArcadeQA.arcadeExit()')
        self.assertTrue(state['near'])
        self.assertTrue(state['enabled'])
        self.assertIn('world-preview.html', self.page.url,
                      'Walking up to the exit must not navigate by itself')

    def layout_record(self):
        return self.page.evaluate('''() => new Promise((resolve,reject) => {
 const request=indexedDB.open('codaArcadeAssetStudioDB',1);
 request.onerror=()=>reject(request.error);
 request.onsuccess=()=>{const db=request.result,tx=db.transaction('layouts','readonly'),get=tx.objectStore('layouts').get('codaWorldProjectV1');
  get.onsuccess=()=>resolve(JSON.stringify(get.result));tx.oncomplete=()=>db.close();};
})''')

    def seed_layout(self):
        stored = self.page.evaluate('''() => new Promise((resolve,reject) => {
 const project=CodaDeveloperConsole.getProject();project.assets[0].name='My saved exit-check layout';
 const request=indexedDB.open('codaArcadeAssetStudioDB',1);
 request.onerror=()=>reject(request.error);
 request.onsuccess=()=>{const db=request.result,tx=db.transaction('layouts','readwrite'),record={...project,savedAt:123456789};
  tx.objectStore('layouts').put(record,'codaWorldProjectV1');tx.oncomplete=()=>{db.close();resolve(JSON.stringify(record));};tx.onerror=()=>reject(tx.error);};
})''')
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('CodaDeveloperConsole?.ready()&&CodaArcadeQA?.arcadeExit()')
        self.page.clock.run_for(96)
        self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProjectSource()'), 'local')
        return stored

    def test_keyboard_exit_returns_to_title_and_preserves_progress_and_saved_layout(self):
        stored = self.seed_layout()
        journal = '{"version":1,"catches":[{"id":"exit-preserve","fishId":"silver-minnow","size":12,"rewarded":true}]}'
        self.page.evaluate('value=>localStorage.setItem("codaRhythmFishingV1",value)', journal)
        self.approach_exit()
        self.page.keyboard.press('e')
        self.page.wait_for_url('**/coda-arcade/index.html')
        self.page.locator('#titleGuest').wait_for(state='visible')
        self.assertEqual(self.page.evaluate('location.search+location.hash'), '')
        self.assertEqual(self.page.evaluate('localStorage.getItem("codaRhythmFishingV1")'), journal)
        self.assertEqual(self.layout_record(), stored, 'Returning to title must not rewrite a saved world')
        self.page.go_back(wait_until='domcontentloaded')
        self.page.wait_for_function('CodaDeveloperConsole?.ready()&&CodaArcadeQA?.arcadeExit()')
        self.approach_exit()
        self.page.keyboard.press('e')
        self.page.wait_for_url('**/coda-arcade/index.html')
        self.page.locator('#titleGuest').wait_for(state='visible')
        self.assertEqual(self.page.evaluate('localStorage.getItem("codaRhythmFishingV1")'), journal)
        self.assertEqual(self.layout_record(), stored, 'A repeated exit after browser Back keeps the same layout')

    def test_exit_requires_proximity_and_does_not_interrupt_menus_editing_or_typing(self):
        self.place(1180, 620)
        self.assertFalse(self.page.evaluate('CodaArcadeQA.arcadeExit().near'))
        self.page.keyboard.press('e')
        self.assertIn('world-preview.html', self.page.url)
        if self.page.locator('#dialog').is_visible():
            self.page.locator('#close').click()
        self.approach_exit()
        self.page.locator('#worldMenuBtn').click()
        self.page.keyboard.press('e')
        self.assertIn('world-preview.html', self.page.url)
        self.page.keyboard.press('Escape')
        self.page.locator('#view').focus()
        self.page.keyboard.press('F2')
        self.page.clock.run_for(96)
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.getState().editing'))
        self.page.keyboard.press('e')
        self.assertIn('world-preview.html', self.page.url)
        self.page.keyboard.press('F2')
        self.page.clock.run_for(96)
        self.assertFalse(self.page.evaluate('CodaDeveloperConsole.getState().editing'))
        self.page.evaluate('''() => { const input=document.createElement('input');input.id='exitTypingCheck';document.body.append(input);input.focus(); }''')
        self.page.keyboard.press('e')
        self.assertEqual(self.page.locator('#exitTypingCheck').input_value(), 'e')
        self.assertIn('world-preview.html', self.page.url)

    def test_interact_labels_the_exit_and_returns_to_title_phone(self):
        self.approach_exit()
        button = self.page.locator('.coda-touch-interact')
        self.assertTrue(button.is_visible())
        self.assertIn('Exit', button.inner_text())
        button.tap()
        self.page.wait_for_url('**/coda-arcade/index.html')
        self.page.locator('#titleGuest').wait_for(state='visible')


if __name__ == '__main__':
    unittest.main(verbosity=2)
