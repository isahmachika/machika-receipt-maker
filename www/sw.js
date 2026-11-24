/* Machika Receipt Maker - service worker.
   Online: always fetches the newest files (so updates show at once) and keeps a copy.
   Offline or very slow network: opens the app from the saved copy. Supabase calls are never cached. */
const VERSION='machika-v1';
const CORE=['/','/index.html','/favicon.svg','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png',
 '/css/base.css','/css/layout.css','/css/public.css','/css/app.css','/css/receipt.css',
 '/js/main.js','/js/config.js','/js/supa.js','/js/state.js','/js/utils.js','/js/shell.js','/js/router.js','/js/auth.js','/js/editor.js','/js/receipts.js','/js/profile.js','/js/telegram.js','/js/admin.js','/js/legal.js','/js/landing.js','/js/catalog.js',
 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2','https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(VERSION).then(c=>Promise.all(CORE.map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

function networkFirst(req,key){
  return new Promise(resolve=>{
    let done=false;
    const finish=r=>{if(!done){done=true;resolve(r)}};
    const fromCache=()=>caches.match(key||req);
    const timer=setTimeout(()=>fromCache().then(r=>{if(r)finish(r)}),4000);   // weak network: show the saved copy
    fetch(req).then(res=>{
      clearTimeout(timer);
      if(res&&(res.ok||res.type==='opaque')){const copy=res.clone();caches.open(VERSION).then(c=>c.put(key||req,copy))}
      finish(res);
    }).catch(()=>{clearTimeout(timer);fromCache().then(r=>finish(r||Response.error()))});
  });
}

self.addEventListener('fetch',e=>{
  const req=e.request,url=new URL(req.url);
  if(req.method!=='GET'||url.hostname.endsWith('supabase.co')) return;
  const sameOrigin=url.origin===self.location.origin;
  const allowed=sameOrigin||url.hostname==='cdn.jsdelivr.net'||url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com';
  if(!allowed) return;
  if(req.mode==='navigate') e.respondWith(networkFirst(req,'/index.html'));   // every app page is the same single page
  else e.respondWith(networkFirst(req));
});
