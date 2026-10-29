const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const keyboard=require('../classroom-keyboard.js');

test('the keyboard has eight ordered white keys and real two-and-three black-key groups',()=>{
 const svg=keyboard.toSVG({kind:'keyboard'});
 assert.deepEqual([...svg.matchAll(/data-piano-white="([A-G])"/g)].map(match=>match[1]),['C','D','E','F','G','A','B','C']);
 const blacks=[...svg.matchAll(/data-piano-black="([A-G]-sharp)"[^>]* x="(\d+)"/g)];
 assert.deepEqual(blacks.map(match=>match[1]),['C-sharp','D-sharp','F-sharp','G-sharp','A-sharp']);
 assert.deepEqual(blacks.map(match=>Number(match[2])),[87,167,327,407,487]);
 assert.match(svg,/data-piano-group="2"/);assert.match(svg,/data-piano-group="3"/);
 assert.match(svg,/Lower sounds/);assert.match(svg,/Higher sounds/);
 assert.doesNotMatch(svg,/data-piano-highlight/,'A key map does not highlight the answer by default');
});

test('sharp and flat spellings highlight the same physical key without changing the white-key map',()=>{
 for(const note of ['D-sharp','E-flat']){
  const svg=keyboard.toSVG({kind:'keyboard',notes:[note]});
  assert.match(svg,/data-piano-black="D-sharp"[^>]*data-piano-highlight="true"/);
  assert.equal((svg.match(/data-piano-highlight="true"/g)||[]).length,1);
  assert.match(svg,new RegExp('>'+note.replace('-sharp','♯').replace('-flat','♭')+'</text>'));
 }
 const white=keyboard.toSVG({kind:'keyboard',notes:['C','F']});
 assert.equal((white.match(/data-piano-highlight="true"/g)||[]).length,3,'Both octave Cs are the named C key');
});

test('keyboard descriptions are escaped and invalid visual data cannot become SVG markup',()=>{
 const svg=keyboard.toSVG({kind:'keyboard',notes:['F-sharp'],label:'Find <keys> & "names"'});
 assert.match(svg,/role="img"/);assert.match(svg,/aria-label="Find &lt;keys&gt; &amp; &quot;names&quot;/);
 assert.doesNotMatch(svg,/<keys>|<script|onload=|foreignObject/);
 for(const bad of [null,[],{kind:'staff'},{kind:'keyboard',notes:['C" onload="x']},{kind:'keyboard',notes:['H']},{kind:'keyboard',notes:Array(17).fill('C')},{kind:'keyboard',onclick:'x'},{kind:'keyboard',label:''}]){
  assert.equal(keyboard.validateVisual(bad).ok,false);assert.equal(keyboard.toSVG(bad),'');
 }
 const source={kind:'keyboard',notes:['C','C']},checked=keyboard.validateVisual(source);
 assert.deepEqual(checked.data.notes,['C']);checked.data.notes.push('D');assert.deepEqual(source.notes,['C','C']);
});

test('the browser exposes the same keyboard renderer without storage, audio or network dependencies',()=>{
 const window={};vm.runInNewContext(fs.readFileSync(require.resolve('../classroom-keyboard.js'),'utf8'),{window});
 assert.equal(window.CodaClassroomKeyboard.toSVG({kind:'keyboard'}),keyboard.toSVG({kind:'keyboard'}));
 assert.ok(Object.isFrozen(window.CodaClassroomKeyboard));
});

test('authors can hide key names and captions while retaining the piano geometry and highlights',()=>{
 const svg=keyboard.toSVG({kind:'keyboard',notes:['F-sharp'],showLabels:false,showGroups:false,showDirections:false});
 assert.equal((svg.match(/data-piano-white=/g)||[]).length,8);
 assert.equal((svg.match(/data-piano-black=/g)||[]).length,5);
 assert.equal((svg.match(/data-piano-highlight=/g)||[]).length,1);
 assert.doesNotMatch(svg,/data-keyboard-white-label|data-piano-group|data-keyboard-direction|>F♯<|Lower sounds|Higher sounds/);
 assert.match(svg,/unlabeled white keys/);
});

test('custom image captions survive validation, escape markup and reject unbounded or unknown fields',()=>{
 const visual={kind:'keyboard',notes:[],groupLabels:{two:'Pair <two>',three:'Triple & three'},directionLabels:{lower:'Left "low"',higher:'Right > high'}};
 const checked=keyboard.validateVisual(visual);assert.equal(checked.ok,true);assert.deepEqual(checked.data,visual);
 const svg=keyboard.toSVG(visual);assert.match(svg,/>Pair &lt;two&gt;<\/text>/);assert.match(svg,/>Triple &amp; three<\/text>/);assert.match(svg,/>Left &quot;low&quot;<\/text>/);
 assert.doesNotMatch(svg,/<two>/);
 for(const bad of [{showLabels:0},{showGroups:'false'},{showDirections:null},{groupLabels:{two:'Only one'}},{groupLabels:{two:'Two',three:'Three',html:'unsafe'}},{directionLabels:{lower:'x'.repeat(81),higher:'High'}},{directionLabels:[]}])assert.equal(keyboard.validateVisual({kind:'keyboard',...bad}).ok,false);
 checked.data.groupLabels.two='Changed';assert.equal(visual.groupLabels.two,'Pair <two>');
});
