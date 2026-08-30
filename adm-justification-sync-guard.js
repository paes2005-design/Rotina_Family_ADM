import {getApps,getApp} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {getFirestore,doc,collection,query,where,getDocFromServer,getDocsFromServer} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const VERSION=5;
const DIRECT_TIMEOUT_MS=5500;
const PENDING_LOGS_KEY='__rfJustificationPendingLogsV1';
let processando=false;
let toastTimer=null;

function log(evento,detalhes={},nivel='info'){
  const payload={...detalhes,justificationSyncGuardVersion:VERSION};
  try{
    if(typeof window.rotinaLog==='function'){window.rotinaLog(evento,payload,nivel);return;}
    const fila=Array.isArray(window[PENDING_LOGS_KEY])?window[PENDING_LOGS_KEY]:[];
    fila.push({evento,detalhes:payload,nivel,registradoEm:new Date().toISOString()});
    window[PENDING_LOGS_KEY]=fila.slice(-40);
  }catch{}
}
function flushPending(){
  if(typeof window.rotinaLog!=='function')return;
  const fila=Array.isArray(window[PENDING_LOGS_KEY])?window[PENDING_LOGS_KEY].splice(0):[];
  for(const item of fila){try{window.rotinaLog(item.evento,item.detalhes,item.nivel);}catch{}}
}
window.addEventListener('rotina-monitoring-ready',flushPending);

function snapshot(){
  try{return typeof window.rotinaAdmCacheSnapshot==='function'?window.rotinaAdmCacheSnapshot():null;}catch{return null;}
}
function grupoAtual(){return String(document.getElementById('displayCodigoCliente')?.textContent||'').trim();}
function dataSelecionada(){return document.getElementById('filtroData')?.value||document.getElementById('monitorData')?.value||'';}
function norm(v=''){return String(v||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}

function contextoDoClique(flag){
  const row=flag.closest?.('tr');
  const c=row?.children||[];
  const inicio=row?.dataset?.familyTaskTime||'';
  const fim=row?.dataset?.familyTaskEnd||'';
  return {
    id:flag.dataset?.taskId||row?.dataset?.familyTaskId||'',
    perfilId:flag.dataset?.profileId||row?.dataset?.familyProfileId||'',
    tarefa:flag.dataset?.taskName||row?.dataset?.familyTaskName||c[1]?.querySelector('strong')?.textContent.trim()||c[1]?.textContent.trim()||'',
    usuario:flag.dataset?.user||row?.dataset?.familyProfileName||c[2]?.textContent.trim()||'',
    dia:flag.dataset?.day||row?.dataset?.familyTaskDay||c[3]?.textContent.trim()||'',
    horario:flag.dataset?.schedule||(inicio&&fim?`${inicio} - ${fim}`:(c[0]?.querySelector('strong')?.textContent.trim()||'')),
    justificativa:flag.dataset?.justification||flag.querySelector?.('.tooltip-texto')?.textContent.trim()||'',
    data:flag.dataset?.date||row?.dataset?.historyDate||dataSelecionada()
  };
}

function localizarNoCache(ctx){
  const snap=snapshot();
  const tarefas=Array.isArray(snap?.tarefas)?snap.tarefas:[];
  const historico=Array.isArray(snap?.historico)?snap.historico:[];
  let tarefa=null;
  if(ctx.id)tarefa=tarefas.find(t=>String(t.id||'')===String(ctx.id))||null;
  if(!tarefa)tarefa=tarefas.find(t=>(!ctx.tarefa||norm(t.nome)===norm(ctx.tarefa))&&(!ctx.usuario||norm(t.perfilNome)===norm(ctx.usuario)))||null;
  if(!tarefa)return {snap,tarefa:null,historico:null};
  const perfilId=tarefa.perfilId||ctx.perfilId||'';
  const h=historico.find(x=>String(x.tarefaId||'')===String(tarefa.id||'')&&String(x.data||x.dataExecucao||'')===String(ctx.data||'')&&(!perfilId||!x.perfilId||String(x.perfilId)===String(perfilId)))||null;
  return {snap,tarefa,historico:h};
}

function toast(texto,autoMs=0){
  let el=document.getElementById('rfJustificationSyncToast');
  if(!el){
    el=document.createElement('div');
    el.id='rfJustificationSyncToast';
    el.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:60000;background:#1e293b;color:#fff;padding:10px 14px;border-radius:10px;box-shadow:0 8px 24px rgba(15,23,42,.25);font:600 12px Segoe UI,Tahoma,sans-serif;max-width:88vw;text-align:center;display:none';
    document.body.appendChild(el);
  }
  if(toastTimer){clearTimeout(toastTimer);toastTimer=null;}
  el.textContent=texto;el.style.display='block';
  if(autoMs>0)toastTimer=setTimeout(()=>{el.style.display='none';toastTimer=null;},autoMs);
}
function esconderToast(){if(toastTimer){clearTimeout(toastTimer);toastTimer=null;}const el=document.getElementById('rfJustificationSyncToast');if(el)el.style.display='none';}

function comTimeout(promise,ms=DIRECT_TIMEOUT_MS){
  return new Promise((resolve,reject)=>{
    let fim=false;
    const timer=setTimeout(()=>{if(fim)return;fim=true;reject(new Error('Tempo limite ao consultar a ocorrência.'));},ms);
    Promise.resolve(promise).then(v=>{if(fim)return;fim=true;clearTimeout(timer);resolve(v);},e=>{if(fim)return;fim=true;clearTimeout(timer);reject(e);});
  });
}

async function buscarOcorrenciaServidor(ctx,cache){
  if(!getApps().length)throw new Error('Firebase ainda não está disponível.');
  const banco=getFirestore(getApp());
  const grupo=grupoAtual();
  let tarefa=cache?.tarefa||null;
  if(!tarefa&&ctx.id){
    const ts=await comTimeout(getDocFromServer(doc(banco,'tarefas',ctx.id)),4000);
    if(ts.exists())tarefa={id:ts.id,...ts.data()};
  }
  if(!tarefa)throw new Error('Não foi possível localizar a tarefa desta justificativa.');

  const perfilId=tarefa.perfilId||ctx.perfilId||'';
  const data=ctx.data||'';
  let historico=null;
  if(perfilId&&data){
    const esperado=`${perfilId}_${tarefa.id}_${data}`;
    try{
      const hs=await comTimeout(getDocFromServer(doc(banco,'historico',esperado)),4000);
      if(hs.exists())historico={id:hs.id,...hs.data()};
    }catch(e){
      if(String(e?.message||'').includes('Tempo limite'))throw e;
    }
  }
  if(!historico){
    const q=query(collection(banco,'historico'),where('grupoId','==',grupo),where('tarefaId','==',tarefa.id));
    const hs=await comTimeout(getDocsFromServer(q),DIRECT_TIMEOUT_MS);
    historico=hs.docs.map(d=>({id:d.id,...d.data()})).find(h=>String(h.data||h.dataExecucao||'')===String(data)&&(!perfilId||!h.perfilId||String(h.perfilId)===String(perfilId)))||null;
  }
  if(!historico)throw new Error('Não encontrei a ocorrência desta justificativa no servidor.');
  return {tarefa,historico};
}

async function garantirModuloRevisao(){
  if(typeof window.abrirRevisaoJustificativa==='function')return true;
  await comTimeout(import('./adm-justification-review.js?v=sync-guard-5'),4000);
  return typeof window.abrirRevisaoJustificativa==='function';
}

async function abrirComDados(ctx,tarefa,historico){
  const moduloOk=await garantirModuloRevisao();
  if(!moduloOk)throw new Error('Módulo de justificativas indisponível.');
  if(!tarefa||!historico)return window.abrirRevisaoJustificativa(ctx);

  const original=window.rotinaAdmCacheSnapshot;
  const wrapper=()=>{
    const base=typeof original==='function'?(original()||{}):{};
    const tarefas=Array.isArray(base.tarefas)?base.tarefas.filter(x=>String(x.id||'')!==String(tarefa.id||'')):[];
    const historicoLista=Array.isArray(base.historico)?base.historico.filter(x=>String(x.id||'')!==String(historico.id||'')):[];
    return {...base,tarefas:[...tarefas,{...tarefa}],historico:[...historicoLista,{...historico}]};
  };
  window.rotinaAdmCacheSnapshot=wrapper;
  try{return await window.abrirRevisaoJustificativa({...ctx,id:tarefa.id,perfilId:tarefa.perfilId||ctx.perfilId||''});}
  finally{if(window.rotinaAdmCacheSnapshot===wrapper)window.rotinaAdmCacheSnapshot=original;}
}

async function tratarClique(flag){
  if(processando){log('justificativa.clique_ignorado',{motivo:'processando'},'warning');return;}
  processando=true;
  const ctx=contextoDoClique(flag);
  const inicio=performance.now();
  log('justificativa.abertura_inicio',{data:ctx.data||'',temId:Boolean(ctx.id)});
  try{
    const cache=localizarNoCache(ctx);
    if(cache.tarefa&&cache.historico){
      log('justificativa.cache_hit',{data:ctx.data||'',temId:Boolean(ctx.id)});
      esconderToast();
      await abrirComDados(ctx,cache.tarefa,cache.historico);
      log('justificativa.abertura_ok',{origem:'cache',tempoMs:Math.round(performance.now()-inicio)});
      return;
    }
    log('justificativa.cache_miss',{temTarefaCache:Boolean(cache.tarefa),temHistoricoCache:Boolean(cache.historico)},'warning');
    if(navigator.onLine===false){
      esconderToast();
      await abrirComDados(ctx,cache.tarefa,cache.historico);
      log('justificativa.abertura_offline',{tempoMs:Math.round(performance.now()-inicio)},'warning');
      return;
    }

    toast('Buscando esta justificativa no servidor…',6500);
    log('justificativa.leitura_direta_inicio',{temTarefaCache:Boolean(cache.tarefa),temHistoricoCache:Boolean(cache.historico)});
    const dados=await buscarOcorrenciaServidor(ctx,cache);
    log('justificativa.leitura_direta_ok',{temTarefa:Boolean(dados.tarefa),temHistorico:Boolean(dados.historico),tempoMs:Math.round(performance.now()-inicio)});
    esconderToast();
    await abrirComDados(ctx,dados.tarefa,dados.historico);
    log('justificativa.abertura_ok',{origem:'servidor-direto',tempoMs:Math.round(performance.now()-inicio)});
  }catch(e){
    console.error('Falha ao abrir justificativa:',e);
    toast(e?.message||'Não foi possível abrir esta justificativa.',3500);
    log('justificativa.abertura_erro',{mensagem:String(e?.message||e).slice(0,140),tempoMs:Math.round(performance.now()-inicio)},'error');
  }finally{processando=false;flushPending();}
}

document.addEventListener('click',event=>{
  const flag=event.target.closest?.('.tooltip-justificativa,.mon-just-flag');
  if(!flag)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  tratarClique(flag);
},true);

log('justificativa.sync_guard_pronto',{versao:VERSION});
flushPending();
