"""Real renderer regression for stair/terrain depth and exposed support faces.

Disposable marker materials make the assertion independent of artwork changes:
magenta is a tread, green is a foreground grass top, brown is a cliff face.
The test uses actual generated stair profiles and actual projection routines.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/')
        page.wait_for_function('!!window.townBuilder')
        result = page.evaluate('''async () => {
          const source=await (await fetch('/town/world/render.mjs')).text();
          const dependency=(code,name,parent='/town/world/render.mjs')=>new URL(code.split(String.fromCharCode(10)).find(line=>line.includes(name+'.mjs')).split("'")[1],location.origin+parent).href;
          const constructionURL=dependency(source,'construction'),catalogURL=dependency(source,'catalog'),modelURL=dependency(source,'model');
          const constructionSource=await (await fetch(constructionURL)).text(),detailURL=dependency(constructionSource,'detail-art');
          const {render} = await import('/town/world/render.mjs?stair-occlusion-test');
          const {drawStairs} = await import(constructionURL);
          const {sources} = await import(catalogURL);
          const {stairArt,cliffArt} = await import(detailURL);
          const {blank} = await import(modelURL);
          const {planStairs} = await import('/town/builder/stairs.mjs?stair-occlusion-test');
          const paint = (canvas,color) => {const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);c.fillStyle=color;c.fillRect(0,0,canvas.width,canvas.height);};
          paint(sources.ground[0],'rgb(30,200,70)');
          for(const image of Object.values(stairArt))paint(image,'rgb(230,20,190)');
          paint(cliffArt,'rgb(166,84,28)');
          const left=14*64,top=12*64,w=22*64,h=22*64;
          const camera={x:left+w/2,y:top+h/2,zoom:1};
          const make=()=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
          const pixel=(c,x,y)=>Array.from(c.getContext('2d').getImageData(Math.round(x-left),Math.round(y-top),1,1).data);
          const isGrass=p=>p[0]===30&&p[1]===200&&p[2]===70&&p[3]===255;
          const isStair=p=>p[0]>200&&p[1]<50&&p[2]>150&&p[3]>250;
          const isRock=p=>p[0]>60&&p[0]>p[1]*1.25&&p[1]>p[2]*1.5&&p[3]===255;
          const report=[];
          function fixture(direction){
            const a={x:20,y:20},b={x:20+(direction==='east'?4:direction==='west'?-4:0),y:20+(direction==='south'?4:direction==='north'?-4:0)},d=blank();
            d.cells[`${b.x},${b.y}`]={surface:'grass',level:3};
            const plan=planStairs(d,a,b,{width:1});
            if(!plan.valid)throw Error(plan.message);
            for(const [key,value]of plan.edits)d.cells[key]={...value,surface:'grass'};
            return {d,plan};
          }
          for(const direction of ['east','west','north','south']){
            const {d,plan}=fixture(direction),mask=make(),mc=mask.getContext('2d');
            mc.translate(-left,-top);
            for(const [key]of plan.edits){const[x,y]=key.split(',').map(Number);drawStairs(mc,d,x,y);}
            const minX=Math.min(...plan.edits.map(([key])=>+key.split(',')[0])),maxX=Math.max(...plan.edits.map(([key])=>+key.split(',')[0])),maxY=Math.max(...plan.edits.map(([key])=>+key.split(',')[1]));
            let chosen=null;
            // Find an actual projected tread lying well inside a southern top.
            // Levels vary so both near/far and all four stair axes are covered.
            for(let row=maxY+1;row<=maxY+6&&!chosen;row++)for(let level=3;level<=8&&!chosen;level++){
              const sy=row*64-level*48;
              for(let y=sy+31;y<=sy+43&&!chosen;y+=3)for(let x=minX*64+28;x<=(maxX+1)*64-28;x+=4){
                if(x<left||x>=left+w||y<top||y>=top+h)continue;
                if(isStair(pixel(mask,x,y))){chosen={row,level,x,y};break;}
              }
            }
            if(!chosen)throw Error('Could not construct a foreground overlap for '+direction);
            const front=structuredClone(d);
            for(let x=minX-2;x<=maxX+2;x++)front.cells[`${x},${chosen.row}`]={surface:'grass',level:chosen.level};
            const noFront=make(),withFront=make();render(noFront.getContext('2d'),d,camera,w,h);render(withFront.getContext('2d'),front,camera,w,h);
            const open=pixel(noFront,chosen.x,chosen.y),covered=pixel(withFront,chosen.x,chosen.y);
            report.push({case:direction+' foreground occludes tread',passed:isStair(open)&&isGrass(covered),chosen,open,covered});
          }
          for(const direction of ['east','west']){
            const {d,plan}=fixture(direction),x=18.5*64+(direction==='east'?4*64:0),y=20*64+40;
            // Mid-run height is 72px. Its southern edge projects to y1272;
            // y1320 is below the surface and must contain rock, not blank/grass.
            const exposed=make();render(exposed.getContext('2d'),d,camera,w,h);
            const at=pixel(exposed,x,y);
            report.push({case:direction+' exposed sloped support face',passed:isRock(at),x,y,pixel:at});
            const equal=structuredClone(d);
            for(const[key,value]of plan.edits){const[xx,yy]=key.split(',').map(Number);equal.cells[`${xx},${yy+1}`]={...value,surface:'grass'};}
            const adjacent=make();render(adjacent.getContext('2d'),equal,camera,w,h);
            const shared=pixel(adjacent,x,y);
            report.push({case:direction+' matching south slope stays open',passed:isStair(shared),x,y,pixel:shared});
            const bank=structuredClone(d);
            const minX=Math.min(...plan.edits.map(([key])=>+key.split(',')[0])),maxX=Math.max(...plan.edits.map(([key])=>+key.split(',')[0]));
            for(let xx=minX-2;xx<=maxX+2;xx++)bank.cells[`${xx},19`]={surface:'grass',level:3};
            const bankView=make();render(bankView.getContext('2d'),bank,camera,w,h);
            // At the lower-height quarter of the middle cell the stair is 63px
            // high, so the northern bank must reach y1280-63=1217. A bank
            // using only center height72 stops at1208 and leaves a triangle.
            const lowX=(direction==='east'?22.25:18.75)*64,highX=(direction==='east'?22.75:18.25)*64;
            const gap=pixel(bankView,lowX,1213),tread=pixel(bankView,highX,1203);
            report.push({case:direction+' north bank reaches lower tread edge',passed:isRock(gap),x:lowX,y:1213,pixel:gap});
            // Conversely, the higher quarter is81px high. Extending the bank
            // to center height would incorrectly cover the actual higher tread.
            report.push({case:direction+' north bank preserves higher tread',passed:isStair(tread),x:highX,y:1203,pixel:tread});
          }
          return report;
        }''')
        for check in result:
            print(json.dumps(check), flush=True)
        assert all(c['passed'] for c in result), 'Stair terrain depth/support regression failed.'
        assert not errors, errors
        browser.close()
finally:
    server.shutdown()
    server.server_close()
print('Stair occlusion checks passed: all four axes, sloped north/south faces and matching adjacent slopes.')
