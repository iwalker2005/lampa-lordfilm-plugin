const VERSION = '1.0.1';

const PLUGIN_REDIRECT_URL = 'https://cdn.jsdelivr.net/gh/iwalker2005/lampa-lordfilm-plugin@main/lordfilm.js';

const DEFAULT_ALLOWED_HOSTS = [
  'lordfilm-2026.org',
  'www.lordfilm-2026.org',
  'plapi.cdnvideohub.com',
  'player.cdnvideohub.com',
  'api.rstprgapipt.com',
  '*.okcdn.ru',
  '*.allarknow.online',
  '*.stloadi.live'
];

const DEFAULT_VIDEO_HOSTS = [
  '*.okcdn.ru',
  'plapi.cdnvideohub.com',
  'player.cdnvideohub.com'
];

function splitHosts(value, fallback) {
  if (!value) return fallback.slice();
  return value.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
}

function hostAllowed(hostname, rules) {
  hostname = String(hostname || '').toLowerCase();
  return rules.some((rule) => {
    if (!rule) return false;
    if (rule.startsWith('*.')) return hostname.endsWith(rule.slice(1));
    return hostname === rule;
  });
}

function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Proxy-Token, Range',
    'Access-Control-Expose-Headers': 'Content-Type, Content-Length, Content-Range, Accept-Ranges, Cache-Control, ETag',
    'Vary': 'Origin',
    ...extra
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders({ 'Content-Type': 'application/json; charset=utf-8' })
  });
}

function getToken(request, url) {
  return request.headers.get('X-Proxy-Token') || url.searchParams.get('token') || '';
}

function authOk(request, url, env) {
  const required = String(env.PROXY_TOKEN || '').trim();
  if (!required) return true;
  return getToken(request, url) === required;
}

async function forwardRequest(request, targetUrl, { timeoutMs = 12000, wrapJson = false, streamMode = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const method = request.method === 'HEAD' ? 'HEAD' : 'GET';
    const headers = new Headers();

    const copy = ['user-agent', 'accept', 'accept-language', 'if-none-match', 'if-modified-since', 'range'];
    copy.forEach((h) => {
      const v = request.headers.get(h);
      if (v) headers.set(h, v);
    });

    headers.set('Origin', targetUrl.origin);
    headers.set('Referer', targetUrl.origin + '/');

    const upstream = await fetch(targetUrl.toString(), {
      method,
      headers,
      redirect: 'follow',
      signal: controller.signal
    });

    if (wrapJson) {
      const body = await upstream.text();
      return json({
        status: upstream.status,
        content_type: upstream.headers.get('content-type') || 'text/plain; charset=utf-8',
        body
      }, upstream.ok ? 200 : upstream.status);
    }

    const passHeaders = new Headers();
    const copyResponseHeaders = streamMode
      ? ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control', 'etag']
      : ['content-type', 'cache-control', 'etag'];

    copyResponseHeaders.forEach((h) => {
      const v = upstream.headers.get(h);
      if (v) passHeaders.set(h, v);
    });

    Object.entries(corsHeaders()).forEach(([k, v]) => passHeaders.set(k, v));

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: passHeaders
    });
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const timeoutMs = Math.max(5000, parseInt(env.UPSTREAM_TIMEOUT_MS || '12000', 10) || 12000);
    const allowedHosts = splitHosts(env.ALLOWED_HOSTS, DEFAULT_ALLOWED_HOSTS);
    const videoHosts = splitHosts(env.VIDEO_ALLOWED_HOSTS, DEFAULT_VIDEO_HOSTS);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === '/p' || url.pathname === '/plugin' || url.pathname === '/plugin.js') {
      return Response.redirect(PLUGIN_REDIRECT_URL, 302);
    }

    if (url.pathname === '/health') {
      return json({ ok: true, version: VERSION, time: new Date().toISOString() });
    }

    if (url.pathname === '/proxy') {
      if (!authOk(request, url, env)) return json({ status: 403, error: 'Forbidden' }, 403);

      const raw = url.searchParams.get('url');
      if (!raw) return json({ status: 400, error: 'Missing `url` query param' }, 400);

      let target;
      try {
        target = new URL(raw);
      } catch (e) {
        return json({ status: 400, error: 'Invalid target URL' }, 400);
      }

      if (!/^https?:$/i.test(target.protocol)) return json({ status: 400, error: 'Only http/https URLs are allowed' }, 400);
      if (!hostAllowed(target.hostname, allowedHosts)) return json({ status: 403, error: 'Target host is not allowed' }, 403);

      const wrap = url.searchParams.get('wrap') === '1';
      try {
        return await forwardRequest(request, target, { timeoutMs, wrapJson: wrap, streamMode: false });
      } catch (e) {
        if (e.name === 'AbortError') return json({ status: 504, error: 'Upstream timeout' }, 504);
        return json({ status: 502, error: 'Upstream request failed' }, 502);
      }
    }

    if (url.pathname === '/stream') {
      if (!authOk(request, url, env)) return json({ status: 403, error: 'Forbidden' }, 403);

      const raw = url.searchParams.get('url');
      if (!raw) return json({ status: 400, error: 'Missing `url` query param' }, 400);

      let target;
      try {
        target = new URL(raw);
      } catch (e) {
        return json({ status: 400, error: 'Invalid target URL' }, 400);
      }

      if (!/^https?:$/i.test(target.protocol)) return json({ status: 400, error: 'Only http/https URLs are allowed' }, 400);
      if (!hostAllowed(target.hostname, videoHosts)) return json({ status: 403, error: 'Video host is not allowed' }, 403);

      try {
        return await forwardRequest(request, target, { timeoutMs, wrapJson: false, streamMode: true });
      } catch (e) {
        if (e.name === 'AbortError') return json({ status: 504, error: 'Upstream timeout' }, 504);
        return json({ status: 502, error: 'Stream proxy failed' }, 502);
      }
    }

    return json({ status: 404, error: 'Not Found' }, 404);
  }
};
