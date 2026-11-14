// Native source pixels recovered by following each sprite's alpha > 40
// connected components across atlas-grid lines. The old alpha > 240 scan
// clipped translucent foliage, instruments and hanging tails. These are only
// artwork rectangles: the catalog's original dimensions and collisions stay
// authoritative, including for saved maps.
export const nativeArtworkBounds=Object.freeze({
  "props-1-150": Object.freeze({"x":556,"y":81,"w":421,"h":338}),
  "music-2-120": Object.freeze({"x":1099,"y":50,"w":385,"h":385}),
  "decor-09-01": Object.freeze({"x":80,"y":7,"w":277,"h":252}),
  "decor-09-02": Object.freeze({"x":429,"y":8,"w":302,"h":251}),
  "decor-09-03": Object.freeze({"x":826,"y":7,"w":259,"h":251}),
  "decor-09-04": Object.freeze({"x":1252,"y":6,"w":148,"h":253}),
  "decor-09-05": Object.freeze({"x":121,"y":265,"w":191,"h":240}),
  "decor-09-06": Object.freeze({"x":470,"y":263,"w":208,"h":243}),
  "decor-09-07": Object.freeze({"x":831,"y":265,"w":252,"h":240}),
  "decor-09-08": Object.freeze({"x":1215,"y":266,"w":181,"h":242}),
  "decor-09-09": Object.freeze({"x":111,"y":513,"w":214,"h":235}),
  "decor-09-10": Object.freeze({"x":431,"y":552,"w":286,"h":192}),
  "decor-09-11": Object.freeze({"x":825,"y":512,"w":252,"h":234}),
  "decor-09-12": Object.freeze({"x":1190,"y":525,"w":272,"h":220}),
  "decor-09-13": Object.freeze({"x":75,"y":778,"w":278,"h":232}),
  "decor-09-14": Object.freeze({"x":493,"y":759,"w":181,"h":256}),
  "decor-09-15": Object.freeze({"x":876,"y":758,"w":134,"h":257}),
  "decor-09-16": Object.freeze({"x":1164,"y":761,"w":299,"h":251}),
  "decor-10-01": Object.freeze({"x":49,"y":21,"w":313,"h":220}),
  "decor-10-02": Object.freeze({"x":445,"y":3,"w":261,"h":246}),
  "decor-10-03": Object.freeze({"x":827,"y":2,"w":256,"h":240}),
  "decor-10-04": Object.freeze({"x":1190,"y":25,"w":302,"h":214}),
  "decor-10-05": Object.freeze({"x":70,"y":255,"w":259,"h":251}),
  "decor-10-06": Object.freeze({"x":428,"y":277,"w":295,"h":218}),
  "decor-10-07": Object.freeze({"x":814,"y":265,"w":291,"h":233}),
  "decor-10-08": Object.freeze({"x":1210,"y":265,"w":263,"h":235}),
  "decor-10-09": Object.freeze({"x":46,"y":520,"w":299,"h":234}),
  "decor-10-10": Object.freeze({"x":424,"y":540,"w":293,"h":207}),
  "decor-10-11": Object.freeze({"x":791,"y":553,"w":334,"h":188}),
  "decor-10-12": Object.freeze({"x":1221,"y":527,"w":242,"h":221}),
  "decor-10-13": Object.freeze({"x":29,"y":773,"w":324,"h":234}),
  "decor-10-14": Object.freeze({"x":413,"y":789,"w":323,"h":215}),
  "decor-10-15": Object.freeze({"x":789,"y":782,"w":340,"h":220}),
  "decor-10-16": Object.freeze({"x":1179,"y":776,"w":323,"h":233}),
  "decor-11-01": Object.freeze({"x":60,"y":37,"w":272,"h":217}),
  "decor-11-02": Object.freeze({"x":428,"y":7,"w":301,"h":240}),
  "decor-11-03": Object.freeze({"x":803,"y":32,"w":302,"h":189}),
  "decor-11-04": Object.freeze({"x":1195,"y":24,"w":265,"h":206}),
  "decor-11-05": Object.freeze({"x":54,"y":280,"w":295,"h":212}),
  "decor-11-06": Object.freeze({"x":433,"y":296,"w":285,"h":193}),
  "decor-11-07": Object.freeze({"x":801,"y":255,"w":316,"h":236}),
  "decor-11-08": Object.freeze({"x":1228,"y":255,"w":207,"h":247}),
  "decor-11-09": Object.freeze({"x":50,"y":526,"w":288,"h":212}),
  "decor-11-10": Object.freeze({"x":432,"y":514,"w":284,"h":233}),
  "decor-11-11": Object.freeze({"x":812,"y":516,"w":275,"h":225}),
  "decor-11-12": Object.freeze({"x":1226,"y":520,"w":233,"h":223}),
  "decor-11-13": Object.freeze({"x":33,"y":791,"w":321,"h":205}),
  "decor-11-14": Object.freeze({"x":409,"y":765,"w":325,"h":244}),
  "decor-11-15": Object.freeze({"x":794,"y":769,"w":325,"h":230}),
  "decor-11-16": Object.freeze({"x":1191,"y":763,"w":292,"h":239}),
  "decor-15-01": Object.freeze({"x":25,"y":12,"w":313,"h":271}),
  "decor-15-02": Object.freeze({"x":383,"y":18,"w":321,"h":271}),
  "decor-15-03": Object.freeze({"x":742,"y":16,"w":323,"h":275}),
  "decor-15-04": Object.freeze({"x":1099,"y":18,"w":335,"h":270}),
  "decor-15-05": Object.freeze({"x":18,"y":292,"w":334,"h":249}),
  "decor-15-06": Object.freeze({"x":385,"y":314,"w":316,"h":207}),
  "decor-15-07": Object.freeze({"x":754,"y":326,"w":261,"h":185}),
  "decor-15-08": Object.freeze({"x":1036,"y":300,"w":407,"h":221}),
  "decor-15-09": Object.freeze({"x":31,"y":557,"w":301,"h":207}),
  "decor-15-10": Object.freeze({"x":393,"y":557,"w":300,"h":207}),
  "decor-15-11": Object.freeze({"x":755,"y":557,"w":301,"h":207}),
  "decor-15-12": Object.freeze({"x":1173,"y":539,"w":195,"h":242}),
  "decor-15-13": Object.freeze({"x":62,"y":813,"w":247,"h":257}),
  "decor-15-14": Object.freeze({"x":387,"y":816,"w":312,"h":250}),
  "decor-15-15": Object.freeze({"x":795,"y":813,"w":200,"h":255}),
  "decor-15-16": Object.freeze({"x":1091,"y":814,"w":350,"h":257}),
});

export function artworkBounds(id,fallback){return nativeArtworkBounds[id]||fallback;}

// Contain the complete native silhouette in the existing fixed-size canvas.
// The bottom-center anchor stays on the saved asset's ground position; source
// repairs must never stretch the object or change its physical footprint.
export function containedArtworkRect(source,width,height){
 const scale=Math.min(width/source.w,height/source.h),w=Math.min(width,source.w*scale),h=Math.min(height,source.h*scale);
 return {x:(width-w)/2,y:height-h,w,h};
}
export function drawContainedArtwork(context,image,source,width,height,x=0,y=0){
 const target=containedArtworkRect(source,width,height);
 context.drawImage(image,source.x,source.y,source.w,source.h,x+target.x,y+target.y,target.w,target.h);
}
