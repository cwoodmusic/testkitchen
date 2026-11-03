/* Small lossless RGBA8 PNG helper for exact masked sprite compositing.
 * Raw alpha and RGB outside a reviewed mask survive without premultiplication. */
'use strict';
const zlib=require('node:zlib');
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const crcTable=Uint32Array.from({length:256},(_,value)=>{for(let i=0;i<8;i++)value=value&1?0xedb88320^(value>>>1):value>>>1;return value>>>0;});
function crc32(bytes){let value=0xffffffff;for(const byte of bytes)value=crcTable[(value^byte)&255]^(value>>>8);return (value^0xffffffff)>>>0;}
function paeth(a,b,c){const p=a+b-c,x=Math.abs(p-a),y=Math.abs(p-b),z=Math.abs(p-c);return x<=y&&x<=z?a:y<=z?b:c;}
function decode(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length<45||!bytes.subarray(0,8).equals(signature))throw Error('Expected a PNG');
 let width,height,format;const parts=[];
 for(let at=8;at+12<=bytes.length;){const length=bytes.readUInt32BE(at),type=bytes.toString('ascii',at+4,at+8),end=at+8+length;if(end+4>bytes.length)throw Error('Truncated PNG chunk');
  if(type==='IHDR'){width=bytes.readUInt32BE(at+8);height=bytes.readUInt32BE(at+12);format=Array.from(bytes.subarray(at+16,at+21));}
  if(type==='IDAT')parts.push(bytes.subarray(at+8,end));at=end+4;
 }
 if(!width||!height||width*height>16777216||!format||format[0]!==8||format[1]!==6||format.slice(2).some(n=>n!==0))throw Error('Masked compositor requires noninterlaced RGBA8 PNG');
 const stride=width*4,raw=zlib.inflateSync(Buffer.concat(parts));if(raw.length!==(stride+1)*height)throw Error('Unexpected PNG raster length');
 const data=Buffer.alloc(stride*height);
 for(let y=0;y<height;y++){const filter=raw[y*(stride+1)];if(filter>4)throw Error('Unsupported PNG filter');
  for(let x=0;x<stride;x++){const at=y*stride+x,left=x>=4?data[at-4]:0,up=y?data[at-stride]:0,corner=y&&x>=4?data[at-stride-4]:0,predictor=filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):filter===4?paeth(left,up,corner):0;data[at]=(raw[y*(stride+1)+x+1]+predictor)&255;}
 }
 return {width,height,data};
}
function chunk(type,data){const name=Buffer.from(type),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length,0);name.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(out.subarray(4,data.length+8)),data.length+8);return out;}
function encode({width,height,data}){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>16777216||data.length!==width*height*4)throw Error('Invalid RGBA raster');
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
 const stride=width*4,raw=Buffer.alloc((stride+1)*height);for(let y=0;y<height;y++)Buffer.from(data.buffer,data.byteOffset+y*stride,stride).copy(raw,y*(stride+1)+1);
 return Buffer.concat([signature,chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
module.exports={decode,encode};
