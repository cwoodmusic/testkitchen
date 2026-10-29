"""Scenery silhouettes receive the same vibe grade as their baked background.

Use the actual assembled scene and a uniformly graded Classic image as the
reference. Static Effects Off removes animated light noise from pixel probes.
All project edits and unlocks live in disposable browser contexts.
"""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode=True
_spec=importlib.util.spec_from_file_location('scenery_world_browser',Path(__file__).with_name('learning-world-browser.py'))
_world=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_world)


class VibeSceneryBrowserTests(_world.WorldBrowserCase):
    def setUp(self):
        super().setUp()
        self.page.goto(_world.WORLD+'?dev-test=1',wait_until='domcontentloaded')
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready()&&window.CodaArcadeQA?.testMode().seeded')
        self.page.evaluate('CodaArcadeQA.setZoom(1)')
        self.page.wait_for_function('CodaArcadeQA.camera().zoom===1')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.atmosphere().quality'),'off')

    def vibe(self,name):
        self.assertTrue(self.page.evaluate('name=>CodaArcadeQA.setVibe(name)',name))
        self.page.evaluate('''()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))''')

    def points_in(self,regions,step=7):
        return [[x,y] for bx,by,width,height in regions
                for y in range(by+3,by+height-3,step)
                for x in range(bx+3,bx+width-3,step)]

    def pixels(self,points):
        return self.page.evaluate('''points=>{
          const canvas=document.querySelector('#view'),g=canvas.getContext('2d'),camera=CodaArcadeQA.camera();
          return points.map(([x,y])=>Array.from(g.getImageData(
            Math.floor((x+.5-camera.x)*camera.zoom),Math.floor((y+.5-camera.y)*camera.zoom),1,1).data));
        }''',points)

    def uniformly_graded(self,colors,vibe):
        return self.page.evaluate('''({colors,vibe})=>{
          const canvas=document.createElement('canvas');canvas.width=colors.length;canvas.height=1;
          const g=canvas.getContext('2d'),pixels=g.createImageData(colors.length,1);
          colors.forEach((color,n)=>pixels.data.set(color,n*4));g.putImageData(pixels,0,0);
          const reference=CodaArcadeVibes.create({getLevel:()=>50,getQuality:()=> 'off',
            reducedMotion:true,document,body:{dataset:{}},storage:{getItem:()=>null,setItem(){}}});
          reference.setVibe(vibe);reference.drawAtmosphere(g,{width:colors.length,height:1,time:0});
          const result=g.getImageData(0,0,colors.length,1).data;
          reference.destroy();return colors.map((_,n)=>Array.from(result.slice(n*4,n*4+4)));
        }''',{'colors':colors,'vibe':vibe})

    def assert_same_grade(self,points,classic,vibe,tolerance=5,max_bad_fraction=.015):
        expected=self.uniformly_graded(classic,vibe);actual=self.pixels(points)
        bad=[]
        for point,want,got in zip(points,expected,actual):
            error=max(abs(a-b) for a,b in zip(want[:3],got[:3]))
            if error>tolerance:bad.append({'point':point,'expected':want,'actual':got,'error':error})
        self.assertLessEqual(len(bad),max(1,int(len(points)*max_bad_fraction)),
          vibe+' leaves ungraded scenery or grades it twice: '+str(bad[:8])+f' ({len(bad)}/{len(points)} pixels)')

    def test_curved_couch_and_plant_silhouettes_match_the_uniform_room_grade(self):
        points=self.points_in([[135,141,264,88],[165,141,58,78],[428,2,55,98],
          [1184,80,80,85],[1330,71,58,93],[578,782,68,85]],step=6)
        self.vibe('classic');classic=self.pixels(points)
        for vibe in ['glowstick','spooky','aurora','festival']:
            self.vibe(vibe);self.assert_same_grade(points,classic,vibe,max_bad_fraction=0)
            self.page.screenshot(path='/tmp/coda-vibe-scenery-'+vibe+'.png')
            if vibe=='glowstick':self.page.screenshot(path='/tmp/coda-vibe-scenery-fixed.png')
        self.vibe('classic');self.assertEqual(self.pixels(points),classic,'Classic restores the original scenery pixels')

    def seed_project(self,layer='world',opacity=100,move_couch=False,paint=False):
        self.vibe('classic')
        self.page.evaluate('''({layer,opacity,moveCouch,paint})=>{
          const project=CodaDeveloperConsole.getProject(),image=document.createElement('canvas');
          image.width=image.height=8;const context=image.getContext('2d');
          context.fillStyle='#cf196a';context.fillRect(0,0,8,8);
          project.assets.push({id:'vibe-image-test',name:'Vibe regression image',kind:'image',ref:null,
            data:image.toDataURL(),crop:null,x:1100,y:590,w:80,h:80,rotation:0,opacity,
            visible:true,locked:false,keepAspect:true,layer,anim:'none',speed:1,amplitude:0,
            cols:1,rows:1,frames:1,fps:0});
          if(moveCouch){const couch=project.assets.find(asset=>asset.origin?.name==='lounge_sofa');
            if(!couch)throw Error('Published curved couch must exist');couch.x=980;couch.y=715;}
          if(paint)project.strokes.push({tool:'paint',size:16,points:[[1100,590]],depth:1200,foreground:true});
          project.savedAt=123;localStorage.setItem('codaWorldProjectV1',JSON.stringify(project));
        }''',{'layer':layer,'opacity':opacity,'moveCouch':move_couch,'paint':paint})
        # Reloading test mode deliberately starts fresh memory. Seed its source
        # project in this disposable tab's native store before that reload.
        project=self.page.evaluate('localStorage.getItem("codaWorldProjectV1")')
        self.page.goto(_world.WORLD,wait_until='domcontentloaded')
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready()')
        self.page.evaluate('value=>localStorage.setItem("codaWorldProjectV1",value)',project)
        self.page.goto(_world.WORLD+'?dev-test=1',wait_until='domcontentloaded')
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready()&&window.CodaArcadeQA?.testMode().seeded')
        self.page.evaluate('CodaArcadeQA.setZoom(1)')
        self.page.wait_for_function('CodaArcadeQA.camera().zoom===1')
        self.vibe('classic')

    def test_moved_couch_translucent_import_and_foreground_brush_use_one_grade(self):
        self.seed_project(layer='world',opacity=55,move_couch=True,paint=True)
        # This witness includes transformed built-in art, a translucent uploaded
        # image, and its pixels promoted by a real project foreground stroke.
        points=self.points_in([[850,667,260,86],[1068,557,64,64]],step=8)
        classic=self.pixels(points)
        brush_points=[[1098,588],[1102,588],[1098,592],[1102,592]]
        brush_classic=self.pixels(brush_points)
        for vibe in ['glowstick','spooky','aurora','festival']:
            self.vibe(vibe);self.assert_same_grade(points,classic,vibe,max_bad_fraction=.025)
            self.assert_same_grade(brush_points,brush_classic,vibe,max_bad_fraction=0)
        self.vibe('classic');self.assertEqual(self.pixels(points),classic)

    def test_foreground_image_keeps_depth_occlusion_and_uncovered_glowstick_is_bright(self):
        self.seed_project(layer='front')
        self.place(1100,620);self.vibe('classic')
        points=self.points_in([[1098,587,25,18]],step=3)
        classic=self.pixels(points)
        self.vibe('glowstick');self.assert_same_grade(points,classic,'glowstick',max_bad_fraction=0)
        self.place(1220,620)
        points=self.points_in([[1228,584,10,27]],step=2)
        colors=self.pixels(points)
        self.assertGreater(sum(color[1]>220 and color[2]>175 for color in colors),5,
          'Fixing scenery must retain the bright, uncovered glowstick core')


if __name__=='__main__':unittest.main(verbosity=2)
