import {estateDefinitions} from './estates.mjs?v=door-price-2';
// Shared production artwork. Atlas bounds and pivots are defined here so
// editor and game always draw identical pieces.
const load=path=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Could not load '+path));const url=new URL('../assets/'+path,import.meta.url);if(path.startsWith('home-estate-'))url.searchParams.set('v','home-open-1');image.src=url;});
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function atlas(image,cols,rows,trim=false){return Array.from({length:cols*rows},(_,i)=>{const x=Math.floor(i%cols*image.width/cols),y=Math.floor(Math.floor(i/cols)*image.height/rows),w=Math.floor((i%cols+1)*image.width/cols)-x,h=Math.floor((Math.floor(i/cols)+1)*image.height/rows)-y,c=canvas(w,h),g=c.getContext('2d',{willReadFrequently:true});g.drawImage(image,x,y,w,h,0,0,w,h);if(!trim)return c;const data=g.getImageData(0,0,w,h).data;let l=w,t=h,r=0,b=0;for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(data[(yy*w+xx)*4+3]>128){l=Math.min(l,xx);r=Math.max(r,xx);t=Math.min(t,yy);b=Math.max(b,yy);}const out=canvas(r-l+1,b-t+1);out.getContext('2d').drawImage(c,l,t,r-l+1,b-t+1,0,0,out.width,out.height);return out;});}
const [kit,foliage,cliff,...homes]=await Promise.all(['construction-detail.png','foliage-detail.png','cliff-decor.png',...estateDefinitions.map(a=>'home-estate-'+a.id+'.png')].map(load));
export const constructionArt=atlas(kit,4,3,true),overgrowthArt=atlas(foliage,3,2,true),estateArt=homes;
export const wallArt={wood:constructionArt[3],rail:constructionArt[3],iron:constructionArt[7],limestone:constructionArt[0],brick:constructionArt[1],plaster:constructionArt[2]};
export const stairArt={stone:constructionArt[8],wood:constructionArt[9],brick:constructionArt[10]};
// The straight tread interior excludes the authored flight's perspective sides.
export function stairTreadBounds(image){const x=Math.ceil(image.width*.18),y=Math.ceil(image.height*.04);return {x,y,w:image.width-2*x,h:image.height-2*y};}
export const cliffArt=constructionArt[11];

export const cliffDecorArt=atlas(cliff,3,2,true);
