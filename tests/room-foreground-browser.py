"""Foreground painting must use current room art, including placed assets.

Runs actual Piano Lab and Fishing Cave renderers in disposable guest contexts.
A known solid image gives an independent visible-pixel witness for masking.
"""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
_spec=importlib.util.spec_from_file_location('room_foreground_fixture',Path(__file__).with_name('room-developer-browser.py'))
fixture=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(fixture)


class RoomForegroundTests(unittest.TestCase):
    setUpClass=classmethod(fixture.RoomDeveloperTests.setUpClass.__func__)
    tearDownClass=classmethod(fixture.RoomDeveloperTests.tearDownClass.__func__)
    setUp=fixture.RoomDeveloperTests.setUp
    tearDown=fixture.RoomDeveloperTests.tearDown
    load=fixture.RoomDeveloperTests.load
    route_checkout=fixture.RoomDeveloperTests.route_checkout
    state=fixture.RoomDeveloperTests.state
    project=fixture.RoomDeveloperTests.project
    room_state=fixture.RoomDeveloperTests.room_state
    panel=fixture.RoomDeveloperTests.panel
    action=fixture.RoomDeveloperTests.action
    tab=fixture.RoomDeveloperTests.tab
    canvas=fixture.RoomDeveloperTests.canvas
    enter=fixture.RoomDeveloperTests.enter
    open_editor=fixture.RoomDeveloperTests.open_editor
    point=fixture.RoomDeveloperTests.point
    pixel=fixture.RoomDeveloperTests.pixel
    field=fixture.RoomDeveloperTests.field

    def setup_room(self,room):
        for existing,button in (('piano','#closepiano'),('fishing','#fishingClose')):
            if self.room_state(existing)['open']:
                self.page.evaluate('id=>CodaArcadeQA.roomEditor(id).close()',existing)
                self.page.locator(button).click()
        self.enter(room);self.open_editor(room)
        self.action(room,'dock').click()
        player=self.room_state(room)['player']
        return player['x'],player['y']-30

    def apply(self,room,project):
        self.assertTrue(self.page.evaluate('([id,p])=>CodaArcadeQA.roomEditor(id).applyProject(p)',[room,project]))
        self.page.clock.run_for(64)

    def solid_asset(self,x,y,layer='background'):
        image=self.page.evaluate('''()=>{const c=document.createElement('canvas');c.width=c.height=8;const g=c.getContext('2d');g.fillStyle='#ee09ce';g.fillRect(0,0,8,8);return c.toDataURL();}''')
        return {'id':'mask-witness','name':'Solid masking witness','x':x,'y':y,'w':80,'h':80,'layer':layer,'visible':True,'data':image}

    def paint(self,room,x,y,tool):
        self.tab(room,'layers')
        if self.action(room,'show-layers').get_attribute('aria-pressed')=='true':self.action(room,'show-layers').click()
        self.panel(room).locator('[data-room-field="layer-tool"]').select_option(tool)
        self.panel(room).locator('[data-room-field="layer-size"]').select_option('16')
        self.page.mouse.click(**self.point(room,x,y))
        self.page.mouse.move(1,1);self.page.clock.run_for(48)

    def leave(self,room):
        self.action(room,'close').click()
        self.page.locator('#closepiano' if room=='piano' else '#fishingClose').click()

    def test_paint_promotes_actual_uploaded_asset_pixels_and_erase_restores_actor(self):
        for room in ('piano','fishing'):
            with self.subTest(room=room):
                x,y=self.setup_room(room);actor=self.pixel(room,x,y)
                project=self.project(room);project['assets']=[self.solid_asset(x,y)]
                self.apply(room,project)
                self.page.evaluate('id=>CodaArcadeQA.roomEditor(id).getArtworkSource("room."+id+".asset.mask-witness")',room)
                self.page.clock.run_for(48)
                self.assertEqual(self.pixel(room,x,y),actor,'Background artwork stays behind the actor before painting')
                self.paint(room,x,y,'paint')
                self.assertEqual(self.pixel(room,x,y),[238,9,206,255],
                                 'Paint foreground must preserve the placed image, not copy old floor over it')
                self.canvas(room).screenshot(path='/tmp/room-foreground-'+room+'.png')
                self.paint(room,x,y,'erase')
                self.assertEqual(self.pixel(room,x,y),actor,'Erase must return the same pixel behind the actor')
                self.action(room,'undo').click();self.page.clock.run_for(32)
                self.assertEqual(self.pixel(room,x,y),[238,9,206,255])
                self.action(room,'redo').click();self.page.clock.run_for(32)
                self.assertEqual(self.pixel(room,x,y),actor)
                self.leave(room)

    def test_painted_asset_fragments_follow_pixel_edits_movement_and_resizing(self):
        for room in ('piano','fishing'):
            with self.subTest(room=room):
                x,y=self.setup_room(room)
                project=self.project(room);asset=self.solid_asset(x,y)
                asset['artwork']={'width':8,'height':8,'tiles':{'0,0':[[260,1,'#03dd77ff']]}}
                project['assets']=[asset];self.apply(room,project)
                self.page.evaluate('id=>CodaArcadeQA.roomEditor(id).getArtworkSource("room."+id+".asset.mask-witness")',room)
                self.page.clock.run_for(48)
                self.paint(room,x,y,'paint')
                self.assertEqual(self.pixel(room,x,y),[3,221,119,255],
                                 'Promoted image fragments must include their saved pixel edits')
                self.tab(room,'objects')
                self.panel(room).locator('[data-room-field="asset"]').select_option('mask-witness')
                self.field(room,'asset-w',160);self.field(room,'asset-h',160)
                self.assertEqual(self.pixel(room,x,y),[3,221,119,255])
                self.field(room,'asset-x',x+40)
                self.assertEqual(self.pixel(room,x,y),[238,9,206,255],
                                 'Foreground must sample the moved image, not a stale pre-move copy')
                builds=self.state(room)['renderCache']['maskBuilds'];self.page.clock.run_for(320)
                self.assertEqual(self.state(room)['renderCache']['maskBuilds'],builds,
                                 'Unchanged room masks must remain cached during play')
                self.leave(room)

    def test_erase_can_lower_an_asset_assigned_foreground_and_latest_paint_wins(self):
        for room in ('piano','fishing'):
            with self.subTest(room=room):
                x,y=self.setup_room(room);actor=self.pixel(room,x,y)
                project=self.project(room);project['assets']=[self.solid_asset(x,y,'foreground')]
                self.apply(room,project)
                self.page.evaluate('id=>CodaArcadeQA.roomEditor(id).getArtworkSource("room."+id+".asset.mask-witness")',room)
                self.page.clock.run_for(48)
                self.assertEqual(self.pixel(room,x,y),[238,9,206,255])
                self.paint(room,x,y,'erase')
                self.assertEqual(self.pixel(room,x,y),actor,
                                 'Send to background must also affect an image assigned Foreground')
                self.paint(room,x,y,'paint')
                self.assertEqual(self.pixel(room,x,y),[238,9,206,255],
                                 'A later paint stroke must supersede the erasure')
                self.leave(room)

    def test_line_paint_uses_zoomed_and_panned_world_coordinates(self):
        for room in ('piano','fishing'):
            with self.subTest(room=room):
                x,y=self.setup_room(room)
                project=self.project(room);project['assets']=[self.solid_asset(x,y)]
                self.apply(room,project)
                self.page.evaluate('id=>CodaArcadeQA.roomEditor(id).getArtworkSource("room."+id+".asset.mask-witness")',room)
                self.page.clock.run_for(48)
                self.tab(room,'layers')
                if self.action(room,'show-layers').get_attribute('aria-pressed')=='true':self.action(room,'show-layers').click()
                for _ in range(4):self.action(room,'zoom-in').click()
                box=self.canvas(room).bounding_box();start={'x':box['x']+box['width']*.4,'y':box['y']+box['height']*.7}
                self.page.mouse.move(**start);self.page.mouse.down(button='right')
                self.page.mouse.move(start['x']+box['width']*(.45 if room=='fishing' else .1),start['y'],steps=5)
                self.page.mouse.up(button='right');self.page.clock.run_for(32)
                camera=self.state(room)['camera'];self.assertEqual(camera['zoom'],2)
                self.assertEqual(self.project(room),project,'Panning changes the camera, not the foreground project')
                self.panel(room).locator('[data-room-field="layer-shape"]').select_option('line')
                self.panel(room).locator('[data-room-field="layer-size"]').select_option('16')
                self.page.mouse.move(**self.point(room,x-10,y));self.page.mouse.down()
                self.page.mouse.move(**self.point(room,x+10,y),steps=5);self.page.mouse.up()
                self.page.mouse.move(1,1);self.page.clock.run_for(48)
                self.assertEqual(self.pixel(room,x,y),[238,9,206,255],
                                 'A zoomed line must promote the current asset under the brush')
                points=self.project(room)['strokes'][-1]['points'];self.assertEqual(len(points),2)
                for point,want in zip(points,[[x-10,y],[x+10,y]]):
                    self.assertAlmostEqual(point[0],want[0],delta=1);self.assertAlmostEqual(point[1],want[1],delta=1)
                self.action(room,'close').click();self.page.clock.run_for(48)
                self.assertEqual(self.pixel(room,x,y),[238,9,206,255],
                                 'The authored foreground remains visible after leaving the editor')
                self.page.locator('#closepiano' if room=='piano' else '#fishingClose').click()

    def test_lifted_source_rectangle_can_be_painted_with_its_cleaned_background(self):
        for room in ('piano','fishing'):
            with self.subTest(room=room):
                x,y=self.setup_room(room)
                self.assertTrue(self.page.evaluate('''async id=>{
                  const editor=CodaArcadeQA.roomEditor(id),image=await editor.getArtworkSource('background.'+id),width=image.naturalWidth||image.width,height=image.naturalHeight||image.height,tiles={};
                  for(let ty=0;ty<Math.ceil(height/64);ty++)for(let tx=0;tx<Math.ceil(width/64);tx++){
                    const tw=Math.min(64,width-tx*64),th=Math.min(64,height-ty*64),runs=[];
                    if(tw===64)runs.push([0,th*64,'#123456ff']);
                    else for(let row=0;row<th;row++)runs.push([row*64,tw,'#123456ff']);
                    tiles[tx+','+ty]=runs;
                  }
                  return editor.setBackgroundArtwork({width,height,tiles});
                }''',room))
                self.page.clock.run_for(32);actor=self.pixel(room,x,y)
                self.assertNotEqual(actor,[18,52,86,255])
                project=self.project(room);project['assets']=[{'id':'lift-witness','name':'Moved source witness','x':800,'y':500,'w':40,'h':40,'layer':'world','visible':True,'origin':{'bounds':[x-20,y-20,40,40],'sample':[820,300]}}]
                self.apply(room,project)
                self.paint(room,x,y,'paint')
                self.assertEqual(self.pixel(room,x,y),[18,52,86,255],
                                 'A lifted source rectangle must use its rebuilt floor, rather than disabling foreground paint')
                self.paint(room,x,y,'erase')
                self.assertEqual(self.pixel(room,x,y),actor)
                self.leave(room)


if __name__=='__main__':unittest.main(verbosity=2)
