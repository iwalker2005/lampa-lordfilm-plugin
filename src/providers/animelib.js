(function(mod){
'use strict';

var shared = mod.shared;
var network = mod.network;

var HOST = 'https://api2.mangalib.me/api/';
var PLAYER_SERVERS = [
  { name: 'Основной', url: 'https://video1.anilib.me/.%D0%B0s/' },
  { name: 'Резервный 1', url: 'https://video2.anilib.me/.%D0%B0s/' },
  { name: 'Резервный 2', url: 'https://video3.anilib.me/.%D0%B0s/' }
];

function cleanText(value){
  return shared.clean(value || '');
}

function makeMapFromPlayer(player){
  var map = {};
  var server = PLAYER_SERVERS[0];
  if (!(player && player.video && player.video.quality && player.video.quality.length)) return map;

  player.video.quality.forEach(function(q){
    var quality = q.quality || q.height || 0;
    var href = q.href || '';
    if (!href) return;
    map[(quality ? quality + 'p' : 'Auto')] = network.proxifyStream(server.url + href);
  });

  return map;
}

function makeItem(meta, episode, player){
  var voice = cleanText(player.team && player.team.name || player.voice || 'Original');
  var season = 1;
  var episodeNum = episode.item_number || episode.episode || episode.ordinal || 0;
  var map = makeMapFromPlayer(player);

  return {
    id: ['animelib', meta.title || meta.original_title || meta.original_name || 'unknown', season, episodeNum, voice, player.team && player.team.id || ''].join('|'),
    provider: 'animelib',
    providerLabel: 'Animelib',
    voice: voice,
    season: season,
    episode: episodeNum,
    maxQuality: Object.keys(map)[0] || 'Auto',
    title: 'E' + episodeNum + ' | ' + voice,
    media: {
      episode: episode,
      player: player
    },
    sourceMap: map,
    loadSourceMap: async function(){
      return makeMapFromPlayer(player);
    }
  };
}

function searchAnimeUrl(title){
  var url = HOST + 'anime?fields[]=rate_avg&fields[]=rate&fields[]=releaseDate';
  url = Lampa.Utils.addUrlComponent(url, 'q=' + encodeURIComponent(title));
  return url;
}

function episodesUrl(animeSlug){
  var url = HOST + 'episodes';
  url = Lampa.Utils.addUrlComponent(url, 'anime_id=' + encodeURIComponent(animeSlug));
  return url;
}

function episodePlayersUrl(episodeId){
  return HOST + 'episodes/' + encodeURIComponent(episodeId);
}

async function search(meta){
  var title = meta && (meta.title || meta.original_title || meta.original_name || '');
  if (!title) return [];

  var json = await network.requestPreferProxy(searchAnimeUrl(title), {
    type: 'json',
    timeout: 15000,
    retries: 0,
    proxyReferer: HOST
  }).catch(function(){ return null; });

  var list = json && json.data ? json.data : [];
  if (!Array.isArray(list) || !list.length) return [];

  var candidates = list.slice(0, 5);
  var items = [];

  for (var i = 0; i < candidates.length; i++) {
    var anime = candidates[i];
    var episodes = await network.requestPreferProxy(episodesUrl(anime.slug_url), {
      type: 'json',
      timeout: 15000,
      retries: 0,
      proxyReferer: HOST
    }).catch(function(){ return null; });

    var eps = episodes && episodes.data ? episodes.data : [];
    if (!Array.isArray(eps) || !eps.length) continue;

    for (var e = 0; e < eps.length; e++) {
      var episode = eps[e];
      if (!episode || !episode.id) continue;

      var episodeDetail = await network.requestPreferProxy(episodePlayersUrl(episode.id), {
        type: 'json',
        timeout: 15000,
        retries: 0,
        proxyReferer: HOST
      }).catch(function(){ return null; });

      var players = episodeDetail && episodeDetail.data && Array.isArray(episodeDetail.data.players)
        ? episodeDetail.data.players.filter(function(p){ return p.player === 'Animelib'; })
        : [];

      players.forEach(function(player){
        if (!(player && player.video && player.video.quality && player.video.quality.length)) return;
        items.push(makeItem(meta, episode, player));
      });
    }

    if (items.length) break;
  }

  return shared.dedupeItems(items).slice(0, 200);
}

mod.providers = mod.providers || {};
mod.providers.animelib = {
  key: 'animelib',
  title: 'Animelib',
  search: search
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});
