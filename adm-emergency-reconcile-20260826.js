import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, query, where, getDocsFromServer, writeBatch, doc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const ACTIVE_DATE='2026-08-26';
const ACTIVE_DAY='Quarta';
const VERSION=1;
let running=false;
let installed=false;

const clean=v=>String(v||'').trim();
const key=g=>`rf_adm_emergency_reconcile_${ACTIVE_DATE}_${clean(g).toUpperCase()}`;
const isFinal=s=>/Prazo|Atrasado/i.test(clean(s));
const hmMinutes=v=>{const m=clean(v).match(/^(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):NaN;};
const nowMinutes=()=>{const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Bahia',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const o={};p.forEach(x=>{if(x.type!=='literal')o[x.type]=x.value});return Number(o.hour)*60+Number(o.minute);};
const localDate=()=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const o={};p.forEach(x=>{if(x.type!=='literal')o[x.type]=x.value});return `${o.year}-${o.month}-${o.day}`;};
const isoAt=(hm,sec=0)=>{const m=clean(hm).match(/^(\d{1,2}):(\d{2})/);if(!m)return'';return new Date(`${ACTIVE_DATE}T${String(m[1]).padStart(2,'0')}:${m[2]}:${String(sec).padStart(2,'0')}-03:00`).toISOString();};
const log=(event,details={},level='info')=>{try{window.rotinaLog?.(event,{...details,reconcileVersion:VERSION},level);}catch{}};

function groupFromUi(){
  const v=clean(document.getElementById('displayCodigoCliente')?.textContent).toUpperCase();
  return /^CLI-\d+$/.test(v)?v:'';
}

function record(task,taskId,groupId,now){
  const start=clean(task.horaSugeridaInicio),end=clean(task.horaSugeridaFim),points=Number(task.pontosMaximos)||0;
  return {
    grupoId:groupId,
    perfilId:clean(task.perfilId),
    perfilNome:clean(task.perfilNome),
    tarefaId:taskId,
    tarefaGrupoId:clean(task.tarefaGrupoId),
    nomeTarefa:clean(task.nome),
    diaSemana:clean(task.diaSemana),
    data:ACTIVE_DATE,
    dataExecucao:ACTIVE_DATE,
    horaSugeridaInicio:start,
    horaSugeridaFim:end,
    horarioInicio:start,
    horarioTermino:end,
    inicioExecutadoEm:isoAt(start,0),
    terminoExecutadoEm:isoAt(end,59),
    tempoLimite:Number(task.tempoLimite)||0,
    pontosMaximos:points,
    pontosGanhos:points,
    pontosOriginais:points,
    percentualAplicado:100,
    percentualOriginal:100,
    faixaAtraso:'dentro-limites',
    status:'No Prazo (100%)',
    toleranciaConsumidaMin:0,
    toleranciaConsumidaSeg:0,
    atrasoInicioMin:0,
    atrasoFimMin:0,
    iniciouComAtraso:false,
    iniciouAposLimiteFinal:false,
    inicioAntecipado:false,
    antecipacaoMin:0,
    motivoInicioAntecipado:'',
    tipoMotivoInicioAntecipado:'',
    justificativaAtraso:'',
    tipoJustificativa:'',
    revisaoStatus:'sem-revisao',
    justificativaRecusada:false,
    compensacaoTecnica:true,
    compensacaoTecnicaMotivo:'indisponibilidade_app_2026-08-26',
    compensacaoTecnicaEm:now.toISOString(),
    compensacaoTecnicaVersao:2
  };
}

async function reconcile(groupId){
  groupId=clean(groupId).toUpperCase();
  if(running||!groupId||localDate()!==ACTIVE_DATE)return false;
  if(localStorage.getItem(key(groupId))==='1')return false;
  if(!getApps().length)return false;
  running=true;
  try{
    const db=getFirestore(getApp());
    const snap=await getDocsFromServer(query(collection(db,'tarefas'),where('grupoId','==',groupId)));
    const tasks=snap.docs.map(d=>({id:d.id,...d.data()}));
    const activeBefore=tasks.filter(t=>clean(t.status)==='Em andamento').length;
    const current=nowMinutes();
    const eligible=tasks.filter(t=>{
      if(clean(t.diaSemana)!==ACTIVE_DAY)return false;
      if(!clean(t.perfilId))return false;
      if(isFinal(t.status))return false;
      if(!['','Pendente','Em andamento'].includes(clean(t.status)))return false;
      const start=hmMinutes(t.horaSugeridaInicio);let end=hmMinutes(t.horaSugeridaFim);
      if(!Number.isFinite(start)||!Number.isFinite(end))return false;
      if(end<=start)end+=1440;
      return current>end;
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
    log('emergencia.adm_reconciliacao_ok',{grupoId:groupId,ativasAntes:activeBefore,compensadas:eligible.length,data:ACTIVE_DATE});
    alert(`Correção de emergência concluída.\n\n${eligible.length} tarefa(s) vencida(s) foram compensadas.\nTarefas em andamento encontradas antes da correção: ${activeBefore}.\n\nAs tarefas futuras não foram alteradas.`);
    setTimeout(()=>location.reload(),700);
    return true;
  }catch(error){
    running=false;
    log('emergencia.adm_reconciliacao_erro',{grupoId:groupId,mensagem:clean(error?.message||error)},'error');
    console.error('Reconciliação emergencial ADM:',error);
    return false;
  }
}

function schedule(groupId='',delay=500){
  setTimeout(()=>reconcile(groupId||groupFromUi()),delay);
}

function install(){
  if(installed)return;installed=true;
  window.rotinaReconciliarEmergenciaHoje=reconcile;
  window.addEventListener('rotina-admin-session-ready',e=>schedule(e?.detail?.grupoId||'',350));
  schedule('',1400);
  log('emergencia.adm_reconciliacao_pronta',{data:ACTIVE_DATE});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
