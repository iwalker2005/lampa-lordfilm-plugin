(function(mod){
'use strict';

var shared = mod.shared;
var network = mod.network;

function parseItem(raw, idx){
  var sourceMap = {};
  if (raw && raw.qualities && typeof raw.qualities === 'object') {
    Object.keys(raw.qualities).forEach(function(label){
      var url = raw.qualities[label];
      if (url) sourceMap[label] = network.proxifyStream(url);
    });
  }
  if (!Object.keys(sourceMap).length && raw && raw.url) {
    sourceMap = network.sourceMapFromUrl(raw.url);
  }
  return {
    id: 'kinobase|' + (raw.id || idx),
    provider: 'kinobase',
    providerLabel: 'Kinobase',
    voice: shared.clean(raw.voice || raw.translation || '\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b'),
    season: parseInt(raw.season, 10) || 0,
    episode: parseInt(raw.episode, 10) || 0,
    maxQuality: String(raw.max_quality || raw.quality || Object.keys(sourceMap)[0] || '1080p'),
    sourceMap: sourceMap
  };
}

async function search(meta){
  var cfg = shared.getConfig();
  if (!cfg.kinobaseWorkerUrl) return [];

  var endpoint = cfg.kinobaseWorkerUrl + '/kinobase';
  var query = [];
  if (meta && meta.kinopoisk_id) query.push('kinopoisk_id=' + encodeURIComponent(meta.kinopoisk_id));
  if (meta && meta.imdb_id) query.push('imdb_id=' + encodeURIComponent(meta.imdb_id));
  if (meta && meta.title) query.push('title=' + encodeURIComponent(meta.title));
  if (meta && meta.year) query.push('year=' + encodeURIComponent(meta.year));
  if (!query.length) return [];

  var json = await network.requestPreferProxy(endpoint + '?' + query.join('&'), {
    type: 'json',
    timeout: 5000,
    retries: 0
  }).catch(function(){ return null; });

  var items = json && Array.isArray(json.items) ? json.items : [];
  return items.map(parseItem).filter(function(item){
    return item && item.sourceMap && Object.keys(item.sourceMap).length;
  });
}

mod.providers = mod.providers || {};
mod.providers.kinobase = {
  key: 'kinobase',
  title: 'Kinobase',
  search: search
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});