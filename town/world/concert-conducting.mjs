// Beat points are seen from the audience, behind the conductor. The right
// hand marks the ictus; compound metres group eighth notes into threes.
const PATTERNS=Object.freeze({
 2:Object.freeze([[10,-14],[21,-39]]),
 3:Object.freeze([[9,-14],[28,-24],[15,-39]]),
 4:Object.freeze([[9,-14],[-13,-23],[28,-23],[15,-39]])
});
export function conductingMeter(signature={numerator:4,denominator:4}){
 const numerator=Number(signature?.numerator),denominator=Number(signature?.denominator);
 if(![2,3,4,6,9,12].includes(numerator)||![2,4,8].includes(denominator))return {numerator:4,denominator:4,beats:4,subdivision:1};
 const compound=denominator===8&&numerator>=6;
 return {numerator,denominator,beats:compound?numerator/3:Math.min(4,numerator),subdivision:compound?3:1};
}
export function conductingGeometry(seconds=0,{bpm=92,timeSignature,beatOffset=0}={}){
 const meter=conductingMeter(timeSignature),points=PATTERNS[meter.beats];
 const pulse=Math.max(0,(Number.isFinite(seconds)?seconds:0)-(Number.isFinite(beatOffset)?beatOffset:0))*Math.max(1,Number.isFinite(bpm)?bpm:92)/60;
 const beat=Math.floor(pulse)%meter.beats,t=pulse%1,u=t*t*(3-2*t),a=points[beat],b=points[(beat+1)%meter.beats];
 const right={x:a[0]+(b[0]-a[0])*u,y:a[1]+(b[1]-a[1])*u-Math.sin(Math.PI*t)*4};
 // The free hand gives a quiet phrase cue, rather than duplicating the baton.
 const phrase=Math.sin(pulse*Math.PI/(meter.beats*2));
 return {meter,beat,pulse,right,left:{x:-20-phrase*2,y:-25-phrase*2},batonTip:{x:right.x+6,y:right.y-14}};
}
