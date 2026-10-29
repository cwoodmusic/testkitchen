"""Keyboard-first local play notes and text exports in a disposable browser."""
import json
import mimetypes
from pathlib import Path
import sys
import unittest
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
BASE='https://cwoodmusic.github.io/coda-arcade/'
HARNESS='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="play-notebook.css"><style>body{background:#111;color:white;font:16px system-ui}</style>
<button id="launch">Keep playing</button><label>Other text <input id="other"></label><div id="editor" contenteditable="true">Edit here</div>
<script src="changelog-data.js"></script><script src="play-notebook.js"></script><script>
window.identity='a';window.allowed=true;window.opens=0;window.closes=[];window.unexpectedKeys=0;
window.notebook=CodaPlayNotebook.create({canOpen:()=>allowed,getIdentity:()=>identity,onOpen:()=>{opens++;},onClose:event=>closes.push(event.reason)});
addEventListener('keydown',event=>{if(event.key==='ArrowLeft')unexpectedKeys++;});launch.focus();
</script>'''

class PlayNotebookTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.p=sync_playwright().start();cls.browser=cls.p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 @classmethod
 def tearDownClass(cls):cls.browser.close();cls.p.stop()
 def setUp(self):
  self.context=self.browser.new_context(viewport={'width':1200,'height':900},accept_downloads=True)
  self.requests=[];self.errors=[]
  self.context.route('https://**/*',lambda route:route.abort());self.context.route(BASE+'**',self.route)
  self.page=self.context.new_page();self.page.on('pageerror',lambda error:self.errors.append(str(error)))
  self.page.on('request',lambda request:self.requests.append(request.url));self.page.goto(BASE+'notebook-test.html',wait_until='domcontentloaded')
 def route(self,route):
  name=urlparse(route.request.url).path.removeprefix('/coda-arcade/')
  if name=='notebook-test.html':return route.fulfill(status=200,content_type='text/html',body=HARNESS)
  file=(ROOT/name).resolve()
  if not file.is_relative_to(ROOT) or not file.is_file():return route.fulfill(status=404,body='Missing')
  route.fulfill(path=str(file),content_type=mimetypes.guess_type(str(file))[0] or 'application/octet-stream')
 def tearDown(self):self.context.close();self.assertEqual(self.errors,[])
 def state(self):return self.page.evaluate('notebook.getState()')
 def open(self):self.page.locator('#launch').focus();self.page.keyboard.press('p');self.assertTrue(self.state()['open'])
 def test_p_opens_autosaves_safe_text_and_escape_restores_focus(self):
  self.open();self.assertEqual(self.page.evaluate('document.activeElement.tagName'),'TEXTAREA')
  text='Please fix the door <img src=x onerror="alert(1)">\nFuture idea: café jazz'
  self.page.locator('.play-notebook-text').fill(text);self.page.keyboard.type(' p');self.page.wait_for_timeout(400)
  self.assertEqual(self.state()['text'],text+' p');self.assertTrue(self.state()['saved']);self.assertEqual(self.page.locator('.play-notebook img').count(),0)
  self.page.keyboard.press('ArrowLeft');self.assertEqual(self.page.evaluate('unexpectedKeys'),0)
  self.page.keyboard.press('Escape');self.assertFalse(self.state()['open']);self.assertEqual(self.page.evaluate('document.activeElement.id'),'launch')
  self.page.reload(wait_until='domcontentloaded');self.open();self.assertEqual(self.page.locator('.play-notebook-text').input_value(),text+' p')
  self.assertTrue(all(url.startswith(BASE) for url in self.requests),'Typing notes must not make network requests')
 def test_shortcut_leaves_other_typing_and_browser_print_alone(self):
  for selector in ['#other','#editor']:
   self.page.locator(selector).focus();self.page.keyboard.type('p');self.assertFalse(self.state()['open'])
  self.page.locator('#launch').focus()
  self.assertTrue(self.page.evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"p",ctrlKey:true,bubbles:true,cancelable:true}))'))
  self.assertFalse(self.state()['open']);self.page.evaluate('allowed=false');self.page.keyboard.press('p');self.assertFalse(self.state()['open'])
 def test_download_and_changelog_tabs_are_keyboard_accessible_and_fit_phones(self):
  self.page.set_viewport_size({'width':390,'height':844});self.open();text='Bug: late arrow\nIdea: another room';self.page.locator('.play-notebook-text').fill(text)
  with self.page.expect_download() as download:self.page.locator('[data-notebook-action="download"]').click()
  saved=download.value;self.assertEqual(saved.suggested_filename,'coda-arcade-play-notes.txt');self.assertEqual(Path(saved.path()).read_text(),'Coda Arcade — play notes\n\n'+text+'\n')
  self.page.locator('[data-notebook-tab="notes"]').focus();self.page.keyboard.press('ArrowRight')
  self.assertEqual(self.state()['tab'],'changelog');self.assertIn('Hard dance mode is now 88 BPM.',self.page.locator('.play-notebook-changelog').inner_text())
  self.page.keyboard.press('ArrowLeft');self.assertEqual(self.state()['tab'],'notes')
  self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
  self.page.locator('[data-notebook-action="download"]').focus();self.page.keyboard.press('Tab');self.assertEqual(self.page.evaluate('document.activeElement.getAttribute("aria-label")'),'Close play notes')
 def test_profile_changes_do_not_save_an_old_draft_to_the_new_player(self):
  self.open();self.page.locator('.play-notebook-text').fill('Old player unsaved')
  self.page.evaluate('identity="b";localStorage.setItem(CodaPlayNotebook.KEY,JSON.stringify({version:1,text:"New player",updatedAt:1}))')
  self.page.wait_for_timeout(400);self.assertEqual(self.page.evaluate('JSON.parse(localStorage.getItem(CodaPlayNotebook.KEY)).text'),'New player');self.assertFalse(self.state()['saved'])
  self.page.evaluate('notebook.close("profile");notebook.open()');self.assertEqual(self.page.locator('.play-notebook-text').input_value(),'New player')
 def test_unavailable_storage_shows_unsaved_status_and_still_exports_the_draft(self):
  self.page.evaluate('notebook.destroy();notebook=CodaPlayNotebook.create({storage:{getItem:()=>null,setItem(){throw Error("quota");}}})')
  self.open();self.page.locator('.play-notebook-text').fill('Keep this draft');self.page.wait_for_timeout(400)
  self.assertFalse(self.state()['saved']);self.assertIn('not saved',self.page.locator('.play-notebook-status').inner_text())
  self.page.keyboard.press('Escape');self.open();self.assertEqual(self.page.locator('.play-notebook-text').input_value(),'Keep this draft')
  with self.page.expect_download() as download:self.page.locator('[data-notebook-action="download"]').click()
  self.assertIn('Keep this draft',Path(download.value.path()).read_text())
 def test_preview_notes_explain_the_temporary_save(self):
  self.page.evaluate('notebook.destroy();notebook=CodaPlayNotebook.create({temporary:()=>true})')
  self.open();self.page.locator('.play-notebook-text').fill('Preview bug');self.page.wait_for_timeout(400)
  self.assertIn('Saved for this test session',self.page.locator('.play-notebook-status').inner_text())
  self.assertIn('Download a copy before leaving',self.page.locator('.play-notebook-help').inner_text())
 def test_notes_mount_inside_a_fullscreen_room_and_return_to_their_parent(self):
  self.page.evaluate('''()=>{const room=document.createElement('section');room.id='fullscreen-room';document.body.append(room);
    Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>window.fixtureFullscreen||null});
    window.fixtureFullscreen=room;
  }''')
  self.open();self.assertEqual(self.page.locator('.play-notebook-backdrop').evaluate('node=>node.parentElement.id'),'fullscreen-room')
  self.page.evaluate('fixtureFullscreen=null;document.dispatchEvent(new Event("fullscreenchange"))')
  self.assertEqual(self.page.locator('.play-notebook-backdrop').evaluate('node=>node.parentElement.tagName'),'BODY')
  self.page.keyboard.press('Escape');self.assertFalse(self.state()['open'])
 def test_native_modal_stays_above_fullscreen_canvas_and_high_editor_layers(self):
  if not self.page.evaluate('document.fullscreenEnabled'):self.skipTest('Native fullscreen unavailable')
  self.page.evaluate('''()=>{const canvas=document.createElement('canvas');canvas.id='fullscreen-canvas';canvas.tabIndex=0;document.body.append(canvas);
    launch.onclick=async()=>{await canvas.requestFullscreen();canvas.focus();};
  }''')
  self.page.locator('#launch').click();self.page.wait_for_function('document.fullscreenElement?.id==="fullscreen-canvas"')
  self.page.keyboard.press('p');self.assertTrue(self.state()['open']);self.assertTrue(self.page.locator('.play-notebook').evaluate('node=>node.matches(":modal")'))
  self.assertTrue(self.page.locator('.play-notebook').evaluate('node=>{const b=node.getBoundingClientRect();return node.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))}'))
  self.page.locator('[aria-label="Close play notes"]').click();self.page.evaluate('document.exitFullscreen()')
  self.page.evaluate('''()=>{const editor=document.createElement('div');editor.id='tall-editor';editor.style.cssText='position:fixed;inset:0;z-index:2147483000;background:red';document.body.append(editor);notebook.open();}''')
  self.assertTrue(self.page.locator('.play-notebook').evaluate('node=>{const b=node.getBoundingClientRect();return node.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))}'))

if __name__=='__main__':unittest.main(verbosity=2)
