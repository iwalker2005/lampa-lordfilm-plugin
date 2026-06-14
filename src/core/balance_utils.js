(function(mod){
'use strict';

var network = mod.network;

function parseJsonSafe(text){
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function normalizeUrl(value, baseUrl){
  var raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^\/\//.test(raw)) return 'https:' + raw;
  try {
    return new URL(raw, baseUrl || 'https://example.com').toString();
  } catch (e) {
    return raw;
  }
}

function collectUrls(input, out, baseUrl){
  if (!input) return;

  if (typeof input === 'string') {
    var raw = String(input || '').trim();
    if (!raw) return;

    var parsed = parseJsonSafe(raw);
    if (parsed) {
      collectUrls(parsed, out, baseUrl);
      return;
    }

    var pairReg = /\[(\d{3,4})p?\]\s*(https?:\/\/[^"'`<>\s,]+)/ig;
    var pair;
    while ((pair = pairReg.exec(raw))) {
      out.push({
        label: pair[1] + 'p',
        url: normalizeUrl(pair[2], baseUrl)
      });
    }

    var simpleReg = /(?:https?:)?\/\/[^"'`<>\s,]+(?:\.m3u8|\.mpd|\.mp4|\.m4s)?[^"'`<>\s,]*/ig;
    var found;
    while ((found = simpleReg.exec(raw))) {
      out.push(normalizeUrl(found[0], baseUrl));
    }
    return;
  }

  if (Array.isArray(input)) {
    input.forEach(function(node){
      collectUrls(node, out, baseUrl);
    });
    return;
  }

  if (typeof input === 'object') {
    var keys = ['label', 'quality', 'name', 'title', 'url', 'file', 'src', 'link', 'playlist', 'hls', 'dash', 'dasha', 'hlsUrl', 'dashUrl', 'mp4', 'm3u8', 'mpd'];

    keys.forEach(function(key){
      if (typeof input[key] !== 'undefined' && input[key] !== null) {
        if (key === 'label' || key === 'quality' || key === 'name' || key === 'title') {
          return;
        }
        collectUrls(input[key], out, baseUrl);
      }
    });

    Object.keys(input).forEach(function(key){
      if (keys.indexOf(key) !== -1) return;
      collectUrls(input[key], out, baseUrl);
    });
  }
}

function qualityFromText(label, url){
  var raw = String(label || '') + ' ' + String(url || '');
  var match = raw.match(/(2160|1440|1080|720|480|360|240|144)\s*p?/i);
  return match ? (match[1] + 'p') : '';
}

function buildSourceMapFromUrls(urls, baseUrl){
  var map = {};
  var seen = {};

  (urls || []).forEach(function(item){
    var url = '';
    var label = '';

    if (typeof item === 'string') {
      url = normalizeUrl(item, baseUrl);
    } else if (item && typeof item === 'object') {
      url = normalizeUrl(item.url || item.file || item.src || item.link || '', baseUrl);
      label = String(item.label || item.quality || item.name || item.title || '').trim();
    }

    if (!url || seen[url]) return;
    seen[url] = 1;

    if (!label) {
      label = qualityFromText('', url);
      if (!label) {
        if (/\.m3u8(?:$|\?)/i.test(url)) label = 'Auto HLS';
        else if (/\.mpd(?:$|\?)/i.test(url)) label = 'Auto DASH';
        else if (/\.mp4(?:$|\?)/i.test(url)) label = 'MP4';
        else label = 'Auto';
      }
    }

    if (!map[label]) map[label] = network.proxifyStream(url);
  });

  return map;
}

function sourceMapFromText(text, baseUrl){
  var urls = [];
  collectUrls(text, urls, baseUrl);
  return buildSourceMapFromUrls(urls, baseUrl);
}

function parsePlayerObject(text){
  var raw = String(text || '').replace(/\r?\n/g, ' ');
  var found = raw.match(/Playerjs\(({.*?})\);/i) ||
    raw.match(/var\s+playerOptions\s*=\s*({.*?});/i) ||
    raw.match(/makePlayer\s*\(\s*(\{[\s\S]*?\})\s*\);/i) ||
    raw.match(/var\s+plr_config\s*=\s*({.*?});/i) ||
    raw.match(/var\s+plr_config\s*=\s*"([^"]*)";/i);

  if (!found) return null;

  try {
    if (found[1] && found[1].charAt(0) === '{') {
      return (0, eval)('"use strict"; (' + found[1] + ')');
    }

    if (found[1] && /^https?:/i.test(found[1])) {
      return { file: found[1] };
    }

    var decoded = found[1];
    if (decoded && decoded.charAt(0) === '#') return { file: decoded };
    return (0, eval)('"use strict"; (' + decoded + ')');
  } catch (e) {
    return null;
  }
}

function decodeTrashData(data, trashList, separator){
  var raw = String(data || '');
  if (!raw || raw.charAt(0) !== '#') return raw;

  var sep = typeof separator === 'string' ? separator : '//';
  var enc = function(str){
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1){
      return String.fromCharCode('0x' + p1);
    }));
  };
  var dec = function(str){
    return decodeURIComponent(atob(str).split('').map(function(c){
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  };

  var x = raw.substring(2);
  (trashList || []).forEach(function(trash){
    x = x.replace(sep + enc(trash), '');
  });

  try {
    return dec(x);
  } catch (e) {
    return '';
  }
}

mod.core = mod.core || {};
mod.core.balance = {
  parseJsonSafe: parseJsonSafe,
  normalizeUrl: normalizeUrl,
  collectUrls: collectUrls,
  qualityFromText: qualityFromText,
  buildSourceMapFromUrls: buildSourceMapFromUrls,
  sourceMapFromText: sourceMapFromText,
  parsePlayerObject: parsePlayerObject,
  decodeTrashData: decodeTrashData
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});
