import {getApps,getApp} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {addDoc,collection,doc,getFirestore,onSnapshot,query,serverTimestamp,setDoc,where} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const KEY_STATE='rotina_family_admin_task_alarms_v2';
const KEY_PENDING='rotina_family_admin_task_alarm_pending_v2';
let alarmes=ler(KEY_STATE,{}),unsub=null,grupoEscutado='';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const grupo=()=>{const g=(document.getElementById('displayCodigoCliente')?.textContent||'').trim();return g&&g!=='--'&&g!=='CLI-Gen'?g:''};
function ler(k,p){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v&&typeof v==='object'?v:p}catch{return p}}
function salvar(k,v){localStorage.setItem(k,JSON.stringify(v))}
function chaveDoc(g,p,t){return [g,p,t].map(v=>String(v||'').replaceAll('/','_')).join('__')}
function tarefaDaLinha(row){return {tarefaId:row.dataset.familyTaskId||'',tarefaGrupoId:row.dataset.familyTaskGroup||'',nomeTarefa:row.dataset.familyTaskName||'Tarefa',diaSemana:row.dataset.familyTaskDay||'',horaSugeridaInicio:row.dataset.familyTaskTime||'',perfilId:row.dataset.familyProfileId||'',perfilNome:row.dataset.familyProfileName||'Integrante'}}
function alarmeDaTarefa(id){return alarmes[id]||null}

function decorarTarefas(){
  escutar();
  document.querySelectorAll('tr[data-family-task-id]').forEach(row=>{
    const tarefa=tarefaDaLinha(row),celula=row.children?.[1];
    if(!tarefa.tarefaId||!celula)return;
    let btn=celula.querySelector('.family-task-alarm-admin');
    if(!btn){btn=document.createElement('button');btn.type='button';btn.className='family-task-alarm-admin';btn.style.cssText='margin-left:8px;padding:5px 8px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;font-size:16px;line-height:1;cursor:pointer;vertical-align:middle';btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();abrir(tarefaDaLinha(row))});celula.appendChild(btn)}
    atualizarBotao(btn,tarefa.tarefaId);
  });
}
function atualizarBotao(btn,id){const a=alarmeDaTarefa(id),icone=a?.ativo?'🔒':'🔕',titulo=a?.ativo?'Despertador desta tarefa ativado pelo ADM':'Ativar despertador nesta tarefa';if(btn.textContent!==icone)btn.textContent=icone;if(btn.title!==titulo)btn.title=titulo;btn.style.background=a?.ativo?'#fee2e2':'#fff'}
function atualizarBotoes(){document.querySelectorAll('.family-task-alarm-admin').forEach(btn=>{const row=btn.closest('tr[data-family-task-id]');if(row)atualizarBotao(btn,row.dataset.familyTaskId)})}

function abrir(tarefa){
  document.getElementById('familyAlarmAdminPanel')?.remove();const a=alarmeDaTarefa(tarefa.tarefaId),ativo=!!a?.ativo;
  const m=document.createElement('div');m.id='familyAlarmAdminPanel';m.style.cssText='position:fixed;inset:0;z-index:24000;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;padding:16px';
  m.innerHTML=`<div style="width:min(92vw,460px);background:#fff;border-radius:22px;padding:20px;color:#1f2937"><h2 style="margin:0 0 5px">⏰ ${esc(tarefa.nomeTarefa)}</h2><p style="margin:0 0 14px;color:#64748b"><strong>${esc(tarefa.perfilNome)}</strong> · ${esc(tarefa.diaSemana)} às <strong>${esc(tarefa.horaSugeridaInicio)}</strong></p><div style="padding:12px;border-radius:12px;background:${ativo?'#fee2e2':'#f8fafc'};color:${ativo?'#991b1b':'#475569'};margin-bottom:14px">${ativo?'🔒 <strong>Despertador ativado pelo ADM.</strong><br><small>O Cliente não pode retirá-lo.</small>':'⚪ Despertador desligado para esta tarefa.'}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button id="familyAlarmAdminOn" type="button" style="padding:13px;border:0;border-radius:11px;background:#ef4444;color:#fff;font-weight:900" ${ativo?'disabled':''}>🔒 Ativar</button><button id="familyAlarmAdminOff" type="button" style="padding:13px;border:1px solid #cbd5e1;border-radius:11px;background:#fff;color:#334155;font-weight:900" ${ativo?'':'disabled'}>Retirar</button></div><div id="familyAlarmAdminMsg" style="min-height:18px;margin-top:10px;font-size:12px;color:#64748b"></div><button id="familyAlarmAdminClose" type="button" style="width:100%;margin-top:8px;padding:10px;border:0;background:transparent;color:#475569">Fechar</button></div>`;
  document.body.appendChild(m);m.querySelector('#familyAlarmAdminOn').onclick=()=>comandar(tarefa,true,m.querySelector('#familyAlarmAdminMsg')).then(ok=>{if(ok)m.remove()});m.querySelector('#familyAlarmAdminOff').onclick=()=>comandar(tarefa,false,m.querySelector('#familyAlarmAdminMsg')).then(ok=>{if(ok)m.remove()});m.querySelector('#familyAlarmAdminClose').onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove()};
}

function resolverPerfilId(tarefa){if(tarefa.perfilId)return tarefa.perfilId;for(const id of ['filtroIntegrante','filtroExclusaoIntegrante','tarefaResponsavel']){const s=document.getElementById(id),o=s?[...s.options].find(x=>x.value&&x.textContent.trim()===tarefa.perfilNome):null;if(o)return o.value}return ''}
function payloadDaTarefa(tarefa,ativo){const agora=new Date().toISOString();return {grupoId:grupo(),perfilId:resolverPerfilId(tarefa),perfilNome:tarefa.perfilNome,tarefaId:tarefa.tarefaId,tarefaGrupoId:tarefa.tarefaGrupoId||'',nomeTarefa:tarefa.nomeTarefa,diaSemana:tarefa.diaSemana,horaSugeridaInicio:tarefa.horaSugeridaInicio,ativo,origem:'ADM',bloqueado:ativo,atualizadoEm:agora,...(ativo?{acionadoEm:agora,acionadoPor:'ADM'}:{encerradoEm:agora,encerradoPor:'ADM'})}}
function enfileirar(payload){const fila=ler(KEY_PENDING,[]);fila.push(payload);salvar(KEY_PENDING,fila.slice(-60))}
async function comandar(tarefa,ativo,msg){const payload=payloadDaTarefa(tarefa,ativo);if(!payload.grupoId||!payload.perfilId||!payload.tarefaId){if(msg)msg.textContent='Não foi possível identificar o integrante ou a tarefa.';return false}alarmes[payload.tarefaId]=payload;salvar(KEY_STATE,alarmes);atualizarBotoes();if(!navigator.onLine||!getApps().length){enfileirar(payload);if(msg)msg.textContent='Comando guardado e será sincronizado quando a internet voltar.';return true}try{const db=getFirestore(getApp());await setDoc(doc(db,'despertadores',chaveDoc(payload.grupoId,payload.perfilId,payload.tarefaId)),{...payload,servidorEm:serverTimestamp()},{merge:true});await addDoc(collection(db,'despertadorHistorico'),{...payload,evento:ativo?'ativado-na-tarefa':'retirado-da-tarefa',criadoEm:serverTimestamp()});if(msg)msg.textContent=ativo?'Despertador ativado nesta tarefa.':'Despertador retirado.';return true}catch{enfileirar(payload);if(msg)msg.textContent='Comando guardado para sincronizar depois.';return true}}

async function sincronizarFila(){if(!navigator.onLine||!getApps().length)return;const fila=ler(KEY_PENDING,[]);if(!fila.length)return;const db=getFirestore(getApp()),rest=[];for(const p of fila){try{await setDoc(doc(db,'despertadores',chaveDoc(p.grupoId,p.perfilId,p.tarefaId)),{...p,servidorEm:serverTimestamp()},{merge:true});await addDoc(collection(db,'despertadorHistorico'),{...p,evento:p.ativo?'ativado-na-tarefa':'retirado-da-tarefa',criadoEm:serverTimestamp()})}catch{rest.push(p)}}salvar(KEY_PENDING,rest)}
function escutar(tentativa=0){const g=grupo();if(!g||!getApps().length){if(tentativa<120)setTimeout(()=>escutar(tentativa+1),100);return}if(unsub&&grupoEscutado===g)return;unsub?.();grupoEscutado=g;const q=query(collection(getFirestore(getApp()),'despertadores'),where('grupoId','==',g));unsub=onSnapshot(q,s=>{const proximos={...alarmes};s.docs.forEach(d=>{const a={id:d.id,...d.data()};if(a.tarefaId)proximos[a.tarefaId]=a});alarmes=proximos;salvar(KEY_STATE,alarmes);atualizarBotoes()},()=>atualizarBotoes());sincronizarFila()}

function boot(){decorarTarefas();const alvos=['tbodyExclusao','corpoTabelaMonitor'];alvos.forEach(id=>{const el=document.getElementById(id);if(el)new MutationObserver(decorarTarefas).observe(el,{childList:true,subtree:true})});setInterval(decorarTarefas,1500)}
window.addEventListener('online',sincronizarFila);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
