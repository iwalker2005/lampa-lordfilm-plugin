(function(mod){
'use strict';

var shared = mod.shared;

function HttpError(status, message, payload){
  this.name = 'HttpError';
  this.status = status || 500;
  this.message = message || 'HTTP error';
  this.payload = payload || null;
}
HttpError.prototype = Object.create(Error.prototype);

function timeoutError(err){
  return !!(err && (err.name === 'AbortError' || /timeout/i.test(String(err.message || ''))));
}

function transientError(err){
  var m = String((err && err.message) || '').toLowerCase();
  return m.indexOf('failed to fetch') >= 0 || m.indexOf('networkerror') >= 0 || m.indexOf('fetch failed') >= 0 || m.indexOf('connection') >= 0 || m.indexOf('aborted') >= 0;
}

function withTimeout(promise, ms, label){
  return new Promise(function(resolve, reject){
    var done = false;
    var timer = setTimeout(function(){
      if (done) return;
      done = true;
      var err = new Error((label || 'Task') + ' timed out after ' + ms + 'ms');
      err.name = 'TimeoutError';
      reject(err);
    }, ms);
    Promise.resolve(promise).then(function(value){
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(value);
    }).catch(function(err){
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

function buildProxyUrl(targetUrl, cfg, opt){
  var final = cfg.proxyUrl + '/proxy?url=' + encodeURIComponent(targetUrl);
  if (opt && opt.proxyReferer) final += '&rf=' + encodeURIComponent(String(opt.proxyReferer));
  if (opt && opt.proxyOrigin) final += '&of=' + encodeURIComponent(String(opt.proxyOrigin));
  if (opt && opt.cookie) final += '&cookie=' + encodeURIComponent(String(opt.cookie));
  return final;
}

async function fetchWithTimeout(url, opt){
  var cfg = shared.getConfig();
  var timeout = Math.max(1000, parseInt((opt && opt.timeout) || cfg.timeoutMs, 10) || cfg.timeoutMs);
  var controller = new AbortController();
  var timer = setTimeout(function(){
    try { controller.abort(); } catch (e) {}
  }, timeout);
  try {
    return await fetch(url, {
      method: (opt && opt.method) || 'GET',
      headers: (opt && opt.headers) || {},
      body: opt && opt.body,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeHeaders(opt){
  var headers = {};
  if (opt && opt.headers) {
    Object.keys(opt.headers).forEach(function(key){
      headers[key] = opt.headers[key];
    });
  }
  return headers;
}

async function request(targetUrl, opt){
  opt = opt || {};
  var cfg = shared.getConfig();
  var useProxy = !opt.direct && !!cfg.proxyUrl;
  var url = useProxy ? buildProxyUrl(targetUrl, cfg, opt) : targetUrl;
  var headers = normalizeHeaders(opt);
  if (cfg.proxyToken && useProxy) headers['X-Proxy-Token'] = cfg.proxyToken;
  if (opt.cookie && useProxy) headers['X-Proxy-Cookie'] = String(opt.cookie);
  var retries = (typeof opt.retries === 'number') ? Math.max(0, parseInt(opt.retries, 10) || 0) : 0;

  for (var i = 0; i <= retries; i++) {
    try {
      var response = await fetchWithTimeout(url, {
        method: opt.method || 'GET',
        headers: headers,
        body: opt.body,
        timeout: opt.timeout || cfg.timeoutMs
      });

      if (!response.ok) {
        var errText = '';
        try { errText = await response.text(); } catch (e) {}
        throw new HttpError(response.status, errText || response.statusText, { body: errText });
      }

      if (opt.type === 'json') {
        var ctype = String(response.headers.get('content-type') || '').toLowerCase();
        if (ctype.indexOf('application/json') >= 0) {
          var json = await response.json();
          if (json && typeof json.status === 'number' && typeof json.body !== 'undefined') {
            if (json.status >= 400) throw new HttpError(json.status, json.error || 'Proxy error', json);
            if (typeof json.body === 'string') {
              try { return JSON.parse(json.body); }
              catch (e) { return json.body; }
            }
            return json.body;
          }
          return json;
        }
        var text = await response.text();
        try { return JSON.parse(text); }
        catch (e2) { throw new HttpError(500, 'Invalid JSON', { body: text }); }
      }

      var payload = await response.text();
      if (payload && payload.charAt(0) === '{') {
        try {
          var wrapped = JSON.parse(payload);
          if (wrapped && typeof wrapped.status === 'number' && typeof wrapped.body !== 'undefined') {
            if (wrapped.status >= 400) throw new HttpError(wrapped.status, wrapped.error || 'Proxy error', wrapped);
            return String(wrapped.body || '');
          }
        } catch (e3) {
          if (e3 && e3.name === 'HttpError') throw e3;
        }
      }
      return payload;
    } catch (err) {
      var retryable = (timeoutError(err) || transientError(err));
      if (retryable && i < retries) continue;
      throw err;
    }
  }

  throw new HttpError(500, 'Request failed');
}

async function requestPreferProxy(targetUrl, opt){
  opt = opt || {};
  try {
    return await request(targetUrl, opt);
  } catch (err) {
    if (opt.direct) throw err;
    var retry = {};
    Object.keys(opt).forEach(function(k){ retry[k] = opt[k]; });
    retry.direct = true;
    return await request(targetUrl, retry);
  }
}

function wrapProvider(provider, fn, timeoutMs, onUpdate){
  return withTimeout(Promise.resolve().then(fn), timeoutMs, provider.name || provider.key || 'provider')
    .then(function(items){
      var payload = {
        status: 'fulfilled',
        provider: provider,
        items: Array.isArray(items) ? items : []
      };
      if (onUpdate) onUpdate(payload);
      return payload;
    })
    .catch(function(error){
      var payload = {
        status: 'rejected',
        provider: provider,
        reason: error
      };
      if (onUpdate) onUpdate(payload);
      return payload;
    });
}

function pickQuality(sourceMap, preferred){
  var map = sourceMap || {};
  if (!map || !Object.keys(map).length) return { label: '', url: '' };
  if (preferred && map[preferred]) return { label: preferred, url: map[preferred] };
  if (map['Auto HLS']) return { label: 'Auto HLS', url: map['Auto HLS'] };
  var order = ['2160p', '1440p', '1080p QHD', '1080p', '720p', '480p', '360p', '240p', '144p', 'Auto HLS', 'Auto DASH'];
  var idx = order.indexOf(String(shared.getConfig().quality || '1080') + 'p');
  var i;
  if (idx >= 0) {
    for (i = idx; i < order.length; i++) {
      if (map[order[i]]) return { label: order[i], url: map[order[i]] };
    }
    for (i = idx - 1; i >= 0; i--) {
      if (map[order[i]]) return { label: order[i], url: map[order[i]] };
    }
  }
  var first = Object.keys(map)[0];
  return { label: first || '', url: first ? map[first] : '' };
}

function proxifyStream(url){
  var cfg = shared.getConfig();
  if (!url || !cfg.proxyUrl) return url;
  var out = cfg.proxyUrl + '/stream?url=' + encodeURIComponent(url);
  if (cfg.proxyToken) out += '&token=' + encodeURIComponent(cfg.proxyToken);
  return out;
}

function sourceMapFromUrl(url){
  var src = String(url || '').trim();
  var map = {};
  if (!src) return map;
  if (/\.m3u8(?:$|\?)/i.test(src)) map['Auto HLS'] = proxifyStream(src);
  else if (/\.mpd(?:$|\?)/i.test(src)) map['Auto DASH'] = proxifyStream(src);
  else if (/\.mp4(?:$|\?)/i.test(src)) map['MP4'] = proxifyStream(src);
  else map['Auto'] = proxifyStream(src);
  return map;
}

function errMessage(err){
  var status = err && err.status ? err.status : 0;
  if (status === 401 || status === 403) return '\u041e\u0448\u0438\u0431\u043a\u0430 \u0434\u043e\u0441\u0442\u0443\u043f\u0430 \u043a \u043f\u0440\u043e\u043a\u0441\u0438';
  if (status === 404) return '\u041a\u043e\u043d\u0442\u0435\u043d\u0442 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d';
  if (status === 429) return '\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u0437\u0430\u043f\u0440\u043e\u0441\u043e\u0432';
  if (timeoutError(err) || (err && err.name === 'TimeoutError')) return '\u0422\u0430\u0439\u043c\u0430\u0443\u0442 \u0437\u0430\u043f\u0440\u043e\u0441\u0430';
  return '\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438 \u0434\u0430\u043d\u043d\u044b\u0445';
}

mod.network = {
  HttpError: HttpError,
  timeoutError: timeoutError,
  transientError: transientError,
  withTimeout: withTimeout,
  request: request,
  requestPreferProxy: requestPreferProxy,
  wrapProvider: wrapProvider,
  pickQuality: pickQuality,
  proxifyStream: proxifyStream,
  sourceMapFromUrl: sourceMapFromUrl,
  errMessage: errMessage
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});