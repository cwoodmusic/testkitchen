"""Native Canvas wardrobe regressions, including production boutique/preview UI.

Run: python3 tests/avatar-rendering-browser.py
No game saves, network access, credentials, or fixture-only renderer are used.
"""
import importlib.util
from pathlib import Path
import sys
import unittest
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('avatar_visual_audit',Path(__file__).with_name('avatar-visual-audit.py'))
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)

SETUP=r'''()=>{
 window.avatarRenderer=createCodaCharacterRenderer();
 window.avatarBase=avatarRenderer.normalizeProfile({hairstyle:'bald',headwear:'none',eyewear:'none',accessory:'none',form:'human',outfit:'pants',shoes:'sneakers',pet:'none'});
 window.pixelHash=canvas=>{const bytes=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let a=2166136261,b=5381,count=0;for(const byte of bytes){a=Math.imul(a^byte,16777619)>>>0;b=((b<<5)+b)^byte;}for(let i=3;i<bytes.length;i+=4)if(bytes[i])count++;return {hash:a.toString(16)+':'+(b>>>0).toString(16),count};};
 window.avatarRaster=(profile,motion={},time=.6,renderer=avatarRenderer)=>{const canvas=Object.assign(document.createElement('canvas'),{width:160,height:160});renderer.drawPlayer(canvas.getContext('2d'),profile,{x:80,y:128,scale:1,previewPet:true,...motion},time);return pixelHash(canvas);};
 window.avatarProfile={...avatarBase};
 const panelBody=document.querySelector('#panelBody');
 window.musicianUI=createCodaMusicianUI({renderer:avatarRenderer,panelBody,getBrain:()=>null,canvas:document.querySelector('#world'),clearInput:()=>{},npcs:[],openWardrobe:()=>{}});
 window.boutiqueUI=createCodaBoutiqueUI({renderer:avatarRenderer,panelBody,getProfile:()=>avatarProfile,getPreviewUI:()=>musicianUI,openPanel:()=>panelBody.replaceChildren(),closePanel:()=>{},applyProfile:()=>true,unlocked:()=>true});
}'''

class AvatarRenderingTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.pw=sync_playwright().start();cls.browser=cls.pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 @classmethod
 def tearDownClass(cls):cls.browser.close();cls.pw.stop()
 def setUp(self):
  self.context=self.browser.new_context(viewport={'width':1600,'height':1100});self.context.route('**/*',lambda route:route.abort());self.page=self.context.new_page();self.errors=[];self.page.on('pageerror',lambda error:self.errors.append(str(error)))
  self.page.set_content('<!doctype html><meta charset="utf-8"><div id="dialog"><strong id="who"></strong><p id="words"></p><button id="close"></button></div><button id="accountBtn">Account</button><canvas id="world"></canvas><section id="panel"><div id="panelBody"></div></section>')
  for name in ['npc-visitors.js','pet-companion.js','character-renderer.js','musician-ui.js','boutique-ui.js']:self.page.add_script_tag(path=str(ROOT/name))
  self.page.evaluate(SETUP)
 def tearDown(self):self.context.close();self.assertEqual(self.errors,[])
 def test_every_choice_is_visibly_unique_front_and_across_walking_facings(self):
  result=self.page.evaluate(audit.SCRIPT)['summary']
  self.assertEqual(result['duplicates'],[]);self.assertEqual(result['frontDuplicates'],[]);self.assertEqual(result['invisible'],[]);self.assertEqual(result['labelDuplicates'],[])
  self.assertGreater(sum(map(len,result['groups'].values())),170)
  # Glasses and front jewelry correctly disappear behind the head/body.
  unexpected=[x for x in result['perFacingDuplicates'] if x['facing']!='up' or x['group'] not in ('eyewear','accessories')]
  self.assertEqual(unexpected,[])
 def test_all_emotes_face_front_and_keep_distinct_stable_reduced_motion_poses(self):
  result=self.page.evaluate(audit.SCRIPT)['summary'];seen={}
  for id,emote in result['emotes'].items():
   self.assertTrue(emote['frontFacing'],id);self.assertFalse(emote['quietInvisible'],id);self.assertEqual(len(set(emote['quietHashes'])),1,id)
   self.assertNotIn(emote['quietHashes'][0],seen,(id,seen.get(emote['quietHashes'][0])));seen[emote['quietHashes'][0]]=id
 def test_real_boutique_tiles_show_hair_under_wizard_alien_and_large_eyewear(self):
  for form in ['human','alien','starlight']:
   self.page.evaluate("form=>{avatarProfile={...avatarBase,form,headwear:'wizard',eyewear:'cybervisor',accessory:'balloon',hairstyle:'long'};boutiqueUI.open();}",form)
   self.page.get_by_role('button',name='Browse Hair',exact=True).click()
   hashes=self.page.locator('.boutique-item').evaluate_all("items=>items.map(item=>({id:item.dataset.itemId,...pixelHash(item.querySelector('canvas'))}))")
   self.assertEqual(len(hashes),17);self.assertEqual(len({x['hash'] for x in hashes}),17,(form,hashes))
   self.assertTrue(all(x['count']>500 for x in hashes))
   self.assertEqual(self.page.locator('#boutique-headwear').input_value(),'wizard','Catalog helper must preserve actual worn draft')
   self.assertEqual(self.page.locator('#boutique-form').input_value(),form)
 def test_real_boutique_shoes_visible_under_gown_and_previews_do_not_mutate_draft(self):
  self.page.evaluate("()=>{avatarProfile={...avatarBase,outfit:'gown',pet:'neondragon',headwear:'wizard',accessory:'balloon'};boutiqueUI.open();}")
  self.page.get_by_role('button',name='Browse Shoes',exact=True).click()
  result=self.page.locator('.boutique-item').evaluate_all("items=>items.map(item=>({id:item.dataset.itemId,...pixelHash(item.querySelector('canvas'))}))")
  self.assertEqual(len(result),18);self.assertEqual(len({x['hash'] for x in result}),18)
  draft=self.page.evaluate('boutiqueUI.getDraft()');self.assertEqual(draft['outfit'],'gown');self.assertEqual(draft['pet'],'neondragon');self.assertEqual(draft['headwear'],'wizard');self.assertEqual(draft['accessory'],'balloon')
 def test_all_actual_catalog_thumbnail_categories_remain_distinct_in_a_full_costume(self):
  self.page.evaluate("()=>{avatarProfile={...avatarBase,hairstyle:'long',form:'alien',outfit:'gown',headwear:'wizard',eyewear:'cybervisor',accessory:'balloon',shoes:'heels',pet:'neondragon'};boutiqueUI.open();}")
  for category in ['Hats','Glasses','Accessories','Shoes','Emotes','Outfits','Hair','Transformations','Pets']:
   self.page.get_by_role('button',name='Browse '+category,exact=True).click()
   tiles=self.page.locator('.boutique-item').evaluate_all("items=>items.map(item=>({id:item.dataset.itemId,...pixelHash(item.querySelector('canvas'))}))")
   hashes={}
   for tile in tiles:
    self.assertNotIn(tile['hash'],hashes,(category,tile['id'],hashes.get(tile['hash'])));hashes[tile['hash']]=tile['id']
 def test_actual_four_view_live_preview_draws_every_pet_in_idle_walk_and_emote(self):
  self.page.evaluate('boutiqueUI.open()')
  for mode in ['idle','walk','emote']:
   self.page.locator('#avatarPreviewMode').select_option(mode)
   for pet in ['cosmiccat','neondragon','lakeotter','rhythmfox','pianophoenix']:
    result=self.page.evaluate("""pet=>{
      const selector=document.querySelector('#boutique-pet');selector.value='none';selector.dispatchEvent(new Event('change'));musicianUI.drawPreview(.6);
      const canvases=[...document.querySelectorAll('.avatar-preview-views canvas')],without=canvases.map(pixelHash);
      selector.value=pet;selector.dispatchEvent(new Event('change'));musicianUI.drawPreview(.6);
      return canvases.map((canvas,index)=>({withPet:pixelHash(canvas),without:without[index],width:canvas.width,height:canvas.height}));
    }""",pet)
    self.assertEqual(len(result),4)
    for face in result:
     self.assertEqual((face['width'],face['height']),(176,160));self.assertNotEqual(face['withPet']['hash'],face['without']['hash'],(mode,pet));self.assertGreater(face['withPet']['count'],face['without']['count'],(mode,pet))
 def test_reduced_motion_freezes_all_equipment_forms_and_pets_without_removing_them(self):
  unstable=self.page.evaluate(r'''()=>{
   const renderer=createCodaCharacterRenderer({reducedMotion:()=>true}),slots={hairstyles:'hairstyle',outfits:'outfit',headwear:'headwear',eyewear:'eyewear',accessories:'accessory',shoes:'shoes',forms:'form',pets:'pet'},failures=[];
   for(const [group,slot]of Object.entries(slots))for(const item of renderer.catalog[group]){
    const p={...avatarBase,[slot]:item.id},one=avatarRaster(p,{facing:'down'},.1,renderer),two=avatarRaster(p,{facing:'down'},1.8,renderer);
    if(one.hash!==two.hash)failures.push(group+':'+item.id);
   }
   return failures;
  }''')
  self.assertEqual(unstable,[])
 def test_production_thumbnail_shop_live_frames_do_not_clip_gear_pets_or_emotes(self):
  clipped=self.page.evaluate(r'''()=>{
   const captured=[],original=avatarRenderer.drawPlayer;avatarRenderer.drawPlayer=(ctx,p,m,t)=>{captured.push({kind:ctx.canvas.getAttribute('aria-label')?.includes('avatar preview')?'live':'tile',w:ctx.canvas.width,h:ctx.canvas.height,x:m.x,y:m.y,s:m.scale});original(ctx,p,m,t);};boutiqueUI.open();avatarRenderer.drawPlayer=original;
   const tile=captured.find(item=>item.kind==='tile'),live=captured.find(item=>item.kind==='live');
   if(!tile||!live)throw Error('Production boutique and live renderer calls were not captured');
   const layouts=[{...tile,name:'tile'},{name:'shop',w:128,h:144,x:54,y:126,s:1.45},{...live,name:'live'}];
   const slots={hairstyles:'hairstyle',outfits:'outfit',headwear:'headwear',eyewear:'eyewear',accessories:'accessory',shoes:'shoes',forms:'form',pets:'pet',emotes:'emote'},failures=[];
   const draw=(profile,motion,time,layout,label)=>{
    const c=Object.assign(document.createElement('canvas'),{width:400,height:400}),g=c.getContext('2d',{willReadFrequently:true});avatarRenderer.drawPlayer(g,profile,{x:200,y:300,scale:layout.s,previewPet:true,...motion},time);
    const bytes=g.getImageData(0,0,400,400).data,left=200-layout.x,top=300-layout.y,right=left+layout.w,bottom=top+layout.h;let outside=0,minX=400,maxX=-1,minY=400,maxY=-1;
    for(let y=0;y<400;y++)for(let x=0;x<400;x++)if(bytes[(y*400+x)*4+3]){minX=Math.min(minX,x-left);maxX=Math.max(maxX,x-left);minY=Math.min(minY,y-top);maxY=Math.max(maxY,y-top);if(x<left||x>=right||y<top||y>=bottom)outside++;}
    if(outside)failures.push({layout:layout.name,label,motion,outside,bounds:{minX,maxX,minY,maxY}});
   };
   for(const [group,slot]of Object.entries(slots))for(const item of avatarRenderer.catalog[group])for(const layout of layouts){
    const p=layout.name==='live'?{...avatarBase,[slot]:item.id}:avatarRenderer.itemPreviewProfile({...avatarBase,form:'alien',headwear:'wizard',accessory:'balloon',outfit:'gown'},slot,item.id);
    for(const facing of ['down','left','up','right'])draw(p,{facing,walking:group!=='emotes',phase:.9,emote:group==='emotes'?item.id:null,emoteTime:.6},.6,layout,group+':'+item.id);
   }
   const combos=[{headwear:'wizard',hairstyle:'mohawk',accessory:'balloon',pet:'neondragon'},{headwear:'tophat',accessory:'umbrella',pet:'pianophoenix'},{form:'starlight',headwear:'grandstaffcrown',accessory:'nebulaaura',pet:'rhythmfox'}];
   for(const [index,combo]of combos.entries())for(const emote of avatarRenderer.catalog.emotes)for(const time of Array.from({length:21},(_,i)=>i/10))draw({...avatarBase,...combo},{emote:emote.id,emoteTime:time},time,layouts[2],'combo'+index+':'+emote.id);
   return failures;
  }''')
  self.assertEqual(clipped,[])

if __name__=='__main__':unittest.main(verbosity=2)
