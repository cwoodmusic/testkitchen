"""Test the actual delivered studio bytes with all networking disabled."""
import json
from pathlib import Path
import unittest
from playwright.sync_api import sync_playwright
FILE=Path('/workspace/scratch/coda-pixel-workshop/coda-pixel-editor.html')

class OfflineArtTests(unittest.TestCase):
 def test_full_library_wardrobe_paint_undo_and_export_roundtrip_offline(self):
  with sync_playwright() as pw:
   browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
   context=browser.new_context(offline=True,accept_downloads=True,viewport={'width':1500,'height':1100});page=context.new_page();page.set_default_timeout(30000)
   errors=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
   # Managed Chromium blocks file:// navigation; execute the exact standalone bytes.
   page.set_content(FILE.read_text(),wait_until='load',timeout=90000)
   page.wait_for_function('()=>window.CodaOfflineArt&&!CodaOfflineArt.editor.getState().loading')
   state=page.evaluate('CodaOfflineArt.getState()');self.assertGreaterEqual(len(state['targets']),400)
   ids={t['id'] for t in state['targets']}
   for id in ['background.world','background.classroom','background.piano','background.fishing','character.bach.down','character.player.up','library.couch-coral-east','library.couch-coral-west','library.notes-register','pet.cosmiccat.down']:self.assertIn(id,ids)
   page.evaluate("CodaOfflineArt.select('character.bach.down')")
   page.wait_for_function("()=>CodaOfflineArt.editor.getState().target==='character.bach.down'&&!CodaOfflineArt.editor.getState().loading")
   self.assertEqual(page.get_by_label('Hair style',exact=True).locator('option').count(),17)
   self.assertEqual(page.get_by_label('Form',exact=True).locator('option').count(),5)
   self.assertGreaterEqual(page.get_by_label('Accessory',exact=True).locator('option').count(),50)
   page.get_by_label('Hat / headwear',exact=True).select_option('grandstaffcrown')
   page.get_by_label('Outfit',exact=True).select_option('tuxedo')
   self.assertEqual(page.evaluate('CodaOfflineArt.getState().profiles.bach.headwear'),'grandstaffcrown')
   page.once('dialog',lambda d:d.accept('32 x 24'));page.locator('#new').click()
   page.wait_for_function("()=>CodaOfflineArt.getState().selected.startsWith('custom.')&&!CodaOfflineArt.editor.getState().loading")
   custom_id=page.evaluate('CodaOfflineArt.getState().selected')
   page.locator('[data-artwork-fit]').click();page.locator('[data-artwork-tool]').select_option('fill')
   canvas=page.locator('[data-artwork-canvas]');canvas.scroll_into_view_if_needed();info=page.evaluate('CodaOfflineArt.editor.getState()');box=canvas.bounding_box();x=box['x']+info['pan']['x']+4*info['zoom'];y=box['y']+info['pan']['y']+4*info['zoom'];page.mouse.click(x,y)
   page.wait_for_function('id=>!!CodaOfflineArt.getState().artwork[id]',arg=custom_id)
   page.locator('[data-artwork-undo]').click();page.wait_for_function('id=>!CodaOfflineArt.getState().artwork[id]',arg=custom_id)
   page.locator('[data-artwork-redo]').click();page.wait_for_function('id=>!!CodaOfflineArt.getState().artwork[id]',arg=custom_id)
   def point(x,y):
    canvas.scroll_into_view_if_needed();state=page.evaluate('CodaOfflineArt.editor.getState()');box=canvas.bounding_box()
    return box['x']+(state['pan']['x']+(x+.5)*state['zoom'])*box['width']/state['viewport']['width'],box['y']+(state['pan']['y']+(y+.5)*state['zoom'])*box['height']/state['viewport']['height']
   def drag(a,b):
    page.mouse.move(*point(*a));page.mouse.down();page.mouse.move(*point(*b),steps=6);page.mouse.up()
   def color(x,y):
    return page.evaluate('''async ({id,x,y})=>{const s=CodaOfflineArt.getState(),image=new Image();image.src=s.custom[id].data;await image.decode();return [...CodaArtworkEditor.compose(image,s.artwork[id]).getContext('2d').getImageData(x,y,1,1).data];}''',{'id':custom_id,'x':x,'y':y})
   page.locator('[data-artwork-tool]').select_option('pencil');page.get_by_label('Brush size in pixels',exact=True).fill('5');page.get_by_label('Brush size in pixels',exact=True).press('Tab')
   page.locator('[data-artwork-hex]').fill('#123456ff');page.locator('[data-artwork-hex]').press('Tab');page.mouse.click(*point(8,8))
   self.assertEqual(color(6,6),[18,52,86,255]);self.assertNotEqual(color(5,5),[18,52,86,255])
   page.locator('[data-artwork-tool]').select_option('rectangle');page.get_by_label('Brush size in pixels',exact=True).fill('1');page.get_by_label('Brush size in pixels',exact=True).press('Tab');page.locator('[data-artwork-hex]').fill('#00ff00ff');page.locator('[data-artwork-hex]').press('Tab');drag((4,4),(14,14))
   self.assertEqual(color(4,4),[0,255,0,255]);self.assertNotEqual(color(8,8),[0,255,0,255])
   page.locator('[data-artwork-tool]').select_option('ellipse');page.get_by_label('Shape fill',exact=True).select_option('solid');page.locator('[data-artwork-hex]').fill('#00ffffff');page.locator('[data-artwork-hex]').press('Tab');drag((19,5),(29,17))
   self.assertEqual(color(24,11),[0,255,255,255]);self.assertNotEqual(color(19,5),[0,255,255,255])
   page.locator('[data-artwork-tool]').select_option('select');page.get_by_label('Selection shape',exact=True).select_option('freehand')
   page.mouse.move(*point(2,2));page.mouse.down()
   for xy in [(16,2),(16,19),(2,19),(2,2)]:page.mouse.move(*point(*xy),steps=4)
   page.mouse.up();self.assertIsNotNone(page.evaluate('CodaOfflineArt.editor.getState().selection.points'))
   outside=color(28,21);page.locator('[data-artwork-fill-selection]').click();self.assertEqual(color(28,21),outside)
   page.locator('[data-artwork-clear-selection]').click();page.locator('[data-artwork-tool]').select_option('smooth');page.get_by_label('Smoothing brush radius',exact=True).fill('3');page.get_by_label('Smoothing strength',exact=True).fill('80');page.get_by_label('Smoothing strength',exact=True).press('Tab');before_blend=color(16,12);drag((15,12),(17,12));self.assertNotEqual(color(16,12),before_blend)
   page.locator('[data-artwork-tool]').select_option('select');page.get_by_label('Selection shape',exact=True).select_option('freehand');page.mouse.move(*point(3,3));page.mouse.down();page.mouse.move(*point(14,3),steps=3);page.keyboard.press('Escape');page.mouse.up()
   self.assertEqual(page.evaluate('CodaOfflineArt.editor.getState().draftSelection'),[]);self.assertIsNone(page.evaluate('CodaOfflineArt.editor.getState().selection'))
   with page.expect_download() as png_download:page.locator('[data-artwork-export]').click()
   png_path=Path('/workspace/scratch/offline-custom-art.png');png_download.value.save_as(png_path)
   import struct
   self.assertEqual(struct.unpack('>II',png_path.read_bytes()[16:24]),(32,24))
   with page.expect_download() as pending:page.locator('#save').click()
   output=Path('/workspace/scratch/art-edited-test.json');pending.value.save_as(output)
   saved=json.loads(output.read_text());self.assertEqual(saved['appearances']['bach']['outfit'],'tuxedo');self.assertIn(custom_id,saved['artwork']);self.assertIn(custom_id,saved['custom'])
   page.locator('#json-file').set_input_files(output);page.wait_for_function("()=>document.querySelector('#status').textContent.startsWith('Opened edits')")
   self.assertEqual(page.evaluate('CodaOfflineArt.exportPack().artwork'),saved['artwork'])
   self.assertEqual(page.evaluate('CodaOfflineArt.exportPack().appearances'),saved['appearances'])
   before=page.evaluate('JSON.stringify(CodaOfflineArt.exportPack())')
   rejected=page.evaluate("async()=>{const p=CodaOfflineArt.exportPack();p.artwork['missing.asset']={width:1,height:1,tiles:{}};try{await CodaOfflineArt.importPack(p);return false}catch{return true}}")
   self.assertTrue(rejected);self.assertEqual(page.evaluate('JSON.stringify(CodaOfflineArt.exportPack())'),before)
   page.evaluate("CodaOfflineArt.select('library.couch-coral-east')");page.wait_for_function("()=>CodaOfflineArt.editor.getState().target==='library.couch-coral-east'&&!CodaOfflineArt.editor.getState().loading")
   page.screenshot(path='/workspace/scratch/coda-pixel-studio-preview.png',full_page=True)
   page.set_viewport_size({'width':390,'height':844});self.assertTrue(page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   self.assertEqual(errors,[]);self.assertFalse(any(url.startswith(('http:','https:')) for url in requests),requests)
   context.close();browser.close()

if __name__=='__main__':unittest.main(verbosity=2)
