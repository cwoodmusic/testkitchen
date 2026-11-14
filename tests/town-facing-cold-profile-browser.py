"""Diagnostic CDP sample of only the first500-prop native zoom admission."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from collections import defaultdict
import argparse,ast,base64,json,re,time
from playwright.sync_api import sync_playwright
from town_facing_acceptance import ROOT,collection_graph,assert_frozen,bitmap_probe_script
parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=Path('/workspace/.onboarding/facing-source500-cold-profile'));args=parser.parse_args();graph=collection_graph();args.output.mkdir(parents=True,exist_ok=True)
fixture_ast=ast.parse((ROOT/'tests/town-facing-source-performance-browser.py').read_text());setup_script=next(n.value.args[0].value for n in ast.walk(fixture_ast) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='setup' for t in n.targets))
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=browser.new_context(viewport={'width':1740,'height':1120},device_scale_factor=2)
        context.add_init_script('''(()=>{const raf=requestAnimationFrame;window.__coldProfileFrames=null;window.requestAnimationFrame=fn=>raf.call(window,t=>{const measured=window.__coldProfileFrames&&fn.name==='frame',start=performance.now();if(measured)performance.mark('coda-cold-frame-start');try{return fn(t);}finally{if(measured){const cpu=performance.now()-start;__coldProfileFrames.push({at:t,cpu});performance.mark('coda-cold-frame-end');performance.measure('coda-cold-frame','coda-cold-frame-start','coda-cold-frame-end');if(cpu>40)performance.mark('coda-slow-frame-'+cpu.toFixed(1));}}});})()''')
        context.add_init_script(bitmap_probe_script())
        page=context.new_page();page.set_default_timeout(180000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/');page.wait_for_function('!!window.townBuilder')
        if page.evaluate('townBuilder.npcsVisible'):page.locator('#npcToggle').click()
        page.locator('#lightingToggle').select_option('day')
        setup=page.evaluate(setup_script);page.wait_for_function('__sourceRuntime().overviewReady');page.wait_for_timeout(1800);before=page.evaluate('__sourceRuntime()');assert before['sourceLoads']==0,before
        cdp=context.new_cdp_session(page);completed={};cdp.on('Tracing.tracingComplete',lambda event:completed.update(event));cdp.send('Profiler.enable');cdp.send('Profiler.setSamplingInterval',{'interval':1000});cdp.send('Tracing.start',{'categories':'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,blink.user_timing,v8,disabled-by-default-v8.gc','transferMode':'ReturnAsStream'});cdp.send('Profiler.start')
        page.evaluate('window.__coldProfileFrames=[];townBuilder.cam.zoom=.8');deadline=time.monotonic()+60;previous=None;settled=0
        while time.monotonic()<deadline:
            page.wait_for_timeout(150);now=page.evaluate('__sourceRuntime()');key=(now['sourceLoads'],now['nativeCompilations']);settled=settled+1 if now['pendingLoads']==0 and now.get('activeLoads',0)==0 and now.get('queuedLoads',0)==0 and key==previous else 0;previous=key
            if settled>=5:break
        assert settled>=5,now
        frames=page.evaluate('(()=>{const a=__coldProfileFrames;window.__coldProfileFrames=null;return a;})()');profile=cdp.send('Profiler.stop')['profile'];cdp.send('Tracing.end')
        deadline=time.monotonic()+20
        while 'stream' not in completed and time.monotonic()<deadline:page.wait_for_timeout(50)
        assert 'stream' in completed,completed
        with (args.output/'cold-timeline.json').open('wb') as out:
            while True:
                part=cdp.send('IO.read',{'handle':completed['stream'],'size':1048576});out.write(base64.b64decode(part['data']) if part.get('base64Encoded') else part['data'].encode())
                if part.get('eof'):break
        cdp.send('IO.close',{'handle':completed['stream']});after=page.evaluate('__sourceRuntime()');bitmap_calls=page.evaluate('__bitmapCalls');page.evaluate('Object.assign(townBuilder.project,__sourceOriginalProject)');assert not errors,errors;browser.close()
    assert_frozen(graph);(args.output/'cold-cpu-profile.json').write_text(json.dumps(profile))
    nodes={n['id']:n for n in profile['nodes']};parents={child:n['id'] for n in profile['nodes'] for child in n.get('children',[])};self_us=defaultdict(int);inclusive_us=defaultdict(int)
    for node,delta in zip(profile.get('samples',[]),profile.get('timeDeltas',[])):
        self_us[node]+=delta;ancestor=node
        while ancestor in nodes:inclusive_us[ancestor]+=delta;ancestor=parents.get(ancestor)
    def functions(totals):
        return [{'name':nodes[node]['callFrame']['functionName'],'url':nodes[node]['callFrame'].get('url'),'line':nodes[node]['callFrame'].get('lineNumber',-1)+1,'ms':round(us/1000,3)} for node,us in sorted(totals.items(),key=lambda pair:-pair[1])[:35]]
    trace=json.loads((args.output/'cold-timeline.json').read_text());events=trace['traceEvents'];costs=defaultdict(list)
    for event in events:
        if event.get('ph')=='X' and event.get('dur',0)>0 and re.search('decode|image|raster|canvas|gc|skia|commit|paint|upload|composite',event.get('name',''),re.I):costs[event['name']].append(event['dur']/1000)
    timeline=[{'name':name,'count':len(values),'totalMs':round(sum(values),3),'maxMs':round(max(values),3)} for name,values in sorted(costs.items(),key=lambda pair:-sum(pair[1]))[:35]]
    gaps=[frames[i]['at']-frames[i-1]['at'] for i in range(1,len(frames))];summary={'graph':graph,'setup':setup,'before':before,'after':after,'bitmapCalls':bitmap_calls,'profileDurationMs':round((profile['endTime']-profile['startTime'])/1000,3),'frames':len(frames),'maxFrameCpuMs':max(f['cpu'] for f in frames),'stallsOver50Ms':sum(g>50 for g in gaps),'stallsOver100Ms':sum(g>100 for g in gaps),'topSelfFunctions':functions(self_us),'topInclusiveFunctions':functions(inclusive_us),'nativeTimelineCosts':timeline,'sourceUnchanged':True,'pageErrors':errors};(args.output/'summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps({'durationMs':summary['profileDurationMs'],'maxFrameCpuMs':summary['maxFrameCpuMs'],'topSelf':summary['topSelfFunctions'][:12],'timeline':timeline[:12],'pageErrors':errors}),flush=True)
finally:server.shutdown()
