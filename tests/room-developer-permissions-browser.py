"""Room developer controls require an explicit capability and revoke cleanly."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]

def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    value = importlib.util.module_from_spec(spec);spec.loader.exec_module(value)
    return value

inputs = module('room_permission_input', 'room-editor-input-browser.py')
piano = module('room_permission_piano', 'piano-lab-browser.py')


class RoomDeveloperPermissionTests(inputs.RoomEditorInputTests):
    def recreate(self, with_permission=True):
        self.page.evaluate('''withPermission=>{
          editor.destroy();window.ownerAllowed=false;window.savedProjects=new Map();window.saves=0;
          window.editor=createCodaRoomDeveloperEditor({id:'permission-test',host:document.querySelector('#room'),
            canvas:document.querySelector('canvas'),width:1000,height:620,
            ...(withPermission?{canDevelop:()=>ownerAllowed,canEdit:()=>roomEditAllowed}:{}),
            storage:{getItem:()=>null,setItem:(key,value)=>{savedProjects.set(key,value);saves++;}}});
        }''', with_permission)

    def test_missing_capability_hides_button_and_blocks_click_f2_and_public_open(self):
        self.recreate(False)
        button = self.page.locator('[data-room-dev-open]')
        self.assertTrue(button.is_hidden())
        self.assertEqual(button.evaluate('node=>node.getClientRects().length'), 0)
        self.assertFalse(self.page.evaluate('editor.open()'))
        button.dispatch_event('click')
        self.page.keyboard.press('F2')
        self.assertFalse(self.state()['open'])
        self.assertEqual(self.page.evaluate('saves'), 0)

    def test_revocation_closes_editor_preserves_saved_project_and_allows_regrant(self):
        self.recreate()
        self.page.evaluate('ownerAllowed=true;editor.refreshPermissions()')
        self.assertTrue(self.page.locator('[data-room-dev-open]').is_visible())
        self.assertTrue(self.page.evaluate('editor.open("collision")'))
        project = {'version':1,'assets':[],'collision':[[2,0]],'strokes':[],'entities':{}}
        self.assertTrue(self.page.evaluate('value=>editor.applyProject(value)', project))
        saved = self.page.evaluate('[...savedProjects.values()]')
        self.page.evaluate('ownerAllowed=false;editor.refreshPermissions()')
        self.assertFalse(self.state()['open'])
        self.assertFalse(self.state()['editing'])
        self.assertTrue(self.page.locator('[data-room-dev-open]').is_hidden())
        self.assertEqual(self.page.evaluate('editor.getProject()'), project)
        self.assertEqual(self.page.evaluate('[...savedProjects.values()]'), saved)
        self.page.evaluate('ownerAllowed=true;editor.refreshPermissions()')
        self.assertTrue(self.page.evaluate('editor.open()'))
        self.assertEqual(self.page.evaluate('editor.getProject()'), project)

    def test_revocation_discards_unfinished_brush_without_writing(self):
        self.recreate()
        self.page.evaluate('ownerAllowed=true;editor.open("collision")')
        self.touch('touchStart',[(1,120,100)])
        self.touch('touchMove',[(1,140,110)])
        self.assertTrue(self.state()['project']['collision'])
        self.page.evaluate('ownerAllowed=false;editor.refreshPermissions()')
        self.touch('touchEnd',[])
        self.assertFalse(self.state()['open'])
        self.assertEqual(self.state()['project']['collision'], [])
        self.assertEqual(self.page.evaluate('saves'), 0)


class PianoDeveloperPermissionTests(piano.PianoLabTests):
    def setUp(self):
        super().setUp()
        self.page.add_script_tag(path=str(ROOT/'room-developer-editor.js'))
        self.page.add_style_tag(path=str(ROOT/'room-developer-editor.css'))
        self.page.evaluate('''()=>{
          lab.destroy();window.ownerAllowed=false;const create=createCodaPianoLab;
          window.createCodaPianoLab=options=>create({...options,canDevelop:()=>ownerAllowed});
          makeLab();lab.open();
        }''')

    def test_piano_public_access_and_button_follow_capability_while_projects_still_load(self):
        button = self.page.locator('[data-room-dev-open="piano"]')
        self.assertTrue(button.is_hidden())
        self.assertTrue(self.page.evaluate('lab.getEditor()===null'))
        self.assertFalse(self.page.evaluate('lab.openDeveloperConsole()'))
        self.page.keyboard.press('F2')
        self.assertFalse(self.state()['editor']['open'])
        project = {'version':1,'assets':[],'collision':[[2,0]],'strokes':[],'entities':{}}
        self.assertTrue(self.page.evaluate('value=>lab.getProjectRuntime().applyProject(value,{persist:false})', project))
        self.assertEqual(self.page.evaluate('lab.getProjectRuntime().getProject()'), project)

        self.page.evaluate('ownerAllowed=true;lab.refreshDeveloperPermissions()')
        self.assertTrue(button.is_visible())
        self.assertTrue(self.page.evaluate('lab.openDeveloperConsole()'))
        self.assertTrue(self.state()['editor']['open'])
        self.page.evaluate('ownerAllowed=false;lab.refreshDeveloperPermissions()')
        self.assertTrue(button.is_hidden())
        self.assertTrue(self.page.evaluate('lab.getEditor()===null'))
        self.assertFalse(self.state()['editor']['open'])
        self.assertEqual(self.page.evaluate('lab.getProjectRuntime().getProject()'), project)

    def test_fishing_button_and_editor_follow_capability_without_blocking_room_play(self):
        self.page.evaluate('lab.destroy()')
        for filename in ['rhythm-fishing-engine.js','fishing-cave-layout.js','fishing-cave-effects.js',
                         'fish-shadow-motion.js','rhythm-fishing.js']:
            self.page.add_script_tag(path=str(ROOT/filename))
        self.page.add_style_tag(path=str(ROOT/'rhythm-fishing.css'))
        self.page.evaluate('''()=>{const host=document.createElement('section');document.body.append(host);
          window.ownerAllowed=false;window.lab=createCodaRhythmFishing({host,renderer:createCodaCharacterRenderer(),
            getAvatar:()=>({}),storage:{getItem:()=>null,setItem(){}},canDevelop:()=>ownerAllowed});lab.open();}''')
        button = self.page.locator('[data-room-dev-open="fishing"]')
        self.assertTrue(button.is_hidden())
        self.assertEqual(button.evaluate('node=>node.getClientRects().length'), 0)
        self.assertTrue(self.state()['open'])
        self.assertTrue(self.page.evaluate('lab.getEditor()===null'))
        self.page.keyboard.press('F2')
        self.assertFalse(self.page.evaluate('lab.getState().editor.open'))
        self.page.evaluate('ownerAllowed=true;lab.refreshDeveloperPermissions()')
        self.assertTrue(self.page.evaluate('lab.getEditor().open("collision")'))
        self.assertTrue(self.page.evaluate('lab.getState().editor.open'))
        self.page.evaluate('ownerAllowed=false;lab.refreshDeveloperPermissions()')
        self.assertTrue(button.is_hidden())
        self.assertTrue(self.page.evaluate('lab.getEditor()===null'))
        self.assertFalse(self.page.evaluate('lab.getState().editor.open'))
        self.assertTrue(self.state()['open'])


if __name__ == '__main__':
    suite = unittest.TestSuite(cls(name) for cls in [RoomDeveloperPermissionTests,PianoDeveloperPermissionTests]
                              for name in cls.__dict__ if name.startswith('test_'))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    sys.exit(not result.wasSuccessful())
