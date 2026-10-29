"""Visible vibe lighting and temporary NPC costumes in the assembled arcade.

The renderer probe records the appearance actually sent to the JavaScript
character painter. It does not replace animation, interaction or rendering.
"""
import importlib.util
from pathlib import Path
import sys
import unittest
from world_navigation_helpers import enter_room

sys.dont_write_bytecode=True
_spec=importlib.util.spec_from_file_location('effects_world_browser',Path(__file__).with_name('learning-world-browser.py'))
_world=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_world)

RENDER_PROBE='''(()=>{
  localStorage.setItem('codaArcadeFXV1','full');
  window.__vibePainted={};let factory;
  Object.defineProperty(window,'createCodaCharacterRenderer',{configurable:true,
    get(){return factory;},set(value){factory=(...args)=>{
      const renderer=value(...args);
      for(const method of ['drawNPC','drawPlayer']){
        const original=renderer[method];renderer[method]=function(g,raw,motion,...rest){
          const id=method==='drawNPC'?raw?.id:motion?.pixelTarget||raw?.characterId||'player';
          const appearance=method==='drawNPC'?raw?.appearance||{}:raw||{};
          window.__vibePainted[(g.canvas.id||'world-surface')+':'+id]={id,method,
            appearance:JSON.parse(JSON.stringify(appearance))};
          return original.call(this,g,raw,motion,...rest);
        };
      }
      return renderer;
    };}});
})();'''


class VibeEffectsBrowserTests(_world.WorldBrowserCase):
    def setUp(self):
        super().setUp()
        self.context.add_init_script(RENDER_PROBE)
        self.page.goto(_world.WORLD+'?dev-test=1',wait_until='domcontentloaded')
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready()&&window.CodaArcadeQA?.testMode().seeded')
        self.page.wait_for_timeout(180)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.atmosphere().quality'),'full')

    def vibe(self,name):
        self.page.evaluate('window.__vibePainted={}')
        self.assertTrue(self.page.evaluate('name=>CodaArcadeQA.setVibe(name)',name))
        self.page.wait_for_timeout(150)

    def painted(self,identity):
        return self.page.evaluate('''id=>Object.values(__vibePainted).find(item=>item.id===id)?.appearance||null''',identity)

    def test_spooky_costumes_reach_actual_npc_painter_without_changing_saved_looks(self):
        self.vibe('classic')
        baseline=self.page.evaluate('''()=>({looks:localStorage.getItem('codaNPCOutfitsV1'),
          avatar:JSON.stringify(CodaArcadeQA.characters().player.appearance),
          npcs:CodaArcadeQA.characters().npcs.map(npc=>({id:npc.id,appearance:npc.appearance}))})''')
        painted=self.page.evaluate('Object.values(__vibePainted).filter(item=>item.method==="drawNPC"||["riff","pip"].includes(item.id))')
        baseline_painted={entry['id']:entry['appearance'] for entry in painted}
        player_before=self.painted('player')
        self.assertGreaterEqual(len(baseline_painted),4)
        self.vibe('spooky')
        costumes=self.page.evaluate('Object.values(__vibePainted).filter(item=>item.method==="drawNPC"||["riff","pip"].includes(item.id))')
        shared=[item for item in costumes if item['id'] in baseline_painted]
        self.assertGreaterEqual(len(shared),4)
        signatures=set()
        for entry in shared:
            look=entry['appearance'];before=baseline_painted[entry['id']]
            self.assertNotEqual(look,before,entry['id']+' should wear a temporary costume')
            for key in ['skin','hair','hairstyle']:
                if key in before:self.assertEqual(look.get(key),before[key],entry['id']+' keeps '+key)
            signatures.add(tuple(look.get(key) for key in ['shirt','outfit','headwear','accessory']))
        self.assertGreaterEqual(len(signatures),4,'Halloween costumes must vary between NPCs')
        self.assertTrue({'riff','pip'}.issubset({entry['id'] for entry in shared}),'Both shopkeepers join Halloween')
        self.assertEqual(self.page.evaluate('localStorage.getItem("codaNPCOutfitsV1")'),baseline['looks'])
        self.assertEqual(self.page.evaluate('JSON.stringify(CodaArcadeQA.characters().player.appearance)'),baseline['avatar'])
        player_after=self.painted('player')
        for key in ['skin','hair','hairstyle','outfit','shirt','lowerColor','headwear','eyewear','accessory','shoes','form','pet']:
            self.assertEqual(player_after.get(key),player_before.get(key),'The player keeps their own '+key)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.characters().npcs.map(npc=>({id:npc.id,appearance:npc.appearance}))'),baseline['npcs'])
        self.page.screenshot(path='/tmp/coda-vibes83-spooky-world.png')
        self.vibe('classic')
        for identity,look in baseline_painted.items():
            restored=self.painted(identity)
            if restored is not None:self.assertEqual(restored,look,identity+' returns to their original outfit')

    def test_glowstick_core_stays_bright_after_the_world_colour_grade(self):
        self.place(1180,620);self.page.evaluate('CodaArcadeQA.setZoom(1.5)')
        self.vibe('glowstick');self.page.wait_for_timeout(300)
        metrics=self.page.locator('#view').evaluate('''canvas=>{
          const actor=CodaArcadeQA.characters().player,camera=CodaArcadeQA.camera(),
            cx=(actor.x+12-camera.x)*camera.zoom,cy=(actor.y-25-camera.y)*camera.zoom,
            radius=Math.ceil(13*camera.zoom),x=Math.max(0,Math.floor(cx-radius)),y=Math.max(0,Math.floor(cy-radius)),
            width=Math.min(canvas.width-x,radius*2),height=Math.min(canvas.height-y,radius*2),
            pixels=canvas.getContext('2d').getImageData(x,y,width,height).data;
          let core=0,glow=0,peak=0;
          for(let n=0;n<pixels.length;n+=4){
            peak=Math.max(peak,pixels[n+1]);
            if(pixels[n+1]>220&&pixels[n+2]>175)core++;
            if(pixels[n+1]>130&&pixels[n+2]>110)glow++;
          }return {core,glow,peak};
        }''')
        self.assertGreater(metrics['core'],8,metrics)
        self.assertGreater(metrics['glow'],40,metrics)
        self.page.screenshot(path='/tmp/coda-vibes83-glowstick-world.png')

    def test_room_npcs_join_halloween_and_return_to_their_own_clothes(self):
        for room,identity in [('piano','chopin'),('classroom','haydn'),('fishing','captain-cadence')]:
            self.vibe('classic');enter_room(self.page,room);self.page.wait_for_timeout(120)
            before=self.painted(identity);self.assertIsNotNone(before,room)
            self.vibe('spooky');costume=self.painted(identity)
            self.assertIsNotNone(costume,room);self.assertNotEqual(costume,before,room)
            for key in ['skin','hair','hairstyle']:
                if key in before:self.assertEqual(costume.get(key),before[key],room+' preserves '+key)
            self.page.screenshot(path='/tmp/coda-vibes83-spooky-'+room+'.png')
            self.vibe('classic');self.assertEqual(self.painted(identity),before,room)
            self.page.keyboard.press('Escape')

    def test_full_effects_render_every_theme_on_desktop_and_small_touch_layout(self):
        self.page.evaluate('CodaArcadeQA.setZoom(.8)')
        for name in ['aurora','festival','glowstick','spooky']:
            self.vibe(name)
            raster=self.page.evaluate('CodaArcadeQA.atmosphere().vibeRaster')
            self.assertLessEqual(raster['width']*raster['height'],1672*941//3)
            self.assertLessEqual(raster['refreshHz'],30)
            metrics=self.page.locator('#view').evaluate('''canvas=>{
              const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
              let bright=0,coloured=0;for(let n=0;n<pixels.length;n+=16){
                const high=Math.max(pixels[n],pixels[n+1],pixels[n+2]),low=Math.min(pixels[n],pixels[n+1],pixels[n+2]);
                if(high>170)bright++;if(high-low>45)coloured++;
              }return {bright,coloured};
            }''')
            self.assertGreater(metrics['bright'],100,metrics);self.assertGreater(metrics['coloured'],3000,metrics)
            self.page.screenshot(path='/tmp/coda-vibes83-'+name+'-full.png')
        self.page.set_viewport_size({'width':390,'height':844})
        for name in ['aurora','spooky']:
            self.vibe(name)
            self.assertEqual(self.page.evaluate('CodaArcadeQA.vibes().quality'),'full')
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
            self.page.screenshot(path='/tmp/coda-vibes83-'+name+'-mobile.png')
        self.page.emulate_media(reduced_motion='reduce')
        self.page.wait_for_timeout(100)
        self.assertTrue(self.page.evaluate('CodaArcadeQA.vibes().reducedMotion'))
        self.vibe('festival')
        self.page.locator('#fxBtn').dispatch_event('click')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.vibes().quality'),'lite')
        self.page.locator('#fxBtn').dispatch_event('click')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.vibes().quality'),'off')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.atmosphere().vibeRaster.refreshHz'),0)
        self.vibe('glowstick');self.assertEqual(self.page.evaluate('CodaArcadeQA.vibes().active'),'glowstick')


if __name__=='__main__':unittest.main(verbosity=2)
