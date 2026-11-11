import {assetImage} from './asset-color.mjs?v=town-polish-1';

export const SHOWROOM_SIGN_ASSET='decor-14-16';

// Signs sit beside the public doorway queue. Only their small floor base is
// solid; neither their pictured panel nor their address blocks a doorway.
export function createShowroomThemeSign(display){
 // Keep the first upper signs clear of the waiting bench/flower pots. The
 // left sign can sit above its door; the right also clears the stair flight.
 const offset=display.row===0&&display.column?(display.storeFloor===2?240:192):display.storeFloor===2&&display.row===0?-140:152;
 const x=display.threshold.x-display.enterNormal.x*108,y=display.threshold.y+offset;
 return {id:'showroom-sign-'+display.id,asset:SHOWROOM_SIGN_ASSET,showroomId:display.id,storeFloor:display.storeFloor,
  doorId:'showroom-'+display.id,x,y,w:84,h:83,number:String(display.index+1).padStart(2,'0'),
  title:display.name,description:display.style,floorLabel:display.floor.label,wallpaperLabel:display.wallpaper.label,
  approach:{x,y:y+24},solid:true,base:{x:x-12,y:y-8,w:24,h:10}};
}

export function showroomThemeSignZone(sign){
 return {id:sign.id,label:'Read '+sign.title+' theme sign',x:sign.x-30,y:sign.y+20,w:60,h:32,
  action:'showroom-info',showroomId:sign.showroomId,storeFloor:sign.storeFloor,doorId:sign.doorId,signId:sign.id};
}

export function drawShowroomThemeSign(c,sign,catalog){
 const asset=catalog?.get(sign.asset),image=asset?.canvas?assetImage(asset):null;
 c.save();
 if(image){
  const scale=Math.min(sign.w/asset.w,sign.h/asset.h),w=asset.w*scale,h=asset.h*scale;
  c.drawImage(image,sign.x-w/2,sign.y-h,w,h);
  // A small brass-framed number replaces only the marquee's central poster;
  // its native carved frame, lyre, curtain, legs and flowers remain visible.
  const top=Math.round(sign.y-h*.56),left=Math.round(sign.x-16);
  c.fillStyle='#392e29';c.fillRect(left-2,top-2,36,19);
  c.fillStyle='#ba9559';c.fillRect(left-1,top-1,34,17);
  c.fillStyle='#f0dfb7';c.fillRect(left,top,32,15);
  c.textAlign='center';c.textBaseline='middle';c.font='bold 10px Georgia';c.fillStyle='#473b32';c.fillText(sign.number,sign.x,top+8);
 }else{
  // Keep a readable sign during the ordinary native-art loading frame.
  c.fillStyle='#24292733';c.beginPath();c.ellipse(sign.x,sign.y-2,29,6,0,0,Math.PI*2);c.fill();
  c.fillStyle='#554333';c.fillRect(sign.x-4,sign.y-44,8,39);c.fillRect(sign.x-24,sign.y-8,48,7);
  c.fillStyle='#b38c52';c.fillRect(sign.x-2,sign.y-43,2,35);c.fillRect(sign.x-22,sign.y-8,44,2);
  c.fillStyle='#4b382d';c.fillRect(sign.x-35,sign.y-80,70,40);
  c.fillStyle='#bd9a5e';c.fillRect(sign.x-33,sign.y-78,66,36);
  c.fillStyle='#e7d5ad';c.fillRect(sign.x-29,sign.y-74,58,28);
  c.textAlign='center';c.textBaseline='middle';c.font='bold 11px Georgia';c.fillStyle='#493a2d';c.fillText(sign.number,sign.x,sign.y-59);
 }
 c.restore();
}
