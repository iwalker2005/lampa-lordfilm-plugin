(function(mod){
'use strict';

var shared = mod.shared;
var network = mod.network;

var HOST = 'https://api.anilibria.app/api/v1/';

function cleanText(value){
  return shared.clean(value || '');
}

function extractNumber(value){
  var match = String(value || '').match(/(\d{1,4})/);
  return match ? parseInt(match[1], 10) : 0;
}

function makeMapFromEpisode(episode){
  var map = {};
  if (episode && episode.hls_1080) map['1080p'] = network.proxifyStream(episode.hls_1080);
  if (episode && episode.hls_720) map['720p'] = network.proxifyStream(episode.hls_720);
  if (episode && episode.hls_480) map['480p'] = network.proxifyStream(episode.hls_480);
  return map;
}

function makeItem(meta, release, episode, key){
  var title = cleanText((release.name && (release.name.main || release.name.english || release.name.alternative)) || release.ru_title || release.en_title || meta.title || 'Original');
  var epNum = episode && (episode.episode != null ? episode.episode : episode.ordinal != null ? episode.ordinal : extractNumber(key));
  var map = makeMapFromEpisode(episode || {});

  return {
    id: ['anilibria2', release.id || release.slug_url || meta.title || 'unknown', epNum || 0, title].join('|'),
    provider: 'anilibria2',
    providerLabel: 'AniLibria2',
    voice: title,
    season: 1,
    episode: epNum || 0,
    maxQuality: Object.keys(map)[0] || '1080p',
    title: epNum ? ('E' + epNum + ' | ' + title) : title,
    media: episode || release,
    sourceMap: map,
    loadSourceMap: async function(){
      return map;
    }
  };
}

function releaseSearchUrl(title){
  var url = HOST + 'app/search/releases';
  url = Lampa.Utils.addUrlComponent(url, 'query=' + encodeURIComponent(title));
  return url;
}

function releaseUrl(id){
  return HOST + 'anime/releases/' + encodeURIComponent(id);
}

async function search(meta){
  var title = meta && (meta.title || meta.original_title || meta.original_name || '');
  if (!title) return [];

  var json = await network.requestPreferProxy(releaseSearchUrl(title), {
    type: 'json',
    timeout: 15000,
    retries: 0,
    proxyReferer: HOST
  }).catch(function(){ return null; });

  var items = json && Array.isArray(json.data) ? json.data : [];
  if (!items.length) return [];

  for (var i = 0; i < items.length; i++) {
    var release = items[i];
    var full = await network.requestPreferProxy(releaseUrl(release.id), {
      type: 'json',
      timeout: 15000,
      retries: 0,
      proxyReferer: HOST
    }).catch(function(){ return null; });

    if (!(full && full.episodes && full.episodes.length)) continue;

    var out = [];
    full.episodes.forEach(function(episode, index){
      out.push(makeItem(meta, full, episode, index + 1));
    });

    if (out.length) return shared.dedupeItems(out).slice(0, 200);
  }

  return [];
}

mod.providers = mod.providers || {};
mod.providers.anilibria2 = {
  key: 'anilibria2',
  title: 'AniLibria2',
  search: search
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});
