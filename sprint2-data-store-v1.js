(function(){
'use strict';

const VERSION='sprint2-data-store-v1';
const SYNC_MS=5*60*1000;
const $=id=>document.getElementById(id);
const clean=v=>String(v??'').trim();

let db=null,fs=null,app=null,timer=null,syncing=null,installed=false;
let data={groupId:'',taskDocs:[],history:[],executions:[],alarms:[],lastServerSync:0,lastLocalSync:0,origin:'empty',version:VERSION};

function groupId(){return clean($('topGroup')?.textContent).replace(/^Grupo\s+/i,'').toUpperCase()}
function copy(list){return (list||[]).map(x=>({...x}))}
function reset(g=''){data={groupId:g,taskDocs:[],history:[],executions:[],alarms:[],lastServerSync:0,lastLocalSync:0,origin:'reset',version:VERSION}}
function snapshot(){return{...data,taskDocs:copy(data.taskDocs),history:copy(data.history),executions:copy(data.executions),alarms:copy(data.alarms)}}
function publish(origin,server=false,failures=0){data.origin=origin;if(server&&failures===0)data.lastServerSync=Date.now();else if(!server)data.lastLocalSync=Date.now();window.dispatchEvent(new CustomEvent('rotina-sprint2-cache-updated',{detail:{groupId:data.groupId,origin,server,failures,lastServerSync:data.lastServerSync,version:VERSION}}))}

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
    if(!seeded)return fullSync('store-inicial-completo',true,true);
    const results=await Promise.allSettled([queryGroup('execucoes',true),queryGroup('despertadores',true)]);
    if(results[0].status==='fulfilled')data.executions=results[0].value;
    if(results[1].status==='fulfilled')data.alarms=results[1].value;
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
    const results=await Promise.allSettled(['tarefas','historico','execucoes','despertadores'].map(c=>queryGroup(c,server)));
    if(results[0].status==='fulfilled')data.taskDocs=results[0].value;
    if(results[1].status==='fulfilled')data.history=results[1].value;
    if(results[2].status==='fulfilled')data.executions=results[2].value;
    if(results[3].status==='fulfilled')data.alarms=results[3].value;
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
  const start=()=>{if(document.body.classList.contains('rf-auth-ready'))setTimeout(()=>ensure().catch(()=>{}),0)};
  const bodyObserver=new MutationObserver(start);bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
  const top=$('topGroup');if(top)new MutationObserver(()=>{const g=groupId();if(g&&g!==data.groupId){reset(g);setTimeout(()=>ensure().catch(()=>{}),0)}}).observe(top,{childList:true,subtree:true,characterData:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&document.body.classList.contains('rf-auth-ready')&&Date.now()-data.lastServerSync>=SYNC_MS)fullSync('store-retorno-visivel-stale',true).catch(()=>{})});
  window.addEventListener('online',()=>{if(document.body.classList.contains('rf-auth-ready')&&Date.now()-data.lastServerSync>=SYNC_MS)fullSync('store-reconectado-stale',true).catch(()=>{})});
  start();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();