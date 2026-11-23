/* Fotobudka: service worker. Strona startuje z pamięci urządzenia, gdy nie ma internetu. */
var V='fotobudka-2026-11-23.2';
var CORE=['index.html','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'];

self.addEventListener('install',function(e){
  e.waitUntil(
    caches.open(V).then(function(c){
      return c.addAll([new Request('index.html',{cache:'reload'})]).then(function(){
        return Promise.all(CORE.slice(1).map(function(u){return c.add(new Request(u,{cache:'reload'})).catch(function(){})}));
      });
    }).then(function(){return self.skipWaiting()})
  );
});
self.addEventListener('activate',function(e){
  e.waitUntil(
    caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==V}).map(function(k){return caches.delete(k)}))})
      .then(function(){return self.clients.claim()})
  );
});

/* sieć najpierw, ale po 2,5 s (słaby lub zerowy internet) bierzemy kopię z pamięci */
function netFirst(evt,req,key){
  return new Promise(function(resolve){
    var done=false;
    var net=fetch(req).then(function(r){
      if(r&&r.ok){var cp=r.clone();caches.open(V).then(function(c){c.put(key||req,cp)})}
      return r;
    });
    function fromCache(){
      return caches.match(key||req,{ignoreSearch:true}).then(function(m){
        if(m&&!done){done=true;resolve(m);return true}
        return false;
      });
    }
    var t=setTimeout(fromCache,2500);
    net.then(function(r){if(!done){done=true;clearTimeout(t);resolve(r)}},function(){
      clearTimeout(t);
      fromCache().then(function(ok){if(!ok&&!done){done=true;resolve(Response.error())}});
    });
    evt.waitUntil(net.catch(function(){}));
  });
}
function swr(evt,req){
  return caches.open(V).then(function(c){
    return c.match(req).then(function(m){
      var net=fetch(req).then(function(r){if(r&&(r.ok||r.type==='opaque'))c.put(req,r.clone());return r}).catch(function(){return m});
      evt.waitUntil(net);
      return m||net;
    });
  });
}
self.addEventListener('fetch',function(e){
  var req=e.request;
  if(req.method!=='GET')return;
  var u=new URL(req.url);
  if(req.mode==='navigate'){e.respondWith(netFirst(e,req,'index.html'));return}
  if(u.origin===self.location.origin){e.respondWith(netFirst(e,req));return}
  if(/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)){e.respondWith(swr(e,req));return}
});
