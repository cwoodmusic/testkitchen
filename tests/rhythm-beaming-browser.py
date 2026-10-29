"""Real Bravura heads, stems and metric beam grouping on the one-line staff."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML='''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/music-notation.css">
<style>*{box-sizing:border-box}body{margin:12px;background:#142239;color:#fff;font:16px system-ui}h1{font-size:22px}canvas{display:block;width:100%;max-width:1000px;height:auto;background:#182c43;border:1px solid #647e98;margin:14px 0}</style>
<h1>One beam for eighths · two for sixteenths</h1><canvas id="staff" width="1000" height="340"></canvas>
<script src="/music-notation.js"></script><script src="/rhythm-beaming.js"></script><script>
window.ink=[];window.results=[];
function notes(values){let onset=0;return values.map((value,index)=>{const rest=Array.isArray(value),duration=rest?value[0]:value;const item={id:'n'+index,onset,duration,rest};onset+=duration;return item;});}
window.paint=function(meter='4/4',values=null,offset=0){
 const canvas=document.querySelector('#staff'),g=canvas.getContext('2d');canvas.width=Math.round(canvas.getBoundingClientRect().width)||1000;canvas.height=340;g.clearRect(0,0,canvas.width,canvas.height);ink=[];results=[];
 const size=innerWidth<600?40:64,unit=Math.min(140,Math.max(70,canvas.width/7)),origin=innerWidth<600?64:120;
 const original=g.fillText.bind(g);g.fillText=function(value,...args){ink.push({glyph:value,font:this.font});return original(value,...args);};
 const rows=values?[values]:[[.5,.5],[.25,.25,.25,.25]];
 rows.forEach((sequence,index)=>{const y=115+index*155;g.strokeStyle='#49637b';g.beginPath();g.moveTo(14,y);g.lineTo(canvas.width-14,y);g.stroke();
 const events=notes(sequence),drawing=CodaRhythmBeaming.draw(g,{notes:events,meter,xForNote:note=>origin+note.onset*unit-offset,y,fontSize:size,left:25,right:canvas.width-12});
 results.push({drawing,origin,unit,size,y,events});});g.fillText=original;return results.map(row=>({groups:row.drawing.groups.map(group=>group.members.length),metrics:row.drawing.metrics}));
};
window.paintRests=function(meter='4/4',wholeBar=false){
 const canvas=document.querySelector('#staff'),g=canvas.getContext('2d');canvas.width=1000;canvas.height=250;g.clearRect(0,0,canvas.width,canvas.height);ink=[];
 const durations=wholeBar?[meter==='6/8'?3:4]:[4,2,1,.5,.25,1.5,.75];let onset=0;
 const events=durations.map((duration,index)=>{const note={id:'rest-'+index,onset,duration,rest:true};onset+=duration;if(wholeBar)Object.assign(note,{wholeBarRest:true,notationBeats:4});return note;});
 const original=g.fillText.bind(g);g.fillText=function(value,...args){ink.push({glyph:value,font:this.font});return original(value,...args);};
 const size=80,y=140,drawing=CodaRhythmBeaming.draw(g,{notes:events,meter,xForNote:(_,index)=>70+index*140,y,fontSize:size,left:0,right:1000});g.fillText=original;
 const bounds=events.map((note,index)=>{const left=index*140,data=g.getImageData(left,0,140,250).data;let x0=140,y0=250,x1=-1,y1=-1,count=0;for(let yy=0;yy<250;yy++)for(let xx=0;xx<140;xx++)if(data[(yy*140+xx)*4+3]){x0=Math.min(x0,xx);x1=Math.max(x1,xx);y0=Math.min(y0,yy);y1=Math.max(y1,yy);count++;}return {x0,x1,y0,y1,count};});
 return {glyphs:ink.map(item=>item.glyph),fonts:ink.map(item=>item.font),bounds,y,groups:drawing.groups.length,durations:events.map(note=>note.duration)};
};
window.ready=CodaMusicNotation.load().then(ready=>{paint();return ready;});
window.alpha=(x,y)=>staff.getContext('2d').getImageData(Math.round(x),Math.round(y),1,1).data[3];
</script></html>'''

class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):
        if self.path!='/beaming-fixture':return super().do_GET()
        self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.end_headers();self.wfile.write(HTML.encode())

class RhythmBeamingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)));threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.playwright=sync_playwright().start();cls.browser=cls.playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    @classmethod
    def tearDownClass(cls):cls.browser.close();cls.playwright.stop();cls.server.shutdown();cls.server.server_close()
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1100,'height':800});self.page=self.context.new_page();self.errors=[];self.failures=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)));self.page.on('response',lambda response:self.failures.append(response.url) if response.status>=400 and not response.url.endswith('favicon.ico') else None)
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/beaming-fixture');self.assertTrue(self.page.evaluate('ready'))
    def tearDown(self):self.context.close();self.assertEqual(self.errors,[]);self.assertEqual(self.failures,[])
    def test_actual_note_font_has_one_eighth_beam_and_two_sixteenth_beams_without_individual_flags(self):
        values=self.page.evaluate('''()=>results.map(row=>{
          const metric=row.drawing.metrics,x=row.origin+row.unit*.25+metric.stemCenter;
          return {primary:alpha(x,metric.beamTop+metric.beamThickness/2),secondary:alpha(x,metric.secondaryTop+metric.beamThickness/2)};
        })''')
        self.assertGreater(values[0]['primary'],200);self.assertEqual(values[0]['secondary'],0)
        self.assertGreater(values[1]['primary'],200);self.assertGreater(values[1]['secondary'],200)
        glyphs=self.page.evaluate('ink.map(item=>item.glyph)');self.assertEqual(glyphs.count('\ue1d5'),6)
        self.assertNotIn('\ue1d7',glyphs);self.assertNotIn('\ue1d9',glyphs)
        self.assertTrue(self.page.evaluate('ink.every(item=>/CodaBravura/.test(item.font))'))
        self.page.locator('#staff').screenshot(path='/tmp/coda-rhythm-beams32.png')
    def test_compound_and_cut_time_show_spaces_between_their_actual_pulse_groups(self):
        for meter,count,length in [('4/4',8,2),('6/8',6,3),('2/2',8,4)]:
            metrics=self.page.evaluate('''({meter,count})=>{paint(meter,Array(count).fill(.5));const row=results[0],metric=row.drawing.metrics,first=row.drawing.groups[0],last=first.members.at(-1).onset,next=row.drawing.groups[1].members[0].onset;
              return {groups:row.drawing.groups.map(group=>group.members.length),gap:alpha(row.origin+(last+next)*row.unit/2+metric.stemCenter,metric.beamTop+metric.beamThickness/2)};}''',{'meter':meter,'count':count})
            self.assertEqual(metrics['groups'],[length]*(count//length));self.assertEqual(metrics['gap'],0,meter+' should separate big beats')
    def test_dotted_and_mixed_groups_have_short_secondary_beamlets_and_rests_break_the_line(self):
        metrics=self.page.evaluate('''()=>{paint('4/4',[.75,.25]);const row=results[0],m=row.drawing.metrics,y=m.secondaryTop+m.beamThickness/2;
          return {near:alpha(row.origin+.75*row.unit+m.stemCenter-8,y),far:alpha(row.origin+.2*row.unit+m.stemCenter,y),glyphs:ink.map(item=>item.glyph)};}''')
        self.assertGreater(metrics['near'],200);self.assertEqual(metrics['far'],0);self.assertIn('\ue1e7',metrics['glyphs'])
        values=self.page.evaluate("paint('4/4',[.25,[.25],.5]);({groups:results[0].drawing.groups.length,glyphs:ink.map(item=>item.glyph)})")
        self.assertEqual(values['groups'],0);self.assertIn('\ue1d9',values['glyphs']);self.assertIn('\ue4e7',values['glyphs']);self.assertIn('\ue1d7',values['glyphs'])
    def test_scrolling_clips_complete_groups_and_phone_layout_does_not_overflow(self):
        for viewport in [{'width':390,'height':844},{'width':844,'height':390}]:
            self.page.set_viewport_size(viewport)
            actual=self.page.evaluate("paint('6/8',[.5,.5,.5],100);({groups:results[0].drawing.groups.map(group=>group.members.length),glyphs:ink.map(item=>item.glyph),width:document.documentElement.scrollWidth,viewport:innerWidth})")
            self.assertEqual(actual['groups'],[3]);self.assertLessEqual(actual['width'],actual['viewport']);self.assertNotIn('\ue1d7',actual['glyphs']);self.assertTrue(self.page.evaluate('CodaMusicNotation.isReady()'))

    def test_whole_half_quarter_eighth_and_sixteenth_rests_use_actual_font_ink(self):
        actual=self.page.evaluate('paintRests()')
        self.assertEqual(actual['glyphs'],['\ue4e3','\ue4e4','\ue4e5','\ue4e6','\ue4e7','\ue4e5','\ue1e7','\ue4e6','\ue1e7'])
        self.assertEqual(actual['groups'],0)
        self.assertTrue(all('CodaBravura' in font for font in actual['fonts']))
        self.assertTrue(all(bounds['count']>50 for bounds in actual['bounds']),actual['bounds'])
        # The two rectangular rests share the same horizontal anchor but sit on
        # opposite sides of the one-line staff's musical baseline.
        whole,half=actual['bounds'][:2]
        self.assertGreater(whole['y0'],half['y0'])
        self.assertAlmostEqual((whole['x0']+whole['x1'])/2,70,delta=2)
        self.assertAlmostEqual((half['x0']+half['x1'])/2,70,delta=2)
        self.page.locator('#staff').screenshot(path='/tmp/coda-fishing-rests34.png')

    def test_full_bar_rests_keep_the_whole_symbol_in_compound_and_cut_time(self):
        rasters=[]
        for meter,beats in [('4/4',4),('6/8',3),('2/2',4)]:
            actual=self.page.evaluate('meter=>paintRests(meter,true)',meter)
            self.assertEqual(actual['glyphs'],['\ue4e3'],meter+' must not add a dot or substitute a half rest')
            self.assertEqual(actual['durations'],[beats])
            self.assertEqual(actual['groups'],0)
            self.assertGreater(actual['bounds'][0]['count'],50)
            rasters.append(self.page.locator('#staff').evaluate("canvas=>Array.from(canvas.getContext('2d').getImageData(0,0,140,250).data)"))
        self.assertEqual(rasters[0],rasters[1]);self.assertEqual(rasters[1],rasters[2])

if __name__=='__main__':unittest.main(verbosity=2)
