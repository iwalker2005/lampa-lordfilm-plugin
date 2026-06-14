(function(mod){
'use strict';

var shared = mod.shared;
var network = mod.network;
var balance = mod.core.balance;

var HOST = 'https://kinoserials.net';
var EMBED = 'https://api.videoseed.tv/apiv2.php';
var USER_AGENT = (typeof navigator !== 'undefined' && navigator.userAgent) || 'Mozilla/5.0';
var Suffix = 'sfVxqv2oJkWh4y9a3k4AqT8mQ8o6v9p0';
var HEX = '0123456789abcdef';

function cleanText(value){
  return shared.clean(value || '');
}

function extractNumber(value){
  var match = String(value || '').match(/(\d{1,4})/);
  return match ? parseInt(match[1], 10) : 0;
}

function mapFromSources(sources){
  var map = {};
  if (!sources) return map;

  if (sources.mpeg2kUrl) map['4K'] = network.proxifyStream(sources.mpeg2kUrl);
  if (sources.mpeg4kUrl) map['2K'] = network.proxifyStream(sources.mpeg4kUrl);
  if (sources.mpegQhdUrl) map['1440p'] = network.proxifyStream(sources.mpegQhdUrl);
  if (sources.mpegFullHdUrl) map['1080p'] = network.proxifyStream(sources.mpegFullHdUrl);
  if (sources.mpegHighUrl) map['720p'] = network.proxifyStream(sources.mpegHighUrl);
  if (sources.mpegMediumUrl) map['480p'] = network.proxifyStream(sources.mpegMediumUrl);
  if (sources.mpegLowUrl) map['360p'] = network.proxifyStream(sources.mpegLowUrl);
  if (sources.mpegLowestUrl) map['240p'] = network.proxifyStream(sources.mpegLowestUrl);
  if (sources.mpegTinyUrl) map['144p'] = network.proxifyStream(sources.mpegTinyUrl);
  if (!Object.keys(map).length && sources.hlsUrl) map['Auto HLS'] = network.proxifyStream(sources.hlsUrl);
  return map;
}

function randomHex(len){
  var out = '';
  for (var i = 0; i < len; i++) {
    out += HEX.charAt(Math.floor(Math.random() * HEX.length));
  }
  return out;
}

function makeItem(meta, translation, season, episode){
  var voice = cleanText(translation.voice_name || translation.title || translation.comment || 'Original');
  return {
    id: ['videoseed', meta.kinopoisk_id || meta.imdb_id || meta.title || 'unknown', season || 0, episode || 0, voice, translation.voice_id || translation.id || ''].join('|'),
    provider: 'videoseed',
    providerLabel: 'VideoSeed',
    voice: voice,
    season: season || 0,
    episode: episode || 0,
    maxQuality: translation.max_quality ? String(translation.max_quality) + 'p' : '',
    title: season && episode ? ('S' + season + 'E' + episode + ' | ' + voice) : voice,
    media: translation,
    loadSourceMap: async function(){
      if (translation.sources) return mapFromSources(translation.sources);
      if (translation.file) return balance.sourceMapFromText(translation.file, null);
      if (translation.url) return balance.sourceMapFromText(translation.url, null);
      return {};
    }
  };
}

function walk(node, path, out, meta){
  if (!node) return;

  if (Array.isArray(node)) {
    if (node.length && node[0] && typeof node[0] === 'object' && (node[0].voice_id != null || node[0].voice_name != null || node[0].file)) {
      var season = extractNumber(path[0]);
      var episode = extractNumber(path[1]);
      node.forEach(function(translation){
        if (translation && (translation.voice_id != null || translation.voice_name != null || translation.file)) {
          out.push(makeItem(meta, translation, season, episode));
        }
      });
      return;
    }

    node.forEach(function(child, index){
      walk(child, path.concat(String(index)), out, meta);
    });
    return;
  }

  if (typeof node !== 'object') return;

  if (node.voice_id != null || node.voice_name != null || node.file) {
    out.push(makeItem(meta, node, extractNumber(path[0]), extractNumber(path[1])));
    return;
  }

  Object.keys(node).forEach(function(key){
    walk(node[key], path.concat(key), out, meta);
  });
}

async function search(meta){
  var id = meta && meta.kinopoisk_id ? String(meta.kinopoisk_id) : '';
  if (!id) return [];

  var api = EMBED;
  api = Lampa.Utils.addUrlComponent(api, 'item=' + (meta.type === 'tv' ? 'serial' : 'movie'));
  api = Lampa.Utils.addUrlComponent(api, 'kp=' + encodeURIComponent(id));
  api = Lampa.Utils.addUrlComponent(api, Suffix);

  var json = await network.requestPreferProxy(api, {
    type: 'json',
    timeout: 10000,
    retries: 0,
    headers: {
      'User-Agent': USER_AGENT
    },
    proxyReferer: HOST + '/'
  }).catch(function(){ return null; });

  if (!(json && json.data && json.data[0] && json.data[0].iframe)) return [];

  var iframeUrl = String(json.data[0].iframe || '');
  if (!iframeUrl) return [];

  var parsed = null;
  try {
    parsed = new URL(iframeUrl, HOST);
  } catch (e) {}

  var tokenizedUrl = HOST + (parsed ? parsed.pathname.replace(/^\//, '') : String(iframeUrl || '').replace(/^https?:\/\/[^/]+\//, ''));
  tokenizedUrl = Lampa.Utils.addUrlComponent(tokenizedUrl, 'token=' + randomHex(32));

  var html = await network.requestPreferProxy(tokenizedUrl, {
    type: 'text',
    timeout: 10000,
    retries: 0,
    proxyReferer: iframeUrl,
    headers: {
      'User-Agent': USER_AGENT
    }
  }).catch(function(){ return ''; });

  if (!html) return [];

  var match = html.match(/<div id="inputData"[^>]*>(\{.*?\})<\/div>/);
  if (!match || !match[1]) return [];

  var jsonData = balance.parseJsonSafe(match[1]);
  if (!jsonData) return [];

  var items = [];
  walk(jsonData, [], items, meta);
  return shared.dedupeItems(items).slice(0, 200);
}

mod.providers = mod.providers || {};
mod.providers.videoseed = {
  key: 'videoseed',
  title: 'VideoSeed',
  search: search
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});
