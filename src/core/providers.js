(function(mod){
'use strict';

var shared = mod.shared;
var network = mod.network;

function listActiveProviders(){
  var cfg = shared.getConfig();
  var out = [];
  shared.PROVIDERS.forEach(function(def){
    var instance = mod.providers && mod.providers[def.key];
    if (!instance) return;
    if (!cfg.providerEnabled[def.key]) return;
    out.push(instance);
  });
  return out;
}

async function runProviders(meta, onUpdate){
  var cfg = shared.getConfig();
  var active = listActiveProviders();
  if (!active.length) return [];

  var timeout = Math.max(1000, parseInt(cfg.timeoutMs, 10) || 5000);
  var tasks = active.map(function(provider){
    return network.withTimeout(Promise.resolve().then(function(){
      return provider.search(meta, {
        config: cfg,
        shared: shared,
        network: network
      });
    }), timeout, provider.key || provider.title || 'provider');
  });

  tasks.forEach(function(task, index){
    var provider = active[index];
    task.then(function(items){
      if (!onUpdate) return;
      onUpdate({
        status: 'fulfilled',
        provider: provider,
        items: Array.isArray(items) ? items : []
      });
    }).catch(function(error){
      if (!onUpdate) return;
      onUpdate({
        status: 'rejected',
        provider: provider,
        reason: error
      });
    });
  });

  var settled = await Promise.allSettled(tasks);
  return settled.map(function(result, index){
    return result.status === 'fulfilled'
      ? { status: 'fulfilled', provider: active[index], items: Array.isArray(result.value) ? result.value : [] }
      : { status: 'rejected', provider: active[index], reason: result.reason };
  });
}

mod.core = mod.core || {};
mod.core.providers = {
  listActiveProviders: listActiveProviders,
  runProviders: runProviders
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});
