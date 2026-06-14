(function(mod){
'use strict';

var shared = mod.shared;
var network = mod.network;
var balance = mod.core.balance;

var HOST = 'https://cdnmovies-stream.online';
var EMBED = HOST + '/';
var USER_AGENT = 'Mozilla/5.0 (Linux; Android 10; K; client) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.178 Mobile Safari/537.36';
var TRASH_LIST = ['wNp2wBTNcPRQvTC0_CpxCsq_8T1u9Q', 'md-Od2G9RWOgSa5HoBSSbWrCyIqQyY', 'kzuOYQqB_QSOL-xzN_Kz3kkgkHhHit', '6-xQWMh7ertLp8t_M9huUDk1M0VrYJ', 'RyTwtf15_GLEsXxnpU4Ljjd0ReY-VH'];

function cleanText(value){
  return shared.clean(value || '');
}

function decode(data){
  return balance.decodeTrashData(data, TRASH_LIST, '//');
}

function extractNumber(value){
  var match = String(value || '').match(/(\d{1,4})/);
  return match ? parseInt(match[1], 10) : 0;
}

function mediaMapFromText(text, baseUrl){
  var decoded = decode(text);
  if (!decoded) return {};
  return balance.sourceMapFromText(decoded, baseUrl);
}

function makeItem(meta, raw, season, episode, title, baseUrl){
  var media = raw || {};
  var voice = cleanText(title || media.title || media.comment || meta.title || meta.original_title || 'Original');
  return {
    id: ['cdnmovies', meta.kinopoisk_id || meta.imdb_id || meta.title || 'unknown', season || 0, episode || 0, voice].join('|'),
    provider: 'cdnmovies',
    providerLabel: 'CDNMovies',
    voice: voice,
    season: season || 0,
    episode: episode || 0,
    maxQuality: 'Auto',
    title: voice,
    media: media,
    loadSourceMap: async function(){
      if (media.qualitys && typeof media.qualitys === 'object') {
        var map = {};
        Object.keys(media.qualitys).forEach(function(label){
          if (media.qualitys[label]) map[label] = network.proxifyStream(media.qualitys[label]);
        });
        if (Object.keys(map).length) return map;
      }

      if (media.file) return mediaMapFromText(media.file, baseUrl);
      if (media.sources) return balance.sourceMapFromText(media.sources, baseUrl);
      if (media.url) return balance.sourceMapFromText(media.url, baseUrl);
      return {};
    }
  };
}

function parsePlayerOptions(text, meta, baseUrl){
  var json = balance.parsePlayerObject(text);
  if (!json) return [];

  if (json.file && typeof json.file === 'string') {
    json.file = decode(json.file);
    try {
      json.file = JSON.parse(json.file);
    } catch (e) {
      json = {
        file: [json]
      };
    }
  }

  var items = [];
  var list = json.file && Array.isArray(json.file) ? json.file : [];

  list.forEach(function(node, index){
    if (!node) return;

    if (node.folder && Array.isArray(node.folder)) {
      var voiceTitle = cleanText(node.title || node.comment || node.name || 'Original');
      node.folder.forEach(function(entry){
        if (!entry) return;
        var episodeNum = extractNumber(entry.title || entry.comment || entry.name || '');
        items.push(makeItem(meta, entry, 0, episodeNum, voiceTitle, baseUrl));
      });
      return;
    }

    var title = cleanText(node.title || node.comment || node.name || 'Original');
    var season = extractNumber(node.season || node.title || '');
    var episode = extractNumber(node.episode || node.comment || node.name || '');
    items.push(makeItem(meta, node, season, episode, title, baseUrl));
  });

  return shared.dedupeItems(items);
}

async function resolveEpisodePage(url, meta){
  var html = await network.requestPreferProxy(url, {
    type: 'text',
    timeout: 10000,
    retries: 0,
    proxyReferer: url,
    headers: {
      'User-Agent': USER_AGENT
    }
  }).catch(function(){ return ''; });

  if (!html) return [];

  var playerMatch = html.match(/\bvideoUrl = '(http[^']*)'/);
  var playerLink = playerMatch && playerMatch[1] ? String(playerMatch[1]) : '';
  if (!playerLink) return [];

  var playerHtml = await network.requestPreferProxy(playerLink, {
    type: 'text',
    timeout: 10000,
    retries: 0,
    proxyReferer: url,
    headers: {
      'User-Agent': USER_AGENT
    }
  }).catch(function(){ return ''; });

  if (!playerHtml) return [];
  return parsePlayerOptions(playerHtml, meta || {}, playerLink);
}

async function search(meta){
  var id = meta && (meta.kinopoisk_id || meta.imdb_id);
  if (!id) return [];

  var kind = meta.kinopoisk_id ? 'kinopoisk' : 'imdb';
  var url = EMBED + kind + '/' + encodeURIComponent(id) + '/iframe';
  var html = await network.requestPreferProxy(url, {
    type: 'text',
    timeout: 10000,
    retries: 0,
    proxyReferer: HOST + '/',
    headers: {
      'User-Agent': USER_AGENT
    }
  }).catch(function(){ return ''; });

  if (!html) return [];
  var items = await resolveEpisodePage(url, meta).catch(function(){ return []; });
  if (items.length) return items;

  var direct = parsePlayerOptions(html, meta, url);
  return direct.length ? direct : [];
}

mod.providers = mod.providers || {};
mod.providers.cdnmovies = {
  key: 'cdnmovies',
  title: 'CDNMovies',
  search: search
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});
