const VERSION=1;
const SYNC_TIMEOUT_MS=9000;
let processando=false;

const log=(evento,detalhes={},nivel='info')=>{
  try{window.rotinaLog?.(evento,{...detalhes,justificationSyncGuardVersion:VERSION},nivel);}catch{}
};

function snapshot(){
  try{return typeof window.rotinaAdmCacheSnapshot==='function'?window.rotinaAdmCacheSnapshot():null;}catch{return null;}
}

function dataSelecionada(){
  return document.getElementById('filtroData')?.value||document.getElementById('monitorData')?.value||'';
}

function contextoDoClique(flag){
  const row=flag.closest?.('tr');
  const c=row?.children||[];
  const inicio=row?.dataset?.familyTaskTime||'';
  const fim=row?.dataset?.familyTaskEnd||'';
  const schedule=flag.dataset?.schedule||(inicio&&fim?`${inicio} - ${fim}`:(c[0]?.querySelector('strong')?.textContent.trim()||''));
  return {
    id:flag.dataset?.taskId||row?.dataset?.familyTaskId||'',
    perfilId:flag.dataset?.profileId||row?.dataset?.familyProfileId||'',
    tarefa:flag.dataset?.taskName||row?.dataset?.familyTaskName||c[1]?.querySelector('strong')?.textContent.trim()||c[1]?.textContent.trim()||'',
    usuario:flag.dataset?.user||row?.dataset?.familyProfileName||c[2]?.textContent.trim()||'',
    dia:flag.dataset?.day||row?.dataset?.familyTaskDay||c[3]?.textContent.trim()||'',
    horario:schedule,
    justificativa:flag.dataset?.justification||flag.querySelector?.('.tooltip-texto')?.textContent.trim()||'',
    data:flag.dataset?.date||row?.dataset?.historyDate||dataSelecionada()
  };
}

function localizarNoCache(ctx){
  const snap=snapshot();
  if(!snap)return {snap:null,tarefa:null,historico:null};
  const tarefas=Array.isArray(snap.tarefas)?snap.tarefas:[];
  const historico=Array.isArray(snap.historico)?snap.historico:[];
  const norm=v=>String(v||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  let tarefa=null;
  if(ctx.id)tarefa=tarefas.find(t=>String(t.id||'')===String(ctx.id))||null;
  if(!tarefa)tarefa=tarefas.find(t=>(!ctx.tarefa||norm(t.nome)===norm(ctx.tarefa))&&(!ctx.usuario||norm(t.perfilNome)===norm(ctx.usuario)))||null;
  if(!tarefa)return {snap,tarefa:null,historico:null};
  const perfilId=tarefa.perfilId||ctx.perfilId||'';
  const h=historico.find(x=>String(x.tarefaId||'')===String(tarefa.id||'')&&String(x.data||x.dataExecucao||'')===String(ctx.data||'')&&(!perfilId||!x.perfilId||String(x.perfilId)===String(perfilId)))||null;
  return {snap,tarefa,historico:h};
}

function precisaSincronizar(ctx){
  const {snap,tarefa,historico}=localizarNoCache(ctx);
  if(!snap)return {sim:true,motivo:'snapshot-indisponivel'};
  if(!Number(snap.ultimaSincronizacaoServidor||0))return {sim:true,motivo:'sync-inicial-pendente'};
  if(!tarefa)return {sim:true,motivo:'tarefa-ausente'};
  if(!historico)return {sim:true,motivo:'historico-ausente'};
  return {sim:false,motivo:'cache-pronto'};
}

function toast(texto){
  let el=document.getElementById('rfJustificationSyncToast');
  if(!el){
    el=document.createElement('div');
    el.id='rfJustificationSyncToast';
    el.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:60000;background:#1e293b;color:#fff;padding:10px 14px;border-radius:10px;box-shadow:0 8px 24px rgba(15,23,42,.25);font:600 12px Segoe UI,Tahoma,sans-serif;max-width:88vw;text-align:center;display:none';
    document.body.appendChild(el);
  }
  el.textContent=texto;
  el.style.display='block';
  return el;
}
function esconderToast(){const el=document.getElementById('rfJustificationSyncToast');if(el)el.style.display='none';}

function aguardarSincronizacaoServidor(motivo){
  return new Promise(resolve=>{
    const antes=Number(snapshot()?.ultimaSincronizacaoServidor||0);
    let finalizado=false;
    const finalizar=(ok,origem)=>{
      if(finalizado)return;
      finalizado=true;
      clearTimeout(timer);
      window.removeEventListener('rotina-adm-sync-complete',onSync);
      resolve({ok,origem});
    };
    const onSync=ev=>{
      if(ev?.detail?.servidor!==true)return;
      const depois=Number(snapshot()?.ultimaSincronizacaoServidor||0);
      finalizar(dpoisValido(depois,antes),'evento-servidor');
    };
    const dpoisValido=(depois,base)=>depois>base||depois>0;
    window.addEventListener('rotina-adm-sync-complete',onSync);
    const timer=setTimeout(()=>finalizar(false,'timeout'),SYNC_TIMEOUT_MS);
    try{
      if(typeof window.rotinaSincronizarAdmAgora!=='function')return;
      Promise.resolve(window.rotinaSincronizarAdmAgora(motivo)).then(ok=>{
        const depois=Number(snapshot()?.ultimaSincronizacaoServidor||0);
        if(ok===true||dpoisValido(depois,antes))finalizar(true,'chamada-direta');
      }).catch(()=>{});
    }catch{}
  });
}

async function garantirModuloRevisao(){
  if(typeof window.abrirRevisaoJustificativa==='function')return true;
  await import('./adm-justification-review.js?v=sync-guard-1');
  return typeof window.abrirRevisaoJustificativa==='function';
}

async function tratarClique(event,flag){
  if(processando)return;
  processando=true;
  const ctx=contextoDoClique(flag);
  const inicio=performance.now();
  log('justificativa.abertura_inicio',{data:ctx.data||'',temId:Boolean(ctx.id)});
  try{
    const necessidade=precisaSincronizar(ctx);
    if(necessidade.sim){
      log('justificativa.cache_miss',{motivo:necessidade.motivo,data:ctx.data||'',temId:Boolean(ctx.id)},'warning');
      toast('Atualizando a justificativa com o servidor…');
      const resultado=await aguardarSincronizacaoServidor(`justificativa-${necessidade.motivo}`);
      log('justificativa.sync_fallback',{motivo:necessidade.motivo,ok:resultado.ok,origem:resultado.origem,tempoMs:Math.round(performance.now()-inicio)},resultado.ok?'info':'warning');
    }else{
      log('justificativa.cache_hit',{data:ctx.data||'',temId:Boolean(ctx.id)});
    }
    const moduloOk=await garantirModuloRevisao();
    if(!moduloOk)throw new Error('Módulo de justificativas indisponível.');
    esconderToast();
    window.abrirRevisaoJustificativa(ctx);
    log('justificativa.abertura_encaminhada',{data:ctx.data||'',temId:Boolean(ctx.id),tempoMs:Math.round(performance.now()-inicio)});
  }catch(e){
    console.error('Falha ao abrir justificativa com sincronização:',e);
    toast('Não foi possível atualizar a justificativa. Tente novamente.');
    setTimeout(esconderToast,3500);
    log('justificativa.abertura_erro',{mensagem:String(e?.message||e).slice(0,140),tempoMs:Math.round(performance.now()-inicio)},'error');
  }finally{
    processando=false;
  }
}

document.addEventListener('click',event=>{
  const flag=event.target.closest?.('.tooltip-justificativa,.mon-just-flag');
  if(!flag)return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  tratarClique(event,flag);
},true);

log('justificativa.sync_guard_pronto',{versao:VERSION});
