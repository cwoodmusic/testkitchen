const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const notation=require('../music-notation.js');
test('notation uses authoritative SMuFL Bravura glyphs, including actual rests and cut time',()=>{
 assert.equal(notation.glyph('gClef'),'\ue050');assert.equal(notation.symbol(1).char,'\ue1d5');
 assert.equal(notation.symbol(.5).char,'\ue1d7');assert.equal(notation.symbol(.25).char,'\ue1d9');
 assert.equal(notation.symbol(4,{rest:true}).char,'\ue4e3');assert.equal(notation.symbol(1,{rest:true}).char,'\ue4e5');
 assert.equal(notation.glyph('timeSigCutCommon'),'\ue08b');assert.equal(notation.symbol(1,{stem:'down'}).name,'noteQuarterDown');
});
test('notation durations remain quarter-note units across simple, compound, and cut-time meters',()=>{
 for(const [beats,base]of [[3,2],[1.5,1],[.75,.5],[.375,.25]]){const value=notation.symbol(beats);assert.equal(value.dots,1);assert.equal(value.baseBeats,base);}
 assert.equal(notation.symbol(1/3).tuplet,3);assert.equal(notation.symbol(2).dots,0);
 assert.ok(notation.glyphSVG(1.5).includes(notation.glyph('augmentationDot')));
});
test('staffs use five measured lines and Bravura clef/notes anchored to the musical baseline',()=>{
 for(const position of [0,1,2,3,4,5]){const svg=notation.staffSVG(position);assert.equal((svg.match(/class="staff-line"/g)||[]).length,5);assert.match(svg,/class="coda-music-glyph staff-clef" x="36" y="105"/);assert.ok(svg.includes('\ue050'));
  assert.ok(svg.includes('y="'+(125-position*10)+'" font-size="80" fill="#823997"'));assert.ok(svg.includes('data-stem="'+(position>=4?'down':'up')+'"'));assert.doesNotMatch(svg,/<ellipse|C78|C82/);}
 assert.equal((notation.staffSVG(-2).match(/class="staff-ledger"/g)||[]).length,1);
});
test('canvas notation places a note at its onset and emits actual compound/cut meter glyphs',()=>{
 const calls=[],ctx={save(){},restore(){},fillText(...values){calls.push({values,font:this.font,baseline:this.textBaseline});}};
 notation.drawRhythm(ctx,{x:120,y:80,beats:.75,fontSize:56});assert.equal(calls[0].values[0],'\ue1d7');assert.equal(calls[0].values[2],80);assert.match(calls[0].font,/CodaBravura/);assert.equal(calls[1].values[0],'\ue1e7');
 calls.length=0;notation.drawTimeSignature(ctx,{x:20,y:60,meter:'6/8'});assert.deepEqual(calls.map(c=>c.values[0]),['\ue086','\ue088']);
 calls.length=0;notation.drawTimeSignature(ctx,{x:20,y:60,meter:'2/2'});assert.deepEqual(calls.map(c=>c.values[0]),['\ue08b']);
});
test('the real music font and its redistributable license are self hosted',()=>{
 const font=fs.readFileSync(path.join(__dirname,'../assets/fonts/bravura/Bravura.woff2'));assert.equal(font.toString('ascii',0,4),'wOF2');assert.ok(font.length>300000);
 assert.match(fs.readFileSync(path.join(__dirname,'../assets/fonts/bravura/OFL.txt'),'utf8'),/SIL OPEN FONT LICENSE/);
 const css=fs.readFileSync(path.join(__dirname,'../music-notation.css'),'utf8');assert.match(css,/@font-face/);assert.match(css,/Bravura\.woff2/);assert.doesNotMatch(css,/https?:\/\//);
});
