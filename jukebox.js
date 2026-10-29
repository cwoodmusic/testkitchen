// Original procedural chip-rave loops, synthesized locally with Web Audio.
const jukebox=(()=>{
const tracks=[{name:'Neon Circuit',bpm:128,root:45,scale:[0,3,7,10],lead:[0,7,12,10,7,3,10,7],wave:'square'}, {name:'Pixel Afterparty',bpm:136,root:42,scale:[0,5,7,10],lead:[12,7,5,0,10,7,12,15],wave:'triangle'}, {name:'Laser Lemonade',bpm:124,root:48,scale:[0,4,7,11],lead:[0,4,7,12,11,7,4,7],wave:'square'}, {name:'Midnight Mainframe',bpm:140,root:38,scale:[0,3,5,10],lead:[0,12,10,5,3,10,12,7],wave:'sawtooth'}, {name:'Disco.exe',bpm:132,root:47,scale:[0,3,7,9],lead:[7,12,15,12,9,7,3,0],wave:'triangle'}];
let ac,master,compressor,noiseBuffer,timer,next=0,step=0,playing=false,selected=0,volume=.32,beatOrigin=0;const voices=new Set();
const freq=n=>440*2**((n-69)/12);
function init(){if(ac)return;const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('Audio is unavailable in this browser.');ac=new Audio();master=ac.createGain();master.gain.value=volume*.65;compressor=ac.createDynamicsCompressor();compressor.threshold.value=-15;compressor.ratio.value=5;master.connect(compressor);compressor.connect(ac.destination);noiseBuffer=ac.createBuffer(1,ac.sampleRate*.3,ac.sampleRate);const samples=noiseBuffer.getChannelData(0);let seed=42;for(let i=0;i<samples.length;i++){seed=(seed*16807)%2147483647;samples[i]=seed/1073741824-1}}
function register(source){voices.add(source);source.onended=()=>voices.delete(source)}
function tone(note,t,duration,type,level,slide){const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(freq(note),t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+.12);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(level,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(master);register(o);o.start(t);o.stop(t+duration+.02)}
function noise(t,duration,level,cutoff){const n=ac.createBufferSource(),g=ac.createGain(),f=ac.createBiquadFilter();n.buffer=noiseBuffer;f.type='highpass';f.frequency.value=cutoff;g.gain.setValueAtTime(level,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);n.connect(f);f.connect(g);g.connect(master);register(n);n.start(t);n.stop(t+duration)}
// Sixteen bars of 4/4: 16 sixteenths per bar, 256 steps per loop.
function arrangement(position,track){
 const n=((position%256)+256)%256,bar=Math.floor(n/16),beat=n%16,section=Math.floor(bar/4);
 const progressions=[[0,0,5,7],[0,5,3,7],[0,3,5,7],[5,3,7,0]];
 const chord=progressions[section][bar%4];
 const riffIndex=(Math.floor(beat/2)+(bar%2?2:0)+(section===2?4:0))%8;
 const lead=track.lead[riffIndex]+(section===2?12:0)+(section===3&&bar%2? -12:0);
 return{bar,beat,section,chord,lead,fill:(bar===7||bar===15)&&beat>=12,breakdown:bar===8||bar===9};
}
function schedule(){if(!playing)return;if(next<ac.currentTime-.1)next=ac.currentTime+.03;const tr=tracks[selected],sixteenth=60/tr.bpm/4;while(next<ac.currentTime+.12){
 const {bar,beat,section,chord,lead,fill,breakdown}=arrangement(step,tr);
 // Opening groove, fuller second phrase, two-bar breakdown, final build.
 if(beat%4===0&&(!breakdown||beat===0))tone(46,next,.22,'sine',.85,42);
 if((beat===4||beat===12)&&!breakdown){noise(next,.13,.23,1000);tone(55,next,.07,'triangle',.18)}
 if(fill&&beat%2===0)noise(next,.07,.15,1800);
 if(bar===15&&beat>=14)noise(next,.045,.17,2400);
 if(beat%(section===3?1:2)===0&&!breakdown)noise(next,.035,beat%4===2?.12:.055,6500);
 if(beat%2===0&&(!breakdown||beat%8===0))tone(tr.root+chord+(beat%8===6?12:0),next,breakdown?.3:.11,'sawtooth',breakdown?.09:.13);
 if((beat%2===0||selected===3&&section===3)&&!(bar===15&&beat===15)){
  const note=tr.root+24+lead;
  tone(note,next,sixteenth*(breakdown?2.8:1.5),tr.wave,breakdown?.055:.075);
  tone(note,next+sixteenth,sixteenth*1.2,tr.wave,.022);
 }
 if(beat%8===2||breakdown&&beat===0){for(const degree of tr.scale.slice(0,3))tone(tr.root+12+chord+degree,next,breakdown?.65:.16,'triangle',.045)}
 // A rising turnaround signals the end before bar one returns.
 if(bar===15&&beat>=12)tone(tr.root+24+tr.scale[(beat-12)%4],next,sixteenth*.8,'square',.045);
 next+=sixteenth;step=(step+1)%256;
}}
function stop(){playing=false;clearInterval(timer);for(const o of voices){try{o.stop()}catch{}}voices.clear();update()}
async function play(index=selected){try{stop();init();await ac.resume();selected=index;playing=true;step=0;next=ac.currentTime+.04;beatOrigin=next;schedule();timer=setInterval(schedule,25);update()}catch(e){stop();document.getElementById('jukestatus').textContent=e.message}}
function update(){const label=document.getElementById('jukestatus');if(label)label.textContent=playing?'Now playing: '+tracks[selected].name+' · '+tracks[selected].bpm+' BPM · 16-bar loop':'Choose a tune. Music starts when you press Play.';document.querySelectorAll('[data-track]').forEach(b=>{b.textContent=playing&&+b.dataset.track===selected?'▶ Playing':'▶ Play'})}
function open(){show('<p class="eyebrow">ARCADE RADIO / ORIGINAL CHIP RAVE</p><h2>The Jukebox</h2><p>Five 16-bar chip-rave loops: opening groove, variation, breakdown, and a final build that rolls back to bar one.</p><div id="tracklist"></div><label for="jukevolume">VOLUME</label><input id="jukevolume" type="range" min="0" max="100"><p><button id="jukestop">■ Stop music</button></p><p id="jukestatus" role="status"></p><small>Music pauses when you enter a game.</small>');tracks.forEach((tr,i)=>{const row=document.createElement('div');row.className='juke-track';const text=document.createElement('span');text.textContent=String(i+1).padStart(2,'0')+' · '+tr.name+' / '+tr.bpm+' BPM · 16 bars';const b=document.createElement('button');b.dataset.track=i;b.onclick=()=>play(i);row.append(text,b);document.getElementById('tracklist').append(row)});const slider=document.getElementById('jukevolume');slider.value=volume*100;slider.oninput=()=>{volume=+slider.value/100;if(master)master.gain.setTargetAtTime(volume*.65,ac.currentTime,.03)};document.getElementById('jukestop').onclick=stop;update()}
return{open,stop,get playing(){return playing},get title(){return tracks[selected].name},pulse(){return playing&&ac?Math.exp(-((Math.max(0,ac.currentTime-beatOrigin)*tracks[selected].bpm/60)%1)*5):0}};
})();
document.getElementById('jukebutton').onclick=()=>jukebox.open();
