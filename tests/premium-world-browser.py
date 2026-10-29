"""Buy and wear long-term rewards, and follow between rooms."""
import importlib.util
import math
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode=True
from world_navigation_helpers import advance_world,enter_room,open_destination
_spec=importlib.util.spec_from_file_location('premium_learning_world',Path(__file__).with_name('learning-world-browser.py'))
_world=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_world)


class PremiumWorldTests(_world.WorldBrowserCase):
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        self.context.route('https://**/*',lambda route:route.abort())
        self.context.route('https://cwoodmusic.github.io/**',self.route_checkout)
        self.context.add_init_script("localStorage.setItem('codaArcadeFXV1','off')")
        self.page=self.context.new_page();self.page.set_default_timeout(10000)
        self.errors=[];self.failures=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.on('console',lambda message:self.errors.append(message.text) if 'Arcade frame error:' in message.text else None)
        self.page.on('response',lambda response:self.failures.append(response.url)
          if response.status>=400 and '/coda-arcade/' in response.url and not response.url.endswith('favicon.ico') else None)
        self.load();self.page.clock.install();self.page.clock.run_for(64)

    def wallet(self):return self.page.evaluate('CodaArcadeQA.notes()')
    def avatar(self):return self.page.evaluate('CodaArcadeQA.characters().player.appearance')
    def companion(self):return self.page.evaluate('CodaArcadeQA.companion()')

    def fund(self):
        # Seed an isolated browser through real ledger transactions, rather
        # than adding a production cheat/grant API or mutating its live avatar.
        self.page.evaluate('''()=>{
          const wallet=CodaNotesShop.createWallet({catalog:createCodaCharacterRenderer().catalog});
          for(let n=0;n<30;n++)if(!wallet.grantReward('premium-fixture:'+n,1000).ok)throw Error('fixture funding failed');
        }''')
        self.load();self.page.clock.run_for(96)
        self.assertEqual(self.wallet()['balance'],30150)

    def buy(self,item):
        card=self.page.locator('[data-shop-item="'+item+'"]')
        card.get_by_role('button').click();self.page.clock.run_for(32)
        self.assertIn(item,self.wallet()['owned'])

    def test_starter_cannot_buy_premium_and_mastery_unlocks_never_equip_automatically(self):
        open_destination(self.page,'shop')
        for item,price in [('alien',12000),('cosmiccat',6000),('neondragon',9000)]:
            card=self.page.locator('[data-shop-item="'+item+'"]')
            self.assertIn(str(price),card.inner_text());self.assertTrue(card.get_by_role('button').is_disabled())
        for item in ['lakeotter','rhythmfox','pianophoenix','triadchampion','starlight']:
            self.assertEqual(self.page.locator('[data-shop-item="'+item+'"]').count(),0,'Mastery rewards belong in the boutique, not the Notes shop')
        self.assertEqual(self.wallet()['balance'],150)
        self.assertEqual(self.avatar()['form'],'human');self.assertEqual(self.avatar()['pet'],'none')
        self.page.keyboard.press('Escape');self.assertFalse(self.page.locator('#panel').is_visible())
        self.page.evaluate('''()=>{
          const wallet=CodaNotesShop.createWallet({catalog:createCodaCharacterRenderer().catalog});
          for(const id of CodaPlayerProgression.PIANO_MEMORIES)wallet.grantReward('piano-memory:'+id,60);
        }''')
        self.load();self.page.clock.run_for(96)
        self.assertIn('pianophoenix',self.page.evaluate('CodaArcadeQA.progression().unlockedCosmetics'))
        self.assertEqual(self.avatar()['pet'],'none');self.assertFalse(self.companion()['active'])
        open_destination(self.page,'boutique')
        option=self.page.locator('#boutique-pet option[value="pianophoenix"]')
        self.assertNotIn('🔒',option.inner_text())
        self.page.locator('#boutique-pet').select_option('pianophoenix')
        self.page.locator('#boutiqueSave').click();self.page.clock.run_for(96)
        self.assertEqual(self.avatar()['pet'],'pianophoenix');self.assertTrue(self.companion()['active'])

    def test_actual_shop_purchase_wear_and_following_survive_doors_and_reload(self):
        self.fund();open_destination(self.page,'shop')
        self.buy('alien');self.buy('cosmiccat')
        self.assertEqual(self.wallet()['balance'],12150)
        self.assertEqual(self.avatar()['form'],'human');self.assertEqual(self.avatar()['pet'],'none')
        self.assertFalse(self.companion()['active'])
        # Wear is an explicit second step at the shop, including on mobile.
        for item in ['alien','cosmiccat']:
            action=self.page.locator('[data-shop-item="'+item+'"] button')
            self.assertEqual(action.inner_text(),'Wear this')
            action.click();self.page.clock.run_for(64)
            self.assertTrue(self.page.locator('#panel').is_visible())
        self.assertEqual(self.wallet()['balance'],12150,'Wearing owned rewards is free')
        self.page.keyboard.press('Escape');self.page.clock.run_for(128)
        self.assertEqual(self.avatar()['form'],'alien');self.assertEqual(self.avatar()['pet'],'cosmiccat')
        self.assertEqual(self.page.evaluate('JSON.parse(localStorage.musicArcadeV1).pet'),'cosmiccat')
        self.assertTrue(self.page.evaluate('CodaArcadeQA.place(1225,675)'));self.page.clock.run_for(64)
        self.page.locator('#view').focus();self.page.keyboard.down('d');self.page.clock.run_for(48);self.page.keyboard.up('d');self.page.clock.run_for(500)
        before=self.companion();self.page.keyboard.down('d')
        self.page.clock.run_for(320);self.page.keyboard.up('d');self.page.clock.run_for(96)
        after=self.companion();player=self.page.evaluate('CodaArcadeQA.position()')
        self.assertTrue(after['active']);self.assertEqual(after['id'],'cosmiccat')
        self.assertGreater(after['x'],before['x']+20)
        self.assertGreater(math.hypot(after['x']-player['x'],after['y']-player['y']),15)
        self.assertLess(math.hypot(after['x']-player['x'],after['y']-player['y']),90)
        for _ in range(10):
            dismiss=self.page.get_by_role('button',name='Dismiss notification',exact=True)
            if not dismiss.is_visible():break
            dismiss.click();self.page.clock.run_for(32)
        self.page.screenshot(path='/tmp/coda-premium-alien-pet-390.png')
        for kind in ['piano','classroom','fishing']:
            enter_room(self.page,kind);self.page.clock.run_for(128)
            state=self.page.evaluate('kind=>CodaArcadeQA[kind]()',kind);pet=state['companion'];actor=state['player']
            self.assertTrue(pet['active']);self.assertEqual(pet['id'],'cosmiccat');self.assertEqual(pet['roomId'],kind)
            self.assertLess(math.hypot(pet['x']-actor['x'],pet['y']-actor['y']),70,'A door should reset the pet close to its owner')
            self.page.keyboard.press('Escape');self.page.clock.run_for(64)
            self.assertFalse(self.page.evaluate('kind=>CodaArcadeQA[kind]().open',kind))
        self.load();self.page.clock.run_for(96)
        self.assertEqual(self.wallet()['balance'],12150);self.assertEqual(self.avatar()['form'],'alien')
        self.assertEqual(self.companion()['id'],'cosmiccat');self.assertTrue(self.companion()['active'])
        # Unequipping is explicit and restores the original human customization.
        open_destination(self.page,'boutique');self.page.locator('#boutique-form').select_option('human')
        self.page.locator('#boutique-pet').select_option('none');self.page.locator('#boutiqueSave').click();self.page.clock.run_for(96)
        self.assertEqual(self.avatar()['form'],'human');self.assertFalse(self.companion()['active'])
        self.assertIn('alien',self.wallet()['owned']);self.assertIn('cosmiccat',self.wallet()['owned'])

    def test_failed_premium_purchase_does_not_spend_or_unlock(self):
        self.fund();open_destination(self.page,'shop')
        self.page.evaluate('''()=>{
          const original=Storage.prototype.setItem;
          Storage.prototype.setItem=function(key,value){if(key==='codaNotesWalletV1')throw Error('fixture quota');return original.call(this,key,value);};
        }''')
        self.page.locator('[data-shop-item="alien"] button').click();self.page.clock.run_for(32)
        self.assertEqual(self.wallet()['balance'],30150);self.assertNotIn('alien',self.wallet()['owned'])
        self.assertEqual(self.avatar()['form'],'human');self.assertEqual(self.avatar()['pet'],'none')
        self.assertTrue(self.page.locator('[data-shop-item="alien"] button').is_disabled())
        self.assertIn('saving is unavailable',self.page.locator('.notes-shop-status').inner_text())


if __name__=='__main__':unittest.main(verbosity=2)
