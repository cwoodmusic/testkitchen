"""Exercise live cave movement, effects, ladder exits, and beamed fishing music."""
import importlib.util
import math
from pathlib import Path
import sys
import unittest
from world_navigation_helpers import enter_room

sys.dont_write_bytecode=True
_spec=importlib.util.spec_from_file_location('fishing_world_browser',Path(__file__).with_name('fishing-world-browser.py'))
_fish=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_fish)


class CaveUpgradeTests(_fish._world.WorldBrowserCase):
    setUp=_fish.FishingWorldTests.setUp
    state=_fish.FishingWorldTests.state
    portal=_fish.FishingWorldTests.portal
    place=_fish.FishingWorldTests.place
    enter=_fish.FishingWorldTests.enter
    walk_to=_fish.FishingWorldTests.walk_to
    board=_fish.FishingWorldTests.board
    approach_shadow=_fish.FishingWorldTests.approach_shadow
    cast=_fish.FishingWorldTests.cast
    fishing_option=_fish.FishingWorldTests.fishing_option
    fishing_action=_fish.FishingWorldTests.fishing_action
    fishing_meter=_fish.FishingWorldTests.fishing_meter

    def assert_shadows_in_water(self):
        actual=self.page.evaluate('''()=>CodaArcadeQA.fishing().shadows.filter(s=>s.visible).map(s=>({
          id:s.id,wet:CodaFishingCaveLayout.isWater(s.x,s.y),heading:s.heading,x:s.x,y:s.y
        }))''')
        self.assertTrue(actual)
        for shadow in actual:
            self.assertTrue(shadow['wet'],shadow)
            self.assertTrue(math.isfinite(shadow['heading']),shadow)

    def set_fx(self,label):
        opened=False
        for _ in range(3):
            if self.page.locator('#fxBtn').inner_text().endswith(label):break
            if not self.page.locator('#fxBtn').is_visible():self.page.locator('#worldMenuBtn').click();opened=True
            self.page.locator('#fxBtn').click();self.page.clock.run_for(32)
        self.assertTrue(self.page.locator('#fxBtn').inner_text().endswith(label))
        if opened:self.page.keyboard.press('Escape');self.page.clock.run_for(32)

    def test_enlarged_stone_landing_gates_the_boat_and_leads_to_a_working_ladder(self):
        self.enter();outside=self.page.evaluate('CodaArcadeQA.position()')
        self.assertTrue(self.page.locator('#fishingBoatBoard').is_disabled(),
                        'The boat is reached by crossing the landing and dock')
        self.walk_to(170,250)
        player=self.state()['player']
        self.assertAlmostEqual(player['x'],170,delta=8)
        self.assertAlmostEqual(player['y'],250,delta=8,
                               msg='The added upper stone landing must be walkable')
        self.page.locator('#fishingLakeCanvas').focus();self.page.keyboard.down('d')
        self.page.clock.run_for(2500);self.page.keyboard.up('d')
        self.assertTrue(self.page.evaluate('''()=>{
          const p=CodaArcadeQA.fishing().player;return CodaFishingCaveLayout.isShore(p.x,p.y);
        }'''),'A walking avatar must stop at the stone edge')
        self.walk_to(170,270);self.board();self.assertEqual(self.state()['phase'],'explore')
        self.fishing_action('#fishingMoor');self.assertEqual(self.state()['phase'],'shore')
        pier=self.state()['boardingPoint'];self.assertLess(math.hypot(self.state()['player']['x']-pier['x'],self.state()['player']['y']-pier['y']),8)
        self.walk_to(145,300);ladder=self.state()['ladder'];self.walk_to(ladder['x'],ladder['y'])
        self.assertEqual(self.state()['near'],'ladder')
        self.assertFalse(self.page.locator('#fishingClimb').is_disabled())
        self.page.locator('#fishingLakeCanvas').focus();self.page.keyboard.press('e');self.page.clock.run_for(100)
        self.assertFalse(self.state()['open'])
        self.assertEqual(self.page.evaluate('CodaArcadeQA.position()'),outside)
        self.assertEqual(self.state()['voiceCount'],0)

    def test_fish_shadows_swim_inside_the_lake_and_freeze_when_the_room_pauses(self):
        self.enter();before={s['id']:(s['x'],s['y'],s['fishId']) for s in self.state()['shadows']}
        self.page.clock.run_for(1800);self.assert_shadows_in_water()
        after=self.state()['shadows']
        self.assertTrue(any(math.hypot(s['x']-before[s['id']][0],s['y']-before[s['id']][1])>15 for s in after))
        self.assertTrue(all(s['fishId']==before[s['id']][2] for s in after),'Swimming cannot change a shadow’s species')
        self.page.evaluate('''()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));}''')
        frozen=[(s['id'],s['x'],s['y']) for s in self.state()['shadows']]
        self.page.clock.run_for(3000)
        self.assertEqual([(s['id'],s['x'],s['y']) for s in self.state()['shadows']],frozen)
        self.page.evaluate("()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));}")
        self.page.clock.run_for(200);self.board();self.approach_shadow()
        self.fishing_action('#fishingCast');hooked=next(s for s in self.state()['shadows'] if not s['visible'])
        self.page.clock.run_for(1800)
        same=next(s for s in self.state()['shadows'] if s['id']==hooked['id'])
        self.assertEqual((same['x'],same['y'],same['fishId']),(hooked['x'],hooked['y'],hooked['fishId']))
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),150)

    def test_live_water_uses_cached_effects_and_fx_off_keeps_fish_gameplay(self):
        self.set_fx('Full');self.enter();self.page.clock.run_for(200)
        first=self.state()['effects'];self.assertEqual(first['quality'],'full')
        self.assertGreater(first['waterCells'],0);self.assertEqual(first['maskBuilds'],1)
        def water_hash():
            return self.page.locator('#fishingLakeCanvas').evaluate('''canvas=>{
              const pixels=canvas.getContext('2d').getImageData(350,250,400,230).data;
              let hash=2166136261;for(const value of pixels)hash=Math.imul(hash^value,16777619);return hash>>>0;
            }''')
        first_ink=water_hash();self.page.clock.run_for(1200);second=self.state()['effects']
        self.assertGreater(second['waterRefreshes'],first['waterRefreshes'])
        self.assertEqual(second['maskBuilds'],1,'The water mask is reused across animated frames')
        self.assertGreater(second['crystalCount'],0);self.assertGreater(second['lanternCount'],0)
        self.assertNotEqual(first_ink,water_hash(),'The rendered water must visibly change with time')
        self.page.emulate_media(reduced_motion='reduce');self.page.clock.run_for(200)
        quiet=self.state()['effects'];self.assertTrue(quiet['reducedMotion']);self.assertEqual(quiet['moteCount'],0)
        self.page.locator('#fishingClose').click();self.set_fx('Off');enter_room(self.page,'fishing');self.page.clock.run_for(100)
        off=self.state()['effects'];self.assertEqual(off['quality'],'off');self.assertEqual(off['moteCount'],0)
        positions=[(s['x'],s['y']) for s in self.state()['shadows']];self.page.clock.run_for(1000)
        self.assertEqual(self.state()['effects']['waterRefreshes'],off['waterRefreshes'])
        self.assertNotEqual([(s['x'],s['y']) for s in self.state()['shadows']],positions,
                            'FX Off must not freeze the fish a player is trying to approach')

    def test_actual_rare_fishing_staff_draws_primary_and_secondary_beams(self):
        self.context.add_init_script('Math.random=()=>0.999;')
        self.load();self.page.evaluate('CodaMusicNotation.load()');self.page.clock.run_for(64)
        self.page.evaluate('''()=>{
          window.caveBeamDraws=[];const draw=CodaRhythmBeaming.draw;
          CodaRhythmBeaming.draw=function(ctx,options){const result=draw(ctx,options);
            if(ctx.canvas.id==='fishingRhythmCanvas')caveBeamDraws.push({
              meter:result.meter.id,drawn:result.drawnGroups,groups:result.groups.length,
              secondary:result.groups.reduce((sum,g)=>sum+g.secondary.length,0),
              top:result.metrics?.beamTop,thickness:result.metrics?.beamThickness});return result;};
        }''')
        self.cast('6/8');self.page.clock.run_for(250)
        actual=self.page.evaluate('caveBeamDraws')
        self.assertTrue(actual,'The live staff must use the shared beam renderer')
        self.assertTrue(any(frame['meter']=='6/8' and frame['drawn']>0 and frame['secondary']>0 for frame in actual))
        self.assertTrue(all(frame.get('top',0)>=0 and frame.get('thickness',2)>=2 for frame in actual))
        self.page.screenshot(path='/tmp/coda-cave32-beamed-fishing.png')
        self.page.keyboard.press('Escape');self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),150)

    def test_ladder_exit_works_with_the_large_mobile_interact_button_phone(self):
        self.enter();outside=self.page.evaluate('CodaArcadeQA.position()')
        ladder=self.state()['ladder'];self.walk_to(ladder['x'],ladder['y']);self.page.clock.run_for(150)
        self.assertTrue(self.state()['ladder']['near']);self.assertEqual(self.state()['near'],'ladder')
        action=self.page.locator('#codaTouchControls [data-action="interact"]')
        self.assertIn('Climb',action.inner_text());self.assertGreaterEqual(action.bounding_box()['height'],44)
        action.tap();self.page.clock.run_for(150)
        self.assertFalse(self.state()['open']);self.assertEqual(self.page.evaluate('CodaArcadeQA.touch().context'),'world')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.touch().held'),[])
        self.assertEqual(self.page.evaluate('CodaArcadeQA.position()'),outside)


if __name__=='__main__':unittest.main(verbosity=2)
