"""Map recovery and save-preservation browser regression.

Run: python tests/town-map-recovery-browser.py --map project.json
Uses an isolated browser profile and never changes the source project file.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.request import urlopen
from urllib.error import HTTPError
import argparse
import hashlib
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--map',type=Path,default=ROOT/'town/maps/coda-town-uploaded-3.json')
parser.add_argument('--url',help='Optional published builder URL')
parser.add_argument('--screenshots',type=Path)
args=parser.parse_args()
source_bytes=args.map.read_bytes();source=json.loads(source_bytes)
source_hash=hashlib.sha256(source_bytes).hexdigest()

class Cases(list):
 def append(self,value):
  super().append(value);print('PASS',value,flush=True)
 def extend(self,values):
  for value in values:self.append(value)

class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass

server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()

SEED='''async text=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('coda-town-builder',1);r.onupgradeneeded=()=>r.result.createObjectStore('maps');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise((resolve,reject)=>{const tx=db.transaction('maps','readwrite'),s=tx.objectStore('maps');s.clear();if(text!==null)s.put(text,'current');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();}'''
READ='''async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('coda-town-builder',1);r.onupgradeneeded=()=>r.result.createObjectStore('maps');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const result=await new Promise((resolve,reject)=>{const tx=db.transaction('maps'),s=tx.objectStore('maps'),r=s.get('current');r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>reject(r.error);});db.close();return result;}'''

try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':1500,'height':1000},accept_downloads=True)
  if args.url:
   # Use the environment's verified HTTPS client without weakening Chromium's TLS checks.
   def production(route):
    try:
     with urlopen(route.request.url,timeout=45) as response:
      route.fulfill(status=response.status,headers={'content-type':response.headers.get('content-type','application/octet-stream')},body=response.read())
    except HTTPError as error:route.fulfill(status=error.code,body=error.read())
   context.route('https://cwoodmusic.github.io/**',production)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  builder=args.url or f'http://127.0.0.1:{server.server_port}/town/builder/'
  page.goto(builder,timeout=120000);page.wait_for_function('!!window.townBuilder',timeout=120000)
  results=Cases()
  def load(text):
   page.evaluate(SEED,text);page.goto(builder,timeout=120000);page.wait_for_function('!!window.townBuilder',timeout=120000)
  def raw():return page.evaluate(READ)
  def storage_url():
   return page.evaluate('''()=>{const app=new URL(document.querySelector('script[type="module"]').src);return new URL('../world/storage.mjs'+app.search,app).href;}''')
  # The existing save and all raw bytes must survive a normal startup.
  original=source_bytes.decode('utf-8');load(original)
  assert page.evaluate('townBuilder.project')==source
  assert raw()==original
  results.append('existing town restored without changing saved bytes')
  page.goto(builder+('&' if '?' in builder else '?')+'storageProbe=version-change',timeout=120000)
  page.wait_for_function('!!window.townBuilder',timeout=120000)
  assert page.evaluate('townBuilder.project')==source and raw()==original
  results.append('cache-busted URL uses the same saved town')

  # A normal edit saves the exact previous town and a bounded history. These
  # use the production storage module against real IndexedDB transactions.
  snapshots=page.evaluate("""async url=>{
   const m=await import(url),db=await m.openDatabase(),doc=structuredClone(townBuilder.project);
   doc.name='Recovery revision 1';await m.saveProject(db,doc);
   const first=await m.getSavedProjects(db);
   const noChange=await m.saveProject(db,doc),same=await m.getSavedProjects(db);
   for(let i=2;i<=5;i++){doc.name='Recovery revision '+i;await m.saveProject(db,doc);}
   const bounded=await m.getSavedProjects(db),selected=bounded.backups[1],restored=await m.restoreProject(db,selected.key),after=await m.getSavedProjects(db);
   db.close();return {first:first.backups.map(r=>r.text),noChange,sameCount:same.backups.length,bounded:bounded.backups.map(r=>r.name),selected:selected.name,restored:restored.name,after:after.backups.map(r=>r.name),current:after.current.name};
  }""",storage_url())
  assert snapshots['first']==[original]
  assert snapshots['noChange']['changed'] is False and snapshots['sameCount']==1
  assert snapshots['bounded']==['Recovery revision 4','Recovery revision 3','Recovery revision 2']
  assert snapshots['restored']==snapshots['selected']==snapshots['current']
  assert 'Recovery revision 5' in snapshots['after'] and len(snapshots['after'])==3
  results.extend(['previous town preserved before edit','unchanged save does not duplicate backup','history bounded to three snapshots','restoring a backup preserves replaced current'])

  rollback=page.evaluate("""async url=>{
   const m=await import(url),db=await m.openDatabase(),before=await m.getSavedProjects(db),old=IDBObjectStore.prototype.put;
   let rejected=false;
   try{
    IDBObjectStore.prototype.put=function(value,key){if(key==='current')throw new DOMException('Injected quota failure','QuotaExceededError');return old.call(this,value,key);};
    try{await m.saveProject(db,{...townBuilder.project,name:'Must not commit'});}catch{rejected=true;}
   }finally{IDBObjectStore.prototype.put=old;}
   const after=await m.getSavedProjects(db);db.close();return {rejected,unchanged:JSON.stringify(before)===JSON.stringify(after)};
  }""",storage_url())
  assert rollback=={'rejected':True,'unchanged':True}
  results.append('failed replacement rolls back both current and backups')

  page.reload();page.wait_for_function('!!window.townBuilder',timeout=120000)
  assert page.evaluate('townBuilder.project.name')==snapshots['restored']
  page.locator('#recover').click();page.locator('#recoveryPanel').wait_for(state='visible')
  page.locator('#savedBackups button').filter(has_text='Restore Recovery revision 5').click()
  page.wait_for_function('townBuilder.project.name==="Recovery revision 5"')
  page.locator('#undo').click();page.wait_for_function('townBuilder.project.name==="Recovery revision 3"')
  page.wait_for_timeout(500)
  assert json.loads(raw())['name']=='Recovery revision 3'
  results.append('browser backup restore remains undoable')

  def recover_url():return builder+('&' if '?' in builder else '?')+'recover=uploaded-3'
  def saved_records():
   return page.evaluate("""async url=>{const m=await import(url),db=await m.openDatabase();try{return await m.getSavedProjects(db);}finally{db.close();}}""",storage_url())
  def downloaded(selector):
   with page.expect_download() as download:page.locator(selector).click()
   return Path(download.value.path()).read_bytes()

  # A recovery link must never silently replace a valid, more recent local town.
  newer=json.loads(original);newer['name']='Later browser edits';newer['objects'][0]['x']+=16
  newer_text=json.dumps(newer,separators=(',',':'));load(newer_text)
  page.goto(recover_url(),timeout=120000);page.wait_for_function('!!window.townBuilder',timeout=120000)
  assert page.evaluate('townBuilder.project')==newer and raw()==newer_text
  assert page.locator('#recoveryPanel').is_visible()
  uploaded_download=downloaded('#downloadUploaded')
  assert hashlib.sha256(uploaded_download).hexdigest()==source_hash
  results.extend(['recovery URL protects newer existing town','uploaded JSON download matches exact backup bytes'])

  # Failed startup must leave the stored bytes unchanged through edits and Play.
  malformed='  {"name":"My missing work","objects":[ broken'
  load(malformed)
  assert page.evaluate('townBuilder.recovery.writeBlocked')
  assert page.locator('#recoveryPanel').is_visible()
  page.locator('#name').fill('A blank tab must not replace my town');page.locator('#name').dispatch_event('change')
  page.wait_for_timeout(600)
  assert raw()==malformed
  page.locator('#play').click();page.wait_for_timeout(200)
  assert '/builder/' in page.url and raw()==malformed
  assert downloaded('#downloadStored')==malformed.encode()
  results.extend(['malformed save blocks autosave and Play overwrite','unreadable saved bytes download intact'])
  page.locator('#recoverUploaded').click();page.wait_for_function('townBuilder.project.objects.length===120',timeout=120000)
  assert page.evaluate('townBuilder.project')==source and not page.evaluate('townBuilder.recovery.writeBlocked')
  assert json.loads(raw())==source
  assert any(r['text']==malformed for r in saved_records()['backups'])
  results.append('explicit uploaded recovery preserves unreadable original')

  unsupported=json.loads(original);unsupported['objects'][0]['asset']='future-asset-not-in-this-catalog'
  unsupported_text=json.dumps(unsupported,separators=(',',':'));load(unsupported_text)
  assert page.evaluate('townBuilder.recovery.writeBlocked')
  page.locator('#name').fill('Do not replace unknown-asset town');page.locator('#name').dispatch_event('change')
  page.wait_for_timeout(600);page.locator('#play').click();page.wait_for_timeout(200)
  assert raw()==unsupported_text and '/builder/' in page.url
  assert downloaded('#downloadStored')==unsupported_text.encode()
  results.append('catalog validation failure also preserves original save')

  page.evaluate(SEED,None);page.goto(recover_url(),timeout=120000)
  page.wait_for_function('window.townBuilder?.project.objects.length===120',timeout=120000)
  assert page.evaluate('townBuilder.project')==source and json.loads(raw())==source
  assert page.evaluate('townBuilder.cam.zoom')<.1
  results.append('empty browser restores uploaded town and frames full map')
  blank={'version':1,'name':'My Coda Town','cells':{},'edges':{},'objects':[],'spawn':{'x':8192,'y':6144}}
  page.evaluate(SEED,json.dumps(blank));page.goto(recover_url(),timeout=120000)
  page.wait_for_function('window.townBuilder?.project.objects.length===120',timeout=120000)
  assert page.evaluate('townBuilder.project')==source
  assert any(json.loads(r['text'])==blank for r in saved_records()['backups'])
  results.append('blank browser save recovers without losing its prior bytes')
  if args.screenshots:
   args.screenshots.mkdir(parents=True,exist_ok=True)
   page.screenshot(path=str(args.screenshots/'recovered-town.png'))

  # Storage-disabled browsers can still open/export the portable uploaded map.
  memory=browser.new_context(viewport={'width':1500,'height':1000},accept_downloads=True)
  if args.url:memory.route('https://cwoodmusic.github.io/**',production)
  memory.add_init_script("Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){throw new DOMException('Storage blocked','SecurityError');}}});")
  memory_page=memory.new_page();memory_page.on('pageerror',lambda e:errors.append(str(e)))
  memory_page.goto(recover_url(),timeout=120000);memory_page.wait_for_function('!!window.townBuilder',timeout=120000)
  assert memory_page.evaluate('townBuilder.recovery.writeBlocked')
  memory_page.locator('#recoverUploaded').click()
  memory_page.wait_for_function('townBuilder.project.objects.length===120',timeout=120000)
  assert memory_page.evaluate('townBuilder.project')==source
  assert memory_page.evaluate('townBuilder.recovery.writeBlocked')
  with memory_page.expect_download() as download:memory_page.locator('#save').click()
  assert json.loads(Path(download.value.path()).read_bytes())==source
  assert 'Browser storage is unavailable' in memory_page.locator('#status').inner_text()
  results.append('storage-disabled browser can open and export full map in memory')
  memory.close()
  assert hashlib.sha256(args.map.read_bytes()).hexdigest()==source_hash
  assert not errors,errors
  print(json.dumps({'cases':results,'sourceObjects':len(source['objects']),'sourceUnchanged':True,'errors':errors}),flush=True)
  browser.close()
finally:server.shutdown()
