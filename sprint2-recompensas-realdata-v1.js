(function(){
'use strict';

const VERSION='recompensas-realdata-v1.3-production-ui';
const PAGE='sprint2-integracao-recompensas-v1.html';
const APP_VERSION='2.0.0';
const APP_BUILD='20260905.4';
const $=id=>document.getElementById(id);
const clean=v=>String(v??'').trim();
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let db=null,fs=null,app=null,busy=false,editing='';
let rewards=[],redemptions=[],profiles=[];
let period='day';

function groupId(){return clean($('topGroup')?.textContent).replace(/^Grupo\s+/i,'').toUpperCase()}
function session(){return window.rotinaSprint2SessionSnapshot?.()||{role:'',groupId:groupId()}}
function canWrite(){return ['adm_familia','adm_convidado','master'].includes(clean(session().role))}
function snapshot(){return window.rotinaSprint2DataSnapshot?.()||{rewards:[],redemptions:[],profiles:[],readyGroup:''}}
function toast(msg){if(window.RF_APP?.toast)return window.RF_APP.toast(msg);const e=$('toast');if(!e)return;e.textContent=msg;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),1900)}
function actionLog(event,details={},level='info'){try{window.techLog?.(`recompensas_v1_${event}`,details,level)}catch(_){}}
function today(){const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
function dateOf(r){return clean(r.data||r.criadoEm||r.decididoEm).slice(0,10)}
function statusOf(r){const s=clean(r.status||'Pendente');return ['Aprovado','Recusado'].includes(s)?s:'Pendente'}
function participantName(r){return clean(r.perfilNome)||clean(profiles.find(p=>p.id===r.perfilId)?.nome)||'Integrante'}
function statusClass(s){return s==='Aprovado'?'rv1-approved':s==='Recusado'?'rv1-refused':'rv1-pending'}
function rewardActive(r){return !r||r.ativa!==false}
function moneylessPoints(v){const n=Number(v)||0;return Number.isInteger(n)?String(n):n.toFixed(1).replace('.',',')}
function sameGroupRecord(x,g){return !clean(x?.grupoId)||clean(x.grupoId).toUpperCase()===g}

async function firebaseReady(){
  if(db&&fs&&app)return true;
  try{
    const appMod=await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    const fsMod=await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
    const named=appMod.getApps().find(x=>x.name==='rotina-sprint2-integracao-realdata');
    if(!named)return false;app=named;fs=fsMod;db=fsMod.getFirestore(named);return true;
  }catch(e){console.warn('Recompensas V1 Firebase:',e);return false}
}
function guardRecord(record){const g=groupId(),ready=clean(snapshot().readyGroup).toUpperCase();return !!g&&ready===g&&record&&sameGroupRecord(record,g)}
function accept(){
  const snap=snapshot(),g=groupId(),ready=clean(snap.readyGroup).toUpperCase();
  if(!g||ready!==g)return false;
  rewards=(snap.rewards||[]).filter(x=>sameGroupRecord(x,g)).map(x=>({...x})).sort((a,b)=>clean(a.nome).localeCompare(clean(b.nome),'pt-BR'));
  redemptions=(snap.redemptions||[]).filter(x=>sameGroupRecord(x,g)).map(x=>({...x})).sort((a,b)=>clean(b.criadoEm).localeCompare(clean(a.criadoEm)));
  profiles=(snap.profiles||[]).filter(x=>sameGroupRecord(x,g)).map(x=>({...x}));
  return true;
}
function inPeriod(date,ref,mode){if(!date)return false;if(mode==='day')return date===ref;const d=new Date(date+'T12:00:00'),r=new Date(ref+'T12:00:00');if(mode==='month')return d.getFullYear()===r.getFullYear()&&d.getMonth()===r.getMonth();const wd=(r.getDay()+6)%7,s=new Date(r);s.setDate(r.getDate()-wd);s.setHours(0,0,0,0);const e=new Date(s);e.setDate(s.getDate()+7);return d>=s&&d<e}

function injectStyle(){if($('rv1Style'))return;const s=document.createElement('style');s.id='rv1Style';s.textContent=`
.rv1-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:13px}.rv1-panel{border:1px solid #e6e8f0;border-radius:15px;background:#fff;overflow:hidden}.rv1-panel-head{padding:14px 15px;background:#faf9fd;border-bottom:1px solid #e6e8f0;display:flex;justify-content:space-between;gap:8px;align-items:center}.rv1-panel-head h3{margin:0;font-size:15px}.rv1-panel-head p{margin:3px 0 0;color:#74798d;font-size:10px}.rv1-toolbar{display:grid;grid-template-columns:1fr auto;gap:8px;padding:10px 14px;border-bottom:1px solid #e6e8f0}.rv1-toolbar input,.rv1-toolbar select,.rv1-field{border:1px solid #dcdde7;border-radius:9px;padding:9px;background:#fff;min-width:0}.rv1-list{display:grid;gap:8px;padding:10px}.rv1-item{border:1px solid #e6e8f0;border-radius:11px;padding:11px;background:#fff}.rv1-row{display:flex;justify-content:space-between;gap:9px;align-items:flex-start}.rv1-name{font-weight:850}.rv1-desc{font-size:10px;color:#72788f;margin-top:3px;line-height:1.4}.rv1-pill{display:inline-block;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:850;white-space:nowrap}.rv1-on{background:#e7f8ef;color:#17744e}.rv1-off{background:#f1f2f5;color:#666b78}.rv1-pending{background:#fff3d7;color:#8b5d00}.rv1-approved{background:#e7f8ef;color:#17744e}.rv1-refused{background:#fff0f0;color:#9a3333}.rv1-actions{display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap;margin-top:9px}.rv1-btn{border:1px solid #ded8f5;background:#fff;color:#6b35df;padding:8px 10px;border-radius:9px;font-weight:800;cursor:pointer}.rv1-btn.danger{color:#b42318;border-color:#f1cccc}.rv1-btn:disabled{opacity:.5;cursor:not-allowed}.rv1-history{margin-top:14px;border:1px solid #e6e8f0;border-radius:15px;background:#fff;overflow:hidden}.rv1-history-head{padding:14px 15px;border-bottom:1px solid #e6e8f0;display:flex;justify-content:space-between;align-items:flex-end;gap:10px}.rv1-filters{display:flex;gap:6px;flex-wrap:wrap}.rv1-filters select,.rv1-filters input{border:1px solid #dcdde7;border-radius:9px;padding:8px;background:#fff}.rv1-meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:8px}.rv1-meta div{background:#faf9fd;border-radius:8px;padding:7px}.rv1-meta small{display:block;color:#72788f;font-size:7px;text-transform:uppercase;font-weight:850}.rv1-meta span{font-size:10px;font-weight:750;overflow-wrap:anywhere}.rv1-edit{display:grid;grid-template-columns:minmax(0,1fr) 100px 110px;gap:7px;align-items:end}.rv1-note{padding:10px 13px;border:1px solid #e1d6fb;background:#faf8ff;color:#554c73;border-radius:11px;font-size:10px;margin-bottom:12px}.rv1-empty{padding:18px;text-align:center;color:#72788f;font-size:11px;border:1px dashed #ddd7ea;border-radius:10px}.rv1-conquest-box{padding:16px;min-height:180px;display:grid;align-content:center;text-align:center;background:linear-gradient(180deg,#fff,#fbf9ff)}.rv1-conquest-box b{font-size:15px}.rv1-conquest-box p{font-size:10px;color:#72788f;line-height:1.5;max-width:390px;margin:7px auto 0}
@media(max-width:900px){.rv1-grid{grid-template-columns:1fr}.rv1-history-head{display:grid}.rv1-filters{display:grid;grid-template-columns:1fr 1fr}.rv1-meta{grid-template-columns:1fr 1fr}.rv1-edit{grid-template-columns:1fr}}
@media(max-width:480px){.rv1-filters,.rv1-meta{grid-template-columns:1fr}.rv1-row{display:grid}.rv1-actions{display:grid;grid-template-columns:1fr 1fr}.rv1-actions button{width:100%}}
`;document.head.appendChild(s)}
function viewHtml(){return `<div class="card"><div class="head"><div><div class="crumb">Recompensas</div><h2>🎁 Recompensas e Conquistas</h2><p>Recompensas, Conquistas e Histórico em um único painel.</p></div><button class="primary" id="rv1New">＋ Nova recompensa</button></div><div class="rv1-grid" style="padding:14px"><section class="rv1-panel"><div class="rv1-panel-head"><div><h3>Recompensas</h3><p>Catálogo do grupo.</p></div><select id="rv1CatalogFilter"><option value="all">Todas</option><option value="active">Ativas</option><option value="inactive">Desativadas</option></select></div><div id="rv1Catalog" class="rv1-list"></div></section><section class="rv1-panel" id="rv1ConquestsPanel"></section></div><section class="rv1-history"><div class="rv1-history-head"><div><h3 style="margin:0">📋 Histórico</h3><p style="margin:4px 0 0;color:#72788f;font-size:10px">Resgates de Recompensas e eventos de Conquistas no mesmo histórico. Pendentes de resgate podem ser aprovados ou recusados.</p></div><div class="rv1-filters"><select id="rv1HistoryType"><option value="all">Tudo</option><option value="reward">Recompensas</option><option value="conquest">Conquistas</option></select><select id="rv1Participant"><option value="all">Todos os participantes</option></select><select id="rv1Status"><option value="all">Todos os status</option><option value="Pendente">Pendente</option><option value="Aprovado">Aprovado</option><option value="Recusado">Recusado</option><option value="Aguardando ADM">Aguardando ADM</option><option value="Validada">Validada</option><option value="Excluída">Excluída</option></select><input id="rv1Date" type="date"><select id="rv1Period"><option value="day">Dia</option><option value="week">Semana</option><option value="month">Mês</option></select><button class="rv1-btn" id="rv1Refresh">↻ Atualizar</button></div></div><div id="rv1History" class="rv1-list"></div></section></div>`}
function ensureView(){const view=$('view-recompensas');if(!view)return false;if(!view.dataset.ready){injectStyle();view.innerHTML=viewHtml();view.dataset.ready='1';$('rv1Date').value=today();bindControls()}return true}
function refreshParticipants(){const el=$('rv1Participant');if(!el)return;const keep=el.value||'all';el.innerHTML='<option value="all">Todos os participantes</option>'+profiles.map(p=>`<option value="${esc(p.id)}">${esc(p.nome||'Integrante')}</option>`).join('');if([...el.options].some(o=>o.value===keep))el.value=keep}
function editor(r){const id=r?.id||'new';return `<div class="rv1-edit"><input class="rv1-field" id="rv1Name-${id}" value="${esc(r?.nome||'')}" placeholder="Nome da recompensa"><input class="rv1-field" id="rv1Points-${id}" type="number" min="1" step="1" value="${Number(r?.pontos)||100}"><select class="rv1-field" id="rv1Active-${id}"><option value="1" ${rewardActive(r)?'selected':''}>Ativa</option><option value="0" ${!rewardActive(r)?'selected':''}>Desativada</option></select></div><div class="rv1-actions"><button class="rv1-btn" data-rv1-save="${esc(id)}">Salvar</button><button class="rv1-btn" data-rv1-cancel>Cancelar</button></div>`}
function renderCatalog(){const box=$('rv1Catalog');if(!box)return;const f=$('rv1CatalogFilter')?.value||'all',rows=rewards.filter(r=>f==='all'||(f==='active'?rewardActive(r):!rewardActive(r)));const draft=editing==='new'?`<article class="rv1-item">${editor(null)}</article>`:'';box.innerHTML=draft+(rows.length?rows.map(r=>editing===r.id?`<article class="rv1-item">${editor(r)}</article>`:`<article class="rv1-item"><div class="rv1-row"><div><div class="rv1-name">🎁 ${esc(r.nome||'Recompensa')}</div><div class="rv1-desc">${moneylessPoints(r.pontos)} pontos</div></div><span class="rv1-pill ${rewardActive(r)?'rv1-on':'rv1-off'}">${rewardActive(r)?'ATIVA':'DESATIVADA'}</span></div><div class="rv1-actions"><button class="rv1-btn" data-rv1-edit="${esc(r.id)}" ${canWrite()?'':'disabled'}>Editar</button><button class="rv1-btn" data-rv1-toggle="${esc(r.id)}" ${canWrite()?'':'disabled'}>${rewardActive(r)?'Desativar':'Ativar'}</button><button class="rv1-btn danger" data-rv1-delete="${esc(r.id)}" ${canWrite()?'':'disabled'}>Excluir</button></div></article>`).join(''):'<div class="rv1-empty">Nenhuma recompensa neste filtro.</div>');bindListButtons()}
function renderHistory(){
  const box=$('rv1History');if(!box)return;refreshParticipants();
  const type=$('rv1HistoryType')?.value||'all',p=$('rv1Participant')?.value||'all',stf=$('rv1Status')?.value||'all',ref=$('rv1Date')?.value||today(),mode=$('rv1Period')?.value||'day';
  const rewardRows=redemptions.map(r=>({id:r.id,type:'reward',perfilId:r.perfilId,perfilNome:participantName(r),title:r.recompensaNome||'Recompensa',status:statusOf(r),date:dateOf(r),created:r.decididoEm||r.criadoEm||'',points:r.pontos,raw:r}));
  const conquestRows=(window.rotinaSprint2ConquestHistoryRows?.()||[]);
  const rows=[...rewardRows,...conquestRows].filter(r=>(type==='all'||r.type===type)&&(p==='all'||r.perfilId===p)&&(stf==='all'||r.status===stf)&&inPeriod(r.date,ref,mode)).sort((a,b)=>clean(b.created||b.date).localeCompare(clean(a.created||a.date)));
  box.innerHTML=rows.length?rows.map(r=>{if(r.type==='conquest')return `<article class="rv1-item"><div class="rv1-row"><div><div class="rv1-name">🏆 ${esc(r.perfilNome||'Integrante')} · ${esc(r.title)}</div></div><span class="rv1-pill rv1-pending">${esc(clean(r.status).toUpperCase())}</span></div><div class="rv1-meta"><div><small>Tipo</small><span>Conquista</span></div><div><small>Data</small><span>${esc(r.date||'—')}</span></div><div><small>Status</small><span>${esc(r.status)}</span></div><div><small>Participante</small><span>${esc(r.perfilNome||'Integrante')}</span></div></div></article>`;const x=r.raw,s=statusOf(x);return `<article class="rv1-item"><div class="rv1-row"><div><div class="rv1-name">${esc(participantName(x))} · ${esc(x.recompensaNome||'Recompensa')}</div></div><span class="rv1-pill ${statusClass(s)}">${esc(s.toUpperCase())}</span></div><div class="rv1-meta"><div><small>Pontos</small><span>${moneylessPoints(x.pontos)}</span></div><div><small>Data</small><span>${esc(dateOf(x)||'—')}</span></div><div><small>Status</small><span>${esc(s)}</span></div><div><small>Participante</small><span>${esc(participantName(x))}</span></div></div>${s==='Pendente'?`<div class="rv1-actions"><button class="rv1-btn" data-rv1-decide="${esc(x.id)}" data-status="Aprovado" ${canWrite()?'':'disabled'}>Aprovar</button><button class="rv1-btn danger" data-rv1-decide="${esc(x.id)}" data-status="Recusado" ${canWrite()?'':'disabled'}>Recusar</button></div>`:''}</article>`}).join(''):'<div class="rv1-empty">Nenhuma movimentação neste período/filtro.</div>';bindHistoryButtons()
}
function render(){if(!ensureView()||!accept())return;renderCatalog();window.rotinaSprint2RenderConquests?.();renderHistory();$('rv1New').disabled=!canWrite()||busy;$('rv1Refresh').disabled=busy;queueProductionUi()}
async function afterWrite(origin){try{await window.rotinaSprint2SyncLocal?.(origin)}catch(_){ }accept();render()}
async function saveReward(id){
  if(busy||!canWrite()||!await firebaseReady())return;
  const original=id==='new'?null:rewards.find(r=>r.id===id);
  if(id!=='new'&&!guardRecord(original))return toast('Recompensa não pertence ao grupo atual.');
  const name=clean($(`rv1Name-${id}`)?.value),points=Number($(`rv1Points-${id}`)?.value),active=$(`rv1Active-${id}`)?.value==='1';
  if(!name||!Number.isFinite(points)||points<=0)return toast('Informe nome e pontos válidos.');
  busy=true;
  try{
    const g=groupId(),now=new Date().toISOString();actionLog('save_start',{editing:id!=='new'});
    if(id==='new'){
      const ref=await fs.addDoc(fs.collection(db,'recompensas'),{grupoId:g,nome:name,pontos:points,ativa:active,criadoEm:now});
      rewards.push({id:ref.id,grupoId:g,nome:name,pontos:points,ativa:active,criadoEm:now});
    }else{
      await fs.updateDoc(fs.doc(db,'recompensas',id),{nome:name,pontos:points,ativa:active,atualizadoEm:now});
      Object.assign(original,{nome:name,pontos:points,ativa:active,atualizadoEm:now});
    }
    editing='';renderCatalog();
    await window.rotinaSprint2SyncLocal?.('recompensas-salvar');accept();render();
    actionLog('save_success',{editing:id!=='new'});toast('Recompensa salva.');
  }catch(e){console.error('Recompensas V1 salvar:',e);actionLog('save_error',{codigo:clean(e?.code)||'erro'},'error');toast('Não foi possível salvar a recompensa.');}
  finally{busy=false;render()}
}
async function toggleReward(id){const r=rewards.find(x=>x.id===id);if(busy||!canWrite()||!guardRecord(r)||!await firebaseReady())return;busy=true;try{await fs.updateDoc(fs.doc(db,'recompensas',id),{ativa:!rewardActive(r),atualizadoEm:new Date().toISOString()});await afterWrite('recompensas-ativacao')}catch(e){console.error(e);toast('Não foi possível alterar a recompensa.')}finally{busy=false;render()}}
async function deleteReward(id){const r=rewards.find(x=>x.id===id);if(busy||!canWrite()||!guardRecord(r)||!await firebaseReady())return;if(!confirm(`Excluir a recompensa "${r.nome||'Recompensa'}"? O histórico de resgates será preservado.`))return;busy=true;try{await fs.deleteDoc(fs.doc(db,'recompensas',id));await afterWrite('recompensas-excluir');toast('Recompensa excluída; histórico preservado.')}catch(e){console.error(e);toast('Não foi possível excluir a recompensa.')}finally{busy=false;render()}}
async function decide(id,status){const r=redemptions.find(x=>x.id===id);if(busy||!canWrite()||!guardRecord(r)||statusOf(r)!=='Pendente'||!['Aprovado','Recusado'].includes(status)||!await firebaseReady())return;busy=true;try{const now=new Date().toISOString();await fs.updateDoc(fs.doc(db,'resgates',id),{status,decididoEm:now,pushClientePendente:true,pushClienteSolicitadoEm:now,pushClienteTentativas:0});await afterWrite('recompensas-decidir-resgate');toast(`Pedido ${status.toLowerCase()}.`)}catch(e){console.error(e);toast('Não foi possível decidir o resgate.')}finally{busy=false;render()}}
function bindListButtons(){const box=$('rv1Catalog');box?.querySelectorAll('[data-rv1-edit]').forEach(b=>b.onclick=()=>{editing=b.dataset.rv1Edit;renderCatalog()});box?.querySelectorAll('[data-rv1-toggle]').forEach(b=>b.onclick=()=>toggleReward(b.dataset.rv1Toggle));box?.querySelectorAll('[data-rv1-delete]').forEach(b=>b.onclick=()=>deleteReward(b.dataset.rv1Delete));box?.querySelectorAll('[data-rv1-save]').forEach(b=>b.onclick=()=>saveReward(b.dataset.rv1Save));box?.querySelectorAll('[data-rv1-cancel]').forEach(b=>b.onclick=()=>{editing='';renderCatalog()})}
function bindHistoryButtons(){const box=$('rv1History');box?.querySelectorAll('[data-rv1-decide]').forEach(b=>b.onclick=()=>decide(b.dataset.rv1Decide,b.dataset.status))}
function bindControls(){if($('view-recompensas').dataset.bound==='1')return;$('view-recompensas').dataset.bound='1';$('rv1New').onclick=()=>{editing='new';renderCatalog()};$('rv1CatalogFilter').onchange=renderCatalog;['rv1HistoryType','rv1Participant','rv1Status','rv1Date','rv1Period'].forEach(id=>$(id).onchange=renderHistory);$('rv1Refresh').onclick=async()=>{if(busy)return;busy=true;render();try{await window.rotinaSprint2SyncNow?.('recompensas-manual');accept();render();toast('Recompensas atualizadas.')}finally{busy=false;render()}}}
function openView(){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-recompensas'));history.replaceState(null,'','#recompensas');ensureView();render();$('mainScroll')?.scrollTo?.({top:0,behavior:'auto'})}

let productionUiQueued=false;
function productionUi(){
  productionUiQueued=false;
  let style=$('rfProductionUiStyle');
  if(!style){style=document.createElement('style');style.id='rfProductionUiStyle';style.textContent='#rfBuildFooter{padding:18px 8px 10px;text-align:center;color:#8a8fa0;font-size:9px;letter-spacing:.02em}#rfBuildFooter b{color:#666d80;font-weight:800}';document.head.appendChild(style)}
  document.querySelectorAll('#view-monitor .integration-note,#view-monitor .monitor-note,#view-monitor .head p,#view-monitor .activepill').forEach(el=>el.remove());
  document.querySelectorAll('#view-recompensas .cq-warning,#view-participantes .pv1-readonly').forEach(el=>{el.style.display='none'});
  document.querySelectorAll('#view-recompensas .rv1-desc').forEach(el=>{const t=clean(el.textContent);if(t==='Evento real de Conquista.'||t==='Pedido real de resgate.')el.remove()});
  document.querySelectorAll('#view-monitor .mv3-source').forEach(el=>el.remove());
  document.querySelectorAll('#view-monitor .monitor-v2-grid>div').forEach(cell=>{const label=cell.querySelector('small');if(clean(label?.textContent).toLowerCase()==='fonte')cell.remove()});
  const pill=$('view-monitor')?.querySelector('.activepill');if(pill)pill.remove();
  const main=$('mainScroll');if(main&&!$('rfBuildFooter')){const footer=document.createElement('footer');footer.id='rfBuildFooter';footer.innerHTML=`Rotina Family ADM · <b>Versão ${APP_VERSION}</b> · Build <b>${APP_BUILD}</b>`;main.appendChild(footer)}
  window.ROTINA_OFFICIAL_BUILD={...(window.ROTINA_OFFICIAL_BUILD||{}),channel:'production',version:APP_BUILD,appVersion:APP_VERSION};
}
function queueProductionUi(){if(productionUiQueued)return;productionUiQueued=true;requestAnimationFrame(productionUi)}
function installProductionUi(){
  queueProductionUi();setTimeout(queueProductionUi,250);setTimeout(queueProductionUi,1200);
  const target=$('mainScroll')||document.body;new MutationObserver(queueProductionUi).observe(target,{childList:true,subtree:true});
}

function install(){ensureView();$('rewardNavButton')?.addEventListener('click',openView);window.addEventListener('rotina-sprint2-cache-updated',()=>{if($('view-recompensas')?.classList.contains('active'))render();queueProductionUi()});document.body.addEventListener('click',e=>{const a=e.target.closest?.('[data-open-recompensas]');if(a)openView()});installProductionUi();if(location.hash==='#recompensas'&&document.body.classList.contains('rf-auth-ready'))setTimeout(openView,0)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();