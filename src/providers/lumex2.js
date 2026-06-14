(function(mod){
'use strict';

var shared = mod.shared;
var network = mod.network;
var balance = mod.core.balance;

var HOST = 'https://api.lampa.stream/lumex/';

function cleanText(value){
  return shared.clean(value || '');
}

function extractNumber(value){
  var match = String(value || '').match(/(\d{1,4})/);
  return match ? parseInt(match[1], 10) : 0;
}

function getAccountEmail(){
  try {
    var raw = shared.sget('account', '{}') || '{}';
    var account = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return String(account && account.email || 'none').trim() || 'none';
  } catch (e) {
    return 'none';
  }
}

function base64Url(value){
  try {
    return btoa(String(value || ''));
  } catch (e) {
    return '';
  }
}

async function fetchMyIp(){
  var json = await network.requestPreferProxy('https://api.ipify.org/?format=json', {
    type: 'json',
    timeout: 5000,
    retries: 0
  }).catch(function(){ return null; });
  return json && json.ip ? String(json.ip) : '';
}

function qualityMapFromObject(obj){
  var map = {};
  Object.keys(obj || {}).forEach(function(label){
    var url = obj[label];
    if (url) map[label] = network.proxifyStream(url);
  });
  return map;
}

function makeItem(meta, node, state, ip, apiSuffix){
  var voice = cleanText(node.translation_name || node.voice_name || state.voice || node.title || node.comment || 'Original');
  var season = state.season || extractNumber(node.season_id || node.season || '');
  var episode = state.episode || extractNumber(node.episode_id || node.episode || '');
  var title = season && episode
    ? ('S' + season + 'E' + episode + ' | ' + voice)
    : (voice || meta.title || meta.original_title || 'Original');

  return {
    id: ['lumex2', meta.id || meta.kinopoisk_id || meta.imdb_id || meta.title || 'unknown', season || 0, episode || 0, voice].join('|'),
    provider: 'lumex2',
    providerLabel: 'Lumex2',
    voice: voice,
    season: season || 0,
    episode: episode || 0,
    maxQuality: node.max_quality ? String(node.max_quality) + 'p' : '',
    title: title,
    media: node,
    loadSourceMap: async function(){
      if (node.qualitys && typeof node.qualitys === 'object') {
        var fromQualitys = qualityMapFromObject(node.qualitys);
        if (Object.keys(fromQualitys).length) return fromQualitys;
      }

      var sourceUrl = String(node.playlist || node.url || node.file || '').trim();

      if (!sourceUrl) return {};

      if (node.playlist) {
        var json = await network.requestPreferProxy(sourceUrl, {
          type: 'json',
          timeout: 10000,
          retries: 0
        }).catch(function(){ return null; });

        if (json && json.url) {
          if (json.qualitys && typeof json.qualitys === 'object') {
            var qmap = qualityMapFromObject(json.qualitys);
            if (Object.keys(qmap).length) return qmap;
          }
          return network.sourceMapFromUrl(json.url);
        }

        return balance.sourceMapFromText(json || '', sourceUrl);
      }

      if (node.url && ip) {
        var api = sourceUrl + '/' + encodeURIComponent(ip) + apiSuffix;
        var result = await network.requestPreferProxy(api, {
          type: 'json',
          timeout: 10000,
          retries: 0
        }).catch(function(){ return null; });

        if (result && result.url) {
          if (result.qualitys && typeof result.qualitys === 'object') {
            var resultMap = qualityMapFromObject(result.qualitys);
            if (Object.keys(resultMap).length) return resultMap;
          }
          return network.sourceMapFromUrl(result.url);
        }

        if (result && result.data && result.data.url) {
          return network.sourceMapFromUrl(result.data.url);
        }
      }

      return balance.sourceMapFromText(sourceUrl, sourceUrl);
    }
  };
}

function walkNode(node, state, out, meta, ip, apiSuffix){
  if (!node) return;

  if (Array.isArray(node)) {
    node.forEach(function(child){
      walkNode(child, state, out, meta, ip, apiSuffix);
    });
    return;
  }

  if (typeof node !== 'object') return;

  var next = {
    season: state.season || 0,
    episode: state.episode || 0,
    voice: state.voice || ''
  };

  var title = cleanText(node.title || node.comment || node.name || node.voice_name || node.translation_name || '');
  if (node.season_id != null) next.season = parseInt(node.season_id, 10) || next.season;
  if (node.episode_id != null) next.episode = parseInt(node.episode_id, 10) || next.episode;

  if (title) {
    if (!next.season && /сезон|season/i.test(title)) next.season = extractNumber(title);
    if (!next.episode && /серия|episode|эпизод/i.test(title)) next.episode = extractNumber(title);
    if (!/сезон|season|серия|episode|эпизод/i.test(title)) next.voice = title;
  }

  if (node.folder) {
    walkNode(node.folder, next, out, meta, ip, apiSuffix);
    return;
  }

  if (node.episodes) {
    walkNode(node.episodes, next, out, meta, ip, apiSuffix);
    return;
  }

  if (node.file || node.url || node.playlist || node.qualitys) {
    out.push(makeItem(meta, node, next, ip, apiSuffix));
    return;
  }

  Object.keys(node).forEach(function(key){
    if (['title', 'comment', 'name', 'voice_name', 'translation_name', 'season_id', 'episode_id', 'folder', 'episodes', 'file', 'url', 'playlist', 'qualitys', 'max_quality'].indexOf(key) !== -1) return;
    walkNode(node[key], next, out, meta, ip, apiSuffix);
  });
}

function flattenResponse(json, meta, ip, apiSuffix){
  var root = json && (json.folder || (json.player && json.player.media) || json.data || json);
  var items = [];
  walkNode(root, { season: 0, episode: 0, voice: '' }, items, meta, ip, apiSuffix);
  return shared.dedupeItems(items).slice(0, 200);
}

async function search(meta){
  if (!meta || !(meta.kinopoisk_id || meta.imdb_id || meta.title || meta.original_title)) return [];

  var title = meta.title || meta.original_title || meta.original_name || '';
  if (!title) return [];

  var movieId = meta.id || meta.kinopoisk_id || meta.imdb_id || title;
  var kpId = meta.kinopoisk_id || 'null';
  var imdbId = meta.imdb_id || 'null';
  var cubId = base64Url(getAccountEmail() || 'none');
  var apiSuffix = '/' + encodeURIComponent(base64Url(window.location && window.location.href || ''));
  var ip = await fetchMyIp();
  var url = HOST + 'sId/' + encodeURIComponent(movieId) + '/mod/' + encodeURIComponent(kpId) + '/' + encodeURIComponent(imdbId) + '/' + cubId + apiSuffix;

  if (ip) url = Lampa.Utils.addUrlComponent(url, 'ip=' + encodeURIComponent(ip));
  url = Lampa.Utils.addUrlComponent(url, 'search=' + encodeURIComponent(title));
  url = Lampa.Utils.addUrlComponent(url, 'original_title=' + encodeURIComponent(meta.original_title || meta.original_name || ''));
  url = Lampa.Utils.addUrlComponent(url, 'year=' + encodeURIComponent(meta.year || 0));

  var json = await network.requestPreferProxy(url, {
    type: 'json',
    timeout: 15000,
    retries: 0
  }).catch(function(){ return null; });

  return flattenResponse(json, meta, ip, apiSuffix);
}

mod.providers = mod.providers || {};
mod.providers.lumex2 = {
  key: 'lumex2',
  title: 'Lumex2',
  search: search
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});
