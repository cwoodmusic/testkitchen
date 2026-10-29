const test=require('node:test'),assert=require('node:assert/strict'),songs=require('../song-machine/composition.js'),library=require('../dj-library.js');
const song=()=>({bpm:110,meter:'4/4',bars:4,root:0,scale:'major',tracks:[{id:1,name:'Melody',sound:17,clef:'treble',volume:.7,mute:false,notes:[{p:72,t:0,d:3.3}]}],drums:[0,1,2].map(()=>({sound:0,volume:.5,mute:false,notes:[]}))});

test('portable song normalization preserves valid notes, imported voices and hidden later bars',()=>{
 const value=song();value.bars=1;value.meter='2/4';value.tracks[0].notes.push({p:36,t:383,d:1});
 const clean=songs.normalize(value);assert.deepEqual(clean,value);assert.notEqual(clean,value);assert.notEqual(clean.tracks[0].notes,value.tracks[0].notes);
 clean.tracks[0].notes[0].p=1;assert.equal(value.tracks[0].notes[0].p,72);
});

test('all original jukebox arrangements import with their real fractional note lengths',()=>{
 for(const record of library.songs){const clean=songs.normalize(record.composition);assert.equal(clean.tracks.length,record.composition.tracks.length);assert.deepEqual(clean.tracks.map(track=>track.notes),record.composition.tracks.map(track=>track.notes));assert.deepEqual(clean.drums,record.composition.drums);}
});

test('malformed compositions are rejected before they can replace a working song',()=>{
 const variants=[null,[],{...song(),bpm:null},{...song(),bars:1.5},{...song(),meter:'7/13'},{...song(),drums:[]},{...song(),tracks:[{}]},
  {...song(),tracks:[{...song().tracks[0],sound:99}]},{...song(),tracks:[{...song().tracks[0],volume:3}]},
  {...song(),tracks:[{...song().tracks[0],notes:[{p:1.2,t:0,d:4}]}]},
  {...song(),tracks:[{...song().tracks[0],notes:[{p:72,t:-1,d:4}]}]},
  {...song(),tracks:[{...song().tracks[0],notes:[{p:72,t:0,d:0}]}]},
  {...song(),tracks:[{...song().tracks[0],notes:[{p:72,t:384,d:4}]}]},
  {...song(),tracks:[song().tracks[0],song().tracks[0]]},
  {...song(),tracks:new Array(1)},{...song(),drums:new Array(3)},
  {...song(),tracks:[{...song().tracks[0],notes:new Array(1)}]}];
 for(const value of variants){assert.equal(songs.validate(value),false,JSON.stringify(value));assert.throws(()=>songs.normalize(value));}
 const tooMany=song();tooMany.tracks[0].notes=Array.from({length:songs.MAX_NOTES+1},()=>({p:72,t:0,d:4}));assert.equal(songs.validate(tooMany),false);
});

test('legacy optional settings receive safe defaults and metadata cannot enter the live state',()=>{
 const value=song();delete value.tracks[0].clef;delete value.tracks[0].mute;delete value.root;value.scale='unknown';value.extra={private:'do not carry arbitrary metadata'};
 const clean=songs.normalize(value);assert.equal(clean.tracks[0].clef,'treble');assert.equal(clean.tracks[0].mute,false);assert.equal(clean.root,0);assert.equal(clean.scale,'chromatic');assert.equal(Object.hasOwn(clean,'extra'),false);
});
