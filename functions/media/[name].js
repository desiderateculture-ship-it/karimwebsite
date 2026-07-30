// Range-capable video delivery. Cloudflare Pages' static asset serving stalls
// HTML5 media requests for large MP4s (no Range support), so /media/<file>
// proxies the static asset and implements Range semantics itself.
export async function onRequest({ request, env, params }) {
  const name = params.name;
  if (!/^[\w.-]+\.mp4$/.test(name)) return new Response('Not found', { status: 404 });

  const assetUrl = new URL('/assets/' + name, request.url);
  const assetResp = await env.ASSETS.fetch(new Request(assetUrl.toString()));
  if (!assetResp.ok) return new Response('Not found', { status: 404 });

  const buf = await assetResp.arrayBuffer();
  const total = buf.byteLength;
  const common = {
    'Accept-Ranges': 'bytes',
    'Content-Type': 'video/mp4',
    'Cache-Control': 'public, max-age=14400',
  };

  const range = request.headers.get('Range');
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!m || (m[1] === '' && m[2] === '')) {
      return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + total } });
    }
    let start, end;
    if (m[1] === '') {           // suffix range: last N bytes
      start = Math.max(0, total - parseInt(m[2], 10));
      end = total - 1;
    } else {
      start = parseInt(m[1], 10);
      end = m[2] === '' ? total - 1 : Math.min(parseInt(m[2], 10), total - 1);
    }
    if (start > end || start >= total) {
      return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + total } });
    }
    return new Response(buf.slice(start, end + 1), {
      status: 206,
      headers: {
        ...common,
        'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
        'Content-Length': String(end - start + 1),
      },
    });
  }

  return new Response(buf, { status: 200, headers: { ...common, 'Content-Length': String(total) } });
}
