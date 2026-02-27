(function(mod){
'use strict';

var shared = mod.shared;
var network = mod.network;

var MAIN_MIRRORS = [
  'https://lordfilm-2026.org',
  'https://lordfilmpuq.study'
];

var SEO_MIRRORS = [
  'https://gentalmen-lordfilm.ru',
  'https://12-angry-men-lordfilm.ru'
];

function isWpBase(base){
  try {
    var host = (new URL(base)).hostname.toLowerCase();
    return host.indexOf('lordfilms.ru') >= 0 || /(^|\.)[^.]+-lordfilm\.ru$/.test(host);
  } catch (e) {
    return false;
  }
}

function searchUrl(base, query){
  return isWpBase(base)
    ? (base + '/?s=' + encodeURIComponent(query))
    : (base + '/index.php?do=search&subaction=search&story=' + encodeURIComponent(query));
}

function parseSearch(html, baseUrl){
  var doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  var out = [];
  var baseHost = '';

  try { baseHost = (new URL(baseUrl)).hostname.toLowerCase(); }
  catch (e) {}

  function sameHost(url){
    try {
      if (!baseHost) return true;
      return (new URL(url, baseUrl)).hostname.toLowerCase() === baseHost;
    } catch (e) { return true; }
  }

  function push(raw){
    if (!raw || !raw.href || !sameHost(raw.href)) return;
    out.push({
      title: shared.clean(raw.title || ''),
      year: parseInt(raw.year || 0, 10) || 0,
      href: shared.abs(baseUrl, raw.href || ''),
      poster: raw.poster ? shared.abs(baseUrl, raw.poster) : ''
    });
  }

  doc.querySelectorAll('.grid-items__item').forEach(function(node){
    var link = node.querySelector('a.item__title');
    if (!link) return;
    var title = shared.clean(link.textContent || link.getAttribute('title') || '');
    if (!title) return;
    var image = node.querySelector('img');
    push({
      title: title,
      year: shared.year((node.querySelector('.item__year') || {}).textContent || ''),
      href: link.getAttribute('href') || '',
      poster: image ? (image.getAttribute('src') || image.getAttribute('data-src') || '') : ''
    });
  });

  doc.querySelectorAll('a.film-i[href]').forEach(function(link){
    var titleNode = link.querySelector('.film-i__title');
    var title = shared.clean((titleNode || link).textContent || link.getAttribute('title') || '');
    if (!title) return;
    var image = link.querySelector('img');
    var poster = image ? (image.getAttribute('data-src') || image.getAttribute('data-lazy-src') || image.getAttribute('src') || '') : '';
    push({
      title: title,
      year: shared.year((link.querySelector('.film-i__god_vyhoda') || {}).textContent || title),
      href: link.getAttribute('href') || '',
      poster: poster
    });
  });

  doc.querySelectorAll('a.articles__item[href],a.articles__info-button[href]').forEach(function(link){
    var title = shared.clean((link.querySelector('.articles__title') || {}).textContent || link.getAttribute('title') || link.textContent || '');
    title = title.replace(/\b(\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c|\u043e\u043d\u043b\u0430\u0439\u043d|lordfilm)\b/ig, '').replace(/\s+/g, ' ').trim();
    if (!title) return;
    var image = link.querySelector('img') || (link.parentElement && link.parentElement.querySelector ? link.parentElement.querySelector('img') : null);
    var poster = image ? (image.getAttribute('data-src') || image.getAttribute('data-lazy-src') || image.getAttribute('src') || '') : '';
    push({
      title: title,
      year: shared.year(title),
      href: link.getAttribute('href') || '',
      poster: poster
    });
  });

  var seen = {};
  return out.filter(function(item){
    if (!item.href || !item.title || seen[item.href]) return false;
    seen[item.href] = 1;
    return true;
  }).slice(0, 200);
}

function detectPlayerKind(url){
  var low = String(url || '').toLowerCase();
  if (!low) return 'iframe';
  if (/balancer-api\/iframe/.test(low)) return 'balancer';
  if (/api\.namy\.ws\/embed\//.test(low)) return 'embed';
  return 'iframe';
}

function parsePlayerMeta(html, baseUrl, pageUrl){
  var doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  var players = [];
  var titleId = '';
  var publisherId = '';
  var aggregator = 'kp';
  var embedUrl = '';

  doc.querySelectorAll('video-player').forEach(function(node){
    var tid = node.getAttribute('data-title-id') || '';
    var pid = node.getAttribute('data-publisher-id') || '';
    var aggr = node.getAttribute('data-aggregator') || 'kp';
    if (tid && !titleId) titleId = tid;
    if (pid && !publisherId) publisherId = pid;
    if (aggr && aggregator === 'kp') aggregator = aggr;
    players.push({
      kind: 'cdnvideohub',
      titleId: tid,
      publisherId: pid,
      aggregator: aggr,
      pageUrl: pageUrl || ''
    });
  });

  doc.querySelectorAll('iframe').forEach(function(node){
    var raw = node.getAttribute('data-lazy-src') || node.getAttribute('data-src') || node.getAttribute('src') || '';
    raw = String(raw || '').replace(/\\u0026/gi, '&').replace(/&amp;/g, '&').replace(/\\\//g, '/');
    if (!raw || raw === 'about:blank') return;
    var full = shared.abs(baseUrl, raw);
    var kind = detectPlayerKind(full);
    players.push({ kind: kind, url: full, pageUrl: pageUrl || '' });
    if (!embedUrl && kind === 'embed') embedUrl = full;
    if ((!titleId || !publisherId) && /balancer-api\/iframe/i.test(full)) {
      try {
        var u = new URL(full, baseUrl);
        if (!titleId) titleId = u.searchParams.get('kp') || u.searchParams.get('id') || '';
        if (!publisherId) publisherId = '2158';
      } catch (e) {}
    }
  });

  return {
    titleId: titleId,
    publisherId: publisherId || '2158',
    aggregator: aggregator,
    embedUrl: embedUrl,
    players: players
  };
}

function parseEmbedSources(html, embedUrl){
  var text = String(html || '');
  var raw = {};
  var sourceMatch = text.match(/source\s*:\s*\{([\s\S]{0,10000}?)\}/i);
  if (sourceMatch) {
    var reg = /(hls|dash|dasha)\s*:\s*['"]([^'"]+)['"]/ig;
    var row;
    while ((row = reg.exec(sourceMatch[1]))) {
      raw[row[1].toLowerCase()] = shared.abs(embedUrl, row[2]);
    }
  }

  if (!raw.hls) {
    var m3u8 = text.match(/https?:\/\/[^"'\\\s]+\.m3u8[^"'\\\s]*/i);
    if (m3u8) raw.hls = m3u8[0];
  }
  if (!raw.dash) {
    var mpd = text.match(/https?:\/\/[^"'\\\s]+\.mpd[^"'\\\s]*/i);
    if (mpd) raw.dash = mpd[0];
  }

  var map = {};
  if (raw.hls) map['Auto HLS'] = network.proxifyStream(raw.hls);
  if (raw.dash) map['Auto DASH'] = network.proxifyStream(raw.dash);
  if (raw.dasha) map['Auto DASH Alt'] = network.proxifyStream(raw.dasha);
  return map;
}

function parseBalancerMeta(html, iframeUrl){
  var text = String(html || '');
  var movieId = '';
  var baseUrl = '';
  var token = '';
  var requestId = '';

  var m = text.match(/window\.MOVIE_ID\s*=\s*(\d+)/i);
  if (m) movieId = m[1];
  m = text.match(/window\.ENV_BASE_URL\s*=\s*['"]([^'"]+)['"]/i);
  if (m) baseUrl = m[1];
  m = text.match(/['"]DLE-API-TOKEN['"]\s*:\s*['"]([^'"]+)['"]/i);
  if (m) token = m[1];
  m = text.match(/['"]Iframe-Request-Id['"]\s*:\s*['"]([^'"]+)['"]/i);
  if (m) requestId = m[1];

  if (!baseUrl) {
    try {
      var u = new URL(iframeUrl);
      baseUrl = u.origin + '/balancer-api/proxy/playlists';
    } catch (e) {}
  }

  var headers = {};
  if (token) headers['DLE-API-TOKEN'] = token;
  if (requestId) headers['Iframe-Request-Id'] = requestId;

  return {
    movieId: String(movieId || ''),
    baseUrl: String(baseUrl || ''),
    headers: headers
  };
}

async function loadBalancerItems(iframeUrl){
  var iframeHtml = await network.requestPreferProxy(iframeUrl, {
    type: 'text',
    timeout: 5000,
    retries: 0,
    proxyReferer: iframeUrl
  });

  var meta = parseBalancerMeta(iframeHtml, iframeUrl);
  if (!meta.movieId || !meta.baseUrl) return [];

  var episodes = await network.requestPreferProxy(meta.baseUrl + '/catalog-api/episodes?content-id=' + encodeURIComponent(meta.movieId), {
    type: 'json',
    timeout: 5000,
    retries: 0,
    headers: meta.headers,
    proxyReferer: iframeUrl
  }).catch(function(){ return []; });

  if (!Array.isArray(episodes) || !episodes.length) return [];

  var out = [];
  episodes.forEach(function(ep, idx){
    var season = 1;
    var episode = idx + 1;
    if (ep && ep.season && typeof ep.season.order !== 'undefined') {
      var sn = parseInt(ep.season.order, 10);
      if (!isNaN(sn)) season = sn + 1;
    }
    if (ep && typeof ep.order !== 'undefined') {
      var en = parseInt(ep.order, 10);
      if (!isNaN(en)) episode = en + 1;
    }

    var vars = (ep && Array.isArray(ep.episodeVariants) && ep.episodeVariants.length)
      ? ep.episodeVariants
      : (ep && ep.m3u8MasterFilePath ? [{ filepath: ep.m3u8MasterFilePath, title: '\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b' }] : []);

    vars.forEach(function(v, vidx){
      var url = shared.abs(iframeUrl, (v && v.filepath) || '');
      var map = network.sourceMapFromUrl(url);
      if (!Object.keys(map).length) return;
      out.push({
        id: ['lordfilm', 'balancer', season, episode, vidx].join('|'),
        provider: 'lordfilm',
        providerLabel: 'LordFilm',
        voice: shared.clean((v && v.title) || '\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b'),
        season: season,
        episode: episode,
        maxQuality: '1080p',
        sourceMap: map
      });
    });
  });

  return out;
}

async function loadCdnvideohubItems(info){
  if (!info.titleId || !info.publisherId) return [];
  var url = 'https://plapi.cdnvideohub.com/api/v1/player/sv/playlist?pub=' + encodeURIComponent(info.publisherId) + '&id=' + encodeURIComponent(info.titleId) + '&aggr=' + encodeURIComponent(info.aggregator || 'kp');
  var playlist = await network.requestPreferProxy(url, { type: 'json', timeout: 5000, retries: 0 }).catch(function(){ return null; });
  if (!playlist || !Array.isArray(playlist.items) || !playlist.items.length) return [];

  return playlist.items.map(function(item, idx){
    return {
      id: ['lordfilm', 'cdn', item.vkId || idx].join('|'),
      provider: 'lordfilm',
      providerLabel: 'LordFilm',
      voice: shared.clean(item.voiceStudio || item.voiceType || '\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b'),
      season: parseInt(item.season, 10) || 0,
      episode: parseInt(item.episode, 10) || 0,
      maxQuality: '1080p',
      vkId: item.vkId || '',
      loadSourceMap: async function(){
        if (!item.vkId) return {};
        var video = await network.requestPreferProxy('https://plapi.cdnvideohub.com/api/v1/player/sv/video/' + encodeURIComponent(item.vkId), {
          type: 'json',
          timeout: 5000,
          retries: 0
        }).catch(function(){ return null; });
        var sources = (video && video.sources) || {};
        var map = {};
        if (sources.hlsUrl) map['Auto HLS'] = network.proxifyStream(sources.hlsUrl);
        if (sources.mpegFullHdUrl) map['1080p'] = network.proxifyStream(sources.mpegFullHdUrl);
        if (sources.mpegHighUrl) map['720p'] = network.proxifyStream(sources.mpegHighUrl);
        if (sources.mpegMediumUrl) map['480p'] = network.proxifyStream(sources.mpegMediumUrl);
        return map;
      }
    };
  });
}

async function loadEmbedItem(embedUrl, label){
  if (!embedUrl) return [];
  var html = await network.requestPreferProxy(embedUrl, {
    type: 'text',
    timeout: 5000,
    retries: 0,
    proxyReferer: embedUrl
  }).catch(function(){ return ''; });
  if (!html) return [];
  var sourceMap = parseEmbedSources(html, embedUrl);
  if (!Object.keys(sourceMap).length) return [];
  return [{
    id: 'lordfilm|embed|' + embedUrl,
    provider: 'lordfilm',
    providerLabel: 'LordFilm',
    voice: shared.clean(label || '\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b'),
    season: 0,
    episode: 0,
    maxQuality: Object.keys(sourceMap)[0] || '1080p',
    sourceMap: sourceMap,
    embedUrl: embedUrl
  }];
}

function dynamicDomains(meta){
  var out = [];
  var seen = {};
  [meta.title, meta.original_title, meta.original_name].forEach(function(name){
    shared.slugVariants(name).forEach(function(slug){
      var base = 'https://' + slug + '-lordfilm.ru';
      if (seen[base]) return;
      seen[base] = 1;
      out.push(base);
    });
  });
  return out.slice(0, 8);
}

function orderBases(meta, cfg){
  var seen = {};
  var groups = [[], [], []];

  function add(group, base){
    var normalized = shared.normalizeBaseUrl(base);
    if (!normalized || seen[normalized]) return;
    seen[normalized] = 1;
    groups[group].push(normalized);
  }

  MAIN_MIRRORS.forEach(function(base){ add(0, base); });
  if (cfg && cfg.baseUrl) add(0, cfg.baseUrl);
  if (cfg && Array.isArray(cfg.extraBases)) cfg.extraBases.forEach(function(base){ add(0, base); });
  SEO_MIRRORS.forEach(function(base){ add(1, base); });
  dynamicDomains(meta).forEach(function(base){ add(2, base); });

  return groups;
}

function rankCandidate(meta, candidates){
  var ranked = (candidates || []).map(function(candidate){
    return { candidate: candidate, score: shared.matchScore(meta, candidate) };
  }).sort(function(a, b){ return b.score.total - a.score.total; });
  return ranked[0] || null;
}

async function searchByGroup(bases, query){
  var tasks = (bases || []).map(function(base){
    return network.requestPreferProxy(searchUrl(base, query), {
      type: 'text',
      timeout: 3800,
      retries: 0,
      proxyReferer: base + '/'
    }).then(function(html){
      var rows = parseSearch(html, base);
      rows.forEach(function(row){ row.baseUrl = base; });
      return rows;
    }).catch(function(){
      return [];
    });
  });
  var sets = await Promise.all(tasks);
  var out = [];
  sets.forEach(function(set){ if (set && set.length) out = out.concat(set); });
  return out;
}

async function searchDuckDuckGo(meta){
  var q = meta && (meta.title || meta.original_title || meta.original_name);
  if (!q) return '';
  var url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent('site:lordfilm.ru ' + q);
  var html = await network.requestPreferProxy(url, {
    type: 'text',
    timeout: 4000,
    retries: 0,
    proxyReferer: 'https://duckduckgo.com/'
  }).catch(function(){ return ''; });
  if (!html) return '';

  var doc = new DOMParser().parseFromString(html, 'text/html');
  var link = doc.querySelector('a.result__a, a[data-testid="result-title-a"]');
  if (!link) return '';
  var href = link.getAttribute('href') || '';
  try {
    var parsed = new URL(href, 'https://html.duckduckgo.com');
    if (parsed.hostname.indexOf('duckduckgo.com') >= 0) {
      var uddg = parsed.searchParams.get('uddg');
      if (uddg) href = decodeURIComponent(uddg);
    }
  } catch (e) {}
  if (!/lordfilm\.ru/i.test(href)) return '';
  return href;
}

async function resolveCandidate(meta){
  var cfg = shared.getConfig();
  var groups = orderBases(meta, cfg);
  var queries = shared.queryVariants(meta);
  if (!queries.length) queries = [meta.title || meta.original_title || ''];

  var all = [];
  var gi;
  for (gi = 0; gi < groups.length; gi++) {
    var group = groups[gi];
    var qi;
    for (qi = 0; qi < Math.min(4, queries.length); qi++) {
      var set = await searchByGroup(group, queries[qi]);
      if (set.length) {
        all = all.concat(set);
        break;
      }
    }
    if (all.length) break;
  }

  var best = rankCandidate(meta, all);
  if (best && best.candidate && best.score && best.score.total >= 50) {
    return best.candidate;
  }

  var fallbackUrl = await searchDuckDuckGo(meta);
  if (fallbackUrl) {
    return {
      title: meta.title || meta.original_title || fallbackUrl,
      year: meta.year || 0,
      href: fallbackUrl,
      poster: ''
    };
  }

  return null;
}

async function search(meta){
  var candidate = await resolveCandidate(meta);
  if (!candidate || !candidate.href) return [];

  var pageHtml = await network.requestPreferProxy(candidate.href, {
    type: 'text',
    timeout: 5000,
    retries: 0
  }).catch(function(){ return ''; });
  if (!pageHtml) return [];

  var baseUrl = candidate.baseUrl || '';
  try { baseUrl = (new URL(candidate.href)).origin; }
  catch (e) { if (!baseUrl) baseUrl = shared.getConfig().baseUrl; }

  var playerMeta = parsePlayerMeta(pageHtml, baseUrl, candidate.href);
  var out = [];

  if (playerMeta.titleId && playerMeta.publisherId) {
    out = out.concat(await loadCdnvideohubItems(playerMeta));
  }

  if (playerMeta.embedUrl) {
    out = out.concat(await loadEmbedItem(playerMeta.embedUrl, '\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b'));
  }

  var players = Array.isArray(playerMeta.players) ? playerMeta.players : [];
  var i;
  for (i = 0; i < players.length; i++) {
    var player = players[i];
    if (!player) continue;
    if (player.kind === 'balancer' && player.url) {
      out = out.concat(await loadBalancerItems(player.url).catch(function(){ return []; }));
    } else if (player.kind !== 'cdnvideohub' && player.url) {
      var label = player.kind === 'embed' ? 'Embed' : 'Iframe';
      out = out.concat(await loadEmbedItem(player.url, label).catch(function(){ return []; }));
    }
  }

  return shared.dedupeItems(out);
}

mod.providers = mod.providers || {};
mod.providers.lordfilm = {
  key: 'lordfilm',
  title: 'LordFilm',
  search: search
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});