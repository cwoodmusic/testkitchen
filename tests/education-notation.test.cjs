const test=require('node:test'),assert=require('node:assert/strict');
const notation=require('../education-notation.js');
const note=(position=4,fields={})=>({type:'note',position,duration:1,dots:0,accidental:'none',staff:'treble',...fields});
const score=(items=[],fields={})=>({version:1,clef:'treble',meter:'4/4',items,...fields});

test('notation validates a bounded typed score and rejects active or unknown input',()=>{
 const valid=score([note(),{type:'rest',duration:.5,dots:1,staff:'bass'},{type:'bar'},{type:'repeat-start'},{type:'repeat-end'},{type:'clef',clef:'bass',staff:'treble'}],{clef:'grand',meter:'6/8'});
 assert.deepEqual(notation.validate(valid),{ok:true,data:valid});
 const malformed=[null,[],{...valid,svg:'<script/>'},{...valid,clef:'<img>'},{...valid,meter:'7/9'},{...valid,items:Array.from({length:65},()=>note())},score([note(21)]),score([note(-13)]),score([note(0,{duration:3})]),score([note(0,{dots:2})]),score([note(0,{accidental:'onclick'})]),score([{type:'rest',duration:1,dots:0,staff:'treble',position:0}]),score([{type:'clef',clef:'grand',staff:'treble'}]),score([{type:'bar',onclick:'alert(1)'}]),score([{type:'script'}])];
 for(const value of malformed){assert.equal(notation.validate(value).ok,false,JSON.stringify(value));assert.equal(notation.toSVG(value),'');}
 assert.deepEqual(notation.normalize(null),{version:1,clef:'treble',meter:null,items:[]});
});

test('notation conversions preserve staff positions, rests, dots and the two Middle C locations',()=>{
 const bass=notation.fromVisual({kind:'staff',position:10,clef:'bass',grand:true});assert.equal(bass.clef,'grand');assert.equal(bass.items[0].position,10);assert.equal(bass.items[0].staff,'bass');
 const pair=notation.fromVisual({kind:'middle-c-pair'});assert.equal(pair.clef,'grand');assert.deepEqual(pair.items.map(item=>[item.staff,item.position]),[['treble',-2],['bass',10]]);
 const rhythm=notation.fromVisual({kind:'rhythm',meter:'6/8',notes:[{beats:1.5},{beats:.75,rest:true},{beats:.25}]});assert.equal(rhythm.meter,'6/8');assert.deepEqual(rhythm.items.map(item=>[item.type,item.duration,item.dots]),[['note',1,1],['rest',.5,1],['note',.25,0]]);
 assert.equal(notation.fromVisual({kind:'meter',meter:'2/2'}).meter,'2/2');assert.deepEqual(notation.fromVisual(undefined),notation.normalize(null));
});

test('a staff uses five measured lines, a clef, metrical glyphs and real Bravura notes',()=>{
 const svg=notation.toSVG(score([note(0),note(3,{duration:2,dots:1,accidental:'flat'}),note(10,{duration:4})]));
 assert.equal((svg.match(/class="education-staff-line"/g)||[]).length,5);
 for(const glyph of ['\ue050','\ue084','\ue1d5','\ue1d3','\ue1d2','\ue260','\ue1e7'])assert.ok(svg.includes(glyph),'Missing SMuFL glyph '+glyph.codePointAt(0).toString(16));
 assert.match(svg,/class="education-ledger"/);assert.match(svg,/data-score-accidental="flat"/);assert.doesNotMatch(svg,/<ellipse/);
});

test('grand staff repeats span both staves and bass clefs sit on the F line',()=>{
 const svg=notation.toSVG(score([{type:'repeat-start'},note(-2),note(10,{staff:'bass'}),{type:'bar'},{type:'repeat-end'}],{clef:'grand',meter:'2/2'}));
 assert.equal((svg.match(/class="education-staff-line"/g)||[]).length,10);assert.ok(svg.includes('\ue050'));assert.ok(svg.includes('\ue062'));assert.ok(svg.includes('\ue08b'));
 assert.match(svg,/x="34" y="297"[^>]*data-score-clef-sign="bass"/);assert.equal((svg.match(/<circle/g)||[]).length,8,'Each repeat has two dots on each staff');
});

test('short notes beam by the selected meter and stop at rests, bars, and clef changes',()=>{
 const eighths=Array.from({length:6},()=>note(2,{duration:.5}));
 assert.equal((notation.toSVG(score(eighths,{meter:'6/8'})).match(/class="education-beam"/g)||[]).length,2,'6/8 groups three eighths per dotted-quarter beat');
 const cut=Array.from({length:8},()=>note(5,{duration:.5}));assert.equal((notation.toSVG(score(cut,{meter:'2/2'})).match(/class="education-beam"/g)||[]).length,2,'Cut time groups four eighths per half-note beat');
 for(const stop of [{type:'rest',duration:.5,dots:0,staff:'treble'},{type:'bar'},{type:'clef',clef:'bass',staff:'treble'}]){
  const svg=notation.toSVG(score([note(1,{duration:.5}),stop,note(3,{duration:.5})]));assert.equal((svg.match(/class="education-beam"/g)||[]).length,0);
 }
});

test('extreme notes get ledger lines and remain inside the score picture without changing the input',()=>{
 const value=score([note(-12),note(20),note(1,{duration:.25,accidental:'natural'})]),before=JSON.stringify(value),svg=notation.toSVG(value,{label:'Teacher <score> & "notes"'});
 assert.equal(JSON.stringify(value),before);assert.match(svg,/aria-label="Teacher &lt;score&gt; &amp; &quot;notes&quot;"/);assert.equal((svg.match(/class="education-ledger"/g)||[]).length,12);
 const height=Number(svg.match(/viewBox="0 0 [0-9]+ ([0-9]+)"/)[1]);assert.ok(height>=300);assert.ok(svg.includes('\ue261'));
 assert.doesNotMatch(svg,/<script|onload=|foreignObject/);
});

test('returned scores are independent copies and the untouched picture contains no editor selection',()=>{
 const value=score([note()]),converted=notation.fromVisual({kind:'notation',score:value});converted.items[0].position=10;assert.equal(value.items[0].position,4);
 const normal=notation.toSVG(value),editing=notation.toSVG(value,{interactive:true,selected:0});assert.doesNotMatch(normal,/data-notation-canvas|stroke-dasharray/);assert.match(editing,/data-notation-canvas/);assert.match(editing,/stroke-dasharray/);
});
