"""Compact concert HUD, toolbar switch, Settings volume, and shared preferences."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import argparse, hashlib, json, math
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
MAP=ROOT/'town/maps/coda-town-plaza-boardwalk.json'
KEY='codaTownConcertAudioV1'
parser=argparse.ArgumentParser()
parser.add_argument('--url',help='Published builder URL; HTTPS uses verified urllib transport')
parser.add_argument('--screenshots',type=Path,default=ROOT/'work/music-settings/final')
args=parser.parse_args();OUT=args.screenshots;OUT.mkdir(parents=True,exist_ok=True)
source_hash=hashlib.sha256(MAP.read_bytes()).hexdigest()

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def copyfile(self,source,target):
        try:super().copyfile(source,target)
        except(BrokenPipeError,ConnectionResetError):pass

server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
steps=[]
def note(name,data=None):
    steps.append({'step':name,'data':data})
    (OUT/'progress.json').write_text(json.dumps(steps,indent=2));print(name,flush=True)

SNAP=r'''()=>{
 const q=window.townGame||townBuilder,s=q.concert.state,a=q.concert.audioElement;
 return{trackId:s.trackId,title:s.track?.title,composer:s.track?.composer,playing:s.playing,status:s.status,wanted:s.wanted,muted:s.muted,volume:s.volume,time:q.concert.currentTime,src:a?.currentSrc||a?.src||'',context:s.context,effectiveVolume:s.effectiveVolume,failed:s.failedTrackIds};
}'''

try:
    with sync_playwright()as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':1600,'height':1000})
        room_pack=json.loads((ROOT/'tests/fixtures/victorian-user-layout.json').read_text())
        seed={'prefs':{'version':1,'muted':True,'volume':.37},'rooms':room_pack}
        context.add_init_script('''seed=>{}'''.replace('seed=>{}','''(()=>{const seed=%s;if(!localStorage.getItem('__musicSettingsQA')){localStorage.setItem('__musicSettingsQA','1');localStorage.setItem('codaTownConcertAudioV1',JSON.stringify(seed.prefs));localStorage.setItem('codaRoomLayoutsV1:builder',JSON.stringify(seed.rooms));localStorage.setItem('codaNotesWalletV1',JSON.stringify({version:1,balance:1400,owned:['furniture-geranium'],rewards:[],earned:1420,spent:20}));localStorage.setItem('musicArcadeV1',JSON.stringify({name:'Music Settings QA',customized:true}));localStorage.setItem('codaTownAdventuresV1:guest',JSON.stringify({version:1,stars:7,netWins:2,fish:{'copper-sprat':{count:2,best:14.5}},yellowNotes:{quarter:5,'eighth-pair':2,'sixteenth-group':3},npcRhythmWins:{mozart:2}}));}})()'''%json.dumps(seed)))
        if args.url:
            cache={}
            def trusted(route):
                url=route.request.url
                if url not in cache:
                    headers={'Accept-Encoding':'identity'}
                    if route.request.headers.get('range'):headers['Range']=route.request.headers['range']
                    try:response=urlopen(Request(url,headers=headers),timeout=60)
                    except HTTPError as error:response=error
                    with response:cache[url]=(response.status,{k:v for k,v in response.headers.items()if k.lower()in{'content-type','content-range','accept-ranges','cache-control'}},response.read())
                status,headers,body=cache[url];route.fulfill(status=status,headers=headers,body=body)
            context.route('https://cwoodmusic.github.io/testkitchen/**',trusted)
        page=context.new_page();page.set_default_timeout(90000);errors=[];failed=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('response',lambda r:failed.append({'url':r.url,'status':r.status})if r.status>=400 else None)
        page.goto(args.url or f'http://127.0.0.1:{server.server_port}/town/builder/')
        page.wait_for_function('!!window.townBuilder?.concert')
        page.locator('#file').set_input_files(str(MAP));page.wait_for_function('townBuilder.project.objects.length===137&&townBuilder.concert.state.hasVenue')
        world=page.evaluate('JSON.stringify(townBuilder.project)')
        protected=page.evaluate('()=>Object.fromEntries(["codaRoomLayoutsV1:builder","codaNotesWalletV1","musicArcadeV1","codaTownAdventuresV1:guest"].map(k=>[k,localStorage.getItem(k)]))')
        hud=page.locator('.concert-controls');music=page.locator('.concert-controls__music');settings=page.locator('.concert-controls__settings');dialog=page.get_by_role('dialog',name='Settings',exact=True)
        slider=dialog.get_by_role('slider',name='Opera House volume',exact=True)
        def snap():return page.evaluate(SNAP)
        def prefs():return page.evaluate('JSON.parse(localStorage.getItem(%s))'%json.dumps(KEY))
        def raf():page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
        def check_hud(label):
            state=snap();assert hud.is_visible()
            assert hud.locator('.concert-controls__track').inner_text()==state['title']
            assert hud.locator('.concert-controls__composer').inner_text()==state['composer']
            assert hud.locator('input[type=range]').count()==0
            assert hud.locator('button').count()==0,'The always-visible HUD stays passive'
            geometry=page.evaluate('''()=>{const rect=e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,w:b.width,h:b.height}},h=document.querySelector('.concert-controls'),items=[...document.querySelectorAll('.concert-controls__music,.concert-controls__settings')].map(rect),blockers=[...document.querySelectorAll('#touch,.yellow-note-inventory')].filter(e=>!e.hidden).map(rect).filter(b=>b.w>0&&b.h>0);return{hud:rect(h),items,blockers,width:innerWidth,height:innerHeight}}''')
            h=geometry['hud'];assert h['w']<=320.1 and h['h']<110,(label,geometry)
            for box in [h,*geometry['items']]:assert box['x']>=-.1 and box['y']>=-.1 and box['x']+box['w']<=geometry['width']+.1 and box['y']+box['h']<=geometry['height']+.1,(label,geometry)
            for b in geometry['blockers']:assert min(h['x']+h['w'],b['x']+b['w'])-max(h['x'],b['x'])<=0 or min(h['y']+h['h'],b['y']+b['h'])-max(h['y'],b['y'])<=0,(label,'HUD overlaps game controls',geometry)
            return geometry
        def same_audio(before):
            after=snap();assert page.evaluate('(window.townGame||townBuilder).concert.audioElement===window.__musicElement')
            assert after['trackId']==before['trackId']and after['src']==before['src']and after['time']>=before['time']-.03,(before,after)
            assert not after['failed'],after
            return after

        initial=snap();assert initial['muted']and initial['volume']==.37
        desktop=check_hud('builder desktop')
        settings.click();assert dialog.is_visible()and slider.input_value()=='37'
        assert snap()['playing']==initial['playing']and snap()['wanted']==initial['wanted']
        slider.focus();page.keyboard.press('ArrowRight');assert slider.input_value()=='38'
        assert prefs()=={'version':1,'muted':True,'volume':.38}
        page.screenshot(path=str(OUT/'builder-volume-settings.png'))
        page.keyboard.press('Escape');assert not dialog.is_visible()
        assert settings.evaluate('(e)=>document.activeElement===e')
        note('Main HUD shows title and composer; Settings alone owns the persisted volume',desktop)

        music.click();page.wait_for_function('(window.townGame||townBuilder).concert.state.playing&&(window.townGame||townBuilder).concert.currentTime>.1')
        assert music.get_attribute('aria-pressed')=='true'and not snap()['muted']
        page.evaluate('window.__musicElement=(window.townGame||townBuilder).concert.audioElement')
        playing=snap();music.click();assert snap()['muted']and music.get_attribute('aria-pressed')=='false'
        page.wait_for_function('time=>(window.townGame||townBuilder).concert.currentTime>time+.1',arg=playing['time'])
        same_audio(playing);assert snap()['effectiveVolume']==0
        assert hud.is_visible()
        music.click();page.wait_for_function('!(window.townGame||townBuilder).concert.state.muted')
        same_audio(playing);assert prefs()=={'version':1,'muted':False,'volume':.38}
        page.screenshot(path=str(OUT/'builder-compact-player.png'))
        note('Music off silences output; on resumes the same audio element, source, and advancing programme')

        page.locator('#walk').click();page.evaluate("townBuilder.urban.enterBuilding(townBuilder.project.objects.find(o=>o.asset==='sydney-opera-house'))")
        page.wait_for_function("townBuilder.urban.scene?.kind==='concert'")
        page.locator('#map').focus();start=page.evaluate('({...townBuilder.urban.player})')
        page.keyboard.down('w');page.wait_for_function('y=>townBuilder.urban.player.y<y-5',arg=start['y'])
        settings.click();slider.focus();page.keyboard.up('w')
        stopped=page.evaluate('({...townBuilder.urban.player})');page.keyboard.press('ArrowRight');assert slider.input_value()=='39';raf()
        after=page.evaluate('({...townBuilder.urban.player})');assert math.hypot(after['x']-stopped['x'],after['y']-stopped['y'])<.05
        page.keyboard.press('Escape');assert not dialog.is_visible()and page.evaluate("townBuilder.urban.scene?.kind==='concert'")
        assert settings.evaluate('(e)=>document.activeElement===e')and page.locator('#walk').inner_text()=='Stop walk test'
        note('Settings keys and Escape stay inside the dialog; releasing an old movement key stops the avatar')

        settings.click();dialog.get_by_role('button',name='Programme & credits',exact=True).click()
        assert not dialog.is_visible();page.wait_for_selector('.urban-dialog[open]')
        assert page.locator('.urban-dialog[open] a[href^="https://"]').count()>=8
        page.locator('.urban-dialog[open]').get_by_role('button',name='Close',exact=True).click()
        assert page.evaluate('JSON.stringify(townBuilder.project)')==world
        page.set_viewport_size({'width':390,'height':844});raf();builder_mobile=check_hud('builder mobile')
        page.screenshot(path=str(OUT/'builder-mobile-player.png'))
        settings.click();assert dialog.is_visible();page.screenshot(path=str(OUT/'builder-mobile-settings.png'));dialog.get_by_role('button',name='Done',exact=True).click()
        page.set_viewport_size({'width':1600,'height':1000});raf()
        page.locator('#walk').click();music.click();assert prefs()['muted']
        expected_preferences=prefs();page.reload();page.wait_for_function('!!window.townBuilder?.concert')
        page.wait_for_function('townBuilder.concert.state.hasVenue');assert snap()['muted']and snap()['volume']==expected_preferences['volume']
        assert prefs()==expected_preferences;check_hud('builder reload')
        note('Credits remain accessible; desktop/mobile controls and preferences survive reload',builder_mobile)

        page.locator('#play').click();page.wait_for_function('!!window.townGame?.concert');page.wait_for_function('townGame.concert.state.hasVenue')
        assert snap()['muted']and snap()['volume']==.39;play_desktop=check_hud('play desktop')
        assert page.evaluate('JSON.stringify(townGame.project)')==world
        settings.click();assert slider.input_value()=='39';slider.focus();page.keyboard.press('ArrowLeft');assert slider.input_value()=='38';page.keyboard.press('Escape');assert not dialog.is_visible()
        music.click();page.wait_for_function('townGame.concert.state.playing&&townGame.concert.currentTime>.1')
        assert not snap()['muted']and snap()['volume']==.38
        page.screenshot(path=str(OUT/'play-compact-player.png'))
        page.set_viewport_size({'width':390,'height':844});raf();play_mobile=check_hud('play mobile')
        settings.click();assert dialog.is_visible();page.screenshot(path=str(OUT/'play-mobile-settings.png'));page.keyboard.press('Escape');assert not dialog.is_visible()
        page.screenshot(path=str(OUT/'play-mobile-player.png'))
        assert page.evaluate('()=>Object.fromEntries(["codaRoomLayoutsV1:builder","codaNotesWalletV1","musicArcadeV1","codaTownAdventuresV1:guest"].map(k=>[k,localStorage.getItem(k)]))')==protected
        play_url=page.url
        touch=context.storage_state(indexed_db=True)
        coarse=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,storage_state=touch)
        if args.url:coarse.route('https://cwoodmusic.github.io/testkitchen/**',trusted)
        page=coarse.new_page();page.set_default_timeout(90000)
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('response',lambda r:failed.append({'url':r.url,'status':r.status})if r.status>=400 else None)
        page.goto(play_url);page.wait_for_function('!!window.townGame?.concert&&townGame.concert.state.hasVenue')
        hud=page.locator('.concert-controls');music=page.locator('.concert-controls__music');settings=page.locator('.concert-controls__settings');dialog=page.get_by_role('dialog',name='Settings',exact=True);slider=dialog.get_by_role('slider',name='Opera House volume',exact=True)
        raf();coarse_geometry=check_hud('touch Play')
        assert page.locator('#touch').is_visible()
        settings.tap();assert dialog.is_visible()and slider.input_value()=='38'
        page.screenshot(path=str(OUT/'play-touch-settings.png'));dialog.get_by_role('button',name='Done',exact=True).tap()
        assert not dialog.is_visible();music.tap();page.wait_for_function('townGame.concert.state.playing&&townGame.concert.currentTime>.1')
        assert not snap()['muted'];page.screenshot(path=str(OUT/'play-touch-player.png'))
        assert page.evaluate('JSON.stringify(townGame.project)')==world
        assert page.evaluate('()=>Object.fromEntries(["codaRoomLayoutsV1:builder","codaNotesWalletV1","musicArcadeV1","codaTownAdventuresV1:guest"].map(k=>[k,localStorage.getItem(k)]))')==protected
        assert hashlib.sha256(MAP.read_bytes()).hexdigest()==source_hash
        assert not errors and not failed,(errors,failed)
        note('Play shares the same Settings, live music toggle, and persisted volume without changing saved data',{'desktop':play_desktop,'mobile':play_mobile,'touch':coarse_geometry})
        (OUT/'results.json').write_text(json.dumps({'passed':True,'mainHudTitleAndComposer':True,'volumeOnlyInSettings':True,'sameAudioSourceOnOff':True,'keyboardFocusAndEscape':True,'sharedPreferences':True,'mapRoomsWalletProfileNotesAndFishUnchanged':True,'errors':errors,'failedResponses':failed,'steps':steps},indent=2))
        browser.close()
finally:server.shutdown()
