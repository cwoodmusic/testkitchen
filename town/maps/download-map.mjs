const link=document.getElementById('downloadMap');
const status=document.getElementById('downloadStatus');
let busy=false;
link.addEventListener('click',async event=>{
 event.preventDefault();
 if(busy)return;
 busy=true;
 const label=link.textContent;
 link.setAttribute('aria-disabled','true');
 link.textContent='Preparing JSON…';
 status.hidden=true;
 try{
  const response=await fetch(link.href,{cache:'no-cache'});
  if(!response.ok)throw Error(`Download failed (${response.status}).`);
  const text=await response.text();
  JSON.parse(text);
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
  const file=document.createElement('a');
  file.href=url;file.download='coda-town-festival.json';
  document.body.append(file);file.click();file.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  status.textContent='Download started. In Town Builder, choose Open and select coda-town-festival.json.';
 }catch(error){
  status.textContent=`${error.message} Please try downloading again.`;
 }finally{
  busy=false;link.removeAttribute('aria-disabled');link.textContent=label;status.hidden=false;
 }
});
