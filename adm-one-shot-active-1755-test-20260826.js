import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, query, where, getDocsFromServer, writeBatch, doc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const ACTIVE_DATE='2026-08-26';
const ACTIVE_DAY='Quarta';
const TARGET_START='17:55';
const TARGET_NAME='lara vitoria';
let running=false;
let installed=false;

const clean=v=>String(v||'').trim();
const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const localDate=()=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const o={};p.forEach(x=>{if(x.type!=='literal')o[x.type]=x.value});return `${o.year}-${o.month}-${o.day}`;};
const nowHM=()=>{const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Bahia',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const o={};p.forEach(x=>{if(x.type!=='literal')o[x.type]=x.value});return `${o.hour}:${o.minute}`;};
const groupFromUi=()=>{const v=clean(document.getElementById('displayCodigoCliente')?.textContent).toUpperCase();return /^CLI-\d+$/.test(v)?v:'';};
const key=g=>`rf_adm_one_shot_active_1755_${ACTIVE_DATE}_${clean(g).toUpperCase()}`;

async function run(groupId){
  groupId=clean(groupId).toUpperCase();
  if(running||!groupId||localDate()!==ACTIVE_DATE||!getApps().length)return false;
  if(localStorage.getItem(key(groupId))==='1')return false;
  running=true;
  try{
    const db=getFirestore(getApp());
    const snap=await getDocsFromServer(query(collection(db,'tarefas'),where('grupoId','==',groupId)));
    const tasks=snap.docs.map(d=>({id:d.id,...d.data()}));
    const target=tasks.find(t=>clean(t.diaSemana)===ACTIVE_DAY && norm(t.perfilNome)===TARGET_NAME && clean(t.horaSugeridaInicio)===TARGET_START);
    if(!target){
      localStorage.setItem(key(groupId),'1');
      alert('Teste: não encontrei a tarefa das 17:55 da Lara Vitoria.');
      return false;
    }
    if(clean(target.status)==='Em andamento'){
      localStorage.setItem(key(groupId),'1');
      alert(`Teste pronto: “${clean(target.nome)}” (17:55) já está em andamento.`);
      return true;
    }
    if(/Prazo|Atrasado/i.test(clean(target.status))){
      alert(`A tarefa das 17:55 já está finalizada (${clean(target.status)}). Não alterei o histórico.`);
      localStorage.setItem(key(groupId),'1');
      return false;
    }
    const now=new Date();
    const dados={status:'Em andamento',horarioInicio:nowHM(),inicioExecutadoEm:now.toISOString(),dataExecucao:ACTIVE_DATE,iniciouComAtraso:true,atrasoInicioMin:0,inicioAntecipado:false,antecipacaoMin:0,motivoInicioAntecipado:'',tipoMotivoInicioAntecipado:'',testeTecnicoTravaUnica:true,testeTecnicoTravaUnicaEm:now.toISOString()};
    const batch=writeBatch(db);
    batch.update(doc(db,'tarefas',target.id),dados);
    batch.set(doc(db,'execucoes',`${ACTIVE_DATE}__${target.id}`),{grupoId:groupId,perfilId:clean(target.perfilId),perfilNome:clean(target.perfilNome),tarefaId:target.id,tarefaGrupoId:clean(target.tarefaGrupoId),nomeTarefa:clean(target.nome),data:ACTIVE_DATE,diaSemana:ACTIVE_DAY,horaSugeridaInicio:clean(target.horaSugeridaInicio),horaSugeridaFim:clean(target.horaSugeridaFim),...dados},{merge:true});
    await batch.commit();
    localStorage.setItem(key(groupId),'1');
    alert(`Teste preparado: “${clean(target.nome)}” das 17:55 foi colocada em andamento. Agora abra o Participante e tente iniciar outra tarefa.`);
    setTimeout(()=>location.reload(),600);
    return true;
  }catch(error){
    running=false;
    console.error('Teste 17:55:',error);
    alert('Não foi possível colocar a tarefa das 17:55 em andamento.');
    return false;
  }
}

function schedule(groupId='',delay=600){setTimeout(()=>run(groupId||groupFromUi()),delay);}
function install(){if(installed)return;installed=true;window.addEventListener('rotina-admin-session-ready',e=>schedule(e?.detail?.grupoId||'',350));schedule('',1600);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
