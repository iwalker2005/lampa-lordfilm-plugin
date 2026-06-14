(function(mod){
'use strict';

var shared = mod.shared;
var network = mod.network;
var balance = mod.core.balance;

var HOST = 'https://lomont.site/gt/';
var USER_AGENT = (typeof navigator !== 'undefined' && navigator.userAgent) || 'Mozilla/5.0';

function cleanText(value){
  return shared.clean(value || '');
}

function extractNumber(value){
  var match = String(value || '').match(/(\d{1,4})/);
  return match ? parseInt(match[1], 10) : 0;
}

function makeMapFromFile(file){
  return balance.sourceMapFromText(file || '', null);
}

function makeItem(meta, translation, season, episode){
  var voice = cleanText(translation.voice_name || translation.title || translation.comment || 'Original');
  return {
    id: ['fanserials', meta.kinopoisk_id || meta.imdb_id || meta.title || 'unknown', season || 0, episode || 0, voice, translation.voice_id || translation.id || ''].join('|'),
    provider: 'fanserials',
    providerLabel: 'FanSerials',
    voice: voice,
    season: season || 0,
    episode: episode || 0,
    maxQuality: translation.max_quality ? String(translation.max_quality) + 'p' : '',
    title: season && episode ? ('S' + season + 'E' + episode + ' | ' + voice) : voice,
    media: translation,
    loadSourceMap: async function(){
      if (translation.qualitys && typeof translation.qualitys === 'object') {
        var map = {};
        Object.keys(translation.qualitys).forEach(function(label){
          if (translation.qualitys[label]) map[label] = network.proxifyStream(translation.qualitys[label]);
        });
        if (Object.keys(map).length) return map;
      }
      if (translation.file) return makeMapFromFile(translation.file);
      if (translation.url) return balance.sourceMapFromText(translation.url, null);
      return {};
    }
  };
}

function walk(node, path, out, meta){
  if (!node) return;

  if (Array.isArray(node)) {
    if (node.length && node[0] && typeof node[0] === 'object' && (node[0].voice_id != null || node[0].voice_name != null)) {
      var season = extractNumber(path[0]);
      var episode = extractNumber(path[1]);
      node.forEach(function(translation){
        if (translation && (translation.voice_id != null || translation.voice_name != null)) {
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

  if (node.voice_id != null || node.voice_name != null) {
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

  var url = HOST + encodeURIComponent(id);
  url = Lampa.Utils.addUrlComponent(url, 'season=1');
  url = Lampa.Utils.addUrlComponent(url, 'episode=1');
  url = Lampa.Utils.addUrlComponent(url, 'alloff=true');

  var html = await network.requestPreferProxy(url, {
    type: 'text',
    timeout: 10000,
    retries: 0,
    proxyReferer: HOST,
    headers: {
      'User-Agent': USER_AGENT
    }
  }).catch(function(){ return ''; });

  if (!html) return [];

  var match = html.match(/<div id="inputData"[^>]*>(\{.*?\})<\/div>/);
  if (!match || !match[1]) return [];

  var json = balance.parseJsonSafe(match[1]);
  if (!json) return [];

  var items = [];
  walk(json, [], items, meta);
  return shared.dedupeItems(items).slice(0, 200);
}

mod.providers = mod.providers || {};
mod.providers.fanserials = {
  key: 'fanserials',
  title: 'FanSerials',
  search: search
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});
