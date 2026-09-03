(function(){
'use strict';

const VERSION='sprint2-data-store-v1';
const SYNC_MS=5*60*1000;
const $=id=>document.getElementById(id);
const clean=v=>String(v??'').trim();

let db=null,fs=null,app=null,timer=null,syncing=null,installed=false,liveGroup='';
let liveUnsubs=[];
let data={groupId:'',taskDocs:[],history:[],executions:[],alarms:[],lastServerSync:0,lastLiveSync:0,lastLocalSync:0,origin:'empty',version:VERSION};

function groupId(){return clean($('topGroup')?.textContent).replace(/^Grupo\s+/i,'').toUpperCase()}
function copy(list){return (list||[]).map(x=>({...x}))}
function reset(g=''){data={groupId:g,taskDocs:[],history:[],executions:[],alarms:[],lastServerSync:0,lastLiveSync:0,lastLocalSync:0,origin:'reset',version:VERSION}}
function snapshot(){return{...data,taskDocs:copy(data.taskDocs),history:copy(data.history),executions:copy(data.executions),alarms:copy(data.alarms)}}
function publish(origin,server=false,failures=0){data.origin=origin;if(server&&failures===0)data.lastServerSync=Date.now();else if(!server)data.lastLocalSync=Date.now();window.dispatchEvent(new CustomEvent('rotina-sprint2-cache-updated',{detail:{groupId:data.groupId,origin,server,failures,lastServerSync:data.lastServerSync,lastLiveSync:data.lastLiveSync,version:VERSION}}))}

function stopLive(){
  for(const unsub of liveUnsubs.splice(0)){try{unsub()}catch(_){ }}
  liveGroup='';
}
function publishLive(origin,key,snap){
  data[key]=snap.docs.map(d=>({id:d.id,...d.data()}));
  data.groupId=groupId();data.origin=origin;data.lastLocalSync=Date.now();
  const fromCache=!!snap.metadata?.fromCache;if(!fromCache)data.lastLiveSync=Date.now();
  window.dispatchEvent(new CustomEvent('rotina-sprint2-cache-updated',{detail:{groupId:data.groupId,origin,server:!fromCache,live:true,failures:0,lastServerSync:data.lastServerSync,lastLiveSync:data.lastLiveSync,version:VERSION}}));
}
function startLive(){
  const g=groupId();if(!g||g==='SISTEMA'||!fs||!db)return false;
  if(liveGroup===g&&liveUnsubs.length===2)return true;
  stopLive();liveGroup=g;
  const bind=(collectionName,key)=>{
    const q=fs.query(fs.collection(db,collectionName),fs.where('grupoId','==',g));
    const unsub=fs.onSnapshot(q,{includeMetadataChanges:false},snap=>publishLive(`live-${collectionName}`,key,snap),err=>console.warn(`Sprint 2 live ${collectionName}:`,err));
    liveUnsubs.push(unsub);
  };
  bind('historico','history');bind('execucoes','executions');
  return true;
}

function seedFromLogin(){
  const base=window.rotinaSprint2BaseSnapshot?.();
  const g=groupId();
  if(!base||!g||clean(base.groupId).toUpperCase()!==g)return false;
  if(data.groupId!==g)reset(g);
  data.taskDocs=copy(base.taskDocs);
  data.history=copy(base.history);
  data.lastServerSync=Math.max(data.lastServerSync,Number(base.lastLoadedAt)||0);
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

async function queryGroup(collectionName,server=true){
  const g=groupId();
  if(!g)throw new Error('Grupo não identificado');
  const q=fs.query(fs.collection(db,collectionName),fs.where('grupoId','==',g));
  const snap=server?await fs.getDocsFromServer(q):await fs.getDocsFromCache(q);
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}

async function supplementInitial(){
  const g=groupId();if(!g||g==='SISTEMA')return false;
  if(syncing)return syncing;
  syncing=(async()=>{
    if(!await firebaseReady())return false;
    const seeded=seedFromLogin();
    startLive();
    if(!seeded)return fullSync('store-inicial-completo',true,true);
    const results=await Promise.allSettled([queryGroup('despertadores',true)]);
    if(results[0].status==='fulfilled')data.alarms=results[0].value;
    const failures=results.filter(x=>x.status==='rejected').length;
    publish('store-inicial-complementar',true,failures);
    return failures===0;
  })();
  try{return await syncing}finally{syncing=null}
}

async function fullSync(origin='store-intervalo-5min',server=true,insideInitial=false){
  const g=groupId();if(!g||g==='SISTEMA')return false;
  if(syncing&&!insideInitial)return syncing;
  const run=async()=>{
    if(!await firebaseReady())return false;
    if(data.groupId!==g)reset(g);
    const live=startLive();
    const reconcileAll=insideInitial||/manual|inicial-completo/.test(origin)||!live;
    const names=reconcileAll?['tarefas','historico','execucoes','despertadores']:['tarefas','despertadores'];
    const results=await Promise.allSettled(names.map(c=>queryGroup(c,server)));
    results.forEach((r,i)=>{if(r.status!=='fulfilled')return;const name=names[i];if(name==='tarefas')data.taskDocs=r.value;else if(name==='historico')data.history=r.value;else if(name==='execucoes')data.executions=r.value;else if(name==='despertadores')data.alarms=r.value});
    const failures=results.filter(x=>x.status==='rejected').length;
    publish(origin,server,failures);
    return failures===0;
  };
  if(insideInitial)return run();
  syncing=run();
  try{return await syncing}finally{syncing=null}
}

async function ensure(){
  const g=groupId();if(!g||g==='SISTEMA')return false;
  if(data.groupId!==g||(!data.taskDocs.length&&!data.history.length&&!data.executions.length))return supplementInitial();
  if(await firebaseReady())startLive();
  return true;
}
function schedule(){
  if(timer)return;
  timer=setInterval(()=>{if(!document.hidden&&document.body.classList.contains('rf-auth-ready'))fullSync('store-intervalo-5min',true).catch(()=>{})},SYNC_MS);
}
function install(){
  if(installed)return;installed=true;
  window.rotinaSprint2DataSnapshot=snapshot;
  window.rotinaSprint2EnsureData=ensure;
  window.rotinaSprint2SyncNow=(origin='manual')=>fullSync(origin,true);
  window.rotinaSprint2SyncLocal=(origin='acao-local-cache')=>fullSync(origin,false);
  schedule();
  const start=()=>{if(document.body.classList.contains('rf-auth-ready'))setTimeout(()=>ensure().catch(()=>{}),0);else stopLive()};
  const bodyObserver=new MutationObserver(start);bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
  const top=$('topGroup');if(top)new MutationObserver(()=>{const g=groupId();if(g&&g!==data.groupId){stopLive();reset(g);setTimeout(()=>ensure().catch(()=>{}),0)}}).observe(top,{childList:true,subtree:true,characterData:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&document.body.classList.contains('rf-auth-ready')&&Date.now()-data.lastServerSync>=SYNC_MS)fullSync('store-retorno-visivel-stale',true).catch(()=>{})});
  window.addEventListener('online',()=>{if(document.body.classList.contains('rf-auth-ready')&&Date.now()-data.lastServerSync>=SYNC_MS)fullSync('store-reconectado-stale',true).catch(()=>{})});
  start();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();