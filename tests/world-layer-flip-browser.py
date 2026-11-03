"""Actual Canvas partition geometry must follow asset flips and rotation."""
from pathlib import Path
import unittest

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class WorldLayerFlipTests(unittest.TestCase):
    def test_background_mask_partitions_track_every_flip_and_quarter_turn(self):
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            try:
                page = browser.new_page()
                page.set_content('<!doctype html><title>Asset flip partitions</title>')
                page.add_script_tag(content=(ROOT/'world-layer-renderer.js').read_text())
                result = page.evaluate('''()=>{
                  const canvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
                  const renderer=createCodaWorldLayerRenderer({width:20,height:20,getStamp:()=>0,render(){}});
                  const raw=canvas(4,2),paint=raw.getContext('2d');
                  for(let y=0;y<2;y++)for(let x=0;x<4;x++){paint.fillStyle=`rgb(${40+x*40},${50+y*100},90)`;paint.fillRect(x,y,1,1);}
                  const erased=canvas(20,20),mask=erased.getContext('2d');mask.fillRect(0,0,10,20);
                  const asset={x:10,y:10,w:8,h:4,layer:'world',rotation:0},frame=[0,0,4,2],mismatches=[];
                  let checked=0;
                  for(const rotation of [0,90,180,270])for(const flipX of [false,true])for(const flipY of [false,true]){
                    Object.assign(asset,{rotation,flipX,flipY});
                    const parts=renderer.split(asset,raw,frame,erased),angle=rotation*Math.PI/180;
                    for(let y=0;y<2;y++)for(let x=0;x<4;x++){
                      const dx=((x+.5)/4-.5)*asset.w*(flipX?-1:1),dy=((y+.5)/2-.5)*asset.h*(flipY?-1:1);
                      const worldX=asset.x+dx*Math.cos(angle)-dy*Math.sin(angle),behind=worldX<10;
                      const expected=Array.from(paint.getImageData(x,y,1,1).data);
                      for(const pass of ['above','behind']){
                        const actual=parts[pass]?Array.from(parts[pass].getContext('2d').getImageData(x,y,1,1).data):[0,0,0,0];
                        const visible=pass==='behind'?behind:!behind;
                        if(visible?actual.some((v,i)=>v!==expected[i]):actual[3]!==0)mismatches.push({rotation,flipX,flipY,x,y,pass,actual,expected,visible});
                      }
                      checked++;
                    }
                  }
                  delete asset.flipX;delete asset.flipY;asset.rotation=0;
                  const restored=renderer.split(asset,raw,frame,erased);
                  return {checked,mismatches,restoredLeft:restored.behind.getContext('2d').getImageData(0,0,1,1).data[3],restoredRight:restored.above.getContext('2d').getImageData(3,0,1,1).data[3]};
                }''')
                self.assertEqual(result['checked'], 128)
                self.assertEqual(result['mismatches'], [])
                self.assertEqual((result['restoredLeft'],result['restoredRight']),(255,255))
            finally:
                browser.close()


if __name__ == '__main__':
    unittest.main(verbosity=2)
