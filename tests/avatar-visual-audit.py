"""Render every wardrobe choice on real Canvas; write contact sheets and pixel audits.

Run: python3 tests/avatar-visual-audit.py --output /tmp/avatar-audit
The diagnostic reports exact raster duplicates and invisible choices. Use
--strict after reviewing intentional rear occlusion/default choices.
"""
import argparse
import json
from pathlib import Path
import sys
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
SCRIPT=r'''()=>{
 const normal=createCodaCharacterRenderer(),quiet=createCodaCharacterRenderer({reducedMotion:()=>true});
 const slots={hairstyles:'hairstyle',outfits:'outfit',headwear:'headwear',eyewear:'eyewear',accessories:'accessory',shoes:'shoes',forms:'form',pets:'pet',emotes:'emote'};
 const base={skin:'#e5ad75',hair:'#302334',shirt:'#8794a8',lowerColor:'#59627a',hairstyle:'bald',outfit:'pants',headwear:'none',eyewear:'none',accessory:'none',shoes:'sneakers',form:'human',pet:'none'};
 const defaults={hairstyles:'bald',outfits:'pants',headwear:'none',eyewear:'none',accessories:'none',shoes:'sneakers',forms:'human',pets:'none'};
 const faces=['down','left','up','right'],times=[.15,.3,.6,.9,1.2],frames=[];
 function makeCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
 function raster(profile,motion={},time=.6,reduced=false){
  const c=makeCanvas(160,160),g=c.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=false;
  (reduced?quiet:normal).drawPlayer(g,profile,{x:80,y:128,scale:1,previewPet:true,...motion},time);
  const data=g.getImageData(0,0,160,160).data;let a=2166136261,b=5381,count=0,minX=160,minY=160,maxX=-1,maxY=-1;
  for(let i=0;i<data.length;i++){a=Math.imul(a^data[i],16777619)>>>0;b=((b<<5)+b)^data[i];if(i%4===3&&data[i]){const pos=(i-3)/4,x=pos%160,y=Math.floor(pos/160);count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}
  return {canvas:c,hash:a.toString(16)+':'+(b>>>0).toString(16),pixels:count,bounds:{minX:minX-80,maxX:maxX-80,minY:minY-128,maxY:maxY-128}};
 }
 const sheets=[],summary={groups:{},duplicates:[],frontDuplicates:[],invisible:[],labelDuplicates:[],perFacingDuplicates:[],clipping:[],emotes:{},combos:[],catalog:normal.catalog};
 function sheet(name,rows){
  const columns=3,tileW=448,tileH=162,c=makeCanvas(columns*tileW,Math.ceil(rows.length/columns)*tileH+32),g=c.getContext('2d');g.fillStyle='#172135';g.fillRect(0,0,c.width,c.height);g.font='bold 15px monospace';g.fillStyle='#f9e9ba';g.fillText(name,12,22);
  rows.forEach((row,index)=>{const x=(index%columns)*tileW,y=32+Math.floor(index/columns)*tileH;g.fillStyle=index%2?'#202e46':'#1c2940';g.fillRect(x+3,y+3,tileW-6,tileH-6);g.fillStyle='#e6f5ff';g.font='12px monospace';g.fillText(row.label.slice(0,45),x+8,y+20);g.imageSmoothingEnabled=false;
   row.frames.forEach((frame,at)=>{const cx=x+56+at*112;g.fillStyle='#a0afc9';g.font='10px monospace';g.fillText(row.headings?.[at]||faces[at]||'',cx-24,y+36);g.drawImage(frame.canvas,32,40,96,96,cx-51,y+42,102,102);});
  });sheets.push({name,data:c.toDataURL('image/png')});
 }
 for(const [group,slot]of Object.entries(slots)){
  const choices=normal.catalog[group]||[],items=[],baseline=faces.map(facing=>raster(base,{facing}));
  const labelMap=new Map();for(const item of choices){const key=item.label.trim().toLocaleLowerCase();if(labelMap.has(key))summary.labelDuplicates.push({group,label:item.label,ids:[labelMap.get(key),item.id]});else labelMap.set(key,item.id);}
  for(const item of choices){
   const profile={...base,[slot]:item.id},motions=group==='emotes'?times.map(emoteTime=>({emote:item.id,emoteTime,facing:'down'})):faces.map(facing=>({facing}));
   const rendered=motions.map((motion,index)=>raster(profile,motion,group==='emotes'?times[index]:.6));
   const walks=faces.map(facing=>raster(profile,{facing,walking:true,phase:.9}));
   const itemSummary={id:item.id,label:item.label,signature:rendered.map(frame=>frame.hash).join('|'),walkSignature:walks.map(frame=>frame.hash).join('|'),faces:rendered.map(frame=>({hash:frame.hash,pixels:frame.pixels,bounds:frame.bounds}))};
   items.push(itemSummary);frames.push(...rendered);
   if(group!=='emotes'&&item.id!==defaults[group]&&rendered.every((frame,index)=>frame.hash===baseline[index].hash))summary.invisible.push({group,id:item.id});
   for(let at=0;at<rendered.length;at++){const b=rendered[at].bounds;for(const [width,height,footY]of [[80,96,80],[96,112,96]])if(b.minX< -width/2||b.maxX>=width/2||b.minY< -footY||b.maxY>=height-footY)summary.clipping.push({group,id:item.id,pose:group==='emotes'?times[at]:faces[at],frame:width+'x'+height,bounds:b});}
   const displayed=group==='emotes'?rendered.slice(0,4):rendered;itemSummary.contact={label:item.id+' · '+item.label,frames:displayed,headings:group==='emotes'?times.slice(0,4).map(String):faces};
  }
  const seen=new Map();for(const item of items){const key=item.signature+'~'+item.walkSignature;if(seen.has(key))summary.duplicates.push({group,ids:[seen.get(key),item.id]});else seen.set(key,item.id);}
  const fronts=new Map();for(const item of items){const key=item.faces[0].hash;if(fronts.has(key))summary.frontDuplicates.push({group,ids:[fronts.get(key),item.id]});else fronts.set(key,item.id);}
  if(group!=='emotes')for(let at=0;at<4;at++){const map=new Map();for(const item of items){const key=item.faces[at].hash;if(!map.has(key))map.set(key,[]);map.get(key).push(item.id);}for(const ids of map.values())if(ids.length>1)summary.perFacingDuplicates.push({group,facing:faces[at],ids});}
  for(let start=0;start<items.length;start+=18)sheet(group+'-'+(Math.floor(start/18)+1),items.slice(start,start+18).map(item=>item.contact));
  summary.groups[group]=items.map(({contact,...item})=>item);
 }
 const quietRows=[],idle=raster(base,{},.6,true);for(const item of normal.catalog.emotes){const frames=times.map(emoteTime=>raster(base,{emote:item.id,emoteTime,facing:'up'},emoteTime,true));summary.emotes[item.id]={quietHashes:frames.map(frame=>frame.hash),quietInvisible:frames.every(frame=>frame.hash===idle.hash),frontFacing:faces.every(facing=>raster(base,{facing,emote:item.id,emoteTime:.6},.6).hash===raster(base,{facing:'down',emote:item.id,emoteTime:.6},.6).hash)};quietRows.push({label:item.id+' · reduced motion',frames:frames.slice(0,4),headings:times.slice(0,4).map(String)});}sheet('emotes-reduced-motion',quietRows);
 const combinations=[
  ['Hair under wizard',{hairstyle:'long',headwear:'wizard',eyewear:'round',accessory:'satchel'}],
  ['Curly party',{hairstyle:'curly',headwear:'party',eyewear:'partyglasses',accessory:'balloon'}],
  ['Gown and shoes',{outfit:'gown',shoes:'heels',accessory:'pearls',headwear:'tiara'}],
  ['Coat and high-tops',{outfit:'coat',shoes:'hightops',accessory:'violin',hairstyle:'ponytail'}],
  ['Alien with hat',{form:'alien',headwear:'witch',eyewear:'heartglasses',accessory:'backpack'}],
  ['Starlight winner',{form:'starlight',headwear:'grandstaffcrown',accessory:'nebulaaura',pet:'neondragon'}],
  ['TV visitor',{form:'tv',headwear:'fedora',eyewear:'cybervisor',accessory:'headphones'}],
  ['Robot visitor',{form:'robot',headwear:'tophat',eyewear:'monocle',accessory:'watchchain'}],
  ['Backpack and long hair',{hairstyle:'long',accessory:'backpack',headwear:'cap'}],
  ['Wings and ponytail',{hairstyle:'ponytail',accessory:'wings',outfit:'dress'}],
  ['Cape and hat',{accessory:'cape',headwear:'wizard',outfit:'robe',shoes:'platforms'}],
  ['Full costume',{hairstyle:'buns',outfit:'kimono',headwear:'flowercrown',eyewear:'cateye',accessory:'fan',shoes:'ballet'}]
 ];
 const comboRows=[];for(const [name,profile]of combinations){const render=faces.map(facing=>raster({...base,...profile},{facing,walking:true,phase:.9}));summary.combos.push({name,profile,signatures:render.map(frame=>frame.hash)});comboRows.push({label:name,frames:render});}sheet('combinations-walking',comboRows);
 const petRows=[];for(const pet of normal.catalog.pets.filter(item=>item.id!=='none')){const render=faces.map(facing=>{const c=makeCanvas(160,160),g=c.getContext('2d');CodaPetCompanion.drawPet(g,pet.id,{x:80,y:120,scale:1.5,facing,moving:true,phase:.9},.6);return {canvas:c};});petRows.push({label:pet.id+' · '+pet.label,frames:render});}sheet('pets-moving-all-facings',petRows);
 return {summary,sheets};
}'''

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--output',default='/tmp/avatar-audit');parser.add_argument('--strict',action='store_true');args=parser.parse_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page();page.set_content('<!doctype html><meta charset="utf-8"><title>Avatar raster audit</title>')
  for name in ['npc-visitors.js','pet-companion.js','character-renderer.js']:page.add_script_tag(path=str(ROOT/name))
  errors=[];page.on('pageerror',lambda error:errors.append(str(error)));result=page.evaluate(SCRIPT);browser.close()
 import base64
 for sheet in result['sheets']:(out/(sheet['name']+'.png')).write_bytes(base64.b64decode(sheet['data'].split(',',1)[1]))
 summary=result['summary'];summary['errors']=errors;(out/'report.json').write_text(json.dumps(summary,indent=2))
 result={key:summary[key] for key in ['duplicates','frontDuplicates','invisible','labelDuplicates','perFacingDuplicates','clipping','errors']};result['quietInvisible']=[id for id,item in summary['emotes'].items() if item['quietInvisible']];result['quietTimeVarying']=[id for id,item in summary['emotes'].items() if len(set(item['quietHashes']))!=1]
 quiet_hashes={}
 for id,item in summary['emotes'].items():quiet_hashes.setdefault(item['quietHashes'][0],[]).append(id)
 result['quietDuplicates']=[ids for ids in quiet_hashes.values() if len(ids)>1];result['notFrontFacing']=[id for id,item in summary['emotes'].items() if not item['frontFacing']];result['counts']={group:len(items) for group,items in summary['groups'].items()};result['sheets']=len(result.get('sheets',[])) or len(list(out.glob('*.png')))
 print(json.dumps(result,indent=2))
 if args.strict and any(result[key] for key in ['duplicates','frontDuplicates','invisible','labelDuplicates','clipping','quietInvisible','quietTimeVarying','quietDuplicates','notFrontFacing','errors']):raise SystemExit(1)

if __name__=='__main__':main()
