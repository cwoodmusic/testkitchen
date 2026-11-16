"""Direct route editing with real pointer, touch and keyboard input.

This isolated component fixture uses an immutable authored clip. Changes are
recorded only through the overlay callback, independently of gameplay state.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work/cutscene-paths'
OUT.mkdir(parents=True,exist_ok=True)
FIXTURE='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/games/rhythm-blocks/cutscene-paths.css">
<style>body{margin:0;background:#181321;overflow:hidden}#map{position:absolute;left:16px;top:30px;width:900px;height:600px;background:#3b3148;transform-origin:0 0}#wall{position:absolute;left:400px;top:64px;width:100px;height:300px;background:#8c6689}.sr-only{position:absolute;clip:rect(0,0,0,0);width:1px;height:1px;overflow:hidden}</style>
<div id="map"><div id="wall"></div></div>
<script type="module">
import {createCutscenePathEditor} from '/games/rhythm-blocks/cutscene-paths.mjs';
import {compileRoomCutscene} from '/games/rhythm-blocks/cutscene.mjs';
import {isWalkable} from '/games/rhythm-blocks/room.mjs';
window.scene={id:'fixture',actors:[{id:'nell',feet:{x:96,y:96},worldSize:120}],geometry:{width:900,height:600,gridSize:32,radius:12,speed:200,maxDeltaMs:50,bounds:{x:32,y:32,width:836,height:536},start:{x:96,y:544},targets:[],obstacles:[{id:'nell',x:70,y:76,width:52,height:25},{id:'wall',x:400,y:64,width:100,height:300}]}};
window.authored={id:'route',actor:'nell',speaker:'nell',text:'',action:'look',waypoints:[{x:256,y:224},{x:352,y:480}],destination:{x:704,y:480}};
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};freeze(window.authored);
window.original=JSON.stringify(authored);window.originalScene=JSON.stringify(scene);window.changes=[];window.beat=structuredClone(authored);
const compile=()=>compileRoomCutscene({scene,beats:[beat]}).clips[0];window.current=compile();
const map=document.getElementById('map');
const resize=()=>{map.style.transform=`scale(${Math.min(1,(innerWidth-32)/900)})`;};resize();addEventListener('resize',resize);
window.editor=createCutscenePathEditor({map,scene,clip:current,actorId:'nell',onChange:patch=>{
 window.changes.push(structuredClone(patch));
 beat={...beat,actor:current.actor,speaker:current.actor,waypoints:patch.waypoints,destination:patch.destination??beat.destination};current=compile();
 editor.update({clip:current});
}});
window.valid=point=>isWalkable({...scene.geometry,obstacles:scene.geometry.obstacles.filter(o=>o.id!=='nell')},point);
window.reset=()=>{beat=structuredClone(authored);current=compile();changes=[];editor.update({scene,clip:current,actorId:'nell'});};
window.direct=()=>{beat={...structuredClone(authored),waypoints:[],destination:{x:704,y:96}};current=compile();changes=[];editor.update({scene,clip:current,actorId:'nell'});};
window.stationary=()=>{current={id:'still',actor:'mira',index:0,path:[{x:96,y:544}]};editor.update({clip:current,actorId:'mira'});};
window.ready=true;
</script>'''


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):
        pass


def center(page,selector):
    rect=page.locator(selector).bounding_box()
    assert rect,selector
    return rect['x']+rect['width']/2,rect['y']+rect['height']/2


def world(page,x,y):
    rect=page.locator('#map').bounding_box()
    return rect['x']+x/900*rect['width'],rect['y']+y/600*rect['height']


def assert_cardinal(page):
    points=page.locator('[data-cutscene-path-line]').get_attribute('points').split()
    coords=[tuple(float(number) for number in item.split(',')) for item in points]
    assert coords,'The route remains visible while editing.'
    for first,second in zip(coords,coords[1:]):
        assert abs(first[0]-second[0])<.000001 or abs(first[1]-second[1])<.000001,(first,second,coords)
    return coords


def drag(page,selector,x,y,touch=False):
    sx,sy=center(page,selector);ex,ey=world(page,x,y)
    if touch:
        cdp=page.context.new_cdp_session(page)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':sx,'y':sy}]})
        for step in range(1,9):
            cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':sx+(ex-sx)*step/8,'y':sy+(ey-sy)*step/8}]})
            assert_cardinal(page)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});cdp.detach()
    else:
        page.mouse.move(sx,sy);page.mouse.down()
        for step in range(1,9):
            page.mouse.move(sx+(ex-sx)*step/8,sy+(ey-sy)*step/8);assert_cardinal(page)
        page.mouse.up()
    page.wait_for_timeout(60)
    assert_cardinal(page)


def one_context(browser,url,width,touch=False):
    context=browser.new_context(viewport={'width':width,'height':844 if touch else 768},has_touch=touch,is_mobile=touch)
    page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.route('**/__path_fixture__.html',lambda route:route.fulfill(content_type='text/html',body=FIXTURE))
    page.goto(url);page.wait_for_function('window.ready')
    assert page.locator('svg.cutscene-path-overlay[data-path-actor="nell"]').count()==1
    line=page.locator('[data-cutscene-path-line]')
    assert line.get_attribute('stroke')=='#f7bd55'
    assert line.get_attribute('marker-end').startswith('url(#cutscene-route-arrow-')
    assert page.locator('[data-path-point]').count()==4
    assert_cardinal(page)
    for handle in page.locator('.cutscene-route-handle').all():
        assert handle.bounding_box()['width']>=21.5
    # Interior dragging materializes waypoints and keeps its prop binding.
    drag(page,'[data-path-point="1"]',288,288,touch)
    patch=page.evaluate('changes.at(-1)')
    assert len(page.evaluate('changes'))==1 and patch['keepTarget'] and 'destination' not in patch,patch
    assert patch['waypoints'][0]=={'x':288,'y':288},patch
    assert page.evaluate('JSON.stringify(authored)===original')
    # Recompilation adds navigation elbows but endpoint-only edits retain only
    # the exact authored stops, including after a waypoint was just moved.
    stops=page.evaluate('structuredClone(beat.waypoints)')
    drag(page,'[data-path-endpoint="true"]',736,512,touch)
    assert page.evaluate('changes.at(-1).waypoints')==stops
    # The destination projects away from the wall instead of entering it.
    page.evaluate('reset()');drag(page,'[data-path-endpoint="true"]',448,160,touch)
    patch=page.evaluate('changes.at(-1)')
    assert not patch['keepTarget'] and page.evaluate('p=>valid(p)',patch['destination']),patch
    assert patch['destination']!={'x':448,'y':160}
    assert len(page.evaluate('changes'))==1
    # A path click inserts one waypoint; dragging its line creates the same edit.
    page.evaluate('reset()')
    route=assert_cardinal(page)
    first,second=next((a,b) for a,b in zip(route,route[1:]) if abs(a[0]-b[0])+abs(a[1]-b[1])>100)
    x,y=world(page,(first[0]+second[0])/2,(first[1]+second[1])/2)
    if touch:page.touchscreen.tap(x,y)
    else:page.mouse.click(x,y)
    page.wait_for_timeout(50)
    assert len(page.evaluate('changes'))==1
    assert len(page.evaluate('changes[0].waypoints'))==3
    assert page.evaluate('changes[0].keepTarget')
    assert_cardinal(page)
    inserted=page.evaluate('structuredClone(beat.waypoints)')
    drag(page,'[data-path-endpoint="true"]',736,448,touch)
    assert page.evaluate('changes.at(-1).waypoints')==inserted
    # A direct walk around a wall has automatic elbows, not implicit handles.
    page.evaluate('direct()');assert_cardinal(page)
    assert page.evaluate('current.path.length')>2
    assert page.locator('[data-path-point]').count()==2
    drag(page,'[data-path-endpoint="true"]',736,160,touch)
    assert page.evaluate('changes.at(-1).waypoints')==[]
    # Keyboard moves the endpoint exactly one tile and can remove an interior.
    page.evaluate('reset()');page.locator('[data-path-endpoint="true"]').focus();page.keyboard.press('ArrowUp')
    assert page.evaluate('changes.at(-1).destination')=={'x':704,'y':448}
    page.locator('[data-path-point="1"]').focus();page.keyboard.press('Delete')
    assert page.evaluate('changes.at(-1).waypoints.length')==1
    assert_cardinal(page)
    # An action without a walk still offers a destination to drag.
    page.evaluate('stationary()')
    assert page.locator('[data-path-point]').count()==2
    assert page.locator('svg[data-path-actor="mira"]').count()==1
    assert line.get_attribute('stroke')=='#d7a4ff'
    drag(page,'[data-path-endpoint="true"]',224,160,touch)
    assert page.evaluate('changes.at(-1).destination')=={'x':224,'y':160}
    assert page.evaluate('JSON.stringify(authored)===original')
    assert page.evaluate('JSON.stringify(scene)===originalScene')
    page.screenshot(path=str(OUT/f'path-editor-{width}.png'))
    # Parent viewport changes can rescale the fixed-size art map without changing
    # its own layout size. Route handles keep their usable screen dimensions.
    page.set_viewport_size({'width':320,'height':568});page.wait_for_timeout(100)
    assert page.locator('[data-path-endpoint="true"]').bounding_box()['width']>=25.5
    page.screenshot(path=str(OUT/f'path-editor-{width}-resized-320.png'))
    page.evaluate('editor.destroy()')
    assert page.locator('svg.cutscene-path-overlay').count()==0
    assert not errors,errors
    context.close()
    return {'width':width,'touch':touch,'routeArrow':True,'cardinalArrowDuringDrag':True,'oneCommitPerDrag':True,'waypoints':True,'wallProjection':True,'keyboard':True,'stationaryEndpoint':True,'sourceImmutable':True,'errors':errors}


def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
    Thread(target=server.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
            url=f'http://127.0.0.1:{server.server_port}/__path_fixture__.html'
            results=[one_context(browser,url,1200),one_context(browser,url,390,True)];browser.close()
        (OUT/'results.json').write_text(json.dumps({'passed':True,'contexts':results},indent=2)+'\n')
        print(json.dumps({'passed':True,'contexts':results}))
    finally:
        server.shutdown();server.server_close()


if __name__=='__main__':
    main()
