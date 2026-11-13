// The round uses elapsed wall time, independently of capped movement frames.
export function createRhythmRoundClock({duration=300}={}){
 if(!Number.isFinite(duration)||duration<=0)throw new RangeError('A rhythm round needs a positive duration.');
 let remaining=duration,started=false,running=false,last=null;
 const timestamp=now=>{if(!Number.isFinite(now))throw new TypeError('The round clock needs a finite timestamp.');return now;};
 function update(now){
  timestamp(now);
  if(running){
   const next=Math.max(last,now);remaining=Math.max(0,remaining-(next-last));last=next;
   if(remaining===0)running=false;
  }
  return remaining;
 }
 function pause(now){update(now);running=false;return remaining;}
 return {
  start(now){last=timestamp(now);remaining=duration;started=running=true;return remaining;},
  update,pause,stop:pause,
  resume(now){
   timestamp(now);if(running)return update(now);
   if(started&&remaining>0){last=Math.max(last,now);running=true;}
   return remaining;
  },
  reset(){remaining=duration;started=running=false;last=null;return remaining;},
  get remainingSeconds(){return remaining;},get started(){return started;},get running(){return running;},
  get expired(){return started&&remaining===0;},get timeLimit(){return duration;}
 };
}
