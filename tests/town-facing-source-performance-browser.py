"""Actual editor frames with500 distinct real collection props at far/near zoom.

The isolated dense fixture deliberately overlaps props to keep all500 in view.
This measures the source-admission worst case, not walking or NPC path finding.
"""
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse,json,statistics,time
from playwright.sync_api import sync_playwright
from town_facing_acceptance import ROOT,collection_graph,assert_frozen
parser=argparse.ArgumentParser();parser.add_argument('--screenshots',type=Path,default=Path('/workspace/.onboarding/facing-source500-final'));parser.add_argument('--seconds',type=float,default=5);args=parser.parse_args();graph=collection_graph();args.screenshots.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=browser.new_context(viewport={'width':1740,'height':1120},device_scale_factor=2)
        context.add_init_script('''(()=>{const raf=requestAnimationFrame;window.__sourceFrames=null;window.requestAnimationFrame=fn=>raf.call(window,t=>{const start=performance.now();try{return fn(t);}finally{if(window.__sourceFrames&&fn.name==='frame')__sourceFrames.push({at:t,cpu:performance.now()-start});}});})()''')
        page=context.new_page();page.set_default_timeout(180000);errors=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda r:requests.append(r.url) if '/assets/apartment-collections/' in r.url and r.url.split('?')[0].endswith('.webp') and '-thumb' not in r.url and 'overview' not in r.url else None)
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/');page.wait_for_function('!!window.townBuilder')
        if page.evaluate('townBuilder.npcsVisible'):page.locator('#npcToggle').click()
        if page.evaluate('townBuilder.night'):page.locator('#lightingToggle').click()
        setup=page.evaluate('''async()=>{
            const app=new URL(document.querySelector('script[type=module]').src),url=n=>new URL('../world/'+n+'.mjs'+app.search,app),{APARTMENT_COLLECTION_ASSETS,getApartmentCollectionRuntimeStats,clearApartmentCollectionCache}=await import(url('apartment-collections')),{supportsFurnitureFacing}=await import(url('furniture-facing')),{furnitureFacingSourceStats}=await import(url('render'));
            clearApartmentCollectionCache();window.__sourceRuntime=getApartmentCollectionRuntimeStats;window.__sourceRoster=()=>furnitureFacingSourceStats(document.getElementById('map'));
            window.__sourceOriginalProject=structuredClone(townBuilder.project);const canvas=document.getElementById('map'),rect=canvas.getBoundingClientRect(),near=.8,cols=25,rows=20,spacingX=Math.min(60,(rect.width/near-512)/(cols-1)),spacingY=Math.min(60,(rect.height/near-512)/(rows-1));if(spacingX<=0||spacingY<=0)throw Error('Canvas too small for the source fixture');
            const objects=APARTMENT_COLLECTION_ASSETS.slice(0,500).map((d,i)=>{const a=townBuilder.catalog.get(d.id),rotation=[0,90,180,270][i%4],direction=a.wallMounted||a.layer==='ground'?'south':['south','west','north','east'][i%4],view=a.getFacingView(direction);if(!view)throw Error('Missing metadata '+d.id+'/'+direction);return{id:'source-stress-'+i,asset:d.id,x:8192+(i%cols-(cols-1)/2)*spacingX,y:7000+(Math.floor(i/cols)-(rows-1)/2)*spacingY,rotation,scale:128/Math.max(view.w,view.h),layer:a.layer||'objects',collision:false};});
            if(new Set(objects.map(o=>o.asset)).size!==500)throw Error('Fixture must have500 distinct props');Object.assign(townBuilder.project,{name:'Isolated500source fixture',cells:{},edges:{},objects,spawn:{x:8192,y:7000}});Object.assign(townBuilder.cam,{x:8192,y:7000,zoom:.08});window.__sourceFixtureJSON=JSON.stringify(townBuilder.project);
            return{objects:objects.length,uniqueAssets:500,fixture:'dense overlapping source-admission stress',nearZoom:near,farZoom:.08,canvas:{width:canvas.width,height:canvas.height,cssWidth:rect.width,cssHeight:rect.height,pixelsPerCSS:canvas.width/rect.width},devicePixelRatio,sourceTag:app.search,flatCanonicalSouth:objects.filter(o=>!supportsFurnitureFacing(townBuilder.catalog.get(o.asset),o)).length};
        }''')
        page.wait_for_function('__sourceRuntime().overviewReady');page.wait_for_timeout(1800)
        initial=page.evaluate('__sourceRuntime()');assert initial['sourceLoads']==0 and initial['nativeCompilations']==0,initial
        def stats():return page.evaluate('({runtime:__sourceRuntime(),roster:__sourceRoster()})')
        def measure(name):
            before=stats();count=len(requests);started=datetime.now(timezone.utc).isoformat();page.evaluate('window.__sourceFrames=[]');page.wait_for_timeout(args.seconds*1000)
            frames=page.evaluate('(()=>{const a=__sourceFrames;window.__sourceFrames=null;return a;})()');after=stats();assert len(frames)>20
            cpu=sorted(f['cpu'] for f in frames);gaps=sorted(frames[i]['at']-frames[i-1]['at'] for i in range(1,len(frames)));duration=frames[-1]['at']-frames[0]['at']
            row={'name':name,'startedUTC':started,'finishedUTC':datetime.now(timezone.utc).isoformat(),'fps':round((len(frames)-1)*1000/duration,2),'cpuMeanMs':round(statistics.mean(cpu),3),'cpuP50Ms':round(cpu[int(len(cpu)*.5)],3),'cpuP95Ms':round(cpu[int(len(cpu)*.95)],3),'cpuP99Ms':round(cpu[min(len(cpu)-1,int(len(cpu)*.99))],3),'cpuMaxMs':round(max(cpu),3),'cadenceP95Ms':round(gaps[int(len(gaps)*.95)],3),'stallsOver50Ms':sum(g>50 for g in gaps),'stallsOver100Ms':sum(g>100 for g in gaps),'nativeAtlasRequests':len(requests)-count,'before':before,'after':after}
            assert after['runtime']['sourceLoads']==before['runtime']['sourceLoads'] and after['runtime']['nativeCompilations']==before['runtime']['nativeCompilations'] and row['nativeAtlasRequests']==0,row
            assert after['runtime']['sourceEntries']<=4 and after['runtime']['canvasEntries']<=192 and after['runtime']['canvasPixels']<=4*1024*1024,row
            assert after['roster']['nativeViews']<=192 and after['roster']['nativePixels']<=4*1024*1024,row
            assert row['fps']>35 and row['cpuP95Ms']<50,row
            page.screenshot(path=str(args.screenshots/(name+'.png')));return row
        cases=[measure('far500')];assert cases[0]['after']['roster']['nativeViews']==0
        cold_start=datetime.now(timezone.utc).isoformat();cold_before=stats();cold_request_count=len(requests);page.evaluate('window.__sourceFrames=[];townBuilder.cam.zoom=.8');deadline=time.monotonic()+60;settled=0;previous=None
        while time.monotonic()<deadline:
            page.wait_for_timeout(150);now=stats()['runtime'];key=(now['sourceLoads'],now['nativeCompilations'])
            settled=settled+1 if now['pendingLoads']==0 and key==previous else 0;previous=key
            if settled>=5:break
        assert settled>=5,'Near source admission did not settle: '+json.dumps(stats())
        cold_frames=page.evaluate('(()=>{const a=__sourceFrames;window.__sourceFrames=null;return a;})()');cold_finished=datetime.now(timezone.utc).isoformat();cold_after=stats();cold_requests=len(requests)-cold_request_count
        near=measure('near500');assert near['after']['roster']['candidates']>=450 and near['after']['roster']['nativeViews']>0,near;cases.append(near)
        cold_cpu=sorted(f['cpu'] for f in cold_frames);cold_gaps=[cold_frames[i]['at']-cold_frames[i-1]['at'] for i in range(1,len(cold_frames))]
        cold={'startedUTC':cold_start,'finishedUTC':cold_finished,'before':cold_before,'after':cold_after,'nativeAtlasRequests':cold_requests,'frames':len(cold_frames),'cpuP50Ms':round(cold_cpu[int(len(cold_cpu)*.5)],3),'cpuP95Ms':round(cold_cpu[int(len(cold_cpu)*.95)],3),'cpuMaxMs':round(max(cold_cpu),3),'stallsOver50Ms':sum(g>50 for g in cold_gaps),'stallsOver100Ms':sum(g>100 for g in cold_gaps)}
        page.evaluate('townBuilder.cam.zoom=.08');page.wait_for_timeout(600);cases.append(measure('far500-again'));assert cases[-1]['after']['roster']['nativeViews']==0
        page.evaluate('townBuilder.cam.zoom=.8');page.wait_for_timeout(600);cases.append(measure('near500-again'))
        assert page.evaluate('JSON.stringify(townBuilder.project)===__sourceFixtureJSON')
        page.evaluate('Object.assign(townBuilder.project,__sourceOriginalProject)');assert not errors,errors;browser.close()
    assert_frozen(graph);result={'graph':graph,'setup':setup,'coldNear':cold,'cases':cases,'sourceUnchanged':True,'pageErrors':errors};(args.screenshots/'results.json').write_text(json.dumps(result,indent=2));print(json.dumps({'objects':500,'cases':[{k:r[k] for k in ['name','fps','cpuP95Ms','cpuMaxMs','stallsOver50Ms','nativeAtlasRequests']} for r in cases],'pageErrors':errors}),flush=True)
finally:server.shutdown()
