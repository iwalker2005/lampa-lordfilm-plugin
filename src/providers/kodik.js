(function(mod){
'use strict';

var shared = mod.shared;
var network = mod.network;

var streamCache = {};

function decodeKodikLink(str){
  var value = String(str || '');
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || /^\/\//.test(value)) return value;
  try {
    return atob(value.replace(/[a-zA-Z]/g, function(ch){
      var code = ch.charCodeAt(0) + 18;
      var max = ch <= 'Z' ? 90 : 122;
      if (code > max) code -= 26;
      return String.fromCharCode(code);
    }));
  } catch (e) {
    return '';
  }
}

function parseJsonSafe(text){
  try { return JSON.parse(text); }
  catch (e) { return null; }
}

function toLabel(quality){
  var q = parseInt(quality, 10);
  return isNaN(q) ? 'Auto' : String(q) + 'p';
}

function buildSourceMapFromLinks(links){
  var pairs = [];
  Object.keys(links || {}).forEach(function(key){
    var row = links[key];
    var raw = row && row[0] ? row[0].src : '';
    var url = decodeKodikLink(raw);
    if (!url) return;
    pairs.push({ quality: parseInt(key, 10), label: toLabel(key), url: url });
  });
  pairs.sort(function(a, b){
    var aq = isNaN(a.quality) ? -1 : a.quality;
    var bq = isNaN(b.quality) ? -1 : b.quality;
    return bq - aq;
  });
  var map = {};
  pairs.forEach(function(item){
    if (!map[item.label]) map[item.label] = network.proxifyStream(item.url);
  });
  return map;
}

async function resolveKodikSourceMap(link){
  var cacheKey = String(link || '');
  if (!cacheKey) return {};
  if (streamCache[cacheKey]) return streamCache[cacheKey];

  var linkMatch = cacheKey.match(/^(?:https?:)?(\/\/[^\/]+)\//i);
  var origin = 'https:' + (linkMatch ? linkMatch[1] : '//kodik.info');
  var pageUrl = /^https?:/i.test(cacheKey) ? cacheKey : ('https:' + cacheKey);

  var pageHtml = await network.requestPreferProxy(pageUrl, { type: 'text', timeout: 5000, retries: 0 });
  var compact = String(pageHtml || '').replace(/\n/g, ' ');

  var urlParamsMatch = compact.match(/\burlParams\s*=\s*'([^']+)'/);
  var typeMatch = compact.match(/\b(?:videoInfo|vInfo)\.type\s*=\s*'([^']+)'/);
  var hashMatch = compact.match(/\b(?:videoInfo|vInfo)\.hash\s*=\s*'([^']+)'/);
  var idMatch = compact.match(/\b(?:videoInfo|vInfo)\.id\s*=\s*'([^']+)'/);
  var playerMatch = compact.match(/<script[^>]*\bsrc="(\/assets\/js\/app\.player_single[^"]+)"/i);
  if (!urlParamsMatch || !typeMatch || !hashMatch || !idMatch || !playerMatch) return {};

  var urlParams = parseJsonSafe(urlParamsMatch[1]);
  if (!urlParams) return {};

  var postData = '';
  postData += 'd=' + encodeURIComponent(urlParams.d || '');
  postData += '&d_sign=' + encodeURIComponent(urlParams.d_sign || '');
  postData += '&pd=' + encodeURIComponent(urlParams.pd || '');
  postData += '&pd_sign=' + encodeURIComponent(urlParams.pd_sign || '');
  postData += '&ref=' + encodeURIComponent(urlParams.ref || '');
  postData += '&ref_sign=' + encodeURIComponent(urlParams.ref_sign || '');
  postData += '&bad_user=true';
  postData += '&cdn_is_working=true';
  postData += '&type=' + encodeURIComponent(typeMatch[1]);
  postData += '&hash=' + encodeURIComponent(hashMatch[1]);
  postData += '&id=' + encodeURIComponent(idMatch[1]);
  postData += '&info=%7B%7D';

  var playerUrl = origin + playerMatch[1];
  var playerScript = await network.requestPreferProxy(playerUrl, { type: 'text', timeout: 5000, retries: 0 });
  var infoMatch = String(playerScript || '').match(/\$\.ajax\(\{type:\s*"POST",\s*url:\s*atob\("([^"]+)"\)/);
  if (!infoMatch) return {};

  var infoPath = '';
  try { infoPath = atob(infoMatch[1]); }
  catch (e) { infoPath = ''; }
  if (!infoPath) return {};

  var infoUrl = infoPath.indexOf('http') === 0 ? infoPath : (origin + infoPath);
  var info = await network.requestPreferProxy(infoUrl, {
    method: 'POST',
    body: postData,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    type: 'json',
    timeout: 5000,
    retries: 0,
    proxyReferer: pageUrl
  });

  var sourceMap = buildSourceMapFromLinks(info && info.links ? info.links : {});
  streamCache[cacheKey] = sourceMap;
  return sourceMap;
}

function appendTitleParams(params, title){
  var words = shared.clean(title || '').replace(/[\s\-+]+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) return params;
  words.sort(function(a, b){ return b.length - a.length; });
  params.push(['title', words[0]]);
  return params;
}

async function apiSearch(params){
  var query = params.map(function(pair){
    return encodeURIComponent(pair[0]) + '=' + encodeURIComponent(String(pair[1] || ''));
  }).join('&');
  return await network.requestPreferProxy('https://kodikapi.com/search?' + query, {
    type: 'json',
    timeout: 5000,
    retries: 0
  });
}

function resultVoice(result){
  if (result && result.translation && result.translation.title) return shared.clean(result.translation.title);
  return shared.clean(result && (result.title_orig || result.title) || '\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b');
}

function scoreResult(meta, result){
  return shared.matchScore(meta, {
    title: result && (result.title || result.title_orig || result.other_title || ''),
    year: shared.year(result && result.year)
  }).total;
}

function toEntries(meta, results){
  var entries = [];
  (results || []).forEach(function(result){
    var voice = resultVoice(result);
    if (result && result.seasons && typeof result.seasons === 'object') {
      Object.keys(result.seasons).forEach(function(seasonId){
        var seasonData = result.seasons[seasonId] || {};
        var episodes = seasonData.episodes || {};
        Object.keys(episodes).forEach(function(episodeId){
          var link = episodes[episodeId];
          if (!link) return;
          entries.push({
            id: ['kodik', seasonId, episodeId, voice, link].join('|'),
            provider: 'kodik',
            providerLabel: 'Kodik',
            voice: voice,
            season: parseInt(seasonId, 10) || 0,
            episode: parseInt(episodeId, 10) || 0,
            maxQuality: shared.clean(result.quality || '1080p'),
            link: link,
            loadSourceMap: function(){ return resolveKodikSourceMap(link); }
          });
        });
      });
    } else if (result && result.link) {
      var linkMovie = result.link;
      entries.push({
        id: ['kodik', 'movie', voice, linkMovie].join('|'),
        provider: 'kodik',
        providerLabel: 'Kodik',
        voice: voice,
        season: 0,
        episode: 0,
        maxQuality: shared.clean(result.quality || '1080p'),
        link: linkMovie,
        loadSourceMap: function(){ return resolveKodikSourceMap(linkMovie); }
      });
    }
  });
  return entries;
}

async function search(meta){
  var cfg = shared.getConfig();
  if (!cfg.kodikToken) return [];

  var baseParams = [
    ['token', cfg.kodikToken],
    ['limit', 100],
    ['with_episodes', 'true'],
    ['translation_type', 'voice']
  ];

  var attempts = [];
  if (meta && meta.kinopoisk_id) {
    attempts.push(baseParams.concat([['kinopoisk_id', meta.kinopoisk_id]]));
  }
  if (meta && meta.imdb_id) {
    attempts.push(baseParams.concat([['imdb_id', meta.imdb_id]]));
  }

  if (!attempts.length) {
    attempts.push(appendTitleParams(baseParams.slice(), meta.title || meta.original_title || ''));
  }

  var best = [];
  var i;
  for (i = 0; i < attempts.length; i++) {
    var json = await apiSearch(attempts[i]).catch(function(){ return null; });
    var rows = json && Array.isArray(json.results) ? json.results.slice() : [];
    if (!rows.length) continue;
    rows.sort(function(a, b){ return scoreResult(meta, b) - scoreResult(meta, a); });
    best = rows.slice(0, 8);
    if (best.length) break;
  }

  if (!best.length) return [];
  return toEntries(meta, best).slice(0, 120);
}

mod.providers = mod.providers || {};
mod.providers.kodik = {
  key: 'kodik',
  title: 'Kodik',
  search: search
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});