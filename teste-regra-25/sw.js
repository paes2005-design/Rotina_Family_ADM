const CACHE_NAME='rotina-family-adm-v27';
const APP_SHELL=['./','./index.html','./index-ADMIN-v8.html','./manifest.json','./icon-administrador-192.png','./icon-administrador-512.png','./dashboard-ranking-pro.css','./dashboard-ranking-pro.js','./monitor-pro.css','./monitor-pro.js','./manage-pro.css','./manage-pro.js','./mobile-app-ui.css','./mobile-app-ui.js','./adm-justification-review.js','./adm-early-start-ui.js','./reset-cache.html'];
const MODULE_ROOTS=['https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js','https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js','https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js'];
const APP_MAIN_URL=new URL('./index-ADMIN-v8.html',self.location.href).href;
const SCOPE_PATH=new URL('./',self.location.href).pathname;
async function cacheModuleTree(url,cache,seen=new Set()){if(seen.has(url))return;seen.add(url);try{const response=await fetch(url,{mode:'cors'});if(!response.ok)return;await cache.put(url,response.clone());const text=await response.text();const specs=[...text.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)].map(m=>m[1]);await Promise.allSettled(specs.map(spec=>{const next=new URL(spec,url).href;return next.startsWith('https://www.gstatic.com/firebasejs/')?cacheModuleTree(next,cache,seen):Promise.resolve();}));}catch(e){console.warn('Cache de módulo indisponível:',url);}}
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE_NAME);await cache.addAll(APP_SHELL);await Promise.allSettled(MODULE_ROOTS.map(url=>cacheModuleTree(url,cache)));})());self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)));await self.clients.claim();})());});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const url=new URL(event.request.url);const staticCdn=url.hostname==='www.gstatic.com'&&url.pathname.startsWith('/firebasejs/');const sameOrigin=url.origin===self.location.origin;if(!sameOrigin&&!staticCdn)return;
  if(event.request.mode==='navigate'){
    const entradaLegada=sameOrigin&&(url.pathname===SCOPE_PATH||url.pathname===`${SCOPE_PATH}index.html`);
    event.respondWith((async()=>{
      const alvo=entradaLegada?APP_MAIN_URL:event.request;
      try{
        const response=await fetch(alvo,{cache:'no-store'});
        if(response&&response.ok){const cache=await caches.open(CACHE_NAME);await cache.put(alvo,response.clone());}
        return response;
      }catch(e){
        return (await caches.match(alvo))||(await caches.match(APP_MAIN_URL))||(await caches.match('./index.html'));
      }
    })());
    return;
  }
  const isAppAsset=sameOrigin&&(/\.(?:js|css|html)$/.test(url.pathname));
  if(isAppAsset){event.respondWith((async()=>{try{const response=await fetch(event.request,{cache:'no-store'});if(response&&response.ok){const cache=await caches.open(CACHE_NAME);await cache.put(event.request,response.clone());}return response;}catch(e){return caches.match(event.request);}})());return;}
  event.respondWith((async()=>{const cached=await caches.match(event.request);if(cached)return cached;try{const response=await fetch(event.request);if(response&&(response.ok||response.type==='opaque')){const cache=await caches.open(CACHE_NAME);await cache.put(event.request,response.clone());}return response;}catch(e){throw e;}})());
});