"""Build alpha bounds and small library thumbnails; preserve full PNG artwork."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
import threading,json,base64
from collections import deque
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];folder=ROOT/'town/assets/decor'
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();meta=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/index.html',wait_until='domcontentloaded')
 for family in range(16):
  name=f'pack-{family+1:02d}';path=folder/(name+'.png')
  if not path.exists():continue
  im=Image.open(path).convert('RGBA');cells=[];w,h=im.size;alpha=bytearray(im.getchannel('A').tobytes());parts=[[] for _ in range(16)]
  # Find each connected sprite in the full sheet, not in a cropped grid cell.
  # This keeps a stand's feet intact across a grid line while excluding stray
  # pieces belonging to the next row. The source pixels are never rewritten.
  for index in range(w*h):
   if alpha[index]<=240:continue
   alpha[index]=0;queue=deque([index]);l=w;t=h;r=bt=0;count=0
   while queue:
    n=queue.popleft();x=n%w;y=n//w;l=min(l,x);r=max(r,x);t=min(t,y);bt=max(bt,y);count+=1
    for nn in ([n-1] if x else [])+([n+1] if x<w-1 else [])+([n-w] if y else [])+([n+w] if y<h-1 else []):
     if alpha[nn]>240:alpha[nn]=0;queue.append(nn)
   if count<8:continue
   col=min(3,int((l+r)/2*4/w));row=min(3,int((t+bt)/2*4/h));parts[row*4+col].append((count,l,t,r+1,bt+1))
  for i in range(16):
   if not parts[i]:raise ValueError(f'{name}: empty sprite {i}')
   ordered=sorted(parts[i],reverse=True);main,l,t,r,bt=ordered.pop(0);changed=True;pad=7
   for part in ordered[:]:
    size,ll,tt,rr,bb=part
    if size>=main*.03:l=min(l,ll);r=max(r,rr);t=min(t,tt);bt=max(bt,bb);ordered.remove(part)
   while changed:
    changed=False
    for part in ordered[:]:
     _,ll,tt,rr,bb=part
     if ll<=r+pad and rr>=l-pad and tt<=bt+pad and bb>=t-pad:
      l=min(l,ll);r=max(r,rr);t=min(t,tt);bt=max(bt,bb);ordered.remove(part);changed=True
   l=max(0,l-2);t=max(0,t-2);r=min(w,r+2);bt=min(h,bt+2);cells.append({'x':l,'y':t,'w':r-l,'h':bt-t})
  url=f'http://127.0.0.1:{server.server_port}/town/assets/decor/{name}.png'
  data=page.evaluate('''async url=>{const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas');c.width=512;c.height=Math.round(image.height/image.width*512);c.getContext('2d').drawImage(image,0,0,c.width,c.height);return c.toDataURL('image/webp',.86).split(',')[1];}''',url)
  (folder/(name+'-thumb.webp')).write_bytes(base64.b64decode(data));meta.append({'family':family,'file':name+'.png','thumb':name+'-thumb.webp','width':im.width,'height':im.height,'cells':cells})
 b.close()
server.shutdown();(folder/'atlas.json').write_text(json.dumps(meta,separators=(',',':'))+'\n');print(f'Prepared {len(meta)} sheets / {len(meta)*16} sprites; full-resolution artwork unchanged.')
