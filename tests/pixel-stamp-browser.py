"""Repeatable, resized stamps use selected source pixels without clipboard writes."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]

def fixture(name,filename):
 spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(filename))
 module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
art=fixture('stamp_artwork_fixture','artwork-editor-browser.py')
sprite=fixture('stamp_sprite_fixture','pixel-editor-browser.py')

class ArtworkStampTests(unittest.TestCase):
 setUpClass=classmethod(art.ArtworkEditorBrowserTests.setUpClass.__func__)
 tearDownClass=classmethod(art.ArtworkEditorBrowserTests.tearDownClass.__func__)
 setUp=art.ArtworkEditorBrowserTests.setUp
 tearDown=art.ArtworkEditorBrowserTests.tearDown
 editor=art.ArtworkEditorBrowserTests.editor
 state=art.ArtworkEditorBrowserTests.state
 host=art.ArtworkEditorBrowserTests.host
 control=art.ArtworkEditorBrowserTests.control
 ready=art.ArtworkEditorBrowserTests.ready
 frames=art.ArtworkEditorBrowserTests.frames
 load_fixture=art.ArtworkEditorBrowserTests.load_fixture
 point=art.ArtworkEditorBrowserTests.point
 center=art.ArtworkEditorBrowserTests.center
 select_rectangle=art.ArtworkEditorBrowserTests.select_rectangle
 select=art.ArtworkEditorBrowserTests.select
 def click(self,x,y,control=False):
  self.control('canvas').scroll_into_view_if_needed()
  if control:self.page.keyboard.down('Control')
  try:self.page.mouse.click(**self.point(x,y))
  finally:
   if control:self.page.keyboard.up('Control')
  self.frames()
 def test_resize_repeat_transparency_undo_and_picker_return(self):
  self.load_fixture();self.select_rectangle((30,20),(31,21))
  source=self.page.evaluate("()=>[[30,20],[31,20],[30,21],[31,21]].map(([x,y])=>fixturePixel('background.fixture',x,y))")
  self.page.evaluate('CodaPixelSelection.clipboard.set({width:1,height:1,pixels:new Uint8ClampedArray([1,2,3,4])})')
  self.control('stamp').click();self.click(30,20,True)
  self.assertTrue(self.state()['stampReady']);self.assertEqual(self.page.evaluate('artworkChanges.length'),0)
  self.assertEqual(self.page.evaluate('Array.from(CodaPixelSelection.clipboard.get().pixels)'),[1,2,3,4])
  self.control('stamp-width').fill('4');self.control('stamp-height').fill('4')
  self.page.get_by_role('button',name='Clear selection',exact=True).click()
  self.assertEqual(self.state()['stampSize'],{'width':4,'height':4})
  self.click(40,30);self.click(48,30)
  expected=[source[(y//2)*2+x//2] for y in range(4) for x in range(4)]
  for left in [40,48]:
   actual=self.page.evaluate("left=>Array.from({length:16},(_,i)=>fixturePixel('background.fixture',left+i%4,30+Math.floor(i/4)))",left)
   self.assertEqual(actual,expected)
  self.assertEqual(self.page.evaluate('artworkChanges.length'),2)
  self.control('undo').click();self.ready()
  self.assertTrue(self.state()['stampReady'],'Undo must preserve the frozen source for repeated stamping')
  self.assertEqual(self.page.evaluate('artworkUndo.length'),1)
  self.control('picker').click();self.click(30,20)
  self.assertEqual(self.state()['tool'],'stamp');self.assertEqual(self.page.evaluate('artworkChanges.length'),2)
  self.click(54,30);self.assertEqual(self.page.evaluate('artworkChanges.length'),3)
  self.select_rectangle((30,20),(31,21));self.control('stamp').click()
  self.click(30,20,True);self.assertEqual(self.state()['stampSize'],{'width':4,'height':4},'Explicit output size survives recapture')
  self.page.locator('[data-artwork-canvas]').focus();self.page.keyboard.press('Escape')
  self.assertFalse(self.state()['stampReady'])
 def test_capture_is_not_edit_preview_export_is_clean_and_edges_are_clipped(self):
  self.load_fixture();self.control('stamp').click();self.click(10,10,True)
  self.assertFalse(self.state()['stampReady']);self.assertEqual(self.page.evaluate('artworkChanges.length'),0)
  self.select_rectangle((30,20),(31,21));self.control('stamp').click();self.click(30,20,True)
  self.page.get_by_role('button',name='Clear selection',exact=True).click()
  self.page.mouse.move(**self.point(40,30));self.frames()
  self.assertEqual(self.page.evaluate('artworkData'),{})
  with self.page.expect_download() as pending:self.control('export').click()
  from PIL import Image
  with Image.open(pending.value.path()) as image:
   self.assertEqual(list(image.getpixel((40,30))),self.page.evaluate("fixturePixel('background.fixture',40,30)"))
  self.click(63,47);self.assertEqual(self.page.evaluate('artworkChanges.length'),1)
  self.assertEqual(self.page.evaluate("fixturePixel('background.fixture',63,47)"),self.page.evaluate("fixturePixel('background.fixture',30,20)"))
  self.page.evaluate('fixtureCanEdit=false;fixtureEditor.refresh()');self.ready()
  self.assertTrue(self.control('stamp-width').is_disabled())
  self.click(50,35);self.assertEqual(self.page.evaluate('artworkChanges.length'),1)
  self.page.evaluate('fixtureCanEdit=true');self.select('asset.large')
  self.assertFalse(self.state()['stampReady'])

 def test_landscape_stamp_and_asset_controls_remain_reachable(self):
  self.load_fixture()
  self.page.evaluate("fixtureEditor.dispose();fixtureEditor=CodaArtworkEditor.mount({...fixtureEditorOptions,hasAssetPreview:()=>true,drawAssetPreview:()=>{}})")
  self.ready();self.select_rectangle((30,20),(31,21));self.control('stamp').click();self.click(30,20,True)
  self.page.set_viewport_size({'width':844,'height':390});self.page.evaluate('fixtureEditor.setExpanded(true)');self.frames()
  for name in ['stamp-width','stamp-height','capture-stamp','assets','export','exit']:
   control=self.control(name);control.scroll_into_view_if_needed();self.assertTrue(control.is_visible(),name)
   box=control.bounding_box();self.assertGreaterEqual(box['x'],0,name);self.assertLessEqual(box['x']+box['width'],845,name)
  self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
  self.control('stamp-width').fill('4');self.assertEqual(self.state()['stampSize']['width'],4)

class SpriteStampTests(unittest.TestCase):
 setUpClass=classmethod(sprite.PixelEditorTests.setUpClass.__func__)
 tearDownClass=classmethod(sprite.PixelEditorTests.tearDownClass.__func__)
 setUp=sprite.PixelEditorTests.setUp
 tearDown=sprite.PixelEditorTests.tearDown
 def point(self,x,y):
  canvas=self.page.locator('#pixelEditCanvas');canvas.scroll_into_view_if_needed();box=canvas.bounding_box();zoom=self.page.evaluate('editor.getState().zoom');return {'x':box['x']+(x+.5)*zoom,'y':box['y']+(y+.5)*zoom}
 def click(self,x,y,control=False):
  point=self.point(x,y)
  if control:self.page.keyboard.down('Control')
  try:self.page.mouse.click(**point)
  finally:
   if control:self.page.keyboard.up('Control')
 def select_rect(self,a,b):
  self.page.get_by_label('Pixel tool',exact=True).select_option('select');self.page.mouse.move(**self.point(*a));self.page.mouse.down();self.page.mouse.move(**self.point(*b));self.page.mouse.up()
 def test_selected_sprite_stamp_resizes_and_repeats_without_changing_clipboard(self):
  self.page.get_by_label('Animate sprite preview',exact=True).uncheck()
  self.page.evaluate("data=CodaPixelEditor.changePixels({},'player','down',[[40,45]],'#12345680');data=CodaPixelEditor.changePixels(data,'player','down',[[41,45]],null);renderer.setPixelEdits(data);editor.refresh();changes=[]")
  source=self.page.evaluate("()=>[[40,45],[41,45],[40,46],[41,46]].map(([x,y])=>framePixel('player',x,y))")
  self.select_rect((40,45),(41,46));self.page.get_by_role('button',name='Stamp',exact=True).click();self.click(40,45,True)
  self.assertEqual(self.page.evaluate('changes.length'),0)
  self.page.locator('[data-pixel-stamp-width]').fill('4');self.page.locator('[data-pixel-stamp-height]').fill('4')
  self.click(44,47);self.click(50,47)
  expected=[source[(y//2)*2+x//2] for y in range(4) for x in range(4)]
  for left in [44,50]:self.assertEqual(self.page.evaluate("left=>Array.from({length:16},(_,i)=>framePixel('player',left+i%4,47+Math.floor(i/4)))",left),expected)
  self.assertEqual(self.page.evaluate('changes.length'),2)
  self.page.get_by_role('button',name='Eyedropper',exact=True).click();self.click(40,45)
  self.assertEqual(self.page.evaluate('editor.getState().tool'),'stamp')
  self.assertEqual(self.page.evaluate('changes.length'),2)
  self.page.mouse.move(**self.point(56,47));self.page.locator('#pixelEditCanvas').focus();self.page.keyboard.down('Enter');self.page.keyboard.down('Enter');self.page.keyboard.up('Enter')
  self.assertEqual(self.page.evaluate('changes.length'),3,'Holding Enter must not stamp repeatedly')
  self.page.keyboard.press('Escape');self.assertFalse(self.page.evaluate('editor.getState().stampReady'))
  self.page.keyboard.press('s');self.click(40,45,True);self.assertTrue(self.page.evaluate('editor.getState().stampReady'))
  self.page.get_by_label('Sprite direction',exact=True).select_option('left');self.assertFalse(self.page.evaluate('editor.getState().stampReady'))

if __name__=='__main__':unittest.main(verbosity=2)
