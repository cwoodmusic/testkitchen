/* SMuFL notation rendered with the bundled, SIL Open Font License Bravura font.
 * Font size is four staff spaces; all note positions refer to notehead centres. */
(function(root,factory){const value=factory(root);if(typeof module==='object'&&module.exports)module.exports=value;if(root)root.CodaMusicNotation=value;})(typeof window==='undefined'?null:window,function(root){
 'use strict';
 const FAMILY='CodaBravura';
 const CODES=Object.freeze({gClef:0xe050,fClef:0xe062,noteheadWhole:0xe0a2,noteheadHalf:0xe0a3,noteheadBlack:0xe0a4,
  noteWhole:0xe1d2,noteHalfUp:0xe1d3,noteHalfDown:0xe1d4,noteQuarterUp:0xe1d5,noteQuarterDown:0xe1d6,note8thUp:0xe1d7,note8thDown:0xe1d8,note16thUp:0xe1d9,note16thDown:0xe1da,
  augmentationDot:0xe1e7,restWhole:0xe4e3,restHalf:0xe4e4,restQuarter:0xe4e5,rest8th:0xe4e6,rest16th:0xe4e7,timeSigCommon:0xe08a,timeSigCutCommon:0xe08b,tuplet3:0xe883});
 const glyph=name=>Number.isInteger(CODES[name])?String.fromCodePoint(CODES[name]):'';
 const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;
 const xml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
 const ink=value=>typeof value==='string'&&(/^(#[0-9a-f]{3,8}|[a-z]+)$/i.test(value))?value:'currentColor';
 function symbol(beats,options={}){
  const rest=options.rest===true,stem=options.stem==='down'?'down':'up';let base=Number(beats),dots=0;
  // Durations are quarter-note units, independently of the meter's main pulse.
  const durations=[4,2,1,.5,.25];
  if(!durations.some(value=>Math.abs(base-value)<.00001)){
   const dotted=durations.find(value=>Math.abs(base-value*1.5)<.00001);
   if(dotted){base=dotted;dots=1;}else if(Math.abs(base-1/3)<.00001){base=.5;}else if(Math.abs(base-2/3)<.00001){base=1;}else base=1;
  }
  const type=base===4?'Whole':base===2?'Half':base===1?'Quarter':base===.5?'8th':'16th';
  const name=rest?'rest'+type:base===4?'noteWhole':'note'+type+(stem==='down'?'Down':'Up');
  return {name,char:glyph(name),codepoint:CODES[name],beats:Number(beats),baseBeats:base,dots,rest,stem,tuplet:Math.abs(Number(beats)-1/3)<.00001||Math.abs(Number(beats)-2/3)<.00001?3:null};
 }
 // These complete-note glyphs have a .332 em head (.341 for half notes).
 // Centre the head, rather than the advance width that also includes flags.
 function originOffset(item){return item.rest?({restWhole:.1415,restHalf:.1415,restQuarter:.1355,rest8th:.125,rest16th:.16}[item.name]||.15):item.baseBeats===4?.2295:item.baseBeats===2?.1705:.166;}
 function drawRhythm(ctx,options={}){
  if(!ctx)return null;const item=symbol(options.beats??1,options),size=Math.max(12,finite(options.fontSize,56)),x=finite(options.x,0),y=finite(options.y,0);
  ctx.save();ctx.font=size+'px "'+FAMILY+'"';ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillStyle=options.color||'#f9efff';
  ctx.fillText(item.char,x-originOffset(item)*size,y);
  for(let at=0;at<item.dots;at++)ctx.fillText(glyph('augmentationDot'),x+(item.baseBeats===4?.31:.27)*size+at*.15*size,y-(options.dotOnLine===false?0:.125*size));
  if(item.tuplet||options.tuplet===3)ctx.fillText(glyph('tuplet3'),x-.15*size,y-.94*size);
  ctx.restore();return item;
 }
 function drawTimeSignature(ctx,options={}){
  if(!ctx)return;const size=Math.max(12,finite(options.fontSize,56)),x=finite(options.x,0),y=finite(options.y,0),meter=options.meter||'4/4';
  ctx.save();ctx.font=size+'px "'+FAMILY+'"';ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillStyle=options.color||'#f9efff';
  if(meter==='2/2'||meter==='cut')ctx.fillText(glyph('timeSigCutCommon'),x,y);
  else{const parts=meter==='6/8'?[6,8]:[4,4];ctx.fillText(String.fromCodePoint(0xe080+parts[0]),x,y-size*.285);ctx.fillText(String.fromCodePoint(0xe080+parts[1]),x,y+size*.285);}
  ctx.restore();
 }
 function glyphSVG(beats,options={}){
  const item=symbol(beats,options),colour=ink(options.colour||options.color||'currentColor'),size=46,x=19,y=item.stem==='down'?19:46;
  const dot=item.dots?'<text class="coda-music-glyph" x="'+(x+size*.27)+'" y="'+(y-size*.125)+'" font-size="'+size+'">'+glyph('augmentationDot')+'</text>':'';
  return '<svg class="coda-note-symbol" viewBox="0 0 48 62" width="30" height="36" aria-hidden="true" focusable="false" fill="'+xml(colour)+'"><text class="coda-music-glyph" x="'+(x-originOffset(item)*size)+'" y="'+y+'" font-size="'+size+'">'+item.char+'</text>'+dot+'</svg>';
 }
 function staffSVG(position,options={}){
  position=Math.max(-4,Math.min(14,Math.round(finite(position,0))));const y=125-position*10,down=position>=4,item=symbol(1,{stem:down?'down':'up'}),noteX=203-originOffset(item)*80;
  let ledgers='';if(position<0)for(let p=-2;p>=position;p-=2)ledgers+='<path d="M184 '+(125-p*10)+'H224" class="staff-ledger"/>';if(position>8)for(let p=10;p<=position;p+=2)ledgers+='<path d="M184 '+(125-p*10)+'H224" class="staff-ledger"/>';
  return '<svg class="lesson-staff coda-notated-staff" viewBox="0 0 340 180" role="img" aria-label="'+xml(options.label||('Treble staff. '+(position%2?'A note in a space.':'A note on a line.')))+'"><rect x="1" y="1" width="338" height="178" rx="12" fill="#f9f2df"/><g fill="none" stroke="#5f526d" stroke-width="1.5">'+[45,65,85,105,125].map(line=>'<path class="staff-line" d="M22 '+line+'H320"/>').join('')+ledgers+'</g><text class="coda-music-glyph staff-clef" x="36" y="105" font-size="80" fill="#493458">'+glyph('gClef')+'</text><text class="coda-music-glyph staff-note" x="'+noteX+'" y="'+y+'" font-size="80" fill="#823997" data-staff-position="'+position+'" data-stem="'+item.stem+'">'+item.char+'</text></svg>';
 }
 const loads=new WeakMap();
 function load(doc=root?.document){
  if(!doc?.fonts?.load)return Promise.resolve(false);if(loads.has(doc))return loads.get(doc);
  const promise=doc.fonts.load('80px "'+FAMILY+'"',glyph('gClef')+glyph('noteQuarterUp')).then(faces=>faces.length>0&&doc.fonts.check('80px "'+FAMILY+'"',glyph('gClef'))).catch(()=>false);loads.set(doc,promise);return promise;
 }
 function isReady(doc=root?.document){return !!doc?.fonts&&Array.from(doc.fonts).some(face=>face.family.replace(/["']/g,'')===FAMILY&&face.status==='loaded')&&doc.fonts.check('80px "'+FAMILY+'"',glyph('gClef'));}
 return {FAMILY,CODES,glyph,symbol,drawRhythm,drawTimeSignature,glyphSVG,staffSVG,load,ready:load(),isReady};
});
