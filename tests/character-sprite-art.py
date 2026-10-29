"""Optional read-only validation of retained, inactive image sprite artifacts.

Run from the repository root: python3 tests/character-sprite-art.py
Requires Pillow; does not regenerate or modify any artwork.
"""
import json
from pathlib import Path
import unittest

from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'assets/characters'


class CharacterSpriteArtTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest=json.loads((ART/'manifest.json').read_text())
        cls.width,cls.height=cls.manifest['cell']
        cls.columns=cls.manifest['columns']
        cls.count=len(cls.manifest['directions'])*cls.manifest['framesPerDirection']

    def frame(self,image,index,animated=True):
        columns=self.columns if animated else len(self.manifest['directions'])
        x,y=index%columns*self.width,index//columns*self.height
        return image.crop((x,y,x+self.width,y+self.height))

    def test_manifest_references_complete_transparent_atlases_without_cell_edge_clipping(self):
        manifest=self.manifest
        self.assertEqual(manifest['version'],1)
        self.assertEqual(manifest['cell'],[80,96])
        self.assertEqual(manifest['anchor'],[40,88])
        self.assertEqual(manifest['directions'],['down','left','up','right'])
        self.assertEqual(len(manifest['frameData']),self.count)
        ranges=[number for clip in manifest['clips'].values() for number in range(clip['offset'],clip['offset']+clip['frames'])]
        self.assertEqual(sorted(ranges),list(range(manifest['framesPerDirection'])),'Action clips must cover their directional strip without overlaps or gaps')
        layers=[manifest['layers']['body']]
        for category,variants in manifest['layers'].items():
            if category!='body':
                layers.extend(variants.values())
        artifacts={item['file']:item for item in manifest['artifacts']}
        self.assertEqual(set(artifacts),{layer['url'] for layer in layers},'Every selectable layer must be shipped, and every shipped atlas must be declared')
        for layer in layers:
            with self.subTest(atlas=layer['url']):
                file=ART/layer['url']
                self.assertEqual(file.parent,ART,'Sprite paths must stay inside the asset directory')
                with Image.open(file) as source:
                    self.assertEqual(source.format,'PNG')
                    self.assertEqual(source.mode,'RGBA','Atlas transparency must be retained')
                    image=source.copy()
                animated=layer['layout']=='animated'
                expected=(self.width*self.columns,self.height*((self.count+self.columns-1)//self.columns)) if animated else (self.width*4,self.height)
                self.assertEqual(image.size,expected)
                self.assertEqual(image.size,(artifacts[layer['url']]['width'],artifacts[layer['url']]['height']))
                self.assertEqual(image.getchannel('A').getextrema()[0],0,'A layer must not have an opaque rectangular matte')
                for index in range(self.count if animated else 4):
                    box=self.frame(image,index,animated).getchannel('A').getbbox()
                    if box:  # Bald hair and some back-facing attachments are intentionally blank.
                        self.assertTrue(box[0]>0 and box[1]>0 and box[2]<self.width and box[3]<self.height,
                                        f'Frame {index} reaches a cell edge and may be clipped or leak neighboring artwork: {box}')

    def test_continuous_rig_has_detailed_distinct_neutral_views(self):
        self.assertEqual(self.manifest.get('motionRig',{}).get('version'),1,
                         'Runtime motion must use the continuous original-pixel rig')
        with Image.open(ART/self.manifest['layers']['body']['url']) as source:
            body=source.convert('RGBA')
        views=[]
        for direction in range(4):
            neutral=self.frame(body,direction*self.manifest['framesPerDirection'])
            views.append(neutral.tobytes())
            pixels=neutral.load()
            colors={pixels[x,y] for y in range(self.height) for x in range(self.width) if pixels[x,y][3]>128}
            self.assertGreater(len(colors),24,'The neutral templates must retain original shading and facial detail')
            box=neutral.getchannel('A').getbbox()
            self.assertIsNotNone(box)
            self.assertTrue(40<=box[3]-box[1]<=55,'Each facing must retain the compact original standing proportions')
        self.assertEqual(len(set(views)),4,'All four facing views must contain direction-specific artwork')

    def test_animated_body_and_shoes_share_the_gameplay_foot_anchor(self):
        anchor_x,anchor_y=self.manifest['anchor']
        with Image.open(ART/self.manifest['layers']['body']['url']) as source:
            body=source.convert('RGBA')
        for index in range(self.count):
            box=self.frame(body,index).getchannel('A').getbbox()
            self.assertIsNotNone(box,f'Body frame {index} is empty')
            self.assertTrue(anchor_y-3<=box[3]<=anchor_y+1,f'Body frame {index} moves off its foot anchor: {box}')
            self.assertLessEqual(abs((box[0]+box[2])/2-anchor_x),15,'A direction must not jump sideways in its shared cell')
        for variant,layer in self.manifest['layers']['shoes'].items():
            with Image.open(ART/layer['url']) as source:
                shoes=source.convert('RGBA')
            for index in range(self.count):
                box=self.frame(shoes,index).getchannel('A').getbbox()
                self.assertIsNotNone(box,f'{variant} disappears from frame {index}')
                self.assertTrue(anchor_y-3<=box[3]<=anchor_y+1,f'{variant} floats or drops below the character in frame {index}: {box}')
                self.assertLessEqual(abs((box[0]+box[2])/2-anchor_x),10,'Shoes must stay centered on the same character rig')

    def test_base_is_a_real_bald_gray_redraw_with_complete_scalps(self):
        base=self.manifest['baseAvatar']
        self.assertEqual(self.manifest['sourcePolicy'],'redrawn-base-and-original-cosmetics')
        self.assertEqual(base['neutralColors'],{'shirt':'#999ca6','lowerColor':'#626875'})
        self.assertEqual(base['url'],'source/base-avatar-gray.png')
        with Image.open(ART/base['url']) as source:
            self.assertEqual(source.mode,'RGBA');self.assertGreaterEqual(source.width,source.height*2)
            self.assertEqual(source.getchannel('A').getextrema()[0],0)
        with Image.open(ART/self.manifest['layers']['body']['url']) as source:
            body=source.convert('RGBA')
        for direction,frame in enumerate(base['frames']):
            with self.subTest(direction=self.manifest['directions'][direction]):
                neutral=self.frame(body,direction*self.manifest['framesPerDirection'])
                pixels=neutral.load();scalp=[pixels[x,y] for y in range(40,48) for x in range(33,47) if pixels[x,y][3]>128]
                self.assertGreater(len(scalp),80,'Bald must show a drawn scalp, not empty cap pixels')
                warm=[p for p in scalp if p[0]>=p[1]*.98 and p[1]>p[2]*1.02 and p[0]>90]
                self.assertGreater(len(warm)/len(scalp),.9,'The bare scalp must be skin rather than hair or cap colors')
                shirt=[pixels[x,y] for y in range(frame['clothesTop']+3,frame['waist']) for x in range(35,45) if pixels[x,y][3]>128]
                pants=[pixels[x,y] for y in range(frame['waist']+1,frame['shoeTop']) for x in range(33,38) if pixels[x,y][3]>128]
                for name,samples in [('shirt',shirt),('pants',pants)]:
                    self.assertGreater(len(samples),5,name)
                    gray=[p for p in samples if max(p[:3])-min(p[:3])<50]
                    self.assertGreater(len(gray)/len(samples),.8,f'The stripped-down {name} must be neutral gray')
                self.assertEqual(frame['placement'][1]+frame['height'],88)
        pants=self.manifest['layers']['outfit']['pants']
        self.assertEqual(pants['material'],'gray-clothes')
        self.assertEqual(len(pants['dyeRegions']),4)

    def test_original_generated_layer_sources_remain_available_and_transparent(self):
        expected={'body-poses.png','hair.png','outfits.png','headwear.png','accessories.png','shoes-props.png'}
        self.assertTrue(expected.issubset({file.name for file in (ART/'source').glob('*.png')}))
        for name in expected:
            with self.subTest(source=name),Image.open(ART/'source'/name) as source:
                self.assertEqual(source.format,'PNG')
                self.assertEqual(source.mode,'RGBA')
                self.assertGreaterEqual(min(source.size),512,'Keep the full generated source, not a tiny runtime thumbnail')
                low,high=source.getchannel('A').getextrema()
                self.assertEqual(low,0)
                self.assertGreater(high,200,'The retained source must contain visible artwork')
        self.assertTrue((ROOT/'coda_arcade_phase73_characters.png').is_file(),'The previous actor atlas must remain available for existing scene crops')


if __name__=='__main__':
    unittest.main(verbosity=2)
