"""Real-UI empty-room, explicit save, resize, and clear-area workflows.

Run: python studio/tests/workspace-browser.py
Only disposable local projects and generated images are authored.
"""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import unittest

from PIL import Image

SPEC = importlib.util.spec_from_file_location('studio_workspace_helpers', Path(__file__).with_name('studio-browser.py'))
base = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(base)
OUT = base.ROOT.parent / '.onboarding' / 'pixel-studio' / 'workspace'
OUT.mkdir(parents=True, exist_ok=True)
base.OUT = OUT
base.RESULTS = []
Helpers = type('StudioWorkspaceHelpers', (unittest.TestCase,), {
    key: value for key, value in base.StudioBrowserTests.__dict__.items()
    if not key.startswith('test_') and key not in ('__dict__', '__weakref__')})


class WorkspaceBrowserTests(Helpers):
    def tearDown(self):
        self.page.screenshot(path=str(OUT / (self._testMethodName + '.png')), full_page=True)
        (OUT / (self._testMethodName + '.json')).write_text(json.dumps(self.project(), indent=2))
        super().tearDown()

    def selected_asset(self):
        return self.page.evaluate('''()=>{
          const id=document.querySelector('#assetGrid [aria-pressed=true]')?.dataset.id;
          return studio.store.serialize().assets.find(a=>a.id===id);
        }''')

    def save_as(self, kind, name, file_format='png', source='canvas'):
        self.panel('assets')
        selector = {'interior': '#saveInterior', 'asset': '#saveAssetWork',
                    'floor': '#saveFlooring', 'wallpaper': '#saveWallpaper'}[kind]
        self.page.locator(selector).click()
        dialog = self.page.locator('#saveWorkDialog')
        dialog.wait_for(state='visible')
        self.assertEqual(dialog.locator(f'#saveWorkKind-{kind}').get_attribute('aria-pressed'), 'true')
        dialog.locator('#saveWorkName').fill(name)
        if kind != 'interior':
            dialog.locator('#saveWorkSource').select_option(source)
        dialog.locator('#saveWorkFormat').select_option(file_format)
        with self.page.expect_download(timeout=90000) as info:
            dialog.locator('#confirmSaveWork').click()
        dialog.wait_for(state='hidden')
        extension = {'png': '.png', 'project': '.coda-studio.json', 'bundle': '.zip'}[file_format]
        path = OUT / (kind + '-' + file_format + extension)
        download = info.value
        self.assertIn(name.replace(' ', '-').lower(), download.suggested_filename.lower())
        self.assertTrue(download.suggested_filename.endswith(extension))
        download.save_as(str(path))
        return path

    def resize(self, width, height, mode='canvas'):
        self.panel('properties')
        self.page.locator('#resizeImage').click()
        dialog = self.page.locator('#resizeDialog')
        dialog.wait_for(state='visible')
        dialog.locator('#resizeWidth').fill(str(width))
        dialog.locator('#resizeHeight').fill(str(height))
        dialog.locator('#resizeMode').select_option(mode)
        dialog.locator('#confirmResize').click()
        dialog.wait_for(state='hidden')
        self.page.wait_for_function('([w,h])=>{const p=studio.store.getProject();const s=p.scenes.find(s=>s.id===p.activeSceneId);return s.width===w&&s.height===h}', arg=[width, height])

    def test_01_empty_room_defaults_new_templates_and_existing_autosave(self):
        project = self.project()
        scene = self.scene()
        self.assertEqual(scene['kind'], 'interior')
        self.assertEqual((scene['width'], scene['height']), (960, 720))
        self.assertEqual(project['assets'], [])
        self.assertEqual([layer['name'] for layer in scene['layers']], ['Floor', 'Walls'])
        self.assertEqual(sum(len(layer['objects']) for layer in scene['layers']), 0)
        self.assertGreater(self.pixel(5, 500, scene['layers'][0]['id']) & 255, 0)
        self.assertGreater(self.pixel(5, 5, scene['layers'][1]['id']) & 255, 0)
        self.assertEqual(self.pixel(5, 500, scene['layers'][1]['id']), 0)
        self.screenshot('empty-interior-default')
        self.color('#d46d5e')
        self.tool('pencil')
        self.pointer(10, 500)
        saved = self.project()
        self.assertTrue(self.page.evaluate('''async expected=>{
          for(let attempt=0;attempt<50;attempt++){
            try{if(JSON.stringify(await studio.autosave.load(expected.id))===JSON.stringify(expected))return true}
            catch{}
            await new Promise(resolve=>setTimeout(resolve,100));
          }
          return false;
        }''', saved), 'Wait for the browser database to contain the actual latest paint edit')
        self.page.reload()
        self.page.wait_for_function('(id)=>window.studio?.store.getProject().id===id', arg=saved['id'])
        self.assertEqual(self.project(), saved, 'Default room never replaces an existing local save')
        self.new_project(preset='interior', name='New neutral interior', width=160, height=120,
                         room_template=True)
        self.assertEqual([layer['name'] for layer in self.scene()['layers']], ['Floor', 'Walls'])
        self.assertEqual(self.project()['assets'], [])
        self.assertGreater(self.composite(10, 90)[3], 0)
        self.new_project(preset='interior', name='Blank interior', width=64, height=48,
                         room_template=False)
        self.assertEqual(self.colored_pixels(), [])
        self.assertEqual(sum(len(layer['objects']) for layer in self.scene()['layers']), 0)
        self.new_project(name='Blank asset', width=16, height=16)
        self.assertEqual(self.colored_pixels(), [])
        self.new_project(preset='interior', name='Added neutral room', width=80, height=60,
                         add_scene=True, room_template=True)
        self.assertEqual([layer['name'] for layer in self.scene()['layers']], ['Floor', 'Walls'])
        self.assertEqual(sum(len(layer['objects']) for layer in self.scene()['layers']), 0)
        self.new_project(preset='interior', name='Added blank room', width=32, height=24,
                         add_scene=True, room_template=False)
        self.assertEqual(self.colored_pixels(), [])
        self.assertEqual(len(self.scene()['layers']), 1)

    def test_02_explicit_asset_floor_wallpaper_saves_and_portable_interior(self):
        self.new_project(name='Original editable work', width=16, height=16)
        self.color('#de8b59')
        self.tool('rectangle')
        self.page.locator('#shapeFilled').check()
        self.pointer(2, 2, 5, 5)
        original_scene = self.scene()
        for kind, name in [('asset', 'Unique tiny cabinet'), ('floor', 'Unique floor tile'),
                           ('wallpaper', 'Unique wallpaper tile')]:
            path = self.save_as(kind, name)
            image = Image.open(path).convert('RGBA')
            self.assertEqual(image.size, (16, 16))
            self.assertEqual(image.getpixel((2, 2)), (222, 139, 89, 255))
            self.assertEqual(image.getpixel((0, 0)), (0, 0, 0, 0))
            asset = self.selected_asset()
            self.assertEqual(asset['name'], name)
            if kind in ('floor', 'wallpaper'):
                self.assertTrue({'tile', kind, 'repeat'} <= set(asset['tags']))
            self.assertEqual(self.scene(), original_scene, 'Saving reusable art preserves source layers')
        asset = self.selected_asset()
        old_pixels = asset['dataURL']
        self.save_as('floor', 'Renamed selected material', source='asset')
        selected = self.selected_asset()
        self.assertEqual(selected['dataURL'], old_pixels)
        self.assertEqual(selected['name'], 'Renamed selected material')
        self.assertTrue({'tile', 'floor', 'repeat'} <= set(selected['tags']))
        self.assertNotIn('wallpaper', selected['tags'], 'Reclassifying a selected asset replaces its old material kind')
        before_backup = self.project()
        native_path = self.save_as('interior', 'Named room backup', 'project')
        native = json.loads(native_path.read_text())
        self.assertEqual(native['name'], 'Named room backup')
        self.assertEqual({**native, 'name': before_backup['name']}, before_backup)
        self.assertEqual(self.project(), before_backup, 'Custom download names do not rename the open work')
        bundle_path = self.save_as('interior', before_backup['name'], 'bundle')
        base.inspect_bundle(bundle_path, before_backup)
        self.new_project(name='Reopen destination')
        self.page.locator('#projectFile').set_input_files(str(bundle_path))
        self.page.wait_for_function('(id)=>studio.store.getProject().id===id', arg=before_backup['id'])
        self.assertEqual(self.project(), before_backup)

    def test_03_canvas_expansion_crop_and_undo_preserve_source_pixels(self):
        self.new_project(name='Canvas resize', width=16, height=16)
        self.color('#79d2ad')
        self.tool('pencil')
        self.pointer(2, 3)
        self.color('#da7d8b', alpha=50)
        self.pointer(14, 14)
        original = self.project()
        alpha_color = self.pixel(14, 14)
        self.resize(24, 20)
        expanded = self.project()
        self.assertEqual(self.pixel(2, 3), 0x79D2ADFF)
        self.assertEqual(self.pixel(14, 14), alpha_color)
        self.assertEqual(self.pixel(20, 18), 0, 'New canvas area stays transparent')
        self.action('undo').click()
        self.assertEqual(self.project(), original)
        self.action('redo').click()
        self.assertEqual(self.project(), expanded)
        self.resize(8, 8)
        cropped = self.project()
        self.assertEqual(self.pixel(2, 3), 0x79D2ADFF)
        self.assertEqual(len(self.colored_pixels()), 1)
        self.action('undo').click()
        self.assertEqual(self.project(), expanded, 'Undo restores cropped-off pixels')
        self.action('redo').click()
        self.assertEqual(self.project(), cropped)

    def test_04_image_scale_nearest_pixels_objects_collision_and_undo(self):
        self.new_project(name='Scale complete image', width=20, height=20)
        paint_id = self.layer()['id']
        self.color('#ee7655')
        self.tool('rectangle')
        self.page.locator('#shapeFilled').check()
        self.pointer(2, 4, 5, 7)
        self.tool('pencil')
        self.color('#50a0d0', alpha=50)
        self.pointer(10, 10)
        source_alpha = self.pixel(10, 10)
        self.panel('assets')
        self.page.locator('#imageFile').set_input_files(str(OUT / 'test-cottage.png'))
        self.page.wait_for_function('studio.store.getProject().assets.length===1')
        self.page.locator('#placeAsset').click()
        self.pointer(3, 2)
        self.page.wait_for_function('studio.store.getProject().scenes[0].layers.some(l=>l.objects.length===1)')
        self.tool('collision')
        self.page.locator('#collisionValue').select_option('0')
        self.pointer(15, 5)
        self.page.locator('#collisionValue').select_option('1')
        self.pointer(5, 15)
        original = self.project()
        source_object = next(layer['objects'][0] for layer in self.scene()['layers'] if layer['objects'])
        self.resize(40, 40, 'scale')
        self.assertEqual(self.pixel(4, 8, paint_id), 0xEE7655FF)
        self.assertEqual(self.pixel(11, 15, paint_id), 0xEE7655FF)
        self.assertEqual(self.pixel(12, 15, paint_id), 0)
        self.assertEqual(self.pixel(20, 20, paint_id), source_alpha)
        self.assertEqual(self.pixel(21, 21, paint_id), source_alpha)
        scaled_object = next(layer['objects'][0] for layer in self.scene()['layers'] if layer['objects'])
        for key in ('x', 'y', 'w', 'h'):
            self.assertEqual(scaled_object[key], source_object[key] * 2)
        self.assertEqual(scaled_object['anchor'], source_object['anchor'])
        self.assertEqual(self.scene()['collision']['cellSize'], 10)
        cells = self.scene()['collision']['cells']
        self.assertTrue(all(cells[key] == 0 for key in ('2,0', '3,0', '2,1', '3,1')))
        self.assertTrue(all(cells[key] == 1 for key in ('0,2', '1,2', '0,3', '1,3')))
        resized = self.project()
        self.action('undo').click()
        self.assertEqual(self.project(), original)
        self.action('redo').click()
        self.assertEqual(self.project(), resized)

    def test_05_clear_selected_pixels_cancel_save_and_phone_dialogs(self):
        self.new_project(name='Clear a selected area', width=32, height=32)
        self.color('#76bfa5')
        self.tool('fill')
        self.pointer(1, 1)
        original = self.project()
        self.panel('layers')
        self.assertTrue(self.page.locator('#blankSelection').is_disabled())
        self.selection(4, 5, 9, 10)
        self.page.locator('#blankSelection').click()
        self.assertEqual(self.pixel(4, 5), 0)
        self.assertEqual(self.pixel(9, 10), 0)
        self.assertEqual(self.pixel(3, 5), 0x76BFA5FF)
        self.assertEqual(self.pixel(10, 10), 0x76BFA5FF)
        self.action('undo').click()
        self.assertEqual(self.project(), original)
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.locator('[data-ui="toggle-panels"]').click()
        self.panel('assets')
        self.page.locator('#saveFlooring').click()
        dialog = self.page.locator('#saveWorkDialog')
        dialog.wait_for(state='visible')
        self.assertLessEqual(dialog.evaluate('e=>e.getBoundingClientRect().right'), 390)
        dialog.locator('#confirmSaveWork').scroll_into_view_if_needed()
        self.assertTrue(dialog.locator('#confirmSaveWork').is_visible())
        self.screenshot('save-work-phone')
        dialog.locator('#saveWorkName').fill('')
        self.assertTrue(dialog.locator('#confirmSaveWork').is_disabled())
        self.page.keyboard.press('Escape')
        dialog.wait_for(state='hidden')
        self.assertEqual(self.project(), original)


if __name__ == '__main__':
    unittest.main(verbosity=2)
