"""Edit a cutscene as a chronological script without disturbing physical tracks.

UI events drive authoring, history, downloads, actor selection and playtests.
Snapshots and exports are read-only; no mutable game/editor hooks are used.
"""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse
import copy
import importlib.util
import json
import time

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work/cutscene-dialogue-browser';OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('dialogue_tracks',ROOT/'tests/quiet-bell-cutscene-tracks-browser.py')
tracks=importlib.util.module_from_spec(spec);spec.loader.exec_module(tracks)
cs,ui,paths=tracks.cs,tracks.ui,tracks.paths
TEXT='#developer-cutscene-dialogue-text'


def tick(page,ms=100):cs.tick(page,ms)
def records(project):return project['content']['depot']['cutscene']
def by_id(project,identifier):return next(clip for clip in records(project) if clip['id']==identifier)
def physical(project):return [clip for clip in records(project) if clip['kind']!='dialogue']
def voice(page,identifier,touch=False):
    getattr(page.locator('[data-dialogue-speaker="'+identifier+'"]'),'tap' if touch else 'click')();tick(page,60)
def select(page,index,touch=False):
    getattr(page.locator('[data-cutscene-dialogue-index="'+str(index)+'"]'),'tap' if touch else 'click')();tick(page,60)
    assert selected_index(page)==index

def selected_index(page):
    return int(page.locator('[data-cutscene-dialogue-index][aria-pressed="true"]').get_attribute('data-cutscene-dialogue-index'))
def script_indexes(page):
    return page.locator('[data-cutscene-dialogue-index]').evaluate_all('nodes=>nodes.map(n=>Number(n.dataset.cutsceneDialogueIndex))')
def open_cutscene(page,touch=False):
    page.keyboard.press('F2');page.locator('#developer-console').wait_for(state='visible')
    getattr(page.locator('[data-dev-tab="cutscene"]'),'tap' if touch else 'click')();tick(page,70)
    assert page.locator('#developer-cutscene-mode-dialogue').get_attribute('aria-pressed')=='true'
    assert page.locator('#developer-cutscene-dialogue').is_visible()

def fixture(project):
    project=copy.deepcopy(project);project['authorMetadata']={'keep':'project metadata'}
    project['scenes']['depot']['entry']={'enabled':False}
    project['content']['depot']['cutscene']=[
      {'id':'physical-walk','kind':'walk','actor':'nell','destination':{'x':600,'y':700},'action':'examine','startTile':0,'durationTiles':40,'author':{'keep':'route'}},
      {'id':'physical-emote','kind':'emote','actor':'pip','emote':'question','startTile':2,'durationTiles':4,'author':{'keep':'reaction'}},
      {'id':'physical-action','kind':'gesture','actor':'iris','gesture':'magnify','startTile':3,'durationTiles':20,'author':{'keep':'prop'}},
      {'id':'late','kind':'dialogue','actor':'nell','speaker':'pip','text':'Third line notices a careful repair.','startTile':60,'durationTiles':18,'author':{'keep':'late note'}},
      {'id':'first','kind':'dialogue','actor':'iris','speaker':'nell','text':'First line begins the investigation.','startTile':10,'durationTiles':12,'author':{'keep':'first note'}},
      {'id':'middle','kind':'dialogue','actor':'pip','speaker':'iris','text':'Second line examines the evidence.','startTile':35,'durationTiles':15,'author':{'keep':'middle note'}},
    ]
    return project

def export_project(page,name,dispatch=False):
    tools=page.locator('#developer-console details.dc-tools')
    if not tools.evaluate('e=>e.open'):tools.locator('summary').click()
    with page.expect_download() as event:
        if dispatch:page.locator('#developer-export').dispatch_event('click')
        else:page.locator('#developer-export').click()
    target=OUT/(name+'.json');event.value.save_as(target)
    if tools.evaluate('e=>e.open'):tools.locator('summary').click()
    return json.loads(target.read_text())

def project_action(page,identifier,touch=False):
    tools=page.locator('#developer-console details.dc-tools')
    if not tools.evaluate('e=>e.open'):getattr(tools.locator('summary'),'tap' if touch else 'click')()
    getattr(page.locator('#developer-'+identifier),'tap' if touch else 'click')();tick(page,80)
    tools=page.locator('#developer-console details.dc-tools')
    if tools.evaluate('e=>e.open'):getattr(tools.locator('summary'),'tap' if touch else 'click')()
    tick(page,50)

def save_pending(page):
    assert page.locator(TEXT).evaluate('e=>document.activeElement===e')
    page.locator('#developer-save').dispatch_event('click');tick(page,100)
    return page.evaluate('JSON.parse(localStorage.getItem("codaQuietBellDeveloperProjectV1"))')

def no_physical_changes(actual,expected):
    assert physical(actual)==physical(expected)
    assert actual['scenes']==expected['scenes']
    for field in ['doors','sources','rooms','noteKinds','player','cast','authorMetadata']:
        assert actual[field]==expected[field],field

def assert_layout(page):
    data=page.evaluate('''()=>({width:innerWidth,height:innerHeight,docWidth:document.documentElement.scrollWidth,
      docHeight:document.documentElement.scrollHeight,bodyWidth:document.body.scrollWidth,
      editor:(()=>{const r=document.querySelector('#developer-console').getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};})()})''')
    assert data['docWidth']<=data['width']+1 and data['bodyWidth']<=data['width']+1 and data['docHeight']<=data['height']+1,data
    editor=data['editor'];assert editor['x']>=-1 and editor['y']>=-1 and editor['right']<=data['width']+1 and editor['bottom']<=data['height']+1,data
    assert page.locator(TEXT).get_attribute('maxlength')=='600'
    return data

def safe(page,errors,writes,external):
    ui.protected_storage(page);paths.no_errors(errors,writes,external)

def desktop_flow(browser,url,expected):
    context,page,errors,writes,external=ui.open_page(browser,url,1024,'dark',height=768)
    base=paths.validate_release(page,expected);normal=cs.normal_storage(page);resources=cs.conserved(page)
    project=fixture(page.evaluate('JSON.parse(JSON.stringify(quietBell.project))'))
    open_cutscene(page);tracks.import_project(page,project,'script-authoring-fixture');tick(page,70)
    assert script_indexes(page)==[4,5,3],script_indexes(page)
    assert page.locator(TEXT).input_value()==by_id(project,'first')['text']
    assert page.locator('[data-dialogue-speaker="nell"]').get_attribute('aria-pressed')=='true'
    # Save must flush even if a host invokes the action before native blur.
    text_a='A pending sentence survives Save project.'
    page.locator(TEXT).fill(text_a);saved=save_pending(page)
    assert by_id(saved,'first')['text']==text_a
    no_physical_changes(saved,project)
    # Export gets the current focused buffer, and preserves independent actor ownership.
    tools=page.locator('#developer-console details.dc-tools')
    if not tools.evaluate('e=>e.open'):tools.locator('summary').click()
    text_b='A second pending sentence survives Export project.'
    page.locator(TEXT).fill(text_b)
    exported=export_project(page,'pending-export',dispatch=True)
    assert by_id(exported,'first')['text']==text_b
    assert by_id(exported,'first')['actor']=='iris'
    no_physical_changes(exported,project)
    voice(page,'mira');spoken=export_project(page,'speaker-edit')
    assert by_id(spoken,'first')['speaker']=='mira' and by_id(spoken,'first')['actor']=='iris'
    assert by_id(spoken,'first')['author']==by_id(project,'first')['author']
    # The immediate click target must survive the textarea's blur commit.
    text_c='The clicked next line must not disappear during this commit.'
    page.locator(TEXT).fill(text_c);select(page,5)
    assert page.locator(TEXT).input_value()==by_id(project,'middle')['text']
    committed=export_project(page,'line-selection-commit')
    assert by_id(committed,'first')['text']==text_c
    # An external NPC click must survive pending text, too, without a frozen-map rebuild eating the event.
    pending_actor='This pending observation survives selecting Pip on the actual map.'
    page.locator(TEXT).fill(pending_actor)
    page.locator('#room-map [data-person="pip"]').click();tick(page,70)
    assert selected_index(page)==3 and page.locator('[data-dialogue-speaker="pip"]').get_attribute('aria-pressed')=='true'
    assert page.locator('[data-dev-tab="cutscene"]').get_attribute('aria-selected')=='true'
    assert not page.locator('.cutscene-path-overlay').count()
    after_actor=export_project(page,'pending-actor-click')
    assert by_id(after_actor,'middle')['text']==pending_actor
    pending_room='This pending line also survives a room-card switch.'
    page.locator(TEXT).fill(pending_room)
    page.locator('[data-dev-room="garden-porch"]').click();tick(page,70)
    page.locator('[data-dev-room="depot"]').click();tick(page,70)
    assert by_id(export_project(page,'pending-room-switch'),'late')['text']==pending_room
    # Reorder speech chronologically; its raw IDs/metadata and all physical rows survive.
    select(page,3);before_reorder=export_project(page,'before-reorder')
    page.locator('#developer-cutscene-dialogue-up').click();tick(page,80)
    assert script_indexes(page)==[4,3,5]
    reordered=export_project(page,'reordered')
    assert [by_id(reordered,name)['startTile'] for name in ['first','late','middle']]==[10,22,40]
    no_physical_changes(reordered,project)
    project_action(page,'undo')
    assert export_project(page,'undo-reorder')==before_reorder
    project_action(page,'redo')
    assert export_project(page,'redo-reorder')==reordered
    project_action(page,'undo')
    select(page,4);page.locator('#developer-cutscene-dialogue-add').click();tick(page,70)
    added=export_project(page,'added-line');new=[clip for clip in records(added) if clip['id'].startswith('dialogue-')]
    assert len(new)==1 and new[0]['kind']=='dialogue' and new[0]['text']==''
    new_id=new[0]['id'];assert new[0]['startTile']==22 and new[0]['durationTiles']>1
    line_text='Pip can add a newly authored response here.'
    page.locator(TEXT).fill(line_text);voice(page,'pip')
    filled=export_project(page,'added-line-filled');assert by_id(filled,new_id)['text']==line_text and by_id(filled,new_id)['speaker']=='pip'
    no_physical_changes(filled,project)
    page.locator('#developer-cutscene-dialogue-remove').click();tick(page,70)
    removed=export_project(page,'removed-line');assert not any(clip['id']==new_id for clip in records(removed))
    assert len(records(removed))==len(records(project))
    project_action(page,'undo')
    assert export_project(page,'undo-remove')==filled
    project_action(page,'redo')
    assert export_project(page,'redo-remove')==removed
    # Timeline still edits the same physical rows; returning to Dialogue keeps script selection.
    cs.select_timeline_mode(page)
    assert page.locator('#developer-cutscene-timeline').is_visible()
    assert page.locator('.cse-clip[data-cutscene-kind="walk"]').count()==1
    page.locator('#developer-cutscene-mode-dialogue').click();tick(page,60)
    select(page,3);page.locator('#developer-cutscene-dialogue-preview').click();tick(page,120)
    preview=cs.cutscene(page);assert preview and preview['preview'] and preview['beat']['id']=='late',preview
    assert preview['beat']['speaker']=='pip'
    page.locator('#developer-cutscene-dialogue-stop').click();tick(page,60)
    assert not cs.live_cutscene(page)
    # Focused Apply flushes the last draft and actual speech uses that exact edit.
    select(page,4);page.screenshot(path=str(OUT/'desktop-dialogue-editor.png'))
    final_text='This edited scene line is now spoken during the playtest.'
    page.locator(TEXT).fill(final_text)
    page.locator('#developer-apply').dispatch_event('click')
    page.locator('#developer-console').wait_for(state='hidden');ui.skip_intro(page)
    for _ in range(60):
        value=cs.cutscene(page)
        if value and value.get('beat'):break
        tick(page,100)
    value=cs.cutscene(page)
    assert ui.state(page)['developerMode'] and value['beat']['id']=='first' and value['beat']['text']==final_text,value
    assert value['beat']['speaker']=='mira'
    assert by_id(page.evaluate('quietBell.project'),'first')['actor']=='iris'
    no_physical_changes(page.evaluate('quietBell.project'),project)
    assert cs.normal_storage(page)==normal and cs.conserved(page)==resources
    page.screenshot(path=str(OUT/'desktop-edited-playtest.png'))
    ui.skip_cutscene(page);page.locator('#developer-end').click();tick(page,80)
    assert not ui.state(page)['developerMode'] and cs.normal_storage(page)==normal
    safe(page,errors,writes,external);context.close()
    return {'releaseBase':base,'chronologicalScript':True,'pendingSaveExportApply':True,
            'speakerIndependentOfActor':True,'realClickAfterTyping':True,'actorSelectsSpeaker':True,
            'addRemoveReorderUndoRedo':True,'physicalTracksAndMetadataUnchanged':True,'editedPlaytestSpeech':True,'normalSaveBytesUntouched':True}

def phone_flow(browser,url,expected,width):
    context,page,errors,writes,external=ui.open_page(browser,url,width,'light')
    base=paths.validate_release(page,expected);normal=cs.normal_storage(page)
    open_cutscene(page,True);layout=assert_layout(page)
    rows=page.locator('[data-cutscene-dialogue-index]');assert rows.count()>=6
    rows.nth(1).tap();tick(page,50)
    text='A phone can edit this line without changing the walking.'
    page.locator(TEXT).fill(text)
    rows=page.locator('[data-cutscene-dialogue-index]');rows.nth(2).tap();tick(page,70)
    assert page.locator('[data-cutscene-dialogue-index][aria-pressed="true"]').get_attribute('data-cutscene-dialogue-index')==rows.nth(2).get_attribute('data-cutscene-dialogue-index')
    project=export_project(page,f'phone-{width}-script')
    assert any(clip.get('text')==text for clip in records(project))
    page.locator('#developer-cutscene-dialogue-add').tap();tick(page,60)
    page.locator(TEXT).fill('A newly added phone line.');voice(page,'mira',True)
    page.locator('#developer-cutscene-dialogue-remove').tap();tick(page,60)
    project_action(page,'undo',True)
    assert page.locator(TEXT).input_value()=='A newly added phone line.'
    assert_layout(page);page.screenshot(path=str(OUT/f'dialogue-{width}.png'))
    cs.select_timeline_mode(page,True)
    assert page.locator('#developer-cutscene-scroll').is_visible()
    page.locator('#developer-cutscene-mode-dialogue').tap();tick(page,60)
    assert page.locator('#developer-cutscene-dialogue').is_visible()
    assert cs.normal_storage(page)==normal
    safe(page,errors,writes,external);context.close()
    return {'releaseBase':base,'width':width,'layout':layout,'touchSelectEditAddDeleteUndo':True,
            'dialogueAndTimelineAvailable':True,'noOverflow':True,'normalSaveBytesUntouched':True}

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
                    'phones':[phone_flow(runner,url,args.expect_release,width) for width in [390,320]]}
            browser.close()
        result['seconds']=round(time.monotonic()-started,1);name='public' if args.url else 'source' if args.source else 'launcher'
        (OUT/(name+'-results.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2),flush=True)
    finally:
        if server:server.shutdown()

if __name__=='__main__':main()
