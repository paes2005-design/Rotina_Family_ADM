const CACHE_NAME='rotina-family-adm-v93-production-20260905.4';
const ROTINA_SW_VERSION='93';
const ROTINA_BUILD_ID='20260905.4';
const APP_MAIN_URL=new URL('./index-ADMIN-v9.html',self.location.href).href;
const ENTRY_URL=new URL('./index.html',self.location.href).href;
const LEGACY_MAIN_PATH=new URL('./index-ADMIN-v8.html',self.location.href).pathname;
const APP_SHELL=[
  './','./index.html','./index-ADMIN-v9.html','./manifest.json?v=20260905.4',
  './icon-administrador-192.png','./icon-administrador-512.png',
  './sprint2-teste-atual.css?v=20260905-hidden-semantic-v1',
  './sprint2-teste-core.js','./sprint2-observability-v1.js','./sprint2-integracao-login-realdata-bridge-v1.js',
  './sprint2-integracao-login-realdata-v1.js?v=20260905-production-clean-v12',
  './sprint2-data-store-v1.js?v=20260905-group-content-v12',
  './sprint2-tarefas-realdata-v2.js?v=20260905-inline-owner-v40',
  './sprint2-participantes-realdata-v1.js',
  './sprint2-recompensas-realdata-v1.js?v=20260905-production-ui-v13',
  './sprint2-conquistas-realdata-v1.js?v=20260903-deadline-v1',
  './sprint2-monitor-realdata-v2.js?v=20260905-monitor-clean-v32',
  './sprint2-master-realdata-v1.js?v=20260905-master-realdata-v13-role-visibility'
];
const MODULE_ROOTS=['https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js','https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js','https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js'];
async function cacheModuleTree(url,cache,seen=new Set()){if(seen.has(url))return;seen.add(url);try{const response=await fetch(url,{mode:'cors',cache:'no-store'});if(!response.ok)return;await cache.put(url,response.clone());const text=await response.text();const specs=[...text.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)].map(m=>m[1]);await Promise.allSettled(specs.map(spec=>{const next=new URL(spec,url).href;return next.startsWith('https://www.gstatic.com/firebasejs/')?cacheModuleTree(next,cache,seen):Promise.resolve();}));}catch(_){}}
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE_NAME);await cache.addAll(APP_SHELL);await Promise.allSettled(MODULE_ROOTS.map(url=>cacheModuleTree(url,cache)));})());self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)));await self.clients.claim();})());});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const url=new URL(event.request.url);const sameOrigin=url.origin===self.location.origin;const staticCdn=url.hostname==='www.gstatic.com'&&url.pathname.startsWith('/firebasejs/');if(!sameOrigin&&!staticCdn)return;if(event.request.mode==='navigate'){if(sameOrigin&&url.pathname===LEGACY_MAIN_PATH){event.respondWith(Promise.resolve(Response.redirect(new URL('./index-ADMIN-v9.html?release=20260905.4',self.location.href).href,302)));return;}event.respondWith((async()=>{const isEntry=url.href===ENTRY_URL||url.pathname.endsWith('/');const alvo=isEntry?ENTRY_URL:event.request;try{const response=await fetch(alvo,{cache:'no-store'});if(response&&response.ok){const cache=await caches.open(CACHE_NAME);await cache.put(alvo,response.clone());}return response;}catch(_){return (await caches.match(alvo))||(await caches.match(APP_MAIN_URL))||(await caches.match(ENTRY_URL));}})());return;}const isAppAsset=sameOrigin&&(/\.(?:js|css|html|json)$/.test(url.pathname));if(isAppAsset){event.respondWith((async()=>{try{const response=await fetch(event.request,{cache:'no-store'});if(response&&response.ok){const cache=await caches.open(CACHE_NAME);await cache.put(event.request,response.clone());}return response;}catch(_){return caches.match(event.request);}})());return;}event.respondWith((async()=>{const cached=await caches.match(event.request);if(cached)return cached;const response=await fetch(event.request);if(response&&(response.ok||response.type==='opaque')){const cache=await caches.open(CACHE_NAME);await cache.put(event.request,response.clone());}return response;})());});
self.addEventListener('message',event=>{if(event.data?.type!=='ROTINA_GET_BUILD_INFO')return;event.source?.postMessage({type:'ROTINA_BUILD_INFO',token:event.data?.token||'',swVersion:ROTINA_SW_VERSION,build:ROTINA_BUILD_ID,cacheName:CACHE_NAME});});
self.addEventListener('notificationclick',event=>{event.notification.close();const destino=new URL(event.notification.data?.url||'./?abrir=resgates',self.location.href).href;event.waitUntil((async()=>{const janelas=await clients.matchAll({type:'window',includeUncontrolled:true});const aberta=janelas.find(j=>new URL(j.url).origin===self.location.origin);if(aberta){await aberta.focus();if('navigate' in aberta)await aberta.navigate(destino);return;}if(clients.openWindow)await clients.openWindow(destino);})());});