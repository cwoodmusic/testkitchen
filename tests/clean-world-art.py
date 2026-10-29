"""Read-only checks for the cleaned pixel-art assets (requires Pillow)."""
from pathlib import Path
import hashlib
import json
import unittest

from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
COUCH=json.loads((ROOT/'scripts/dance-couch-repair.json').read_text())
ALIGNMENT=json.loads((ROOT/'scripts/dance-alignment-repair.json').read_text())

def polygon_contains(px,py,polygon):
    hit=False
    for a,b in zip(polygon,polygon[1:]+polygon[:1]):
        if (a[1]>py)!=(b[1]>py) and px<(b[0]-a[0])*(py-a[1])/(b[1]-a[1])+a[0]:
            hit=not hit
    return hit

def couch_contains(x,y):
    # Test pixel centres, with a half-pixel allowance for Canvas edge coverage.
    return any(polygon_contains(x+dx,y+dy,COUCH['polygon']) for dx in (.01,.5,.99) for dy in (.01,.5,.99))

def alignment_floor_contains(x,y,atlas):
    if not any(polygon_contains(x+.5,y+.5,polygon) for polygon in ALIGNMENT['floorPolygons']):
        return False
    # The palm and sofa are authored fixtures, not floor texture. Even where
    # their bounds overlap the repair polygon, every opaque mask pixel stays.
    for fixture in ALIGNMENT['floorExclusions']:
        bx,by,bw,bh=fixture['bounds'];ax,ay,_,_=fixture['atlas']
        if bx<=x<bx+bw and by<=y<by+bh and atlas.getpixel((ax+x-bx,ay+y-by))[3]>0:
            return False
    return True

def alignment_world_mask(atlas):
    width,height=ALIGNMENT['worldSize'];mask=bytearray(width*height)
    bx,by,bw,bh=COUCH['foreground']['bounds']
    for y in range(by,by+bh):
        for x in range(bx,bx+bw):
            if couch_contains(x,y):mask[y*width+x]=1
    for polygon in ALIGNMENT['floorPolygons']:
        for y in range(min(p[1] for p in polygon),max(p[1] for p in polygon)):
            for x in range(min(p[0] for p in polygon),max(p[0] for p in polygon)):
                if alignment_floor_contains(x,y,atlas):mask[y*width+x]=1
    return mask

def couch_atlas_mask(atlas):
    mask=bytearray(atlas.width*atlas.height)
    bx,by,bw,bh=COUCH['foreground']['bounds'];ax,ay,_,_=COUCH['foreground']['atlas']
    for y in range(by,by+bh):
        for x in range(bx,bx+bw):
            if couch_contains(x,y):mask[(ay+y-by)*atlas.width+ax+x-bx]=1
    return mask

def outside_hash(image,mask):
    data=bytearray(image.convert('RGBA').tobytes())
    for index,allowed in enumerate(mask):
        if allowed:data[index*4:index*4+4]=b'\0'*4
    return hashlib.sha256(data).hexdigest()

def aisle_grid_failures(image):
    """Independent native-pixel witnesses taken from surviving aisle grout.

    A tile's middle must stay brighter than its two grout edges: the old
    inpaint put a second dark row through that middle below the sofa. The
    vertical checks ensure those horizontal edges meet the original columns.
    Neither these coordinates nor the contrast bound comes from repair UVs.
    """
    rgb=image.convert('RGB')
    shade=lambda x,y:sum(rgb.getpixel((x,y)))/3
    failures=[]
    for top,bottom,middle in [(702,714,708),(714,725,719),(725,737,731),(737,748,742)]:
        for x in (659,671,683):
            edge=max(min(shade(x,y) for y in range(top-1,top+2)),
                     min(shade(x,y) for y in range(bottom-1,bottom+2)))
            interior=sum(shade(x,y) for y in range(middle-1,middle+2))/3
            if interior-edge<8:failures.append(('extra-row',x,middle,round(interior-edge,2)))
    for y in (708,719,731,742):
        for x in (653,665,677):
            edge=min(shade(xx,y) for xx in range(x-1,x+2))
            interior=(shade(x-4,y)+shade(x+4,y))/2
            if interior-edge<8:failures.append(('column-break',x,y,round(interior-edge,2)))
    return failures

def pixels(image):
    return image.get_flattened_data() if hasattr(image,'get_flattened_data') else image.getdata()


class CleanWorldArtTests(unittest.TestCase):
    def test_original_grid_and_art_are_unchanged_outside_authorized_repairs(self):
        original=Image.open(ROOT/'coda_arcade_phase86_approved_world.png').convert('RGB')
        clean=Image.open(ROOT/'coda_arcade_world_clean.png').convert('RGB')
        metadata=json.loads((ROOT/'scripts/clean-world-regions.json').read_text())
        self.assertEqual(original.size,(1672,941));self.assertEqual(clean.size,original.size)
        self.assertEqual(len(metadata['regions']),33)
        width,height=clean.size;padding=metadata['padding'];allowed=bytearray(width*height)
        for region in metadata['regions']:
            x,y,w,h=region['bounds']
            for row in range(max(0,y-padding),min(height,y+h+padding)):
                start=row*width+max(0,x-padding);end=row*width+min(width,x+w+padding)
                allowed[start:end]=b'\x01'*(end-start)
        plant_repairs=json.loads((ROOT/'scripts/dance-plant-repairs.json').read_text())
        for region in plant_repairs['allowedRegions']:
            x,y,w,h=region['bounds']
            for row in range(y,y+h):
                allowed[row*width+x:row*width+x+w]=b'\x01'*w
        bx,by,bw,bh=COUCH['foreground']['bounds']
        for y in range(by,by+bh):
            for x in range(bx,bx+bw):
                if couch_contains(x,y):allowed[y*width+x]=1
        # Release 69 repairs only the aisle's old character-removal patch.
        atlas=Image.open(ROOT/'coda_arcade_foreground_clean.png').convert('RGBA')
        for index,value in enumerate(alignment_world_mask(atlas)):
            if value:allowed[index]=1
        changed=0
        for index,(old,new) in enumerate(zip(pixels(original),pixels(clean))):
            if old!=new:
                self.assertTrue(allowed[index],f'Unrelated pixel changed at {index%width},{index//width}')
                changed+=1
        self.assertGreater(changed,50000,'The original characters must actually be removed')

    def test_foreground_keeps_atlas_layout_and_existing_occlusion_silhouettes(self):
        original=Image.open(ROOT/'coda_arcade_phase892_foreground.png').convert('RGBA')
        clean=Image.open(ROOT/'coda_arcade_foreground_clean.png').convert('RGBA')
        self.assertEqual(original.size,(2048,880));self.assertEqual(clean.size,original.size)
        # Only former head protrusions above these counters may lose mask alpha.
        allowed=[(546,3,64,37),(848,3,64,24),(1428,3,64,21),
                 (933,280,67,90),(370,530,65,72)]
        removed=0
        for index,(old,new) in enumerate(zip(pixels(original),pixels(clean))):
            if old[3]!=new[3]:
                x,y=index%2048,index//2048
                bx,by,_,_=COUCH['foreground']['bounds']
                ax,ay,aw,ah=COUCH['foreground']['atlas']
                if ax<=x<ax+aw and ay<=y<ay+ah and couch_contains(bx+x-ax,by+y-ay):
                    self.assertEqual(new[3],255,'The repaired sofa must lift as one complete object')
                    continue
                self.assertTrue(any(bx<=x<bx+w and by<=y<by+h for bx,by,w,h in allowed),(x,y))
                self.assertEqual(new[3],0,'Cleanup must not grow new occluding regions')
                removed+=1
        self.assertGreater(removed,100)

    def test_repaired_sofa_arm_and_base_fit_the_existing_movable_atlas_entry(self):
        world=Image.open(ROOT/'coda_arcade_world_clean.png').convert('RGBA')
        atlas=Image.open(ROOT/'coda_arcade_foreground_clean.png').convert('RGBA')
        with Image.open(ROOT/COUCH['source']) as source:
            self.assertEqual(list(source.size),COUCH['sourceSize'])
        bx,by,bw,bh=COUCH['foreground']['bounds'];ax,ay,aw,ah=COUCH['foreground']['atlas']
        self.assertEqual((bw,bh),(aw,ah))
        self.assertTrue(all(bx<=x<=bx+bw and by<=y<=by+bh for x,y in COUCH['polygon']))
        # These right-arm/base pixels were outside the old cropped silhouette.
        for x,y in [(700,672),(700,688),(689,696),(675,690),(635,674)]:
            with self.subTest(point=(x,y)):
                self.assertTrue(couch_contains(x,y))
                self.assertEqual(atlas.getpixel((ax+x-bx,ay+y-by)),world.getpixel((x,y)))
                self.assertEqual(atlas.getpixel((ax+x-bx,ay+y-by))[3],255)

    def test_alignment_changes_only_the_reviewed_couch_and_aisle_pixels(self):
        world=Image.open(ROOT/'coda_arcade_world_clean.png').convert('RGBA')
        atlas=Image.open(ROOT/'coda_arcade_foreground_clean.png').convert('RGBA')
        self.assertEqual(ALIGNMENT['worldSize'],[1672,941])
        self.assertEqual(ALIGNMENT['couchPolygon'],COUCH['polygon'])
        self.assertEqual(ALIGNMENT['foreground'],COUCH['foreground'])
        self.assertEqual(ALIGNMENT['floorPolygons'],[
            [[618,675],[708,675],[708,778],[661,778],[651,753],[639,723],[626,693]]])
        self.assertEqual(ALIGNMENT['floorExclusions'],[
            COUCH['foreground'],
            {'name':'dance_right_palm','bounds':[687,683,72,84],'atlas':[1004,280,72,84]}])
        with Image.open(ROOT/ALIGNMENT['source']) as source:
            self.assertEqual(list(source.size),ALIGNMENT['sourceSize'])
        # These digests were computed from the immutable pre-69 PNGs before
        # compositing, zeroing exactly this polygon union. They do not depend on
        # a temporary file, the generated texture, or the compositor's output.
        self.assertEqual(outside_hash(world,alignment_world_mask(atlas)),ALIGNMENT['outsideWorldSha256'],
                         'Pixels outside the sofa/aisle scopes, including protected fixture pixels, changed')
        self.assertEqual(outside_hash(atlas,couch_atlas_mask(atlas)),ALIGNMENT['outsideAtlasSha256'],
                         'No foreground atlas entry outside the existing sofa mask may change')
        self.assertEqual(ALIGNMENT['outsideAtlasSha256'],COUCH['outsideAtlasSha256'],
                         'The earlier atlas preservation contract still applies')
        self.assertEqual(hashlib.sha256(atlas.getchannel('A').tobytes()).hexdigest(),ALIGNMENT['beforeAtlasAlphaSha256'],
                         'Aligning cushion seams must retain every pre-69 occlusion-alpha pixel')

    def test_rebuilt_aisle_grout_meets_the_surviving_rows_and_columns(self):
        image=Image.open(ROOT/'coda_arcade_world_clean.png')
        self.assertEqual(aisle_grid_failures(image),[],
                         'Aisle tiles need continuous grout and an unbroken interior between each pair of rows')

    def test_all_four_pictured_plants_are_removed_from_the_rebuilt_art(self):
        original=Image.open(ROOT/'coda_arcade_phase86_approved_world.png').convert('RGB')
        clean=Image.open(ROOT/'coda_arcade_world_clean.png').convert('RGB')
        # These boxes exclude the fifth palm that was outside the screenshot.
        boxes=[(696,547,763,637),(661,601,727,683),(798,524,837,601),(754,609,824,683)]
        green=lambda image:sum(g>r*1.12 and g>b*1.08 and g>65 for r,g,b in pixels(image))
        for box in boxes:
            with self.subTest(box=box):
                self.assertGreater(green(original.crop(box)),45)
                self.assertLess(green(clean.crop(box)),10,'No foliage should remain')
        atlas=Image.open(ROOT/'coda_arcade_foreground_clean.png').convert('RGBA')
        for box in [(933,280,1000,370),(370,530,435,602)]:
            self.assertEqual(atlas.crop(box).getchannel('A').getbbox(),None,
                             'Removed foreground plants must not repaint the repair')


if __name__=='__main__':
    unittest.main(verbosity=2)
