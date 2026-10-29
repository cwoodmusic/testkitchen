"""Smooth arcade ground, exact clean-plate joins, and protected room artwork.

Runs the real main game in disposable browsers. The original tiled PNG remains
an independent reference for furniture and the lounge/dance-room witnesses.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location(
    'arcade_floor_world_fixture', Path(__file__).with_name('published-world-browser.py'))
fixture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fixture)
ROOT = Path(__file__).resolve().parents[1]
FLAT_WORLD = 'assets/world/arcade-flat-floor-world.png'
FLOOR_PLATE = 'assets/world/arcade-flat-floor-plate.png'
PROJECT_FINGERPRINT = 'cdfe297b883c232077fc75cc10e1f0f83b2148433dc1ab023f6c721361844038'


class ArcadeFloorGridTests(unittest.TestCase):
    setUpClass = classmethod(fixture.PublishedWorldTests.setUpClass.__func__)
    tearDownClass = classmethod(fixture.PublishedWorldTests.tearDownClass.__func__)
    setUp = fixture.PublishedWorldTests.setUp
    tearDown = fixture.PublishedWorldTests.tearDown
    load = fixture.PublishedWorldTests.load

    def rendered(self, points):
        return self.page.evaluate('''points=>{
          const surface=view.getContext('2d'),camera=CodaArcadeQA.camera();
          return points.map(([x,y])=>[...surface.getImageData(
            Math.floor((x-camera.x)*camera.zoom),Math.floor((y-camera.y)*camera.zoom),1,1).data]);
        }''', points)

    def source_pixels(self, points, name):
        return self.page.evaluate('''async({points,name})=>{
          const image=new Image();image.src=name;await image.decode();
          const reference=document.createElement('canvas');reference.width=image.naturalWidth;reference.height=image.naturalHeight;
          const context=reference.getContext('2d');context.drawImage(image,0,0);
          return points.map(([x,y])=>[...context.getImageData(x,y,1,1).data]);
        }''', {'points': points, 'name': name})

    def freeze_scene(self):
        self.page.evaluate("CodaDeveloperConsole.open('layers')")
        for selector in ('#devShowCollision', '#devShowLayers'):
            if self.page.locator(selector).get_attribute('aria-pressed') == 'true':
                self.page.locator(selector).click()
        self.page.mouse.move(1500, 900)
        self.page.evaluate('publishFrames(3)')

    def test_flat_sources_are_ready_without_rewriting_the_uploaded_world_project(self):
        self.load()
        state = self.page.evaluate('CodaArcadeQA.floorGrid()')
        self.assertTrue(state['ready'])
        self.assertEqual(state['mode'], 'flat-floor-plate')
        self.assertTrue(state['artReady'])
        resources = self.page.evaluate('performance.getEntriesByType("resource").map(entry=>new URL(entry.name).pathname)')
        self.assertTrue(any(path.endswith('/' + FLAT_WORLD) for path in resources))
        self.assertTrue(any(path.endswith('/' + FLOOR_PLATE) for path in resources))
        project = self.page.evaluate('CodaDeveloperConsole.getProject()')
        digest = hashlib.sha256(json.dumps(project, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        self.assertEqual(digest, PROJECT_FINGERPRINT, 'A floor material change must retain every authored asset, collision cell, layer and piano edit')
        self.assertEqual((len(project['assets']), len(project['collision']), len(project['strokes'])), (13, 1394, 763))
        self.assertIsNone(self.page.evaluate('localStorage.getItem("codaWorldProjectV1")'))

    def test_lounge_dance_room_and_fixture_pixels_remain_the_original_art(self):
        self.load()
        self.freeze_scene()
        # Independent source coordinates: signs, speakers, the lounge carpet,
        # dance tiles and the repaired sofa. These are not generated-floor pixels.
        points = [[286,63], [300,260], [400,260], [420,280],
                  [457,733], [250,760], [642,640], [659,652], [700,688],
                  [1460,205], [1285,44], [1188,171], [1473,788],
                  [533,351]]
        visible = self.page.evaluate('''points=>{
          const characters=CodaArcadeQA.characters(),actors=[characters.player,...characters.npcs.filter(actor=>!actor.hidden)];
          return points.map(([x,y])=>!actors.some(actor=>Math.abs(actor.x-x)<65&&y>actor.y-110&&y<actor.y+18));
        }''', points)
        actual = self.rendered(points)
        original = self.source_pixels(points, 'coda_arcade_world_clean.png')
        self.assertGreaterEqual(sum(visible), 10, 'Keep independent witnesses throughout the protected rooms')
        for point, clear, observed, expected in zip(points, visible, actual, original):
            if not clear:
                continue
            with self.subTest(point=point):
                self.assertEqual(observed, expected, 'Changing the main ground material must preserve protected art')

    def test_exposed_cabinet_floor_matches_the_clean_plate_at_native_world_coordinates(self):
        self.load()
        self.freeze_scene()
        groups = self.page.evaluate('''()=>{
          return CodaDeveloperConsole.getProject().assets.filter(asset=>asset.origin?.name.startsWith('cabinet_')).map(asset=>{
            const [x,y,w,h]=asset.origin.bounds,body=[],reflection=[];
            for(const yy of [270,278,286,294,301])for(const xx of [x+3,x+Math.floor(w/2),x+w-4])body.push([xx,yy]);
            for(const yy of [315,336,360])for(const xx of [x+3,x+Math.floor(w/2),x+w-4])reflection.push([xx,yy]);
            return {name:asset.origin.name,body,reflection};
          });
        }''')
        self.assertEqual(len(groups), 4)
        for group in groups:
            with self.subTest(cabinet=group['name']):
                self.assertGreaterEqual(len(group['body']), 5, 'Inspect exposed body ground, not only the lower reflection')
                self.assertGreaterEqual(len(group['reflection']), 2)
                points = group['body'] + group['reflection']
                # Sample the real cached ground before NPCs and their shadows
                # are drawn over it; their random positions are not floor art.
                ground = self.page.evaluate('points=>points.map(([x,y])=>CodaArcadeQA.floorGrid().pixelAt(x,y))', points)
                self.assertEqual(ground, self.source_pixels(points, FLOOR_PLATE),
                                 'Cabinet removal must use the same clean plate; no repeated row samples or grout seams')
        before = self.page.evaluate('CodaArcadeQA.floorGrid().cabinetSurfaces')
        self.page.evaluate('publishFrames(12)')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.floorGrid().cabinetSurfaces'), before,
                         'Unchanged cabinet ground should reuse its cached crops')

    def test_legacy_no_plate_helper_still_provides_safe_original_grid_repairs(self):
        self.load()
        result = self.page.evaluate('''async()=>{
          const image=new Image();image.src='coda_arcade_world_clean.png';await image.decode();
          const ground=createCodaArcadeFloorGrid({worldArt:image});await ground.ready();
          ground.render(image);
          const patch=ground.cabinet([912,166,104,138],375),pixels=patch.getContext('2d').getImageData(0,91,104,47).data;
          let hot=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+1]>210&&pixels[i+2]>230)hot++;
          return {mode:ground.snapshot().mode,width:patch.width,height:patch.height,hot};
        }''')
        self.assertEqual(result, {'mode': 'source-aligned-repairs', 'width': 104, 'height': 209, 'hot': 0})


if __name__ == '__main__':
    unittest.main(verbosity=2)
