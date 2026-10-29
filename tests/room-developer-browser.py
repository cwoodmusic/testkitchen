"""Exercise room developer cameras, collision, fish edits and saved projects.

The complete site runs at its public origin, routed to the local checkout.
Every check uses a disposable guest profile and records browser/resource errors.
"""
import importlib.util
import json
import math
from pathlib import Path
import sys
import unittest
from world_navigation_helpers import enter_room

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location('room_learning_world', Path(__file__).with_name('learning-world-browser.py'))
_world = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_world)


class RoomDeveloperTests(_world.WorldBrowserCase):
    def setUp(self):
        phone = self._testMethodName.endswith('_phone')
        self.context = self.browser.new_context(
            viewport={'width':390,'height':844} if phone else {'width':1550,'height':1050},
            is_mobile=phone,has_touch=phone)
        self.context.route('https://**/*',lambda route:route.abort())
        self.context.route('https://cwoodmusic.github.io/**',self.route_checkout)
        self.context.add_init_script("localStorage.setItem('codaArcadeFXV1','off');Math.random=()=>.01;")
        self.page = self.context.new_page()
        self.page.set_default_timeout(10000)
        self.errors,self.failures = [],[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.on('console',lambda message:self.errors.append(message.text)
            if 'Arcade frame error:' in message.text else None)
        self.page.on('response',lambda response:self.failures.append(response.url)
            if response.status>=400 and 'cwoodmusic.github.io/coda-arcade/' in response.url
            and not response.url.endswith('favicon.ico') else None)
        self.load()
        self.page.wait_for_function("CodaArcadeQA.roomEditor('piano')&&CodaArcadeQA.roomEditor('fishing')")
        self.page.clock.install()
        self.page.clock.run_for(64)

    def state(self,room):
        return self.page.evaluate('id=>CodaArcadeQA.roomEditor(id).getState()',room)

    def project(self,room):
        return self.page.evaluate('id=>CodaArcadeQA.roomProject(id)',room)

    def room_state(self,room):
        return self.page.evaluate("id=>CodaArcadeQA[id==='piano'?'piano':'fishing']()",room)

    def panel(self,room):
        return self.page.locator('[data-room-editor="'+room+'"]')

    def action(self,room,name):
        return self.panel(room).locator('[data-room-action="'+name+'"]')

    def tab(self,room,name):
        self.panel(room).locator('[data-room-tab="'+name+'"]').click()

    def canvas(self,room):
        return self.page.locator('#pianoRoomCanvas' if room=='piano' else '#fishingLakeCanvas')

    def enter(self,room):
        enter_room(self.page,room)
        self.page.clock.run_for(64)
        self.assertTrue(self.room_state(room)['open'])
        self.page.wait_for_function("id=>CodaArcadeQA[id==='piano'?'piano':'fishing']().background.ready",arg=room)

    def open_editor(self,room,tab='objects'):
        self.canvas(room).focus()
        self.page.keyboard.press('F2')
        self.page.clock.run_for(64)
        self.assertTrue(self.state(room)['open'])
        self.assertTrue(self.state(room)['editing'])
        self.assertFalse(self.page.locator('#assetStudio').is_visible(),
            'F2 inside a room opens its own editor rather than the arcade underneath')
        if tab!='objects':self.tab(room,tab)

    def close_editor(self,room):
        self.canvas(room).focus()
        self.page.keyboard.press('F2')
        self.page.clock.run_for(32)
        self.assertFalse(self.state(room)['open'])
        self.assertTrue(self.room_state(room)['open'])

    def point(self,room,x,y):
        return self.page.evaluate('''([id,x,y])=>{
          const canvas=document.querySelector(id==='piano'?'#pianoRoomCanvas':'#fishingLakeCanvas');
          const b=canvas.getBoundingClientRect(),cam=CodaArcadeQA.roomEditor(id).getState().camera;
          return {x:b.left+(x-cam.x)*cam.zoom*b.width/1000,y:b.top+(y-cam.y)*cam.zoom*b.height/620};
        }''',[room,x,y])

    def drag(self,start,end,button='left'):
        self.page.mouse.move(**start)
        self.page.mouse.down(button=button)
        self.page.mouse.move(**end,steps=6)
        self.page.mouse.up(button=button)
        self.page.clock.run_for(32)

    def field(self,room,name,value):
        target=self.panel(room).locator('[data-room-field="'+name+'"]')
        target.fill(str(value));target.dispatch_event('change')
        self.page.clock.run_for(32)

    def test_both_rooms_keep_zoom_when_switching_layers_and_pan_without_changing_artwork(self):
        for room in ['piano','fishing']:
            self.enter(room);self.open_editor(room)
            original=self.project(room)
            player=self.room_state(room)['player']
            shadows=self.room_state(room).get('shadows')
            self.action(room,'zoom-in').click();self.action(room,'zoom-in').click()
            self.page.clock.run_for(64)
            before=self.state(room)['camera']
            self.assertGreater(before['zoom'],1)
            for tab in ['layers','collision','objects','project']:
                self.tab(room,tab)
                camera=self.state(room)['camera']
                self.assertEqual(camera,before,'Changing tools must preserve the detail camera')
            self.tab(room,'layers')
            box=self.canvas(room).bounding_box()
            # Work clear of the floating console on the left side of the scene.
            start={'x':box['x']+box['width']*.46,'y':box['y']+box['height']*.55}
            self.drag(start,{'x':start['x']-60,'y':start['y']-35},button='right')
            after=self.state(room)['camera']
            self.assertTrue(after['x']>before['x']+10 or after['y']>before['y']+10)
            self.assertEqual(self.project(room),original,'Panning must not paint or move scene data')
            self.canvas(room).focus();self.page.keyboard.down('d')
            self.page.clock.run_for(550);self.page.keyboard.up('d')
            self.assertEqual(self.room_state(room)['player'],player,'Editing pauses the room avatar')
            if shadows is not None:
                self.assertEqual(self.room_state(room)['shadows'],shadows,'Fish stay still while editing')
            self.close_editor(room)
            self.page.locator('#closepiano' if room=='piano' else '#fishingClose').click()

    def pixel(self,room,x=705,y=405):
        state=self.state(room)
        camera=state['camera'] if state['editing'] else {'x':0,'y':0,'zoom':1}
        return self.canvas(room).evaluate('''(canvas,p)=>Array.from(canvas.getContext('2d').getImageData(
          Math.round((p.x-p.camera.x)*p.camera.zoom),
          Math.round((p.y-p.camera.y)*p.camera.zoom),1,1).data)''',{'x':x,'y':y,'camera':camera})

    def test_room_overlay_toggles_preserve_authored_collision_layers_camera_and_undo(self):
        for room in ['piano','fishing']:
            with self.subTest(room=room):
                self.enter(room);self.open_editor(room)
                project=self.project(room);player=self.room_state(room)['player']
                actor_point={'x':player['x'],'y':player['y']-30}
                uncovered_actor=self.pixel(room,**actor_point)
                project['collision']=[cell for cell in project['collision'] if cell[0]!=4070]+[[4070,0]]
                project['strokes'].append({'tool':'paint','size':16,'points':[[700,400]]})
                project['strokes'].append({'tool':'paint','size':32,'points':[[actor_point['x'],actor_point['y']]]})
                self.assertTrue(self.page.evaluate('([id,project])=>CodaArcadeQA.roomEditor(id).applyProject(project)',[room,project]))
                self.page.clock.run_for(32)
                original=self.project(room);undo=self.state(room)['undo'];base=self.pixel(room)
                covered_actor=self.pixel(room,**actor_point)
                self.assertNotEqual(covered_actor,uncovered_actor,
                    'An authored foreground stroke must cover the real character with the debug mask hidden')
                self.assertFalse(self.page.evaluate('id=>CodaArcadeQA.roomEditor(id).walkable(705,405,true)',room))
                for overlay,field in [('collision',None),('layers','mask-visible')]:
                    self.action(room,'show-'+overlay).focus()
                    self.page.keyboard.press('Space' if overlay=='collision' else 'Enter')
                    self.page.clock.run_for(32)
                    self.assertTrue(self.state(room)['overlays'][overlay])
                    self.assertEqual(self.action(room,'show-'+overlay).get_attribute('aria-pressed'),'true')
                    self.assertNotEqual(self.pixel(room),base,'The visible overlay must actually change room pixels')
                    if overlay=='collision':
                        self.page.keyboard.press('Tab')
                        self.assertEqual(self.page.evaluate('document.activeElement.dataset.roomAction'),'show-layers',
                            'Native Tab must move between the visible overlay controls')
                    if field:self.assertTrue(self.panel(room).locator('[data-room-field="'+field+'"]').is_checked())
                    self.action(room,'show-'+overlay).click();self.page.clock.run_for(32)
                    self.assertFalse(self.state(room)['overlays'][overlay])
                    self.assertEqual(self.pixel(room),base,'Hiding an overlay must restore the authored room rendering')
                self.action(room,'zoom-in').click();camera=self.state(room)['camera']
                for overlay in ['collision','layers']:
                    self.action(room,'show-'+overlay).click()
                    self.assertEqual(self.state(room)['camera'],camera)
                self.assertEqual(self.state(room)['tab'],'objects','Visibility does not select a painting tool')
                self.assertEqual(self.project(room),original);self.assertEqual(self.state(room)['undo'],undo)
                self.action(room,'zoom-reset').click();self.page.clock.run_for(32)
                self.action(room,'playtest').click();self.page.clock.run_for(32)
                self.assertFalse(self.state(room)['overlays']['visible'])
                self.assertEqual(self.pixel(room),base,'Playtest renders the real foreground without debug colors')
                self.assertEqual(self.pixel(room,**actor_point),covered_actor,
                    'The real foreground must still cover the character in Playtest')
                self.assertTrue(self.action(room,'show-collision').is_disabled())
                self.assertTrue(self.action(room,'show-layers').is_disabled())
                self.assertFalse(self.page.evaluate('id=>CodaArcadeQA.roomEditor(id).walkable(705,405,true)',room))
                self.action(room,'playtest').click();self.page.clock.run_for(32)
                self.assertTrue(self.state(room)['overlays']['visible'])
                self.assertNotEqual(self.pixel(room),base)
                self.close_editor(room);self.page.clock.run_for(32)
                self.assertFalse(self.state(room)['overlays']['visible'])
                self.assertEqual(self.pixel(room),base,'Closing the editor must hide debug colors without removing foreground')
                self.assertEqual(self.pixel(room,**actor_point),covered_actor)
                self.assertEqual(self.project(room),original);self.assertEqual(self.state(room)['undo'],undo)
                self.page.locator('#closepiano' if room=='piano' else '#fishingClose').click()

    def test_room_tool_shortcuts_and_typing_guards_do_not_create_accidental_strokes(self):
        for room in ['piano','fishing']:
            with self.subTest(room=room):
                self.enter(room);self.open_editor(room)
                self.action(room,'zoom-in').click();before=self.state(room);original=self.project(room)
                self.canvas(room).focus();self.page.keyboard.down('Space')
                self.assertTrue(self.canvas(room).evaluate('canvas=>canvas.classList.contains("room-dev-panning")'))
                self.action(room,'show-collision').focus();self.page.keyboard.up('Space')
                self.assertFalse(self.canvas(room).evaluate('canvas=>canvas.classList.contains("room-dev-panning")'),
                    'Releasing Space after focus moves must release temporary pan mode')
                self.canvas(room).focus();self.page.keyboard.down('c');self.page.keyboard.down('c')
                self.assertEqual(self.state(room)['tab'],'collision','A held shortcut must not toggle repeatedly')
                self.page.keyboard.up('c');self.page.keyboard.press('c')
                self.assertEqual(self.state(room)['tab'],'objects');self.assertFalse(self.state(room)['overlays']['collision'])
                self.page.keyboard.press('l');self.assertEqual(self.state(room)['tab'],'layers')
                self.page.keyboard.press('l');self.assertEqual(self.state(room)['tab'],'objects')
                self.assertFalse(self.state(room)['overlays']['layers'])
                self.page.keyboard.press('Shift+L');self.assertEqual(self.state(room)['tab'],'layers')
                self.page.keyboard.press('Shift+L');self.assertEqual(self.state(room)['tab'],'objects')
                for modifiers in [{'ctrlKey':True},{'metaKey':True},{'altKey':True}]:
                    self.canvas(room).dispatch_event('keydown',{'key':'c','code':'KeyC',**modifiers})
                    self.assertEqual(self.state(room)['tab'],'objects')
                self.panel(room).evaluate('''panel=>{const input=document.createElement('input');input.id='shortcutTyping';panel.prepend(input);}''')
                typing=self.panel(room).locator('#shortcutTyping');typing.focus()
                self.page.keyboard.press('c');self.page.keyboard.press('Shift+L')
                self.assertEqual(typing.input_value(),'cL');self.assertEqual(self.state(room)['tab'],'objects')
                typing.evaluate('node=>node.remove()')
                self.assertEqual(self.state(room)['camera'],before['camera'])
                self.assertEqual(self.project(room),original);self.assertEqual(self.state(room)['undo'],before['undo'])
                # Switching tools may finish the intentional stroke, but the
                # remaining held pointer must not begin painting the new tool.
                self.canvas(room).focus();self.page.keyboard.press('l')
                start=self.point(room,700,400);end=self.point(room,720,420)
                self.page.mouse.move(**start);self.page.mouse.down();self.page.mouse.move(**end)
                layer_before=self.project(room)['strokes']
                self.page.keyboard.press('c');self.page.mouse.move(**self.point(room,740,440));self.page.mouse.up()
                self.page.clock.run_for(32)
                self.assertEqual(self.project(room)['collision'],original['collision'])
                self.assertEqual(self.project(room)['strokes'],layer_before)
                self.close_editor(room)
                self.page.locator('#closepiano' if room=='piano' else '#fishingClose').click()

    def test_foreground_strokes_follow_zoomed_room_coordinates_and_undo_redo(self):
        self.enter('piano');self.open_editor('piano','layers')
        self.action('piano','zoom-in').click();self.action('piano','zoom-in').click()
        self.page.clock.run_for(64)
        camera=self.state('piano')['camera']
        x,y=camera['x']+260/camera['zoom'],camera['y']+300/camera['zoom']
        start,end=self.point('piano',x,y),self.point('piano',x+18,y+8)
        old=len(self.project('piano')['strokes'])
        self.drag(start,end)
        strokes=self.project('piano')['strokes']
        self.assertEqual(len(strokes),old+1)
        points=strokes[-1]['points']
        self.assertAlmostEqual(points[0][0],x,delta=2)
        self.assertAlmostEqual(points[0][1],y,delta=2)
        saved=self.project('piano')
        self.action('piano','undo').click();self.assertEqual(len(self.project('piano')['strokes']),old)
        self.action('piano','redo').click();self.assertEqual(self.project('piano'),saved)

    def test_cave_collision_paint_changes_actual_shore_walking(self):
        self.enter('fishing');self.open_editor('fishing','collision')
        # The landing is on the left; dock the console right to reach it.
        self.action('fishing','dock').click()
        self.drag(self.point('fishing',165,255),self.point('fishing',165,305))
        self.assertGreater(len(self.project('fishing')['collision']),3)
        self.close_editor('fishing');self.canvas('fishing').focus()
        self.page.keyboard.down('d');self.page.clock.run_for(500);self.page.keyboard.up('d')
        player=self.room_state('fishing')['player']
        self.assertGreater(player['x'],150)
        self.assertLess(player['x'],160,'A red cave cell must block actual shore walking')
        self.open_editor('fishing','collision')
        self.panel('fishing').locator('[data-room-field="collision-tool"]').select_option('open')
        self.drag(self.point('fishing',165,255),self.point('fishing',165,305))
        self.close_editor('fishing');self.canvas('fishing').focus()
        self.page.keyboard.down('d');self.page.clock.run_for(500);self.page.keyboard.up('d')
        player=self.room_state('fishing')['player']
        self.assertGreater(player['x'],190,'Opening the painted cells must release that same cave path')
        self.assertTrue(self.page.evaluate('''()=>{const p=CodaArcadeQA.fishing().player;
            return CodaFishingCaveLayout.isShore(p.x,p.y);}'''))

    def test_painted_red_cells_block_real_piano_walking_and_open_cells_restore_it(self):
        self.enter('piano');self.open_editor('piano','collision')
        original=dict(self.project('piano')['collision'])
        wall={row*100+55 for row in range(25,59)}
        self.drag(self.point('piano',555,255),self.point('piano',555,585))
        cells=self.project('piano')['collision']
        self.assertTrue(all(dict(cells).get(index)==0 for index in wall))
        self.assertEqual({index:value for index,value in cells if index not in wall},
                         {index:value for index,value in original.items() if index not in wall})
        self.close_editor('piano');self.canvas('piano').focus()
        self.page.keyboard.down('d');self.page.clock.run_for(1000);self.page.keyboard.up('d')
        blocked=self.room_state('piano')['player']
        self.assertGreater(blocked['x'],535)
        self.assertLess(blocked['x'],550,'A red room cell must stop actual walking')
        self.open_editor('piano','collision')
        self.panel('piano').locator('[data-room-field="collision-tool"]').select_option('open')
        self.drag(self.point('piano',555,255),self.point('piano',555,585))
        opened=dict(self.project('piano')['collision'])
        self.assertTrue(all(opened.get(index)==1 for index in wall))
        self.assertEqual({index:value for index,value in opened.items() if index not in wall},
                         {index:value for index,value in original.items() if index not in wall})
        self.close_editor('piano');self.canvas('piano').focus()
        self.page.keyboard.down('d');self.page.clock.run_for(500);self.page.keyboard.up('d')
        self.assertGreater(self.room_state('piano')['player']['x'],600)

    def test_lifted_room_artwork_moves_resizes_changes_layers_and_restores_with_undo(self):
        self.enter('piano');self.open_editor('piano')
        original_strokes=len(self.project('piano')['strokes'])
        canvas=self.canvas('piano')
        def pixels():
            return canvas.evaluate("c=>Array.from(c.getContext('2d').getImageData(730,130,50,60).data)")
        original=pixels()
        # A promoted foreground mask must not resurrect artwork at the old
        # source once that artwork is lifted and moved elsewhere.
        self.tab('piano','layers')
        self.panel('piano').locator('[data-room-field="layer-size"]').select_option('32')
        self.drag(self.point('piano',746,145),self.point('piano',766,145))
        self.drag(self.point('piano',746,175),self.point('piano',766,175))
        self.assertEqual(len(self.project('piano')['strokes']),original_strokes+2)
        self.tab('piano','objects')
        self.action('piano','lift').click()
        self.drag(self.point('piano',730,130),self.point('piano',780,190))
        assets=self.project('piano')['assets'];self.assertEqual(len(assets),1)
        bounds=assets[0]['origin']['bounds']
        for got,want in zip(bounds,[730,130,50,60]):self.assertAlmostEqual(got,want,delta=1)
        self.drag(self.point('piano',assets[0]['x'],assets[0]['y']),self.point('piano',640,400))
        moved=self.project('piano')['assets'][0]
        self.assertAlmostEqual(moved['x'],640,delta=2);self.assertAlmostEqual(moved['y'],400,delta=2)
        corner=self.point('piano',moved['x']+moved['w']/2,moved['y']+moved['h']/2)
        self.drag(corner,self.point('piano',moved['x']+moved['w']/2+10,moved['y']+moved['h']/2+8))
        resized=self.project('piano')['assets'][0]
        self.assertGreater(resized['w'],moved['w']+15);self.assertGreater(resized['h'],moved['h']+10)
        self.panel('piano').locator('[data-room-field="asset-layer"]').select_option('foreground')
        self.assertEqual(self.project('piano')['assets'][0]['layer'],'foreground')
        self.close_editor('piano')
        self.assertGreater(sum(a!=b for a,b in zip(original,pixels())),500,
            'Moving lifted room artwork must clean up its original pixels even under a previous foreground mask')
        builds=self.state('piano')['renderCache']['maskBuilds']
        self.page.clock.run_for(320)
        self.assertEqual(self.state('piano')['renderCache']['maskBuilds'],builds,
            'Unchanged foreground pixels must reuse their cached surface during play')
        self.open_editor('piano')
        self.panel('piano').locator('[data-room-field="asset"]').select_option(resized['id'])
        self.action('piano','asset-remove').click();self.assertFalse(self.project('piano')['assets'][0]['visible'])
        self.action('piano','undo').click();self.assertTrue(self.project('piano')['assets'][0]['visible'])
        self.panel('piano').locator('[data-room-field="asset"]').select_option(resized['id'])
        self.action('piano','asset-restore').click();self.assertEqual(self.project('piano')['assets'],[])
        self.action('piano','undo').click();self.assertEqual(len(self.project('piano')['assets']),1)

    def test_room_edits_are_in_complete_world_backup_and_survive_reload_and_import(self):
        original=self.page.evaluate('CodaDeveloperConsole.getProject()')
        piano=self.project('piano');piano['entities']['chopin']={'x':600,'y':330}
        self.assertTrue(self.page.evaluate('doc=>CodaArcadeQA.applyRoomProject("piano",doc)',piano))
        saved=self.page.evaluate('CodaDeveloperConsole.getProject()')
        self.assertEqual(saved['assets'],original['assets'])
        self.assertEqual(saved['collision'],original['collision'])
        self.assertEqual(saved['strokes'],original['strokes'])
        self.assertEqual(saved['rooms']['piano'],self.project('piano'))
        self.page.locator('#view').focus();self.page.keyboard.press('F2')
        self.page.locator('#devUndo').click()
        self.assertEqual(self.project('piano')['entities'],{},'Main Undo must undo even the very first room edit')
        self.page.locator('#devRedo').click()
        self.assertEqual(self.project('piano'),saved['rooms']['piano'])
        self.page.keyboard.press('F2')
        self.page.evaluate('CodaDeveloperConsole.save()')
        self.load();self.page.clock.run_for(64)
        self.assertEqual(self.project('piano'),saved['rooms']['piano'])
        self.enter('piano');self.assertEqual(self.room_state('piano')['chopin']['x'],600)
        self.page.locator('#closepiano').click();self.page.clock.run_for(32)
        # Import the complete document through the same user-visible control.
        restored=json.loads(json.dumps(saved));restored['rooms']['piano']['entities']['chopin']={'x':650,'y':350}
        self.page.keyboard.press('F2');self.page.locator('#devTab-project').click()
        self.page.once('dialog',lambda dialog:dialog.accept())
        self.page.locator('#devImportFile').set_input_files({
            'name':'world-with-rooms.json','mimeType':'application/json','buffer':json.dumps(restored).encode()})
        self.page.clock.run_for(64)
        self.page.wait_for_function('CodaArcadeQA.roomProject("piano").entities.chopin.x===650')
        self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProject().assets'),original['assets'])
        self.page.locator('#devUndo').click()
        self.assertEqual(self.project('piano'),saved['rooms']['piano'])
        kept=self.page.evaluate('CodaDeveloperConsole.getProject()')
        malformed=json.loads(json.dumps(kept))
        malformed['rooms']['fishing']=self.project('fishing')
        malformed['rooms']['fishing']['collision']=[[0,2]]
        malformed['assets']=[]
        self.page.locator('#devImportFile').set_input_files({
            'name':'invalid-room.json','mimeType':'application/json','buffer':json.dumps(malformed).encode()})
        self.page.wait_for_function("document.querySelector('#devStatus').textContent.includes('Invalid world project')")
        self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProject()'),kept,
            'A malformed room must reject the entire import before replacing any other room or arcade data')

    def test_cave_fish_species_size_color_and_position_are_saved_and_used_by_casting(self):
        self.enter('fishing')
        # Walk the real landing and pier, then board before editing the fish.
        def walk(x,y):
            canvas=self.canvas('fishing');canvas.scroll_into_view_if_needed();box=canvas.bounding_box()
            self.page.mouse.click(box['x']+x*box['width']/1000,box['y']+y*box['height']/620)
            for _ in range(35):
                self.page.clock.run_for(100);p=self.room_state('fishing')['player']
                if math.hypot(p['x']-x,p['y']-y)<7:break
        walk(135,285);walk(218,380)
        self.canvas('fishing').focus();self.page.keyboard.press('e');self.page.clock.run_for(32)
        self.assertEqual(self.room_state('fishing')['phase'],'explore')
        self.open_editor('fishing')
        field=self.panel('fishing').locator('[data-room-field="entity"]')
        field.select_option('fish-slot-0')
        species=self.page.evaluate("CodaRhythmFishing.availableFish('4/4').at(-1).id")
        self.panel('fishing').locator('[data-room-field="species"]').select_option(species)
        self.field('fishing','fish-size',2)
        self.field('fishing','fish-color','#335599')
        self.field('fishing','fish-accent','#99ddff')
        self.field('fishing','entity-x',350)
        self.field('fishing','entity-y',410)
        saved=self.project('fishing')['entities']['fish-slot-0']
        self.assertEqual(saved['speciesId'],species);self.assertEqual(saved['size'],2)
        self.assertEqual(saved['color'],'#335599');self.assertEqual(saved['accent'],'#99ddff')
        before=self.room_state('fishing')['shadows'][0]
        self.page.clock.run_for(1000)
        self.assertEqual(self.room_state('fishing')['shadows'][0],before,'Selected fish stays still while editing')
        self.drag(self.point('fishing',350,410),self.point('fishing',365,420))
        moved=self.project('fishing')['entities']['fish-slot-0']
        self.assertAlmostEqual(moved['x'],365,delta=2);self.assertAlmostEqual(moved['y'],420,delta=2)
        self.action('fishing','undo').click();self.assertEqual(self.project('fishing')['entities']['fish-slot-0'],saved)
        field.select_option('fish-slot-0')
        self.drag(self.point('fishing',414,452),self.point('fishing',430,460))
        self.assertGreater(self.project('fishing')['entities']['fish-slot-0']['size'],2,
            'The fish corner handle must resize the actual fish')
        self.action('fishing','undo').click();self.assertEqual(self.project('fishing')['entities']['fish-slot-0'],saved)
        self.close_editor('fishing')
        self.assertEqual(self.room_state('fishing')['shadows'][0]['fishId'],species)
        self.canvas('fishing').focus();self.page.keyboard.press('e');self.page.clock.run_for(2000)
        state=self.room_state('fishing')
        self.assertEqual(state['phase'],'rhythm')
        self.assertEqual(state['challenge']['fish']['id'],species,'The edited species controls the real rhythm challenge')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),150,'Developer edits do not grant rewards')
        self.page.locator('#fishingCancel').click();self.page.clock.run_for(32)
        self.page.locator('#fishingClose').click();self.load();self.page.clock.run_for(64)
        self.assertEqual(self.project('fishing')['entities']['fish-slot-0'],saved)
        self.enter('fishing')
        shadow=self.room_state('fishing')['shadows'][0]
        self.assertEqual(shadow['fishId'],species);self.assertEqual(shadow['editorSize'],2)

    def test_immediate_reload_after_a_room_field_edit_keeps_the_newer_room_journal(self):
        self.enter('piano');self.open_editor('piano')
        self.panel('piano').locator('[data-room-field="entity"]').select_option('chopin')
        target=self.panel('piano').locator('[data-room-field="entity-x"]')
        target.fill('600');target.dispatch_event('change')
        self.page.evaluate('CodaDeveloperConsole.save()')
        self.page.clock.run_for(16)
        target.fill('610');target.dispatch_event('change')
        # Reload before the main world's 450ms debounce. The room journal and
        # synchronous combined document must agree about which edit is newer.
        self.load();self.page.clock.run_for(32)
        self.assertEqual(self.project('piano')['entities']['chopin']['x'],610)
        self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProject().rooms.piano.entities.chopin.x'),610)
        self.enter('piano');self.assertEqual(self.room_state('piano')['chopin']['x'],610)

    def test_room_sprite_painting_edits_actual_npc_targets_and_shared_backup(self):
        for room,target in [('piano','chopin'),('fishing','captain-cadence')]:
            self.enter(room);self.open_editor(room,'sprites')
            pane=self.panel(room).locator('[data-room-pane="sprites"]')
            pane.get_by_label('Sprite character',exact=True).select_option(target)
            pane.get_by_role('button',name='Use colour #6ce4da',exact=True).click()
            grid=self.page.locator('#roomPixelEditCanvas-'+room)
            before=self.room_state(room)['player']
            grid.focus();self.page.keyboard.press('ArrowRight');self.page.keyboard.press('Space')
            self.page.clock.run_for(32)
            sprites=self.page.evaluate('CodaDeveloperConsole.getProject().sprites')
            self.assertIn([41,45,'#6ce4da'],sprites[target]['down'])
            self.assertEqual(self.room_state(room)['player'],before,
                'Pixel canvas Space/arrow shortcuts must not move or jump the room avatar')
            if room=='piano':self.assertEqual(self.room_state(room)['held'],[])
            self.action(room,'undo').click()
            self.assertNotIn(target,self.page.evaluate('CodaDeveloperConsole.getProject().sprites||{}'))
            self.action(room,'redo').click()
            self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProject().sprites'),sprites)
            self.page.evaluate('CodaDeveloperConsole.save()')
            self.load();self.page.clock.run_for(32)
            self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProject().sprites'),sprites)
            self.enter(room);self.open_editor(room,'sprites')
            pane=self.panel(room).locator('[data-room-pane="sprites"]')
            pane.get_by_label('Sprite character',exact=True).select_option(target)
            self.assertEqual(pane.get_by_label('Sprite character',exact=True).input_value(),target)
            self.close_editor(room)
            self.page.locator('#closepiano' if room=='piano' else '#fishingClose').click()

    def test_phone_has_visible_room_editor_zoom_and_pan_controls_phone(self):
        self.enter('fishing')
        button=self.page.locator('[data-room-dev-open="fishing"]')
        if not button.is_visible():self.page.locator('#fishingMenuButton').click()
        self.assertTrue(button.is_visible());button.click();self.page.clock.run_for(64)
        self.assertTrue(self.state('fishing')['editing'])
        for name in ['zoom-in','zoom-out','pan','show-collision','show-layers']:
            self.assertTrue(self.action('fishing',name).is_visible())
        self.action('fishing','zoom-in').click()
        self.assertGreater(self.state('fishing')['camera']['zoom'],1)
        self.action('fishing','pan').click()
        before=self.project('fishing');camera=self.state('fishing')['camera']
        self.canvas('fishing').scroll_into_view_if_needed()
        box=self.canvas('fishing').bounding_box()
        client=self.context.new_cdp_session(self.page)
        start={'id':41,'x':box['x']+box['width']*.6,'y':box['y']+box['height']*.55}
        end={**start,'x':start['x']-55,'y':start['y']-25}
        try:
            client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[start]})
            client.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[end]})
            client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        finally:client.detach()
        self.page.clock.run_for(64)
        self.assertEqual(self.project('fishing'),before)
        self.assertNotEqual(self.state('fishing')['camera'],camera,'Pan mode must actually move the touch camera')
        self.assertTrue(self.room_state('fishing')['open'])
        self.action('fishing','close').click();self.page.locator('#fishingClose').click()
        self.enter('piano')
        piano_button=self.page.locator('[data-room-dev-open="piano"]')
        if not piano_button.is_visible():
            self.page.locator('#pianoMenuButton').click();self.page.locator('[data-piano-view="settings"]').click()
        self.assertTrue(piano_button.is_visible());piano_button.click()
        self.assertTrue(self.state('piano')['editing'])
        self.assertTrue(self.action('piano','zoom-in').is_visible())
        self.action('piano','zoom-in').click()
        self.assertGreater(self.state('piano')['camera']['zoom'],1)


if __name__=='__main__':
    unittest.main(verbosity=2)
