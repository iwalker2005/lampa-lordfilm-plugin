(function(mod){
'use strict';

var shared = mod.shared;
var network = mod.network;

var HOST = 'https://api.anilibria.tv/v3/';

function cleanText(value){
  return shared.clean(value || '');
}

function extractNumber(value){
  var match = String(value || '').match(/(\d{1,4})/);
  return match ? parseInt(match[1], 10) : 0;
}

function makeMapFromEpisode(hls){
  var map = {};
  if (hls && hls.host && hls.fhd) map['1080p'] = network.proxifyStream('https://' + hls.host + hls.fhd);
  if (hls && hls.host && hls.hd) map['720p'] = network.proxifyStream('https://' + hls.host + hls.hd);
  if (hls && hls.host && hls.sd) map['480p'] = network.proxifyStream('https://' + hls.host + hls.sd);
  return map;
}

function makeItem(meta, release, episode, key){
  var title = cleanText((release.names && (release.names.ru || release.names.en || release.names.alternative)) || release.ru_title || release.en_title || meta.title || 'Original');
  var epNum = episode && (episode.episode != null ? episode.episode : episode.ordinal != null ? episode.ordinal : extractNumber(key));
  var map = makeMapFromEpisode(episode && episode.hls || {});

  return {
    id: ['anilibria', release.id || release.slug_url || meta.title || 'unknown', epNum || 0, title].join('|'),
    provider: 'anilibria',
    providerLabel: 'AniLibria',
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

function releaseFilterUrl(title){
  var url = HOST + 'title/search';
  url = Lampa.Utils.addUrlComponent(url, 'filter=names,season,type,player');
  url = Lampa.Utils.addUrlComponent(url, 'limit=20');
  url = Lampa.Utils.addUrlComponent(url, 'search=' + encodeURIComponent(title));
  return url;
}

async function search(meta){
  var title = meta && (meta.title || meta.original_title || meta.original_name || '');
  if (!title) return [];

  var json = await network.requestPreferProxy(releaseFilterUrl(title), {
    type: 'json',
    timeout: 15000,
    retries: 0,
    proxyReferer: HOST
  }).catch(function(){ return null; });

  var list = json && Array.isArray(json.list) ? json.list : [];
  if (!list.length) return [];

  for (var i = 0; i < list.length; i++) {
    var release = list[i];
    if (!(release && release.player && release.player.list && Object.keys(release.player.list).length)) continue;

    var items = [];
    Object.keys(release.player.list).forEach(function(key){
      var episode = release.player.list[key];
      if (!episode) return;
      items.push(makeItem(meta, release, episode, key));
    });

    if (items.length) return shared.dedupeItems(items).slice(0, 200);
  }

  return [];
}

mod.providers = mod.providers || {};
mod.providers.anilibria = {
  key: 'anilibria',
  title: 'AniLibria',
  search: search
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});
