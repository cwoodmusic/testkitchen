"""Smooth actual gradient pixels, protect details, and select/paste custom shapes."""
import importlib.util
from pathlib import Path
import sys
import unittest
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('smooth_art_fixture',Path(__file__).with_name('artwork-editor-browser.py'))
art=importlib.util.module_from_spec(spec);spec.loader.exec_module(art)

class ArtworkSmoothingTests(unittest.TestCase):
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
    select=art.ArtworkEditorBrowserTests.select
    select_rectangle=art.ArtworkEditorBrowserTests.select_rectangle

    def step_source(self):
        self.load_fixture()
        self.page.evaluate('''()=>{
          fixtureEditor.dispose();const pixels=sourceContext.createImageData(64,48);
          for(let y=0;y<48;y++)for(let x=0;x<64;x++)pixels.data.set(x<32?[32,70,100,255]:[224,180,210,255],(y*64+x)*4);
          pixels.data.set([32,70,100,128],(20*64+31)*4);pixels.data.set([0,0,0,0],(20*64+32)*4);
          sourceContext.putImageData(pixels,0,0);window.smoothBaseline=sourceContext.getImageData(0,0,64,48).data.slice();
          artworkData={};artworkChanges=[];artworkUndo=[];artworkRedo=[];
          fixtureEditor=CodaArtworkEditor.mount(fixtureEditorOptions);
        }''')
        self.ready('background.fixture');self.control('zoom').select_option('4');self.frames();self.center(32,24)

    def pixel(self,x,y):return self.page.evaluate("([x,y])=>fixturePixel('background.fixture',x,y)",[x,y])
    def click(self,x,y):
        self.control('canvas').scroll_into_view_if_needed();self.page.mouse.click(**self.point(x,y));self.frames()
    def drag(self,a,b):
        self.control('canvas').scroll_into_view_if_needed();self.page.mouse.move(**self.point(*a));self.page.mouse.down();self.page.mouse.move(**self.point(*b),steps=8);self.page.mouse.up();self.frames()
    def smooth(self,radius=8,strength=100):
        self.control('tool').select_option('smooth')
        self.page.get_by_label('Smoothing brush radius',exact=True).fill(str(radius))
        self.page.get_by_label('Smoothing strength',exact=True).fill(str(strength))
        self.page.get_by_label('Smoothing strength',exact=True).press('Tab');self.frames()

    def test_smoothing_blends_existing_colour_preserves_alpha_and_is_one_undo(self):
        self.step_source();self.smooth();before=self.pixel(31,18);untouched=self.pixel(1,1)
        self.control('hex').fill('#00ff00ff');self.control('hex').press('Tab')
        self.drag((32,10),(32,30));after=self.pixel(31,18)
        self.assertGreater(after[0],before[0]);self.assertLess(after[0],224)
        self.assertEqual(self.pixel(1,1),untouched)
        self.assertTrue(self.page.evaluate('''()=>{
          const edited=CodaArtworkEditor.compose(source,artworkData['background.fixture']).getContext('2d').getImageData(0,0,64,48).data;
          return Array.from({length:64*48},(_,i)=>edited[i*4+3]===smoothBaseline[i*4+3]).every(Boolean);
        }'''))
        self.assertEqual(self.page.evaluate('artworkChanges.length'),1)
        self.control('undo').click();self.ready();self.assertEqual(self.pixel(31,18),before)
        self.control('redo').click();self.ready();self.assertEqual(self.pixel(31,18),after)
        with self.page.expect_download() as pending:self.control('export').click()
        from PIL import Image
        with Image.open(pending.value.path()) as image:self.assertEqual(list(image.getpixel((31,18))),after)

    def test_protection_mask_is_separate_from_art_and_masks_smoothing(self):
        self.step_source();self.smooth(radius=6)
        self.control('tool').select_option('protect');before=self.pixel(31,18);self.click(31,18)
        protected=self.state()['protection']['count'];self.assertGreater(protected,0)
        self.assertEqual(self.page.evaluate('artworkChanges.length'),0);self.assertEqual(self.pixel(31,18),before)
        self.smooth(radius=12);self.drag((32,10),(32,32));self.assertEqual(self.pixel(31,18),before)
        self.assertGreater(self.page.evaluate('artworkChanges.length'),0)
        self.page.get_by_label('Show protection mask',exact=True).uncheck();self.assertFalse(self.state()['protection']['visible'])
        self.page.get_by_role('button',name='Clear protection mask',exact=True).click();self.assertEqual(self.state()['protection']['count'],0)
        self.select('asset.large');self.assertEqual(self.state()['protection']['count'],0)

    def test_manual_selection_copies_only_its_shape_and_keeps_transparent_selected_pixels(self):
        self.step_source();self.control('tool').select_option('select')
        self.page.get_by_label('Selection shape',exact=True).select_option('manual')
        for p in [(20,10),(44,10),(20,34)]:self.click(*p)
        self.page.get_by_role('button',name='Finish selection',exact=True).click()
        self.assertEqual(len(self.state()['selection']['points']),3)
        self.control('copy').click();clip=self.page.evaluate('()=>{const c=CodaPixelSelection.clipboard.get();return {width:c.width,height:c.height,mask:Array.from(c.mask)}}')
        self.assertEqual(clip['mask'][-1],0);self.assertEqual(clip['mask'][0],1)
        outer_before=self.pixel(59,44)
        self.page.get_by_role('button',name='Clear selection',exact=True).click()
        self.control('paste').click();self.click(35,20)
        self.assertEqual(self.pixel(59,44),outer_before,'Outside the custom shape must not be erased')
        self.assertIsNone(self.state()['selection'],'A pasted shape must not become a rectangular selection')
        self.assertEqual(self.pixel(47,30)[3],0,'A transparent pixel inside the selected shape must clear its destination')
        self.assertEqual(self.page.evaluate('artworkChanges.length'),1)
        self.control('undo').click();self.ready();self.assertNotEqual(self.pixel(47,30)[3],0)

    def test_custom_shape_clips_smoothing_and_can_become_a_protection_mask(self):
        self.step_source();self.control('tool').select_option('select');self.page.get_by_label('Selection shape',exact=True).select_option('manual')
        for p in [(28,10),(36,10),(28,30)]:self.click(*p)
        self.page.get_by_role('button',name='Finish selection',exact=True).click()
        outside=self.pixel(35,29);before=self.pixel(31,17);self.smooth();self.click(32,18)
        self.assertEqual(self.pixel(35,29),outside);self.assertNotEqual(self.pixel(31,17),before)
        self.page.get_by_role('button',name='Protect selection',exact=True).click()
        state=self.state();self.assertGreater(state['protection']['count'],0)
        self.assertLess(state['protection']['count'],state['selection']['width']*state['selection']['height'])
        self.page.get_by_role('button',name='Clear selection',exact=True).click();self.assertIsNone(self.state()['selection']);self.assertEqual(self.state()['protection']['count'],state['protection']['count'])

    def test_cancel_readonly_keyboard_and_picker_return(self):
        self.step_source();self.smooth();before=self.pixel(31,18)
        self.page.mouse.move(**self.point(32,18));self.page.mouse.down();self.page.mouse.move(**self.point(32,25));self.page.keyboard.press('Escape');self.page.mouse.up();self.frames()
        self.assertEqual(self.page.evaluate('artworkChanges.length'),0);self.assertEqual(self.pixel(31,18),before)
        self.control('picker').click();self.click(31,18);self.assertEqual(self.state()['tool'],'smooth')
        self.control('canvas').focus();self.page.keyboard.press('u');self.page.keyboard.press('Enter');self.frames()
        self.assertEqual(self.page.evaluate('artworkChanges.length'),1)
        self.page.evaluate('fixtureCanEdit=false;fixtureEditor.refresh()');self.ready()
        self.assertTrue(self.page.get_by_label('Smoothing brush radius',exact=True).is_disabled())
        self.click(32,20);self.assertEqual(self.page.evaluate('artworkChanges.length'),1)

    def test_landscape_brush_mask_and_manual_shape_controls_remain_reachable(self):
        self.step_source();self.page.set_viewport_size({'width':844,'height':390});self.page.evaluate('fixtureEditor.setExpanded(true)');self.frames();self.smooth()
        for label in ['Smoothing brush radius','Smoothing strength','Show protection mask']:
            control=self.page.get_by_label(label,exact=True);control.scroll_into_view_if_needed();self.assertTrue(control.is_visible());box=control.bounding_box();self.assertGreaterEqual(box['x'],0);self.assertLessEqual(box['x']+box['width'],845)
        canvas=self.control('canvas').bounding_box();self.assertGreater(canvas['width'],400);self.assertGreater(canvas['height'],250);self.assertLessEqual(canvas['y']+canvas['height'],390)
        self.control('tool').select_option('select');self.page.get_by_label('Selection shape',exact=True).select_option('manual')
        control=self.page.get_by_role('button',name='Finish selection',exact=True);control.scroll_into_view_if_needed();box=control.bounding_box();self.assertGreaterEqual(box['x'],0);self.assertLessEqual(box['x']+box['width'],845)
        self.page.screenshot(path='/tmp/coda-smoothing-landscape.png')

if __name__=='__main__':unittest.main(verbosity=2)
