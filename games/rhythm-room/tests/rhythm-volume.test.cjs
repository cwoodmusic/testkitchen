const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const volume=require('../rhythm-volume.js');
function disk(raw=null){return {raw,writes:[],getItem(key){assert.equal(key,volume.KEY);if(this.readFails)throw Error('blocked');return this.raw;},setItem(key,value){if(this.writeFails)throw Error('quota');this.writes.push([key,value]);this.raw=value;}};}
function audio({hold=true,time=4}={}){
 const context={currentTime:time,destination:{kind:'destination'},nodes:[],state:'running'};
 context.createGain=()=>{const events=[],parameter={value:1,setValueAtTime(value,time){events.push(['set',value,time]);this.value=value;},cancelScheduledValues(time){events.push(['cancel',time]);},linearRampToValueAtTime(value,time){events.push(['ramp',value,time]);}};
  if(hold)parameter.cancelAndHoldAtTime=time=>events.push(['hold',time]);
  const node={gain:parameter,events,connections:[],disconnects:0,connect(target){this.connections.push(target);},disconnect(){this.disconnects++;}};context.nodes.push(node);return node;};
 return context;
}

test('the default and stored device volume are bounded and reading never creates a save',()=>{
 for(const [raw,expected]of [[null,100],['0',0],['37.5',37.5],['150',100],['-2',0],['',100],[' ',100],['broken',100],['{"value":40}',100],['NaN',100]]){
  const storage=disk(raw),control=volume.create({storage});assert.equal(control.getValue(),expected,raw);assert.deepEqual(storage.writes,[]);
 }
 assert.equal(volume.create({storage:disk(),defaultValue:0}).getValue(),0);
 assert.equal(volume.create({storage:disk(),defaultValue:25}).getValue(),25);
 assert.equal(volume.create({storage:disk(),defaultValue:-10}).getValue(),0);
 assert.equal(volume.create({storage:disk(),defaultValue:Infinity}).getValue(),100);
 const blocked=disk();blocked.readFails=true;assert.equal(volume.create({storage:blocked}).getValue(),100);
});

test('one shared node connects to the actual destination once and begins at the saved level',()=>{
 const storage=disk('64'),control=volume.create({storage}),context=audio(),node=control.connect(context);
 assert.strictEqual(control.getGainNode(),node);assert.strictEqual(control.connect(context),node);assert.equal(context.nodes.length,1);
 assert.deepEqual(node.connections,[context.destination]);assert.deepEqual(node.events,[['set',.64,4]]);assert.equal(node.gain.value,.64);
 assert.deepEqual(storage.writes,[]);assert.equal(control.getState().connected,true);
});

test('live slider changes hold the current gain and ramp to exact zero over 25 milliseconds',()=>{
 const storage=disk('80'),changes=[],control=volume.create({storage,onChange:(value,state)=>changes.push({value,state})}),context=audio(),node=control.connect(context);
 context.currentTime=7;assert.equal(control.setValue('35'),35);assert.deepEqual(node.events.slice(-2),[['hold',7],['ramp',.35,7.025]]);
 context.currentTime=7.01;assert.equal(control.setValue(0),0);assert.deepEqual(node.events.slice(-2),[['hold',7.01],['ramp',0,7.035]]);
 assert.deepEqual(storage.writes,[[volume.KEY,'35'],[volume.KEY,'0']]);assert.deepEqual(changes.map(value=>value.value),[35,0]);assert.equal(changes[1].state.persisted,true);
 assert.equal(context.nodes.length,1,'Changing volume does not replace the audio context or create another master node');
});

test('older audio parameters anchor the live value before replacing an in-flight ramp',()=>{
 const control=volume.create({storage:disk('60')}),context=audio({hold:false,time:3}),node=control.connect(context);
 node.gain.value=.42;control.setValue(20);assert.deepEqual(node.events.slice(-3),[['cancel',3],['set',.42,3],['ramp',.2,3.025]]);
 node.gain.cancelAndHoldAtTime=()=>{throw Error('unsupported');};node.gain.value=.28;context.currentTime=3.01;control.setValue(0);
 assert.deepEqual(node.events.slice(-3,-1),[['cancel',3.01],['set',.28,3.01]]);assert.equal(node.events.at(-1)[0],'ramp');assert.equal(node.events.at(-1)[1],0);assert.ok(Math.abs(node.events.at(-1)[2]-3.035)<1e-12);
});

test('a new audio context uses the latest muted level and the old route is disconnected',()=>{
 const storage=disk('70'),control=volume.create({storage}),first=audio(),oldNode=control.connect(first);
 control.setValue(0);control.disconnect();control.disconnect();assert.equal(oldNode.disconnects,1);assert.equal(control.getGainNode(),null);assert.equal(control.getState().connected,false);
 const second=audio({time:1}),newNode=control.connect(second);assert.deepEqual(newNode.events,[['set',0,1]]);assert.equal(newNode.gain.value,0);
 const third=audio({time:2}),thirdNode=control.connect(third);assert.equal(newNode.disconnects,1);assert.deepEqual(thirdNode.events,[['set',0,2]]);
 assert.equal(volume.create({storage}).getValue(),0,'A later visit restores the same device preference');
});

test('invalid input is ignored while valid values clamp and explicit retry can save after quota failure',()=>{
 const storage=disk('45'),control=volume.create({storage}),context=audio(),node=control.connect(context);
 for(const input of [null,undefined,NaN,Infinity,'',' ',true,{},[]])assert.equal(control.setValue(input),45);
 assert.deepEqual(storage.writes,[]);assert.equal(node.events.length,1);
 assert.equal(control.setValue(150),100);assert.equal(control.setValue(-20),0);
 storage.writeFails=true;assert.equal(control.setValue(25),25);assert.equal(control.getState().persisted,false);assert.match(control.getState().error,/could not save/);assert.deepEqual(node.events.at(-1),['ramp',.25,4.025]);
 storage.writeFails=false;const count=node.events.length;assert.equal(control.setValue(25),25);assert.equal(control.getState().persisted,true);assert.equal(storage.raw,'25');assert.equal(node.events.length,count,'Saving an unchanged level does not restart its audio ramp');
});

test('unavailable storage and a failing UI observer never prevent live listening controls',()=>{
 const control=volume.create({storage:null,onChange(){throw Error('UI');}}),context=audio(),node=control.connect(context);
 assert.equal(control.setValue(15),15);assert.deepEqual(node.events.at(-1),['ramp',.15,4.025]);assert.equal(control.getState().persisted,false);
 assert.throws(()=>control.connect({createGain(){},destination:null}),TypeError);assert.throws(()=>control.connect({...context,state:'closed'}),TypeError);
 assert.strictEqual(control.getGainNode(),node,'An invalid replacement does not disconnect current playback');
});

test('browser and Node exports agree without touching storage until a control is created',()=>{
 const source=fs.readFileSync(require.resolve('../rhythm-volume.js'),'utf8'),window={};vm.runInNewContext(source,{window});
 assert.deepEqual(Object.keys(window.RhythmRoomVolume),Object.keys(volume));assert.equal(window.RhythmRoomVolume.KEY,volume.KEY);assert.equal(window.RhythmRoomVolume.RAMP_SECONDS,.025);
 const storage=disk('52'),control=window.RhythmRoomVolume.create({storage});assert.equal(control.getValue(),52);assert.deepEqual(storage.writes,[]);
});
