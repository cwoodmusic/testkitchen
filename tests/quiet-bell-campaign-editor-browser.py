"""Exercise authoring every campaign location, including walkable outcomes.

This focused console fixture uses the shipped project and validation. Actual map
pointer selection is covered by quiet-bell-developer-browser.py.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = '''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/games/rhythm-blocks/style.css">
<link rel="stylesheet" href="/games/rhythm-blocks/developer-console.css">
<div id="quiet-bell"><main style="position:absolute;inset:0;background:#332536"></main></div>
<script type="module">
import {createDefaultProject,validateProject} from '/games/rhythm-blocks/developer-project.mjs';
import {createDeveloperConsole} from '/games/rhythm-blocks/developer-console.mjs';
let project=createDefaultProject();
if(new URLSearchParams(location.search).has('legacy')){
 project.settings.terminalRooms=false;project.settings.completionReady=false;
 for(const id of Object.keys(project.terminals)){delete project.content[id];delete project.scenes[id];}
}
window.initial=structuredClone(project);window.draft=project;window.saved=null;window.selected=null;window.teleported=null;window.playtest=null;
window.testState={developerMode:true,phase:'room',roomId:'depot',inventory:structuredClone(project.settings.initialInventory)};
window.consoleUI=createDeveloperConsole({getProject:()=>project,getState:()=>window.testState,
 onOpen:()=>document.getElementById('quiet-bell').classList.add('developer-editing'),
 onClose:()=>document.getElementById('quiet-bell').classList.remove('developer-editing'),
 onDraftChange:value=>window.draft=value,onSelectRoom:id=>window.selected=id,
 onSaveProject:value=>{project=value;window.saved=value;},
 onPlaytest:(value,options)=>{window.playtest={project:value,options};},
 onTeleport:id=>{window.teleported=id;window.testState.roomId=id;}});
window.validation=validateProject(project);window.consoleUI.open({roomId:'depot',personId:'nell'});window.ready=true;
</script>'''


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def change(page, selector, value):
    field = page.locator(selector)
    field.fill(value)
    field.dispatch_event('change')


def tab(page, name):
    page.locator('[data-dev-tab="' + name + '"]').click()


def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            page = browser.new_page(viewport={'width':1024, 'height':768})
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.route('**/__campaign_editor_fixture__.html*', lambda route: route.fulfill(content_type='text/html', body=FIXTURE))
            url = f'http://127.0.0.1:{server.server_port}/__campaign_editor_fixture__.html'
            page.goto(url)
            page.wait_for_function('window.ready')
            assert page.evaluate('window.validation.valid'), page.evaluate('window.validation.errors')
            assert page.locator('#developer-room-cards [data-dev-room]').count() == 23
            assert page.locator('#developer-console select').count() == 0
            assert page.locator('#developer-console').evaluate('element=>!element.matches(":modal")')
            content = page.evaluate('window.initial.content')
            appearances = 0
            for room, entry in content.items():
                for person in entry['people']:
                    page.evaluate('([room,id])=>window.consoleUI.open({roomId:room,personId:id})', [room, person['id']])
                    assert page.locator('[data-dev-room="' + room + '"]').get_attribute('aria-pressed') == 'true'
                    assert page.locator('#developer-intro').input_value() == person.get('intro', person['story'])
                    appearances += 1
                tab(page, 'puzzles')
                if room.startswith(('ending-', 'dead-')):
                    assert page.locator('#developer-door-recipe').count() == 0
                    assert 'This route ends here' in page.locator('#developer-body').inner_text()
                tab(page, 'notes')
            # Terminal edits mutate the terminal record, its content and its scene.
            page.locator('[data-dev-room="ending-home"]').click()
            tab(page, 'rooms')
            change(page, '#developer-room-title', 'Our shared courtyard')
            change(page, '#developer-room-arrival', 'The four friends arrive together.')
            change(page, '#developer-outcome-heading', 'A light left on')
            change(page, '#developer-outcome-copy', 'A table is waiting for the next traveler.')
            assert page.locator('#developer-start-room [data-dev-choice]').count() == 14
            assert page.locator('#developer-start-room [data-dev-choice="ending-home"]').count() == 0
            page.locator('#developer-save').click()
            page.wait_for_function('window.saved!==null')
            for field in ['terminals', 'content', 'scenes']:
                assert page.evaluate(f'window.saved.{field}["ending-home"].title') == 'Our shared courtyard'
            assert page.evaluate('window.saved.terminals["ending-home"].text') == 'A table is waiting for the next traveler.'
            # Every terminal observation can be selected directly and authored.
            prop = content['ending-home']['inspections'][0]['id']
            page.evaluate('(id)=>window.consoleUI.open({roomId:"ending-home",objectId:id})', prop)
            change(page, '#developer-lore-text', 'A familiar coat hangs beside the doorway.')
            assert page.evaluate('window.draft.content["ending-home"].inspections[0].text') == 'A familiar coat hangs beside the doorway.'
            # Explicit map selections clear the current search and any lore selection.
            page.locator('#developer-search').fill('canary')
            page.evaluate('window.consoleUI.open({roomId:"ending-home",personId:"pip"})')
            assert page.locator('#developer-search').input_value() == ''
            assert page.locator('#developer-intro').count() == 1
            page.locator('#developer-add-reply').click()
            change(page, '#developer-reply-label', 'Will we visit again?')
            change(page, '#developer-reply-text', 'The courtyard always has room for us.')
            # Search finds authored terminal replies and moves the actual map there.
            page.locator('[data-dev-room="depot"]').click()
            page.locator('#developer-search').fill('courtyard always has room')
            page.locator('.dc-search-result').click()
            assert page.evaluate('window.selected') == 'ending-home'
            assert page.locator('#developer-reply-text').input_value() == 'The courtyard always has room for us.'
            # Search also resolves terminal lore to its observation inspector.
            page.locator('#developer-search').fill('familiar coat')
            page.locator('.dc-search-result').click()
            assert page.locator('#developer-lore-text').input_value() == 'A familiar coat hangs beside the doorway.'
            page.locator('[data-dev-room="dead-brambles"]').click()
            tab(page, 'rooms')
            change(page, '#developer-outcome-repair', 'Revisit the porch and ask Iris about her gift.')
            assert page.evaluate('window.draft.terminals["dead-brambles"].repair') == 'Revisit the porch and ask Iris about her gift.'
            # Terminal live travel is available, without duplicated destinations.
            tab(page, 'playtest')
            assert page.locator('#developer-live-room [data-dev-choice]').count() == 23
            page.locator('#developer-live-room [data-dev-choice="dead-echo"]').click()
            page.locator('#developer-teleport').click()
            page.wait_for_function('window.teleported==="dead-echo"')
            assert 'The Copied Waterway' in page.locator('.dc-live-state').inner_text()
            page.locator('[data-dev-room="ending-secret-birds"]').click()
            page.locator('#developer-start-playtest').click()
            page.wait_for_function('window.playtest!==null')
            assert page.evaluate('window.playtest.options.roomId') == 'ending-secret-birds'
            assert not page.locator('#developer-console').is_visible()
            # Explicit legacy mode keeps terminal destinations out of room/travel cards.
            page.goto(url + '?legacy')
            page.wait_for_function('window.ready')
            assert page.evaluate('window.validation.valid'), page.evaluate('window.validation.errors')
            assert page.locator('#developer-room-cards [data-dev-room]').count() == 14
            tab(page, 'playtest')
            assert page.locator('#developer-live-room [data-dev-choice]').count() == 14
            assert not errors, errors
            print(json.dumps({'passed':True, 'locations':23, 'characterSelections':appearances,
                              'terminalTitleAndOutcomeEdits':True, 'terminalLoreAndReplies':True,
                              'terminalSearchAndTeleport':True, 'legacyMode':True, 'errors':errors}))
            browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
