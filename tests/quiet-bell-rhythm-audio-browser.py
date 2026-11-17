"""Real rhythm count-in, metronome and beat readout through published controls.

The AudioContext observer delegates every native call unchanged. It records
scheduled oscillator times and gain envelopes; no game state is modified.
"""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse
import importlib.util
import json
import time

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work/rhythm-audio-browser'
OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('rhythm_audio_ui',ROOT/'tests/quiet-bell-cutscene-browser.py')
cs=importlib.util.module_from_spec(spec);spec.loader.exec_module(cs)
ui=cs.ui

OBSERVER=r'''(() => {
 const Native=window.AudioContext;if(!Native)return;
 window.__rhythmAudioEvents=[];window.__rhythmReadouts=[];
 const gains=new WeakMap();let sequence=0,contexts=0,lastReadout='';
 const emit=(kind,extra={})=>window.__rhythmAudioEvents.push({kind,at:performance.now(),...extra});
 let Wrapped;
 Wrapped=new Proxy(Native,{construct(target,args,newTarget){
  const context=Reflect.construct(target,args,newTarget===Wrapped?target:newTarget),contextId=++contexts;
  emit('context',{contextId,state:context.state,gesture:!!navigator.userActivation?.isActive});
  const createGain=context.createGain;
  context.createGain=function(...args){
   const gain=createGain.apply(this,args),record={peak:0};gains.set(gain,record);
   const ramp=gain.gain.linearRampToValueAtTime;
   gain.gain.linearRampToValueAtTime=function(value,time){record.peak=Math.max(record.peak,value);return ramp.call(this,value,time);};
   return gain;
  };
  const createOscillator=context.createOscillator;
  context.createOscillator=function(...args){
   const oscillator=createOscillator.apply(this,args),record={id:++sequence,contextId,frequency:null,gain:null};
   const set=oscillator.frequency.setValueAtTime,connect=oscillator.connect,start=oscillator.start,stop=oscillator.stop;
   oscillator.frequency.setValueAtTime=function(value,time){record.frequency=value;return set.call(this,value,time);};
   oscillator.connect=function(destination,...args){record.gain=gains.get(destination)??record.gain;return connect.call(this,destination,...args);};
   oscillator.start=function(when){emit('start',{id:record.id,contextId,type:this.type,frequency:record.frequency,peak:record.gain?.peak??0,when,now:context.currentTime});return start.call(this,when);};
   oscillator.stop=function(when){emit('stop',{id:record.id,contextId,when:when??null,now:context.currentTime});return stop.call(this,when);};
   return oscillator;
  };
  for(const name of ['resume','suspend','close']){
   const method=context[name];context[name]=function(...args){emit(name,{contextId,state:this.state,gesture:!!navigator.userActivation?.isActive});return method.apply(this,args);};
  }
  return context;
 }});
 window.AudioContext=Wrapped;
 function observe(){
  const node=document.getElementById('rhythm-playback-readout'),phase=node&&!node.hidden?node.dataset.phase:'hidden',beat=node&&!node.hidden?node.dataset.beat:null,key=phase+'|'+beat;
  if(key!==lastReadout){lastReadout=key;window.__rhythmReadouts.push({at:performance.now(),phase,beat:beat?Number(beat):null,text:node?.textContent??'',visible:!!node&&!node.hidden});}
  requestAnimationFrame(observe);
 }
 requestAnimationFrame(observe);
})();'''


class ObservedBrowser:
    def __init__(self,browser):self.browser=browser
    def new_context(self,**options):
        context=self.browser.new_context(**options);context.add_init_script(OBSERVER);return context


def events(page):return page.evaluate('window.__rhythmAudioEvents')
def starts(page):return [item for item in events(page) if item['kind']=='start']
def reset_trace(page):page.evaluate('window.__rhythmAudioEvents=[];window.__rhythmReadouts=[];')
def close_enough(first,second):assert abs(first-second)<.00001,(first,second)


def count_off(page,button,expected_duration_beats=4,screenshot=None):
    before=cs.conserved(page);saved=cs.normal_storage(page);reset_trace(page)
    page.locator(button).click()
    page.wait_for_function('window.__rhythmAudioEvents.some(e=>e.kind==="start"&&e.type==="triangle"&&e.frequency===523.25)')
    scheduled=starts(page)
    notes=[item for item in scheduled if item['type']=='triangle' and item['frequency'] in [523.25,659.25]]
    clicks=[item for item in scheduled if item['type']=='sine' and item['frequency'] in [1760,1180]]
    bpm=page.evaluate('quietBell.project.settings.bpm');beat=60/bpm
    assert len(clicks)==4+expected_duration_beats,(notes,clicks)
    assert notes and len({item['contextId'] for item in notes+clicks})==1,scheduled
    base=clicks[0]['when']
    for index,item in enumerate(clicks):
        close_enough(item['when'],base+index*beat)
        assert item['frequency']==(1760 if index%4==0 else 1180),item
    close_enough(notes[0]['when'],base+4*beat)
    assert all(item['when']>=notes[0]['when'] for item in notes)
    assert clicks[0]['peak']>clicks[1]['peak']>clicks[4]['peak']>clicks[5]['peak']>0,clicks
    assert min(item['peak'] for item in notes)>max(item['peak'] for item in clicks),scheduled
    readout=page.locator('#rhythm-playback-readout')
    assert readout.is_visible() and readout.get_attribute('data-phase')=='count-in'
    assert 'Count-in' in readout.inner_text()
    page.wait_for_function('document.getElementById("rhythm-playback-readout")?.dataset.beat==="3"')
    if screenshot:page.screenshot(path=str(OUT/(screenshot+'-count-in.png')))
    page.wait_for_function('document.getElementById("rhythm-playback-readout")?.dataset.phase==="pattern"')
    assert 'Listen' in readout.inner_text()
    if screenshot:page.screenshot(path=str(OUT/(screenshot+'-listening.png')))
    readout.wait_for(state='hidden')
    trace=page.evaluate('window.__rhythmReadouts')
    for phase in ['count-in','pattern']:
        assert {item['beat'] for item in trace if item['phase']==phase}=={1,2,3,4},trace
    assert cs.conserved(page)==before and cs.normal_storage(page)==saved,'Hearing a rhythm cannot spend notes or rewrite saved progress.'
    return {'countInClicks':4,'patternPulseClicks':expected_duration_beats,'startsWithSound':True,'beatSeconds':beat,'nativeStarts':len(scheduled),'readoutPhases':trace}


def cancel_test(page,button,trigger):
    reset_trace(page);page.locator(button).click()
    page.wait_for_function('window.__rhythmAudioEvents.some(e=>e.kind==="start"&&e.type==="triangle"&&e.frequency===523.25)')
    old=starts(page);future=[item for item in old if item['when']>item['now']+.1]
    assert future,old
    trigger()
    page.locator('#rhythm-playback-readout').wait_for(state='hidden')
    page.wait_for_timeout(100)
    observed=events(page);cancelled={item['id'] for item in observed if item['kind']=='stop' and item['when'] is None}
    assert all(item['id'] in cancelled for item in future),(future,observed)
    return {'cancelledFutureVoices':len(future),'readoutCleared':True}


def flow(browser,url,expected=None,width=1024):
    context,page,errors,writes,external=ui.open_page(ObservedBrowser(browser),url,width,'dark',virtual_walk=False)
    base=cs.assert_release(page,expected);ui.press(page,'button[data-door="garden"]')
    key=page.evaluate('quietBell.project.doors[quietBell.state.selectedDoor].recipe')
    rests=page.evaluate('quietBell.project.noteKinds.filter(note=>note.rest).map(note=>note.id)')
    assert key[0] not in rests,key
    lock=count_off(page,'#door-demo',screenshot=str(width)+'-door')
    normal=cs.conserved(page)
    panel=cancel_test(page,'#door-demo',lambda:page.locator('#notes-close').click())
    assert cs.conserved(page)==normal
    ui.press(page,'button[data-door="garden"]')
    blurred=cancel_test(page,'#door-demo',lambda:page.evaluate('window.dispatchEvent(new Event("blur"))'))
    assert any(item['kind']=='suspend' for item in events(page))
    page.evaluate('window.dispatchEvent(new Event("focus"))')
    page.locator('#notes-close').click()
    ui.press(page,'button[data-person="pip"]');page.locator('button[data-topic="route"]').click()
    conversation=count_off(page,'#demo',screenshot=str(width)+'-conversation')
    panel2=cancel_test(page,'#demo',lambda:page.locator('#conversation-close').click())
    page.locator('#menu').click();page.locator('#sound').click()
    assert page.locator('#sound').get_attribute('aria-pressed')=='false'
    page.locator('#menu-close').click();ui.press(page,'button[data-door="garden"]');reset_trace(page)
    assert page.locator('#door-demo').is_disabled()
    page.wait_for_timeout(100);assert not starts(page)
    assert page.locator('#rhythm-playback-readout').is_hidden()
    ui.layout(page,touch=width<500);ui.protected_storage(page)
    assert not errors and not writes and not external,(errors,writes,external)
    context.close()
    return {'releaseBase':base,'width':width,'door':lock,'conversation':conversation,'panelClose':panel,'blur':blurred,'conversationClose':panel2,'soundSwitchMutesRhythm':True,'savedResourcesPreserved':True}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',action='store_true');parser.add_argument('--url');parser.add_argument('--expect-release')
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
            result={'passed':True,'entry':url,'scenarios':[flow(runner,url,args.expect_release,width) for width in [1024,390]]}
            browser.close()
        result['seconds']=round(time.monotonic()-started,1);name='public' if args.url else 'source' if args.source else 'launcher'
        (OUT/(name+'-results.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2),flush=True)
    finally:
        if server:server.shutdown()


if __name__=='__main__':main()
