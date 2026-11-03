"""South-facing furniture stays reusable and preserves existing layouts."""
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('south_furniture_fixture',Path(__file__).with_name('decor-library-browser.py'))
fixture=importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


class SouthFurnitureTests(unittest.TestCase):
    setUpClass=classmethod(fixture.DecorLibraryBrowserTests.setUpClass.__func__)
    tearDownClass=classmethod(fixture.DecorLibraryBrowserTests.tearDownClass.__func__)
    setUp=fixture.DecorLibraryBrowserTests.setUp
    tearDown=fixture.DecorLibraryBrowserTests.tearDown
    load=fixture.DecorLibraryBrowserTests.load
    frames=fixture.DecorLibraryBrowserTests.frames
    project=fixture.DecorLibraryBrowserTests.project
    field=fixture.DecorLibraryBrowserTests.field
    library=fixture.DecorLibraryBrowserTests.library
    add_decor=fixture.DecorLibraryBrowserTests.add_decor

    def ready(self):
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready() && window.CodaArcadeQA?.characters().spriteState.ready && window.CodaDecorLibrary?.items.length===71')

    def test_default_uses_south_sofas_and_furniture_library_without_changing_the_project(self):
        self.load(seed=False)
        expected=json.loads((fixture.ROOT/'published-world-project.json').read_text())
        self.assertEqual(self.project(),expected,'New source art must not rewrite any layout or collision data')
        actual=self.page.evaluate('''async()=>{
 const ids=['sofa-south','sofa-compact-south','sofa-lounge-south','counter-jade-south','counter-boutique-south','desk-dj-south','table-candle-south'];
 const sources=await Promise.all(ids.map(async id=>{
  const image=new Image();image.src='assets/decor/v1/'+id+'.png';await image.decode();
  const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;
  const g=c.getContext('2d');g.drawImage(image,0,0);const data=g.getImageData(0,0,c.width,c.height).data;
  let clear=false,visible=false;for(let at=3;at<data.length;at+=4){clear=clear||data[at]===0;visible=visible||data[at]>0;}
  return {id,width:c.width,height:c.height,clear,visible};
 }));
 const environment=CodaEnvironmentArt.create({document});await environment.ready;
 const sofas=await Promise.all(['lounge_sofa','dance_left_couch','dance_right_couch'].map(async name=>{
  const spec=CodaEnvironmentArt.OBJECTS[name],image=new Image();image.src='assets/environment/v1/'+spec.file;await image.decode();
  const c=document.createElement('canvas');c.width=spec.width;c.height=spec.height;c.getContext('2d').drawImage(image,0,0);
  const actual=environment.object(name);return {name,file:spec.file,width:actual.width,height:actual.height,samePixels:actual.toDataURL()===c.toDataURL()};
 }));
 return {sources,sofas,furnitureCount:CodaDecorLibrary.items.filter(item=>item.category==='furniture').length};
}''')
        self.assertEqual(actual['furnitureCount'],10)
        self.assertEqual([(item['width'],item['height']) for item in actual['sources']],[(164,131),(162,109),(288,105),(361,142),(127,81),(121,62),(86,70)])
        self.assertTrue(all(item['clear'] and item['visible'] for item in actual['sources']),actual['sources'])
        self.assertEqual([item['file'] for item in actual['sofas']],['lounge-couch-south.png','dance-couch-left-south.png','dance-couch-right-south.png'])
        self.assertTrue(all(item['samePixels'] for item in actual['sofas']),'Native sofa canvases must keep their normalized pixels and bounds')
        self.library()
        self.page.locator('[data-decor-category]').select_option('furniture')
        self.assertEqual(self.page.locator('[data-decor-item]:visible').count(),10)
        self.page.locator('[data-decor-search]').fill('sofa')
        self.assertEqual(self.page.locator('[data-decor-item]:visible').count(),3)
        self.page.locator('[data-decor-item="sofa-south"]').click()
        self.assertEqual(self.project(),expected,'Filtering and previewing a furniture variant cannot place or alter objects')

    def test_furniture_copies_keep_independent_edits_undo_and_portable_saved_pixels(self):
        first=self.add_decor('sofa-south')
        second=self.add_decor('sofa-south')
        self.assertNotEqual(first['id'],second['id'])
        self.assertEqual(first['data'],second['data'])
        self.assertTrue(first['data'].startswith('data:image/png;base64,'))
        self.assertTrue(first.get('ignoreBackgroundMasks'))
        self.assertEqual((first['w'],first['h'],first['layer']),(164,131,'world'))
        self.page.locator('#assetList').select_option(first['id'])
        self.field('assetName','My south sofa')
        self.field('assetX',1050)
        self.field('assetY',700)
        edited=next(asset for asset in self.project()['assets'] if asset['id']==first['id'])
        untouched=next(asset for asset in self.project()['assets'] if asset['id']==second['id'])
        self.assertEqual((edited['name'],edited['x'],edited['y']),('My south sofa',1050,700))
        self.assertEqual(untouched,second,'Editing one furniture copy must leave another copy unchanged')
        self.page.locator('#assetDuplicate').click()
        self.assertEqual(len(self.project()['assets']),3)
        before_remove=self.project()
        self.page.locator('#assetRemove').click()
        self.assertEqual(len(self.project()['assets']),2)
        self.page.locator('#devUndo').click()
        self.assertEqual(self.project(),before_remove)
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.save()'))
        self.page.locator('#devTab-project').click()
        with self.page.expect_download() as pending:
            self.page.locator('#devExport').click()
        exported=json.loads(Path(pending.value.path()).read_text())
        self.assertEqual(exported,before_remove)
        self.assertTrue(all(asset['data'].startswith('data:image/png;base64,') for asset in exported['assets']))
        self.page.reload(wait_until='domcontentloaded')
        self.ready()
        self.assertEqual(self.project(),before_remove)


if __name__=='__main__':unittest.main(verbosity=2)
