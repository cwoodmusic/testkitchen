"""Real native HTTP queue cancellation across a collection-cache generation clear."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import unquote,urlparse
import argparse,json
from playwright.sync_api import sync_playwright
from town_facing_acceptance import ROOT,collection_graph,assert_frozen
parser=argparse.ArgumentParser();parser.add_argument('--screenshots',type=Path,default=Path('/workspace/.onboarding/facing-queue-clear-final'));args=parser.parse_args();graph=collection_graph();args.screenshots.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=browser.new_context(viewport={'width':1500,'height':1000});held=[];holding={'native':True}
        def route_native(route):
            name=urlparse(route.request.url).path
            if name.endswith('.webp') and '-thumb' not in name and 'overview' not in name and holding['native']:held.append(route)
            else:route.continue_()
        context.route('**/assets/apartment-collections/*.webp*',route_native)
        page=context.new_page();page.set_default_timeout(180000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/');page.wait_for_function('!!window.townBuilder')
        if page.evaluate('townBuilder.npcsVisible'):page.locator('#npcToggle').click()
        page.evaluate('''async()=>{
            const app=new URL(document.querySelector('script[type=module]').src),url=n=>new URL('../world/'+n+'.mjs'+app.search,app),{APARTMENT_COLLECTIONS,getApartmentCollectionRuntimeStats,clearApartmentCollectionCache}=await import(url('apartment-collections'));
            window.__queueStats=getApartmentCollectionRuntimeStats;window.__queueClear=clearApartmentCollectionCache;window.__queueBeds=APARTMENT_COLLECTIONS.map(c=>c.assets.find(a=>a.slot==='bed').id);__queueClear();window.__queuePeak=0;window.__queueMonitoring=true;function monitor(){__queuePeak=Math.max(__queuePeak,__queueStats().activeLoads);if(__queueMonitoring)requestAnimationFrame(monitor);}requestAnimationFrame(monitor);
            window.__queueOldWork=Promise.allSettled(__queueBeds.slice(0,10).map(id=>townBuilder.catalog.get(id).ensureFull('east')));
        }''')
        page.wait_for_function('__queueStats().activeLoads===4&&__queueStats().queuedLoads===6');before_clear=page.evaluate('__queueStats()');assert len(held)==4,(len(held),before_clear)
        after_clear=page.evaluate('(()=>{__queueClear();return __queueStats();})()');assert after_clear['activeLoads']==4 and after_clear['queuedLoads']==0 and after_clear['canvasEntries']==0 and after_clear['sourceEntries']==0,after_clear
        page.evaluate("(()=>{window.__queueNewWork=Promise.allSettled(__queueBeds.slice(10,12).map(id=>townBuilder.catalog.get(id).ensureFull('east')));return true;})()")
        page.wait_for_function('__queueStats().queuedLoads===2');page.wait_for_timeout(120);queued_new=page.evaluate('__queueStats()');assert len(held)==4 and queued_new['activeLoads']==4 and queued_new['queuedLoads']==2,queued_new
        holding['native']=False
        for route in held:
            path=ROOT/unquote(urlparse(route.request.url).path).lstrip('/')
            route.fulfill(status=200,content_type='image/webp',body=path.read_bytes())
        settled=page.evaluate('''async()=>{
            const old=await __queueOldWork,next=await __queueNewWork;await new Promise(r=>requestAnimationFrame(r));const stats=__queueStats();
            if(old.some(r=>r.status!=='fulfilled')||next.some(r=>r.status!=='fulfilled'))throw Error('A cleared/new generation caller was left rejected');
            if(__queueBeds.slice(0,10).some(id=>townBuilder.catalog.get(id).getFacingView('east').ready))throw Error('Stale generation repopulated native canvases');
            if(!__queueBeds.slice(10,12).every(id=>townBuilder.catalog.get(id).getFacingView('east').ready))throw Error('New generation failed to become native-ready');
            window.__queueMonitoring=false;return {stats,peakActiveLoads:__queuePeak,oldCallersSettled:old.length,newCallersSettled:next.length,oldCanvasesStayedAbsent:true};
        }''')
        assert settled['peakActiveLoads']<=4 and settled['stats']['activeLoads']==0 and settled['stats']['queuedLoads']==0 and settled['stats']['pendingLoads']==0,settled
        assert settled['stats']['canvasEntries']==2 and settled['stats']['sourceEntries']==2 and settled['stats']['nativeCompilations']==2,settled
        final_clear=page.evaluate('(()=>{__queueClear();return __queueStats();})()');assert all(final_clear[k]==0 for k in ['activeLoads','queuedLoads','sourceEntries','canvasEntries','canvasPixels','pendingLoads']),final_clear
        assert not errors,errors;browser.close()
    assert_frozen(graph);result={'graph':graph,'beforeClear':before_clear,'afterClear':after_clear,'newGenerationQueuedBehindOldDecodes':queued_new,'settled':settled,'finalClear':final_clear,'sourceUnchanged':True,'pageErrors':errors};(args.screenshots/'results.json').write_text(json.dumps(result,indent=2));print(json.dumps({'peakActiveLoads':settled['peakActiveLoads'],'staleGenerationDidNotRepopulate':True,'oldCallersSettled':10,'newCallersSettled':2,'pageErrors':errors}),flush=True)
finally:server.shutdown()
