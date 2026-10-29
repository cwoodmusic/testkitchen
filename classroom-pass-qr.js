/* Local-only Profile Pass QR images. No network, storage, or secret metadata. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaClassroomPassQR=api;})(typeof window==='undefined'?null:window,function(root){
 'use strict';
 const NS='http://www.w3.org/2000/svg';
 const encoder=()=>root?.qrcode||(typeof require==='function'?require('./vendor/qrcode-generator.js'):null);
 function fail(){const error=new Error('The profile pass image could not be created.');error.code='qr-unavailable';throw error;}
 function createSVG(value,options={}){
  const doc=options.document||root?.document,make=encoder();
  // Generated card URLs are serialized URLs and contain only printable ASCII.
  if(!doc?.createElementNS||typeof make!=='function'||typeof value!=='string'||!value.length||value.length>2048||/[^\x20-\x7e]/.test(value))return fail();
  let code;try{code=make(0,'M');code.addData(value,'Byte');code.make();}catch{return fail();}
  const modules=code.getModuleCount(),size=modules+8;
  const node=tag=>doc.createElementNS(NS,tag),svg=node('svg');
  svg.setAttribute('viewBox','0 0 '+size+' '+size);svg.setAttribute('width','256');svg.setAttribute('height','256');svg.setAttribute('role','img');svg.setAttribute('aria-label','Scan this private Profile Pass');svg.setAttribute('shape-rendering','crispEdges');svg.dataset.qrModules=String(modules);
  const background=node('rect');background.setAttribute('width',String(size));background.setAttribute('height',String(size));background.setAttribute('fill','#fff');svg.append(background);
  let path='';for(let y=0;y<modules;y++)for(let x=0;x<modules;x++)if(code.isDark(y,x))path+='M'+(x+4)+' '+(y+4)+'h1v1h-1z';
  const pixels=node('path');pixels.setAttribute('d',path);pixels.setAttribute('fill','#000');svg.append(pixels);return svg;
 }
 return Object.freeze({createSVG,isAvailable:()=>typeof encoder()==='function'});
});
