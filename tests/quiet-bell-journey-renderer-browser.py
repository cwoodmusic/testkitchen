"""Real SVG geometry checks for discovered-only journey graphs and future loops."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):
        if self.path == '/__journey_renderer_test__':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(b'<!doctype html><html><body><div id="chart"></div></body></html>')
        else:
            super().do_GET()


NODES = [{'id': id, 'title': id.upper()} for id in ['a', 'b', 'c']]


def render(page, edges, nodes=NODES, current='unvisited-room'):
    return page.evaluate('''({nodes,edges,current})=>{
      const chart=document.getElementById('chart');
      window.renderJourney(chart,{nodes,edges},{currentNodeId:current});
      const svg=chart.querySelector('svg');
      const box=svg?.viewBox.baseVal;
      return {
        nodes:[...chart.querySelectorAll('[data-journey-node]')].map(e=>e.dataset.journeyNode),
        edges:[...chart.querySelectorAll('[data-journey-edge]')].map(e=>e.dataset.journeyEdge),
        paths:[...chart.querySelectorAll('[data-journey-edge]')].map(e=>e.getAttribute('d')),
        here:chart.querySelectorAll('.journey-chart__current').length,
        text:chart.textContent,
        routes:[...chart.querySelectorAll('li')].map(e=>e.textContent),
        bounds:svg?[...svg.querySelectorAll('path')].map(e=>{
          const r=e.getBBox();
          return {x:r.x,y:r.y,right:r.x+r.width,bottom:r.y+r.height,
            maxX:box.x+box.width,maxY:box.y+box.height};
        }):[]
      };
    }''', {'nodes': nodes, 'edges': edges, 'current': current})


def inside_viewbox(result):
    for bounds in result['bounds']:
        assert bounds['x'] >= 0 and bounds['y'] >= 0, bounds
        assert bounds['right'] <= bounds['maxX'] and bounds['bottom'] <= bounds['maxY'], bounds


def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            page = browser.new_page()
            page.goto(f'http://127.0.0.1:{server.server_port}/__journey_renderer_test__')
            page.evaluate("async()=>{window.renderJourney=(await import('/games/rhythm-blocks/journey-view.mjs')).renderJourney;}")

            observed = render(page, [{'id': 'ac', 'from': 'a', 'to': 'c'}])
            assert observed['nodes'] == ['a', 'b', 'c']
            assert observed['edges'] == ['ac'], observed
            assert observed['here'] == 0 and 'unvisited-room' not in observed['text']
            inside_viewbox(observed)

            malformed = render(page, [None, {'id': 'bad', 'from': 'missing', 'to': 'a'},
                                      {'id': 'also-bad', 'from': 'a', 'to': 'missing'}])
            assert malformed['edges'] == [] and 'missing' not in malformed['text']

            shared = render(page, [{'id': 'ac', 'from': 'a', 'to': 'c'}, {'id': 'bc', 'from': 'b', 'to': 'c'}])
            assert shared['nodes'].count('c') == 1 and len(shared['paths']) == 2
            assert len(set(shared['paths'])) == 2
            inside_viewbox(shared)

            cycle = render(page, [{'id': 'ab', 'from': 'a', 'to': 'b'}, {'id': 'ba', 'from': 'b', 'to': 'a'}])
            assert cycle['edges'] == ['ab', 'ba']
            inside_viewbox(cycle)

            self_loop = render(page, [{'id': 'aa', 'from': 'a', 'to': 'a'}])
            assert self_loop['edges'] == ['aa']
            inside_viewbox(self_loop)

            parallel = render(page, [{'id': 'ac1', 'from': 'a', 'to': 'c'}, {'id': 'ac2', 'from': 'a', 'to': 'c'}])
            assert len(set(parallel['paths'])) == 2
            assert parallel['routes'][0] == 'A. Travelled to C.', parallel['routes']
            inside_viewbox(parallel)

            empty = render(page, [], nodes=[])
            assert empty['nodes'] == empty['edges'] == []
            assert 'Your journey begins' in empty['text']
            browser.close()
        print('Journey renderer: observed-only, malformed, converging, cycle, self-loop, parallel and empty checks passed.')
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
