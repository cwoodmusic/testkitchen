"""Exercise the developer camera through real mouse, keyboard, and touch input."""
import importlib.util
import json
from pathlib import Path
from world_navigation_helpers import advance_world, enter_room, open_destination, talk_to_musician, open_settings, close_settings
import sys
import unittest

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location('world_editor_camera_base', Path(__file__).with_name('developer-console-browser.py'))
_base = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_base)


class EditorCameraTests(unittest.TestCase):
    setUpClass = classmethod(_base.WorldEditorTests.setUpClass.__func__)
    tearDownClass = classmethod(_base.WorldEditorTests.tearDownClass.__func__)
    setUp = _base.WorldEditorTests.setUp
    tearDown = _base.WorldEditorTests.tearDown
    project = _base.WorldEditorTests.project
    point = _base.WorldEditorTests.point
    tab = _base.WorldEditorTests.tab

    def camera(self):
        return self.page.evaluate('CodaArcadeQA.camera()')

    def zoom(self, value):
        self.page.evaluate('value=>CodaArcadeQA.setZoom(value)', value)
        self.page.wait_for_function('value=>CodaArcadeQA.camera().zoom===value', arg=value)

    def drag(self, button='left', dx=120, dy=65):
        box = self.page.locator('#view').bounding_box()
        x,y = box['x'] + box['width']*.66, box['y'] + box['height']*.50
        self.page.mouse.move(x,y)
        self.page.mouse.down(button=button)
        self.page.mouse.move(x+dx,y+dy,steps=6)
        self.page.mouse.up(button=button)
        return box

    def test_layers_shortcut_and_tab_switching_keep_zoom_and_camera_position(self):
        self.page.locator('#assetClose').click()
        self.zoom(2.5)
        self.page.wait_for_timeout(400)
        before = self.camera()
        width = self.page.locator('#view').bounding_box()['width']
        self.page.locator('#view').focus();self.page.keyboard.press('Shift+L')
        self.assertEqual(self.page.locator('#devTab-layers').get_attribute('aria-selected'), 'true')
        for tab in ['objects','collision','layers','dialogue','pixels','project','layers']:
            self.tab(tab)
            self.page.wait_for_timeout(60)
            actual = self.camera()
            self.assertEqual(actual['targetZoom'],2.5)
            self.assertAlmostEqual(actual['zoom'],2.5,delta=.001)
            self.assertAlmostEqual(actual['x'],before['x'],delta=.1)
            self.assertAlmostEqual(actual['y'],before['y'],delta=.1)
            self.assertAlmostEqual(self.page.locator('#view').bounding_box()['width'],width,delta=.1)
        self.assertEqual(self.page.locator('#devZoomReset').inner_text(),'250%')
        self.assertEqual(self.page.locator('#layerEditor:visible').count(),0,'The legacy layer panel must not open alongside the console')
        self.zoom(6)
        before=self.camera()
        self.page.locator('#view').focus();self.page.keyboard.press('Shift+L');self.page.wait_for_timeout(80)
        actual=self.camera()
        self.assertEqual(actual['zoom'],6,'Opening Layers while already editing must retain detailed zoom above the gameplay limit')
        self.assertAlmostEqual(actual['x'],before['x'],delta=.1)
        self.assertAlmostEqual(actual['y'],before['y'],delta=.1)

    def test_wheel_anchors_details_and_all_tabs_keep_keyboard_zoom_to_eight_times(self):
        self.tab('layers');self.zoom(2)
        box=self.page.locator('#view').bounding_box()
        x,y=round(box['x']+box['width']*.66),round(box['y']+box['height']*.5)
        before=self.camera()
        anchor={'x':before['x']+(x-box['x'])*1672/box['width']/before['zoom'],
                'y':before['y']+(y-box['y'])*941/box['height']/before['zoom']}
        self.page.mouse.move(x,y);self.page.mouse.wheel(0,-120)
        self.page.wait_for_function('CodaArcadeQA.camera().zoom===2.25')
        after=self.camera()
        self.assertAlmostEqual(after['x']+(x-box['x'])*1672/box['width']/after['zoom'],anchor['x'],delta=.05)
        self.assertAlmostEqual(after['y']+(y-box['y'])*941/box['height']/after['zoom'],anchor['y'],delta=.05)
        self.zoom(7.75)
        for tab in ['collision','layers','dialogue','pixels','project','objects']:
            self.tab(tab)
            self.page.keyboard.press('+')
            self.assertEqual(self.camera()['targetZoom'],8)
            self.assertTrue(self.page.locator('#devZoomIn').is_disabled())
            self.page.keyboard.press('-')
            self.assertEqual(self.camera()['targetZoom'],7.75)
        self.page.locator('#devZoomReset').click()
        self.page.wait_for_function('CodaArcadeQA.camera().zoom===1')
        self.assertEqual(self.page.locator('#devZoomReset').inner_text(),'100%')

    def test_right_middle_space_and_pan_tool_drag_without_editing_the_project(self):
        self.zoom(3)
        for tab,button,space,pan in [('layers','right',False,False),('collision','middle',False,False),('objects','left',True,False),('layers','left',False,True)]:
            self.tab(tab)
            before=self.camera();project=self.project();player=self.page.evaluate('CodaArcadeQA.position()')
            if pan:self.page.locator('#devPan').click()
            if space:
                self.page.locator('#view').focus();self.page.keyboard.down('Space')
            box=self.drag(button=button)
            if space:self.page.keyboard.up('Space')
            after=self.camera()
            self.assertAlmostEqual(after['x'],before['x']-120*1672/box['width']/3,delta=.1)
            self.assertAlmostEqual(after['y'],before['y']-65*941/box['height']/3,delta=.1)
            self.assertEqual(self.project(),project,'Moving the view must not paint, lift objects, or add history')
            self.assertEqual(self.page.evaluate('CodaArcadeQA.position()'),player)
            self.assertFalse(self.page.locator('#view').evaluate("c=>c.classList.contains('dev-panning')"))
            if pan:self.page.locator('#devPan').click()
        self.page.locator('#view').focus();self.page.keyboard.down('Space')
        self.page.evaluate("window.dispatchEvent(new Event('blur'))")
        self.assertFalse(self.page.locator('#view').evaluate("c=>c.classList.contains('dev-pan-ready')"))
        self.page.keyboard.up('Space')

    def test_touch_pan_button_does_not_paint_and_layers_paint_uses_zoomed_world_pixels(self):
        self.tab('layers');self.zoom(3)
        project=self.project();before=self.camera()
        self.page.locator('#devPan').click()
        box=self.page.locator('#view').bounding_box()
        x,y=box['x']+box['width']*.68,box['y']+box['height']*.5
        cdp=self.context.new_cdp_session(self.page)
        def touch(kind, px=None, py=None):
            cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[] if kind=='touchEnd' else [{'x':px,'y':py,'id':1}]})
        touch('touchStart',x,y)
        for i in range(1,7):touch('touchMove',x+120*i/6,y+60*i/6)
        touch('touchEnd')
        self.assertLess(self.camera()['x'],before['x']-20)
        self.assertEqual(self.project(),project)
        self.page.locator('#devPan').click()
        self.page.locator('#devLayerSize').select_option('1')
        camera=self.camera();wx,wy=int(camera['x']+1672/3*.64),int(camera['y']+941/3*.53)
        point=self.point(wx+.5,wy+.5)
        self.page.mouse.click(**point)
        strokes=self.project()['strokes']
        self.assertEqual(len(strokes),1)
        self.assertEqual(strokes[0]['size'],1)
        self.assertEqual(strokes[0]['points'],[[wx,wy]])
        self.page.locator('#devUndo').click()
        self.assertEqual(self.project()['strokes'],[])


    def test_phone_editor_keeps_the_clipped_map_scale_and_has_visible_touch_pan_controls(self):
        self.page.locator('#view').focus();self.page.keyboard.press('F2')
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.wait_for_function('CodaArcadeQA.touch().mobile')
        self.zoom(2)
        self.page.evaluate('window.scrollTo(0,0)')
        def framing():
            return self.page.evaluate("""()=>{
              const b=view.getBoundingClientRect(),v=worldStage.getBoundingClientRect(),camera=CodaArcadeQA.camera();
              return {scale:camera.zoom*b.width/1672,width:b.width,height:v.height,
                x:camera.x+(v.left+v.width/2-b.left)*1672/b.width/camera.zoom,
                y:camera.y+(v.top+v.height/2-b.top)*941/b.height/camera.zoom,
                camera};
            }""")
        self.page.wait_for_timeout(350)
        before=framing()
        self.page.locator('#view').focus();self.page.keyboard.press('F2')
        self.page.wait_for_timeout(100)
        after=framing()
        self.assertAlmostEqual(after['scale'],before['scale'],delta=.001)
        self.assertAlmostEqual(after['width'],before['width'],delta=.1)
        self.assertAlmostEqual(after['height'],before['height'],delta=.1)
        self.assertAlmostEqual(after['x'],before['x'],delta=.1)
        self.assertAlmostEqual(after['y'],before['y'],delta=.1)
        button=self.page.locator('#devPan').bounding_box()
        self.assertIsNotNone(button)
        self.assertGreaterEqual(button['y'],0)
        self.assertLess(button['y']+button['height'],844,'Camera controls must be visible on the map while tools live below it')
        self.page.locator('#devPan').click()
        original=self.project();before=self.camera()
        cdp=self.context.new_cdp_session(self.page)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':270,'y':440,'id':1}]})
        for i in range(1,7):
            cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':270+60*i/6,'y':440+50*i/6,'id':1}]})
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        self.assertLess(self.camera()['x'],before['x']-10)
        self.assertEqual(self.project(),original)
        self.page.screenshot(path='/tmp/coda-editor-camera33-phone.png')


if __name__ == '__main__':
    unittest.main(verbosity=2)
