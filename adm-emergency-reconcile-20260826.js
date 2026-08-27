import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, query, where, getDocsFromServer, writeBatch, doc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const ACTIVE_DATE='2026-08-26';
const ACTIVE_DAY='Quarta';
const VERSION=4;
const AUTO_ENABLED=false;
const OUTAGE_CUTOFF_MINUTE=12*60+10;
let running=false;
let installed=false;

const clean=v=>String(v||'').trim();
const key=g=>`rf_adm_emergency_reconcile_${ACTIVE_DATE}_${clean(g).toUpperCase()}`;
const isFinal=s=>/Prazo|Atrasado/i.test(clean(s));
const hmMinutes=v=>{const m=clean(v).match(/^(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):NaN;};
const localDate=()=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const o={};p.forEach(x=>{if(x.type!=='literal')o[x.type]=x.value});return `${o.year}-${o.month}-${o.day}`;};
const isoAt=(hm,sec=0)=>{const m=clean(hm).match(/^(\d{1,2}):(\d{2})/);if(!m)return'';return new Date(`${ACTIVE_DATE}T${String(m[1]).padStart(2,'0')}:${m[2]}:${String(sec).padStart(2,'0')}-03:00`).toISOString();};
const log=(event,details={},level='info')=>{try{window.rotinaLog?.(event,{...details,reconcileVersion:VERSION},level);}catch{}};

function record(task,taskId,groupId,now){
  const start=clean(task.horaSugeridaInicio),end=clean(task.horaSugeridaFim),points=Number(task.pontosMaximos)||0;
  return {
    grupoId:groupId, perfilId:clean(task.perfilId), perfilNome:clean(task.perfilNome), tarefaId:taskId,
    tarefaGrupoId:clean(task.tarefaGrupoId), nomeTarefa:clean(task.nome), diaSemana:clean(task.diaSemana),
    data:ACTIVE_DATE, dataExecucao:ACTIVE_DATE, horaSugeridaInicio:start, horaSugeridaFim:end,
    horarioInicio:start, horarioTermino:end, inicioExecutadoEm:isoAt(start,0), terminoExecutadoEm:isoAt(end,59),
    tempoLimite:Number(task.tempoLimite)||0, pontosMaximos:points, pontosGanhos:points, pontosOriginais:points,
    percentualAplicado:100, percentualOriginal:100, faixaAtraso:'dentro-limites', status:'No Prazo (100%)',
    toleranciaConsumidaMin:0, toleranciaConsumidaSeg:0, atrasoInicioMin:0, atrasoFimMin:0,
    iniciouComAtraso:false, iniciouAposLimiteFinal:false, inicioAntecipado:false, antecipacaoMin:0,
    motivoInicioAntecipado:'', tipoMotivoInicioAntecipado:'', justificativaAtraso:'', tipoJustificativa:'',
    revisaoStatus:'sem-revisao', justificativaRecusada:false, compensacaoTecnica:true,
    compensacaoTecnicaMotivo:'indisponibilidade_app_2026-08-26', compensacaoTecnicaEm:now.toISOString(), compensacaoTecnicaVersao:2
  };
}

// Mantido apenas para auditoria/manutenção manual. A rotina automática foi
// encerrada após a compensação da indisponibilidade. Mesmo se chamada
// manualmente, nunca alcança tarefas cujo horário terminou após 12:10.
async function reconcile(groupId){
  groupId=clean(groupId).toUpperCase();
  if(running||!groupId||localDate()!==ACTIVE_DATE)return false;
  if(!getApps().length)return false;
  running=true;
  try{
    const db=getFirestore(getApp());
    const snap=await getDocsFromServer(query(collection(db,'tarefas'),where('grupoId','==',groupId)));
    const tasks=snap.docs.map(d=>({id:d.id,...d.data()}));
    const eligible=tasks.filter(t=>{
      if(clean(t.diaSemana)!==ACTIVE_DAY||!clean(t.perfilId)||isFinal(t.status))return false;
      // Nunca fechar uma execução viva. A compensação antiga servia somente
      // para tarefas perdidas durante a pane, não para tarefas iniciadas depois.
      if(clean(t.status)==='Em andamento')return false;
      if(!['','Pendente'].includes(clean(t.status)))return false;
      const start=hmMinutes(t.horaSugeridaInicio);let end=hmMinutes(t.horaSugeridaFim);
      if(!Number.isFinite(start)||!Number.isFinite(end))return false;
      if(end<=start)end+=1440;
      return end<=OUTAGE_CUTOFF_MINUTE;
    });
    if(eligible.length){
      const batch=writeBatch(db),now=new Date();
      for(const t of eligible){
        const r=record(t,t.id,groupId,now);
        batch.update(doc(db,'tarefas',t.id),r);
        batch.set(doc(db,'historico',`${r.perfilId}_${t.id}_${ACTIVE_DATE}`),r,{merge:true});
        batch.set(doc(db,'execucoes',`${ACTIVE_DATE}__${t.id}`),r,{merge:true});
      }
      await batch.commit();
    }
    localStorage.setItem(key(groupId),'1');
    log('emergencia.adm_reconciliacao_manual',{grupoId:groupId,compensadas:eligible.length,data:ACTIVE_DATE});
    return true;
  }catch(error){
    log('emergencia.adm_reconciliacao_erro',{grupoId:groupId,mensagem:clean(error?.message||error)},'error');
    console.error('Reconciliação emergencial ADM:',error);
    return false;
  }finally{
    running=false;
  }
}

function install(){
  if(installed)return;installed=true;
  window.rotinaReconciliarEmergenciaHoje=reconcile;
  window.__rotinaAdmEmergencyAutoEnabled=AUTO_ENABLED;
  // Não há mais listener de rotina-admin-session-ready nem execução por timer.
  // Isso impede a compensação de tocar em tarefas normais da noite.
  log('emergencia.adm_auto_desativada',{data:ACTIVE_DATE,cutoff:'12:10'});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
