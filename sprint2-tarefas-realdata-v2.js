(function(){
'use strict';

const VERSION='tarefas-realdata-v2.7-create-name-fix';
const $=id=>document.getElementById(id);
const clean=v=>String(v??'').trim();
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAYS=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const WEEKDAYS=['Segunda','Terça','Quarta','Quinta','Sexta'];
const ICONS=['🛏️','📚','🧹','🎻','🍴','🗑️','🧼','🪥','🐶','✅'];
let db=null,fs=null,app=null,rows=[],profiles=[],editing='',opened='',busy=false,creating=false;
let participantFilter='all',dayFilter=todayFull(),statusFilter='all',searchFilter='';

function todayFull(){return DAYS[new Date().getDay()]}
function groupId(){return clean($('topGroup')?.textContent).replace(/^Grupo\s+/i,'').toUpperCase()}
function session(){return window.rotinaSprint2SessionSnapshot?.()||{role:'',groupId:groupId()}}
function canWrite(){return ['adm_familia','adm_convidado','master'].includes(clean(session().role))}
function snapshot(){return window.rotinaSprint2DataSnapshot?.()||{profiles:[],taskDocs:[],alarms:[],readyGroup:''}}
function toast(msg){if(window.RF_APP?.toast)return window.RF_APP.toast(msg);const e=$('toast');if(!e)return;e.textContent=msg;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),1800)}
function log(event,details={},level='info'){try{window.techLog?.(`tarefas_v2_${event}`,details,level)}catch(_){}}
function activeDoc(d){return !(d.ativa===false||d.ativo===false||d.active===false||clean(d.status).toLowerCase()==='inativa')}
function profileIdFor(d){if(d.perfilId&&profiles.some(p=>p.id===d.perfilId))return d.perfilId;const p=profiles.find(x=>clean(x.nome).toLowerCase()===clean(d.perfilNome).toLowerCase());return p?.id||''}
function profileName(pid,d){return clean(profiles.find(p=>p.id===pid)?.nome)||clean(d?.perfilNome)||'Integrante'}
function recurrenceKey(d,pid){return d.tarefaGrupoId?`${pid}::${d.tarefaGrupoId}`:`${pid}::legacy::${clean(d.nome)}::${clean(d.horaSugeridaInicio)}::${clean(d.horaSugeridaFim)}::${Number(d.pontosMaximos)||0}::${Number(d.tempoLimite)||0}`}
function sameGroup(d,g){return clean(d?.grupoId).toUpperCase()===g}
function firstText(docs,keys){for(const d of docs)for(const k of keys){const v=clean(d?.[k]);if(v)return v}return ''}
function taskGroupId(docs){return clean(docs.find(d=>d.tarefaGrupoId)?.tarefaGrupoId)}
function activeAlarmsFor(row){
  const snap=snapshot(),g=groupId(),ids=new Set(row.docs.map(d=>d.id)),tg=row.taskGroupId;
  return (snap.alarms||[]).filter(a=>sameGroup(a,g)&&a.ativo!==false&&(ids.has(clean(a.tarefaId))||(tg&&clean(a.tarefaGrupoId)===tg))).sort((a,b)=>clean(a.dataAgendada).localeCompare(clean(b.dataAgendada))||clean(a.horaSugeridaInicio).localeCompare(clean(b.horaSugeridaInicio)));
}
function alarmText(a){
  const when=Array.isArray(a.momentos)&&a.momentos.length?a.momentos.map(x=>x==='inicio'?'início':x==='fim'?'fim':x).join(' e '):'início';
  const date=clean(a.dataAgendada);let dateBr='';
  if(/^\d{4}-\d{2}-\d{2}$/.test(date)){const [y,m,d]=date.split('-');dateBr=`${d}/${m}/${y}`}
  return [clean(a.diaSemana),dateBr,clean(a.horaSugeridaInicio),when].filter(Boolean).join(' • ');
}

async function firebaseReady(){
  if(db&&fs&&app)return true;
  try{
    const appMod=await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    const fsMod=await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
    const named=appMod.getApps().find(x=>x.name==='rotina-sprint2-integracao-realdata');
    if(!named)return false;
    app=named;fs=fsMod;db=fsMod.getFirestore(named);return true;
  }catch(e){console.warn('Tarefas V2 Firebase:',e);return false}
}

function accept(){
  const snap=snapshot(),g=groupId(),ready=clean(snap.readyGroup).toUpperCase();
  if(!g||ready!==g)return false;
  profiles=(snap.profiles||[]).filter(d=>!d.grupoId||sameGroup(d,g)).map(x=>({...x}));
  const docs=(snap.taskDocs||[]).filter(d=>sameGroup(d,g)),map=new Map();
  for(const d of docs){
    const pid=profileIdFor(d);if(!pid)continue;
    const key=recurrenceKey(d,pid);
    if(!map.has(key))map.set(key,{key,pid,docs:[]});
    map.get(key).docs.push({...d});
  }
  rows=[...map.values()].map(gp=>{
    const ds=gp.docs.slice().sort((a,b)=>clean(a.diaSemana).localeCompare(clean(b.diaSemana),'pt-BR')),base=ds[0]||{};
    return {
      key:gp.key,pid:gp.pid,participant:profileName(gp.pid,base),docs:ds,
      taskGroupId:taskGroupId(ds),
      days:[...new Set(ds.map(d=>clean(d.diaSemana)).filter(Boolean))],
      name:clean(base.nome)||'Tarefa',icon:clean(base.icone)||'✅',
      start:clean(base.horaSugeridaInicio),end:clean(base.horaSugeridaFim),
      points:Number(base.pontosMaximos)||0,tolerance:Number(base.tempoLimite)||0,
      active:ds.some(activeDoc),
      observation:firstText(ds,['observacao','observações','observacoes','nota','descricao'])
    };
  }).sort((a,b)=>a.participant.localeCompare(b.participant,'pt-BR')||a.start.localeCompare(b.start)||a.name.localeCompare(b.name,'pt-BR'));
  if(opened&&!rows.some(r=>r.key===opened))opened='';
  if(editing&&!rows.some(r=>r.key===editing))editing='';
  return true;
}

function validTime(start,end){return /^\d{2}:\d{2}$/.test(start)&&/^\d{2}:\d{2}$/.test(end)&&start<end}
function hasConflict(row,start,end){
  const own=new Set(row.docs.map(d=>d.id)),all=snapshot().taskDocs||[];
  for(const d of all){
    if(own.has(d.id)||!sameGroup(d,groupId())||!activeDoc(d))continue;
    const pid=profileIdFor(d);if(pid!==row.pid||!row.days.includes(clean(d.diaSemana)))continue;
    const a=clean(d.horaSugeridaInicio),b=clean(d.horaSugeridaFim);
    if(validTime(a,b)&&start<b&&end>a)return d;
  }
  return null;
}
function draftTargets(){return participantFilter==='all'?profiles.map(p=>p.id):profiles.some(p=>p.id===participantFilter)?[participantFilter]:[]}
function draftParticipantLabel(){const ids=draftTargets();if(participantFilter==='all')return'Todos os participantes';return profileName(ids[0])}
function draftConflict(pid,days,start,end){
  for(const d of snapshot().taskDocs||[]){
    if(!sameGroup(d,groupId())||!activeDoc(d)||profileIdFor(d)!==pid||!days.includes(clean(d.diaSemana)))continue;
    const a=clean(d.horaSugeridaInicio),b=clean(d.horaSugeridaFim);
    if(validTime(a,b)&&start<b&&end>a)return d;
  }
  return null;
}

function injectStyle(){
  if($('tv2Style'))return;
  const s=document.createElement('style');s.id='tv2Style';s.textContent=`
.tv2-card{background:#fff;border:1px solid #e6e8f0;border-radius:18px;overflow:hidden}.tv2-head{padding:18px 20px;border-bottom:1px solid #e6e8f0;display:flex;justify-content:space-between;gap:12px;align-items:flex-end}.tv2-head h2{margin:4px 0;font-size:23px}.tv2-head p{margin:0;color:#72788f;font-size:11px}.tv2-head-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.tv2-primary{border:0;background:linear-gradient(135deg,#6b35df,#8d58ef);color:#fff;padding:10px 14px;border-radius:10px;font-size:11px;font-weight:900;cursor:pointer;white-space:nowrap}.tv2-primary:disabled{opacity:.45;cursor:not-allowed}.tv2-note{font-size:10px;color:#554c73;background:#faf8ff;border:1px solid #e1d6fb;border-radius:10px;padding:9px 11px}.tv2-filters{display:grid;grid-template-columns:minmax(170px,1fr) minmax(170px,1fr) minmax(130px,.7fr) minmax(180px,1fr) auto;gap:8px;padding:12px 16px;background:#fbf9ff;border-bottom:1px solid #e6e8f0;align-items:end}.tv2-field label{display:block;font-size:8px;text-transform:uppercase;font-weight:850;color:#625c7a;margin-bottom:4px}.tv2-field select,.tv2-field input{width:100%;border:1px solid #dcdde7;border-radius:9px;padding:9px;background:#fff}.tv2-refresh,.tv2-btn,.tv2-more{border:1px solid #ded8f5;background:#fff;color:#6b35df;padding:9px 10px;border-radius:9px;font-weight:800;cursor:pointer}.tv2-more{font-size:18px;line-height:1;padding:7px 10px}.tv2-refresh:disabled,.tv2-btn:disabled{opacity:.5;cursor:not-allowed}.tv2-count{padding:9px 16px;color:#72788f;font-size:10px;border-bottom:1px solid #eef0f4}.tv2-tablewrap{overflow:auto}.tv2-table{width:100%;border-collapse:collapse;min-width:780px}.tv2-table th{background:#f7f3ff;color:#514c75;text-transform:uppercase;font-size:9px;text-align:left;padding:10px}.tv2-table td{padding:10px;border-bottom:1px solid #eef0f4;vertical-align:middle;font-size:11px}.tv2-name{display:flex;gap:8px;align-items:center}.tv2-name span{font-size:18px}.tv2-name b{display:block}.tv2-muted{display:block;color:#7b8192;font-size:9px;margin-top:2px}.tv2-pill{display:inline-block;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:850}.tv2-on{background:#e7f8ef;color:#17744e}.tv2-off{background:#f1f2f5;color:#666b78}.tv2-actions{display:flex;gap:6px;justify-content:flex-end;align-items:center}.tv2-edit td,.tv2-create td{background:#fcfbff}.tv2-edit input,.tv2-create input{width:100%;border:1px solid #dcdde7;border-radius:8px;padding:8px;background:#fff}.tv2-create{outline:2px solid rgba(107,53,223,.08);outline-offset:-2px}.tv2-editgrid{display:grid;grid-template-columns:52px minmax(150px,1fr);gap:6px;align-items:center}.tv2-icon-picker{position:relative;width:46px;height:46px;display:inline-grid;place-items:center;border:1px solid #dcdde7;border-radius:12px;background:#fff;cursor:pointer;overflow:hidden}.tv2-icon-picker:hover{border-color:#bca8ee;background:#fbf9ff}.tv2-icon-picker:focus-within{border-color:#6b35df;box-shadow:0 0 0 3px rgba(107,53,223,.12)}.tv2-icon-face{font-size:24px;line-height:1;pointer-events:none}.tv2-icon-chevron{position:absolute;right:4px;bottom:1px;font-size:10px;line-height:1;color:#6b35df;pointer-events:none}.tv2-icon-picker select{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;border:0;padding:0}.tv2-details-row td{padding:0;background:#fbf9ff}.tv2-details{display:grid;grid-template-columns:1.15fr 1fr 1fr;gap:10px;padding:13px 16px;border-bottom:1px solid #e9e5f6}.tv2-detail{background:#fff;border:1px solid #e5e0f3;border-radius:11px;padding:10px}.tv2-detail small{display:block;text-transform:uppercase;font-size:8px;font-weight:900;color:#71698a;margin-bottom:6px}.tv2-detail p{margin:0;color:#454b5f;font-size:10px;line-height:1.45}.tv2-days{display:flex;flex-wrap:wrap;gap:5px}.tv2-day{padding:5px 7px;border-radius:999px;background:#f0eaff;color:#5e32bc;font-size:9px;font-weight:800}.tv2-alarm-line+.tv2-alarm-line{margin-top:4px}.tv2-detail input,.tv2-detail select,.tv2-detail textarea{width:100%;border:1px solid #dcdde7;border-radius:8px;padding:8px;background:#fff}.tv2-detail textarea{min-height:72px;resize:vertical}.tv2-day-choice{border:1px solid #d9d2ef;background:#fff;color:#5e32bc;border-radius:999px;padding:6px 8px;font-size:9px;font-weight:850;cursor:pointer}.tv2-day-choice.on{background:#6b35df;color:#fff;border-color:#6b35df}.tv2-detail-save{margin-top:8px;width:100%}.tv2-mobile{display:none;padding:9px}.tv2-mcard{border:1px solid #e6e8f0;border-radius:13px;padding:12px;background:#fff;margin-bottom:9px}.tv2-mcard.tv2-create{border-color:#cdbdf3;background:#fcfbff}.tv2-mhead{display:flex;justify-content:space-between;gap:8px}.tv2-mgrid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:9px 0}.tv2-mcell{background:#faf9fd;border-radius:9px;padding:8px}.tv2-mcell small{display:block;color:#72788f;font-size:8px;text-transform:uppercase}.tv2-mcell b{display:block;font-size:11px;margin-top:3px}.tv2-medit{display:grid;gap:7px;margin-top:10px}.tv2-medit input{width:100%;border:1px solid #dcdde7;border-radius:8px;padding:9px}.tv2-mdetails{margin-top:9px}.tv2-mdetails .tv2-details{grid-template-columns:1fr;padding:0;border:0}.tv2-empty{padding:22px;text-align:center;color:#72788f;font-size:11px}
@media(max-width:900px){.tv2-filters{grid-template-columns:1fr 1fr}.tv2-tablewrap{display:none}.tv2-mobile{display:block}.tv2-refresh{width:100%}.tv2-head{align-items:flex-start}.tv2-head-actions{justify-content:flex-start}}
@media(max-width:520px){.tv2-head{display:grid}.tv2-head-actions,.tv2-primary{width:100%}.tv2-filters{grid-template-columns:1fr}.tv2-mgrid{grid-template-columns:1fr 1fr}}
`;document.head.appendChild(s);
}
function dayOptions(){const today=todayFull();return `<option value="all">Todos os dias</option>`+DAYS.map(d=>`<option value="${d}">${d===today?'Hoje · ':''}${d}${d==='Sábado'||d==='Domingo'?'':'-feira'}</option>`).join('')}
function viewHtml(){return `<div class="tv2-card"><div class="tv2-head"><div><div class="crumb">Tarefas • agenda real</div><h2>Agenda de tarefas</h2><p>Filtre por participante e dia. A edição altera a recorrência da tarefa sem criar novas escutas no Firebase.</p></div><div class="tv2-head-actions"><div class="tv2-note">Os três pontos abrem Semana, Alarme e Observação da tarefa.</div><button id="tv2Add" class="tv2-primary" ${canWrite()?'':'disabled'}>＋ Nova tarefa</button></div></div><div class="tv2-filters"><div class="tv2-field"><label>Participante</label><select id="tv2Participant"></select></div><div class="tv2-field"><label>Dia</label><select id="tv2Day">${dayOptions()}</select></div><div class="tv2-field"><label>Status</label><select id="tv2Status"><option value="all">Todas</option><option value="active">Ativas</option><option value="inactive">Inativas</option></select></div><div class="tv2-field"><label>Buscar</label><input id="tv2Search" placeholder="Buscar tarefa"></div><button id="tv2Refresh" class="tv2-refresh">↻ Atualizar</button></div><div id="tv2Count" class="tv2-count"></div><div class="tv2-tablewrap"><table class="tv2-table"><thead><tr><th>Tarefa</th><th>Participante</th><th>Dias</th><th>Início</th><th>Fim</th><th>Pontos</th><th>Tolerância</th><th>Status</th><th style="text-align:right">Ações</th></tr></thead><tbody id="tv2Body"></tbody></table></div><div id="tv2Mobile" class="tv2-mobile"></div></div>`}
function ensureView(){const view=$('view-tarefas');if(!view)return false;if(view.dataset.tv2!=='1'){injectStyle();view.innerHTML=viewHtml();view.dataset.tv2='1';bindControls()}return true}
function fillParticipant(){const el=$('tv2Participant');if(!el)return;const keep=participantFilter;el.innerHTML='<option value="all">Todos os participantes</option>'+profiles.slice().sort((a,b)=>clean(a.nome).localeCompare(clean(b.nome),'pt-BR')).map(p=>`<option value="${esc(p.id)}">${esc(p.nome||'Integrante')}</option>`).join('');el.value=[...el.options].some(o=>o.value===keep)?keep:'all';participantFilter=el.value}
function filtered(){const q=searchFilter.toLocaleLowerCase('pt-BR');return rows.filter(r=>(participantFilter==='all'||r.pid===participantFilter)&&(dayFilter==='all'||r.days.includes(dayFilter))&&(statusFilter==='all'||(statusFilter==='active'?r.active:!r.active))&&(!q||r.name.toLocaleLowerCase('pt-BR').includes(q)||r.participant.toLocaleLowerCase('pt-BR').includes(q)))}

function detailToken(key){return encodeURIComponent(key)}
function alarmMode(row){const a=activeAlarmsFor(row)[0];if(!a)return'off';const m=Array.isArray(a.momentos)?a.momentos:[];return m.includes('inicio')&&m.includes('fim')?'both':m.includes('fim')?'end':'start'}
function detailsHtml(r,mobile=false){
  const token=detailToken(r.key),mode=alarmMode(r);
  const week=DAYS.map(d=>`<button type="button" class="tv2-day-choice ${r.days.includes(d)?'on':''}" data-tv2-detail-day="${esc(token)}" data-day="${esc(d)}">${esc(d.slice(0,3))}</button>`).join('');
  return `<div class="${mobile?'tv2-mdetails':''}"><div class="tv2-details"><div class="tv2-detail"><small>Semana</small><div class="tv2-days">${week}</div><span class="tv2-muted">Selecione pelo menos um dia.</span></div><div class="tv2-detail"><small>Alarme</small><select id="tv2-detail-alarm-${esc(token)}"><option value="off" ${mode==='off'?'selected':''}>Desligado</option><option value="start" ${mode==='start'?'selected':''}>No início</option><option value="end" ${mode==='end'?'selected':''}>No fim</option><option value="both" ${mode==='both'?'selected':''}>No início e no fim</option></select><span class="tv2-muted">Usa o despertador oficial da semana atual.</span></div><div class="tv2-detail"><small>Observação</small><textarea id="tv2-detail-note-${esc(token)}" placeholder="Opcional">${esc(r.observation||'')}</textarea><button class="tv2-btn tv2-detail-save" data-tv2-detail-save="${esc(token)}" ${canWrite()?'':'disabled'}>Salvar detalhes</button></div></div></div>`;
}
function selectedDays(token){return [...document.querySelectorAll(`[data-tv2-detail-day="${token}"]`)].filter(b=>b.classList.contains('on')).map(b=>b.dataset.day)}
function mondayOfWeek(){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+(d.getDay()===0?-6:1-d.getDay()));return d}
function isoDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function dateForDay(day){const idx=DAYS.indexOf(day),d=mondayOfWeek();d.setDate(d.getDate()+(idx===0?6:idx-1));return isoDate(d)}
function alarmDocId(g,pid,taskId){return [g,pid,taskId].map(v=>String(v||'').replaceAll('/','_')).join('__')}
function agendaFields(day,start,end){const date=dateForDay(day),mk=t=>`${date}T${t}:00`;return{dataAgendada:date,semanaInicio:isoDate(mondayOfWeek()),inicioEm:mk(start),fimEm:mk(end)}}
function conflictForDay(row,day){const own=new Set(row.docs.map(d=>d.id));for(const d of snapshot().taskDocs||[]){if(own.has(d.id)||!sameGroup(d,groupId())||!activeDoc(d)||profileIdFor(d)!==row.pid||clean(d.diaSemana)!==day)continue;const a=clean(d.horaSugeridaInicio),b=clean(d.horaSugeridaFim);if(validTime(a,b)&&row.start<b&&row.end>a)return d}return null}
async function saveDetails(token){
  const row=rows.find(r=>detailToken(r.key)===token);if(!row||busy||!canWrite()||!await firebaseReady())return;
  const days=selectedDays(token),note=clean($(`tv2-detail-note-${token}`)?.value),mode=$(`tv2-detail-alarm-${token}`)?.value||'off';
  if(!days.length)return toast('Selecione pelo menos um dia da semana.');
  for(const day of days){if(!row.days.includes(day)){const c=conflictForDay(row,day);if(c)return toast(`Conflito em ${day} com "${clean(c.nome)||'outra tarefa'}".`)}}
  if(!row.docs.every(d=>sameGroup(d,groupId())))return toast('A tarefa não pertence ao grupo atual.');
  busy=true;
  try{
    const batch=fs.writeBatch(db),g=groupId(),now=new Date().toISOString(),base=row.docs[0]||{},tg=row.taskGroupId||`tg-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,byDay=new Map(row.docs.map(d=>[clean(d.diaSemana),d])),kept=[];
    for(const d of row.docs){const day=clean(d.diaSemana);if(days.includes(day)){batch.update(fs.doc(db,'tarefas',d.id),{tarefaGrupoId:tg,observacao:note,atualizadoEm:now});kept.push({id:d.id,day})}else{batch.delete(fs.doc(db,'tarefas',d.id));const aid=alarmDocId(g,row.pid,d.id);batch.set(fs.doc(db,'despertadores',aid),{grupoId:g,perfilId:row.pid,tarefaId:d.id,tarefaGrupoId:tg,ativo:false,bloqueado:false,schedulerPendente:true,schedulerVersao:1,schedulerSolicitadoEm:now,encerradoEm:now,encerradoPor:'ADM',atualizadoEm:now},{merge:true})}}
    for(const day of days){if(byDay.has(day))continue;const ref=fs.doc(fs.collection(db,'tarefas'));batch.set(ref,{grupoId:g,nome:row.name,icone:clean(base.icone)||row.icon,perfilNome:clean(base.perfilNome)||row.participant,perfilId:row.pid,tarefaGrupoId:tg,horaSugeridaInicio:row.start,horaSugeridaFim:row.end,diaSemana:day,tempoLimite:row.tolerance,pontosMaximos:row.points,justificativaObrigatoria:base.justificativaObrigatoria===true,observacao:note,status:'Pendente',pontosGanhos:0,horarioInicio:'',horarioTermino:'',criadoEm:now,atualizadoEm:now});kept.push({id:ref.id,day})}
    const momentos=mode==='both'?['inicio','fim']:mode==='end'?['fim']:['inicio'];
    for(const item of kept){const agenda=agendaFields(item.day,row.start,row.end),aid=alarmDocId(g,row.pid,item.id),common={grupoId:g,perfilId:row.pid,perfilNome:row.participant,tarefaId:item.id,tarefaGrupoId:tg,nomeTarefa:row.name,diaSemana:item.day,horaSugeridaInicio:row.start,horaSugeridaFim:row.end,...agenda,versaoAgenda:3,origem:'ADM',schedulerPendente:true,schedulerVersao:1,schedulerSolicitadoEm:now,atualizadoEm:now};batch.set(fs.doc(db,'despertadores',aid),mode==='off'?{...common,ativo:false,bloqueado:false,encerradoEm:now,encerradoPor:'ADM'}:{...common,momentos,ativo:true,bloqueado:true,acionadoEm:now,acionadoPor:'ADM'},{merge:true})}
    await batch.commit();await window.rotinaSprint2SyncLocal?.('tarefas-detalhes-editar-real');accept();render();log('details_save_success',{dias:days.length,alarme:mode!=='off'});toast('Detalhes da tarefa atualizados.');
  }catch(e){console.error('Tarefas V2 detalhes:',e);log('details_save_error',{codigo:clean(e?.code)||'erro'},'error');toast('Não foi possível salvar os detalhes.')}finally{busy=false;render()}
}

function iconOptions(current){return ICONS.map(i=>`<option value="${esc(i)}" ${i===current?'selected':''}>${esc(i)}</option>`).join('')}
function iconPicker(id,current){return `<label class="tv2-icon-picker" title="Trocar ícone"><span class="tv2-icon-face" aria-hidden="true">${esc(current)}</span><select id="${esc(id)}" aria-label="Ícone da tarefa">${iconOptions(current)}</select><span class="tv2-icon-chevron" aria-hidden="true">⌄</span></label>`}
function createDesktop(){return `<tr class="tv2-create"><td><div class="tv2-editgrid">${iconPicker('tv2-new-icon','✅')}<input id="tv2-new-name" value="Nova tarefa" aria-label="Nome da nova tarefa"></div></td><td><b>${esc(draftParticipantLabel())}</b><small class="tv2-muted">${participantFilter==='all'?'Será aplicada a todos':'Participante selecionado'}</small></td><td>${esc(WEEKDAYS.join(', '))}</td><td><input id="tv2-new-start" type="time" value="12:00"></td><td><input id="tv2-new-end" type="time" value="12:15"></td><td><input id="tv2-new-points" type="number" min="0" step="1" value="5"></td><td><input id="tv2-new-tol" type="number" min="0" step="1" value="0"></td><td><span class="tv2-pill tv2-on">ATIVA</span></td><td><div class="tv2-actions"><button class="tv2-btn" data-tv2-create-save>Salvar</button><button class="tv2-btn" data-tv2-create-cancel>Cancelar</button></div></td></tr>`}
function createMobile(){return `<article class="tv2-mcard tv2-create"><div class="tv2-mhead"><div><b>＋ Nova tarefa</b><small class="tv2-muted">${esc(draftParticipantLabel())} · ${esc(WEEKDAYS.join(', '))}</small></div><span class="tv2-pill tv2-on">ATIVA</span></div><div class="tv2-medit">${iconPicker('tv2-m-new-icon','✅')}<input id="tv2-m-new-name" value="Nova tarefa" aria-label="Nome da nova tarefa"><div class="tv2-mgrid"><div><small>Início</small><input id="tv2-m-new-start" type="time" value="12:00"></div><div><small>Fim</small><input id="tv2-m-new-end" type="time" value="12:15"></div><div><small>Pontos</small><input id="tv2-m-new-points" type="number" min="0" value="5"></div><div><small>Tolerância</small><input id="tv2-m-new-tol" type="number" min="0" value="0"></div></div><div class="tv2-actions"><button class="tv2-btn" data-tv2-create-save data-mobile="1">Salvar</button><button class="tv2-btn" data-tv2-create-cancel>Cancelar</button></div></div></article>`}
function editDesktop(r){return `<tr class="tv2-edit"><td><div class="tv2-editgrid">${iconPicker('tv2-icon-'+r.key,r.icon)}<input id="tv2-name-${esc(r.key)}" value="${esc(r.name)}"></div></td><td>${esc(r.participant)}</td><td>${esc(r.days.join(', '))}</td><td><input id="tv2-start-${esc(r.key)}" type="time" value="${esc(r.start)}"></td><td><input id="tv2-end-${esc(r.key)}" type="time" value="${esc(r.end)}"></td><td><input id="tv2-points-${esc(r.key)}" type="number" min="0" step="1" value="${r.points}"></td><td><input id="tv2-tol-${esc(r.key)}" type="number" min="0" step="1" value="${r.tolerance}"></td><td><span class="tv2-pill ${r.active?'tv2-on':'tv2-off'}">${r.active?'ATIVA':'INATIVA'}</span></td><td><div class="tv2-actions"><button class="tv2-btn" data-tv2-save="${esc(r.key)}">Salvar</button><button class="tv2-btn" data-tv2-cancel>Cancelar</button></div></td></tr>`}
function readDesktop(r){
  const main=`<tr><td><div class="tv2-name"><span>${esc(r.icon)}</span><div><b>${esc(r.name)}</b><small class="tv2-muted">${r.docs.length} ocorrência(s) recorrente(s)</small></div></div></td><td>${esc(r.participant)}</td><td>${esc(r.days.join(', '))}</td><td>${esc(r.start||'—')}</td><td>${esc(r.end||'—')}</td><td>${r.points}</td><td>${r.tolerance} min</td><td><span class="tv2-pill ${r.active?'tv2-on':'tv2-off'}">${r.active?'ATIVA':'INATIVA'}</span></td><td><div class="tv2-actions"><button class="tv2-btn" data-tv2-edit="${esc(r.key)}" ${canWrite()?'':'disabled'}>✎ Editar</button><button class="tv2-more" data-tv2-more="${esc(r.key)}" aria-label="Detalhes de ${esc(r.name)}" title="Detalhes">⋮</button></div></td></tr>`;
  return main+(opened===r.key?`<tr class="tv2-details-row"><td colspan="9">${detailsHtml(r)}</td></tr>`:'');
}
function mobileCard(r){
  const e=editing===r.key,o=opened===r.key;
  return `<article class="tv2-mcard"><div class="tv2-mhead"><div class="tv2-name"><span>${esc(r.icon)}</span><div><b>${esc(r.name)}</b><small class="tv2-muted">${esc(r.participant)} · ${esc(r.days.join(', '))}</small></div></div><span class="tv2-pill ${r.active?'tv2-on':'tv2-off'}">${r.active?'ATIVA':'INATIVA'}</span></div>${e?`<div class="tv2-medit">${iconPicker('tv2-m-icon-'+r.key,r.icon)}<input id="tv2-m-name-${esc(r.key)}" value="${esc(r.name)}"><div class="tv2-mgrid"><div><small>Início</small><input id="tv2-m-start-${esc(r.key)}" type="time" value="${esc(r.start)}"></div><div><small>Fim</small><input id="tv2-m-end-${esc(r.key)}" type="time" value="${esc(r.end)}"></div><div><small>Pontos</small><input id="tv2-m-points-${esc(r.key)}" type="number" min="0" value="${r.points}"></div><div><small>Tolerância</small><input id="tv2-m-tol-${esc(r.key)}" type="number" min="0" value="${r.tolerance}"></div></div><div class="tv2-actions"><button class="tv2-btn" data-tv2-save="${esc(r.key)}" data-mobile="1">Salvar</button><button class="tv2-btn" data-tv2-cancel>Cancelar</button></div></div>`:`<div class="tv2-mgrid"><div class="tv2-mcell"><small>Horário</small><b>${esc(r.start)} → ${esc(r.end)}</b></div><div class="tv2-mcell"><small>Pontos / tolerância</small><b>${r.points} pts · ${r.tolerance} min</b></div></div><div class="tv2-actions"><button class="tv2-btn" data-tv2-edit="${esc(r.key)}" ${canWrite()?'':'disabled'}>✎ Editar</button><button class="tv2-more" data-tv2-more="${esc(r.key)}" aria-label="Detalhes de ${esc(r.name)}" title="Detalhes">⋮</button></div>${o?detailsHtml(r,true):''}`}</article>`;
}
function bindRows(){
  const root=$('view-tarefas');
  root?.querySelectorAll('[data-tv2-edit]').forEach(b=>b.onclick=()=>{creating=false;editing=b.dataset.tv2Edit;opened='';render()});
  root?.querySelectorAll('[data-tv2-cancel]').forEach(b=>b.onclick=()=>{editing='';render()});
  root?.querySelectorAll('[data-tv2-save]').forEach(b=>b.onclick=()=>save(b.dataset.tv2Save,b.dataset.mobile==='1'));
  root?.querySelectorAll('[data-tv2-create-save]').forEach(b=>b.onclick=()=>createTask(b.dataset.mobile==='1'));
  root?.querySelectorAll('[data-tv2-create-cancel]').forEach(b=>b.onclick=()=>{creating=false;render()});
  root?.querySelectorAll('.tv2-icon-picker select').forEach(sel=>sel.onchange=()=>{const face=sel.closest('.tv2-icon-picker')?.querySelector('.tv2-icon-face');if(face)face.textContent=sel.value});
  root?.querySelectorAll('[data-tv2-more]').forEach(b=>b.onclick=()=>{opened=opened===b.dataset.tv2More?'':b.dataset.tv2More;log('details_toggle',{aberto:!!opened});render()});
  root?.querySelectorAll('[data-tv2-detail-day]').forEach(b=>b.onclick=()=>b.classList.toggle('on'));
  root?.querySelectorAll('[data-tv2-detail-save]').forEach(b=>b.onclick=()=>saveDetails(b.dataset.tv2DetailSave));
}
function render(){
  if(!ensureView()||!accept())return;
  fillParticipant();$('tv2Day').value=dayFilter;$('tv2Status').value=statusFilter;$('tv2Search').value=searchFilter;
  const list=filtered(),desktopRows=list.length?list.map(r=>editing===r.key?editDesktop(r):readDesktop(r)).join(''):'<tr><td colspan="9" class="tv2-empty">Nenhuma tarefa encontrada neste filtro.</td></tr>',mobileRows=list.length?list.map(mobileCard).join(''):'<div class="tv2-empty">Nenhuma tarefa encontrada neste filtro.</div>';
  $('tv2Count').textContent=`${list.length} tarefa${list.length===1?'':'s'} · ${dayFilter==='all'?'todos os dias':dayFilter}${participantFilter==='all'?'':' · participante selecionado'}`;
  $('tv2Body').innerHTML=(creating?createDesktop():'')+desktopRows;
  $('tv2Mobile').innerHTML=(creating?createMobile():'')+mobileRows;
  $('tv2Refresh').disabled=busy;if($('tv2Add'))$('tv2Add').disabled=busy||creating||!canWrite();bindRows();
}
async function createTask(mobile){
  if(!creating||busy||!canWrite())return;
  if(!await firebaseReady()){log('create_error',{etapa:'firebase_ready',codigo:'firebase-nao-pronto',mensagem:'Aplicativo Firebase da Sprint 2 não disponível.'},'error');return toast('Não foi possível preparar a gravação da tarefa.');}
  const prefix=mobile?'tv2-m-new-':'tv2-new-';
  const icon=clean($(prefix+'icon')?.value),name=clean($(prefix+'name')?.value),start=clean($(prefix+'start')?.value),end=clean($(prefix+'end')?.value),points=Number($(prefix+'points')?.value),tol=Number($(prefix+'tol')?.value),targets=draftTargets(),days=WEEKDAYS.slice();
  if(!targets.length)return toast('Cadastre ou selecione pelo menos um participante.');
  if(!ICONS.includes(icon)||!name||!validTime(start,end)||!Number.isFinite(points)||points<0||!Number.isFinite(tol)||tol<0)return toast('Revise ícone, nome, horários, pontos e tolerância.');
  for(const pid of targets){const conflict=draftConflict(pid,days,start,end);if(conflict)return toast(`Conflito de horário para ${profileName(pid)} com "${clean(conflict.nome)||'outra tarefa'}".`)}
  const g=groupId(),role=clean(session().role);let stage='prepare',committed=false,docs=0;
  busy=true;render();
  try{
    const batch=fs.writeBatch(db),stamp=Date.now();
    for(const pid of targets){
      const participant=profileName(pid),tg=`tg-${stamp}-${Math.random().toString(36).slice(2,8)}`;
      for(const day of days){
        const ref=fs.doc(fs.collection(db,'tarefas'));
        batch.set(ref,{grupoId:g,nome:name,icone:icon,perfilNome:participant,perfilId:pid,tarefaGrupoId:tg,horaSugeridaInicio:start,horaSugeridaFim:end,diaSemana:day,tempoLimite:tol,pontosMaximos:points,justificativaObrigatoria:false,status:'Pendente',pontosGanhos:0,horarioInicio:'',horarioTermino:''});
        docs++;
      }
    }
    stage='commit';
    await batch.commit();
    committed=true;
    log('create_commit_success',{grupo:g,papel:role,participantes:targets.length,dias:days.length,docs});
    creating=false;
    stage='sync';
    try{
      const synced=await window.rotinaSprint2SyncNow?.('tarefas-criar-real-v26');
      if(synced===false)log('create_sync_warning',{grupo:g,papel:role,participantes:targets.length,docs,mensagem:'Sincronização pós-criação retornou false.'},'warning');
    }catch(syncError){
      log('create_sync_warning',{grupo:g,papel:role,participantes:targets.length,docs,codigo:clean(syncError?.code)||'erro',mensagem:clean(syncError?.message)||String(syncError),tipo:clean(syncError?.name)||'Error'},'warning');
    }
    stage='render';
    accept();render();
    log('create_success',{grupo:g,papel:role,participantes:targets.length,dias:days.length,docs});
    toast(targets.length>1?'Tarefa criada para todos os participantes.':'Nova tarefa criada.');
  }catch(e){
    console.error('Tarefas V2 criar:',e);
    log('create_error',{etapa:stage,commitRealizado:committed,grupo:g,papel:role,participantes:targets.length,dias:days.length,docs,codigo:clean(e?.code)||'erro',mensagem:clean(e?.message)||String(e),tipo:clean(e?.name)||'Error'},'error');
    toast(committed?'A tarefa foi gravada, mas a tela não conseguiu atualizar. Use ↻ Atualizar.':'Não foi possível criar a tarefa.');
  }finally{busy=false;render()}
}
async function save(key,mobile){
  const row=rows.find(r=>r.key===key);if(!row||busy||!canWrite()||!await firebaseReady())return;
  const read=name=>$(mobile?`tv2-m-${name}-${key}`:`tv2-${name}-${key}`)?.value;
  const icon=clean(read('icon')),name=clean(read('name')),start=clean(read('start')),end=clean(read('end')),points=Number(read('points')),tol=Number(read('tol'));
  if(!ICONS.includes(icon)||!name||!validTime(start,end)||!Number.isFinite(points)||points<0||!Number.isFinite(tol)||tol<0)return toast('Revise ícone, nome, horários, pontos e tolerância.');
  if(!row.docs.every(d=>sameGroup(d,groupId())))return toast('A tarefa não pertence ao grupo atual.');
  const conflict=hasConflict(row,start,end);if(conflict)return toast(`Conflito de horário com "${clean(conflict.nome)||'outra tarefa'}".`);
  busy=true;
  try{
    const batch=fs.writeBatch(db),now=new Date().toISOString();
    for(const d of row.docs)batch.update(fs.doc(db,'tarefas',d.id),{icone:icon,nome:name,horaSugeridaInicio:start,horaSugeridaFim:end,pontosMaximos:points,tempoLimite:tol,atualizadoEm:now});
    await batch.commit();editing='';
    await window.rotinaSprint2SyncLocal?.('tarefas-editar-real');
    accept();render();log('edit_success',{docs:row.docs.length,icone:icon});toast('Tarefa atualizada.');
  }catch(e){console.error('Tarefas V2 editar:',e);log('edit_error',{codigo:clean(e?.code)||'erro'},'error');toast('Não foi possível salvar a tarefa.');}
  finally{busy=false;render()}
}
function bindControls(){
  const view=$('view-tarefas');if(view.dataset.tv2Bound==='1')return;view.dataset.tv2Bound='1';
  $('tv2Participant').onchange=e=>{participantFilter=e.target.value;creating=false;editing='';opened='';render()};
  $('tv2Day').onchange=e=>{dayFilter=e.target.value;editing='';opened='';render()};
  $('tv2Status').onchange=e=>{statusFilter=e.target.value;editing='';opened='';render()};
  $('tv2Search').oninput=e=>{searchFilter=e.target.value;opened='';render()};
  $('tv2Add').onclick=()=>{if(busy||!canWrite())return;if(editing)return toast('Salve ou cancele a tarefa em edição.');if(!profiles.length)return toast('Cadastre um participante primeiro.');creating=true;opened='';render();setTimeout(()=>($('tv2-new-name')||$('tv2-m-new-name'))?.select?.(),0);log('create_open',{todos:participantFilter==='all'})};
  $('tv2Refresh').onclick=async()=>{if(busy)return;busy=true;render();try{await window.rotinaSprint2SyncNow?.('tarefas-manual-v2');accept();render();toast('Tarefas atualizadas.')}finally{busy=false;render()}};
}
function activate(){if(!window.RF_APP)return;ensureView();if(document.body.classList.contains('rf-auth-ready'))render()}
window.rotinaSprint2TasksRender=()=>render();
function install(){
  const obs=new MutationObserver(()=>{if(document.body.classList.contains('rf-auth-ready'))setTimeout(activate,0)});
  obs.observe(document.body,{attributes:true,attributeFilter:['class']});
  window.addEventListener('rotina-sprint2-cache-updated',()=>{if($('view-tarefas')?.classList.contains('active'))render()});
  setTimeout(activate,300);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();