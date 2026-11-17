"""Walk to the travelling cast, use occasional authored gifts, and inspect framing.

Inputs are actual pointer/touch/keyboard events. The live game is read-only to
these checks; virtual time merely advances its own animation-frame callbacks.
"""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import importlib.util
import json
import math

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'work/spacious-party'
OUT.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('quiet_bell_ui', ROOT / 'tests/rhythm-blocks-browser.py')
ui = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ui)
MEMBERS = {'nell', 'iris', 'pip'}
SIZES = [(320,568), (390,844), (1024,768), (1366,768), (1024,480)]
BRANCHES = [
    {'route':'garden', 'room':'garden-porch', 'source':'iris-gift', 'giver':'iris', 'recipe':['half','half-rest']},
    {'route':'workshop', 'room':'workshop-porch', 'source':'pip-gift', 'giver':'pip', 'recipe':['half','eighth-pair','sixteenth-group']},
    {'route':'canal', 'room':'canal-porch', 'source':'canal-chest', 'giver':None, 'recipe':['half','quarter','eighth-pair']},
]
OCCASIONS = {'depot': {'nell':'nell-parcel'}, 'garden-porch': {'iris':'iris-gift'},
             'workshop-porch': {'pip':'pip-gift'}, 'canal-porch': {}}


def contract(page):
    return page.evaluate('''async()=>{
      const {SCENES}=await import(new URL('scenes.mjs',document.baseURI));
      const {getRoomPeople}=await import(new URL('party-content.mjs',document.baseURI));
      return Object.fromEntries(Object.entries(SCENES).map(([id,scene])=>[id,{scene,people:getRoomPeople(id)}]));
    }''')


def ids(records):
    return {item if isinstance(item,str) else item['id'] for item in records}


def wait_cast_art(page):
    page.evaluate(r'''async()=>{
      const urls=[...new Set([...document.querySelectorAll('.mg-npc,#player-sprite')].flatMap(e=>{
        const match=getComputedStyle(e).backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
        return match?[match[1]]:[];
      }))];
      await Promise.all(urls.map(src=>new Promise((resolve,reject)=>{
        const image=new Image();image.onload=()=>image.decode().then(resolve,reject);image.onerror=()=>reject(new Error('Cast artwork failed to load'));image.src=src;
      })));
    }''')


def immutable_cast(page, room, data):
    """Equal-size actors must remain at their own foot coordinates and depths."""
    ui.skip_cutscene(page)
    wait_cast_art(page)
    expected = MEMBERS | ({'oren'} if room == 'canal-porch' else set())
    actors = page.locator('.mg-npc[data-actor]')
    actual = actors.evaluate_all('es=>es.map(e=>e.dataset.actor)')
    assert set(actual) == expected and len(actual) == len(expected), (room, actual)
    assert set(page.locator('[data-person]').evaluate_all('es=>es.map(e=>e.dataset.person)')) == expected
    assert {person['id'] for person in data[room]['people']} == expected
    # Entrances may leave a companion beside an examined prop. The displayed
    # feet, collision and interactions must agree with that actual staged room.
    scene = page.evaluate('quietBell.scene') or data[room]['scene']
    geometry = scene['geometry']
    targets = {item['id']: item for item in geometry['targets']}
    actor_data = {item['id']: item for item in scene['actors']}
    assert set(actor_data) == expected
    values = actors.evaluate_all('''es=>es.map(e=>{
      const r=e.getBoundingClientRect(),map=document.getElementById('room-map').getBoundingClientRect(),s=getComputedStyle(e);
      return{id:e.dataset.actor,left:parseFloat(e.style.left),top:parseFloat(e.style.top),z:parseFloat(e.style.zIndex||s.zIndex),
        worldWidth:r.width/map.width*1536,worldHeight:r.height/map.height*1024,
        art:(e.currentSrc||s.backgroundImage)+'|'+s.backgroundPosition};
    })''')
    assert len({item['art'] for item in values}) == len(expected), 'Each named companion needs its own actual artwork.'
    for value in values:
        model = actor_data[value['id']]
        assert model['character'] == value['id']
        assert abs(value['left']/100*1536 - model['feet']['x']) < 1
        assert abs(value['top']/100*1024 - model['feet']['y']) < 1
        assert value['z'] == math.floor(model['feet']['y'] + .5) + 1, (model,value)
        assert 145 <= value['worldWidth'] <= 165, 'Characters stay small relative to the expanded room.'
        target = targets[value['id']]
        assert math.hypot(target['x']-model['feet']['x'],target['y']-model['feet']['y']) < 3
    assert max(value['worldWidth'] for value in values) - min(value['worldWidth'] for value in values) < 2, 'Orthographic actors keep the same size at different floor depths.'
    mira = page.locator('#player-sprite').bounding_box()
    room_box = page.locator('#room-map').bounding_box()
    assert 145 <= mira['width']/room_box['width']*1536 <= 165
    return {'room':room,'people':sorted(expected),'equalActorScale':True,'feetAligned':True,'separateArt':True}


def framing(page, room, data):
    ui.close_panels(page)
    results = []
    for width,height in SIZES:
        page.set_viewport_size({'width':width,'height':height})
        page.wait_for_timeout(80)
        if page in ui.VIRTUAL_WALK_PAGES: page.clock.run_for(80)
        page.wait_for_function('[...document.images].every(i=>i.complete&&i.naturalWidth>0)')
        ui.layout(page, touch=True)
        rect = page.locator('#room-map').bounding_box()
        assert rect['y'] >= -1 and rect['y']+rect['height'] <= height+1
        if rect['width'] <= width+1: assert abs(rect['x']-(width-rect['width'])/2) < 1
        immutable_cast(page, room, data)
        page.screenshot(path=str(OUT/f'{room}-{width}-{height}.png'))
        results.append({'room':room,'width':width,'height':height,'fullRoomHeight':True,'noDocumentScroll':True})
    page.set_viewport_size({'width':1024,'height':768});page.wait_for_timeout(80)
    if page in ui.VIRTUAL_WALK_PAGES: page.clock.run_for(80)
    return results


def conversations(page, room, data, stories, touch=False):
    ui.skip_cutscene(page)
    start = ui.resources(ui.state(page))
    journal = page.evaluate('quietBell.journey')
    expected_nodes,expected_edges = ids(journal['nodes']),ids(journal['edges'])
    scene = page.evaluate('quietBell.scene') or data[room]['scene']
    targets = {item['id']:item for item in scene['geometry']['targets']}
    results = []
    for person in data[room]['people']:
        identifier = person['id']
        ui.press(page,'[data-person="'+identifier+'"]',touch)
        at = ui.walker(page);target=targets[identifier]
        assert math.hypot(at['x']-target['x'],at['y']-target['y']) <= target['range']+.1, (room,identifier,at,target)
        assert not at['moving'] and page.locator('#conversation-dialog').is_visible()
        authored_source = OCCASIONS[room].get(identifier)
        assert page.locator('#take-parcel').is_visible() == bool(authored_source), (room, identifier)
        if authored_source:
            assert page.locator('#take-parcel').is_enabled() == (authored_source not in ui.state(page)['claimedSources'])
        messages = set()
        for topic in ['story','route','inventory']:
            ui.press(page,'[data-topic="'+topic+'"]',touch)
            message = page.locator('#dialogue').inner_text().strip()
            assert message and identifier in page.locator('#speaker').inner_text().lower()
            if not (room=='depot' and identifier=='nell' and topic=='inventory'):
                assert message == person[topic], (room,identifier,topic,message)
            messages.add(message)
            assert ui.resources(ui.state(page)) == start, 'Conversations cannot create notes, spend a lock or alter source claims.'
        assert len(messages) == 3
        if identifier in MEMBERS: stories[identifier][room] = person['story']
        ui.press(page,'[data-topic="route"]',touch);ui.press(page,'#demo',touch)
        assert ui.resources(ui.state(page)) == start
        after = page.evaluate('quietBell.journey')
        assert ids(after['nodes']) == expected_nodes and ids(after['edges']) == expected_edges
        hint = identifier+'-route' if room=='depot' else room+'-'+identifier+'-route'
        assert hint in ids(after['hints']), 'Only the companion clue read is recorded.'
        assert after['achievements'] == []
        results.append({'room':room,'person':identifier,'threeTopics':True,'noAutomaticReward':True,'giftAvailable':bool(authored_source)})
    # A remembered companion conversation restores in the same room without opening a dialog.
    ui.close_panels(page)
    before=ui.resources(ui.state(page));selected=ui.state(page)['selectedPerson'];topic=ui.state(page)['selectedTopic']
    page.reload();page.wait_for_function('!!window.quietBell?.state')
    page.wait_for_function('[...document.images].every(i=>i.complete&&i.naturalWidth>0)')
    assert ui.resources(ui.state(page)) == before
    assert ui.state(page)['selectedPerson']==selected and ui.state(page)['selectedTopic']==topic
    assert page.locator('#conversation-dialog').is_hidden()
    immutable_cast(page,room,data)
    return results


def flow(browser,url):
    context,page,errors,writes,external=ui.open_page(browser,url,390,'light')
    data=contract(page);stories={member:{} for member in MEMBERS};rooms=[];frames=[];talks=[];gifts=[]
    assert ui.state(page)['inventory']==ui.EMPTY
    rooms.append(immutable_cast(page,'depot',data));frames.extend(framing(page,'depot',data))
    talks.extend(conversations(page,'depot',data,stories,touch=True))
    ui.collect_sources(page,touch=True)
    for branch in BRANCHES:
        ui.press(page,'[data-door="'+branch['route']+'"]',True);ui.build(page,branch['recipe'],True);ui.press(page,'#commit',True)
        room=branch['room'];carry=ui.INITIAL.copy()
        for kind in branch['recipe']:carry[kind]-=1
        assert ui.state(page)['roomId']==room and ui.state(page)['inventory']==carry
        assert ui.state(page)['currentRoomClaimedSources']==[]
        rooms.append(immutable_cast(page,room,data));frames.extend(framing(page,room,data))
        talks.extend(conversations(page,room,data,stories,touch=True))
        if branch['giver']:
            ui.press(page,'[data-person="'+branch['giver']+'"]',True)
            ui.press(page,'#take-parcel',True)
            ui.press(page,'[data-person="'+branch['giver']+'"]',True)
            assert page.locator('#take-parcel').is_disabled()
        else:
            ui.press(page,'[data-person="oren"]',True)
            assert page.locator('#take-parcel').is_hidden()
            ui.press(page,'[data-chest="canal-chest"]',True)
            assert page.locator('[data-chest="canal-chest"]').is_disabled()
        assert ui.state(page)['inventory']==ui.INITIAL
        assert ui.state(page)['currentRoomClaimedSources']==[branch['source']]
        before=ui.resources(ui.state(page));ui.close_panels(page)
        page.reload();page.wait_for_function('!!window.quietBell?.state')
        assert ui.resources(ui.state(page))==before
        gifts.append({'room':room,'source':branch['source'],'explicitOnly':True,'onceOnly':True})
        ui.press(page,'[data-return="return-depot"]',True)
        assert ui.state(page)['roomId']=='depot' and ui.state(page)['inventory']==ui.INITIAL
        assert set(ui.state(page)['claimedSources'])=={'nell-parcel','depot-chest'}
        immutable_cast(page,'depot',data)
    for member,records in stories.items():
        assert len(records)==4 and len(set(records.values()))==4, (member,records)
    assert ids(page.evaluate('quietBell.journey.nodes'))=={'depot','garden-porch','workshop-porch','canal-porch'}
    assert len(page.evaluate('quietBell.journey.edges'))==3
    assert page.evaluate('quietBell.journey.achievements')==[]
    ui.protected_storage(page)
    assert not errors and not writes and not external,(errors,writes,external)
    release=page.evaluate('document.baseURI')
    context.close()
    return {'passed':True,'releaseBase':release,'rooms':rooms,'dialogues':talks,'viewports':frames,'authoredGifts':gifts,
            'roomSpecificCompanionStories':True,'unearnedNotesNeverAwarded':True,'branchRewindExact':True,'errors':[]}


def native_mobile(browser,url):
    """Use normal time and touch to meet all three companions in a real room."""
    context,page,errors,writes,external=ui.open_page(browser,url,390,'dark',virtual_walk=False)
    data=contract(page);stories={member:{} for member in MEMBERS}
    ui.collect_sources(page,True)
    ui.press(page,'[data-door="garden"]',True);ui.build(page,['half','half-rest'],True);ui.press(page,'#commit',True)
    assert ui.state(page)['roomId']=='garden-porch'
    conversations(page,'garden-porch',data,stories,touch=True)
    ui.press(page,'[data-person="iris"]',True);ui.press(page,'#take-parcel',True)
    assert ui.state(page)['inventory']==ui.INITIAL
    ui.press(page,'[data-return="return-depot"]',True)
    assert ui.state(page)['roomId']=='depot' and ui.state(page)['inventory']==ui.INITIAL
    ui.layout(page,touch=True)
    assert not errors and not writes and not external,(errors,writes,external)
    page.screenshot(path=str(OUT/'native-mobile-party.png'))
    context.close()
    return {'passed':True,'touch':True,'nativeTime':True,'allThreeCompanions':True,'giftAndRewind':True}


def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(ui.Quiet,directory=str(ROOT)))
    Thread(target=server.serve_forever,daemon=True).start()
    try:
        with ui.sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
            url=f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/'
            result=flow(browser,url)
            result['nativeMobile']=native_mobile(browser,url)
            browser.close()
        (OUT/'browser-results.json').write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps(result,indent=2))
    finally:server.shutdown()

if __name__=='__main__':main()
