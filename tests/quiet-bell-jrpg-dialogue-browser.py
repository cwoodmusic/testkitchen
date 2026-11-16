"""Pixel-font dialogue reveals existing glyph rows without rebuilding their DOM."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work/jrpg-dialogue';OUT.mkdir(parents=True,exist_ok=True)
HTML='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/games/rhythm-blocks/style.css"><link rel="stylesheet" href="/games/rhythm-blocks/cutscene.css"><link rel="stylesheet" href="/games/rhythm-blocks/jrpg-dialogue.css"><div id="quiet-bell"><section class="cutscene-panel"><header><strong id="cutscene-speaker">Nell</strong><span id="cutscene-counter">The Parcel Depot</span></header><p id="cutscene-line"></p><div class="cutscene-buttons"><button class="mg-button">Skip</button><button class="mg-button">1×</button><button class="mg-button mg-primary">Next ›</button></div></section></div><script type="module">import{createJrpgDialogue}from'/games/rhythm-blocks/jrpg-dialogue.mjs';window.dialogue=createJrpgDialogue({panel:document.querySelector('.cutscene-panel'),line:document.querySelector('#cutscene-line')});window.text='The seal is still warm. How did this letter return before we had even finished sorting the morning post?';dialogue.setLine(text);await document.fonts.ready;window.ready=true;</script>'''
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass

def main():
 server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);checks=[]
   for width,height in [(1024,768),(390,844),(320,568)]:
    page=browser.new_page(viewport={'width':width,'height':height});errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.route('**/__jrpg_fixture__.html',lambda route:route.fulfill(content_type='text/html',body=HTML));page.goto(f'http://127.0.0.1:{server.server_port}/__jrpg_fixture__.html');page.wait_for_function('window.ready');page.wait_for_timeout(50)
    initial=page.evaluate('dialogue.state');assert initial['visibleCharacters']==1 and not initial['complete'],initial
    assert 'QuietBellBlock' in page.locator('#cutscene-line').evaluate('e=>getComputedStyle(e).fontFamily')
    assert page.evaluate('document.fonts.check("20px QuietBellBlock")')
    assert page.locator('.jrpg-glyph-row').first.inner_text().startswith('NELL: ')
    assert page.locator('#cutscene-line').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)')>= (20 if width>760 else 18 if width>360 else 16)
    heights=page.locator('.cutscene-panel').evaluate('e=>e.getBoundingClientRect().height')
    page.evaluate('window.rows=[...document.querySelectorAll(".jrpg-glyph-row")];window.childChanges=0;window.watch=new MutationObserver(es=>childChanges+=es.filter(e=>e.type==="childList").length);watch.observe(document.querySelector("#cutscene-line"),{childList:true,subtree:true});dialogue.update(500)')
    middle=page.evaluate('dialogue.state');assert 1<middle['visibleCharacters']<middle['totalCharacters'] and not middle['complete'],middle
    page.evaluate('dialogue.update(600)');page.wait_for_timeout(10)
    assert page.evaluate('childChanges')==0,'Revealing characters must retain the already laid-out glyph DOM.'
    assert page.evaluate('rows.every((r,i)=>r===document.querySelectorAll(".jrpg-glyph-row")[i])')
    assert abs(page.locator('.cutscene-panel').evaluate('e=>e.getBoundingClientRect().height')-heights)<.1
    page.evaluate('dialogue.update(50)');assert page.evaluate('dialogue.state.visibleCharacters')==2
    page.evaluate('dialogue.revealAll()');assert page.evaluate('dialogue.state.complete')
    page.evaluate('dialogue.update(0)');assert page.evaluate('dialogue.state.complete'),'Manual reveal survives a paused/earlier time until the next caption.'
    page.evaluate('watch.disconnect();dialogue.setLine("Hi, there!");dialogue.update(100)');assert page.evaluate('dialogue.state.visibleCharacters')==3
    page.evaluate('dialogue.update(183)');assert page.evaluate('dialogue.state.visibleCharacters')==3
    page.evaluate('dialogue.update(202)');assert page.evaluate('dialogue.state.visibleCharacters')==5
    page.evaluate('dialogue.setLine(Array(10).fill("A curious bird carries a folded note through the warm room.").join(" "));dialogue.update(100000)')
    assert page.evaluate('dialogue.state.complete') and page.locator('#cutscene-line').evaluate('e=>e.scrollTop>0')
    page.set_viewport_size({'width':max(300,width-20),'height':height});page.wait_for_timeout(100);assert page.evaluate('dialogue.state.complete')
    rect=page.locator('.cutscene-panel').bounding_box();assert rect['x']>=0 and rect['x']+rect['width']<=page.viewport_size['width']+1,rect
    assert page.locator('[aria-live="polite"]').count()==1
    page.screenshot(path=str(OUT/f'dialogue-{width}.png'));assert not errors,errors
    checks.append({'width':width,'blockPixelFont':True,'speakerPrefix':True,'punctuationCadence':True,'typewriter':True,'revealAll':True,'noRowRebuild':True,'heightStable':True,'longTextScroll':True,'resize':True});page.close()
   browser.close()
  (OUT/'results.json').write_text(json.dumps({'passed':True,'checks':checks},indent=2)+'\n');print(json.dumps({'passed':True,'checks':checks}))
 finally:server.shutdown()
if __name__=='__main__':main()
