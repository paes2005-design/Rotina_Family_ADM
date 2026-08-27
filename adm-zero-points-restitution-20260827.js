import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, writeBatch, doc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const ACTIVE_DATE='2026-08-27';
const VERSION=1;
let running=false;
let finished=false;
let attempts=0;

const clean=v=>String(v||'').trim();
const localDate=()=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const o={};p.forEach(x=>{if(x.type!=='literal')o[x.type]=x.value});return `${o.year}-${o.month}-${o.day}`;};
const finalStatus=s=>/Prazo|Atrasado/i.test(clean(s));
const log=(event,details={},level='info')=>{try{window.rotinaLog?.(event,{...details,restitutionVersion:VERSION},level);}catch{}};

function snapshot(){
  try{return typeof window.rotinaAdmCacheSnapshot==='function'?window.rotinaAdmCacheSnapshot():null;}catch{return null;}
}

function candidates(snap){
  const history=Array.isArray(snap?.historico)?snap.historico:[];
  return history.filter(h=>{
    const max=Number(h.pontosMaximos)||0;
    const won=Number(h.pontosGanhos)||0;
    return clean(h.data)===ACTIVE_DATE && max>0 && won===0 && finalStatus(h.status) && h.restituicaoTecnica20260827!==true;
  });
}

async function commitChunks(db,groupId,rows,snap){
  const tasks=Array.isArray(snap?.tarefas)?snap.tarefas:[];
  const now=new Date().toISOString();
  let restored=0;
  for(let offset=0;offset<rows.length;offset+=120){
    const batch=writeBatch(db);
    const chunk=rows.slice(offset,offset+120);
    for(const h of chunk){
      const taskId=clean(h.tarefaId);
      const profileId=clean(h.perfilId);
      if(!taskId)continue;
      const t=tasks.find(x=>clean(x.id)===taskId)||{};
      const max=Math.max(Number(h.pontosMaximos)||0,Number(t.pontosMaximos)||0);
      if(max<=0)continue;
      const originalStatus=clean(h.status||t.status);
      const patch={
        pontosGanhos:max,
        pontosOriginais:max,
        percentualAplicado:100,
        percentualOriginal:100,
        faixaAtraso:'restituicao-tecnica',
        status:'No Prazo (100%)',
        compensacaoTecnica:true,
        compensacaoTecnicaMotivo:'instabilidade_app_2026-08-27',
        compensacaoTecnicaEm:now,
        compensacaoTecnicaVersao:3,
        statusAntesCompensacao:originalStatus,
        restituicaoTecnica20260827:true,
        restituicaoTecnicaEm:now
      };
      const histId=clean(h.id)||`${profileId}_${taskId}_${ACTIVE_DATE}`;
      batch.set(doc(db,'historico',histId),patch,{merge:true});
      batch.set(doc(db,'execucoes',`${ACTIVE_DATE}__${taskId}`),patch,{merge:true});
      batch.set(doc(db,'tarefas',taskId),patch,{merge:true});
      restored+=1;
    }
    await batch.commit();
  }
  log('restituicao.zerados_20260827_concluida',{grupoId:groupId,restauradas:restored,data:ACTIVE_DATE});
  return restored;
}

async function run(reason='cache-ready'){
  if(running||finished||localDate()!==ACTIVE_DATE||!getApps().length)return false;
  const snap=snapshot();
  const groupId=clean(snap?.grupoId).toUpperCase();
  if(!groupId||!snap?.ultimaSincronizacaoServidor){
    attempts+=1;
    if(attempts<=12)setTimeout(()=>run('aguardando-cache-servidor'),1000);
    return false;
  }
  running=true;
  try{
    const rows=candidates(snap);
    log('restituicao.zerados_20260827_auditoria',{grupoId:groupId,candidatas:rows.length,data:ACTIVE_DATE,motivo:reason});
    if(!rows.length){finished=true;return true;}
    const db=getFirestore(getApp());
    const restored=await commitChunks(db,groupId,rows,snap);
    finished=true;
    try{await window.rotinaAtualizarAdmCacheLocal?.('restituicao-zerados-20260827');}catch{}
    if(restored>0)alert(`Restituição técnica concluída: ${restored} ocorrência(s) de hoje que estavam zeradas receberam a pontuação integral.`);
    return true;
  }catch(error){
    log('restituicao.zerados_20260827_erro',{mensagem:clean(error?.message||error),data:ACTIVE_DATE},'error');
    console.error('Restituição técnica 27/08:',error);
    return false;
  }finally{running=false;}
}

function install(){
  if(localDate()!==ACTIVE_DATE)return;
  window.rotinaRestituirPontosZeradosHoje=()=>run('manual');
  window.addEventListener('rotina-adm-cache-updated',()=>run('cache-updated'));
  window.addEventListener('rotina-admin-session-ready',()=>setTimeout(()=>run('sessao-pronta'),800));
  setTimeout(()=>run('startup'),1800);
  log('restituicao.zerados_20260827_pronta',{data:ACTIVE_DATE});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
