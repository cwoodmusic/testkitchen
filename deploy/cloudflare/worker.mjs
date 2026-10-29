/* Static arcade proxy. Firebase stays a direct browser connection. */
const SITE_HOST = 'www.coda-arcade.com';
const APEX_HOST = 'coda-arcade.com';
export const SITE_ORIGIN = 'https://' + SITE_HOST;
export const UPSTREAM_ORIGIN = 'https://cwoodmusic.github.io';
const MAIN = '/coda-arcade';
const GAMES = ['/Pitch-Race', '/musictriad', '/rhythmroom'];
const REQUEST_HEADERS = ['Accept', 'If-None-Match', 'If-Modified-Since', 'Range', 'If-Range'];

function within(path, prefix) {
  return path === prefix || path.startsWith(prefix + '/');
}

function safePath(path) {
  // Do not let encoded separators or another decoding pass change the project.
  if (/%(?:2f|5c|00|0a|0d)/i.test(path) || path.includes('\\') || path.includes('//')) return false;
  let decoded;
  try { decoded = decodeURIComponent(path); } catch { return false; }
  return !/[\x00-\x1f\x7f\\]/.test(decoded) && !/%[\da-f]{2}/i.test(decoded) &&
    !decoded.split('/').some(part => part === '.' || part === '..');
}

export function upstreamURL(value) {
  const incoming = new URL(value);
  if (!safePath(incoming.pathname)) return null;
  const target = new URL(UPSTREAM_ORIGIN);
  const child = GAMES.some(prefix => within(incoming.pathname, prefix));
  // Accept the old main-project prefix as an alias, without duplicating it.
  target.pathname = child || within(incoming.pathname, MAIN)
    ? incoming.pathname : MAIN + incoming.pathname;
  target.search = incoming.search;
  return target;
}

export function publicRedirect(value, upstream) {
  let target;
  try { target = new URL(value, upstream); } catch { return null; }
  if (target.origin !== UPSTREAM_ORIGIN || !safePath(target.pathname)) return null;
  let path;
  if (within(target.pathname, MAIN)) path = target.pathname.slice(MAIN.length) || '/';
  else if (GAMES.some(prefix => within(target.pathname, prefix))) path = target.pathname;
  else return null;
  return SITE_ORIGIN + path + target.search + target.hash;
}

const message = (text, status, extra = {}) => new Response(text, {
  status, headers: {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...extra}
});

export async function handleRequest(request, fetcher = fetch) {
  if (!['GET', 'HEAD'].includes(request.method)) return message('Only GET and HEAD are supported.', 405, {Allow: 'GET, HEAD'});
  let incoming, target;
  try { incoming = new URL(request.url); target = upstreamURL(incoming); }
  catch { return message('Invalid URL.', 400); }
  if (![SITE_HOST, APEX_HOST].includes(incoming.hostname) || incoming.port) return message('Unknown arcade host.', 421);
  if (!target) return message('Invalid asset path.', 400);
  if (!['http:', 'https:'].includes(incoming.protocol)) return message('Invalid arcade origin.', 400);
  if (incoming.hostname === APEX_HOST || incoming.protocol === 'http:') return Response.redirect(SITE_ORIGIN + incoming.pathname + incoming.search, 308);
  if (incoming.origin !== SITE_ORIGIN) return message('Invalid arcade origin.', 400);
  const headers = new Headers();
  for (const name of REQUEST_HEADERS) if (request.headers.has(name)) headers.set(name, request.headers.get(name));
  // Construct a fresh request: no browser credentials, cookies, or private headers.
  const upstreamRequest = new Request(target, {method: request.method, headers, redirect: 'manual'});
  let response;
  try { response = await fetcher(upstreamRequest); }
  catch { return message('The arcade could not load. Please try again.', 502); }
  const outgoing = new Headers(response.headers);
  outgoing.delete('Set-Cookie');
  outgoing.delete('Set-Cookie2');
  outgoing.delete('WWW-Authenticate');
  outgoing.delete('Proxy-Authenticate');
  if (response.status >= 300 && response.status < 400 && outgoing.has('Location')) {
    const destination = publicRedirect(outgoing.get('Location'), target);
    if (!destination) return message('The upstream redirect is outside the arcade.', 502);
    outgoing.set('Location', destination);
  }
  const body = request.method === 'HEAD' || [204, 205, 304].includes(response.status) ? null : response.body;
  return new Response(body, {status: response.status, statusText: response.statusText, headers: outgoing});
}

export default {fetch: request => handleRequest(request)};
