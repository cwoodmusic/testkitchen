"""Pixel editing exercises real Canvas compositing and the world project editor."""
import functools
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):
        if self.path!='/pixel-fixture':return super().do_GET()
        body='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/pixel-editor.css"><style>body{background:#101225;color:#fff;font:14px system-ui}#assetStudio{width:360px;max-width:calc(100vw - 24px);margin:auto}button,select,input{color:white;background:#32294b;border:1px solid #aa8abb;border-radius:5px;padding:8px}*{box-sizing:border-box}</style><section id="assetStudio" class="dev-console"><div id="editor"></div></section><canvas id="scene" width="200" height="150"></canvas><script src="/character-renderer.js"></script><script src="/pixel-selection.js"></script><script src="/pixel-editor.js"></script><script>
window.renderer=createCodaCharacterRenderer({reducedMotion:()=>true});window.changes=[];window.data={};
window.editor=CodaPixelEditor.mount({host:document.querySelector('#editor'),renderer,getData:()=>data,getProfile:()=>({}),getTargets:()=>[{id:'player',name:'Your avatar'},{id:'bach',name:'J. S. Bach'}],onChange:next=>{data=next;changes.push(JSON.parse(JSON.stringify(next)));renderer.setPixelEdits(next);}});
window.framePixel=(target,x,y,options={})=>Array.from(renderer.renderPixelFrame(target,{}, {facing:options.facing||'down'},0,options).getContext('2d').getImageData(x,y,1,1).data);
</script>'''
        self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.end_headers();self.wfile.write(body.encode())

class PixelEditorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)));threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.playwright=sync_playwright().start();cls.browser=cls.playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    @classmethod
    def tearDownClass(cls):cls.browser.close();cls.playwright.stop();cls.server.shutdown();cls.server.server_close()
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1200,'height':1000},accept_downloads=True);self.context.route('https://**/*',lambda route:route.abort());self.page=self.context.new_page();self.errors=[];self.page.on('pageerror',lambda error:self.errors.append(str(error)));self.page.set_default_timeout(10000)
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/pixel-fixture');self.page.wait_for_function('window.editor&&window.renderer')
    def tearDown(self):self.context.close();self.assertEqual(self.errors,[])
    def paint(self,x,y):
        canvas=self.page.locator('#pixelEditCanvas');canvas.scroll_into_view_if_needed();box=canvas.bounding_box();zoom=self.page.evaluate('editor.getState().zoom') if self.page.url.endswith('pixel-fixture') else int(self.page.get_by_label('Pixel zoom',exact=True).input_value());self.page.mouse.click(box['x']+(x+.5)*zoom,box['y']+(y+.5)*zoom)
    def test_pencil_drag_commits_once_and_direction_target_and_erase_are_independent(self):
        self.page.get_by_label('Animate sprite preview',exact=True).uncheck();self.paint(40,45)
        self.assertEqual(self.page.evaluate("framePixel('player',40,45)"),[255,95,151,255]);self.assertEqual(self.page.evaluate('changes.length'),1)
        canvas=self.page.locator('#pixelEditCanvas');box=canvas.bounding_box();self.page.mouse.move(box['x']+41.5*4,box['y']+45.5*4);self.page.mouse.down();self.page.mouse.move(box['x']+45.5*4,box['y']+49.5*4,steps=4);self.assertEqual(self.page.evaluate('changes.length'),1);self.page.mouse.up();self.assertEqual(self.page.evaluate('changes.length'),2)
        self.page.get_by_label('Sprite direction',exact=True).select_option('left');self.paint(40,45)
        self.assertEqual(self.page.evaluate("framePixel('player',40,45,{facing:'left'})"),[255,95,151,255]);self.assertEqual(len(self.page.evaluate('data.player.down')),6)
        self.page.get_by_label('Pixel tool',exact=True).select_option('erase');self.paint(40,45)
        self.assertEqual(self.page.evaluate("framePixel('player',40,45,{facing:'left'})")[3],0,'Left-facing erasing must address the visible pixel without a mirror offset')
        self.assertEqual(self.page.evaluate("framePixel('player',40,45)"),[255,95,151,255])
        self.page.get_by_label('Sprite character',exact=True).select_option('bach');self.page.get_by_label('Pixel tool',exact=True).select_option('pencil');self.paint(40,45)
        self.assertEqual(self.page.evaluate("framePixel('bach',40,45,{facing:'left'})"),[255,95,151,255]);self.assertEqual(self.page.evaluate("framePixel('player',40,45,{facing:'left'})")[3],0)
    def test_rectangle_copy_paste_and_eyedropper_preserve_exact_sprite_pixels(self):
        self.page.get_by_label('Animate sprite preview', exact=True).uncheck()
        self.page.evaluate("data=CodaPixelEditor.changePixels({},'player','down',[[40,45]],'#12345680');data=CodaPixelEditor.changePixels(data,'player','down',[[41,45]],null);renderer.setPixelEdits(data);editor.refresh();changes=[]")
        self.page.get_by_role('button', name='Select', exact=True).click()
        canvas = self.page.locator('#pixelEditCanvas')
        canvas.scroll_into_view_if_needed()
        box = canvas.bounding_box()
        self.page.mouse.move(box['x'] + 41.5*4, box['y'] + 46.5*4)
        self.page.mouse.down()
        self.page.mouse.move(box['x'] + 40.5*4, box['y'] + 45.5*4)
        self.page.mouse.up()
        self.assertEqual(self.page.evaluate('editor.getState().selection'), {'x':40,'y':45,'width':2,'height':2})
        copied = self.page.evaluate("()=>[[40,45],[41,45],[40,46],[41,46]].map(([x,y])=>framePixel('player',x,y))")
        self.page.get_by_role('button', name='Copy', exact=True).click()
        before = self.page.evaluate('JSON.stringify(data)')
        self.page.get_by_label('Sprite character', exact=True).select_option('bach')
        self.page.get_by_label('Sprite direction', exact=True).select_option('left')
        self.page.get_by_role('button', name='Paste', exact=True).click()
        self.page.mouse.move(box['x'] + 43.5*4, box['y'] + 47.5*4)
        self.assertEqual(self.page.evaluate('JSON.stringify(data)'), before)
        self.page.keyboard.press('Escape')
        self.assertFalse(self.page.evaluate('editor.getState().pasting'))
        canvas.focus()
        self.page.keyboard.press('ControlOrMeta+V')
        self.page.mouse.move(box['x'] + 43.5*4, box['y'] + 47.5*4)
        self.page.keyboard.press('Enter')
        self.assertEqual(self.page.evaluate('changes.length'), 1)
        self.assertEqual(self.page.evaluate("()=>[[43,47],[44,47],[43,48],[44,48]].map(([x,y])=>framePixel('bach',x,y,{facing:'left'}))"), copied)
        self.page.get_by_role('button', name='Eyedropper', exact=True).click()
        self.paint(43,47)
        self.assertEqual(self.page.get_by_label('Pixel exact hex colour', exact=True).input_value(), '#' + ''.join(f'{byte:02x}' for byte in copied[0]))
        self.assertEqual(self.page.evaluate('changes.length'), 1)
        fields = self.page.get_by_label('Pixel exact hex colour', exact=True)
        self.assertEqual(fields.evaluate("input=>['c','v'].map(key=>{const event=new KeyboardEvent('keydown',{key,ctrlKey:true,bubbles:true,cancelable:true});input.focus();input.dispatchEvent(event);return event.defaultPrevented;})"), [False,False])

    def test_transparent_character_pixel_preserves_world_and_motion_remains_animated(self):
        result=self.page.evaluate('''()=>{
          renderer.setPixelEdits({player:{down:[[40,45,null]]}});
          const g=scene.getContext('2d');g.fillStyle='#0000ff';g.fillRect(0,0,200,150);renderer.drawPlayer(g,{}, {x:100,y:100,facing:'down'},0);
          const background=Array.from(g.getImageData(100,65,1,1).data);
          renderer.setPixelEdits({player:{left:[[40,45,null]]}});g.fillStyle='#0000ff';g.fillRect(0,0,200,150);renderer.drawPlayer(g,{}, {x:100,y:100,facing:'left'},0);const backgroundLeft=Array.from(g.getImageData(100,65,1,1).data);
          const moving=createCodaCharacterRenderer();moving.setPixelEdits({player:{down:[[40,45,'#ff00ff']]}});
          const signature=phase=>Array.from(moving.renderPixelFrame('player',{}, {facing:'down',walking:true,phase},0).getContext('2d').getImageData(0,0,80,96).data).join(',');
          renderer.setPixelEdits({player:{down:[[40,45,'#ff00ff']]}});
          g.clearRect(0,0,200,150);renderer.drawPlayer(g,{}, {x:100,y:100,facing:'down',jumpHeight:20},0);
          const jumped=Array.from(g.getImageData(100,45,1,1).data);
          renderer.setPixelEdits({player:{down:[[40,45,null]]}});
          return {background,backgroundLeft,jumped,animated:signature(.1)!==signature(1.6),pixel:framePixel('player',40,45),base:framePixel('player',40,45,{base:true})};
        }''')
        self.assertEqual(result['background'],[0,0,255,255]);self.assertEqual(result['backgroundLeft'],[0,0,255,255]);self.assertEqual(result['pixel'][3],0);self.assertEqual(result['base'][3],255);self.assertTrue(result['animated']);self.assertEqual(result['jumped'],[255,0,255,255],'Pixel details must rise with the character during a jump')
    def test_eyedropper_returns_to_previous_tool_for_pointer_and_keyboard_without_editing(self):
        self.page.get_by_label('Animate sprite preview',exact=True).uncheck()
        self.page.evaluate("data=CodaPixelEditor.changePixels({},'player','down',[[40,45]],'#12345680');renderer.setPixelEdits(data);editor.refresh();changes=[]")
        expected = '#' + ''.join(f'{value:02x}' for value in self.page.evaluate("framePixel('player',40,45)"))
        for previous in ['pencil','erase','restore','fill','select','pan','stamp']:
            with self.subTest(previous=previous):
                self.page.get_by_label('Pixel tool',exact=True).select_option(previous)
                self.page.get_by_role('button',name='Eyedropper',exact=True).click()
                self.page.locator('#pixelEditCanvas').focus()
                self.page.keyboard.press('i')
                self.paint(40,45)
                self.assertEqual(self.page.evaluate('editor.getState().tool'),previous)
                self.assertEqual(self.page.get_by_label('Pixel tool',exact=True).input_value(),previous)
                self.assertEqual(self.page.get_by_label('Pixel exact hex colour',exact=True).input_value(),expected)
                self.assertEqual(self.page.evaluate('changes.length'),0)
        self.page.get_by_label('Pixel tool',exact=True).select_option('fill')
        canvas=self.page.locator('#pixelEditCanvas');canvas.focus()
        self.page.keyboard.press('i')
        self.page.keyboard.down('Space')
        self.page.keyboard.down('Space')
        self.assertEqual(self.page.evaluate('editor.getState().tool'),'fill')
        self.assertEqual(self.page.evaluate('changes.length'),0)
        self.page.keyboard.up('Space')
        self.page.get_by_label('Pixel tool',exact=True).select_option('erase')
        canvas.focus();self.page.keyboard.press('i');self.page.keyboard.press('Enter')
        self.assertEqual(self.page.evaluate('editor.getState().tool'),'erase')
        self.page.get_by_label('Pixel tool',exact=True).select_option('pan')
        self.page.keyboard.down('Alt');self.paint(40,45);self.page.keyboard.up('Alt')
        self.assertEqual(self.page.evaluate('editor.getState().tool'),'pan')
        self.assertEqual(self.page.evaluate('changes.length'),0)

    def test_picker_fill_restore_and_cancel_do_not_leave_half_committed_strokes(self):
        self.page.get_by_label('Pixel tool',exact=True).select_option('picker');self.paint(40,45)
        self.assertEqual(self.page.evaluate('changes.length'),0);self.assertEqual(self.page.get_by_label('Pixel colour',exact=True).input_value(),'#e5ad75')
        self.page.get_by_label('Pixel colour',exact=True).fill('#ff0000');self.page.get_by_label('Pixel tool',exact=True).select_option('fill');self.paint(40,45)
        self.assertGreater(len(self.page.evaluate('data.player.down')),5);self.assertEqual(self.page.evaluate("framePixel('player',40,45)"),[255,0,0,255])
        self.page.get_by_label('Pixel tool',exact=True).select_option('restore');self.paint(40,45);self.assertNotEqual(self.page.evaluate("framePixel('player',40,45)"),[255,0,0,255])
        before=self.page.evaluate('JSON.stringify(data)');self.page.get_by_label('Pixel tool',exact=True).select_option('pencil');box=self.page.locator('#pixelEditCanvas').bounding_box();self.page.mouse.move(box['x']+40.5*4,box['y']+46.5*4);self.page.mouse.down();self.page.evaluate("document.querySelector('#pixelEditCanvas').dispatchEvent(new PointerEvent('pointercancel',{pointerId:1}))");self.page.mouse.up()
        self.assertEqual(self.page.evaluate('JSON.stringify(data)'),before)
        self.page.get_by_role('button',name='Reset this character',exact=True).click();self.assertEqual(self.page.evaluate('data'),{})
        with self.page.expect_download() as download:self.page.get_by_role('button',name='Export facing as PNG',exact=True).click()
        self.assertEqual(download.value.suggested_filename,'coda-player-down.png')
    def test_production_console_undo_redo_export_reload_and_mobile_targets(self):
        self.context.close();self.context=self.browser.new_context(viewport={'width':1200,'height':1000},is_mobile=True,has_touch=True,accept_downloads=True);self.context.route('https://**/*',lambda route:route.abort());self.page=self.context.new_page();self.page.on('pageerror',lambda error:self.errors.append(str(error)));self.page.set_default_timeout(10000)
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/world-preview.html');self.page.wait_for_function('CodaDeveloperConsole?.ready()');self.page.evaluate("CodaDeveloperConsole.open('sprites')")
        self.page.locator('#devTab-pixels').wait_for();self.page.get_by_label('Animate sprite preview',exact=True).uncheck();self.paint(40,45)
        self.assertEqual(self.page.evaluate("CodaDeveloperConsole.getProject().sprites.player.down[0]"),[40,45,'#ff5f97'])
        self.page.locator('#devUndo').click();self.assertNotIn('sprites',self.page.evaluate('CodaDeveloperConsole.getProject()'))
        self.page.locator('#devRedo').click();self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProject().sprites.player.down[0][2]'),'#ff5f97')
        box=self.page.locator('#pixelEditCanvas').bounding_box();self.page.mouse.move(box['x']+41.5*4,box['y']+45.5*4);self.page.mouse.down()
        self.page.evaluate('CodaDeveloperConsole.save()');self.page.mouse.up()
        self.assertTrue(any(point[:2]==[41,45] for point in self.page.evaluate('CodaDeveloperConsole.getProject().sprites.player.down')),'Manual Save finishes the current pixel gesture')
        self.page.locator('#devTab-project').click()
        with self.page.expect_download() as download:self.page.locator('#devExport').click()
        exported=json.loads(Path(download.value.path()).read_text());self.assertEqual(exported['sprites']['player']['down'][0],[40,45,'#ff5f97'])
        old_project=dict(exported);old_project.pop('sprites')
        self.page.once('dialog',lambda dialog:dialog.accept())
        self.page.locator('#devImportFile').set_input_files({'name':'old-world.json','mimeType':'application/json','buffer':json.dumps(old_project).encode()})
        self.page.wait_for_function('!CodaDeveloperConsole.getProject().sprites')
        self.page.locator('#devUndo').click();self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProject().sprites.player.down[0][2]'),'#ff5f97')
        self.page.locator('#devSave').click();self.page.reload();self.page.wait_for_function('CodaDeveloperConsole?.ready()');self.page.evaluate("CodaDeveloperConsole.open('sprites')")
        self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProject().sprites.player.down[0][2]'),'#ff5f97')
        for size in [{'width':390,'height':844},{'width':844,'height':390}]:
            self.page.set_viewport_size(size);self.page.wait_for_timeout(100)
            self.assertLessEqual(self.page.locator('#dev-pixels').evaluate('(node)=>node.scrollWidth'),size['width'])
            metrics=self.page.locator('#dev-pixels button:visible').evaluate_all('(nodes)=>nodes.map(n=>({text:n.textContent,h:n.getBoundingClientRect().height,w:n.getBoundingClientRect().width}))')
            self.assertTrue(all(item['h']>=44 and item['w']>=44 for item in metrics),metrics)
        self.page.get_by_label('Pixel zoom',exact=True).select_option('2');self.page.get_by_label('Pixel colour',exact=True).fill('#00ccff')
        geometry=self.page.locator('#pixelEditCanvas').evaluate('''canvas=>{
          const panel=canvas.closest('#assetStudio'),tabs=panel.querySelector('.dev-tabs');panel.scrollTop+=canvas.getBoundingClientRect().top-tabs.getBoundingClientRect().bottom-6;
          const grid=canvas.getBoundingClientRect(),tab=tabs.getBoundingClientRect(),foot=panel.lastElementChild.getBoundingClientRect(),bounds=panel.getBoundingClientRect();
          const top=Math.max(grid.top,tab.bottom,bounds.top),bottom=Math.min(grid.bottom,foot.top,bounds.bottom);
          return {visible:bottom-top,x:grid.left+81,y:grid.top+91,top,bottom};
        }''')
        self.assertGreaterEqual(geometry['visible'],128,'Short landscape must retain usable pixel canvas space between its sticky controls')
        self.assertTrue(self.page.evaluate('point=>document.elementFromPoint(point.x,point.y)?.id==="pixelEditCanvas"',geometry))
        self.page.mouse.click(geometry['x'],geometry['y']);self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProject().sprites.player.down[0][2]'),'#00ccff')
        self.page.screenshot(path='/tmp/coda-pixel-editor30.png',full_page=True)

    def test_production_canvas_keeps_keyboard_pixel_controls_while_map_pan_is_available(self):
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/world-preview.html')
        self.page.wait_for_function('CodaDeveloperConsole?.ready()')
        self.page.evaluate("CodaDeveloperConsole.open('sprites')")
        self.page.get_by_label('Animate sprite preview',exact=True).uncheck()
        position=self.page.evaluate('CodaArcadeQA.position()')
        self.page.locator('#pixelEditCanvas').focus()
        self.page.keyboard.press('ArrowRight');self.page.keyboard.press('Space')
        self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProject().sprites.player.down'),[[41,45,'#ff5f97']])
        self.assertEqual(self.page.evaluate('CodaArcadeQA.position()'),position)
        self.assertEqual(self.page.locator('#devPan').get_attribute('aria-pressed'),'false')
        self.page.locator('#devUndo').click();self.assertNotIn('sprites',self.page.evaluate('CodaDeveloperConsole.getProject()'))
        self.page.locator('#devRedo').click();self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProject().sprites.player.down'),[[41,45,'#ff5f97']])

    def test_real_phone_touch_paints_and_cancel_discards_the_unfinished_stroke(self):
        self.context.close();self.context=self.browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);self.page=self.context.new_page();self.page.on('pageerror',lambda error:self.errors.append(str(error)));self.page.goto(f'http://127.0.0.1:{self.server.server_port}/pixel-fixture')
        self.page.wait_for_function('window.editor');self.page.get_by_label('Animate sprite preview',exact=True).uncheck();canvas=self.page.locator('#pixelEditCanvas');canvas.scroll_into_view_if_needed();box=canvas.bounding_box()
        self.page.touchscreen.tap(box['x']+40.5*4,box['y']+45.5*4);self.assertEqual(self.page.evaluate('changes.length'),1)
        before=self.page.evaluate('JSON.stringify(data)');client=self.context.new_cdp_session(self.page)
        client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':box['x']+41.5*4,'y':box['y']+45.5*4,'id':1}]})
        client.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':box['x']+44.5*4,'y':box['y']+47.5*4,'id':1}]})
        client.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]});self.assertEqual(self.page.evaluate('JSON.stringify(data)'),before);self.assertFalse(self.page.evaluate('editor.getState().stroke'))
        self.page.get_by_label('Pixel zoom',exact=True).select_option('12');self.page.get_by_label('Pixel tool',exact=True).select_option('pan');scroller=self.page.locator('.pixel-grid-scroll');scroller.scroll_into_view_if_needed();box=scroller.bounding_box();x=box['x']+180;y=box['y']+140
        client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]})
        for step in range(1,8):client.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-step*15,'y':y-step*10,'id':1}]});self.page.wait_for_timeout(22)
        client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});client.detach();self.page.wait_for_timeout(120)
        self.assertGreater(scroller.evaluate('(node)=>node.scrollLeft+node.scrollTop'),30,'Pan canvas must make zoomed pixels reachable on a phone')
        self.assertEqual(self.page.evaluate('JSON.stringify(data)'),before)

if __name__=='__main__':unittest.main(verbosity=2)
