/** Only screen/glass geometry changes when an accepted drawing moves it. */
export function correctedArtMotion(original,geometry){
 if(geometry===undefined)return null;
 if(!original||!['arcade','lava'].includes(original.kind))throw Error('Edited motion geometry needs an existing animated asset.');
 const mask=geometry?.mask;
 if(!Array.isArray(mask)||mask.length<3||mask.length>128||mask.some(point=>!Array.isArray(point)||point.length!==2||point.some(n=>!Number.isFinite(n)||n<0||n>1)))throw Error('Invalid edited animation mask.');
 const xs=mask.map(p=>p[0]),ys=mask.map(p=>p[1]),left=Math.min(...xs),top=Math.min(...ys),right=Math.max(...xs),bottom=Math.max(...ys);
 const bounds=geometry.bounds??[left,top,right-left,bottom-top];
 if(!Array.isArray(bounds)||bounds.length!==4||bounds.some(n=>!Number.isFinite(n))||bounds[0]<0||bounds[1]<0||bounds[2]<=0||bounds[3]<=0||bounds[0]+bounds[2]>1.000001||bounds[1]+bounds[3]>1.000001||left<bounds[0]-1e-7||top<bounds[1]-1e-7||right>bounds[0]+bounds[2]+1e-7||bottom>bounds[1]+bounds[3]+1e-7)throw Error('Edited animation bounds must contain its mask.');
 return Object.freeze({...original,mask:Object.freeze(mask.map(point=>Object.freeze([...point]))),bounds:Object.freeze([...bounds])});
}
