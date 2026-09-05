(function(){
'use strict';

const VERSION='sprint2-data-store-v1.3-cache-first-budget';
const SYNC_MS=5*60*1000;
const HOT_NAMES=['perfis','tarefas','execucoes','despertadores','recompensas','resgates','conquistas','conquistaHistorico'];
const FULL_NAMES=['perfis','tarefas','historico','execucoes','despertadores','recompensas','resgates','conquistas','conquistaHistorico'];
const $=id=>document.getElementById(id);
const clean=v=>String(v??'').trim();

let db=null,fs=null,app=null,timer=null,syncing=null,installed=false;
let data={groupId:'',readyGroup:'',profiles:[],taskDocs:[],history:[],executions:[],alarms:[],rewards:[],redemptions:[],conquests:[],conquestEvents:[],lastServerSync:0,lastLocalSync:0,origin:'empty',version:VERSION};

function groupId(){return clean($('topGroup')?.textContent).replace(/^Grupo\s+/i,'').toUpperCase()}
function copy(list){return (list||[]).map(x=>({...x}))}
function conquestAccess(){return ['adm_familia','adm_convidado','master'].includes(clean(window.rotinaSprint2SessionSnapshot?.().role))}
function storageKey(g){return `rf-adm-last-server-sync:${clean(g).toUpperCase()}`}
function storedServerSync(g){try{return Number(localStorage.getItem(storageKey(g)))||0}catch(_){return 0}}
function rememberServerSync(g,at=Date.now()){data.lastServerSync=at;try{localStorage.setItem(storageKey(g),String(at))}catch(_){ }scheduleNext();return at}
function reset(g=''){data={groupId:g,readyGroup:'',profiles:[],taskDocs:[],history:[],executions:[],alarms:[],rewards:[],redemptions:[],conquests:[],conquestEvents:[],lastServerSync:storedServerSync(g),lastLocalSync:0,origin:'reset',version:VERSION}}
function snapshot(){return{...data,profiles:copy(data.profiles),taskDocs:copy(data.taskDocs),history:copy(data.history),executions:copy(data.executions),alarms:copy(data.alarms),rewards:copy(data.rewards),redemptions:copy(data.redemptions),conquests:copy(data.conquests),conquestEvents:copy(data.conquestEvents)}}
function publish(origin,{server=false,failures=0}={}){data.origin=origin;if(server&&failures===0)rememberServerSync(data.groupId);else data.lastLocalSync=Date.now();window.dispatchEvent(new CustomEvent('rotina-sprint2-cache-updated',{detail:{groupId:data.groupId,readyGroup:data.readyGroup,origin,server,failures,lastServerSync:data.lastServerSync,version:VERSION}}))}

function syncNavSelection(route){
  const nav=$('mainNav');if(!nav)return;
  nav.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
  if(route==='monitor')$('monitorNavButton')?.classList.add('active');
  else if(route==='participantes')$('participantNavButton')?.classList.add('active');
  else if(route==='recompensas')$('rewardNavButton')?.classList.add('active');
  else nav.querySelector(`[data-route="${route}"]`)?.classList.add('active');
}
function installNavSelectionGuard(){
  const nav=$('mainNav');if(!nav||nav.dataset.sprint2SingleActive==='1')return;
  nav.dataset.sprint2SingleActive='1';
  nav.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||!nav.contains(button)||button.disabled)return;
    const route=button.id==='monitorNavButton'?'monitor':button.id==='participantNavButton'?'participantes':button.id==='rewardNavButton'?'recompensas':clean(button.dataset.route);
    if(!['inicio','tarefas','monitor','participantes','recompensas'].includes(route))return;
    requestAnimationFrame(()=>syncNavSelection(route));
  },true);
}

function seedFromLogin(){
  const base=window.rotinaSprint2BaseSnapshot?.();
  const g=groupId();
  if(!base||!g||clean(base.groupId).toUpperCase()!==g)return false;
  if(data.groupId!==g)reset(g);
  data.profiles=copy(base.profiles);
  data.taskDocs=copy(base.taskDocs);
  data.history=copy(base.history);
  data.redemptions=copy(base.redemptions||[]);
  data.readyGroup=g;
  data.lastServerSync=Math.max(data.lastServerSync,Number(base.lastLoadedAt)||0,storedServerSync(g));
  data.origin='login-seed';
  return true;
}

async function firebaseReady(){
  if(db&&fs&&app)return true;
  try{
    const appMod=await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    const fsMod=await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
    const named=appMod.getApps().find(x=>x.name==='rotina-sprint2-integracao-realdata');
    if(!named)return false;
    app=named;fs=fsMod;db=fsMod.getFirestore(named);return true;
  }catch(e){console.warn('Sprint 2 data store Firebase:',e);return false}
}

function namesForAccess(names){return conquestAccess()?names:names.filter(n=>n!=='conquistas'&&n!=='conquistaHistorico')}
function assign(name,value){if(name==='perfis')data.profiles=value;else if(name==='tarefas')data.taskDocs=value;else if(name==='historico')data.history=value;else if(name==='execucoes')data.executions=value;else if(name==='despertadores')data.alarms=value;else if(name==='recompensas')data.rewards=value;else if(name==='resgates')data.redemptions=value;else if(name==='conquistas')data.conquests=value;else if(name==='conquistaHistorico')data.conquestEvents=value}
async function queryGroup(collectionName,server=true,expectedGroup=groupId()){
  const g=clean(expectedGroup).toUpperCase();if(!g)throw new Error('Grupo não identificado');
  const q=fs.query(fs.collection(db,collectionName),fs.where('grupoId','==',g));
  const snap=server?await fs.getDocsFromServer(q):await fs.getDocsFromCache(q);
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}
async function syncNames(names,origin,server=true){
  const g=groupId();if(!g||g==='SISTEMA')return false;
  if(!await firebaseReady())return false;
  if(data.groupId!==g)reset(g);
  const selected=namesForAccess(names);
  const results=await Promise.allSettled(selected.map(name=>queryGroup(name,server,g)));
  if(groupId()!==g)return false;
  results.forEach((r,i)=>{if(r.status==='fulfilled')assign(selected[i],r.value)});
  const failures=results.filter(r=>r.status==='rejected').length;
  if(failures===0)data.readyGroup=g;
  publish(origin,{server,failures});
  return failures===0;
}

async function hydrateCache(origin='store-cache-inicial'){
  const g=groupId();if(!g||g==='SISTEMA')return false;
  if(!await firebaseReady())return false;
  seedFromLogin();
  return syncNames(FULL_NAMES,origin,false);
}
async function fullSync(origin='store-manual',includeHistory=true){
  if(syncing)return syncing;
  const run=syncNames(includeHistory?FULL_NAMES:HOT_NAMES,origin,true);
  syncing=run;
  try{return await run}finally{syncing=null}
}
async function hotSync(origin='store-intervalo-5min'){return fullSync(origin,false)}

function scheduleNext(){
  clearTimeout(timer);timer=null;
  if(!document.body?.classList.contains('rf-auth-ready'))return;
  const last=Math.max(data.lastServerSync,storedServerSync(groupId()));
  const delay=Math.max(1000,SYNC_MS-Math.max(0,Date.now()-last));
  timer=setTimeout(()=>{timer=null;if(!document.hidden&&document.body.classList.contains('rf-auth-ready'))hotSync('store-intervalo-5min').catch(()=>{});else scheduleNext()},delay);
}
function markServerActivity(origin='acao-servidor'){
  const g=groupId();if(!g||g==='SISTEMA')return false;
  if(data.groupId!==g)reset(g);
  rememberServerSync(g);
  data.origin=origin;
  window.dispatchEvent(new CustomEvent('rotina-sprint2-server-activity',{detail:{groupId:g,origin,lastServerSync:data.lastServerSync,version:VERSION}}));
  return true;
}
async function localSync(origin='acao-local-cache',markActivity=true){
  const ok=await syncNames(FULL_NAMES,origin,false);
  if(markActivity)markServerActivity(origin);
  return ok;
}
async function ensure(){
  const g=groupId();if(!g||g==='SISTEMA')return false;
  if(data.groupId!==g)reset(g);
  seedFromLogin();
  await hydrateCache('store-cache-inicial');
  const last=Math.max(data.lastServerSync,storedServerSync(g));
  if(!last||Date.now()-last>=SYNC_MS)hotSync('store-servidor-inicial-stale').catch(()=>{});else scheduleNext();
  return data.readyGroup===g;
}

function install(){
  if(installed)return;installed=true;
  installNavSelectionGuard();
  window.rotinaSprint2DataSnapshot=snapshot;
  window.rotinaSprint2EnsureData=ensure;
  window.rotinaSprint2SyncNow=(origin='manual')=>origin==='tarefas-v4-save'?localSync(origin,true):fullSync(origin,true);
  window.rotinaSprint2SyncHot=(origin='manual-hot')=>hotSync(origin);
  window.rotinaSprint2SyncLocal=(origin='acao-local-cache')=>localSync(origin,true);
  window.rotinaSprint2MarkServerActivity=markServerActivity;
  const start=()=>{if(document.body.classList.contains('rf-auth-ready'))setTimeout(()=>ensure().catch(()=>{}),0);else{clearTimeout(timer);timer=null}};
  new MutationObserver(start).observe(document.body,{attributes:true,attributeFilter:['class']});
  const top=$('topGroup');if(top)new MutationObserver(()=>{const g=groupId();if(g&&g!==data.groupId){reset(g);setTimeout(()=>ensure().catch(()=>{}),0)}}).observe(top,{childList:true,subtree:true,characterData:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)return;const stale=Date.now()-Math.max(data.lastServerSync,storedServerSync(groupId()))>=SYNC_MS;if(document.body.classList.contains('rf-auth-ready')&&stale)hotSync('store-retorno-visivel-stale').catch(()=>{});else scheduleNext()});
  window.addEventListener('online',()=>{const stale=Date.now()-Math.max(data.lastServerSync,storedServerSync(groupId()))>=SYNC_MS;if(document.body.classList.contains('rf-auth-ready')&&stale)hotSync('store-reconectado-stale').catch(()=>{});else scheduleNext()});
  start();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();