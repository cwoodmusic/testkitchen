"""Real-world wardrobe locks and the Notes-only shop, with isolated storage."""
import importlib.util
from pathlib import Path
import unittest

from world_navigation_helpers import open_destination

_spec=importlib.util.spec_from_file_location('boutique_world',Path(__file__).with_name('learning-world-browser.py'))
_world=importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_world)


class BoutiqueLocksTests(_world.WorldBrowserCase):
    def load(self):
        if not getattr(self,'_preview_hooked',False):
            # Observe the real renderer's live-preview input, without replacing
            # the production ownership check or adding an avatar QA bypass.
            self.context.add_init_script('''(()=>{
              let factory;
              Object.defineProperty(window,'createCodaCharacterRenderer',{
                configurable:true,get:()=>factory,set:original=>{factory=(...args)=>{
                  const renderer=original(...args),draw=renderer.drawPlayer;
                  renderer.drawPlayer=function(context,profile,...rest){
                    if(context.canvas.closest('.avatar-preview-views'))
                      window.__lastBoutiquePreview={...profile};
                    return draw.call(this,context,profile,...rest);
                  };return renderer;
                };}
              });
            })()''')
            self._preview_hooked=True
        super().load()

    def wardrobe(self):
        open_destination(self.page,'boutique')
        self.page.locator('#avatarPreviewMode').select_option('idle')
        self.page.wait_for_function('window.__lastBoutiquePreview')

    def browse(self,category,query=''):
        self.page.get_by_role('button',name='Browse '+category,exact=True).click()
        self.page.get_by_label('Search wardrobe',exact=True).fill(query)

    def appearance(self):
        return self.page.evaluate('CodaArcadeQA.characters().player.appearance')

    def test_locked_items_are_grey_disabled_and_cannot_preview_or_save(self):
        before=self.appearance();self.wardrobe()
        targets=self.page.get_by_label('Customize',exact=True)
        self.assertTrue(targets.is_disabled())
        self.assertEqual(targets.locator('option').evaluate_all('(xs)=>xs.map(x=>x.value)'),['player'])
        self.browse('Hats','witch')
        tile=self.page.locator('.boutique-item[data-item-id="witch"]')
        self.assertTrue(tile.is_disabled())
        self.assertIn('🔒',tile.inner_text());self.assertIn('Buy with Notes',tile.inner_text())
        self.assertIn('witch',tile.get_attribute('aria-label').lower())
        self.assertEqual(tile.locator('canvas').count(),0,'Locked items never render a try-on thumbnail')
        self.assertIn('grayscale',tile.evaluate('(x)=>getComputedStyle(x).filter'))
        self.assertTrue(self.page.locator('#boutique-headwear option[value="witch"]').evaluate('(x)=>x.disabled'))
        # Native disabled controls block activation; even a stale raw draft is
        # sanitized before the real renderer can put it on the avatar.
        tile.evaluate('(x)=>x.click()')
        self.assertEqual(self.page.get_by_label('Hats',exact=True).input_value(),'none')
        self.page.get_by_label('Hats',exact=True).evaluate('(x)=>{x.value="witch";}')
        self.page.get_by_label('Glasses',exact=True).evaluate('(x)=>{x.value="partyglasses";}')
        self.page.wait_for_timeout(100)
        preview=self.page.evaluate('window.__lastBoutiquePreview')
        self.assertEqual(preview['headwear'],'none');self.assertEqual(preview['eyewear'],'none')
        self.page.get_by_role('button',name='Save my look',exact=True).click()
        status=self.page.locator('.boutique-actions [role="status"]').inner_text()
        self.assertIn('witch',status.lower());self.assertIn('Party glasses',status)
        self.assertIn('Buy with Notes',status);self.assertTrue(self.page.locator('#panel').is_visible())
        self.assertEqual(self.appearance(),before)
        self.page.locator('#boutique-headwear').evaluate('(x)=>{x.value="none";x.dispatchEvent(new Event("change"));}')
        self.page.locator('#boutique-eyewear').evaluate('(x)=>{x.value="none";x.dispatchEvent(new Event("change"));}')
        self.page.get_by_role('button',name='Cancel',exact=True).click()

    def test_purchase_unlocks_without_reload_and_owned_draft_survives_browsing(self):
        self.wardrobe();self.browse('Hats','witch')
        self.assertTrue(self.page.locator('[data-item-id="witch"]').is_disabled())
        self.page.get_by_role('button',name='Cancel',exact=True).click()
        open_destination(self.page,'shop')
        self.page.locator('[data-shop-item="witch"] button').click()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),70)
        self.assertIn('witch',self.page.evaluate('CodaArcadeQA.notes().owned'))
        self.wardrobe();self.browse('Hats','witch')
        self.assertFalse(self.page.locator('[data-item-id="witch"]').is_disabled())
        self.assertFalse(self.page.locator('#boutique-headwear option[value="witch"]').evaluate('(x)=>x.disabled'))
        self.page.locator('[data-item-id="witch"]').click()
        self.page.get_by_label('Glasses',exact=True).select_option('sunglasses')
        self.browse('Shoes');self.browse('Hats','witch')
        self.assertEqual(self.page.get_by_label('Hats',exact=True).input_value(),'witch')
        self.assertEqual(self.page.get_by_label('Glasses',exact=True).input_value(),'sunglasses')
        self.page.wait_for_function('window.__lastBoutiquePreview.headwear==="witch"&&window.__lastBoutiquePreview.eyewear==="sunglasses"')
        self.page.get_by_role('button',name='Save my look',exact=True).click()
        self.assertFalse(self.page.locator('#panel').is_visible())
        self.assertEqual(self.appearance()['headwear'],'witch')
        self.assertEqual(self.appearance()['eyewear'],'sunglasses')
        self.load();self.assertEqual(self.appearance()['headwear'],'witch')

    def test_achievement_and_level_unlocks_refresh_the_open_boutique(self):
        self.wardrobe()
        self.page.get_by_label('Hats',exact=True).select_option('cap')
        self.page.get_by_label('Glasses',exact=True).select_option('sunglasses')
        self.browse('Hats','triadchampion')
        self.assertTrue(self.page.locator('[data-item-id="triadchampion"]').is_disabled())
        self.assertTrue(self.page.locator('#boutique-headwear option[value="beret"]').evaluate('(x)=>x.disabled'))
        result=self.page.evaluate('''()=>{
          const earned=CodaPlayerProgression.create();
          const achievement=earned.recordAchievement('triad-hard-advanced-win');
          const level=earned.awardXP('fixture:completed-lessons',200,'Completed lessons');
          return {achievement:achievement.ok,level:level.level};
        }''')
        self.assertTrue(result['achievement']);self.assertGreaterEqual(result['level'],3)
        self.page.wait_for_function('!document.querySelector("[data-item-id=triadchampion]").disabled')
        self.assertFalse(self.page.locator('#boutique-headwear option[value="beret"]').evaluate('(x)=>x.disabled'))
        self.assertEqual(self.page.get_by_label('Hats',exact=True).input_value(),'cap')
        self.assertEqual(self.page.get_by_label('Glasses',exact=True).input_value(),'sunglasses')
        self.page.locator('[data-item-id="triadchampion"]').click()
        self.page.get_by_role('button',name='Save my look',exact=True).click()
        self.assertEqual(self.appearance()['headwear'],'triadchampion')

    def test_locked_dj_gear_shows_its_dance_goal_and_keeps_the_notes_purchase_path(self):
        before=self.appearance()
        saved=self.page.evaluate('''()=>({wallet:localStorage.getItem('codaNotesWalletV1'),
          progression:localStorage.getItem('codaPlayerProgressV1')})''')
        self.wardrobe()
        for category,item,goal in [('Glasses','shutter','20 steps'),
                                   ('Shoes','rollerskates','without a wrong or extra arrow'),
                                   ('Accessories','boombox','Hard DJ line dance')]:
            with self.subTest(item=item):
                self.browse(category,item)
                tile=self.page.locator('[data-item-id="'+item+'"]')
                self.assertTrue(tile.is_disabled())
                self.assertIn(goal,tile.locator('small').inner_text())
                self.assertIn('buy with Notes',tile.locator('small').inner_text())
        self.page.get_by_role('button',name='Cancel',exact=True).click()
        open_destination(self.page,'shop')
        for item in ['shutter','rollerskates','boombox']:
            card=self.page.locator('[data-shop-item="'+item+'"]')
            self.assertEqual(card.count(),1)
            self.assertTrue(card.locator('button').is_enabled())
            self.assertIn('Buy',card.locator('button').inner_text())
        self.assertEqual(self.appearance(),before)
        self.assertEqual(self.page.evaluate('''()=>({wallet:localStorage.getItem('codaNotesWalletV1'),
          progression:localStorage.getItem('codaPlayerProgressV1')})'''),saved,
          'Browsing either path must not award experience, spend Notes, or invent ownership.')

    def test_purchased_dj_gear_stays_equipable_without_dance_achievements(self):
        self.page.evaluate('''()=>{
          localStorage.setItem('codaNotesWalletV1',JSON.stringify({version:1,balance:150,
            earned:500,spent:350,owned:['shutter','rollerskates','boombox'],rewards:[]}));
          localStorage.removeItem('codaPlayerProgressV1');
        }''')
        self.load()
        before=self.appearance()
        saved=self.page.evaluate('''()=>({wallet:localStorage.getItem('codaNotesWalletV1'),
          progression:localStorage.getItem('codaPlayerProgressV1')})''')
        self.wardrobe()
        for category,item in [('Glasses','shutter'),('Shoes','rollerskates'),('Accessories','boombox')]:
            self.browse(category,item)
            tile=self.page.locator('[data-item-id="'+item+'"]')
            self.assertTrue(tile.is_enabled())
            tile.click()
        self.assertEqual(self.appearance(),before,'Trying purchased gear only changes the wardrobe draft.')
        self.assertEqual(self.page.evaluate('''()=>({wallet:localStorage.getItem('codaNotesWalletV1'),
          progression:localStorage.getItem('codaPlayerProgressV1')})'''),saved)
        self.page.get_by_role('button',name='Save my look',exact=True).click()
        for slot,item in [('eyewear','shutter'),('shoes','rollerskates'),('accessory','boombox')]:
            self.assertEqual(self.appearance()[slot],item)
        self.assertFalse(self.page.evaluate('''()=>JSON.parse(localStorage.getItem('codaPlayerProgressV1')||'{"events":[]}')
          .events.some(event=>event.id.startsWith('achievement:dance-'))'''))

    def test_saved_dance_achievements_unlock_dj_gear_without_a_purchase_or_auto_equipping(self):
        self.page.evaluate('''()=>{
          localStorage.setItem('codaPlayerProgressV1',JSON.stringify({version:1,xp:500,
            events:[{id:'achievement:dance-twenty-streak',xp:100},
              {id:'achievement:dance-perfect-set',xp:150},
              {id:'achievement:dance-hard-perfect',xp:250}]}));
        }''')
        self.load()
        before=self.appearance()
        self.assertEqual(before['eyewear'],'none')
        self.assertEqual(before['shoes'],'sneakers')
        self.assertEqual(before['accessory'],'none')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().owned'),[])
        saved=self.page.evaluate('''()=>({wallet:localStorage.getItem('codaNotesWalletV1'),
          progression:localStorage.getItem('codaPlayerProgressV1')})''')
        self.wardrobe()
        for category,item in [('Glasses','shutter'),('Shoes','rollerskates'),('Accessories','boombox')]:
            self.browse(category,item)
            tile=self.page.locator('[data-item-id="'+item+'"]')
            self.assertTrue(tile.is_enabled())
            tile.click()
        self.assertEqual(self.appearance(),before,'Earning and trying on gear must not auto-equip it.')
        self.assertEqual(self.page.evaluate('''()=>({wallet:localStorage.getItem('codaNotesWalletV1'),
          progression:localStorage.getItem('codaPlayerProgressV1')})'''),saved,
          'Browsing earned gear must leave the saved reward journals unchanged.')
        self.page.get_by_role('button',name='Save my look',exact=True).click()
        for slot,item in [('eyewear','shutter'),('shoes','rollerskates'),('accessory','boombox')]:
            self.assertEqual(self.appearance()[slot],item)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().owned'),[])

    def test_notes_shop_only_lists_buyable_stock_and_keeps_expensive_goals(self):
        open_destination(self.page,'shop')
        stock=self.page.evaluate('CodaNotesShop.stockForCatalog(createCodaCharacterRenderer().catalog).filter(x=>Number.isSafeInteger(x.price)&&x.price>0).map(x=>x.id)')
        visible=self.page.locator('[data-shop-item]').evaluate_all('(xs)=>xs.map(x=>x.dataset.shopItem)')
        self.assertCountEqual(visible,stock)
        self.assertEqual(self.page.get_by_role('button',name='Mastery rewards',exact=True).count(),0)
        for reward in ['triadchampion','rhythmfox','pianophoenix','lakeotter','starlight','pitchlaurel10']:
            self.assertNotIn(reward,visible)
        alien=self.page.locator('[data-shop-item="alien"]')
        self.assertIn('12000 Notes',alien.inner_text());self.assertTrue(alien.locator('button').is_disabled())
        self.page.locator('.notes-shop-categories').get_by_role('button',name='Shop big goals',exact=True).click()
        self.assertGreater(self.page.locator('[data-shop-item]').count(),0)
        self.assertTrue(self.page.locator('[data-shop-item="alien"]').is_visible())
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),150)
        self.page.screenshot(path='/tmp/music48-notes-shop-stock.png')

    def test_closing_developer_mode_revokes_locked_npc_preview_and_save(self):
        before=self.page.evaluate('CodaArcadeQA.characters().npcs.find(x=>x.id==="miles").appearance')
        self.page.evaluate("CodaDeveloperConsole.open('objects')")
        self.page.locator('#devPlaytest').click()
        self.wardrobe()
        self.page.get_by_label('Customize',exact=True).select_option('miles')
        self.page.get_by_label('Hats',exact=True).select_option('crown')
        self.page.wait_for_function('window.__lastBoutiquePreview.headwear==="crown"')
        self.page.locator('#panelClose').focus();self.page.keyboard.press('F2')
        self.page.wait_for_function('!CodaDeveloperConsole.getState().open')
        self.page.wait_for_function('window.__lastBoutiquePreview.headwear==="none"')
        self.page.get_by_role('button',name='Save NPC look',exact=True).click()
        self.assertIn('Developer mode',self.page.locator('.boutique-actions [role="status"]').inner_text())
        self.assertEqual(self.page.evaluate('CodaArcadeQA.characters().npcs.find(x=>x.id==="miles").appearance'),before)

    def test_mobile_locked_cards_show_readable_requirements_and_keep_selection(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.wardrobe();self.browse('Pets','rhythmfox')
        tile=self.page.locator('[data-item-id="rhythmfox"]')
        self.assertTrue(tile.is_disabled());tile.scroll_into_view_if_needed()
        self.assertIn('100 notes in a row',tile.locator('small').inner_text())
        bounds=tile.bounding_box();self.assertGreaterEqual(bounds['x'],0)
        self.assertLessEqual(bounds['x']+bounds['width'],390)
        self.assertGreaterEqual(tile.locator('small').evaluate('(x)=>parseFloat(getComputedStyle(x).fontSize)'),11)
        self.assertEqual(self.page.get_by_label('Companion',exact=True).input_value(),'none')
        tile.locator('small').scroll_into_view_if_needed()
        tile.evaluate('''x=>{
          const panel=x.closest('#panel'),actions=panel.querySelector('.boutique-actions');
          const bottom=x.getBoundingClientRect().bottom,limit=actions.getBoundingClientRect().top-12;
          if(bottom>limit)panel.scrollTop+=bottom-limit;
        }''')
        self.page.screenshot(path='/tmp/music48-boutique-locks-390.png')


if __name__=='__main__':
    unittest.main(verbosity=2)
