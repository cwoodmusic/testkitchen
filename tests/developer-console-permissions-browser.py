"""Developer-console mutation authority, independent of world login fixtures."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


class DeveloperConsolePermissionsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0),
            functools.partial(QuietHandler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.pw.stop()
        cls.server.shutdown(); cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context()
        self.context.route('https://**/*', lambda route:route.abort())
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error:self.errors.append(str(error)))
        markup = re.sub(r'<script\b[^>]*>.*?</script>', '',
                        (ROOT/'world-preview.html').read_text(), flags=re.S)
        self.context.route('**/fixture.html', lambda route:route.fulfill(body=markup, content_type='text/html'))
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/fixture.html')
        self.page.add_script_tag(path=str(ROOT/'collision-editor.js'))
        self.page.add_script_tag(path=str(ROOT/'developer-console.js'))
        self.page.evaluate('''()=>{
          window.owner=false;window.writeCount=0;window.recordCount=0;
          const c=document.querySelector('#view'),art=document.createElement('canvas');
          art.width=1672;art.height=941;art.complete=true;art.naturalWidth=1672;art.naturalHeight=941;
          window.studio={assets:[],undo:[],redo:[],active:false,selected:null,nextId:1,dirty:false};
          window.layer={actions:[],redo:[],drawing:null,active:false,dirty:false};
          window.consoleApi={W:1672,H:941,c,studio,layer,parts:[],catalog:[],worldArt:art,foregroundArt:art,
            cell:16,gridWidth:105,gridHeight:59,navGrid:new Uint8Array(105*59).fill(1),baseGrid:new Uint8Array(105*59).fill(1),
            maxAssets:256,legacyStore:'unusedLegacy',legacyCollision:[],validLegacy:()=>false,
            validAsset:a=>!!a&&typeof a.id==='string',validStroke:a=>!!a,
            canDevelop:()=>owner,toWorld:(x,y)=>({x,y}),invalidateRoutes(){},invalidateArtwork(){},refresh(){},
            selected:()=>studio.assets.find(a=>a.id===studio.selected)||null,
            prototype:(name,kind)=>({id:'asset-'+studio.nextId++,name,kind,layer:'world',x:20,y:20,w:10,h:10,opacity:100,rotation:0,visible:true}),
            add:a=>{studio.assets.push(a);studio.selected=a.id;return true;},
            bound:(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.min(max,Math.max(min,Number(value))):fallback,
            record:before=>{recordCount++;editor.recordChange(before);},
            toggle:value=>{studio.active=!!value;document.querySelector('#assetStudio').hidden=!value;editor?.onToggle();},
            db:()=>Promise.reject(Error('fixture uses local fallback')),
            layerPointerEnd(){layer.drawing=null;},assetPointerEnd(){},focusWorld(){},
            fileData:file=>file.text(),imageDimensions:async()=>[10,10]};
          window.editor=createCodaDeveloperConsole(consoleApi);
        }''')
        self.page.wait_for_function('editor.loadReady()')

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def test_loading_is_available_but_absent_or_false_permission_denies_all_mutations(self):
        before = self.page.evaluate('editor.snapshot()')
        self.assertTrue(self.page.evaluate('editor.loadReady()'))
        self.assertFalse(self.page.evaluate("editor.open('layers')"))
        self.assertFalse(self.page.evaluate('editor.save()'))
        self.assertFalse(self.page.evaluate('editor.undoRedo(true)'))
        self.assertFalse(self.page.evaluate('editor.recordChange(editor.snapshot())'))
        self.page.evaluate("document.querySelector('#devLayerSize').onchange({target:{value:'99'}})")
        self.assertNotEqual(self.page.evaluate('layer.size'), 99)
        self.page.keyboard.press('F2')
        self.assertFalse(self.page.evaluate('studio.active'))
        self.page.evaluate('consoleApi.canDevelop=undefined')
        self.assertFalse(self.page.evaluate('editor.open()'))
        self.assertEqual(self.page.evaluate('editor.snapshot()'), before)
        self.assertIsNone(self.page.evaluate("localStorage.getItem('codaWorldProjectV1')"))

    def test_owner_edits_work_and_revocation_cancels_save_without_erasing_the_saved_project(self):
        self.page.evaluate('owner=true;editor.refreshPermissions();editor.open()')
        self.assertTrue(self.page.evaluate('editor.isEditing()'))
        self.page.evaluate("studio.assets.push({id:'asset-1',name:'kept',x:20,y:20,w:10,h:10});editor.recordChange('{}')")
        self.assertTrue(self.page.evaluate('editor.save()'))
        saved = self.page.evaluate("localStorage.getItem('codaWorldProjectV1')")
        self.assertEqual(json.loads(saved)['assets'][0]['name'], 'kept')
        self.page.evaluate('''()=>{
          consoleApi.db=()=>new Promise(resolve=>window.resolveSave=resolve);
          window.queuedSave=editor.save();owner=false;editor.refreshPermissions();
          resolveSave({transaction(){throw Error('revoked save must not start a transaction')}});
        }''')
        self.assertFalse(self.page.evaluate('queuedSave'))
        self.assertFalse(self.page.evaluate('studio.active||editor.isEditing()||editor.isPlaytest()'))
        self.assertEqual(self.page.evaluate("localStorage.getItem('codaWorldProjectV1')"), saved)
        self.assertEqual(self.page.evaluate('editor.getProject().assets[0].name'), 'kept')

    def test_import_awaiting_a_file_cannot_apply_after_owner_revocation_or_reauthorization(self):
        self.page.evaluate('owner=true;editor.refreshPermissions();editor.open()')
        before = self.page.evaluate('editor.snapshot()')
        self.page.evaluate('''()=>{
          const project=editor.getProject();project.assets=[{id:'asset-99',name:'forbidden queued import'}];
          const file={size:20,text:()=>new Promise(resolve=>window.resolveImport=()=>resolve(JSON.stringify(project)))};
          window.queuedImport=document.querySelector('#devImportFile').onchange({target:{files:[file],value:'pending'}});
          owner=false;editor.refreshPermissions();owner=true;editor.refreshPermissions();editor.open();resolveImport();
        }''')
        self.page.evaluate('queuedImport')
        self.assertEqual(self.page.evaluate('editor.snapshot()'), before)
        self.assertEqual(self.page.evaluate('studio.undo.length'), 0)

    def test_revocation_rolls_back_only_the_inflight_collision_or_layer_gesture(self):
        self.page.evaluate("owner=true;editor.refreshPermissions();editor.open();studio.assets.push({id:'asset-1',name:'prior edit'});")
        self.assertTrue(self.page.evaluate('editor.save()'))
        before = self.page.evaluate('editor.snapshot()')
        saved = self.page.evaluate("localStorage.getItem('codaWorldProjectV1')")
        self.page.evaluate('''()=>{
          editor.open('collision');editor.pointerDown({button:0,pointerId:7,clientX:17,clientY:17,preventDefault(){}});
        }''')
        self.assertTrue(self.page.evaluate('editor.getProject().collision.length>0'))
        self.page.evaluate('owner=false;editor.refreshPermissions()')
        self.assertEqual(self.page.evaluate('editor.snapshot()'), before)
        self.page.evaluate('''()=>{
          owner=true;editor.refreshPermissions();editor.open('layers');
          consoleApi.layerPointerDown=()=>{layer.actions.push({temporary:'stroke'});layer.drawing={temporary:true};};
          editor.pointerDown({button:0,pointerId:8,clientX:17,clientY:17,preventDefault(){}});
        }''')
        self.assertTrue(self.page.evaluate('layer.actions.length>0'))
        self.page.evaluate('owner=false;editor.refreshPermissions()')
        self.assertEqual(self.page.evaluate('editor.snapshot()'), before)
        self.assertEqual(self.page.evaluate("localStorage.getItem('codaWorldProjectV1')"), saved)
        self.assertEqual(self.page.evaluate('studio.undo.length'), 0)


if __name__ == '__main__':
    unittest.main()
