(function(mod){
'use strict';

var shared = mod.shared;
var network = mod.network;

function parsePlayerObject(html){
  var text = String(html || '').replace(/\n/g, ' ');
  var found = text.match(/makePlayer\s*\(\s*(\{[\s\S]*?\})\s*\);/i);
  if (!found) return null;
  try {
    return (0, eval)('"use strict"; (' + found[1] + ')');
  } catch (e) {
    return null;
  }
}

function maxQuality(json){
  var max = 0;
  try {
    Object.keys(json && json.qualityByWidth || {}).forEach(function(key){
      var q = parseInt((json.qualityByWidth || {})[key], 10);
      if (!isNaN(q)) max = Math.max(max, q);
    });
  } catch (e) {}
  return max ? String(max) + 'p' : '1080p';
}

function mapFromEpisode(episode){
  var src = '';
  if (episode) {
    src = episode.hls || episode.dasha || episode.dash || '';
  }
  return network.sourceMapFromUrl(src);
}

function voiceNames(audio){
  var names = [];
  var src = audio && Array.isArray(audio.names) ? audio.names : [];
  var order = audio && Array.isArray(audio.order) ? audio.order : [];
  var info = src.map(function(name, index){
    return { name: name, order: typeof order[index] === 'number' ? order[index] : 1000 };
  }).sort(function(a, b){ return a.order - b.order; });
  info.forEach(function(item){
    var name = shared.clean(item.name || '');
    if (name && name !== 'delete' && names.indexOf(name) < 0) names.push(name);
  });
  return names;
}

async function search(meta){
  var id = meta && meta.kinopoisk_id ? String(meta.kinopoisk_id) : '';
  var imdb = meta && meta.imdb_id ? String(meta.imdb_id) : '';
  if (!id && !imdb) return [];

  var base = 'https://api.namy.ws/embed/';
  var first = id ? ('kp/' + encodeURIComponent(id)) : ('imdb/' + encodeURIComponent(imdb));
  var fallback = imdb ? ('imdb/' + encodeURIComponent(imdb)) : '';

  var html = await network.requestPreferProxy(base + first, {
    type: 'text',
    timeout: 5000,
    retries: 0,
    proxyReferer: 'https://api.namy.ws/'
  }).catch(function(){ return ''; });

  if (!html && fallback) {
    html = await network.requestPreferProxy(base + fallback, {
      type: 'text',
      timeout: 5000,
      retries: 0,
      proxyReferer: 'https://api.namy.ws/'
    }).catch(function(){ return ''; });
  }

  if (!html) return [];

  var parsed = parsePlayerObject(html);
  if (!parsed) return [];

  var out = [];

  if (parsed.playlist && Array.isArray(parsed.playlist.seasons) && parsed.playlist.seasons.length) {
    parsed.playlist.seasons.forEach(function(season){
      var seasonNum = parseInt(season.season, 10);
      (season.episodes || []).forEach(function(episode){
        var episodeNum = parseInt(episode.episode, 10);
        var voices = voiceNames(episode.audio || {});
        var map = mapFromEpisode(episode);
        if (!Object.keys(map).length) return;
        if (!voices.length) voices = ['\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b'];
        voices.forEach(function(voice, idx){
          out.push({
            id: ['collaps', seasonNum, episodeNum, voice, idx].join('|'),
            provider: 'collaps',
            providerLabel: 'Collaps',
            voice: voice,
            season: isNaN(seasonNum) ? 0 : seasonNum,
            episode: isNaN(episodeNum) ? 0 : episodeNum,
            maxQuality: '1080p',
            sourceMap: map
          });
        });
      });
    });
  } else if (parsed.source) {
    var mapMovie = network.sourceMapFromUrl(parsed.source.hls || parsed.source.dasha || parsed.source.dash || '');
    if (!Object.keys(mapMovie).length) return [];
    var voicesMovie = voiceNames(parsed.source.audio || {});
    if (!voicesMovie.length) voicesMovie = ['\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b'];
    var quality = maxQuality(parsed);
    voicesMovie.forEach(function(voice, idx){
      out.push({
        id: ['collaps', 'movie', voice, idx].join('|'),
        provider: 'collaps',
        providerLabel: 'Collaps',
        voice: voice,
        season: 0,
        episode: 0,
        maxQuality: quality,
        sourceMap: mapMovie
      });
    });
  }

  return out;
}

mod.providers = mod.providers || {};
mod.providers.collaps = {
  key: 'collaps',
  title: 'Collaps',
  search: search
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});