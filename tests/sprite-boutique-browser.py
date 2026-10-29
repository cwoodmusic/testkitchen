"""Exercise JavaScript-drawn characters and independent wardrobe controls.

Starts a temporary server and uses disposable Chromium profiles. Requires the
environment's Python Playwright package and Chromium; no external service access.
"""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from world_navigation_helpers import advance_world, enter_room, open_destination, talk_to_musician, open_settings, close_settings
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):
        pass


class SpriteBoutiqueTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.url=f'http://127.0.0.1:{cls.server.server_port}/world-preview.html'
        cls.playwright=sync_playwright().start()
        cls.browser=cls.playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.playwright.stop();cls.server.shutdown();cls.server.server_close()

    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1600,'height':1000})
        self.context.route('https://**/*',lambda route:route.abort())
        self.page=self.context.new_page();self.page.set_default_timeout(10000)
        self.errors=[];self.local_failures=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.on('console',lambda message:self.errors.append(message.text) if 'Arcade frame error:' in message.text else None)
        self.page.on('response',lambda response:self.local_failures.append(response.url) if response.status>=400 and '127.0.0.1' in response.url and not response.url.endswith('favicon.ico') else None)
        self.load()
        # The shipped FX switch keeps expensive room lights out of visual checks.
        open_settings(self.page)
        for _ in range(3):
            if self.page.locator('#fxBtn').inner_text().endswith('Off'):
                break
            self.page.locator('#fxBtn').click()
        self.assertTrue(self.page.locator('#fxBtn').inner_text().endswith('Off'))
        close_settings(self.page)

    def tearDown(self):
        errors,failures=self.errors[:],self.local_failures[:]
        self.context.close()
        self.assertEqual(errors,[],'Character page/frame errors')
        self.assertEqual(failures,[],'Failed local character resources')

    def load(self):
        self.page.goto(self.url,wait_until='domcontentloaded')
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready()')
        self.page.wait_for_function('window.CodaArcadeQA?.characters().spriteState?.ready===true',timeout=30000)

    def appearance(self,target='player'):
        return self.page.evaluate('''id=>{const characters=CodaArcadeQA.characters();return id==='player'?characters.player.appearance:characters.npcs.find(p=>p.id===id).appearance}''',target)

    def set_color(self,label,value):
        self.page.get_by_label(label,exact=True).evaluate('(input,value)=>{input.value=value;input.dispatchEvent(new Event("input",{bubbles:true}));}',value)

    def buy_fixture_items(self,*items):
        self.page.evaluate('''ids=>{
          const wallet=CodaNotesShop.createWallet({catalog:createCodaCharacterRenderer().catalog});
          wallet.grantReward('fixture:wardrobe-selection',1000);
          for(const id of ids){const result=wallet.buy(id);if(!result.ok)throw Error(result.error+' '+id);}
        }''',list(items))

    def open_boutique(self,target='player',developer=False):
        if target!='player' or developer:
            # NPC costuming is an explicit developer feature. Playtest keeps
            # the real developer console active while allowing counter E.
            self.page.evaluate("CodaDeveloperConsole.open('objects')")
            if not self.page.evaluate('CodaDeveloperConsole.getState().playtest'):
                self.page.locator('#devPlaytest').click()
        open_destination(self.page,'boutique')
        target_control=self.page.get_by_label('Customize',exact=True)
        if not target_control.is_disabled():target_control.select_option(target)
        else:self.assertEqual(target,'player')
        self.page.locator('#avatarPreviewMode').select_option('idle')

    def try_catalog_item(self,category,item):
        self.page.get_by_role('button',name='Browse '+category,exact=True).click()
        self.page.get_by_label('Search wardrobe',exact=True).fill(item)
        self.page.locator('.boutique-item[data-item-id="'+item+'"]').click()

    def test_guest_can_search_try_and_save_the_expanded_fantasy_collection(self):
        # This appearance test uses legitimately purchased items. The assembled
        # world tests cover the visible purchase flow and locked-item rejection.
        self.page.evaluate('''()=>{
          const wallet=CodaNotesShop.createWallet({catalog:createCodaCharacterRenderer().catalog});
          wallet.grantReward('fixture:completed-quests',1000);
          for(const id of ['witch','starglasses','wand','rollerskates','cheer','wizard','cateye','pearls','heels']){
            if(!wallet.buy(id).ok)throw Error('Could not prepare purchased cosmetic '+id);
          }
        }''')
        self.load()
        before=self.appearance();self.open_boutique()
        for category,item in [('Hats','witch'),('Glasses','starglasses'),('Accessories','wand'),
                              ('Shoes','rollerskates'),('Emotes','cheer')]:
            self.try_catalog_item(category,item)
        self.assertEqual(self.page.locator('#avatarPreviewMode').input_value(),'emote',
                         'Trying an emote must play it in the live preview')
        self.set_color('Hat color','#7863b8');self.set_color('Glasses color','#f0c460')
        self.assertEqual(self.appearance(),before,'Trying new collection items must not commit the draft')
        self.page.get_by_role('button',name='Save my look',exact=True).click()
        saved=self.appearance()
        for field,value in {'headwear':'witch','eyewear':'starglasses','accessory':'wand',
                            'shoes':'rollerskates','emote':'cheer','headwearColor':'#7863b8',
                            'eyewearColor':'#f0c460'}.items():
            self.assertEqual(saved[field],value,field)
        self.load();self.assertEqual(self.appearance(),saved)
        # A second chic/fantasy combination stays a draft when canceled.
        self.open_boutique()
        for category,item in [('Hats','wizard'),('Glasses','cateye'),('Accessories','pearls'),
                              ('Shoes','heels'),('Emotes','bow')]:
            self.try_catalog_item(category,item)
        self.page.get_by_role('button',name='Cancel',exact=True).click()
        self.assertEqual(self.appearance(),saved)
        self.load();self.assertEqual(self.appearance(),saved)

    def test_catalog_search_preserves_current_choice_and_native_controls_stay_in_sync(self):
        self.buy_fixture_items('wizard','witch')
        self.open_boutique();self.try_catalog_item('Hats','wizard')
        self.assertEqual(self.page.get_by_label('Hats',exact=True).input_value(),'wizard')
        self.page.get_by_label('Search wardrobe',exact=True).fill('witch')
        self.assertEqual(self.page.get_by_label('Hats',exact=True).input_value(),'wizard',
                         'Filtering choices must not replace the current hat')
        self.page.locator('.boutique-item[data-item-id="witch"]').click()
        self.assertEqual(self.page.get_by_label('Hats',exact=True).input_value(),'witch')
        self.page.get_by_label('Hats',exact=True).select_option('wizard')
        self.page.get_by_label('Search wardrobe',exact=True).fill('wizard')
        self.assertEqual(self.page.locator('.boutique-item[data-item-id="wizard"]').get_attribute('aria-pressed'),'true')
        self.page.get_by_label('Search wardrobe',exact=True).fill('no-such-style')
        self.assertEqual(self.page.locator('.boutique-item').count(),0)
        self.assertEqual(self.page.get_by_label('Hats',exact=True).input_value(),'wizard')
        self.page.get_by_role('button',name='Cancel',exact=True).click()

    def test_javascript_characters_render_directional_previews_without_sprite_assets(self):
        state=self.page.evaluate('CodaArcadeQA.characters().spriteState')
        self.assertEqual(state['mode'],'javascript-characters');self.assertTrue(state['ready'])
        self.open_boutique()
        views=self.page.locator('.avatar-preview-views canvas')
        self.assertEqual(views.count(),4)
        metrics=views.evaluate_all('''canvases=>canvases.map(canvas=>{
          const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
          let visible=0,topEdge=0;const colors=new Set();
          for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>200){visible++;colors.add(pixels[i]+','+pixels[i+1]+','+pixels[i+2]);if(i<canvas.width*4)topEdge++;}
          return {visible,colors:colors.size,topEdge};
        })''')
        for view in metrics:
            self.assertGreater(view['visible'],150,'Loaded sprite must contain visible artwork')
            self.assertGreater(view['colors'],8,'Pixel characters should retain distinct outline and shading colors')
            self.assertEqual(view['topEdge'],0,'Preview must fit the full head and hair, without clipping')
        self.assertGreater(len(set(views.evaluate_all('(canvases)=>canvases.map(canvas=>canvas.toDataURL())'))),2)
        self.page.locator('#avatarPreviewMode').select_option('walk')
        frames=[]
        for _ in range(5):
            frames.append(views.first.evaluate('(canvas)=>canvas.toDataURL()'))
            self.page.wait_for_timeout(160)
        self.assertGreater(len(set(frames)),1,'Walking must advance the JavaScript character pose')
        resources=self.page.evaluate('performance.getEntriesByType("resource").map(entry=>entry.name)')
        self.assertEqual([name for name in resources if '/assets/characters/' in name],[],
                         'JavaScript characters must not depend on sprite manifests or image layers')

    def test_new_guests_start_bald_in_gray_without_automatically_equipped_items(self):
        profile=self.appearance()
        for field,value in {'hairstyle':'bald','headwear':'none','eyewear':'none','accessory':'none','shirt':'#999ca6','lowerColor':'#626875','outfit':'pants','shoes':'sneakers'}.items():
            self.assertEqual(profile[field],value,field)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.characters().spriteState.base'),'bald-gray')
        self.open_boutique()
        for label,value in {'Hairstyle':'bald','Hats':'none','Glasses':'none','Accessories':'none','Outfit color':'#999ca6','Lower clothing color':'#626875'}.items():
            self.assertEqual(self.page.get_by_label(label,exact=True).input_value(),value,label)

    def test_plain_base_preset_is_draft_only_then_saves_bald_gray_without_losing_progress(self):
        self.page.emulate_media(reduced_motion='reduce')
        self.page.evaluate('''localStorage.setItem("musicArcadeV1",JSON.stringify({name:"Base Keeper",walked:600,collectedTokens:7,customized:true,
          hairstyle:"buns",hair:"#ece4d6",skin:"#704633",outfit:"overalls",shirt:"#4678ab",lowerColor:"#334c72",
          headwear:"cap",eyewear:"sunglasses",accessory:"headphones",shoes:"boots",emote:"dance"}))''')
        self.load();before=self.appearance();raw_before=self.page.evaluate('localStorage.getItem("musicArcadeV1")')
        self.assertEqual(before['headwear'],'cap','A deliberate saved cap must survive the default migration')
        self.open_boutique();self.page.get_by_role('button',name='Plain base avatar',exact=True).click()
        for label,value in {'Hairstyle':'bald','Hats':'none','Glasses':'none','Accessories':'none','Outfit':'pants','Outfit color':'#999ca6','Lower clothing color':'#626875','Shoes':'sneakers'}.items():
            self.assertEqual(self.page.get_by_label(label,exact=True).input_value(),value,label)
        self.assertEqual(self.appearance(),before,'The plain base remains a draft before Save')
        self.assertEqual(self.page.evaluate('localStorage.getItem("musicArcadeV1")'),raw_before)
        self.page.get_by_role('button',name='Save my look',exact=True).click();saved=self.appearance()
        for field,value in {'name':'Base Keeper','hairstyle':'bald','headwear':'none','eyewear':'none','accessory':'none','shirt':'#999ca6','lowerColor':'#626875','outfit':'pants','shoes':'sneakers'}.items():
            self.assertEqual(saved[field],value,field)
        self.assertEqual(self.page.evaluate('JSON.parse(localStorage.musicArcadeV1).collectedTokens'),7)
        self.assertEqual(self.page.evaluate('JSON.parse(localStorage.musicArcadeV1).walked'),600)
        self.load();self.assertEqual(self.appearance(),saved)

    def test_old_automatic_cap_migrates_but_explicit_saved_hats_still_load(self):
        old={'name':'Legacy Guest','skin':'#e5ad75','hair':'#171424','shirt':'#e94038','lowerColor':'#235cb9','hairstyle':'short','outfit':'pants','headwear':'cap','eyewear':'none','accessory':'none','shoes':'sneakers','emote':'wave','customized':False,'walked':710,'collectedTokens':9}
        self.page.evaluate('(profile)=>localStorage.setItem("musicArcadeV1",JSON.stringify(profile))',old);self.load()
        automatic=self.appearance();self.assertEqual(automatic['hairstyle'],'bald');self.assertEqual(automatic['headwear'],'none');self.assertEqual(automatic['shirt'],'#999ca6');self.assertEqual(automatic['name'],'Legacy Guest')
        old['customized']=True
        self.page.evaluate('(profile)=>localStorage.setItem("musicArcadeV1",JSON.stringify(profile))',old);self.load()
        explicit=self.appearance();self.assertEqual(explicit['headwear'],'cap');self.assertEqual(explicit['hairstyle'],'short');self.assertEqual(explicit['shirt'],'#e94038')
        self.assertEqual(self.page.evaluate('JSON.parse(localStorage.musicArcadeV1).collectedTokens'),9)

    def test_optional_classic_cap_look_previews_before_save_and_persists_after_reload(self):
        self.page.emulate_media(reduced_motion='reduce')
        self.page.evaluate('''localStorage.setItem("musicArcadeV1",JSON.stringify({name:"Preset Keeper",walked:600,collectedTokens:7,
          hairstyle:"buns",hair:"#ece4d6",skin:"#704633",outfit:"overalls",shirt:"#4678ab",lowerColor:"#334c72",
          headwear:"none",eyewear:"sunglasses",accessory:"headphones",shoes:"boots",emote:"dance"}))''')
        self.load();before=self.appearance()
        raw_before=self.page.evaluate('localStorage.getItem("musicArcadeV1")')
        self.open_boutique()
        preview=self.page.locator('.avatar-preview-views canvas').first
        self.page.wait_for_function('''()=>{const canvas=document.querySelector('.avatar-preview-views canvas');
          return canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some((value,index)=>index%4===3&&value>0)}''')
        before_pixels=preview.evaluate('(canvas)=>canvas.toDataURL()')
        self.page.get_by_role('button',name='Classic cap look',exact=True).click()
        self.page.wait_for_function('''before=>document.querySelector('.avatar-preview-views canvas').toDataURL()!==before''',arg=before_pixels)
        for label,value in {'Hairstyle':'short','Hair color':'#171424','Skin color':'#e5ad75','Outfit':'pants','Outfit color':'#e94038',
                            'Lower clothing color':'#235cb9','Hats':'cap','Glasses':'none','Accessories':'none','Shoes':'sneakers','Emote':'wave'}.items():
            self.assertEqual(self.page.get_by_label(label,exact=True).input_value(),value,label)
        self.assertEqual(self.page.get_by_label('Arcade nickname',exact=True).input_value(),'Preset Keeper')
        self.assertEqual(self.appearance(),before,'The preset must remain a draft until Save')
        self.assertEqual(self.page.evaluate('localStorage.getItem("musicArcadeV1")'),raw_before)
        self.page.get_by_role('button',name='Save my look',exact=True).click()
        saved=self.appearance()
        for field,value in {'name':'Preset Keeper','hairstyle':'short','hair':'#171424','skin':'#e5ad75','outfit':'pants','shirt':'#e94038',
                            'lowerColor':'#235cb9','headwear':'cap','eyewear':'none','accessory':'none','shoes':'sneakers','emote':'wave'}.items():
            self.assertEqual(saved[field],value,field)
        self.assertEqual(self.page.evaluate('JSON.parse(localStorage.musicArcadeV1).collectedTokens'),7)
        self.load();self.assertEqual(self.appearance(),saved)

    def test_player_can_save_hat_glasses_accessory_and_colors_together(self):
        self.page.emulate_media(reduced_motion='reduce')
        self.page.evaluate('localStorage.setItem("musicArcadeV1",JSON.stringify({name:"Guest",walked:600,collectedTokens:7}))')
        self.load();before=self.appearance();self.open_boutique()
        self.page.get_by_label('Arcade nickname',exact=True).fill('Layered Player')
        self.page.get_by_label('Hairstyle',exact=True).select_option('buns')
        self.page.get_by_label('Outfit',exact=True).select_option('overalls')
        self.page.get_by_label('Hats',exact=True).select_option('cap')
        self.page.get_by_label('Glasses',exact=True).select_option('sunglasses')
        self.page.get_by_label('Accessories',exact=True).select_option('headphones')
        self.set_color('Skin color','#704633');self.set_color('Hair color','#ece4d6')
        self.set_color('Outfit color','#4678ab');self.set_color('Lower clothing color','#334c72')
        self.assertEqual(self.appearance(),before,'Draft equipment must not apply before Save')
        self.page.get_by_role('button',name='Save my look',exact=True).click()
        saved=self.appearance()
        for field,value in {'name':'Layered Player','hairstyle':'buns','outfit':'overalls','headwear':'cap','eyewear':'sunglasses','accessory':'headphones','skin':'#704633','hair':'#ece4d6','shirt':'#4678ab','lowerColor':'#334c72'}.items():
            self.assertEqual(saved[field],value,field)
        self.assertEqual(self.page.evaluate('JSON.parse(localStorage.musicArcadeV1).collectedTokens'),7)
        self.load();self.assertEqual(self.appearance(),saved)
        self.open_boutique()
        self.assertEqual(self.page.get_by_label('Hats',exact=True).input_value(),'cap')
        self.assertEqual(self.page.get_by_label('Glasses',exact=True).input_value(),'sunglasses')
        self.assertEqual(self.page.get_by_label('Accessories',exact=True).input_value(),'headphones')

    def test_npc_costume_persists_without_changing_identity_or_player(self):
        self.page.emulate_media(reduced_motion='reduce')
        player_before=self.appearance();self.open_boutique('miles')
        self.assertFalse(self.page.get_by_label('Arcade nickname',exact=True).is_editable())
        self.assertEqual(self.page.get_by_label('Arcade nickname',exact=True).input_value(),'Miles Davis')
        self.page.get_by_label('Outfit',exact=True).select_option('coat')
        self.page.get_by_label('Hats',exact=True).select_option('beanie')
        self.page.get_by_label('Glasses',exact=True).select_option('partyglasses')
        self.page.get_by_label('Accessories',exact=True).select_option('headphones')
        self.set_color('Outfit color','#91558d');self.set_color('Lower clothing color','#273f59')
        self.page.get_by_role('button',name='Save NPC look',exact=True).click()
        saved=self.appearance('miles')
        self.assertEqual((saved['outfit'],saved['headwear'],saved['eyewear'],saved['accessory']),('coat','beanie','partyglasses','headphones'))
        self.assertEqual((saved['shirt'],saved['lowerColor']),('#91558d','#273f59'))
        self.assertEqual(self.appearance(),player_before)
        self.load()
        self.assertEqual(self.appearance('miles'),saved)
        identity=self.page.evaluate('CodaArcadeQA.characters().npcs.find(p=>p.id==="miles")')
        self.assertEqual((identity['id'],identity['name']),('miles','Miles Davis'))
        self.open_boutique('miles')
        self.assertEqual(self.page.get_by_label('Hats',exact=True).input_value(),'beanie')
        self.assertEqual(self.page.get_by_label('Glasses',exact=True).input_value(),'partyglasses')
        self.assertEqual(self.page.get_by_label('Accessories',exact=True).input_value(),'headphones')

    def test_cancel_and_target_switch_discard_drafts(self):
        self.page.emulate_media(reduced_motion='reduce')
        self.buy_fixture_items('crown')
        before=self.appearance();npc_before=self.appearance('miles')
        raw_before=self.page.evaluate('localStorage.getItem("musicArcadeV1")')
        self.open_boutique(developer=True)
        self.page.get_by_label('Hats',exact=True).select_option('crown')
        self.page.get_by_label('Glasses',exact=True).select_option('glasses')
        self.set_color('Skin color','#52372a')
        self.page.get_by_label('Customize',exact=True).select_option('miles')
        self.page.get_by_label('Outfit',exact=True).select_option('dress')
        self.page.get_by_label('Customize',exact=True).select_option('player')
        self.assertEqual(self.page.get_by_label('Hats',exact=True).input_value(),before['headwear'])
        self.page.get_by_role('button',name='Cancel',exact=True).click()
        self.assertFalse(self.page.locator('#panel').is_visible())
        self.assertEqual(self.appearance(),before);self.assertEqual(self.appearance('miles'),npc_before)
        self.assertEqual(self.page.evaluate('localStorage.getItem("musicArcadeV1")'),raw_before)


if __name__=='__main__':
    unittest.main(verbosity=2)
