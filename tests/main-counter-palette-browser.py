"""Actual counter icon RGBA palette/cache and later user-artwork composition."""
import json
from pathlib import Path
import sys
import unittest
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]


class MainCounterPaletteTests(unittest.TestCase):
    def test_mint_icons_preserve_native_alpha_gold_and_user_pixel_overrides(self):
        asset=next(item for item in json.loads((ROOT/'published-world-project.json').read_text())['assets'] if item['id']=='asset-40')
        original=json.dumps(asset)
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
            page=browser.new_page()
            for name in ['artwork-editor.js','world-artwork-tools.js','main-counter-palette.js']:
                page.add_script_tag(content=(ROOT/name).read_text())
            result=page.evaluate('''async asset=>{
 const source=new Image();source.src=asset.data;await source.decode();
 const palette=CodaMainCounterPalette.create({document,enabled:()=>true});
 const tinted=palette.image(asset,source),cached=palette.image(asset,source);
 const raw=document.createElement('canvas');raw.width=source.naturalWidth;raw.height=source.naturalHeight;
 raw.getContext('2d').drawImage(source,0,0);
 const before=raw.getContext('2d').getImageData(0,0,raw.width,raw.height).data;
 const after=tinted.getContext('2d').getImageData(0,0,tinted.width,tinted.height).data;
 let alphaChanges=0,gold=0,goldChanges=0,mintFaces=0,witness=null;
 for(let i=0;i<before.length;i+=4){
  if(before[i+3]!==after[i+3])alphaChanges++;
  if(before[i+3]>200&&before[i]>170&&before[i+1]>90&&before[i+2]<65){
   gold++;if(before[i]!==after[i]||before[i+1]!==after[i+1]||before[i+2]!==after[i+2])goldChanges++;
  }
  if(before[i+3]>240&&before[i]<80&&before[i+1]>160&&before[i+2]>200&&after[i]>175&&after[i+1]>after[i]&&after[i+2]>210){
   mintFaces++;if(witness===null)witness=i/4;
  }
 }
 if(witness===null)throw Error('No cyan source face was recolored to mint.');
 const x=witness%raw.width,y=Math.floor(witness/raw.width),tile=Math.floor(x/64)+','+Math.floor(y/64);
 const edited={...asset,artwork:{width:raw.width,height:raw.height,tiles:{[tile]:[[y%64*64+x%64,1,'#ff4488ff']]}}};
 const tools=createCodaWorldArtworkTools({getRootData:()=>({}),getAssets:()=>[edited]});
 const user=tools.assetImage(edited,palette.image(edited,source));
 return {alphaChanges,gold,goldChanges,mintFaces,sameSize:tinted.width===raw.width&&tinted.height===raw.height,
  cached:cached===tinted,duplicateUntouched:palette.image({...asset,id:'asset-99'},source)===source,
  customReplacementUntouched:palette.image({...asset,data:asset.data.slice(0,-1)+'A'},source)===source,
  override:[...user.getContext('2d').getImageData(x,y,1,1).data],raw:asset};
}''',asset)
            browser.close()
        self.assertEqual(result['alphaChanges'],0)
        self.assertTrue(result['sameSize'] and result['cached'])
        self.assertGreater(result['gold'],50)
        self.assertEqual(result['goldChanges'],0)
        self.assertGreater(result['mintFaces'],1000)
        self.assertTrue(result['duplicateUntouched'] and result['customReplacementUntouched'])
        self.assertEqual(result['override'],[255,68,136,255])
        self.assertEqual(json.dumps(result['raw']),original)


if __name__=='__main__':
    unittest.main(verbosity=2)
