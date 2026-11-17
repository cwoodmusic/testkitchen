"""NPCs step through real directional frames while following authored paths.

The imported stage is ordinary developer-project JSON. Transport, playtest,
Skip and reload use the real interface; game snapshots are read-only.
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

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'work/npc-walk-browser'
OUT.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('npc_tracks', ROOT / 'tests/quiet-bell-cutscene-tracks-browser.py')
tracks = importlib.util.module_from_spec(spec);spec.loader.exec_module(tracks)
cs, ui, paths = tracks.cs, tracks.ui, tracks.paths
ACTORS = ['nell', 'iris', 'pip', 'oren']
DIRECTIONS = ['down', 'left', 'right', 'up']


def tick(page, amount=100):
    cs.tick(page, amount)


def fixture(project, legacy=False):
    """Four separate loops on open floor make every turn easy to observe."""
    project = copy.deepcopy(project)
    if legacy:
        for character in project['cast'].values():
            character.pop('walk', None)
    room = project['scenes']['canal-porch']
    geometry = room['geometry']
    project['settings']['startRoomId'] = 'canal-porch'
    geometry['obstacles'] = [item for item in geometry['obstacles'] if item['id'] in ACTORS]
    positions = {identifier:{'x':250+index*300,'y':650} for index,identifier in enumerate(ACTORS)}
    for actor in room['actors']:
        at = positions[actor['id']]
        actor['feet'] = dict(at)
        actor['facing'] = 'down'
        obstacle = next(item for item in geometry['obstacles'] if item['id']==actor['id'])
        obstacle.update(x=at['x']-35,y=at['y']-26,width=70,height=26)
        target = next(item for item in geometry['targets'] if item['id']==actor['id'])
        target.update(**at,approach={'x':at['x'],'y':at['y']+65})
        obj = next(item for item in room['objects'] if item['id']==actor['id'])
        obj['rect'].update(x=at['x']-64,y=at['y']-160,width=128,height=166)
    beats = []
    for identifier,at in positions.items():
        beats.append({'id':identifier+'-walk','kind':'walk','actor':identifier,
                      'waypoints':[{'x':at['x']+128,'y':650},{'x':at['x']+128,'y':490},
                                   {'x':at['x'],'y':490}],
                      'destination':dict(at),'action':'look','startTile':0,'durationTiles':28})
    beats += [
        {'id':'walking-dialogue','kind':'dialogue','actor':'nell','speaker':'nell',
         'text':'These boots know the route. Watch us turn, then let us rest for a moment.',
         'startTile':0,'durationTiles':30},
        {'id':'walking-emote','kind':'emote','actor':'nell','emote':'idea','startTile':2,'durationTiles':20},
    ]
    project['content']['canal-porch']['cutscene'] = beats
    return project


def start_preview(page, touch=False):
    getattr(page.locator('#developer-cutscene-play'), 'tap' if touch else 'click')()
    tick(page, 80)
    getattr(page.locator('#developer-cutscene-pause'), 'tap' if touch else 'click')()
    tick(page, 60)
    return tracks.seek(page, 0)


def snapshot(page):
    return page.evaluate('''async()=>{
      const {CAST}=await import(new URL('cast.mjs',document.baseURI));
      const state=quietBell.cutscene,scene=quietBell.scene,map=document.getElementById('room-map').getBoundingClientRect();
      const scale=map.width/scene.geometry.width;
      return{tile:state.currentTile,elapsed:state.elapsed,beat:state.beat?.id,
        actors:state.actors.filter(actor=>actor.id!=='mira').map(actor=>{
          const node=document.querySelector('[data-actor="'+actor.id+'"]'),rect=node.getBoundingClientRect(),css=getComputedStyle(node);
          const definition=scene.actors.find(item=>item.id===actor.id),cast=quietBell.project.cast[definition.character];
          const walk=cast.walk??CAST[definition.character]?.walk,row=walk?.directions?.indexOf(actor.facing)??-1,column=Number(node.dataset.frame);
          const anchor=walk?.anchors?.[row]?.[column]??cast.anchor;
          const foot={x:rect.left+rect.width*anchor[0],y:rect.top+rect.height*anchor[1]};
          const expected={x:map.left+actor.x*scale,y:map.top+actor.y*scale};
          return{...actor,frame:column,row,elementFacing:node.dataset.facing,elementMoving:node.dataset.moving,
            background:css.backgroundImage,size:css.backgroundSize,xPosition:parseFloat(css.backgroundPositionX),
            yPosition:parseFloat(css.backgroundPositionY),footError:Math.hypot(foot.x-expected.x,foot.y-expected.y),
            anchor,foot,expected};
        })};
    }''')


def assert_frame(value, moving=True, facing=None):
    assert len(value['actors'])==4, value
    for actor in value['actors']:
        assert actor['elementFacing']==actor['facing'], actor
        assert actor['elementMoving']==str(actor['moving']).lower(), actor
        assert actor['moving'] is moving, (value['tile'],value['elapsed'],actor)
        assert actor['frame'] in [0,1,2] and actor['row']>=0, actor
        assert '300%' in actor['size'] and '400%' in actor['size'], actor
        assert actor['background'].endswith(actor['id']+'-walk.webp")'), actor
        assert abs(actor['xPosition']-actor['frame']*50)<.01, actor
        assert abs(actor['yPosition']-actor['row']*100/3)<.02, actor
        assert actor['footError']<3, actor
        if facing:
            assert actor['facing']==facing, actor
        if not moving:
            assert actor['frame']==0, actor


def inspect_art(page):
    """Read actual alpha pixels, so distinct row/frame flags cannot fake art."""
    return page.evaluate('''async()=>{
      const result={};
      for(const id of ['nell','iris','pip','oren']){
        const node=document.querySelector('[data-actor="'+id+'"]');
        const url=getComputedStyle(node).backgroundImage.match(/^url\\(["']?(.*?)["']?\\)$/)[1];
        const image=new Image();image.src=url;await image.decode();
        const width=image.naturalWidth/3,height=image.naturalHeight/4;
        const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
        const context=canvas.getContext('2d'),hashes=[],legHashes=[];
        const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))]
          .map(n=>n.toString(16).padStart(2,'0')).join('');
        for(let row=0;row<4;row++){
          const frames=[],legs=[];
          for(let col=0;col<3;col++){
            context.clearRect(0,0,width,height);context.drawImage(image,col*width,row*height,width,height,0,0,width,height);
            const bytes=context.getImageData(0,0,width,height).data;
            frames.push(await hash(bytes));
            const top=Math.floor(height*.65);
            legs.push(await hash(context.getImageData(0,top,width,height-top).data));
          }hashes.push(frames);legHashes.push(legs);
        }
        result[id]={image:url,width:image.naturalWidth,height:image.naturalHeight,hashes,legHashes};
      }return result;
    }''')


def assert_retained(page, poses):
    actual = page.evaluate('''ids=>Object.fromEntries(ids.map(id=>{
      const actor=quietBell.scene.actors.find(a=>a.id===id),node=document.querySelector('[data-actor="'+id+'"]');
      return[id,{feet:actor.feet,facing:actor.facing,elementFacing:node.dataset.facing,
        moving:node.dataset.moving,frame:Number(node.dataset.frame),position:getComputedStyle(node).backgroundPosition}];
    }))''', ACTORS)
    for identifier in ACTORS:
        at = next(item for item in poses if item['id']==identifier)
        retained = actual[identifier]
        assert math.hypot(retained['feet']['x']-at['x'],retained['feet']['y']-at['y'])<.001, (at,retained)
        assert retained['facing']==at['facing']==retained['elementFacing'], (at,retained)
        assert retained['frame']==0 and retained['moving']=='false', retained
    return actual


def flow(browser,url,width,reduced,expected):
    name = ('reduced' if reduced else 'desktop' if width>=500 else 'touch')
    context,page,errors,writes,external = ui.open_page(browser,url,width,'dark',height=844 if width<500 else 768,
                                                      reduced_motion='reduce' if reduced else 'no-preference')
    page.clock.pause_at(page.evaluate('Date.now()')+50)
    base = paths.validate_release(page,expected)
    saved, resources = cs.normal_storage(page), paths.resources(page)
    legacy = width>=500 and not reduced
    project = fixture(page.evaluate('quietBell.project'),legacy)
    page.keyboard.press('F2');page.locator('#developer-console').wait_for(state='visible')
    tracks.import_project(page,project,'npc-walk-'+name)
    getattr(page.locator('[data-dev-room="canal-porch"]'), 'tap' if width<500 else 'click')()
    getattr(page.locator('[data-dev-tab="cutscene"]'), 'tap' if width<500 else 'click')();tick(page,100)
    start_preview(page,width<500)
    art = inspect_art(page)
    assert len({item['image'] for item in art.values()})==4, art
    for identifier,item in art.items():
        assert item['width']%3==0 and item['height']%4==0, item
        assert all(len(set(row))==3 for row in item['hashes']), (identifier,item)
        assert all(len(set(row))==3 for row in item['legHashes']), ('Leg art must change, not just a face or hat.',identifier,item)
        assert len({row[0] for row in item['hashes']})==4, (identifier,item)
    samples=[];frames={identifier:{direction:set() for direction in DIRECTIONS} for identifier in ACTORS}
    for tile in range(18):
        if tile:
            page.keyboard.press('ArrowRight');tick(page,75)
        value = snapshot(page);assert abs(value['tile']-tile)<.001,value
        direction = 'right' if tile<4 else 'up' if tile<9 else 'left' if tile<13 else 'down'
        assert_frame(value,True,direction)
        for actor in value['actors']:
            frames[actor['id']][direction].add(actor['frame'])
        if tile in [1,5,9,14]:
            page.screenshot(path=str(OUT/(name+'-'+direction+'.png')))
        if tile==5:
            assert value['beat']=='walking-dialogue'
            assert next(a for a in value['actors'] if a['id']=='nell')['emote']=='idea'
            tracks.assert_emote_tracks_actor(page,page.evaluate('quietBell.cutscene'))
        samples.append(value)
    for actor,directions in frames.items():
        assert all(values=={0,1,2} for values in directions.values()), (actor,directions)
    hold = tracks.seek(page,20);assert all(not a['moving'] for a in hold['actors'])
    assert_frame(snapshot(page),False,'down')
    assert cs.normal_storage(page)==saved and paths.resources(page)==resources
    # Observe the playing transport as well as exact paused frame selection.
    # Actual RAF callbacks must advance both feet and the displayed leg frame.
    tracks.seek(page,0)
    page.locator('#developer-cutscene-play').click();tick(page,60)
    playing=[]
    for _ in range(8):
        tick(page,100);value=snapshot(page);assert_frame(value)
        assert page.evaluate('quietBell.cutscene.playing')
        playing.append(value)
    assert playing[-1]['tile']>playing[0]['tile']+4,playing
    for identifier in ACTORS:
        poses=[next(a for a in s['actors'] if a['id']==identifier) for s in playing]
        assert len({p['frame'] for p in poses})>=3,(identifier,poses)
        assert math.hypot(poses[-1]['x']-poses[0]['x'],poses[-1]['y']-poses[0]['y'])>80,(identifier,poses)
    page.locator('#developer-cutscene-stop').click();tick(page,60)
    retained = None
    if width>=500 and not reduced:
        # Apply is an ordinary user action, with its own isolated run and saves.
        page.locator('#developer-apply').click();page.locator('#developer-console').wait_for(state='hidden')
        cs.wait_for_story(page)
        tick(page,620)
        assert ui.state(page)['developerMode'] and ui.state(page)['roomId']=='canal-porch'
        page.evaluate('''()=>document.getElementById('cutscene-skip').addEventListener('click',()=>{
          window.__npcBeforeSkip=quietBell.cutscene.actors;
        },{capture:true,once:true})''')
        page.locator('#cutscene-skip').click();tick(page,80)
        skipped = page.evaluate('window.__npcBeforeSkip')
        assert any(actor['moving'] and actor['facing']=='up' for actor in skipped), skipped
        retained = assert_retained(page,skipped)
        page.reload();page.wait_for_function('!!window.quietBell?.state');tick(page,100)
        assert_retained(page,skipped)
        page.locator('#menu').click();page.locator('#replay-cutscene').click();tick(page,80)
        page.evaluate('''()=>document.addEventListener('quietbellcutscene',event=>{
          if(event.detail.finished&&!event.detail.preview)window.__npcFinished=event.detail.actors;
        })''')
        cs.wait_for_story(page)
        state = page.evaluate('quietBell.cutscene')
        tick(page,math.ceil(state['totalTiles']*state['quantumMs'])+1000)
        assert page.evaluate('quietBell.cutscene.manualDialogue'), 'The reader keeps the line after the physical performance ends.'
        cs.advance_to_finish(page)
        page.wait_for_function('!quietBell.cutscene')
        finished = page.evaluate('window.__npcFinished')
        assert finished and all(a['facing']=='down' for a in finished if a['id'] in ACTORS), finished
        assert_retained(page,finished)
        page.locator('#developer-end').click();tick(page,100)
        assert not ui.state(page)['developerMode'] and cs.normal_storage(page)==saved
    else:
        page.keyboard.press('F2');tick(page,80)
    assert cs.normal_storage(page)==saved and paths.resources(page)==resources
    ui.protected_storage(page);paths.no_errors(errors,writes,external)
    result={'releaseBase':base,'width':width,'reducedMotion':reduced,'allFourNpcSheets':True,
            'actualDistinctDirectionalArt':art,'allDirectionsUseThreeWalkingFrames':True,
            'legacyStaticProjectUsesDirectionalSprites':legacy,
            'actualPlayingFramesAdvance':True,'emoteFollowsWalkingFeet':True,'idleAfterWalking':True,
            'maxRenderedFootError':max(a['footError'] for s in samples for a in s['actors']),
            'retainedSkipFinishReload':retained is not None,'protectedSaveBytesUntouched':True}
    (OUT/(name+'-samples.json')).write_text(json.dumps(samples,indent=2)+'\n')
    context.close();return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',action='store_true')
    parser.add_argument('--url')
    parser.add_argument('--expect-release')
    args=parser.parse_args();server=None;started=time.monotonic()
    if args.url:url=args.url
    else:
        server=ThreadingHTTPServer(('127.0.0.1',0),partial(ui.Quiet,directory=str(ROOT)))
        Thread(target=server.serve_forever,daemon=True).start()
        url=f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/'+('game.html' if args.source else '')
    try:
        with ui.sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
            runner=cs.PublicBrowser(browser) if url.startswith('https:') else browser
            result={'passed':True,'entry':url,'scenarios':[flow(runner,url,1024,False,args.expect_release),
                     flow(runner,url,390,False,args.expect_release),flow(runner,url,1024,True,args.expect_release)]}
            browser.close()
        result['seconds']=round(time.monotonic()-started,1)
        name='public' if args.url else 'source' if args.source else 'launcher'
        (OUT/(name+'-results.json')).write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps(result,indent=2),flush=True)
    finally:
        if server:server.shutdown()


if __name__=='__main__':main()
