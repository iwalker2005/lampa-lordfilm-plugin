(function(){
'use strict';
if(window.lordfilm_plugin_ready) return;
window.lordfilm_plugin_ready = true;

var VERSION = '1.0.6';
var STORAGE = {
  favorites:'lordfilm_favorites',
  progress:'lordfilm_progress',
  lastChoice:'lordfilm_last_choice',
  baseUrl:'lordfilm_base_url',
  proxyUrl:'lordfilm_proxy_url',
  proxyToken:'lordfilm_proxy_token',
  matchCache:'lordfilm_match_cache'
};
var DEFAULTS = {baseUrl:'https://lordfilm-2026.org', proxyUrl:'https://lordfilm-proxy-iwalker2005.ivonin38.workers.dev', proxyToken:'', timeout:15000, useStreamProxy:true};
var CONTEXT_BTN_CLASS = 'lordfilm-start-btn';
var watchers = {interval:null, entry:null};

function log(){
  try{
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[LordFilm]');
    console.log.apply(console,args);
  }catch(e){}
}

function sget(key,fallback){ try{return Lampa.Storage.get(key,fallback);}catch(e){return fallback;} }
function sset(key,val){ try{Lampa.Storage.set(key,val);}catch(e){} }
function sobj(key,fallback){ var v=sget(key,fallback); if(v&&typeof v==='object') return v; if(typeof v==='string'){ try{return JSON.parse(v);}catch(e){} } return fallback; }
function notify(msg){ try{Lampa.Noty.show(msg);}catch(e){ console.log(msg);} }
function clean(t){ var a=document.createElement('textarea'); a.innerHTML=(t||'').replace(/\s+/g,' ').trim(); return a.value; }
function year(v){ var m=String(v||'').match(/(19|20)\d{2}/); return m?parseInt(m[0],10):0; }
function abs(base,u){ try{return new URL(u,base).toString();}catch(e){return u||'';} }
function conf(){ return {
  baseUrl:String(sget(STORAGE.baseUrl,DEFAULTS.baseUrl)||DEFAULTS.baseUrl).trim().replace(/\/+$/,''),
  proxyUrl:String(sget(STORAGE.proxyUrl,DEFAULTS.proxyUrl)||DEFAULTS.proxyUrl).trim().replace(/\/+$/,''),
  proxyToken:String(sget(STORAGE.proxyToken,DEFAULTS.proxyToken)||DEFAULTS.proxyToken).trim(),
  timeout:DEFAULTS.timeout,
  useStreamProxy:DEFAULTS.useStreamProxy
}; }
function now(){ return Math.floor(Date.now()/1000); }
function fmt(sec){ sec=Math.max(0,parseInt(sec||0,10)); var h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=Math.floor(sec%60); return h>0? [h,m<10?'0'+m:m,s<10?'0'+s:s].join(':') : [m,s<10?'0'+s:s].join(':'); }
function b64src(src){ var m=String(src||'').trim().match(/^<!--base64:([A-Za-z0-9+/=]+)-->$/i); if(!m) return src||''; try{return atob(m[1]);}catch(e){return src||'';} }

var MAP={'а':'a','a':'a','в':'b','b':'b','8':'b','с':'c','c':'c','д':'d','d':'d','е':'e','ё':'e','e':'e','ф':'f','f':'f','г':'g','g':'g','н':'h','h':'h','и':'i','й':'i','і':'i','1':'i','ж':'j','j':'j','к':'k','k':'k','м':'m','ʍ':'m','m':'m','п':'n','Ո':'n','n':'n','о':'o','0':'o','o':'o','р':'p','p':'p','з':'s','3':'s','s':'s','т':'t','τ':'t','7':'t','t':'t','у':'u','u':'u','ш':'w','щ':'w','ɯ':'w','w':'w','х':'x','x':'x','ы':'y','ӹ':'y','y':'y','ч':'ch','4':'ch','я':'ya','ᴙ':'ya','ю':'yu','л':'l','э':'e'};
function norm(t){ t=clean(t||'').toLowerCase(); var out=''; for(var i=0;i<t.length;i++){ var ch=t.charAt(i); if(MAP[ch]) out+=MAP[ch]; else if(/[a-z0-9а-яё]/i.test(ch)) out+=ch; else out+=' '; } return out.replace(/\s+/g,' ').trim(); }
function tok(t){ return norm(t).split(' ').filter(function(x){return x&&x.length>1;}); }
function dice(a,b){ if(!a||!b) return 0; if(a===b) return 1; if(a.length<2||b.length<2) return 0; var map={},i; for(i=0;i<a.length-1;i++){ var bi=a.slice(i,i+2); map[bi]=(map[bi]||0)+1; } var inter=0; for(i=0;i<b.length-1;i++){ var bj=b.slice(i,i+2); if(map[bj]){ inter++; map[bj]--; } } return (2*inter)/((a.length-1)+(b.length-1)); }
function jacc(a,b){ if(!a.length||!b.length) return 0; var A={},B={},k,inter=0,un={}; a.forEach(function(x){A[x]=1;}); b.forEach(function(x){B[x]=1;}); for(k in A){ un[k]=1; if(B[k]) inter++; } for(k in B) un[k]=1; var total=Object.keys(un).length; return total? inter/total : 0; }
function nscore(a,b){ a=norm(a); b=norm(b); if(!a||!b) return 0; if(a===b) return 60; if(a.indexOf(b)>=0||b.indexOf(a)>=0) return 54; return Math.round(Math.max(dice(a,b),jacc(tok(a),tok(b)))*60); }
function score(meta,c){ var names=[meta.title,meta.original_title,meta.original_name].filter(Boolean), n=0; names.forEach(function(x){ n=Math.max(n,nscore(x,c.title)); }); var y=0; if(meta.year&&c.year){ var d=Math.abs(meta.year-c.year); if(d===0) y=30; else if(d===1) y=20; } return {total:n+y,name:n,year:y}; }

function cardMeta(obj){ var m=obj&&obj.movie?obj.movie:obj||{}; return {
  movie:m,
  id:m.id||m.tmdb_id||'',
  title:m.title||m.name||'',
  original_title:m.original_title||m.original_name||'',
  original_name:m.original_name||'',
  year:year(m.year||m.release_date||m.first_air_date||m.last_air_date),
  imdb_id:m.imdb_id||'',
  kinopoisk_id:m.kinopoisk_id||'',
  type:(m.name||m.original_name||m.first_air_date||m.number_of_seasons||m.media_type==='tv')?'tv':'movie'
}; }
function ckey(meta){ if(meta.id) return 'tmdb_'+meta.id; if(meta.imdb_id) return 'imdb_'+meta.imdb_id; if(meta.kinopoisk_id) return 'kp_'+meta.kinopoisk_id; return norm(meta.title||meta.original_title||'unknown')+'_'+(meta.year||'0000'); }
function hkey(parts){ try{return Lampa.Utils.hash(parts.join('|'));}catch(e){return parts.join('|');} }

function HttpError(status,msg,payload){ this.name='HttpError'; this.status=status||500; this.message=msg||'HTTP error'; this.payload=payload||null; }
HttpError.prototype=Object.create(Error.prototype);
function timeoutErr(err){ return err&&(err.name==='AbortError'||/timeout/i.test(err.message||'')); }
async function fetchTo(url,opt){ opt=opt||{}; var ctrl=new AbortController(); var tm=setTimeout(function(){ try{ctrl.abort();}catch(e){} },opt.timeout||DEFAULTS.timeout); try{ return await fetch(url,{method:opt.method||'GET',headers:opt.headers||{},body:opt.body,signal:ctrl.signal}); } finally { clearTimeout(tm);} }
async function request(url,opt){ opt=opt||{}; var cf=conf(); var final=url, headers={}; if(opt.headers){ for(var k in opt.headers) headers[k]=opt.headers[k]; }
  if(cf.proxyUrl){ final=cf.proxyUrl+'/proxy?url='+encodeURIComponent(url); if(cf.proxyToken) headers['X-Proxy-Token']=cf.proxyToken; }
  for(var i=0;i<2;i++){
    try{
      var res=await fetchTo(final,{method:opt.method||'GET',headers:headers,body:opt.body,timeout:opt.timeout||cf.timeout});
      var ctype=(res.headers.get('content-type')||'').toLowerCase();
      if(!res.ok){ var et=''; try{et=await res.text();}catch(e){} throw new HttpError(res.status,et||res.statusText,{body:et}); }
      if(opt.type==='json'){
        if(ctype.indexOf('application/json')>=0){ var j=await res.json();
          if(j&&typeof j.status==='number'&&typeof j.body!=='undefined'){ if(j.status>=400) throw new HttpError(j.status,j.error||'Proxy error',j); if(typeof j.body==='string'){ try{return JSON.parse(j.body);}catch(e){return j.body;} } return j.body; }
          return j;
        }
        var txt=await res.text(); try{return JSON.parse(txt);}catch(e){ throw new HttpError(500,'Invalid JSON',{body:txt}); }
      }
      var t=await res.text();
      if(t&&t.charAt(0)==='{'){
        try{
          var w=JSON.parse(t);
          if(w&&typeof w.status==='number'&&typeof w.body!=='undefined'){
            if(w.status>=400) throw new HttpError(w.status,w.error||'Proxy error',w);
            return String(w.body||'');
          }
        }catch(e){
          if(e&&e.name==='HttpError') throw e;
        }
      }
      return t;
    }catch(err){ if(timeoutErr(err)&&i===0) continue; throw err; }
  }
  throw new HttpError(500,'Request failed');
}
function errMsg(err){ var s=err&&err.status?err.status:0; if(s===401||s===403) return 'Ошибка доступа к прокси'; if(s===404) return 'Контент недоступен'; if(s===429) return 'Слишком много запросов, попробуйте позже'; if(timeoutErr(err)) return 'Таймаут запроса, повторите позже'; return 'Ошибка загрузки данных LordFilm'; }
function parseSearch(html,baseUrl){
  var doc=new DOMParser().parseFromString(html,'text/html');
  var bodyText=doc.body?doc.body.textContent||'':'';
  if(bodyText.indexOf('Новостей по данному запросу не найдено')>=0) return [];
  var nodes=doc.querySelectorAll('.item.expand-link.grid-items__item');
  var out=[];
  nodes.forEach(function(n){
    var a=n.querySelector('a.item__title'); if(!a) return;
    var title=clean(a.textContent||''); if(!title) return;
    var img=n.querySelector('img');
    out.push({
      title:title,
      year:year((n.querySelector('.item__year')||{}).textContent||''),
      href:abs(baseUrl,a.getAttribute('href')||''),
      poster:img?abs(baseUrl,b64src(img.getAttribute('src')||'')):''
    });
  });
  var seen={};
  return out.filter(function(x){ if(!x.href||seen[x.href]) return false; seen[x.href]=1; return true; });
}

function parsePlayerMeta(html,baseUrl,itemUrl){
  var doc=new DOMParser().parseFromString(html,'text/html');
  var vp=doc.querySelector('video-player');
  var ifr=doc.querySelector('iframe[src*="balancer-api/iframe"]');
  var titleId='',publisherId='',aggregator='kp';
  if(vp){
    titleId=vp.getAttribute('data-title-id')||'';
    publisherId=vp.getAttribute('data-publisher-id')||'';
    aggregator=vp.getAttribute('data-aggregator')||'kp';
  }
  if((!titleId||!publisherId)&&ifr){
    try{ var u=new URL(ifr.getAttribute('src'),baseUrl); if(!titleId) titleId=u.searchParams.get('kp')||u.searchParams.get('id')||''; if(!publisherId) publisherId='2158'; }catch(e){}
  }
  if(!publisherId) publisherId='2158';
  var bc=clean((doc.querySelector('.breadcrumbs')||{}).textContent||'').toLowerCase();
  var path='';
  try{ path=new URL(itemUrl||'',baseUrl).pathname.toLowerCase(); }catch(e){}
  var isSerial=bc.indexOf('сериалы')>=0||bc.indexOf('сериал')>=0||path.indexOf('/serialy/')>=0;
  return {titleId:titleId,publisherId:publisherId,aggregator:aggregator,isSerialByPage:isSerial};
}

function cacheGet(key){ var c=sobj(STORAGE.matchCache,{}), it=c[key]; if(!it) return null; if(!it.updated_at||now()-it.updated_at>86400*7) return null; return it; }
function cacheSet(key,val){ var c=sobj(STORAGE.matchCache,{}); c[key]=val; sset(STORAGE.matchCache,c); }

async function resolveMatch(meta){
  var cf=conf();
  var key=ckey(meta);
  var cached=cacheGet(key);
  if(cached&&cached.itemUrl&&cached.titleId&&cached.publisherId) return cached;

  var queries=[];
  if(meta.title) queries.push(meta.title);
  if(meta.original_title&&queries.indexOf(meta.original_title)===-1) queries.push(meta.original_title);
  if(meta.original_name&&queries.indexOf(meta.original_name)===-1) queries.push(meta.original_name);

  var cand=[];
  for(var i=0;i<queries.length;i++){
    var html=await request(cf.baseUrl+'/index.php?do=search&subaction=search&story='+encodeURIComponent(queries[i]),{type:'text'});
    var f=parseSearch(html,cf.baseUrl);
    cand=cand.concat(f);
  }
  if(!cand.length) throw new Error('Контент не найден на LordFilm');
  var uniq=[], seen={};
  cand.forEach(function(c){ if(!c||!c.href||seen[c.href]) return; seen[c.href]=1; uniq.push(c); });
  cand=uniq;

  var ranked=cand.map(function(c){ return {candidate:c,score:score(meta,c)}; }).sort(function(a,b){ return b.score.total-a.score.total; });
  var best=ranked[0]||null;
  if(!best) throw new Error('Контент не найден на LordFilm');

  var minScore=(meta.year&&best.candidate.year)?70:54;
  if(best.score.total<minScore){
    if(ranked.length===1&&best.score.total>=50){
      // fallback для карточек без валидного года на источнике
    }else{
      throw new Error('Контент не найден на LordFilm');
    }
  }

  var itemHtml=await request(best.candidate.href,{type:'text'});
  var p=parsePlayerMeta(itemHtml,cf.baseUrl,best.candidate.href);
  if(!p.titleId||!p.publisherId) throw new Error('Не удалось извлечь данные плеера');

  var resolved={
    itemUrl:best.candidate.href,
    title:best.candidate.title,
    year:best.candidate.year,
    poster:best.candidate.poster,
    titleId:p.titleId,
    publisherId:p.publisherId,
    aggregator:p.aggregator||'kp',
    isSerialByPage:p.isSerialByPage,
    updated_at:now()
  };
  cacheSet(key,resolved);
  return resolved;
}

async function loadPlaylist(res){
  return await request('https://plapi.cdnvideohub.com/api/v1/player/sv/playlist?pub='+encodeURIComponent(res.publisherId)+'&id='+encodeURIComponent(res.titleId)+'&aggr='+encodeURIComponent(res.aggregator||'kp'),{type:'json'});
}
async function loadVideo(vkId){ return await request('https://plapi.cdnvideohub.com/api/v1/player/sv/video/'+encodeURIComponent(vkId),{type:'json'}); }

function voice(item){ var s=clean(item.voiceStudio||''), t=clean(item.voiceType||''); if(s&&t&&s!==t) return s+' / '+t; return s||t||'Оригинал'; }

function buildMovieEntries(items,mkey){
  return (items||[]).map(function(it,idx){
    var v=voice(it), hash=hkey(['lordfilm',mkey,'movie',v.toLowerCase(),it.vkId||idx]);
    return {
      kind:'movie', vkId:it.vkId, voice:v, voiceKey:norm(v||('voice_'+idx)),
      title:v, subtitle:'Выбор качества', hash:hash,
      timeline:(window.Lampa&&Lampa.Timeline)?Lampa.Timeline.view(hash):{time:0,duration:0,percent:0}
    };
  });
}

function buildSerial(items,mkey){
  var seasons={}, voices={};
  (items||[]).forEach(function(it){
    var s=parseInt(it.season||1,10)||1, e=parseInt(it.episode||1,10)||1, v=voice(it), vk=norm(v), hash=hkey(['lordfilm',mkey,'tv',s,e,vk]);
    if(!seasons[s]) seasons[s]={};
    if(!seasons[s][e]) seasons[s][e]={season:s,episode:e,voices:{}};
    seasons[s][e].voices[vk]={vkId:it.vkId,voice:v,voiceKey:vk,hash:hash};
    voices[vk]=v;
  });
  var seasonList=Object.keys(seasons).map(function(k){return parseInt(k,10);}).sort(function(a,b){return a-b;});
  var voiceList=Object.keys(voices).map(function(k){return {key:k,title:voices[k]};}).sort(function(a,b){return a.title.localeCompare(b.title,'ru');});
  return {seasons:seasons,seasonList:seasonList,voices:voiceList};
}

var QMAP=[
 {key:'mpeg4kUrl',label:'2160p'},{key:'mpeg2kUrl',label:'1440p'},{key:'mpegQhdUrl',label:'1080p QHD'},{key:'mpegFullHdUrl',label:'1080p'},
 {key:'mpegHighUrl',label:'720p'},{key:'mpegMediumUrl',label:'480p'},{key:'mpegLowUrl',label:'360p'},{key:'mpegLowestUrl',label:'240p'},{key:'mpegTinyUrl',label:'144p'}
];
function sproxy(url){ var cf=conf(); if(!cf.proxyUrl||!cf.useStreamProxy) return url; var out=cf.proxyUrl+'/stream?url='+encodeURIComponent(url); if(cf.proxyToken) out+='&token='+encodeURIComponent(cf.proxyToken); return out; }
function qualityMap(src){
  var map={}; if(src&&src.hlsUrl) map['Auto HLS']=sproxy(src.hlsUrl); if(src&&src.dashUrl) map['Auto DASH']=sproxy(src.dashUrl);
  QMAP.forEach(function(q){ if(src&&src[q.key]) map[q.label]=sproxy(src[q.key]); }); return map;
}
function pickQuality(map,forced){
  if(!map) return {label:'',url:''};
  if(forced&&map[forced]) return {label:forced,url:map[forced]};
  if(map['Auto HLS']) return {label:'Auto HLS',url:map['Auto HLS']};
  var def=String(sget('video_quality_default','1080')||'1080')+'p';
  var order=['2160p','1440p','1080p QHD','1080p','720p','480p','360p','240p','144p','Auto HLS','Auto DASH'];
  var idx=order.indexOf(def),i;
  if(idx>=0){ for(i=idx;i<order.length;i++) if(map[order[i]]) return {label:order[i],url:map[order[i]]}; for(i=idx-1;i>=0;i--) if(map[order[i]]) return {label:order[i],url:map[order[i]]}; }
  var first=Object.keys(map)[0]; return {label:first||'',url:first?map[first]:''};
}

function favs(){ return sobj(STORAGE.favorites,[]); }
function setFavs(v){ sset(STORAGE.favorites,v||[]); }
function isFav(meta){ var id=ckey(meta); return favs().some(function(f){return f.id===id;}); }
function toggleFav(meta,res){ var id=ckey(meta), list=favs(), ix=list.findIndex(function(f){return f.id===id;}); if(ix>=0){ list.splice(ix,1); setFavs(list); notify('Удалено из избранного'); return false; }
  list.push({id:id,card:meta.movie,title:meta.title||meta.original_title,year:meta.year,type:meta.type,poster:res&&res.poster?res.poster:(meta.movie.poster_path||''),itemUrl:res&&res.itemUrl?res.itemUrl:'',titleId:res&&res.titleId?res.titleId:'',publisherId:res&&res.publisherId?res.publisherId:'',aggregator:res&&res.aggregator?res.aggregator:'kp',updated_at:now()});
  setFavs(list); notify('Добавлено в избранное'); return true;
}

function pAll(){ return sobj(STORAGE.progress,{}); }
function setPAll(v){ sset(STORAGE.progress,v||{}); }
function getP(meta){ return pAll()[ckey(meta)]||null; }
function saveP(meta,data){ var all=pAll(); all[ckey(meta)]=data; setPAll(all); }
function lastChoice(meta){ return sobj(STORAGE.lastChoice,{})[ckey(meta)]||null; }
function saveChoice(meta,choice){ var all=sobj(STORAGE.lastChoice,{}); all[ckey(meta)]=choice; sset(STORAGE.lastChoice,all); }
function startWatcher(meta,entry,type,season,episode){
  stopWatcher(); watchers.entry=entry;
  watchers.interval=setInterval(function(){
    try{
      if(!window.Lampa||!Lampa.Timeline||!watchers.entry) return;
      var v=Lampa.Timeline.view(watchers.entry.hash); if(!v) return;
      saveP(meta,{type:type||'movie',season:season||1,episode:episode||1,time:parseInt(v.time||0,10),duration:parseInt(v.duration||0,10),updated_at:now()});
    }catch(e){}
  },12000);
}
function stopWatcher(){ if(watchers.interval) clearInterval(watchers.interval); watchers.interval=null; watchers.entry=null; }

function promptContinue(timeline){
  return new Promise(function(resolve){
    if(!timeline||!timeline.time||parseInt(timeline.time,10)<60) return resolve(true);
    var d=parseInt(timeline.duration||0,10), t=parseInt(timeline.time||0,10);
    if(d>0&&t>=d-60) return resolve(false);
    var enabled=(Lampa.Controller&&Lampa.Controller.enabled&&Lampa.Controller.enabled().name)||'content';
    Lampa.Select.show({title:'Продолжить просмотр',items:[{title:'Продолжить с '+fmt(t),value:'continue'},{title:'Начать сначала',value:'restart'}],onBack:function(){ try{Lampa.Controller.toggle(enabled);}catch(e){} resolve(true); },onSelect:function(it){ try{Lampa.Controller.toggle(enabled);}catch(e){} resolve(it.value==='continue'); }});
  });
}

function ensureAssets(){
  if(!window.Lampa||!Lampa.Template) return;
  if(!document.getElementById('lordfilm-style')){
    var st=document.createElement('style'); st.id='lordfilm-style';
    st.innerHTML=['.lordfilm-item{position:relative;padding-left:2.1em;min-height:56px}','.lordfilm-item .lordfilm-item__title{font-size:1.05em;line-height:1.2}','.lordfilm-item .lordfilm-item__meta{opacity:.82;padding-top:.25em;font-size:.95em}','.lordfilm-item .lordfilm-item__badge{position:absolute;right:0;top:.1em;font-size:.9em;opacity:.9}','.lordfilm-item.selector.focus,.lordfilm-item.selector.hover{outline:2px solid rgba(255,255,255,.8);outline-offset:2px}'].join('');
    document.head.appendChild(st);
  }
  Lampa.Template.add('lordfilm_item','<div class="lordfilm-item selector"><div class="lordfilm-item__title">{title}</div><div class="lordfilm-item__meta">{meta}</div><div class="lordfilm-item__badge">{badge}</div></div>');
}

function timelineDetailsString(timeline){
  if(!timeline || !window.Lampa || !Lampa.Timeline || !Lampa.Timeline.details) return '';
  try{
    var details = Lampa.Timeline.details(timeline,' / ');
    if(typeof details === 'string') return details;
    if(details && typeof details.text === 'function') return details.text() || '';
  }catch(e){}
  return '';
}

function component(object){
  var _this=this;
  var meta=cardMeta(object), cf=conf();
  var network=new Lampa.Reguest(), scroll=new Lampa.Scroll({mask:true,over:true}), files=new Lampa.Explorer(object), filter=new Lampa.Filter(object);
  var st={resolved:null,playlist:null,isSerial:false,seasonList:[],seasons:{},voices:[],selectedSeason:1,selectedVoice:'',forcedQuality:'',entries:[],last:null,loading:false};

  scroll.body().addClass('torrent-list');
  scroll.minus(files.render().find('.explorer__files-head'));

  function loading(x){ if(_this.activity) _this.activity.loader(!!x); st.loading=!!x; if(!x&&_this.activity&&Lampa.Activity.active().activity===_this.activity) _this.activity.toggle(); }
  function empty(msg){ var e=Lampa.Template.get('list_empty'); if(msg) e.find('.empty__descr').text(msg); scroll.append(e); loading(false); }
  function append(item){ item.on('hover:focus',function(e){ st.last=e.target; scroll.update($(e.target),true); }); scroll.append(item); }
  function episodes(season){ var map=st.seasons[season]||{}; return Object.keys(map).map(function(k){return map[k];}).sort(function(a,b){return a.episode-b.episode;}); }
  function voiceForEpisode(ep){ if(!ep||!ep.voices) return null; if(st.selectedVoice&&ep.voices[st.selectedVoice]) return ep.voices[st.selectedVoice]; var k=Object.keys(ep.voices)[0]; return k?ep.voices[k]:null; }

  function rebuildEntries(){
    if(!st.isSerial){ st.entries=buildMovieEntries(st.playlist.items||[],ckey(meta)); return; }
    var p=getP(meta)||{};
    st.entries=episodes(st.selectedSeason).map(function(ep){
      var vo=voiceForEpisode(ep); if(!vo) return null;
      var t=Lampa.Timeline.view(vo.hash), viewed=t&&t.percent>=90, cur=p&&p.season===ep.season&&p.episode===ep.episode;
      return {kind:'episode',season:ep.season,episode:ep.episode,vkId:vo.vkId,voice:vo.voice,voiceKey:vo.voiceKey,hash:vo.hash,title:'S'+ep.season+'E'+ep.episode,subtitle:vo.voice,timeline:t,viewed:viewed,current:cur};
    }).filter(Boolean);
  }

  function renderFilter(){
    var items=[{title:isFav(meta)?'Убрать из избранного':'В избранное',action:'toggle-fav'},{title:'Избранное LordFilm',action:'open-fav'}];
    if(st.isSerial){
      items.push({title:'Сезон',subtitle:'Сезон '+st.selectedSeason,stype:'season',items:st.seasonList.map(function(s,idx){return {title:'Сезон '+s,index:idx,selected:s===st.selectedSeason};})});
      items.push({title:'Озвучка',subtitle:(st.voices.find(function(v){return v.key===st.selectedVoice;})||{}).title||'Авто',stype:'voice',items:st.voices.map(function(v,idx){return {title:v.title,index:idx,selected:v.key===st.selectedVoice};})});
    }
    filter.set('filter',items); filter.set('sort',[]);
  }

  function renderEntries(){
    scroll.render().find('.empty').remove(); scroll.clear(); scroll.reset();
    if(!st.entries.length){ empty('Доступные варианты не найдены'); return; }
    st.entries.forEach(function(en){
      var m=en.subtitle||''; if(en.timeline&&en.timeline.time) m+=(m?' / ':'')+'Позиция: '+fmt(en.timeline.time);
      var b=''; if(en.current) b='▶ Текущая'; else if(en.viewed) b='✓ Просмотрено';
      var item=Lampa.Template.get('lordfilm_item',{title:en.title,meta:m,badge:b});
      if(en.timeline){
        item.append(Lampa.Timeline.render(en.timeline));
        var d=timelineDetailsString(en.timeline);
        if(d) item.find('.lordfilm-item__meta').append(' / '+d);
      }
      item.on('hover:enter',function(){ playEntry(en); }); append(item);
    });
    _this.start(true);
  }

  function openFavorites(){
    var list=favs(); if(!list.length){ notify('Избранное пусто'); return; }
    var enabled=(Lampa.Controller&&Lampa.Controller.enabled&&Lampa.Controller.enabled().name)||'content';
    Lampa.Select.show({title:'Избранное LordFilm',items:list.map(function(f,idx){ return {title:(f.title||'Без названия')+(f.year?' ('+f.year+')':''),index:idx}; }),onBack:function(){ try{Lampa.Controller.toggle(enabled);}catch(e){} },onSelect:function(it){ try{Lampa.Controller.toggle(enabled);}catch(e){} var f=list[it.index]; if(!f||!f.card) return; Lampa.Activity.push({url:'',title:'LordFilm',component:'lordfilm',movie:f.card,page:1,search:f.title,search_one:f.title,search_two:f.card.original_title||''}); }});
  }

  function persistChoice(en,ql){ saveChoice(meta,{season:en&&en.season?en.season:st.selectedSeason,voiceKey:en&&en.voiceKey?en.voiceKey:st.selectedVoice,quality:ql||'',updated_at:now()}); }

  async function buildPlayer(en){
    var info=await loadVideo(en.vkId), qmap=qualityMap((info||{}).sources||{}), pick=pickQuality(qmap,st.forcedQuality);
    if(!pick.url) throw new Error('Невалидный поток');
    var tl=en.timeline||Lampa.Timeline.view(en.hash), cont=await promptContinue(tl);
    if(!cont){ tl.time=0; tl.percent=0; tl.duration=tl.duration||0; if(Lampa.Timeline&&Lampa.Timeline.update) Lampa.Timeline.update(tl); }
    persistChoice(en,pick.label);
    return {first:{url:pick.url,quality:qmap,timeline:tl,title:st.isSerial?('S'+en.season+'E'+en.episode+' / '+en.voice):('LordFilm / '+en.voice)}};
  }

  async function playMovie(en){ loading(true); try{ var d=await buildPlayer(en); Lampa.Player.play(d.first); Lampa.Player.playlist([d.first]); saveP(meta,{type:'movie',season:1,episode:1,time:parseInt((en.timeline||{}).time||0,10),duration:parseInt((en.timeline||{}).duration||0,10),updated_at:now()}); startWatcher(meta,en,'movie',1,1);} finally{ loading(false);} }
  async function playEpisode(en){
    loading(true); try{ var d=await buildPlayer(en); var eps=st.entries.filter(function(x){return x.kind==='episode'&&x.season===en.season;}).sort(function(a,b){return a.episode-b.episode;}); var si=eps.findIndex(function(x){return x.episode===en.episode;}); if(si<0) si=0; var queue=eps.slice(si), plist=[d.first];
      queue.slice(1).forEach(function(ep){ plist.push({url:function(call){ loadVideo(ep.vkId).then(function(info){ var qm=qualityMap((info||{}).sources||{}),pk=pickQuality(qm,st.forcedQuality); this.url=pk.url||''; this.quality=qm; call(); }.bind(this)).catch(function(){ this.url=''; call(); }.bind(this)); },timeline:ep.timeline,title:'S'+ep.season+'E'+ep.episode+' / '+ep.voice}); });
      Lampa.Player.play(d.first); Lampa.Player.playlist(plist);
      saveP(meta,{type:'tv',season:en.season,episode:en.episode,time:parseInt((en.timeline||{}).time||0,10),duration:parseInt((en.timeline||{}).duration||0,10),updated_at:now()}); startWatcher(meta,en,'tv',en.season,en.episode);
    } finally { loading(false);} }
  function playEntry(en){ if(st.loading) return; if(meta.movie&&meta.movie.id) Lampa.Favorite.add('history',meta.movie,100); if(en.kind==='movie') playMovie(en).catch(function(err){ notify(errMsg(err)); }); else playEpisode(en).catch(function(err){ notify(errMsg(err)); }); }

  async function bootstrap(){
    if(!meta.title&&!meta.original_title){ empty('В карточке отсутствует название'); return; }
    loading(true);
    try{
      st.resolved=await resolveMatch(meta);
      st.playlist=await loadPlaylist(st.resolved);
      var playlistSerial=(st.playlist&&typeof st.playlist.isSerial==='boolean')?st.playlist.isSerial:null;
      st.isSerial=playlistSerial===null?(!!st.resolved.isSerialByPage||meta.type==='tv'):(playlistSerial||meta.type==='tv');
      if(!st.playlist||!st.playlist.items||!st.playlist.items.length){ empty('Потоки не найдены'); return; }
      if(st.isSerial){
        var model=buildSerial(st.playlist.items,ckey(meta)); st.seasons=model.seasons; st.seasonList=model.seasonList; st.voices=model.voices;
        var p=getP(meta), ch=lastChoice(meta)||{};
        st.selectedSeason=p&&p.season?p.season:(ch.season||st.seasonList[0]); if(st.seasonList.indexOf(st.selectedSeason)<0) st.selectedSeason=st.seasonList[0];
        st.selectedVoice=ch.voiceKey||(st.voices[0]?st.voices[0].key:''); if(st.selectedVoice&&!st.voices.some(function(v){return v.key===st.selectedVoice;})) st.selectedVoice=st.voices[0]?st.voices[0].key:'';
        st.forcedQuality=ch.quality||'';
      }else{
        st.forcedQuality=(lastChoice(meta)||{}).quality||'';
      }
      renderFilter(); rebuildEntries(); renderEntries(); loading(false);
    }catch(err){ loading(false); if((err.message||'').indexOf('Контент не найден на LordFilm')>=0) empty('Контент не найден на LordFilm'); else empty(errMsg(err)); }
  }
  this.create=function(){
    ensureAssets();
    if(!cf.proxyUrl) notify('Прокси не задан (`lordfilm_proxy_url`). Для Android TV рекомендуется Cloudflare Worker.');

    filter.onSearch=function(value){ Lampa.Activity.replace({search:value,search_date:'',clarification:true}); };
    filter.onBack=function(){ _this.start(); };
    filter.onSelect=function(type,a,b){
      if(type!=='filter') return;
      if(a.action==='toggle-fav'){ toggleFav(meta,st.resolved); renderFilter(); return; }
      if(a.action==='open-fav'){ openFavorites(); return; }
      if(a.stype==='season'&&st.isSerial){
        st.selectedSeason=st.seasonList[b.index]; rebuildEntries(); renderFilter(); renderEntries();
        saveChoice(meta,{season:st.selectedSeason,voiceKey:st.selectedVoice,quality:st.forcedQuality,updated_at:now()}); return;
      }
      if(a.stype==='voice'&&st.isSerial){
        st.selectedVoice=st.voices[b.index]?st.voices[b.index].key:st.selectedVoice; rebuildEntries(); renderFilter(); renderEntries();
        saveChoice(meta,{season:st.selectedSeason,voiceKey:st.selectedVoice,quality:st.forcedQuality,updated_at:now()});
      }
    };

    files.appendHead(filter.render());
    files.appendFiles(scroll.render());
    bootstrap();
    return this.render();
  };

  this.render=function(){ return files.render(); };
  this.start=function(first){
    if(Lampa.Activity.active().activity!==this.activity) return;
    if(first&&!st.last) st.last=scroll.render().find('.selector').eq(0)[0];
    Lampa.Background.immediately(Lampa.Utils.cardImgBackground(meta.movie));
    Lampa.Controller.add('content',{
      toggle:function(){ Lampa.Controller.collectionSet(scroll.render(),files.render()); Lampa.Controller.collectionFocus(st.last||false,scroll.render()); },
      up:function(){ if(Navigator.canmove('up')) Navigator.move('up'); else Lampa.Controller.toggle('head'); },
      down:function(){ Navigator.move('down'); },
      right:function(){ if(Navigator.canmove('right')) Navigator.move('right'); else filter.show('Параметры LordFilm','filter'); },
      left:function(){ if(Navigator.canmove('left')) Navigator.move('left'); else Lampa.Controller.toggle('menu'); },
      back:this.back
    });
    Lampa.Controller.toggle('content');
  };

  this.back=function(){ Lampa.Activity.backward(); };
  this.pause=function(){};
  this.stop=function(){};
  this.destroy=function(){ stopWatcher(); network.clear(); files.destroy(); scroll.destroy(); st.entries=[]; };
}

function openLordFilmFromCard(movie){
  Lampa.Component.add('lordfilm',component);
  Lampa.Activity.push({
    url:'',
    title:'LordFilm',
    component:'lordfilm',
    search:(movie&&movie.title)||'',
    search_one:(movie&&movie.title)||'',
    search_two:(movie&&movie.original_title)||'',
    movie:movie||{},
    page:1
  });
}

function appendSourceButton(root,movie){
  if(!root||!root.find) return;
  if(root.find('.'+CONTEXT_BTN_CLASS).length) return;

  var icon='<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"><circle cx="64" cy="64" r="56" stroke="currentColor" stroke-width="12" fill="none"/><path d="M88 64L48 88V40z" fill="currentColor"/></svg>';
  var btn=$('<div class="full-start__button selector '+CONTEXT_BTN_CLASS+'" data-subtitle="LordFilm '+VERSION+'">'+icon+'<span>LordFilm</span></div>');
  btn.on('hover:enter',function(){ openLordFilmFromCard(movie||{}); });

  var trg=root.find('.buttons--container .view--torrent');
  if(trg.length){ trg.after(btn); return; }

  var btnContainer=root.find('.buttons--container');
  if(btnContainer.length){ btnContainer.append(btn); return; }
}

function addButton(){
  Lampa.Listener.follow('full',function(e){
    if(e.type!=='complite') return;
    var root=e.object.activity.render();
    appendSourceButton(root,e.data&&e.data.movie?e.data.movie:{});
  });

  try{
    var active=Lampa.Activity.active&&Lampa.Activity.active();
    if(active&&active.component==='full'&&active.activity&&active.activity.render){
      appendSourceButton(active.activity.render(),active.card||active.movie||{});
    }
  }catch(e){}
}

function init(){
  if(window.lordfilm_plugin_inited) return;
  ensureAssets();
  Lampa.Component.add('lordfilm',component);
  Lampa.Manifest.plugins={
    type:'video',
    version:VERSION,
    name:'LordFilm - '+VERSION,
    description:'LordFilm источник для Lampa',
    component:'lordfilm',
    onContextMenu:function(){ return {name:'Смотреть через LordFilm',description:''}; },
    onContextLauch:function(object){
      Lampa.Activity.push({url:'',title:'LordFilm',component:'lordfilm',search:object.title,search_one:object.title,search_two:object.original_title,movie:object,page:1});
    }
  };
  addButton();
  window.lordfilm_plugin_inited=true;
  log('initialized',VERSION);
}

function bootstrap(){
  if(window.lordfilm_plugin_bootstrapped) return;
  window.lordfilm_plugin_bootstrapped=true;

  var start=function(){
    try{ init(); }
    catch(e){ console.error('[LordFilm] init error',e); }
  };

  if(window.appready) start();
  else if(window.Lampa&&Lampa.Listener){
    Lampa.Listener.follow('app',function(e){ if(e.type==='ready') start(); });
    setTimeout(start,2500);
  }
  else setTimeout(start,1500);
}

bootstrap();

})();
