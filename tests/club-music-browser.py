"""Render the actual default arcade synth to check its full sixteen-bar sound."""
import base64
import json
from pathlib import Path
import re
import unittest
import wave
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]

class ClubMusicTests(unittest.TestCase):
 def test_sixteen_bar_default_has_audible_varied_sections_without_clipping(self):
  source=(ROOT/'world-preview.html').read_text()
  bpm=int(re.search(r'const musicEngine=\{[^\n]*bpm:(\d+)',source)[1]);self.assertEqual(bpm,124)
  synth=source[source.index('function createAmbientOutput('):source.index('function tickAmbientMusic(')]
  with sync_playwright() as pw:
   browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
   page=browser.new_page();page.set_content('<title>Club loop render</title>')
   page.add_script_tag(content='let musicEngine={};'+synth)
   result=page.evaluate('''async bpm=>{
    const rate=44100,barSeconds=240/bpm,duration=16*barSeconds,frames=Math.ceil(duration*rate),ctx=new OfflineAudioContext(1,frames,rate),gain=createAmbientOutput(ctx);
    const noise=ctx.createBuffer(1,Math.floor(rate*.25),rate),data=noise.getChannelData(0);let seed=73;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/4294967296*2-1)*.42;}
    Object.assign(musicEngine,{ctx,gain,noise,bpm});
    for(let i=0;i<256;i++)audioStep(i,i*60/bpm/4);
    const buffer=await ctx.startRendering(),samples=buffer.getChannelData(0),pcm=new Int16Array(samples.length);let peak=0,sum=0;const sections=[0,0,0,0];
    for(let i=0;i<samples.length;i++){const v=samples[i];peak=Math.max(peak,Math.abs(v));sum+=v*v;sections[Math.min(3,Math.floor(i/samples.length*4))]+=v*v;pcm[i]=Math.round(Math.max(-1,Math.min(1,v))*32767);}
    const bytes=new Uint8Array(pcm.buffer);let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
    return {bpm,duration,peak,rms:Math.sqrt(sum/samples.length),sections,pcm:btoa(binary)};
   }''',bpm)
   self.assertGreater(result['rms'],.01);self.assertLess(result['peak'],.98);self.assertGreater(result['peak'],.07)
   self.assertTrue(all(value>0 for value in result['sections']));self.assertEqual(len(set(round(x,2) for x in result['sections'])),4)
   output=Path('/workspace/scratch/coda-club-loop.wav');output.parent.mkdir(exist_ok=True)
   with wave.open(str(output),'wb') as audio:audio.setnchannels(1);audio.setsampwidth(2);audio.setframerate(44100);audio.writeframes(base64.b64decode(result.pop('pcm')))
   output.with_suffix('.json').write_text(json.dumps(result,indent=2));browser.close()

if __name__=='__main__':unittest.main(verbosity=2)
