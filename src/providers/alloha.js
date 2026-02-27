(function(mod){
'use strict';

var shared = mod.shared;
var network = mod.network;

function parseJsonSafe(text){
  try { return JSON.parse(text); }
  catch (e) { return null; }
}

function collectUrls(input, out){
  if (!input) return;
  if (typeof input === 'string') {
    var parts = input.split(' or ');
    parts.forEach(function(part){
      var url = String(part || '').trim();
      if (!url) return;
      if (/^https?:\/\//i.test(url) || /^\/\//.test(url)) out.push(url);
    });
    return;
  }
  if (Array.isArray(input)) {
    input.forEach(function(node){ collectUrls(node, out); });
    return;
  }
  if (typeof input === 'object') {
    Object.keys(input).forEach(function(key){ collectUrls(input[key], out); });
  }
}

function qualityFromUrl(url){
  var m = String(url || '').match(/(2160|1440|1080|720|480|360|240|144)p?/i);
  return m ? (m[1] + 'p') : '';
}

function buildSourceMap(urls){
  var map = {};
  var ordered = [];
  var seen = {};
  urls.forEach(function(url){
    var full = String(url || '').trim();
    if (!full) return;
    if (/^\/\//.test(full)) full = 'https:' + full;
    if (seen[full]) return;
    seen[full] = 1;
    ordered.push(full);
  });
  ordered.forEach(function(url){
    var label = qualityFromUrl(url);
    if (!label) {
      if (/\.m3u8(?:$|\?)/i.test(url)) label = 'Auto HLS';
      else if (/\.mp4(?:$|\?)/i.test(url)) label = 'MP4';
      else label = 'Auto';
    }
    if (!map[label]) map[label] = network.proxifyStream(url);
  });
  return map;
}

function parseIframeSources(html){
  var text = String(html || '');
  var urls = [];

  var fileListMatch = text.match(/fileList\s*=\s*JSON\.parse\('\s*(\{[\s\S]*?\})\s*'\)/i);
  if (fileListMatch) {
    var raw = fileListMatch[1].replace(/\\'/g, "'").replace(/\\\//g, '/');
    var parsed = parseJsonSafe(raw);
    if (parsed) collectUrls(parsed, urls);
  }

  var regex = /https?:\/\/[^"'\\\s]+(?:\.m3u8|\.mp4)[^"'\\\s]*/ig;
  var found;
  while ((found = regex.exec(text))) {
    urls.push(found[0]);
  }

  return buildSourceMap(urls);
}

async function fetchApi(token, id, isKp){
  var query = isKp ? ('kp=' + encodeURIComponent(id)) : ('imdb=' + encodeURIComponent(id));
  return await network.requestPreferProxy('https://api.apbugall.org/?token=' + encodeURIComponent(token) + '&' + query, {
    type: 'json',
    timeout: 5000,
    retries: 0
  });
}

async function search(meta){
  var cfg = shared.getConfig();
  if (!cfg.allohaToken) return [];

  var ids = [];
  if (meta && meta.kinopoisk_id) ids.push({ id: String(meta.kinopoisk_id), kp: true });
  if (meta && meta.imdb_id) ids.push({ id: String(meta.imdb_id), kp: false });
  if (!ids.length) return [];

  var apiData = null;
  var i;
  for (i = 0; i < ids.length; i++) {
    apiData = await fetchApi(cfg.allohaToken, ids[i].id, ids[i].kp).catch(function(){ return null; });
    if (apiData && apiData.data && apiData.data.iframe) break;
  }

  if (!(apiData && apiData.data && apiData.data.iframe)) return [];

  var iframeUrl = String(apiData.data.iframe || '');
  if (!iframeUrl) return [];

  var iframeHtml = await network.requestPreferProxy(iframeUrl, {
    type: 'text',
    timeout: 5000,
    retries: 0
  }).catch(function(){ return ''; });
  if (!iframeHtml) return [];

  var sourceMap = parseIframeSources(iframeHtml);
  if (!Object.keys(sourceMap).length) return [];

  return [{
    id: 'alloha|' + iframeUrl,
    provider: 'alloha',
    providerLabel: 'Alloha',
    voice: shared.clean((apiData.data.translation || '') || '\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b'),
    season: 0,
    episode: 0,
    maxQuality: Object.keys(sourceMap)[0] || '1080p',
    sourceMap: sourceMap,
    embedUrl: iframeUrl
  }];
}

mod.providers = mod.providers || {};
mod.providers.alloha = {
  key: 'alloha',
  title: 'Alloha',
  search: search
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});