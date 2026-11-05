"""Teacher roster preview/import/card UI with local Google and service doubles.

No real OAuth, student roster, storage, printer, or Firebase service is used.
"""
from pathlib import Path
import sys
import unittest
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
FIXTURE = r'''()=>{
 window.__calls=[];window.__prints=[];window.__allowed=true;window.__identity='teacher_fixture';window.__subscribers=[];
 window.__classes=[{classId:'class-existing',label:'Blue group'}];
 window.__profiles=[{profileId:'profile-one',alias:'Blue Owl 27',picture:'owl'},{profileId:'profile-two',alias:'Mint Fox 43',picture:'fox'}];
 window.__students=[{userId:'student-1',name:'Alice Example'},{userId:'student-2',name:'Ben Example'}];
 window.__status={};window.__hold='';window.__error='';window.__serial=0;
 window.__emit=()=>{for(const callback of __subscribers)callback();};
 const called=async(method,value)=>{__calls.push({method,value});if(__hold===method)await new Promise(resolve=>window.__release=resolve);if(__error){const value={ok:false,code:__error};__error='';return value;}return null;};
 window.__service={
  getState:()=>({enabled:true,admin:{signedIn:__allowed,authorized:__allowed,uid:__identity}}),
  subscribe(fn){__subscribers.push(fn);return()=>{__subscribers=__subscribers.filter(value=>value!==fn);};},
  async connectGoogleClassroom(){return await called('connect')||{ok:true};},
  async listGoogleClassroomCourses(){return await called('courses')||{ok:true,courses:[{id:'course-1',name:'Music 3',section:'Room 14'}]};},
  async listClasses(){return await called('classes')||{ok:true,classes:__classes};},
  async loadGoogleClassroomRoster(courseId){return await called('roster',courseId)||{ok:true,courseId,students:__students};},
  async previewRosterImport(value){
   return await called('preview',value)||{ok:true,courseId:value.courseId,classId:value.classId||'class-reserved',label:value.classId?'Blue group':'',newClass:!value.classId,
    profiles:value.classId?__profiles:[],students:__students.map(student=>({userId:student.userId,status:'unlinked',...(__status[student.userId]||{})}))};
  },
  async importRoster(value){
   const error=await called('import',value);if(error)return error;
   const cards=value.choices.filter(choice=>choice.action==='create').map(choice=>{
    const pass='CODA-PRIVATE-CARD-'+(++__serial)+'-ABCDEFGHIJKLMNOP';
    return {userId:choice.userId,name:__students.find(item=>item.userId===choice.userId)?.name,profileId:'profile-new-'+__serial,alias:'Gold Owl '+(20+__serial),picture:'owl',pass,link:'https://school.example/world#classroom-pass='+pass};
   });
   return {ok:true,classId:value.classId||'class-created',label:value.label||'Blue group',cards,created:cards.length,linked:value.choices.filter(choice=>choice.action==='link').length,existing:Object.values(__status).filter(value=>value.status==='existing').length,skipped:value.choices.filter(choice=>choice.action==='skip').length};
  },
  disconnectGoogleClassroom(){__calls.push({method:'disconnect'});}
 };
 window.print=()=>{
  const sheet=document.querySelector('.classroom-google-print-sheet');
  __prints.push({title:document.title,kind:sheet?.dataset.printKind,body:sheet?.innerText,qr:sheet?.querySelectorAll('.google-card-qr svg').length,
    cards:Array.from(sheet?.querySelectorAll('.google-import-card')||[],node=>node.innerText)});
  if(window.__throwPrint)throw Error('printer');
  queueMicrotask(()=>dispatchEvent(new Event('afterprint')));
 };
 window.__import=CodaClassroomGoogleImport.create({host:document.querySelector('#host'),service:__service,canUse:()=>__allowed,getIdentity:()=>__identity,
  onChanged:value=>{window.__changed=value;},qr:CodaClassroomPassQR});
}'''

PUBLISHING_FIXTURE = r'''()=>{
 window.__publishCalls=[];window.__posts=[];window.__postPlans=new Map();window.__deliveryByLink=new Map();window.__postExtras=[];
 window.__publishSequence=0;window.__postMode='success';window.__publishHold='';window.__publishError='';
 const call=async(method,value)=>{
  __publishCalls.push({method,value});
  if(__publishHold===method)await new Promise(resolve=>window.__releasePublishing=resolve);
  if(__publishError){const code=__publishError;__publishError='';return {ok:false,code};}
  return null;
 };
 const count=(rows,status)=>rows.filter(row=>row.status===status).length;
 Object.assign(__service,{
  async connectGoogleClassroomPublishing(){return await call('permission')||{ok:true};},
  async previewClassroomPosts(value){
   const error=await call('preview',value);if(error)return error;
   const planId='private-plan-'+(++__publishSequence);
   const rows=[...__postExtras,...value.cards.map(card=>({userId:card.userId,name:card.name,alias:card.alias,status:__deliveryByLink.get(card.link)||'ready'}))];
   __postPlans.set(planId,{cards:value.cards,rows});
   return {ok:true,planId,rows,ready:count(rows,'ready'),alreadyPosted:count(rows,'already-posted'),uncertain:count(rows,'uncertain'),busy:count(rows,'busy'),unavailable:count(rows,'link-unavailable')};
  },
  async publishClassroomPosts(value){
   const error=await call('publish',value);if(error)return error;
   if(value.confirmed!==true)return {ok:false,code:'publish-confirmation-required'};
   const plan=__postPlans.get(value.planId);if(!plan)return {ok:false,code:'publish-plan-required'};
   let index=0;
   const rows=plan.rows.map(row=>{
    if(row.status!=='ready')return {...row};
    const card=plan.cards.find(card=>card.userId===row.userId);
    if(!card)return {...row,status:'link-unavailable'};
    let status=__deliveryByLink.get(card.link);
    if(status!=='already-posted'&&status!=='uncertain'){
     status=index++===0?'posted':__postMode==='partial'?'failed':__postMode==='uncertain'?'uncertain':'posted';
     if(status==='posted'){__posts.push({userId:card.userId,link:card.link});__deliveryByLink.set(card.link,'already-posted');}
     else if(status==='uncertain')__deliveryByLink.set(card.link,'uncertain');
    }
    return {...row,status};
   });
   return {ok:true,planId:value.planId,rows,posted:count(rows,'posted'),alreadyPosted:count(rows,'already-posted'),failed:count(rows,'failed'),uncertain:count(rows,'uncertain'),busy:count(rows,'busy'),unavailable:count(rows,'link-unavailable')};
  }
 });
}'''


class GoogleClassroomImportUITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.pw.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1050, 'height': 950})
        self.requests = []; self.errors = []
        self.context.route('**/*', lambda route:(self.requests.append(route.request.url),route.abort()))
        html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Coda fixture</title><style>body{margin:12px;background:#17243a;color:white}#host{max-width:700px;margin:auto;min-width:0}</style><main id="host"></main>'
        self.context.route('https://school.example/import-fixture', lambda route:route.fulfill(status=200,content_type='text/html',body=html))
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda error:self.errors.append(str(error)))
        self.page.goto('https://school.example/import-fixture')
        self.page.add_style_tag(path=str(ROOT/'classroom-google-import.css'))
        for name in ['vendor/qrcode-generator.js','classroom-pass-qr.js','classroom-google-import.js']:
            self.page.add_script_tag(path=str(ROOT/name))
        self.page.evaluate(FIXTURE)

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.requests, [], 'The UI must use no external roster or QR service')
        self.assertEqual(self.errors, [])

    def calls(self, method):
        return self.page.evaluate('method=>__calls.filter(item=>item.method===method)', method)

    def idle(self):
        self.page.wait_for_function('!__import.getState().busy')

    def connect(self):
        self.page.locator('#googleRosterOpen').click()
        self.page.locator('#googleRosterConnect').click(); self.idle()
        self.page.locator('#googleRosterCourse').select_option('course-1')

    def preview(self, existing=False):
        self.connect()
        if existing:self.page.locator('#googleRosterTarget').select_option('class-existing')
        self.page.locator('#googleRosterPreview').click(); self.idle()

    def create_cards(self):
        self.preview(); self.page.locator('#googleRosterImport').click(); self.idle()

    def enable_publishing(self):
        self.page.evaluate(PUBLISHING_FIXTURE)

    def publishing_calls(self, method):
        return self.page.evaluate('method=>__publishCalls.filter(item=>item.method===method)', method)

    def prepare_posts(self):
        self.page.locator('#googleRosterPreparePosts').click(); self.idle()

    def publish_posts(self):
        self.page.locator('#googleRosterPublishPosts').click(); self.idle()

    def test_connection_and_roster_preview_are_explicit_and_never_create_profiles(self):
        self.assertEqual(self.calls('connect'), [])
        self.page.locator('#googleRosterOpen').click()
        self.assertEqual(self.calls('connect'), [])
        self.page.locator('#googleRosterConnect').click(); self.idle()
        self.assertEqual(len(self.calls('connect')), 1)
        self.assertEqual(self.calls('roster'), [])
        self.page.locator('#googleRosterCourse').select_option('course-1')
        self.page.locator('#googleRosterPreview').click(); self.idle()
        self.assertIn('Alice Example', self.page.locator('.google-roster-list').inner_text())
        self.assertEqual(self.calls('import'), [])
        self.assertEqual(self.page.locator('#googleRosterImport').inner_text(), 'Import 2 students')
        self.assertNotIn('Alice', self.page.evaluate('JSON.stringify(__import.getState())'))
        self.assertEqual(self.page.evaluate('JSON.stringify(localStorage)+JSON.stringify(sessionStorage)'), '{}{}')

    def test_existing_profiles_default_to_skip_and_explicit_links_keep_profile_ids(self):
        self.preview(existing=True)
        for index in [0,1]:self.assertEqual(self.page.locator('#googleRosterChoice-'+str(index)).input_value(), 'skip')
        self.assertTrue(self.page.locator('#googleRosterImport').is_disabled())
        self.page.locator('#googleRosterChoice-0').select_option('link:profile-one')
        self.page.locator('#googleRosterChoice-1').select_option('link:profile-one')
        self.assertTrue(self.page.locator('#googleRosterImport').is_disabled())
        self.assertIn('own profile', self.page.locator('.google-import-error').inner_text())
        self.page.locator('#googleRosterChoice-1').select_option('link:profile-two')
        self.page.locator('#googleRosterImport').click(); self.idle()
        value = self.calls('import')[0]['value']
        self.assertEqual(value['classId'], 'class-existing')
        self.assertEqual([choice['profileId'] for choice in value['choices']], ['profile-one','profile-two'])
        self.assertEqual(self.page.evaluate('__import.getState().cardCount'), 0)

    def test_existing_mapping_reuses_profile_and_missing_mapping_requires_a_choice(self):
        self.page.evaluate("__status={'student-1':{status:'existing',profileId:'profile-one',alias:'Blue Owl 27'},'student-2':{status:'missing'}}")
        self.preview(existing=True)
        self.assertEqual(self.page.locator('#googleRosterChoice-0').count(), 0)
        self.assertEqual(self.page.locator('#googleRosterChoice-1').input_value(), 'skip')
        self.assertTrue(self.page.locator('#googleRosterImport').is_disabled())
        self.page.locator('#googleRosterChoice-1').select_option('create')
        self.page.locator('#googleRosterImport').click(); self.idle()
        self.assertEqual(self.calls('import')[0]['value']['choices'][0], {'userId':'student-1','action':'skip'})

    def test_repeat_import_can_print_existing_teacher_key_without_any_profile_write(self):
        self.page.evaluate("__status={'student-1':{status:'existing',profileId:'profile-one',alias:'Blue Owl 27'},'student-2':{status:'existing',profileId:'profile-two',alias:'Mint Fox 43'}}")
        self.preview(existing=True)
        self.assertTrue(self.page.locator('#googleRosterImport').is_disabled())
        self.page.locator('#googleRosterViewKey').click()
        self.assertEqual(self.calls('import'), [])
        self.assertEqual(self.page.evaluate('__import.getState().cardCount'), 0)
        self.assertEqual(self.page.locator('#googleRosterPrintCards').count(), 0)
        self.page.locator('#googleRosterPrintKey').click()
        printed = self.page.evaluate('__prints[0]')
        self.assertIn('Alice Example', printed['body']); self.assertIn('Blue Owl 27', printed['body'])
        self.assertNotIn('PRIVATE-CARD', printed['body'])
        self.assertIn('Replace pass', self.page.locator('#host').inner_text())
        self.page.locator('#googleRosterDone').click()
        self.assertFalse(self.page.evaluate('__import.getState().open'))

    def test_setup_error_shows_friendly_message_and_retains_target_for_retry(self):
        self.connect(); self.page.locator('#googleRosterTarget').select_option('class-existing')
        self.page.evaluate("__error='roster-setup-required'")
        self.page.locator('#googleRosterPreview').click(); self.idle()
        self.assertIn('administrator', self.page.locator('#googleRosterStatus').inner_text())
        self.assertEqual(self.page.locator('#googleRosterTarget').input_value(), 'class-existing')
        self.assertEqual(self.calls('import'), [])
        self.page.locator('#googleRosterPreview').click(); self.idle()
        self.assertEqual(self.page.locator('.google-roster-row').count(), 2)

    def test_expired_connection_clears_loaded_names_and_offers_explicit_reconnect(self):
        self.preview()
        self.page.evaluate("__error='expired'")
        self.page.locator('#googleRosterPreview').click(); self.idle()
        self.assertTrue(self.page.locator('#googleRosterConnect').is_visible())
        self.assertIn('expired', self.page.locator('#googleRosterStatus').inner_text())
        self.assertNotIn('Alice Example', self.page.locator('#host').inner_text())
        self.assertEqual(self.calls('import'), [])

    def test_failed_import_keeps_explicit_student_choices_for_retry(self):
        self.preview()
        self.page.locator('#googleRosterChoice-1').select_option('skip')
        self.page.evaluate("__error='import-failed'")
        self.page.locator('#googleRosterImport').click(); self.idle()
        self.assertIn('could not finish', self.page.locator('#googleRosterStatus').inner_text())
        self.assertEqual(self.page.locator('#googleRosterChoice-1').input_value(), 'skip')
        self.page.locator('#googleRosterImport').click(); self.idle()
        self.assertEqual(self.page.evaluate('__import.getState().cardCount'), 1)
        self.assertEqual(self.calls('import')[0]['value'], self.calls('import')[1]['value'])

    def test_cards_and_teacher_key_print_separately_without_leaking_names_or_passes(self):
        self.create_cards()
        self.assertEqual(self.page.evaluate('__import.getState().cardCount'), 2)
        self.assertNotIn('PRIVATE-CARD', self.page.evaluate('JSON.stringify(__import.getState())'))
        self.page.locator('#googleRosterPrintCards').click()
        printed = self.page.evaluate('__prints[0]')
        self.assertEqual(printed['kind'], 'cards'); self.assertEqual(printed['qr'], 2)
        self.assertNotIn('Alice Example', printed['body']); self.assertIn('CODA-PRIVATE-CARD', printed['body'])
        self.assertTrue(printed['title'].startswith('Coda-Class-Cards-Music-3-'))
        self.page.locator('#googleRosterPrintKey').click()
        key = self.page.evaluate('__prints[1]')
        self.assertEqual(key['kind'], 'key'); self.assertIn('Alice Example', key['body'])
        self.assertNotIn('PRIVATE-CARD', key['body'])
        self.assertTrue(key['title'].startswith('Coda-Teacher-Key-Music-3-'))
        self.assertNotEqual(printed['title'], key['title'])
        self.assertEqual(self.page.title(), 'Coda fixture')
        self.assertEqual(self.page.locator('.classroom-google-print-sheet').count(), 0)
        self.assertEqual(self.page.evaluate('JSON.stringify(localStorage)+JSON.stringify(sessionStorage)'), '{}{}')

    def test_print_failure_keeps_cards_and_close_requires_explicit_acknowledgement(self):
        self.create_cards(); self.page.evaluate('__throwPrint=true')
        self.page.locator('#googleRosterPrintCards').click()
        self.assertIn('still here', self.page.locator('#googleRosterStatus').inner_text())
        self.assertEqual(self.page.evaluate('__import.getState().cardCount'), 2)
        self.assertEqual(self.page.title(), 'Coda fixture')
        self.page.locator('#googleRosterDone').click()
        self.assertTrue(self.page.get_by_role('alertdialog').is_visible())
        self.assertTrue(self.page.locator('#googleRosterKeepCards').evaluate('node=>node===document.activeElement'))
        self.page.locator('#googleRosterKeepCards').click()
        self.assertEqual(self.page.evaluate('__import.getState().cardCount'), 2)
        self.page.locator('#googleRosterCardsSaved').check(); self.page.locator('#googleRosterDone').click()
        self.assertFalse(self.page.evaluate('__import.getState().open'))
        self.assertEqual(self.page.evaluate('__import.getState().cardCount'), 0)
        self.assertNotIn('Alice Example', self.page.locator('#host').inner_text())

    def test_account_change_clears_private_roster_and_ignores_pending_results(self):
        self.connect(); self.page.evaluate("__hold='roster'")
        self.page.locator('#googleRosterPreview').click()
        self.page.wait_for_function('typeof __release==="function"')
        self.page.evaluate("__identity='another_teacher';__emit();__release()")
        self.idle()
        self.assertEqual(self.page.evaluate('__import.getState().rosterCount'), 0)
        self.assertNotIn('Alice', self.page.locator('#host').inner_text())
        self.assertEqual(self.calls('preview'), [])
        self.page.evaluate('__allowed=false;__emit()')
        self.assertTrue(self.page.locator('.classroom-google-import').is_hidden())

    def test_revocation_clears_card_receipts_and_print_sheet_immediately(self):
        self.create_cards()
        self.page.evaluate('window.print=()=>{}')
        self.page.locator('#googleRosterPrintCards').click()
        self.assertEqual(self.page.locator('.classroom-google-print-sheet').count(), 1)
        self.page.evaluate('__allowed=false;__emit()')
        self.assertEqual(self.page.evaluate('__import.getState().cardCount'), 0)
        self.assertEqual(self.page.locator('.classroom-google-print-sheet').count(), 0)
        self.assertEqual(self.page.title(), 'Coda fixture')
        self.assertNotIn('PRIVATE-CARD', self.page.locator('body').inner_text())
        self.assertNotIn('Alice Example', self.page.locator('body').inner_text())

    def test_pending_import_cannot_be_closed_and_retained_mount_preserves_cards(self):
        self.preview(); self.page.evaluate("__hold='import'")
        self.page.locator('#googleRosterImport').click()
        self.page.wait_for_function('typeof __release==="function"')
        self.assertFalse(self.page.evaluate('__import.close()'))
        self.page.evaluate('__release()'); self.idle()
        self.page.evaluate("()=>{const replacement=document.createElement('div');replacement.id='newHost';document.body.append(replacement);__import.mount(replacement);}")
        self.assertEqual(self.page.evaluate('__import.getState().cardCount'), 2)
        self.assertTrue(self.page.locator('#newHost #googleRosterPrintCards').is_visible())
        before = len(self.calls('disconnect'))
        self.page.evaluate("__identity='another_teacher';__import.mount(document.querySelector('#newHost'))")
        self.assertEqual(self.page.evaluate('__import.getState().cardCount'), 0)
        self.assertGreater(len(self.calls('disconnect')), before)

    def test_phone_roster_paginates_and_keeps_actions_reachable_without_overflow(self):
        self.page.set_viewport_size({'width':360,'height':800})
        self.page.evaluate("__students=Array.from({length:41},(_,index)=>({userId:'student-'+index,name:'Student Example '+index}))")
        self.preview()
        self.assertEqual(self.page.locator('.google-roster-row').count(), 20)
        self.page.locator('#googleRosterNext').click()
        self.assertIn('Student Example 20', self.page.locator('.google-roster-list').inner_text())
        self.assertEqual(self.page.locator('#googleRosterImport').inner_text(), 'Import 41 students')
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        self.assertGreaterEqual(self.page.locator('#googleRosterImport').bounding_box()['height'],48)

    def test_posting_requires_permission_preview_and_explicit_publish_with_only_new_recipients(self):
        self.enable_publishing(); self.create_cards()
        self.page.evaluate("__postExtras=Array.from({length:23},(_,index)=>({userId:'old-'+index,name:'Existing Student '+index,alias:'Blue Owl 27',status:index%2?'already-posted':'link-unavailable'}))")
        self.assertEqual(self.publishing_calls('permission'), [])
        self.assertEqual(self.publishing_calls('publish'), [])
        self.prepare_posts()
        self.assertEqual(len(self.publishing_calls('permission')), 1)
        self.assertEqual(len(self.publishing_calls('preview')), 1)
        self.assertEqual(self.publishing_calls('publish'), [])
        self.assertEqual(self.page.locator('#googleRosterPublishPosts').inner_text(), 'Publish 2 profile links')
        self.assertEqual(self.page.locator('.google-post-row').count(), 2)
        submitted = self.publishing_calls('preview')[0]['value']['cards']
        self.assertEqual([card['userId'] for card in submitted], ['student-1','student-2'])
        self.assertTrue(all('pass' not in card for card in submitted))
        self.assertNotIn('private-plan', self.page.evaluate('JSON.stringify(__import.getState())'))
        self.publish_posts()
        self.assertEqual(self.publishing_calls('publish')[0]['value']['confirmed'], True)
        self.assertEqual(self.page.evaluate('__posts.map(item=>item.userId)'), ['student-1','student-2'])
        self.assertTrue(self.page.locator('#googleRosterCardsSaved').is_checked())
        self.assertFalse(self.page.locator('#googleRosterRefresh').is_disabled())
        self.assertEqual(self.page.locator('#googleRosterPublishPosts').count(), 0)

    def test_partial_posting_retries_only_unsent_receipts_and_keeps_printable_cards(self):
        self.enable_publishing(); self.create_cards(); self.page.evaluate("__postMode='partial'")
        self.prepare_posts(); self.publish_posts()
        self.assertEqual(self.page.evaluate('__posts.length'), 1)
        self.assertEqual(self.page.evaluate('__import.getState().cardCount'), 2)
        self.assertFalse(self.page.locator('#googleRosterCardsSaved').is_checked())
        self.assertTrue(self.page.locator('#googleRosterRefresh').is_disabled())
        self.assertTrue(self.page.locator('#googleRosterPrintCards').is_visible())
        self.page.evaluate("__postMode='success'")
        self.prepare_posts()
        self.assertEqual([card['userId'] for card in self.publishing_calls('preview')[-1]['value']['cards']], ['student-2'])
        self.assertEqual(self.page.evaluate('__posts.length'), 1, 'Preparing a retry must never publish')
        self.assertEqual(self.page.locator('#googleRosterPublishPosts').inner_text(), 'Publish 1 profile link')
        self.publish_posts()
        self.assertEqual(self.page.evaluate('__posts.map(item=>item.userId)'), ['student-1','student-2'])
        self.assertTrue(self.page.locator('#googleRosterCardsSaved').is_checked())

    def test_uncertain_delivery_is_not_automatically_resent(self):
        self.enable_publishing(); self.create_cards(); self.page.evaluate("__postMode='uncertain'")
        self.prepare_posts(); self.publish_posts()
        self.assertEqual(self.page.evaluate('__posts.length'), 1)
        self.assertIn('will not resend', self.page.locator('.google-posting').inner_text())
        self.assertFalse(self.page.locator('#googleRosterCardsSaved').is_checked())
        self.prepare_posts()
        self.assertEqual(self.page.locator('#googleRosterPublishPosts').count(), 0)
        self.assertEqual(len(self.publishing_calls('publish')), 1)
        self.assertEqual(self.page.evaluate('__posts.length'), 1)
        self.assertTrue(self.page.locator('#googleRosterPrintCards').is_visible())

    def test_declining_posting_permission_keeps_the_new_cards_without_writing(self):
        self.enable_publishing(); self.create_cards(); self.page.evaluate("__publishError='oauth-denied'")
        self.prepare_posts()
        self.assertEqual(self.publishing_calls('preview'), [])
        self.assertEqual(self.publishing_calls('publish'), [])
        self.assertEqual(self.page.evaluate('__import.getState().cardCount'), 2)
        self.assertTrue(self.page.locator('#googleRosterPrintCards').is_visible())
        self.assertFalse(self.page.locator('#googleRosterCardsSaved').is_checked())

    def test_a_failed_new_posting_preview_invalidates_the_previous_confirmation(self):
        self.enable_publishing(); self.create_cards(); self.prepare_posts()
        self.assertTrue(self.page.locator('#googleRosterPublishPosts').is_visible())
        self.page.evaluate("__publishError='oauth-denied'")
        self.prepare_posts()
        self.assertEqual(self.page.locator('#googleRosterPublishPosts').count(), 0)
        self.assertEqual(self.publishing_calls('publish'), [])
        self.assertEqual(self.page.evaluate('__import.getState().cardCount'), 2)

    def test_pending_publish_blocks_close_and_unload_even_after_cards_were_printed(self):
        self.enable_publishing(); self.create_cards()
        self.page.locator('#googleRosterCardsSaved').check(); self.prepare_posts()
        self.page.evaluate("__publishHold='publish'")
        self.page.locator('#googleRosterPublishPosts').click()
        self.page.wait_for_function('typeof __releasePublishing==="function"')
        self.assertFalse(self.page.evaluate('__import.close()'))
        self.assertTrue(self.page.evaluate("()=>{const event=new Event('beforeunload',{cancelable:true});dispatchEvent(event);return event.defaultPrevented}"))
        self.page.evaluate('__releasePublishing()'); self.idle()
        self.assertTrue(self.page.evaluate('__import.close()'))

    def test_refresh_adds_only_new_unlinked_students_to_the_same_created_class(self):
        self.preview(); self.page.locator('#googleRosterChoice-1').select_option('skip')
        self.page.locator('#googleRosterImport').click(); self.idle()
        self.assertTrue(self.page.locator('#googleRosterRefresh').is_disabled())
        self.page.locator('#googleRosterCardsSaved').check()
        self.page.evaluate("""()=>{
          __status={'student-1':{status:'existing',profileId:'profile-new-1',alias:'Gold Owl 21'}};
          __students.push({userId:'student-3',name:'Claire Example'});
        }""")
        self.page.locator('#googleRosterRefresh').click(); self.idle()
        self.assertEqual(self.calls('preview')[-1]['value']['classId'], 'class-created')
        self.assertEqual(self.page.locator('#googleRosterTarget').input_value(), 'class-created')
        self.assertEqual(self.page.locator('#googleRosterChoice-0').count(), 0)
        self.assertEqual(self.page.locator('#googleRosterChoice-1').input_value(), 'skip', 'Previously skipped students stay skipped')
        self.assertEqual(self.page.locator('#googleRosterChoice-2').input_value(), 'create')
        self.assertEqual(self.page.locator('#googleRosterImport').inner_text(), 'Add 1 new profile')
        self.page.locator('#googleRosterImport').click(); self.idle()
        request = self.calls('import')[-1]['value']
        self.assertEqual(request['classId'], 'class-created')
        self.assertEqual(request['choices'], [{'userId':'student-1','action':'skip'},{'userId':'student-2','action':'skip'},{'userId':'student-3','action':'create'}])
        self.assertEqual(self.page.evaluate('__import.getState().cardCount'), 1)

    def test_fresh_existing_class_can_select_unlinked_students_without_touching_missing_profiles(self):
        self.page.evaluate("""()=>{
          __students.push({userId:'student-3',name:'Claire Example'});
          __status={'student-1':{status:'existing',profileId:'profile-one',alias:'Blue Owl 27'},'student-3':{status:'missing'}};
        }""")
        self.preview(existing=True)
        self.assertEqual(self.page.locator('#googleRosterChoice-1').input_value(), 'skip')
        self.page.locator('#googleRosterSelectUnlinked').click()
        self.assertEqual(self.page.locator('#googleRosterChoice-0').count(), 0)
        self.assertEqual(self.page.locator('#googleRosterChoice-1').input_value(), 'create')
        self.assertEqual(self.page.locator('#googleRosterChoice-2').input_value(), 'skip')
        self.assertEqual(self.page.locator('#googleRosterImport').inner_text(), 'Add 1 new profile')

    def test_repaired_profile_link_for_same_google_student_is_not_skipped_as_an_old_post(self):
        self.enable_publishing(); self.create_cards(); self.prepare_posts(); self.publish_posts()
        self.page.locator('#googleRosterDone').click()
        self.page.evaluate("__students=[{userId:'student-1',name:'Alice Example'}];__status={'student-1':{status:'missing'}}")
        self.preview(existing=True)
        self.page.locator('#googleRosterChoice-0').select_option('create')
        self.page.locator('#googleRosterImport').click(); self.idle()
        self.prepare_posts()
        self.assertEqual([card['userId'] for card in self.publishing_calls('preview')[-1]['value']['cards']], ['student-1'])
        self.assertTrue(self.page.locator('#googleRosterPublishPosts').is_visible())
        self.publish_posts()
        posts = self.page.evaluate('__posts')
        self.assertEqual([post['userId'] for post in posts], ['student-1','student-2','student-1'])
        self.assertNotEqual(posts[0]['link'], posts[2]['link'])

    def test_an_unreviewed_ready_recipient_prevents_publishing_the_plan(self):
        self.enable_publishing(); self.create_cards()
        self.page.evaluate("__postExtras=[{userId:'unexpected-student',name:'Wrong recipient',alias:'Blue Owl 27',status:'ready'}]")
        self.prepare_posts()
        self.assertEqual(self.page.locator('#googleRosterPublishPosts').count(), 0)
        self.assertEqual(self.publishing_calls('publish'), [])
        self.assertEqual(self.page.evaluate('__posts.length'), 0)
        self.assertEqual(self.page.evaluate('__import.getState().cardCount'), 2)


if __name__ == '__main__':
    unittest.main(verbosity=2)
