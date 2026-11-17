"""Pip uses directional forward-fall artwork, with heels fixed to the floor.

All imports, seeks, playback and Skip use the actual developer/game controls.
Only read-only character state, rendered geometry and artwork are observed.
"""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse
import copy
import importlib.util
import json
import math
import time

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work/pip-forward-fall-browser';OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('forward_party',ROOT/'tests/quiet-bell-party-performance-browser.py')
party=importlib.util.module_from_spec(spec);spec.loader.exec_module(party)
tracks,cs,ui,paths=party.tracks,party.cs,party.ui,party.paths
DIRECTIONS=['down','left','right','up']
AXES={'down':(0,1),'left':(-1,0),'right':(1,0),'up':(0,-1)}


def tick(page,amount=80):cs.tick(page,amount)
def state(page):return page.evaluate('quietBell.cutscene')
def pip(value):return next(actor for actor in value['actors'] if actor['id']=='pip')


def fixture(project,direction,custom=False):
    project=copy.deepcopy(project);scene=project['scenes']['depot'];geometry=scene['geometry']
    scene['entry']={'enabled':False};at={'x':950,'y':650}
    actor=next(actor for actor in scene['actors'] if actor['id']=='pip');old=dict(actor['feet'])
    dx,dy=at['x']-old['x'],at['y']-old['y'];actor['feet']=dict(at);actor['facing']=direction
    for obstacle in geometry['obstacles']:
        if obstacle['id']=='pip':obstacle['x']+=dx;obstacle['y']+=dy
    for target in geometry['targets']:
        if target['id']=='pip':
            target['x']+=dx;target['y']+=dy;target['approach']['x']+=dx;target['approach']['y']+=dy
    for obj in scene['objects']:
        if obj['id']=='pip':obj['rect']['x']+=dx;obj['rect']['y']+=dy
    vx,vy=AXES[direction];to={'x':at['x']+vx*128,'y':at['y']+vy*128}
    project['content']['depot']['cutscene']=[
        {'id':'forward-run','kind':'walk','actor':'pip','destination':to,'gait':'run','action':'look','startTile':0,'durationTiles':2},
        {'id':'forward-trip','kind':'gesture','actor':'pip','gesture':'trip','startTile':2,'durationTiles':4},
        {'id':'forward-prone','kind':'gesture','actor':'pip','gesture':'fallen','startTile':6,'durationTiles':5},
        {'id':'forward-rise','kind':'gesture','actor':'pip','gesture':'recover','startTile':11,'durationTiles':6},
        {'id':'forward-rest','kind':'walk','actor':'pip','action':'look','startTile':17,'durationTiles':1},
        {'id':'forward-words','kind':'dialogue','actor':'pip','speaker':'pip','text':'That old receiver is listening. Please tell me it prefers a quiet conversation.','startTile':0,'durationTiles':40},
    ]
    if custom:project['cast']['pip']['walk']['image']='assets/pip-walk.webp?my-custom-art=1'
    return project


def visual(page):
    return page.evaluate('''()=>{
      const value=quietBell.cutscene,actor=value.actors.find(a=>a.id==='pip');
      const node=document.querySelector('.mg-npc[data-actor="pip"]'),overlay=document.querySelector('.cutscene-forward-fall[data-character="pip"]');
      const angle=n=>{const m=new DOMMatrixReadOnly(getComputedStyle(n).transform);return Math.atan2(m.b,m.a)*180/Math.PI;};
      const map=document.getElementById('room-map').getBoundingClientRect(),scale=map.width/quietBell.scene.geometry.width;
      const expected={x:map.left+actor.x*scale,y:map.top+actor.y*scale};
      const frames=[...(overlay?.querySelectorAll('.cutscene-forward-fall-frame')??[])].filter(n=>!n.hidden).map(n=>{
        const rect=n.getBoundingClientRect(),anchor=[Number(n.dataset.anchorX),Number(n.dataset.anchorY)];
        const foot={x:rect.left+rect.width*anchor[0],y:rect.top+rect.height*anchor[1]};
        return{pose:n.dataset.pose,frame:Number(n.dataset.frame),row:Number(n.dataset.row),anchor,
          opacity:Number(getComputedStyle(n).opacity),image:getComputedStyle(n).backgroundImage,angle:angle(n),foot,
          footError:Math.hypot(foot.x-expected.x,foot.y-expected.y)};
      });
      return{actor,mode:node.dataset.spriteMode,pose:node.dataset.forwardPose,angle:angle(node),image:getComputedStyle(node).backgroundImage,
        head:{x:Number(node.dataset.headX),y:Number(node.dataset.headY)},foot:{x:Number(node.dataset.footX),y:Number(node.dataset.footY)},
        overlay:!!overlay&&!overlay.hidden,layerCount:overlay?.children.length??0,frames};
    }''')


def assert_forward(value,direction,expected_pose=None):
    assert value['mode']=='forward-fall' and value['overlay'],value
    assert abs(value['angle'])<.01,'A standing body must not be spun sideways for the forward fall.'
    if expected_pose:assert value['pose']==expected_pose,value
    assert value['actor']['facing']==direction and not value['actor']['moving'],value
    assert value['layerCount']==2 and value['frames'],value
    assert math.hypot(value['foot']['x']-value['actor']['x'],value['foot']['y']-value['actor']['y'])<.00001,value
    for frame in value['frames']:
        assert 'pip-forward-fall.webp' in frame['image'],frame
        assert frame['row']==DIRECTIONS.index(direction) and frame['frame'] in [0,1,2],frame
        assert all(0<=number<=1 for number in frame['anchor']) and abs(frame['angle'])<.01,frame
        assert frame['footError']<.1,frame
    if expected_pose=='prone':
        vx,vy=AXES[direction];head=value['head'];foot=value['foot']
        assert (head['x']-foot['x'])*vx+(head['y']-foot['y'])*vy>8,('Head must land ahead of the heels in the direction Pip was moving.',value)
    return value


def decode_art(page):
    return page.evaluate('''async()=>{
      const {PIP_FORWARD_FALL:art}=await import(new URL('npc-gestures.mjs',document.baseURI));
      const img=new Image();img.src=new URL(art.image,document.baseURI).href;await img.decode();
      if(img.naturalWidth!==art.cellWidth*3||img.naturalHeight!==art.cellHeight*4)throw Error('Forward-fall sheet dimensions do not match its twelve measured poses.');
      return{image:img.src,width:img.naturalWidth,height:img.naturalHeight,poses:art.poses,directions:art.directions};
    }''')


def play_trace(page):
    page.evaluate('''()=>{
      window.__forwardFrames=[];
      function frame(){
        const s=quietBell.cutscene;if(!s)return;
        const a=s.actors.find(a=>a.id==='pip'),n=document.querySelector('.mg-npc[data-actor="pip"]');
        window.__forwardFrames.push({tile:s.currentTile,elapsed:s.elapsed,x:a.x,y:a.y,moving:a.moving,gait:a.gait,
          gesture:a.gesture,pose:n.dataset.forwardPose,mode:n.dataset.spriteMode,frame:n.dataset.frame});
        if(s.currentTile<19)requestAnimationFrame(frame);
      }requestAnimationFrame(frame);
    }''')
    page.locator('#developer-cutscene-play').click()
    for _ in range(120):
        if state(page)['currentTile']>=19:break
        tick(page,40)
    frames=page.evaluate('window.__forwardFrames');assert frames
    for gesture,pose in [('trip','stumble'),('fallen','prone'),('recover','pushup')]:
        assert any(row['gesture']==gesture and row['pose']==pose and row['mode']=='forward-fall' for row in frames),(gesture,frames)
    assert {row['frame'] for row in frames if row['moving'] and row['gait']=='run'}=={'0','1','2'},frames
    for before,after in zip(frames,frames[1:]):
        maximum=520*(after['elapsed']-before['elapsed'])/1000+.0001
        assert math.hypot(after['x']-before['x'],after['y']-before['y'])<=maximum,('A pose transition teleported logical feet.',before,after)
    page.locator('#developer-cutscene-pause').click();tick(page,50)
    return {'renderedFrames':len(frames),'runFrames':sorted({row['frame'] for row in frames if row['moving']}),'continuousFeet':True}


def flow(browser,url,expected,width=1024,reduced=False):
    context,page,errors,writes,external=ui.open_page(browser,url,width,'dark',height=844 if width<500 else 900,
        reduced_motion='reduce' if reduced else 'no-preference')
    base=paths.validate_release(page,expected);original=cs.normal_storage(page);resources=cs.conserved(page)
    art=decode_art(page);project=page.evaluate('JSON.parse(JSON.stringify(quietBell.project))')
    page.keyboard.press('F2');page.locator('#developer-console').wait_for(state='visible');page.locator('[data-dev-tab="cutscene"]').click()
    cs.select_timeline_mode(page)
    directions=DIRECTIONS if width>=500 else ['right','down'];samples=[];plays=[]
    for direction in directions:
        tracks.import_project(page,fixture(project,direction),f'forward-{width}-{reduced}-{direction}')
        tracks.start_paused(page)
        for tile,pose in [(4,'stumble'),(8,'prone'),(14,'pushup')]:
            party.seek(page,tile)
            page.wait_for_function('document.querySelector(\'.mg-npc[data-actor="pip"]\')?.dataset.spriteMode==="forward-fall"')
            sample=assert_forward(visual(page),direction,pose)
            before=page.locator('.cutscene-forward-fall').get_attribute('style');layers=page.locator('.cutscene-forward-fall-frame').evaluate_all('nodes=>nodes.map(n=>n.getAttribute("style"))')
            tick(page,200);assert page.locator('.cutscene-forward-fall').get_attribute('style')==before
            assert page.locator('.cutscene-forward-fall-frame').evaluate_all('nodes=>nodes.map(n=>n.getAttribute("style"))')==layers
            sample['direction']=direction;samples.append(sample)
            if pose in ['prone','pushup']:page.screenshot(path=str(OUT/f'{width}-{reduced}-{direction}-{pose}.png'))
        before=state(page);page.locator('#developer-cutscene-speed').click();tick(page,50)
        assert state(page)['currentTile']==before['currentTile'] and visual(page)['actor']==pip(before),'Changing rate while paused must not move a pose.'
        if state(page)['playbackRate']!=1:page.locator('#developer-cutscene-speed').click()
        party.seek(page,0);plays.append(play_trace(page))
        party.seek(page,18);upright=visual(page)
        assert upright['mode']=='standing' and not upright['overlay'] and abs(upright['angle'])<.01,upright
        page.locator('#developer-cutscene-stop').click();tick(page,30)
        assert page.locator('.cutscene-forward-fall').count()==0
    # Custom artwork is never replaced by the generated stock Pip poses.
    tracks.import_project(page,fixture(project,'right',custom=True),f'forward-custom-{width}-{reduced}')
    tracks.start_paused(page);party.seek(page,8);custom=visual(page)
    assert custom['mode']=='standing' and not custom['overlay'] and 'my-custom-art=1' in custom['image'],custom
    page.locator('#developer-cutscene-stop').click();tick(page,30)
    # Apply exercises the actual manual-dialogue game, not just director seeking.
    tracks.import_project(page,fixture(project,'right'),f'forward-applied-{width}-{reduced}')
    page.locator('#developer-apply').click();page.locator('#developer-console').wait_for(state='hidden')
    for _ in range(300):
        if state(page) and pip(state(page)).get('gesture')=='fallen':break
        tick(page,30)
    fallen=assert_forward(visual(page),'right','prone')
    page.locator('#cutscene-skip').click();tick(page,50)
    assert not state(page) and page.locator('.cutscene-forward-fall').count()==0
    assert page.locator('.mg-npc[data-actor="pip"]').evaluate('n=>Number(getComputedStyle(n).opacity)')==1
    page.locator('#developer-end').click();tick(page,80)
    assert cs.normal_storage(page)==original and cs.conserved(page)==resources
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1')
    ui.protected_storage(page);paths.no_errors(errors,writes,external);context.close()
    return {'releaseBase':base,'width':width,'reducedMotion':reduced,'art':art,'directionalPoses':samples,'plays':plays,
        'forwardHeadWithFixedHeels':True,'noSidewaysStandingBody':True,'pausedRateAndPlayback':True,
        'customArtworkPreserved':True,'actualGameSkipRestoresStanding':True,'savedDataUnchanged':True}


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--source',action='store_true');parser.add_argument('--url');parser.add_argument('--expect-release')
    args=parser.parse_args();server=None;started=time.monotonic()
    if args.url:url=args.url
    else:
        server=ThreadingHTTPServer(('127.0.0.1',0),partial(ui.Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
        url=f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/'+('game.html' if args.source else '')
    try:
        with ui.sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
            runner=cs.PublicBrowser(browser) if args.url else browser
            result={'passed':True,'entry':url,'scenarios':[flow(runner,url,args.expect_release),flow(runner,url,args.expect_release,390,True)]}
            browser.close()
        result['seconds']=round(time.monotonic()-started,1);name='public' if args.url else 'source' if args.source else 'launcher'
        (OUT/(name+'-results.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2),flush=True)
    finally:
        if server:server.shutdown()


if __name__=='__main__':main()
