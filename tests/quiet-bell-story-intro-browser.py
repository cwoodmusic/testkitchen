"""A readable story crawl precedes play and can be skipped without skipping entry.

Only real controls, browser lifecycle events and clock-driven RAF callbacks are
used. Save storage is observed, apart from an explicit legacy developer fixture.
"""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse
import importlib.util
import json
import math
import time

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work/story-intro-browser';OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('intro_tracks',ROOT/'tests/quiet-bell-cutscene-tracks-browser.py')
tracks=importlib.util.module_from_spec(spec);spec.loader.exec_module(tracks)
cs,ui,paths=tracks.cs,tracks.ui,tracks.paths
PARAGRAPHS=[
    'Lumen Reach’s public bell fell silent. It once kept the doors, postal routes, water clocks, and mechanical courier birds working together. Now signals go out, but replies don’t return. Everyday life has started getting stuck.',
    'Then a parcel returns to Nell’s depot with its wax seal still warm—even though the outgoing routes are dark. Something carried it back, and nobody knows how.',
    'Nell gathers Mira, Iris, and Pip to follow that mystery through the old network. They’re trying to discover who—or what—is still answering, and why the bell stopped.',
]
TRACE=r'''(() => {
  window.__introEntries=[];
  const dispatch=EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent=function(event){
    if(event.type==='quietbellcutscene'&&event.detail?.phase==='entry'&&event.detail.entry?.currentTile===0)
      window.__introEntries.push({roomId:event.detail.roomId,opacity:event.detail.entry.fadeOpacity});
    return dispatch.call(this,event);
  };
})();'''

class TraceBrowser:
    def __init__(self,browser):self.browser=browser
    def new_context(self,**options):
        context=self.browser.new_context(**options);context.add_init_script(TRACE);return context

def intro(page):return page.evaluate('window.quietBell?.intro??null')
def tick(page,ms=100):cs.tick(page,ms)
def storage(page):
    return page.evaluate('(keys)=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]))',
                         [ui.SAVE_KEY,'codaQuietBellJourneyV1',*ui.PROTECTED])
def ready(page):
    for _ in range(100):
        value=intro(page)
        if value and value.get('ready'):return value
        tick(page,50)
    raise AssertionError(intro(page))

def layout(page):
    value=page.locator('#story-intro').evaluate('''e=>{
      const r=e.getBoundingClientRect(),skip=e.querySelector('#story-intro-skip').getBoundingClientRect();
      const p=e.querySelector('.story-intro-text p');
      return{x:r.x,y:r.y,width:r.width,height:r.height,viewport:[innerWidth,innerHeight],
        docWidth:document.documentElement.scrollWidth,docHeight:document.documentElement.scrollHeight,
        skip:{x:skip.x,y:skip.y,width:skip.width,height:skip.height},fontSize:parseFloat(getComputedStyle(p).fontSize),
        fontFamily:getComputedStyle(p).fontFamily,cover:!!document.elementFromPoint(innerWidth/2,innerHeight/2)?.closest('#story-intro')};
    }''')
    w,h=value['viewport'];assert abs(value['x'])<1 and abs(value['y'])<1,value
    assert abs(value['width']-w)<1 and abs(value['height']-h)<1,value
    assert value['docWidth']<=w+1 and value['docHeight']<=h+1,value
    assert value['fontSize']>=16 and value['cover'],value
    button=value['skip'];assert button['width']>=44 and button['height']>=44,value
    assert button['x']>=0 and button['y']>=0 and button['x']+button['width']<=w+1 and button['y']+button['height']<=h+1,value
    assert page.locator('.story-intro-text p').all_text_contents()==PARAGRAPHS
    return value

def safe(page,errors,writes,external):
    ui.protected_storage(page);paths.no_errors(errors,writes,external)

def assert_entry(page,baseline=None):
    value=cs.cutscene(page);assert value and value['phase']=='entry' and not value['finished'],value
    assert not intro(page) and page.locator('#story-intro').count()==0
    assert value['beat'] is None and value['entry']['currentTile']<3,value
    assert page.locator('#cutscene-skip').is_visible()
    if baseline is not None:assert storage(page)==baseline
    return value

def desktop_flow(browser,url,expected):
    context,page,errors,writes,external=ui.open_page(TraceBrowser(browser),url,1024,'dark',height=768,skip_cutscenes=False,skip_intro=False)
    base=paths.validate_release(page,expected);value=ready(page);bounds=layout(page)
    assert not cs.cutscene(page) and 30000<=value['duration']<=75000,value
    baseline=storage(page);resources=cs.conserved(page);position=ui.walker(page)
    page.keyboard.down('ArrowRight');tick(page,500);page.keyboard.up('ArrowRight')
    page.keyboard.press('F2');tick(page,100)
    assert ui.walker(page)==position and not ui.state(page)['editing']
    assert cs.conserved(page)==resources and storage(page)==baseline
    start=intro(page);tick(page,2500);moved=intro(page)
    assert moved['elapsed']>start['elapsed']+2000 and moved['progress']>start['progress'],(start,moved)
    assert moved['scrollY']<start['scrollY'],(start,moved)
    page.evaluate('window.dispatchEvent(new Event("blur"))');paused=intro(page);tick(page,1000)
    assert intro(page)['elapsed']==paused['elapsed'] and not intro(page)['playing']
    page.evaluate('window.dispatchEvent(new Event("focus"))');tick(page,500)
    assert intro(page)['elapsed']>paused['elapsed'] and intro(page)['playing']
    value=intro(page);tick(page,max(0,int(value['duration']*.4-value['elapsed'])))
    page.evaluate('window.dispatchEvent(new Event("blur"))');layout(page)
    page.screenshot(path=str(OUT/'desktop-story-scroll.png'))
    page.evaluate('window.dispatchEvent(new Event("focus"))')
    value=intro(page);tick(page,math.ceil(value['duration']-value['elapsed'])+30)
    assert_entry(page,baseline)
    assert page.evaluate('window.__introEntries.length')==1
    ui.skip_cutscene(page);tick(page,50)
    page.locator('#menu').click();page.locator('#replay-story-intro').click();ready(page)
    before=storage(page);page.keyboard.press('Escape');tick(page,30)
    assert not intro(page) and storage(page)==before
    assert page.locator('#menu-dialog').is_hidden()
    # Restart is another game beginning, rather than another entered room.
    page.locator('#menu').click();page.locator('#restart').click();ready(page)
    assert not cs.cutscene(page) and ui.state(page)['inventory']==ui.EMPTY
    page.keyboard.press('Escape');assert_entry(page)
    ui.skip_cutscene(page)
    # Existing progress resumes behind the opening without being spent/reset.
    ui.press(page,'[data-person="nell"]');ui.press(page,'#take-parcel')
    saved=storage(page);saved_resources=cs.conserved(page)
    page.reload();page.wait_for_function('!!window.quietBell?.walker');ready(page)
    assert storage(page)==saved and cs.conserved(page)==saved_resources
    page.keyboard.press('Escape');tick(page,30)
    assert not intro(page) and not cs.cutscene(page) and storage(page)==saved
    safe(page,errors,writes,external);context.close()
    return {'releaseBase':base,'exactCopy':True,'layout':bounds,'realScroll':True,'pauseResume':True,
            'naturalCompletionStartsOneEntry':True,'escapeDoesNotSkipEntry':True,'replayAndRestart':True,
            'savedRunResumeBytesUnchanged':True,'behindIntroInputBlocked':True}

def phone_flow(browser,url,expected,width=390,reduced=False):
    context,page,errors,writes,external=ui.open_page(TraceBrowser(browser),url,width,'dark',skip_cutscenes=False,skip_intro=False,
        reduced_motion='reduce' if reduced else 'no-preference')
    base=paths.validate_release(page,expected);value=ready(page);bounds=layout(page);baseline=storage(page)
    if reduced:
        assert value['reducedMotion'];before=intro(page);tick(page,4000);after=intro(page)
        assert after['scrollY']==before['scrollY'],(before,after)
        page.locator('#story-intro-window').hover();page.mouse.wheel(0,300);tick(page,100)
        page.screenshot(path=str(OUT/f'phone-{width}-reduced-story.png'))
        page.locator('#story-intro-continue').tap()
    else:
        tick(page,round(value['duration']*.35));before=intro(page)
        assert before['progress']>0 and before['scrollY']<value['scrollY']
        page.evaluate('window.dispatchEvent(new Event("blur"))');page.screenshot(path=str(OUT/f'phone-{width}-story.png'))
        page.evaluate('window.dispatchEvent(new Event("focus"))')
        page.locator('#story-intro-skip').tap()
    assert_entry(page,baseline)
    assert page.evaluate('window.__introEntries.length')==1
    ui.skip_cutscene(page);safe(page,errors,writes,external);context.close()
    return {'releaseBase':base,'width':width,'reducedMotion':reduced,'layout':bounds,
            'actualTouchSkipOrContinue':True,'oneFollowingDoorway':True,'savesProtected':True}

def developer_flow(browser,url,expected):
    context,page,errors,writes,external=ui.open_page(browser,url,1024,'dark')
    base=paths.validate_release(page,expected)
    project=page.evaluate('JSON.parse(JSON.stringify(quietBell.project))')
    new_pip=next(clip['text'] for clip in project['content']['depot']['cutscene'] if clip.get('kind')=='dialogue' and clip.get('speaker')=='pip')
    old_pip='My courier heard something! Is it behind us? Ah! No, only my feet. I am up. Please do not let the letter bite.'
    custom='My own careful reply should survive an opening update.'
    clip=next(clip for clip in project['content']['garden-porch']['cutscene'] if clip.get('kind')=='dialogue' and clip.get('speaker')=='pip')
    clip['text']=custom
    baseline=storage(page)
    page.keyboard.press('F2');page.locator('#developer-console').wait_for(state='visible')
    tracks.import_project(page,project,'intro-saved-developer-project')
    page.locator('#developer-apply').click();page.locator('#developer-console').wait_for(state='hidden');tick(page,100)
    assert not intro(page) and cs.cutscene(page), 'Iterative Apply starts the room directly.'
    ui.skip_cutscene(page)
    # Seed only the developer definition to emulate an unchanged old stock line
    # already stored on this machine; custom dialogue and run receipts survive.
    page.evaluate('''old=>{
      for(const key of ['codaQuietBellDeveloperProjectV1','codaQuietBellDeveloperAppliedProjectV1']){
        const project=JSON.parse(localStorage.getItem(key));
        const clip=project.content.depot.cutscene.find(c=>c.kind==='dialogue'&&c.speaker==='pip');
        clip.text=old;localStorage.setItem(key,JSON.stringify(project));
      }
    }''',old_pip)
    saved_dev=page.evaluate('({project:localStorage.getItem("codaQuietBellDeveloperAppliedProjectV1"),run:localStorage.getItem("codaQuietBellDeveloperRunV1"),journey:localStorage.getItem("codaQuietBellDeveloperJourneyV1")})')
    page.reload();page.wait_for_function('!!window.quietBell?.walker');ready(page)
    assert ui.state(page)['developerMode'] and not cs.cutscene(page)
    assert storage(page)==baseline
    current=page.evaluate('({project:localStorage.getItem("codaQuietBellDeveloperAppliedProjectV1"),run:localStorage.getItem("codaQuietBellDeveloperRunV1"),journey:localStorage.getItem("codaQuietBellDeveloperJourneyV1")})')
    assert current==saved_dev
    assert custom in page.evaluate('quietBell.project.content["garden-porch"].cutscene.map(c=>c.text??"")')
    assert page.evaluate('quietBell.project.content.depot.cutscene.find(c=>c.kind==="dialogue"&&c.speaker==="pip").text')==new_pip
    page.keyboard.press('Escape');tick(page,30)
    assert not intro(page) and storage(page)==baseline
    safe(page,errors,writes,external);context.close()
    return {'releaseBase':base,'savedDeveloperLaunchIntro':True,'applySkipsIntro':True,
            'developerProjectAndRunBytesPreserved':True,'customDialoguePreserved':True,'oldStockPipDialogueUpdated':True,'normalSaveBytesUntouched':True}

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
            result={'passed':True,'entry':url,'desktop':desktop_flow(runner,url,args.expect_release),
                'phones':[phone_flow(runner,url,args.expect_release,width,reduced) for width,reduced in [(390,False),(320,False),(320,True)]],
                'developer':developer_flow(runner,url,args.expect_release)}
            browser.close()
        result['seconds']=round(time.monotonic()-started,1);name='public' if args.url else 'source' if args.source else 'launcher'
        (OUT/(name+'-results.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2),flush=True)
    finally:
        if server:server.shutdown()

if __name__=='__main__':main()
