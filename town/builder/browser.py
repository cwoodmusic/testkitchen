from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import threading,json,zipfile,io
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1500,'height':950});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/')
 page.wait_for_function('!!window.townBuilder')
 assert page.evaluate('townBuilder.project.objects.length')==0
 box=page.locator('#map').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
 page.locator('[data-asset="trees-0-480"]').click();page.mouse.click(x,y)
 assert page.evaluate('townBuilder.project.objects.length')==1
 page.locator('[data-tool="raise"]').click();page.mouse.click(x+130,y+100)
 assert page.evaluate('Object.values(townBuilder.project.cells).some(c=>c.level===1)')
 page.locator('[data-tool="fence"]').click();page.mouse.move(x-100,y+100);page.mouse.down();page.mouse.move(x+100,y+100,steps=12);page.mouse.move(x+100,y+180,steps=8);page.mouse.up()
 assert page.evaluate('Object.keys(townBuilder.project.edges).length')>3
 page.locator('#search').fill('ivy');page.locator('[data-asset="ivy-0"]').click();page.mouse.click(x,y+100)
 assert page.evaluate('townBuilder.project.objects.at(-1).layer')=='overgrowth'
 page.wait_for_function('document.querySelector("#status").textContent.startsWith("Saved")')
 with page.expect_download() as dl:page.locator('#save').click()
 data=json.loads(Path(dl.value.path()).read_text());assert len(data['objects'])==2
 page.reload();page.wait_for_function('window.townBuilder?.project.objects.length===2')
 data['name']='Imported town'
 page.locator('#file').set_input_files({'name':'town.json','mimeType':'application/json','buffer':json.dumps(data).encode()})
 page.wait_for_function('townBuilder.project.name==="Imported town"')
 page.locator('#file').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{"version":99}'})
 page.wait_for_function('document.querySelector("#status").textContent==="Invalid town project."')
 assert page.evaluate('townBuilder.project.name')=='Imported town'
 page.locator('#walk').click();page.keyboard.press('d');page.locator('#walk').click()
 with page.expect_download(timeout=120000) as dl:page.locator('#pack').click()
 z=zipfile.ZipFile(dl.value.path());assert 'catalog.json' in z.namelist();assert len(z.namelist())>70
 meta=json.loads(z.read('catalog.json'));assert len([a for a in meta if a['id'].startswith('decor-')])==256
 mounted=next(a for a in meta if a['id']=='cliff-lantern');assert mounted['mountDefault'];assert mounted['mountAnchor']['y']==mounted['height']/2
 page.locator('#search').fill('');page.locator('#category').select_option('trees')
 page.screenshot(path=str(ROOT/'docs/town-preview/builder.png'))
 assert not errors,errors
 browser.close()
server.shutdown();print('Builder browser checks passed: placement, terrain, connected fences, foliage, autosave, reload, project and PNG pack exports.')
