"""Urban buildings share editor/game interactions and leave saved towns intact."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        context = browser.new_context(viewport={'width':1600, 'height':1100})
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(base+'/town/builder/')
        page.wait_for_function('!!window.townBuilder', timeout=60000)
        fixture = page.evaluate('''()=>{
          const objects=['coda-residences','coda-furnishings'].map((asset,i)=>({id:'urban-'+i,asset,x:5000+i*5000,y:6500,scale:1,rotation:0,collision:true,layer:'objects'}));
          const a=townBuilder.catalog.get(objects[0].asset);if(!a?.urban)throw Error('Tower missing from shared catalog');
          const spawn={x:objects[0].x+a.door.x-a.w/2,y:objects[0].y+a.door.y-a.h+40};
          return {version:1,name:'Urban preservation fixture',cells:{},edges:{},objects,spawn};
        }''')
        page.locator('#file').set_input_files({'name':'urban.json', 'mimeType':'application/json', 'buffer':json.dumps(fixture).encode()})
        page.wait_for_function('townBuilder.project.name==="Urban preservation fixture"')
        page.wait_for_function('document.getElementById("status").textContent.startsWith("Saved in this browser")')
        saved = page.evaluate('JSON.stringify(townBuilder.project)')
        page.locator('#search').fill('Coda')
        assert page.locator('[data-asset="coda-residences"]').count() == 1
        assert page.locator('[data-asset="coda-furnishings"]').count() == 1
        page.screenshot(path=str(ROOT/'docs/town-preview/urban-builder-assets.png'))
        page.locator('#walk').click()
        page.keyboard.press('e')
        page.wait_for_function('townBuilder.urban.scene?.kind==="lobby"')
        page.screenshot(path=str(ROOT/'docs/town-preview/urban-lobby.png'))
        # Every adjacent storey is connected by a real stair interaction.
        for floor in range(1,15):
            page.evaluate('''async()=>{
              const {getInterior}=await import('/town/world/urban-interiors.mjs?v=collision-layers-1');
              const z=getInterior(townBuilder.urban.scene).zones.find(z=>z.action==='stairs-up');
              if(!z)throw Error('Upstairs connection missing');townBuilder.urban.player.x=z.x+z.w/2;townBuilder.urban.player.y=z.y+z.h/2;
            }''')
            page.keyboard.press('e')
            page.wait_for_function('(floor)=>townBuilder.urban.scene?.floor===floor', arg=floor+1)
        page.evaluate('''async()=>{
          const {getInterior}=await import('/town/world/urban-interiors.mjs?v=collision-layers-1');
          const z=getInterior(townBuilder.urban.scene).zones.find(z=>z.action==='stairs-down');
          townBuilder.urban.player.x=z.x+z.w/2;townBuilder.urban.player.y=z.y+z.h/2;
        }''')
        page.keyboard.press('e')
        page.wait_for_function('townBuilder.urban.scene?.floor===14')
        page.evaluate('townBuilder.urban.goFloor(1)')
        # Real floor picker exposes every storey. The floor15 door leads home.
        page.get_by_role('button', name='Floor directory', exact=True).click()
        assert page.locator('.urban-floors button').count() == 15
        page.locator('.urban-floors button').filter(has_text='15  Your apartment').click()
        page.wait_for_function('townBuilder.urban.scene?.floor===15')
        page.evaluate('''async()=>{
          const {getInterior}=await import('/town/world/urban-interiors.mjs?v=collision-layers-1');
          const z=getInterior(townBuilder.urban.scene).zones.find(z=>z.action==='room'&&z.resident==='player');
          if(!z)throw Error('Player door missing');townBuilder.urban.player.x=z.x+z.w/2;townBuilder.urban.player.y=z.y+z.h/2;
        }''')
        page.keyboard.press('e')
        page.wait_for_function('townBuilder.urban.scene?.resident==="player"')
        page.screenshot(path=str(ROOT/'docs/town-preview/urban-apartment.png'))
        page.get_by_role('button', name='Go outside', exact=True).click()
        assert not page.evaluate('townBuilder.urban.active')
        page.locator('#walk').click()
        assert page.evaluate('JSON.stringify(townBuilder.project)') == saved, 'Interior preview changed saved map'
        # The tour is generated separately, with no write to current builder data.
        page.locator('#urbanTour').click()
        page.wait_for_function('!!window.townGame', timeout=60000)
        assert page.evaluate('townGame.project.name') == 'Coda Town · Urban District'
        page.get_by_role('button', name='Town Builder', exact=True).click()
        page.wait_for_function('window.townBuilder?.project.name==="Urban preservation fixture"', timeout=60000)
        assert page.evaluate('JSON.stringify(townBuilder.project)') == saved, 'Tour replaced saved builder map'
        # Normal authored play retains friendship locks; a received invitation opens it.
        page.locator('#play').click()
        page.wait_for_function('!!window.townGame', timeout=60000)
        page.keyboard.press('e')
        page.wait_for_function('townGame.urban.scene?.kind==="lobby"')
        page.evaluate('townGame.urban.goFloor(2)')
        resident = page.evaluate('''async()=>{
          const {getInterior}=await import('/town/world/urban-interiors.mjs?v=collision-layers-1');
          const z=getInterior(townGame.urban.scene).zones.find(z=>z.action==='room');
          townGame.urban.player.x=z.x+z.w/2;townGame.urban.player.y=z.y+z.h/2;return z.resident;
        }''')
        page.keyboard.press('e')
        assert page.locator('.urban-dialog').is_visible()
        assert 'friendship to level 5' in page.locator('.urban-dialog').inner_text()
        assert page.evaluate('townGame.urban.scene.kind') == 'hall'
        page.get_by_role('button', name='Close', exact=True).click()
        page.evaluate('''id=>window.postMessage({type:'coda-town-state-result',people:[{id,relationship:{count:5}}]},location.origin)''', resident)
        page.wait_for_timeout(80)
        page.keyboard.press('e')
        page.wait_for_function('(id)=>townGame.urban.scene?.resident===id', arg=resident)
        page.get_by_role('button', name='Town Builder', exact=True).click()
        page.wait_for_function('window.townBuilder?.project.name==="Urban preservation fixture"', timeout=60000)
        # Store entry works through the same E interaction in builder preview.
        page.evaluate('''()=>{
          const d=townBuilder.project,o=d.objects.find(o=>o.asset==='coda-furnishings'),a=townBuilder.catalog.get(o.asset);
          d.spawn={x:o.x+a.door.x-a.w/2,y:o.y+a.door.y-a.h+40};
        }''')
        page.locator('#walk').click()
        page.keyboard.press('e')
        page.wait_for_function('townBuilder.urban.scene?.kind==="shop"')
        page.screenshot(path=str(ROOT/'docs/town-preview/urban-showroom.png'))
        page.get_by_role('button', name='Browse furniture', exact=True).click()
        assert page.locator('.urban-catalog button').count() >= 30
        item = page.evaluate('CodaFurnitureCatalog.reduce((best,item)=>item.price<best.price?item:best)')
        balance = page.evaluate('JSON.parse(localStorage.getItem("codaNotesWalletV1"))?.balance??150')
        page.locator('.urban-catalog button').filter(has_text=item['name']).click()
        page.get_by_role('button', name=f"Buy · {item['price']} Notes", exact=True).click()
        page.wait_for_function('(id)=>JSON.parse(localStorage.getItem("codaNotesWalletV1")).owned.includes(id)', arg=item['id'])
        assert page.evaluate('JSON.parse(localStorage.getItem("codaNotesWalletV1")).balance') == balance-item['price']
        page.get_by_role('button', name='Close', exact=True).click()
        # The same purchase becomes an item in the actual furnishing UI.
        page.evaluate('townBuilder.urban.goFloor(15);townBuilder.urban.openRoom("player")')
        page.get_by_role('button', name='Furnish apartment', exact=True).click()
        page.locator('.urban-catalog button').filter(has_text=item['name']).click()
        point = page.evaluate('''async item=>{
          const {getInterior,apartmentDecorBounds}=await import('/town/world/urban-interiors.mjs?v=collision-layers-1');
          const {roomItemBoxes}=await import('/town/world/urban-room.mjs?v=collision-layers-1');
          const scene=townBuilder.urban.scene,a=townBuilder.catalog.get(item.asset),solids=getInterior(scene).solids;
          const hit=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
          for(const b of apartmentDecorBounds(scene))for(let y=b.y+a.h+24;y<b.y+b.h-32;y+=32)for(let x=b.x+a.w/2+24;x<b.x+b.w-a.w/2-24;x+=32){
            const boxes=roomItemBoxes({asset:item.asset,x,y},townBuilder.catalog);
            if(boxes.some(box=>solids.some(s=>hit(box,s))))continue;
            townBuilder.urban.player.x=x;townBuilder.urban.player.y=y+160;return {x,y};
          }throw Error('No open furnishing space');
        }''', item)
        page.wait_for_timeout(80)
        canvas = page.locator('#map').bounding_box()
        view = page.evaluate('townBuilder.urban.view')
        page.mouse.click(canvas['x']+canvas['width']/2+(point['x']-view['x'])*view['zoom'], canvas['y']+canvas['height']/2+(point['y']-view['y'])*view['zoom'])
        page.wait_for_function('townBuilder.urban.decor.length===1')
        assert page.evaluate('JSON.parse(localStorage.getItem("codaUrbanRoomV1")).items[0].item') == item['id']
        page.screenshot(path=str(ROOT/'docs/town-preview/urban-furnishing.png'))
        # A direct town tab must not adopt the origin's active classroom wallet.
        private_before = page.evaluate('({wallet:localStorage.getItem("codaNotesWalletV1"),room:localStorage.getItem("codaUrbanRoomV1")})')
        page.evaluate('localStorage.setItem("codaClassroomWorkspaceV1",JSON.stringify({version:1,private:true}))')
        page.goto(base+'/town/')
        page.wait_for_function('!!window.townGame', timeout=60000)
        page.evaluate('townGame.urban.showShop()')
        assert 'Open town from the arcade' in page.locator('.urban-dialog').inner_text()
        assert page.evaluate('({wallet:localStorage.getItem("codaNotesWalletV1"),room:localStorage.getItem("codaUrbanRoomV1")})') == private_before
        assert not errors, errors
        browser.close()
finally:
    server.shutdown()

print('Urban browser checks passed: E entry, 15 floors, saved-map preservation, furniture purchase, Notes debit, inventory, and saved room placement.')
