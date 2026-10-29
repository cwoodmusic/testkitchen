"""Private classroom UI, local QR/print cards, and generated-name recovery.

Uses production UI/CSS/QR code with an in-memory service fixture. No Firebase,
student data, real clipboard writes, sign-in popup, or QR web service is used.
"""
from pathlib import Path
import sys
import unittest
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
FIXTURE=r'''()=>{
 window.__calls=[];window.__copied=[];window.__printed=[];window.__openedProfiles=[];window.__sequence=1;window.__holdCreate=false;window.__unsaved=false;
 window.__state={configured:true,enabled:true,ready:true,loading:false,status:'ready',code:'',profile:null,admin:{signedIn:false,authorized:false,uid:'teacherSetupUID_123456',email:'private-teacher@example.org'},waitingTakeover:false,pending:false,locked:false};
 window.__classes=[{classId:'class-blue',label:'Blue class'}];window.__profiles={'class-blue':[{profileId:'profile-one',alias:'Amber Fox 14',picture:'fox',data:{notes:64,xp:150,name:'NEVER DISPLAY STUDENT NAME'}}]};
 window.__subscribers=[];window.__emit=patch=>{Object.assign(__state,patch);for(const fn of __subscribers)fn(__state);};
 window.__receipt=(id='profile-new')=>({ok:true,profileId:id,alias:id==='profile-one'?'Amber Fox 14':'Silver Owl 27',picture:id==='profile-one'?'fox':'owl',pass:'PRIVATE-PASS-'+(++__sequence)+'-ABCDEFGHIJKLMNOPQRSTUVWXYZ',get link(){return 'https://school.example/coda-arcade/world-preview.html#classroom-pass='+this.pass;}});
 window.__record=(method,...args)=>{__calls.push({method,args});if(window.__nextError){const error=__nextError;__nextError=null;throw error;}};
 window.__service={
  getState:()=>({...__state,admin:{...__state.admin},profile:__state.profile&&{...__state.profile}}),
  subscribe(fn){__subscribers.push(fn);fn(__state);return()=>{__subscribers=__subscribers.filter(value=>value!==fn);};},
  async join(value){__record('join',value);if(value==='old-pass')return{ok:false,code:'pass-revoked',message:'PRIVATE BACKEND Alice Student alice@example.org'};if(value==='busy-pass'){__emit({waitingTakeover:true});return{ok:true};}__emit({profile:{classId:'class-blue',profileId:'profile-one',alias:'Amber Fox 14',picture:'fox',name:'NEVER DISPLAY STUDENT NAME'}});return{ok:true};},
  async takeOver(){__record('takeOver');__emit({waitingTakeover:false,profile:{classId:'class-blue',profileId:'profile-one',alias:'Amber Fox 14',picture:'fox'}});return{ok:true};},
  async leave(options){__record('leave',options);if(__unsaved&&!options?.discard)return{ok:false,code:'unsaved-progress'};__emit({profile:null,waitingTakeover:false});return{ok:true};},
  async flush(){__record('flush');if(['newer-progress','unsaved-conflict','unavailable','offline'].includes(__state.code))return{ok:false,code:__state.code};__unsaved=false;__emit({pending:false});return{ok:true};},
  async useSavedProgress(){__record('useSavedProgress');__pendingCache=null;__emit({code:'',pending:false,locked:false});return{ok:true};},
  async adminSignIn(){__record('adminSignIn');const authorized=window.__approveAdmin!==false;__emit({admin:{signedIn:true,authorized,uid:'teacherSetupUID_123456',email:'private-teacher@example.org'},code:authorized?'':'admin-not-approved'});return authorized?{ok:true}:{ok:false,code:'admin-not-approved'};},
  async adminSignOut(){__record('adminSignOut');__emit({admin:{signedIn:false,authorized:false}});return{ok:true};},
  async listClasses(){__record('listClasses');return{ok:true,classes:__classes};},
  async createClass(label){__record('createClass',label);const item={classId:'class-new',label};__classes.push(item);__profiles[item.classId]=[];return{ok:true,...item};},
  async listProfiles(classId){__record('listProfiles',classId);return{ok:true,profiles:__profiles[classId]||[]};},
  async createProfile(classId){__record('createProfile',classId);const result=__receipt();(__profiles[classId]||=[]).push({profileId:result.profileId,alias:result.alias,picture:result.picture,data:{notes:0,xp:0}});if(__holdCreate)return new Promise(resolve=>{window.__releaseCreate=()=>resolve(result);});return result;},
  async reissuePass(classId,profileId){__record('reissuePass',classId,profileId);return __receipt(profileId);},
  async deleteProfile(classId,profileId){__record('deleteProfile',classId,profileId);__profiles[classId]=__profiles[classId].filter(row=>row.profileId!==profileId);return{ok:true};},
  async deleteClass(classId){__record('deleteClass',classId);__classes=__classes.filter(row=>row.classId!==classId);delete __profiles[classId];return{ok:true};}
 };
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{__copied.push(value);}}});
 window.print=()=>{__printed.push({card:document.querySelector('.classroom-print-sheet')?.innerText,panelDisplay:getComputedStyle(document.querySelector('#panel')).display,hasQR:!!document.querySelector('.classroom-print-sheet .classpass-qr svg')});queueMicrotask(()=>dispatchEvent(new Event('afterprint')));};
 window.__ui=createCodaClassroomUI({panelBody:document.querySelector('#panelBody'),openPanel:title=>{document.querySelector('#panel').hidden=false;document.querySelector('#panelTitle').textContent=title;document.querySelector('#panelBody').replaceChildren();},closePanel:()=>{document.querySelector('#panel').hidden=true;},service:__service,onProfile:profile=>__openedProfiles.push(profile)});__ui.open();
}'''

class ClassroomProfileUITests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.pw=sync_playwright().start();cls.browser=cls.pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 @classmethod
 def tearDownClass(cls):cls.browser.close();cls.pw.stop()
 def setUp(self):
  self.context=self.browser.new_context(viewport={'width':1000,'height':900});self.requests=[];self.context.route('**/*',lambda route:(self.requests.append(route.request.url),route.abort()))
  self.page=self.context.new_page();self.errors=[];self.page.on('pageerror',lambda error:self.errors.append(str(error)))
  html='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:12px;background:#17243a;color:white}#panel{box-sizing:border-box;max-width:640px;margin:auto;padding:14px}#panelBody{min-width:0}</style><aside id="panel"><h1 id="panelTitle"></h1><div id="panelBody"></div></aside>'
  self.context.route('https://school.example/ui-fixture',lambda route:route.fulfill(status=200,content_type='text/html',body=html));self.page.goto('https://school.example/ui-fixture')
  self.page.add_style_tag(path=str(ROOT/'classroom-ui.css'))
  for name in ['vendor/qrcode-generator.js','classroom-pass-qr.js','classroom-ui.js']:self.page.add_script_tag(path=str(ROOT/name))
  self.page.evaluate(FIXTURE)
 def tearDown(self):
  self.context.close();self.assertEqual(self.errors,[]);self.assertEqual(self.requests,[],'No QR image or service requests')
 def idle(self):self.page.wait_for_function('!__ui.getState().busy')
 def admin(self):
  self.page.locator('#classpassTab-admin').click();self.page.locator('#classpassAdminSignIn').click();self.idle()
 def card(self):
  self.admin();self.page.locator('#classpassCreateProfile').click();self.idle();self.assertTrue(self.page.locator('.classpass-card').is_visible())
 def calls(self,method):return self.page.evaluate('method=>__calls.filter(item=>item.method===method)',method)

 def test_log_out_is_available_in_profile_and_teacher_views_and_from_closed_options(self):
  self.page.evaluate("""()=>{
   __service.logOut=async()=>{__record('logOut');__emit({profile:null,admin:{signedIn:false,authorized:false},code:''});return {ok:true};};
   __emit({profile:{classId:'class-blue',profileId:'profile-one',alias:'Amber Fox 14',picture:'fox'}});
  }""")
  self.assertTrue(self.page.locator('#classpassLogOut').is_visible())
  self.page.locator('#classpassTab-admin').click()
  self.assertTrue(self.page.locator('#classpassLogOut').is_visible())
  self.page.locator('#classpassLogOut').click();self.idle()
  self.assertEqual(len(self.calls('logOut')),1)
  self.page.evaluate("__emit({admin:{signedIn:true,authorized:false,uid:'unapproved_staff_uid'}})")
  self.assertTrue(self.page.locator('#classpassLogOut').is_visible())
  self.page.locator('#classpassLogOut').click();self.idle()
  self.assertEqual(len(self.calls('logOut')),2)
  self.page.evaluate("""async()=>{
   __ui.close();__emit({admin:{signedIn:true,authorized:true,uid:'approved_staff_uid'}});
   await __ui.logOut();
  }""")
  self.idle();self.assertEqual(len(self.calls('logOut')),3)
  self.assertEqual(self.calls('listClasses'),[], 'Opening options to log out must not start a competing teacher-list request')

 def test_partial_logout_failure_keeps_an_explicit_retry_after_profile_disappears(self):
  self.page.evaluate("""()=>{
   window.__logoutFails=true;
   __service.logOut=async()=>{__record('logOut');__emit({profile:null,admin:{signedIn:false,authorized:false}});return __logoutFails?{ok:false,code:'logout-unavailable'}:{ok:true};};
   __emit({profile:{classId:'class-blue',profileId:'profile-one',alias:'Amber Fox 14',picture:'fox'}});
  }""")
  self.page.locator('#classpassLogOut').click();self.idle()
  self.assertIsNone(self.page.evaluate('__state.profile'))
  self.assertIn('try Log out again',self.page.locator('#classpassStatus').inner_text())
  self.assertTrue(self.page.locator('#classpassLogOut').is_visible())
  self.assertEqual(self.page.get_by_role('alertdialog').count(),0, 'Logout failures must not offer silent progress discard')
  self.page.evaluate('__logoutFails=false');self.page.locator('#classpassLogOut').click();self.idle()
  self.assertEqual(len(self.calls('logOut')),2)
  self.assertIn('logged out',self.page.locator('#classpassStatus').inner_text())

 def test_student_uses_one_paste_field_and_never_sees_names_or_raw_errors(self):
  self.assertEqual(self.page.locator('input').count(),1)
  self.assertEqual(self.page.locator('input[type=password]').count(),0)
  self.page.get_by_label('Profile Pass link or code',exact=True).fill('old-pass');self.page.locator('#classpassJoin').click();self.idle()
  self.assertIn('card has been replaced',self.page.locator('#classpassStatus').inner_text())
  self.assertNotIn('PRIVATE BACKEND',self.page.locator('body').inner_text());self.assertNotIn('alice@example.org',self.page.locator('body').inner_text())
  link='https://school.example/world#classroom-pass=example-private-code'
  self.page.locator('#classpassJoinInput').fill(link);self.page.locator('#classpassJoin').click();self.idle()
  self.assertEqual(self.calls('join')[-1]['args'],[link]);self.assertIn('Amber Fox 14',self.page.locator('body').inner_text())
  self.assertNotIn('NEVER DISPLAY STUDENT NAME',self.page.locator('body').inner_text())
  self.assertEqual(self.page.locator('.classpass-picture[data-profile-picture=fox]').count(),1)
  self.assertNotIn('example-private-code',self.page.evaluate('JSON.stringify(__ui.getState())'))

 def test_takeover_is_explicit_and_unsaved_leave_defaults_to_staying(self):
  self.page.locator('#classpassJoinInput').fill('busy-pass');self.page.locator('#classpassJoin').click();self.idle()
  self.assertEqual(self.page.evaluate('__openedProfiles'),[],'A pending takeover is not an opened profile')
  self.assertEqual(self.calls('takeOver'),[]);self.page.locator('#classpassTakeover').click()
  self.assertIn('other device',self.page.get_by_role('alertdialog').inner_text());self.page.locator('#classpassCancel').click();self.assertEqual(self.calls('takeOver'),[])
  self.page.locator('#classpassTakeover').click();self.page.locator('#classpassConfirm').click();self.idle();self.assertEqual(len(self.calls('takeOver')),1)
  self.assertEqual(self.page.evaluate('__openedProfiles.length'),1)
  self.page.evaluate('__unsaved=true');self.page.locator('#classpassLeave').click();self.page.locator('#classpassConfirm').click();self.idle()
  self.assertEqual(self.page.evaluate('__ui.getState().confirmation'),'unsaved-leave');self.assertIsNotNone(self.page.evaluate('__state.profile'))
  self.assertTrue(self.page.locator('#classpassCancel').evaluate('node=>node===document.activeElement'),'Stay and save is the safe default')
  self.page.locator('#classpassCancel').click();self.idle();self.assertEqual(len(self.calls('flush')),1);self.assertIsNotNone(self.page.evaluate('__state.profile'))
  self.page.evaluate('__unsaved=true');self.page.locator('#classpassLeave').click();self.page.locator('#classpassConfirm').click();self.idle();self.page.locator('#classpassConfirm').click();self.idle()
  self.assertEqual(self.calls('leave')[-1]['args'],[{'discard':True}]);self.assertIsNone(self.page.evaluate('__state.profile'))

 def test_admin_setup_allows_google_uid_bootstrap_but_no_student_creation(self):
  self.page.evaluate('__emit({enabled:false})');self.assertIn('teacher is finishing classroom setup',self.page.locator('body').inner_text())
  self.assertEqual(self.page.locator('#classpassJoin').count(),0)
  self.page.locator('#classpassTab-admin').click();self.page.locator('#classpassAdminSignIn').click();self.idle()
  self.assertEqual(len(self.calls('adminSignIn')),1);self.assertEqual(self.calls('listClasses'),[])
  self.assertEqual(self.page.get_by_label('Administrator setup ID',exact=True).inner_text(),'teacherSetupUID_123456')
  self.assertEqual(self.page.locator('#classpassCreateProfile,#classpassCreateClass').count(),0)
  self.assertNotIn('private-teacher@example.org',self.page.locator('body').inner_text())
  self.page.locator('#classpassCopySetup').click();self.assertEqual(self.page.evaluate('__copied'),['teacherSetupUID_123456'])
  self.page.evaluate('__emit({enabled:true})');self.idle();self.assertTrue(self.page.locator('#classpassCreateProfile').is_visible())

 def test_generated_card_qr_print_and_copy_are_local_and_secret_is_hidden_on_close(self):
  self.card();code=self.page.locator('.classpass-pass').inner_text();self.assertTrue(code.startswith('PRIVATE-PASS-'))
  self.assertEqual(self.page.locator('.classpass-card-alias').inner_text(),'Silver Owl 27')
  svg=self.page.locator('.classpass-qr svg');self.assertTrue(svg.is_visible());self.assertNotIn(code,svg.evaluate('node=>node.outerHTML'))
  qr=svg.evaluate(r'''svg=>{const modules=Number(svg.dataset.qrModules),path=svg.querySelector('path').getAttribute('d'),points=[...path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map(match=>[Number(match[1]),Number(match[2])]);return{modules,points,background:svg.querySelector('rect').getAttribute('fill')};}''')
  self.assertEqual(qr['background'],'#fff');self.assertEqual(qr['modules']%4,1)
  points={tuple(point) for point in qr['points']};n=qr['modules']
  self.assertTrue(all(4<=x<n+4 and 4<=y<n+4 for x,y in points),'Four-module white quiet zone')
  for ox,oy in [(4,4),(n-3,4),(4,n-3)]:
   for y in range(7):
    for x in range(7):self.assertEqual((ox+x,oy+y) in points,x in (0,6) or y in (0,6) or 2<=x<=4 and 2<=y<=4)
  self.page.locator('#classpassCopy').click();self.assertEqual(self.page.evaluate('__copied')[-1],'https://school.example/coda-arcade/world-preview.html#classroom-pass='+code)
  self.page.emulate_media(media='print');self.page.locator('#classpassPrint').click();self.page.emulate_media(media='screen')
  printed=self.page.evaluate('__printed');self.assertEqual(len(printed),1);self.assertEqual(printed[0]['panelDisplay'],'none');self.assertTrue(printed[0]['hasQR']);self.assertIn(code,printed[0]['card'])
  self.assertEqual(self.page.locator('.classroom-print-sheet').count(),0)
  self.page.locator('#classpassHide').click();self.assertNotIn(code,self.page.locator('body').inner_text());self.assertFalse(self.page.evaluate('__ui.getState().cardVisible'))
  self.assertEqual(self.page.locator('.classpass-profile-row').count(),2,'Created profile remains in the roster')
  self.assertNotIn(code,self.page.evaluate('JSON.stringify(localStorage)'));self.assertNotIn(code,self.page.evaluate('JSON.stringify(__ui.getState())'))

 def test_reissue_preserves_the_same_profile_and_requires_a_recovery_confirmation(self):
  self.admin();row=self.page.locator('.classpass-profile-row[data-profile-id=profile-one]')
  before=self.page.evaluate('JSON.stringify(__profiles["class-blue"][0])')
  row.get_by_role('button',name='Replace pass',exact=True).click();self.assertIn('Old cards and signed-in devices will stop working',self.page.get_by_role('alertdialog').inner_text())
  self.page.locator('#classpassCancel').click();self.assertEqual(self.calls('reissuePass'),[])
  row.get_by_role('button',name='Replace pass',exact=True).click();self.page.locator('#classpassConfirm').click();self.idle()
  self.assertEqual(self.calls('reissuePass')[0]['args'],['class-blue','profile-one']);self.assertEqual(self.page.evaluate('JSON.stringify(__profiles["class-blue"][0])'),before)
  self.assertEqual(self.page.locator('.classpass-card-alias').inner_text(),'Amber Fox 14');code=self.page.locator('.classpass-pass').inner_text()
  self.page.evaluate('document.querySelector("#panel").hidden=true');self.page.wait_for_function('!__ui.getState().open')
  self.assertEqual(self.page.locator('.classpass-pass').count(),0,'External panel close must remove the raw pass DOM')
  self.assertNotIn(code,self.page.evaluate('JSON.stringify(__ui.getState())'))

 def test_create_and_delete_flows_use_generated_profiles_and_explicit_confirmation(self):
  self.admin();self.page.get_by_label('Class label',exact=True).fill('Green class');self.page.locator('#classpassCreateClass').click();self.idle()
  self.assertEqual(self.calls('createClass')[0]['args'],['Green class']);self.assertEqual(self.page.locator('#classpassClass').input_value(),'class-new')
  self.assertEqual(self.page.locator('input').count(),2,'Only the class label and in-memory alias search are available')
  self.assertEqual(self.page.locator('input:not([type=search])').count(),1,'No student name field is collected')
  self.page.locator('#classpassCreateProfile').click();self.idle();self.page.locator('#classpassHide').click()
  row=self.page.locator('.classpass-profile-row');row.get_by_role('button',name='Delete profile',exact=True).click();self.page.locator('#classpassCancel').click();self.assertEqual(self.calls('deleteProfile'),[])
  row.get_by_role('button',name='Delete profile',exact=True).click();self.assertIn('permanently removes',self.page.get_by_role('alertdialog').inner_text());self.page.locator('#classpassConfirm').click();self.idle();self.assertEqual(len(self.calls('deleteProfile')),1)
  self.page.locator('#classpassDeleteClass').click();self.page.locator('#classpassCancel').click();self.assertEqual(self.calls('deleteClass'),[])
  self.page.locator('#classpassDeleteClass').click();self.page.locator('#classpassConfirm').click();self.idle();self.assertEqual(self.calls('deleteClass')[0]['args'],['class-new'])

 def test_pending_creation_cannot_duplicate_or_leak_a_late_receipt_after_close(self):
  self.admin();self.page.evaluate('__holdCreate=true');self.page.locator('#classpassCreateProfile').click()
  self.assertTrue(self.page.locator('#classpassCreateProfile').is_disabled());self.assertEqual(len(self.calls('createProfile')),1)
  self.page.evaluate('__ui.close();__releaseCreate()');self.page.wait_for_timeout(20)
  self.assertFalse(self.page.evaluate('__ui.getState().cardVisible'));self.assertEqual(self.page.locator('.classpass-pass').count(),0)
  self.assertNotIn('PRIVATE-PASS-',self.page.locator('body').inner_text())

 def test_revoked_admin_permission_clears_cards_and_discards_late_private_receipts(self):
  self.card();code=self.page.locator('.classpass-pass').inner_text()
  self.page.evaluate('__emit({admin:{signedIn:true,authorized:false,uid:"teacherSetupUID_123456"}})')
  self.assertEqual(self.page.locator('.classpass-pass').count(),0);self.assertFalse(self.page.evaluate('__ui.getState().cardVisible'))
  self.assertNotIn(code,self.page.locator('body').inner_text())
  self.page.evaluate('__emit({admin:{signedIn:true,authorized:true,uid:"teacherSetupUID_123456"}})');self.idle()
  self.page.evaluate('__holdCreate=true');self.page.locator('#classpassCreateProfile').click()
  self.page.evaluate('__emit({admin:{signedIn:true,authorized:false}});__releaseCreate()');self.idle()
  self.assertFalse(self.page.evaluate('__ui.getState().cardVisible'));self.assertEqual(self.page.locator('.classpass-pass').count(),0)

 def test_admin_permissions_and_friendly_errors_never_show_backend_details(self):
  self.page.evaluate('__approveAdmin=false');self.page.locator('#classpassTab-admin').click();self.page.locator('#classpassAdminSignIn').click();self.idle()
  self.assertEqual(self.page.locator('#classpassCreateProfile,#classpassClass').count(),0);self.assertEqual(self.calls('listProfiles'),[])
  self.page.locator('#classpassTab-student').click();self.page.evaluate('__nextError={code:"functions/permission-denied",message:"PII Alice alice@example.org private backend trace"}')
  self.page.locator('#classpassJoinInput').fill('any-pass');self.page.locator('#classpassJoin').click();self.idle()
  self.assertIn('Ask your teacher',self.page.locator('#classpassStatus').inner_text());self.assertNotIn('Alice',self.page.locator('body').inner_text());self.assertNotIn('private backend trace',self.page.locator('body').inner_text())

 def test_unapproved_google_signin_explains_account_approval_instead_of_generic_retry(self):
  self.page.evaluate('__approveAdmin=false');self.page.locator('#classpassTab-admin').click();self.page.locator('#classpassAdminSignIn').click();self.idle()
  status=self.page.locator('#classpassStatus');self.assertTrue(status.is_visible())
  self.assertIn('This Google account is not approved as a school administrator',status.inner_text())
  self.assertIn('approved teacher account',status.inner_text());self.assertIn('setup ID above',status.inner_text())
  self.assertNotIn('We could not finish that',self.page.locator('body').inner_text());self.assertNotIn('Please try again',status.inner_text())
  self.assertIn('not a school administrator here',self.page.locator('body').inner_text())
  self.assertEqual(self.page.get_by_label('Administrator setup ID',exact=True).inner_text(),'teacherSetupUID_123456')
  self.assertTrue(self.page.locator('#classpassAdminSignOut').is_visible())
  self.assertEqual(self.page.locator('#classpassCreateProfile,#classpassCreateClass').count(),0);self.assertEqual(self.calls('listClasses'),[])
  self.assertNotIn('private-teacher@example.org',self.page.locator('body').inner_text())

 def test_conflicting_pending_progress_is_kept_until_saved_progress_is_explicitly_confirmed(self):
  self.page.evaluate('''()=>{window.__pendingCache={notes:77,xp:123};__emit({profile:{profileId:'profile-one',alias:'Amber Fox 14',picture:'fox'},code:'unsaved-conflict',pending:true,locked:true});}''')
  self.assertIn('changes on this device',self.page.locator('body').inner_text());self.assertEqual(self.calls('useSavedProgress'),[])
  self.page.locator('#classpassUseSaved').click();self.assertIn('unsaved changes will be lost',self.page.get_by_role('alertdialog').inner_text())
  self.assertTrue(self.page.locator('#classpassCancel').evaluate('node=>node===document.activeElement'))
  self.page.locator('#classpassCancel').click();self.assertEqual(self.calls('useSavedProgress'),[]);self.assertEqual(self.page.evaluate('__pendingCache'),{'notes':77,'xp':123})
  self.page.locator('#classpassRetryProgress').click();self.idle();self.assertEqual(len(self.calls('flush')),1);self.assertEqual(self.page.evaluate('__pendingCache'),{'notes':77,'xp':123})
  self.page.evaluate('__nextError={code:"unavailable",message:"private PII backend trace"}')
  self.page.locator('#classpassUseSaved').click();self.page.locator('#classpassConfirm').click();self.idle()
  self.assertEqual(self.page.evaluate('__pendingCache'),{'notes':77,'xp':123});self.assertIn('Check your connection',self.page.locator('#classpassStatus').inner_text());self.assertNotIn('private PII',self.page.locator('body').inner_text())
  self.page.locator('#classpassUseSaved').click();self.page.locator('#classpassConfirm').click();self.idle()
  self.assertIsNone(self.page.evaluate('__pendingCache'));self.assertEqual(len(self.calls('useSavedProgress')),2);self.assertIn('Your saved progress is ready',self.page.locator('#classpassStatus').inner_text())

 def test_newer_progress_and_connection_retry_never_offer_or_auto_discard_local_changes(self):
  self.page.evaluate('''()=>{window.__pendingCache={notes:77};__emit({profile:{profileId:'profile-one',alias:'Amber Fox 14'},code:'unsaved-conflict',pending:true,locked:true});}''')
  self.page.locator('#classpassUseSaved').click();self.page.evaluate('__emit({code:"newer-progress"})');self.page.locator('#classpassConfirm').click()
  self.assertEqual(self.calls('useSavedProgress'),[]);self.assertEqual(self.page.locator('#classpassUseSaved').count(),0)
  self.page.locator('#classpassRetryProgress').click();self.idle();self.assertEqual(self.page.evaluate('__pendingCache'),{'notes':77})
  self.page.evaluate('__emit({code:"offline"})');self.assertEqual(self.page.locator('#classpassUseSaved').count(),0);self.assertIn('kept safe',self.page.locator('body').inner_text())
  self.page.locator('#classpassRetryProgress').click();self.idle();self.assertEqual(self.page.evaluate('__pendingCache'),{'notes':77});self.assertEqual(self.calls('useSavedProgress'),[])

 def test_classroom_boutique_alias_is_read_only_and_cannot_be_replaced_by_a_name(self):
  for name in ['character-renderer.js','boutique-ui.js']:self.page.add_script_tag(path=str(ROOT/name))
  self.page.evaluate('''()=>{
   window.__classroomAlias='Amber Conductor 1234';window.__boutiqueSaves=[];
   const profile={name:'Old guest nickname',hairstyle:'bald',headwear:'none'};
   window.__boutique=createCodaBoutiqueUI({panelBody:document.querySelector('#panelBody'),renderer:createCodaCharacterRenderer(),getClassroomAlias:()=>__classroomAlias,getProfile:id=>id==='miles'?{...profile,name:'Miles Davis'}:profile,getTargets:()=>[{id:'player',label:'Your avatar'},{id:'miles',label:'Miles Davis'}],isDeveloperMode:()=>true,getPreviewUI:()=>({addPreview:()=>{}}),openPanel:()=>document.querySelector('#panelBody').replaceChildren(),closePanel:()=>{},applyProfile:(id,value)=>{__boutiqueSaves.push({id,value});return true;}});__boutique.open();
  }''')
  alias=self.page.get_by_label('Classroom alias',exact=True);self.assertEqual(alias.input_value(),'Amber Conductor 1234');self.assertFalse(alias.is_editable())
  alias.evaluate('node=>node.value="Private Student Name"');self.page.locator('#boutiqueSave').click()
  self.assertEqual(self.page.evaluate('__boutiqueSaves[0].value.name'),'Amber Conductor 1234');self.assertNotIn('Private Student Name',self.page.evaluate('JSON.stringify(__boutiqueSaves)'))
  self.page.evaluate('__boutique.open("miles")');self.assertEqual(self.page.get_by_label('Arcade nickname',exact=True).input_value(),'Miles Davis');self.assertFalse(self.page.get_by_label('Arcade nickname',exact=True).is_editable())
  self.page.evaluate('__classroomAlias=null;__boutique.open()');self.assertTrue(self.page.get_by_label('Arcade nickname',exact=True).is_editable())

 def test_cards_and_controls_fit_narrow_phone_and_landscape_without_external_assets(self):
  self.card()
  for size in [{'width':320,'height':740},{'width':390,'height':844},{'width':844,'height':390}]:
   self.page.set_viewport_size(size)
   for selector in ['#panel','.classroom-profile-ui','.classpass-card']:
    node=self.page.locator(selector);self.assertLessEqual(node.evaluate('node=>node.scrollWidth'),node.evaluate('node=>node.clientWidth')+2,selector)
   for button in self.page.locator('.classroom-profile-ui button:visible').all():self.assertGreaterEqual(button.bounding_box()['height'],48)
   qr=self.page.locator('.classpass-qr svg').bounding_box();self.assertGreaterEqual(qr['width'],175)
   self.page.locator('.classpass-qr svg').screenshot(path='/tmp/classroom-pass-qr-'+str(size['width'])+'x'+str(size['height'])+'.png')
   self.page.screenshot(path='/tmp/classroom-pass-card-'+str(size['width'])+'x'+str(size['height'])+'.png',full_page=True)

if __name__=='__main__':unittest.main(verbosity=2)
