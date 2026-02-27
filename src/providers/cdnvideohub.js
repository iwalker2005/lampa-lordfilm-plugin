(function(mod){
'use strict';

var shared = mod.shared;
var network = mod.network;

var QMAP = [
  { key: 'mpeg4kUrl', label: '2160p' },
  { key: 'mpeg2kUrl', label: '1440p' },
  { key: 'mpegQhdUrl', label: '1080p QHD' },
  { key: 'mpegFullHdUrl', label: '1080p' },
  { key: 'mpegHighUrl', label: '720p' },
  { key: 'mpegMediumUrl', label: '480p' },
  { key: 'mpegLowUrl', label: '360p' },
  { key: 'mpegLowestUrl', label: '240p' },
  { key: 'mpegTinyUrl', label: '144p' }
];

function sourceMapFromSources(sources){
  var map = {};
  if (sources && sources.hlsUrl) map['Auto HLS'] = network.proxifyStream(sources.hlsUrl);
  if (sources && sources.dashUrl) map['Auto DASH'] = network.proxifyStream(sources.dashUrl);
  QMAP.forEach(function(def){
    if (sources && sources[def.key]) map[def.label] = network.proxifyStream(sources[def.key]);
  });
  return map;
}

async function loadVideo(vkId){
  return await network.requestPreferProxy('https://plapi.cdnvideohub.com/api/v1/player/sv/video/' + encodeURIComponent(vkId), { type: 'json', timeout: 5000, retries: 0 });
}

async function search(meta){
  if (!meta || !meta.kinopoisk_id || isNaN(parseInt(meta.kinopoisk_id, 10))) return [];

  var playlistUrl = 'https://plapi.cdnvideohub.com/api/v1/player/sv/playlist?pub=12&id=' + encodeURIComponent(parseInt(meta.kinopoisk_id, 10)) + '&aggr=kp';
  var playlist = await network.requestPreferProxy(playlistUrl, { type: 'json', timeout: 5000, retries: 0 });
  if (!playlist || !Array.isArray(playlist.items) || !playlist.items.length) return [];

  return playlist.items.map(function(item, idx){
    var season = (typeof item.season !== 'undefined') ? parseInt(item.season, 10) : 0;
    var episode = (typeof item.episode !== 'undefined') ? parseInt(item.episode, 10) : 0;
    var voice = shared.clean(item.voiceStudio || item.voiceType || '\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b');
    return {
      id: 'cdnvideohub|' + (item.vkId || idx),
      provider: 'cdnvideohub',
      providerLabel: 'CDNVideoHub',
      voice: voice,
      season: isNaN(season) ? 0 : season,
      episode: isNaN(episode) ? 0 : episode,
      maxQuality: '1080p',
      vkId: item.vkId || '',
      loadSourceMap: async function(){
        if (!item.vkId) return {};
        var info = await loadVideo(item.vkId);
        return sourceMapFromSources((info || {}).sources || {});
      }
    };
  });
}

mod.providers = mod.providers || {};
mod.providers.cdnvideohub = {
  key: 'cdnvideohub',
  title: 'CDNVideoHub',
  search: search
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});