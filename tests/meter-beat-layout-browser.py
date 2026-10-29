"""Measure beat-label layout in the real classroom at four screen sizes.

The production origin is routed to this checkout, with disposable saves and no
external services. --phase before --capture-only uses the preserved pre-fix
meter CSS/JS snapshots and writes actual clipping measurements without failing.
Normal execution checks all eight lesson steps in Look and Try and writes
/tmp/music51-meter-after-{320,390,844,1440}.png plus JSON measurement reports.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from urllib.parse import urlparse

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location('meter_kids_helpers', Path(__file__).with_name('kids-learning-browser.py'))
_kids = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_kids)
OPTIONS = None

MEASURE = r'''() => {
  const round=n=>Math.round(n*100)/100;
  const box=r=>({left:round(r.left),top:round(r.top),right:round(r.right),bottom:round(r.bottom),width:round(r.width),height:round(r.height)});
  const cells=Array.from(document.querySelectorAll('.time-signature-activity .signature-pulse')).map(node=>{
    const rect=node.getBoundingClientRect(),style=getComputedStyle(node);
    const inner={left:rect.left+parseFloat(style.borderLeftWidth)+parseFloat(style.paddingLeft),
      top:rect.top+parseFloat(style.borderTopWidth)+parseFloat(style.paddingTop),
      right:rect.right-parseFloat(style.borderRightWidth)-parseFloat(style.paddingRight),
      bottom:rect.bottom-parseFloat(style.borderBottomWidth)-parseFloat(style.paddingBottom)};
    const texts=[];let textLines=0;
    for(const child of node.childNodes)if(child.nodeType===Node.TEXT_NODE&&child.textContent.trim()) {
      const range=document.createRange();range.selectNodeContents(child);
      texts.push(box(range.getBoundingClientRect()));textLines+=range.getClientRects().length;range.detach();
    }
    return {label:node.textContent.trim(),cell:box(rect),inner,range:texts,textLines,font:parseFloat(style.fontSize),
      scrollWidth:node.scrollWidth,clientWidth:node.clientWidth,scrollHeight:node.scrollHeight,clientHeight:node.clientHeight};
  });
  const components=Array.from(document.querySelectorAll('.time-signature-activity,.signature-visual,.signature-pulse-row,.signature-bar,.classroom-tutorial,.classroom-books'))
    .filter(node=>node.getClientRects().length).map(node=>({name:node.className,box:box(node.getBoundingClientRect()),
      scrollWidth:node.scrollWidth,clientWidth:node.clientWidth}));
  return {cells,components,viewport:{width:innerWidth,height:innerHeight}};
}'''


class MeterBeatLayoutTests(_kids._world.WorldBrowserCase):
    # Reuse navigation methods explicitly, without inheriting the broad kids
    # suite or importing any unrelated test methods into this focused class.
    room = _kids.KidsLearningTests.room
    state = _kids.KidsLearningTests.state
    dismiss = _kids.KidsLearningTests.dismiss
    talk_to_haydn = _kids.KidsLearningTests.talk_to_haydn
    open_lesson = _kids.KidsLearningTests.open_lesson

    def setUp(self):
        self.width = int(self._testMethodName.rsplit('_', 1)[1])
        height = {1440: 1000, 390: 844, 844: 390, 320: 740}[self.width]
        phone = self.width != 1440
        self.context = self.browser.new_context(viewport={'width': self.width, 'height': height}, is_mobile=phone, has_touch=phone)
        self.context.route('https://**/*', lambda route: route.abort())
        self.context.route('https://cwoodmusic.github.io/**', self.route_checkout)
        self.context.add_init_script("localStorage.setItem('codaArcadeFXV1','off')")
        self.page = self.context.new_page()
        self.page.set_default_timeout(10000)
        self.errors, self.failures = [], []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('console', lambda message: self.errors.append(message.text) if 'Arcade frame error:' in message.text else None)
        self.page.on('response', lambda response: self.failures.append(response.url)
            if response.status >= 400 and '/coda-arcade/' in response.url and not response.url.endswith('favicon.ico') else None)
        self.load()

    def route_checkout(self, route):
        name = Path(urlparse(route.request.url).path).name
        if OPTIONS.phase == 'before' and name in ('time-signature-lesson.css', 'time-signature-lesson.js'):
            snapshot = Path('/tmp/music51-meter-before.'+name.rsplit('.', 1)[1])
            return route.fulfill(path=str(snapshot), content_type='text/css' if name.endswith('.css') else 'text/javascript')
        return super().route_checkout(route)

    def measure(self, index, stage, meter):
        metrics = self.page.evaluate(MEASURE)
        metrics.update(step=index, stage=stage, meter=meter)
        problems = []
        cells = metrics['cells']
        expected = {'4/4': ['ONE', 'two', 'three', 'four'], '6/8': ['ONE', 'la', 'li', 'TWO', 'la', 'li'], '2/2': ['ONE', 'and', 'TWO', 'and']}
        if cells and [cell['label'] for cell in cells] != expected[meter]:
            problems.append('Wrong count labels: '+str([cell['label'] for cell in cells]))
        for number, cell in enumerate(cells):
            if not cell['range']:
                problems.append(f'Cell {number} has no direct beat text Range to measure')
            if cell['textLines'] != 1:
                problems.append(f'Cell {number} {cell["label"]} wraps across {cell["textLines"]} lines')
            if self.width != 1440 and cell['font'] < 20:
                problems.append(f'Cell {number} count font is only {cell["font"]}px')
            if cell['scrollWidth'] > cell['clientWidth']+1 or cell['scrollHeight'] > cell['clientHeight']+1:
                problems.append(f'Cell {number} scrolls: {cell["scrollWidth"]}×{cell["scrollHeight"]} inside {cell["clientWidth"]}×{cell["clientHeight"]}')
            for text in cell['range']:
                if text['left'] < cell['inner']['left']-.75 or text['right'] > cell['inner']['right']+.75 or text['top'] < cell['inner']['top']-.75 or text['bottom'] > cell['inner']['bottom']+.75:
                    problems.append(f'Cell {number} {cell["label"]} text exceeds padded inner cell: text={text}, inner={cell["inner"]}')
                for other_number, other in enumerate(cells):
                    if number == other_number:
                        continue
                    target = other['cell']
                    if min(text['right'], target['right'])-max(text['left'], target['left']) > .75 and min(text['bottom'], target['bottom'])-max(text['top'], target['top']) > .75:
                        problems.append(f'Cell {number} text overlaps neighboring cell {other_number}')
        if len(cells) == 6:
            first, second = cells[:3], cells[3:]
            aligned = lambda group: max(cell['cell']['top'] for cell in group)-min(cell['cell']['top'] for cell in group) < 2
            if not aligned(first) or not aligned(second):
                problems.append('Six-eight must keep each group of three on one row')
            if abs(first[0]['cell']['top']-second[0]['cell']['top']) < 2:
                normal_gaps = [cells[i+1]['cell']['left']-cells[i]['cell']['right'] for i in (0, 1, 3, 4)]
                group_gap = cells[3]['cell']['left']-cells[2]['cell']['right']
                if group_gap < max(normal_gaps)+1:
                    problems.append('Six-eight has no visible separation between its two groups of three')
        for component in metrics['components']:
            if component['scrollWidth'] > component['clientWidth']+1:
                problems.append('Horizontal component overflow: '+str(component))
        metrics['problems'] = problems
        return metrics

    def walk_lesson(self):
        self.open_lesson('time-signatures')
        steps = self.page.evaluate('CodaTimeSignatureLesson.STEPS')
        self.assertEqual(len(steps), 8)
        measurements = []
        for index, step in enumerate(steps):
            self.assertEqual(self.state()['active']['step'], index)
            self.assertEqual(self.page.locator('.time-signature-activity').get_attribute('data-signature-stage'), 'look')
            measurements.append(self.measure(index, 'look', step['meter']))
            if index == 4:
                self.page.screenshot(path=f'/tmp/music51-meter-{OPTIONS.phase}-{self.width}.png')
            self.page.locator('[data-signature-try]').click()
            self.assertEqual(self.page.locator('.time-signature-activity').get_attribute('data-signature-stage'), 'try')
            measurements.append(self.measure(index, 'try', step['meter']))
            if step['kind'] == 'choice':
                self.page.locator(f'[data-signature-answer="{step["correct"]}"]').click()
            else:
                for beats in step['recipe']:
                    self.page.locator(f'[data-signature-add="{beats:g}"]').click()
                self.page.locator('[data-signature-check]').click()
            self.assertTrue(self.state()['active']['answered'])
            self.page.locator('[data-tutorial-next]').click()
        self.assertEqual(self.state()['active']['phase'], 'quiz')
        report = Path(f'/tmp/music51-meter-{OPTIONS.phase}-{self.width}.json')
        report.write_text(json.dumps(measurements, indent=2)+'\n')
        failures = [{'step': record['step'], 'stage': record['stage'], 'meter': record['meter'], 'problems': record['problems']}
                    for record in measurements if record['problems']]
        print(json.dumps({'viewport': self.width, 'screens': len(measurements), 'report': str(report), 'failures': failures}, indent=2))
        if not OPTIONS.capture_only:
            self.assertEqual(failures, [], 'Beat labels clip, overlap, shrink, or overflow: '+str(report))

    def test_layout_1440(self):
        self.walk_lesson()

    def test_layout_390(self):
        self.walk_lesson()

    def test_layout_320(self):
        self.walk_lesson()

    def test_layout_844(self):
        self.walk_lesson()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase', choices=('before', 'after'), default='after')
    parser.add_argument('--capture-only', action='store_true')
    OPTIONS, remaining = parser.parse_known_args()
    unittest.main(argv=[__file__, *remaining], verbosity=2)
