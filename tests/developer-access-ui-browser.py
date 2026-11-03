"""Only verified owners see or operate developer-account management."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('developer_access_ui_base', Path(__file__).with_name('classroom-profile-ui-browser.py'))
base = importlib.util.module_from_spec(spec);spec.loader.exec_module(base)

ACCESS_FIXTURE = r'''()=>{
 window.__developers=[{email:'helper@example.org'}];window.__developerListFailure=false;
 window.__holdDeveloperList=false;window.__developerListResolvers=[];window.__developerGrantFailure=null;
 window.__holdDeveloperGrant=false;window.__releaseDeveloperGrant=null;
 __service.listDeveloperAccess=async()=>{
  __record('listDeveloperAccess');if(__holdDeveloperList)return new Promise(resolve=>__developerListResolvers.push(resolve));
  return __developerListFailure?{ok:false,code:'developer-access-unavailable',message:'PRIVATE backend data'}:{ok:true,developers:__developers.map(row=>({...row}))};
 };
 __service.grantDeveloperAccess=async email=>{
  __record('grantDeveloperAccess',email);if(__holdDeveloperGrant)return new Promise(resolve=>__releaseDeveloperGrant=resolve);
  if(__developerGrantFailure)return __developerGrantFailure;
  if(!__developers.some(row=>row.email===email))__developers.push({email});return {ok:true};
 };
 __service.revokeDeveloperAccess=async email=>{
  __record('revokeDeveloperAccess',email);__developers=__developers.filter(row=>row.email!==email);return {ok:true};
 };
}'''


class DeveloperAccessUITests(base.ClassroomProfileUITests):
 def setUp(self):
  super().setUp();self.page.evaluate(ACCESS_FIXTURE)

 def owner(self):
  self.page.evaluate("__emit({profile:null,admin:{signedIn:true,authorized:false,developer:true,developerOwner:true,uid:'owner_fixture_A',email:'owner@example.org'}})")
  self.page.locator('#classpassTab-admin').click()
  self.page.wait_for_selector('#classpassDeveloperAccess')

 def test_guest_student_and_ordinary_teacher_never_see_owner_controls_or_load_access_list(self):
  cases = [
   {'profile':None,'admin':{'signedIn':False,'authorized':False,'developerOwner':False}},
   {'profile':{'classId':'class-blue','profileId':'profile-one','alias':'Amber Fox 14'},'admin':{'signedIn':False,'authorized':False,'developerOwner':False}},
   {'profile':None,'admin':{'signedIn':True,'authorized':True,'developer':False,'developerOwner':False,'uid':'ordinary_teacher'}},
   {'profile':None,'admin':{'signedIn':True,'authorized':True,'developer':True,'developerOwner':False,'uid':'delegated_teacher'}},
  ]
  for state in cases:
   self.page.evaluate('state=>{__emit(state);__ui.open("admin");}', state);self.idle()
   self.assertEqual(self.page.locator('#classpassDeveloperAccess').count(), 0)
  self.assertEqual(self.calls('listDeveloperAccess'), [])
  self.assertEqual(self.calls('grantDeveloperAccess'), [])
  self.assertEqual(self.calls('revokeDeveloperAccess'), [])

 def test_owner_without_classroom_approval_can_load_grant_and_revoke_developer_access(self):
  self.owner();self.page.wait_for_selector('.classpass-developer-row')
  self.assertEqual(len(self.calls('listDeveloperAccess')), 1)
  self.assertEqual(self.calls('listClasses'), [], 'Developer ownership does not imply class-administrator approval')
  self.page.locator('#classpassDeveloperEmail').fill('new-helper@example.org')
  self.page.locator('#classpassDeveloperGrant').click();self.idle()
  self.page.wait_for_selector('.classpass-developer-row:has-text("new-helper@example.org")')
  self.assertEqual(self.calls('grantDeveloperAccess')[-1]['args'], ['new-helper@example.org'])
  self.page.locator('.classpass-developer-row').filter(has_text='new-helper@example.org').get_by_role('button',name='Revoke access',exact=True).click();self.idle()
  self.assertEqual(self.calls('revokeDeveloperAccess')[-1]['args'], ['new-helper@example.org'])
  self.assertEqual(self.page.locator('.classpass-developer-row').filter(has_text='new-helper@example.org').count(), 0)
  self.assertIn('revoked', self.page.locator('#classpassStatus').inner_text())

 def test_access_errors_are_friendly_and_refresh_can_retry_without_exposing_backend_text(self):
  self.page.evaluate('__developerListFailure=true');self.owner()
  self.page.wait_for_function('document.querySelector("#classpassDeveloperAccess")?.textContent.includes("could not load")')
  self.assertNotIn('PRIVATE', self.page.locator('body').inner_text())
  self.page.evaluate('__developerListFailure=false');self.page.locator('#classpassDeveloperRefresh').click()
  self.page.wait_for_selector('.classpass-developer-row')
  self.page.evaluate("__developerGrantFailure={ok:false,code:'developer-access-unavailable',message:'PRIVATE email secret@example.org'}")
  self.page.locator('#classpassDeveloperEmail').fill('retry@example.org');self.page.locator('#classpassDeveloperGrant').click();self.idle()
  self.assertIn('could not update', self.page.locator('#classpassStatus').inner_text())
  self.assertNotIn('secret@example.org', self.page.locator('body').inner_text())
  self.page.evaluate('__developerGrantFailure=null');self.page.locator('#classpassDeveloperGrant').click();self.idle()
  self.assertTrue(self.page.locator('.classpass-developer-row').filter(has_text='retry@example.org').is_visible())

 def test_revoked_owner_cannot_receive_late_access_list(self):
  self.page.evaluate('__holdDeveloperList=true');self.owner()
  self.page.wait_for_function('__developerListResolvers.length===1')
  self.page.evaluate("__emit({admin:{signedIn:true,authorized:false,developer:false,developerOwner:false,uid:'ordinary_teacher'}});__developerListResolvers[0]({ok:true,developers:[{email:'stale-private@example.org'}]})")
  self.page.wait_for_timeout(30)
  self.assertEqual(self.page.locator('#classpassDeveloperAccess').count(), 0)
  self.assertNotIn('stale-private@example.org', self.page.locator('body').inner_text())

 def test_owner_identity_change_discards_old_rows_and_old_pending_list(self):
  self.owner();self.page.wait_for_selector('.classpass-developer-row')
  self.page.evaluate('__holdDeveloperList=true');self.page.locator('#classpassDeveloperRefresh').click()
  self.page.wait_for_function('__developerListResolvers.length===1')
  self.page.evaluate("__emit({admin:{signedIn:true,authorized:false,developer:true,developerOwner:true,uid:'owner_fixture_B',email:'other-owner@example.org'}})")
  self.assertNotIn('helper@example.org', self.page.locator('#classpassDeveloperAccess').inner_text())
  self.page.evaluate("__developerListResolvers[0]({ok:true,developers:[{email:'stale-private@example.org'}]})")
  self.page.wait_for_timeout(20)
  self.assertNotIn('stale-private@example.org', self.page.locator('body').inner_text())
  self.page.wait_for_function('__developerListResolvers.length===2')
  self.page.evaluate("__developerListResolvers[1]({ok:true,developers:[{email:'current-helper@example.org'}]})")
  self.page.wait_for_selector('.classpass-developer-row:has-text("current-helper@example.org")')

 def test_revocation_discards_a_pending_grant_success_message(self):
  self.owner();self.page.wait_for_selector('.classpass-developer-row')
  self.page.evaluate('__holdDeveloperGrant=true');self.page.locator('#classpassDeveloperEmail').fill('pending@example.org')
  self.page.locator('#classpassDeveloperGrant').click();self.page.wait_for_function('typeof __releaseDeveloperGrant==="function"')
  self.page.evaluate("__emit({admin:{signedIn:false,authorized:false,developer:false,developerOwner:false}});__releaseDeveloperGrant({ok:true})")
  self.page.wait_for_timeout(30)
  self.assertEqual(self.page.locator('#classpassDeveloperAccess').count(), 0)
  self.assertNotIn('Developer access granted', self.page.locator('#classpassStatus').inner_text())
  self.assertFalse(self.page.evaluate('__ui.getState().busy'))


if __name__ == '__main__':
 suite=unittest.TestSuite(DeveloperAccessUITests(name) for name in DeveloperAccessUITests.__dict__ if name.startswith('test_'))
 result=unittest.TextTestRunner(verbosity=2).run(suite);sys.exit(not result.wasSuccessful())
