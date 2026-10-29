"""Invite an original visitor through the physical shop and normal entrance."""
import importlib.util
import math
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode=True
from world_navigation_helpers import advance_world,open_destination,talk_to_musician
_spec=importlib.util.spec_from_file_location('visitors_learning_world',Path(__file__).with_name('learning-world-browser.py'))
_world=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_world)


class NPCVisitorsWorldTests(_world.WorldBrowserCase):
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        self.context.route('https://**/*',lambda route:route.abort())
        self.context.route('https://cwoodmusic.github.io/**',self.route_checkout)
        self.context.add_init_script("localStorage.setItem('codaArcadeFXV1','off');Math.random=()=>.5;")
        self.page=self.context.new_page();self.page.set_default_timeout(10000)
        self.errors=[];self.failures=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.on('console',lambda message:self.errors.append(message.text) if 'Arcade frame error:' in message.text else None)
        self.page.on('response',lambda response:self.failures.append(response.url)
          if response.status>=400 and '/coda-arcade/' in response.url and not response.url.endswith('favicon.ico') else None)
        self.load();self.page.clock.install();self.page.clock.run_for(64)

    def visitor(self):return self.page.evaluate("CodaArcadeQA.characters().npcs.find(person=>person.id==='vee-jay')")
    def wallet(self):return self.page.evaluate('CodaArcadeQA.notes()')

    def test_real_invitation_purchase_arrival_original_conversation_and_reload(self):
        self.assertTrue(self.visitor()['hidden']);self.assertFalse(self.visitor()['unlocked'])
        self.assertFalse(self.page.evaluate("CodaArcadeQA.findMusician('vee-jay')"))
        self.assertIn('vee-jay',self.page.evaluate('CodaArcadeQA.visitors().locked'))
        self.page.evaluate('''()=>{
          const wallet=CodaNotesShop.createWallet({catalog:createCodaCharacterRenderer().catalog});
          for(let n=0;n<6;n++)if(!wallet.grantReward('visitor-fixture:'+n,1000).ok)throw Error('fixture funding failed');
        }''')
        self.load();advance_world(self.page,96);self.assertEqual(self.wallet()['balance'],6150)
        open_destination(self.page,'shop')
        self.page.get_by_role('button',name='Shop visitors',exact=True).click()
        card=self.page.locator('[data-shop-item="visitor-vee-jay"]')
        self.assertIn('6000',card.inner_text());card.get_by_role('button').click();advance_world(self.page,32)
        self.assertEqual(self.wallet()['balance'],150)
        self.assertIn('visitor-vee-jay',self.wallet()['owned'])
        self.assertTrue(card.get_by_role('button').is_disabled())
        self.assertEqual(self.page.evaluate('CodaArcadeQA.characters().player.appearance.form'),'human','An invitation never equips an avatar transformation')
        self.assertTrue(self.visitor()['hidden'],'Opening the shop pauses physical visitor arrivals')
        self.page.keyboard.press('Escape');advance_world(self.page,32)
        self.assertFalse(self.page.locator('#panel').is_visible())
        self.assertTrue(self.page.evaluate("CodaArcadeQA.findMusician('vee-jay')"))
        for _ in range(240):
            advance_world(self.page,250)
            if not self.visitor()['hidden']:break
        visitor=self.visitor();self.assertFalse(visitor['hidden'])
        self.assertLess(math.hypot(visitor['x']-1450,visitor['y']-752),86,'A purchased visitor arrives through the arcade entrance')
        self.assertEqual(visitor['appearance']['form'],'tv');self.assertEqual(visitor['appearance']['name'],'Vee Jay')
        talk_to_musician(self.page,'vee-jay')
        self.assertEqual(self.page.locator('#who').inner_text(),'Vee Jay')
        self.assertIn('screen',self.page.locator('#words').inner_text().lower())
        choices=self.page.locator('.musician-choices')
        self.assertEqual(choices.get_by_role('button',name='mission',exact=False).count(),0)
        self.assertEqual(choices.get_by_role('button',name='music question',exact=False).count(),0)
        choices.get_by_role('button',name='Tell me about your music',exact=True).click()
        self.assertIn('musical texture',self.page.locator('#words').inner_text())
        self.assertIn('Original Coda Arcade character',self.page.locator('#dialog small').inner_text())
        self.page.screenshot(path='/tmp/coda-tv-visitor42-phone.png')
        self.page.keyboard.press('Escape');advance_world(self.page,32)
        self.assertFalse(self.page.locator('#dialog').is_visible())
        self.load();advance_world(self.page,96)
        self.assertEqual(self.wallet()['balance'],150);self.assertIn('visitor-vee-jay',self.wallet()['owned'])
        self.assertTrue(self.visitor()['unlocked']);self.assertNotIn('vee-jay',self.page.evaluate('CodaArcadeQA.visitors().locked'))
        self.assertTrue(all(person['hidden'] for person in self.page.evaluate("CodaArcadeQA.characters().npcs.filter(person=>['zizi','metronome'].includes(person.id))")))


if __name__=='__main__':unittest.main(verbosity=2)
