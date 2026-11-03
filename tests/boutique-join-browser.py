"""Reviewed architectural passes retain pixel-exact ownership and save data."""
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('canonical_join_fixture',Path(__file__).with_name('floor-palette-compat-browser.py'))
fixture=importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


class BoutiqueJoinTests(unittest.TestCase):
    setUpClass=classmethod(fixture.FloorPaletteCompatibilityTests.setUpClass.__func__)
    tearDownClass=classmethod(fixture.FloorPaletteCompatibilityTests.tearDownClass.__func__)
    setUp=fixture.FloorPaletteCompatibilityTests.setUp
    tearDown=fixture.FloorPaletteCompatibilityTests.tearDown
    load=fixture.FloorPaletteCompatibilityTests.load
    project=fixture.FloorPaletteCompatibilityTests.project

    def test_native_join_and_runtime_base_match_reviewed_source_without_new_local_saves(self):
        layers=[json.loads((fixture.ROOT/'scripts'/name).read_text()) for name in [
            'boutique-join-regions.json','boutique-corner-cap-regions.json',
            'hall-roof-cap-regions.json','lounge-club-roof-regions.json',
            'dance-northwest-south-wall-regions.json','arcade-north-straight-cap-regions.json',
            'five-northwest-cleanup-regions.json','front-wall-depth-regions.json',
            'sign-green-completion-regions.json','hall-floor-repair-regions.json',
            'dance-northwest-finish-regions.json',
            'boutique-wall-uniform-regions.json','dance-main-wall-uniform-regions.json']]
        self.load()
        result=self.page.evaluate('''async layers=>{
          const load=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;});
          const [native,...sources]=await Promise.all([load(layers[0].output),...layers.map(meta=>load(meta.source))]),[w,h]=layers[0].worldSize;
          const featherSources=await Promise.all(layers.map(meta=>(meta.floorFeather||meta.tileEdgeFeather)&&meta.before?load(meta.before):null));
          const canvas=()=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
          const a=canvas(),c=canvas();a.getContext('2d').drawImage(native,0,0);__paletteConsole.renderBase(c.getContext('2d'));
          const aa=a.getContext('2d').getImageData(0,0,w,h).data,cc=c.getContext('2d').getImageData(0,0,w,h).data;
          const expectedPixels=sources.map((source,index)=>{
            const c=canvas(),g=c.getContext('2d'),meta=layers[index],placement=meta.sourcePlacement||[0,0,w,h];g.imageSmoothingEnabled=false;
            if(meta.sourceRect)g.drawImage(source,...meta.sourceRect,...placement);else g.drawImage(source,...placement);
            for(const region of meta.sourceCopies||[])g.drawImage(c,...region);
            const data=g.getImageData(0,0,w,h).data;
            if(meta.floorFeather||meta.tileEdgeFeather){
              if(!featherSources[index])throw Error('A reviewed feather needs its immutable reference artwork');
              const reference=canvas(),rg=reference.getContext('2d');rg.drawImage(featherSources[index],0,0);
              const before=rg.getImageData(0,0,w,h).data;
              for(let y=0;y<h;y++)for(let x=0;x<w;x++){
                let weight=1;
                if(meta.floorFeather){
                  const {right:[r0,r1],bottom:[b0,b1],leftBelow:[l0,l1,below]}=meta.floorFeather;
                  weight=Math.max(0,Math.min(weight,(r1-x-.5)/(r1-r0),(b1-y-.5)/(b1-b0)));
                  if(y>=below)weight=Math.max(0,Math.min(weight,(x+.5-l0)/(l1-l0)));
                }
                if(meta.tileEdgeFeather){
                  // The reviewed edge is defined per integer image row; only
                  // the horizontal ramp uses the pixel center.
                  const {points,width}=meta.tileEdgeFeather,cy=y;
                  if(cy>=points[0][1]&&cy<=points.at(-1)[1]){
                    for(let i=1;i<points.length;i++)if(cy<=points[i][1]){
                      const [ax,ay]=points[i-1],[bx,by]=points[i],edge=ax+(bx-ax)*(cy-ay)/(by-ay);
                      weight=Math.max(0,Math.min(weight,(edge+width-(x+.5))/width));break;
                    }
                  }
                }
                const at=(y*w+x)*4;for(let channel=0;channel<4;channel++)data[at+channel]=Math.round(before[at+channel]*(1-weight)+data[at+channel]*weight);
              }
            }
            return data;
          });
          const inPolygon=(poly,x,y)=>{let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
            const [ax,ay]=poly[i],[bx,by]=poly[j];if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)hit=!hit;
          }return hit;};
          const owns=(meta,x,y)=>meta.polygons.some(p=>inPolygon(p,x+.5,y+.5))&&!(meta.protectedPolygons||[]).some(p=>inPolygon(p,x+.5,y+.5))&&!(meta.protectedBounds||[]).some(([left,top,width,height])=>x>=left&&x<left+width&&y>=top&&y<top+height);
          const maskCounts=layers.map(()=>0),ownerCounts=layers.map(()=>0),expectedNative=new Uint8ClampedArray(aa),owned=[];let nativeMismatch=0,baseMismatch=0;
          for(let y=0;y<h;y++)for(let x=0;x<w;x++){
            let owner=-1;for(let index=0;index<layers.length;index++)if(owns(layers[index],x,y)){maskCounts[index]++;owner=index;}
            if(owner<0)continue;ownerCounts[owner]++;
            const at=(y*w+x)*4,expected=expectedPixels[owner];
            if([0,1,2,3].some(k=>aa[at+k]!==expected[at+k]))nativeMismatch++;
            expectedNative.set(expected.slice(at,at+4),at);owned.push(at);
          }
          // Authored pixels supersede reviewed native artwork without changing
          // that artwork's independent source ownership or the raw save.
          const expectedSource=canvas();expectedSource.getContext('2d').putImageData(new ImageData(expectedNative,w,h),0,0);
          const palette=CodaFloorPaletteCompat.create({manifest:await(await fetch('assets/environment/floor-palette-compat.json')).json()});await palette.ready;
          const fill=CodaPathwayFloorFill.create({document,manifest:await(await fetch('assets/environment/boutique-pathway-shape.json')).json()});await fill.ready;
          const patch=palette.resolveTexture('background.world',CodaDeveloperConsole.getProject().artwork['background.world']);
          const expectedBase=canvas(),eg=expectedBase.getContext('2d');fill.draw(eg,expectedSource);eg.drawImage(CodaArtworkEditor.compose(expectedSource,patch),0,0);
          const bb=eg.getImageData(0,0,w,h).data;for(const at of owned)if([0,1,2,3].some(k=>cc[at+k]!==bb[at+k]))baseMismatch++;
          return {maskCounts,ownerCounts,nativeMismatch,baseMismatch,source:CodaDeveloperConsole.getProjectSource(),local:localStorage.getItem('codaWorldProjectV1')};
        }''',layers)
        self.assertEqual(result['maskCounts'][:2],[26000,5141])
        self.assertTrue(all(count>0 for count in result['ownerCounts']),result)
        self.assertEqual(result['nativeMismatch'],0,result)
        self.assertEqual(result['baseMismatch'],0,result)
        self.assertEqual(result['source'],'published')
        self.assertIsNone(result['local'])
        self.assertEqual(self.project(),self.current,'Loading canonical artwork must not rewrite the project or collision entries')


if __name__=='__main__':
    unittest.main(verbosity=2)
