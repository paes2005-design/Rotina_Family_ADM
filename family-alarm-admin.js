import {getApps,getApp} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {addDoc,collection,doc,getFirestore,onSnapshot,query,serverTimestamp,setDoc,where} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import {agendaDaTarefa,dataLocal,semanaInicioISO} from './alarm-date-core.js?v=1';

const KEY_STATE='rotina_family_admin_task_alarms_v3';
const KEY_PENDING='rotina_family_admin_task_alarm_pending_v3';
const KEY_WEEK='rotina_family_admin_task_alarm_week_v1';
let alarmes=ler(KEY_STATE,{}),unsub=null,grupoEscutado='',documentosRemotos=[];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const grupo=()=>{const g=(document.getElementById('displayCodigoCliente')?.textContent||'').trim();return g&&g!=='--'&&g!=='CLI-Gen'?g:''};
function ler(k,p){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v&&typeof v==='object'?v:p}catch{return p}}
function salvar(k,v){localStorage.setItem(k,JSON.stringify(v))}
function chaveDoc(g,p,t){return [g,p,t].map(v=>String(v||'').replaceAll('/','_')).join('__')}
function naSemanaAtual(a,agora=new Date()){const data=/^\d{4}-\d{2}-\d{2}$/.test(a?.dataAgendada||'')?new Date(`${a.dataAgendada}T12:00:00`):null;return !!data&&a.semanaInicio===semanaInicioISO(agora)&&a.semanaInicio===semanaInicioISO(data)}
function filtrarSemana(mapa){const g=grupo();return Object.fromEntries(Object.entries(mapa||{}).filter(([,a])=>naSemanaAtual(a)&&a.grupoId===g))}
function maisNovo(a,b){return Date.parse(a?.atualizadoEm||'')>=Date.parse(b?.atualizadoEm||'')?a:b}
function formatarDataBR(iso){const [a,m,d]=String(iso||'').split('-');return a&&m&&d?`${d}/${m}/${a}`:'data não definida'}

function tarefaDoElemento(el){
  const tarefa={tarefaId:el.dataset.familyTaskId||'',tarefaGrupoId:el.dataset.familyTaskGroup||'',nomeTarefa:el.dataset.familyTaskName||'Tarefa',diaSemana:el.dataset.familyTaskDay||'',dataAgendada:el.dataset.familyTaskDate||'',horaSugeridaInicio:el.dataset.familyTaskTime||'',horaSugeridaFim:el.dataset.familyTaskEnd||'',perfilId:el.dataset.familyProfileId||'',perfilNome:el.dataset.familyProfileName||'Integrante'};
  return {...tarefa,...agendaDaTarefa(tarefa)};
}
function alarmeDaTarefa(id,dataAgendada=''){const a=alarmes[id]||null;return a&&naSemanaAtual(a)&&(!dataAgendada||a.dataAgendada===dataAgendada)?a:null}
function alvoBotao(el){return el.matches('tr')?el.children?.[1]:el.querySelector('.ger-main,.mon-app-main,.mon-app-side')}

function decorarTarefas(){
  escutar();
  document.querySelectorAll('[data-family-task-id]').forEach(el=>{
    const tarefa=tarefaDoElemento(el),alvo=alvoBotao(el);
    if(!tarefa.tarefaId||!tarefa.dataAgendada||!alvo)return;
    el.dataset.familyTaskDate=tarefa.dataAgendada;
    let btn=alvo.querySelector('.family-task-alarm-admin');
    if(!btn){btn=document.createElement('button');btn.type='button';btn.className='family-task-alarm-admin';btn.style.cssText='margin-left:8px;padding:5px 8px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;font-size:16px;line-height:1;cursor:pointer;vertical-align:middle;flex:0 0 auto';btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();abrir(tarefaDoElemento(el))});alvo.appendChild(btn)}
    atualizarBotao(btn,tarefa.tarefaId,tarefa.dataAgendada);
  });
}
function atualizarBotao(btn,id,dataAgendada){const a=alarmeDaTarefa(id,dataAgendada),icone=a?.ativo?'🔒':'🔕',titulo=a?.ativo?`Alarme de ${formatarDataBR(dataAgendada)} ativado pelo ADM`:`Programar alarme para ${formatarDataBR(dataAgendada)}`;if(btn.textContent!==icone)btn.textContent=icone;if(btn.title!==titulo)btn.title=titulo;btn.setAttribute('aria-label',titulo);btn.style.background=a?.ativo?'#fee2e2':'#fff'}
function atualizarBotoes(){document.querySelectorAll('.family-task-alarm-admin').forEach(btn=>{const el=btn.closest('[data-family-task-id]');if(el)atualizarBotao(btn,el.dataset.familyTaskId,el.dataset.familyTaskDate)})}

function abrir(tarefa){
  document.getElementById('familyAlarmAdminPanel')?.remove();tarefa={...tarefa,...agendaDaTarefa(tarefa)};
  const a=alarmeDaTarefa(tarefa.tarefaId,tarefa.dataAgendada),ativo=!!a?.ativo,dataPassada=tarefa.dataAgendada<dataLocal(new Date());
  const selecao=Array.isArray(a?.momentos)&&a.momentos.includes('fim')?(a.momentos.includes('inicio')?'ambos':'fim'):'inicio';
  const m=document.createElement('div');m.id='familyAlarmAdminPanel';m.style.cssText='position:fixed;inset:0;z-index:24000;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;padding:16px';
  m.innerHTML=`<div style="width:min(92vw,460px);background:#fff;border-radius:22px;padding:20px;color:#1f2937"><h2 style="margin:0 0 5px">⏰ ${esc(tarefa.nomeTarefa)}</h2><p style="margin:0 0 14px;color:#64748b"><strong>${esc(tarefa.perfilNome)}</strong> · ${esc(tarefa.diaSemana)}<br><strong>Data: ${esc(formatarDataBR(tarefa.dataAgendada))}</strong> · ${esc(tarefa.horaSugeridaInicio)} às ${esc(tarefa.horaSugeridaFim)}</p><label style="font-weight:800">Quando tocar</label><select id="familyAlarmAdminMoment" ${ativo?'disabled':''} style="width:100%;padding:11px;margin:6px 0 12px;border:1px solid #cbd5e1;border-radius:10px"><option value="inicio" ${selecao==='inicio'?'selected':''}>No início da tarefa</option><option value="fim" ${selecao==='fim'?'selected':''}>No fim da tarefa</option><option value="ambos" ${selecao==='ambos'?'selected':''}>No início e no fim</option></select><div style="padding:12px;border-radius:12px;background:${ativo?'#fee2e2':'#f8fafc'};color:${ativo?'#991b1b':'#475569'};margin-bottom:14px">${ativo?'🔒 <strong>Despertador ativado pelo ADM nesta data.</strong><br><small>O Cliente não pode retirá-lo.</small>':'⚪ Despertador desligado nesta data.'}</div>${dataPassada?'<div style="padding:10px;border-radius:10px;background:#f1f5f9;color:#475569;margin-bottom:12px">Esta data já passou. Não é possível criar um alarme novo nela.</div>':''}<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button id="familyAlarmAdminOn" type="button" style="padding:13px;border:0;border-radius:11px;background:#ef4444;color:#fff;font-weight:900" ${ativo||dataPassada?'disabled':''}>🔒 Ativar</button><button id="familyAlarmAdminOff" type="button" style="padding:13px;border:1px solid #cbd5e1;border-radius:11px;background:#fff;color:#334155;font-weight:900" ${ativo?'':'disabled'}>Retirar</button></div><div id="familyAlarmAdminMsg" style="min-height:18px;margin-top:10px;font-size:12px;color:#64748b"></div><button id="familyAlarmAdminClose" type="button" style="width:100%;margin-top:8px;padding:10px;border:0;background:transparent;color:#475569">Fechar</button></div>`;
  document.body.appendChild(m);const msg=m.querySelector('#familyAlarmAdminMsg'),momentos=()=>{const v=m.querySelector('#familyAlarmAdminMoment').value;return v==='ambos'?['inicio','fim']:[v]};
  m.querySelector('#familyAlarmAdminOn').onclick=()=>comandar({...tarefa,momentos:momentos()},true,msg).then(ok=>{if(ok)m.remove()});
  m.querySelector('#familyAlarmAdminOff').onclick=()=>comandar({...tarefa,momentos:a?.momentos||momentos()},false,msg).then(ok=>{if(ok)m.remove()});
  m.querySelector('#familyAlarmAdminClose').onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove()};
}

function resolverPerfilId(tarefa){if(tarefa.perfilId)return tarefa.perfilId;for(const id of ['filtroIntegrante','filtroExclusaoIntegrante','tarefaResponsavel']){const s=document.getElementById(id),o=s?[...s.options].find(x=>x.value&&x.textContent.trim()===tarefa.perfilNome):null;if(o)return o.value}return ''}
function payloadDaTarefa(tarefa,ativo){const agora=new Date().toISOString(),agenda=agendaDaTarefa(tarefa);return {grupoId:grupo(),perfilId:resolverPerfilId(tarefa),perfilNome:tarefa.perfilNome,tarefaId:tarefa.tarefaId,tarefaGrupoId:tarefa.tarefaGrupoId||'',nomeTarefa:tarefa.nomeTarefa,diaSemana:tarefa.diaSemana,horaSugeridaInicio:tarefa.horaSugeridaInicio,horaSugeridaFim:tarefa.horaSugeridaFim||'',momentos:tarefa.momentos||['inicio'],...agenda,versaoAgenda:3,ativo,origem:'ADM',bloqueado:ativo,atualizadoEm:agora,...(ativo?{acionadoEm:agora,acionadoPor:'ADM'}:{encerradoEm:agora,encerradoPor:'ADM'})}}
function enfileirar(payload){const fila=ler(KEY_PENDING,[]).filter(p=>naSemanaAtual(p));fila.push(payload);salvar(KEY_PENDING,fila.slice(-60))}
async function comandar(tarefa,ativo,msg){const payload=payloadDaTarefa(tarefa,ativo);if(!payload.grupoId||!payload.perfilId||!payload.tarefaId||!payload.dataAgendada){if(msg)msg.textContent='Não foi possível identificar o integrante, a tarefa ou a data.';return false}alarmes[payload.tarefaId]=payload;salvar(KEY_STATE,alarmes);atualizarBotoes();if(!navigator.onLine||!getApps().length){enfileirar(payload);if(msg)msg.textContent='Comando guardado e será sincronizado quando a internet voltar.';return true}try{const db=getFirestore(getApp());await setDoc(doc(db,'despertadores',chaveDoc(payload.grupoId,payload.perfilId,payload.tarefaId)),{...payload,servidorEm:serverTimestamp()},{merge:true});await addDoc(collection(db,'despertadorHistorico'),{...payload,evento:ativo?'ativado-na-data':'retirado-da-data',criadoEm:serverTimestamp()});if(msg)msg.textContent=ativo?'Despertador ativado nesta data.':'Despertador retirado desta data.';return true}catch{enfileirar(payload);if(msg)msg.textContent='Comando guardado para sincronizar depois.';return true}}

async function sincronizarFila(){if(!navigator.onLine||!getApps().length)return;const fila=ler(KEY_PENDING,[]).filter(p=>naSemanaAtual(p));if(!fila.length){salvar(KEY_PENDING,[]);return}const db=getFirestore(getApp()),rest=[];for(const p of fila){try{await setDoc(doc(db,'despertadores',chaveDoc(p.grupoId,p.perfilId,p.tarefaId)),{...p,servidorEm:serverTimestamp()},{merge:true});await addDoc(collection(db,'despertadorHistorico'),{...p,evento:p.ativo?'ativado-na-data':'retirado-da-data',criadoEm:serverTimestamp()})}catch{rest.push(p)}}salvar(KEY_PENDING,rest)}
async function expirarAlarmesRemotos(){if(!navigator.onLine||!getApps().length)return;const agora=new Date().toISOString();for(const item of documentosRemotos){if(!item.dados.ativo||naSemanaAtual(item.dados))continue;try{await setDoc(item.ref,{ativo:false,bloqueado:false,expirado:true,expiradoEm:agora,expiradoPor:'VIRADA_SEMANA',servidorEm:serverTimestamp()},{merge:true})}catch{}}}
function escutar(tentativa=0){const g=grupo();if(!g||!getApps().length){if(tentativa<120)setTimeout(()=>escutar(tentativa+1),100);return}if(unsub&&grupoEscutado===g)return;unsub?.();grupoEscutado=g;const q=query(collection(getFirestore(getApp()),'despertadores'),where('grupoId','==',g));unsub=onSnapshot(q,s=>{const proximos=filtrarSemana(alarmes);documentosRemotos=s.docs.map(d=>({ref:d.ref,dados:{id:d.id,...d.data()}}));documentosRemotos.forEach(item=>{const a=item.dados;if(a.tarefaId&&naSemanaAtual(a))proximos[a.tarefaId]=proximos[a.tarefaId]?maisNovo(proximos[a.tarefaId],a):a});alarmes=proximos;salvar(KEY_STATE,alarmes);expirarAlarmesRemotos();atualizarBotoes()},()=>atualizarBotoes());sincronizarFila()}

function zerarViradaSemana(){const semana=semanaInicioISO(new Date());if(localStorage.getItem(KEY_WEEK)===semana)return false;alarmes=filtrarSemana(alarmes);salvar(KEY_STATE,alarmes);salvar(KEY_PENDING,ler(KEY_PENDING,[]).filter(p=>naSemanaAtual(p)));localStorage.setItem(KEY_WEEK,semana);expirarAlarmesRemotos();atualizarBotoes();window.dispatchEvent(new CustomEvent('rotina-family-alarm-week-reset',{detail:{semanaInicio:semana}}));return true}
function boot(){zerarViradaSemana();decorarTarefas();const alvos=['tbodyExclusao','corpoTabelaMonitor','tbodyMonitor','gerCardsTarefas','monitorNativeCards'];alvos.forEach(id=>{const el=document.getElementById(id);if(el)new MutationObserver(decorarTarefas).observe(el,{childList:true,subtree:true})});setInterval(decorarTarefas,1500);setInterval(zerarViradaSemana,30000)}
window.addEventListener('online',()=>{sincronizarFila();expirarAlarmesRemotos()});document.addEventListener('visibilitychange',()=>{if(!document.hidden){zerarViradaSemana();expirarAlarmesRemotos();decorarTarefas()}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
