from pathlib import Path
import re


def replace_once(text, old, new, label):
    if text.count(old) != 1:
        raise SystemExit(f'{label}: esperado 1 trecho, encontrado {text.count(old)}')
    return text.replace(old, new, 1)

# ---------- Store central: Conquistas opcionais, sem novo listener ----------
p=Path('sprint2-data-store-v1.js'); s=p.read_text(encoding='utf-8')
s=replace_once(s,
"let data={groupId:'',readyGroup:'',profiles:[],taskDocs:[],history:[],executions:[],alarms:[],rewards:[],redemptions:[],lastServerSync:0,lastLiveSync:0,lastLocalSync:0,origin:'empty',version:VERSION};",
"let data={groupId:'',readyGroup:'',profiles:[],taskDocs:[],history:[],executions:[],alarms:[],rewards:[],redemptions:[],conquests:[],conquestEvents:[],lastServerSync:0,lastLiveSync:0,lastLocalSync:0,origin:'empty',version:VERSION};",'store data')
s=replace_once(s,"function copy(list){return (list||[]).map(x=>({...x}))}","function copy(list){return (list||[]).map(x=>({...x}))}\nfunction conquestAccess(){return clean(window.rotinaSprint2SessionSnapshot?.().role)==='master'}",'store access')
s=replace_once(s,
"function reset(g=''){data={groupId:g,readyGroup:'',profiles:[],taskDocs:[],history:[],executions:[],alarms:[],rewards:[],redemptions:[],lastServerSync:0,lastLiveSync:0,lastLocalSync:0,origin:'reset',version:VERSION}}",
"function reset(g=''){data={groupId:g,readyGroup:'',profiles:[],taskDocs:[],history:[],executions:[],alarms:[],rewards:[],redemptions:[],conquests:[],conquestEvents:[],lastServerSync:0,lastLiveSync:0,lastLocalSync:0,origin:'reset',version:VERSION}}",'store reset')
s=replace_once(s,
"function snapshot(){return{...data,profiles:copy(data.profiles),taskDocs:copy(data.taskDocs),history:copy(data.history),executions:copy(data.executions),alarms:copy(data.alarms),rewards:copy(data.rewards),redemptions:copy(data.redemptions)}}",
"function snapshot(){return{...data,profiles:copy(data.profiles),taskDocs:copy(data.taskDocs),history:copy(data.history),executions:copy(data.executions),alarms:copy(data.alarms),rewards:copy(data.rewards),redemptions:copy(data.redemptions),conquests:copy(data.conquests),conquestEvents:copy(data.conquestEvents)}}",'store snapshot')
old="""    const results=await Promise.allSettled([queryGroup('despertadores',true,g),queryGroup('recompensas',true,g),queryGroup('resgates',true,g)]);
    if(results[0].status==='fulfilled')data.alarms=results[0].value;
    if(results[1].status==='fulfilled')data.rewards=results[1].value;
    if(results[2].status==='fulfilled')data.redemptions=results[2].value;
    const failures=results.filter(x=>x.status==='rejected').length;
"""
new="""    const results=await Promise.allSettled([queryGroup('despertadores',true,g),queryGroup('recompensas',true,g),queryGroup('resgates',true,g)]);
    if(results[0].status==='fulfilled')data.alarms=results[0].value;
    if(results[1].status==='fulfilled')data.rewards=results[1].value;
    if(results[2].status==='fulfilled')data.redemptions=results[2].value;
    if(conquestAccess()){
      const optional=await Promise.allSettled([queryGroup('conquistas',true,g),queryGroup('conquistaHistorico',true,g)]);
      if(optional[0].status==='fulfilled')data.conquests=optional[0].value;
      if(optional[1].status==='fulfilled')data.conquestEvents=optional[1].value;
    }else{data.conquests=[];data.conquestEvents=[]}
    const failures=results.filter(x=>x.status==='rejected').length;
"""
s=replace_once(s,old,new,'store initial optional')
old="""    const names=reconcileAll?['perfis','tarefas','historico','execucoes','despertadores','recompensas','resgates']:['perfis','tarefas','historico','despertadores','recompensas','resgates'];
    const results=await Promise.allSettled(names.map(c=>queryGroup(c,server,g)));
    if(groupId()!==g)return false;
    results.forEach((r,i)=>{if(r.status!=='fulfilled')return;const name=names[i];if(name==='perfis')data.profiles=r.value;else if(name==='tarefas')data.taskDocs=r.value;else if(name==='historico')data.history=r.value;else if(name==='execucoes')data.executions=r.value;else if(name==='despertadores')data.alarms=r.value;else if(name==='recompensas')data.rewards=r.value;else if(name==='resgates')data.redemptions=r.value});
    const failures=results.filter(x=>x.status==='rejected').length;
"""
new="""    const names=reconcileAll?['perfis','tarefas','historico','execucoes','despertadores','recompensas','resgates']:['perfis','tarefas','historico','despertadores','recompensas','resgates'];
    const optionalNames=conquestAccess()?['conquistas','conquistaHistorico']:[];
    const allNames=[...names,...optionalNames];
    const results=await Promise.allSettled(allNames.map(c=>queryGroup(c,server,g)));
    if(groupId()!==g)return false;
    results.forEach((r,i)=>{if(r.status!=='fulfilled')return;const name=allNames[i];if(name==='perfis')data.profiles=r.value;else if(name==='tarefas')data.taskDocs=r.value;else if(name==='historico')data.history=r.value;else if(name==='execucoes')data.executions=r.value;else if(name==='despertadores')data.alarms=r.value;else if(name==='recompensas')data.rewards=r.value;else if(name==='resgates')data.redemptions=r.value;else if(name==='conquistas')data.conquests=r.value;else if(name==='conquistaHistorico')data.conquestEvents=r.value});
    const failures=results.slice(0,names.length).filter(x=>x.status==='rejected').length;
"""
s=replace_once(s,old,new,'store full optional')
p.write_text(s,encoding='utf-8')

# ---------- Tarefas: detalhes editáveis reais ----------
p=Path('sprint2-tarefas-realdata-v2.js'); s=p.read_text(encoding='utf-8')
s=s.replace("const VERSION='tarefas-realdata-v2.1';","const VERSION='tarefas-realdata-v2.2-editable-details';",1)
s=s.replace(".tv2-alarm-line+.tv2-alarm-line{margin-top:4px}",".tv2-alarm-line+.tv2-alarm-line{margin-top:4px}.tv2-detail input,.tv2-detail select,.tv2-detail textarea{width:100%;border:1px solid #dcdde7;border-radius:8px;padding:8px;background:#fff}.tv2-detail textarea{min-height:72px;resize:vertical}.tv2-day-choice{border:1px solid #d9d2ef;background:#fff;color:#5e32bc;border-radius:999px;padding:6px 8px;font-size:9px;font-weight:850;cursor:pointer}.tv2-day-choice.on{background:#6b35df;color:#fff;border-color:#6b35df}.tv2-detail-save{margin-top:8px;width:100%}",1)
start=s.index('function detailsHtml(r,mobile=false){')
end=s.index('\nfunction editDesktop',start)
new_details=r'''function detailToken(key){return encodeURIComponent(key)}
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
function agendaFields(day,start,end){const date=dataForDay(day),mk=t=>`${date}T${t}:00`;return{dataAgendada:date,semanaInicio:isoDate(mondayOfWeek()),inicioEm:mk(start),fimEm:mk(end)}}
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
'''
s=s[:start]+new_details+s[end:]
old="""  root?.querySelectorAll('[data-tv2-more]').forEach(b=>b.onclick=()=>{opened=opened===b.dataset.tv2More?'':b.dataset.tv2More;log('details_toggle',{aberto:!!opened});render()});
"""
new="""  root?.querySelectorAll('[data-tv2-more]').forEach(b=>b.onclick=()=>{opened=opened===b.dataset.tv2More?'':b.dataset.tv2More;log('details_toggle',{aberto:!!opened});render()});
  root?.querySelectorAll('[data-tv2-detail-day]').forEach(b=>b.onclick=()=>b.classList.toggle('on'));
  root?.querySelectorAll('[data-tv2-detail-save]').forEach(b=>b.onclick=()=>saveDetails(b.dataset.tv2DetailSave));
"""
s=replace_once(s,old,new,'task detail bind')
p.write_text(s,encoding='utf-8')

# ---------- Recompensas: painel de Conquistas + histórico unificado ----------
p=Path('sprint2-recompensas-realdata-v1.js'); s=p.read_text(encoding='utf-8')
s=s.replace("const VERSION='recompensas-realdata-v1';","const VERSION='recompensas-realdata-v1.1-conquistas';",1)
start=s.index('function viewHtml(){')
end=s.index('\nfunction ensureView',start)
view=r'''function viewHtml(){return `<div class="rv1-note"><b>Integração real:</b> Recompensas e Conquistas usam o Store central, sem criar listener novo nesta tela.</div><div class="card"><div class="head"><div><div class="crumb">Recompensas • dados reais</div><h2>🎁 Recompensas e Conquistas</h2><p>Recompensas de um lado, Conquistas do outro e Histórico logo abaixo, conforme a tela aprovada.</p></div><button class="primary" id="rv1New">＋ Nova recompensa</button></div><div class="rv1-grid" style="padding:14px"><section class="rv1-panel"><div class="rv1-panel-head"><div><h3>Recompensas</h3><p>Catálogo real do grupo.</p></div><select id="rv1CatalogFilter"><option value="all">Todas</option><option value="active">Ativas</option><option value="inactive">Desativadas</option></select></div><div id="rv1Catalog" class="rv1-list"></div></section><section class="rv1-panel" id="rv1ConquestsPanel"></section></div><section class="rv1-history"><div class="rv1-history-head"><div><h3 style="margin:0">📋 Histórico</h3><p style="margin:4px 0 0;color:#72788f;font-size:10px">Resgates de Recompensas e eventos de Conquistas no mesmo histórico. Pendentes de resgate podem ser aprovados ou recusados.</p></div><div class="rv1-filters"><select id="rv1HistoryType"><option value="all">Tudo</option><option value="reward">Recompensas</option><option value="conquest">Conquistas</option></select><select id="rv1Participant"><option value="all">Todos os participantes</option></select><select id="rv1Status"><option value="all">Todos os status</option><option value="Pendente">Pendente</option><option value="Aprovado">Aprovado</option><option value="Recusado">Recusado</option><option value="Aguardando ADM">Aguardando ADM</option><option value="Validada">Validada</option><option value="Excluída">Excluída</option></select><input id="rv1Date" type="date"><select id="rv1Period"><option value="day">Dia</option><option value="week">Semana</option><option value="month">Mês</option></select><button class="rv1-btn" id="rv1Refresh">↻ Atualizar</button></div></div><div id="rv1History" class="rv1-list"></div></section></div>`}'''
s=s[:start]+view+s[end:]
start=s.index('function renderHistory(){')
end=s.index('\nfunction render(){',start)
hist=r'''function renderHistory(){
  const box=$('rv1History');if(!box)return;refreshParticipants();
  const type=$('rv1HistoryType')?.value||'all',p=$('rv1Participant')?.value||'all',stf=$('rv1Status')?.value||'all',ref=$('rv1Date')?.value||today(),mode=$('rv1Period')?.value||'day';
  const rewardRows=redemptions.map(r=>({id:r.id,type:'reward',perfilId:r.perfilId,perfilNome:participantName(r),title:r.recompensaNome||'Recompensa',status:statusOf(r),date:dateOf(r),created:r.decididoEm||r.criadoEm||'',points:r.pontos,raw:r}));
  const conquestRows=(window.rotinaSprint2ConquestHistoryRows?.()||[]);
  const rows=[...rewardRows,...conquestRows].filter(r=>(type==='all'||r.type===type)&&(p==='all'||r.perfilId===p)&&(stf==='all'||r.status===stf)&&inPeriod(r.date,ref,mode)).sort((a,b)=>clean(b.created||b.date).localeCompare(clean(a.created||a.date)));
  box.innerHTML=rows.length?rows.map(r=>{if(r.type==='conquest')return `<article class="rv1-item"><div class="rv1-row"><div><div class="rv1-name">🏆 ${esc(r.perfilNome||'Integrante')} · ${esc(r.title)}</div><div class="rv1-desc">Evento real de Conquista.</div></div><span class="rv1-pill rv1-pending">${esc(clean(r.status).toUpperCase())}</span></div><div class="rv1-meta"><div><small>Tipo</small><span>Conquista</span></div><div><small>Data</small><span>${esc(r.date||'—')}</span></div><div><small>Status</small><span>${esc(r.status)}</span></div><div><small>Participante</small><span>${esc(r.perfilNome||'Integrante')}</span></div></div></article>`;const x=r.raw,s=statusOf(x);return `<article class="rv1-item"><div class="rv1-row"><div><div class="rv1-name">${esc(participantName(x))} · ${esc(x.recompensaNome||'Recompensa')}</div><div class="rv1-desc">Pedido real de resgate.</div></div><span class="rv1-pill ${statusClass(s)}">${esc(s.toUpperCase())}</span></div><div class="rv1-meta"><div><small>Pontos</small><span>${moneylessPoints(x.pontos)}</span></div><div><small>Data</small><span>${esc(dateOf(x)||'—')}</span></div><div><small>Status</small><span>${esc(s)}</span></div><div><small>Participante</small><span>${esc(participantName(x))}</span></div></div>${s==='Pendente'?`<div class="rv1-actions"><button class="rv1-btn" data-rv1-decide="${esc(x.id)}" data-status="Aprovado" ${canWrite()?'':'disabled'}>Aprovar</button><button class="rv1-btn danger" data-rv1-decide="${esc(x.id)}" data-status="Recusado" ${canWrite()?'':'disabled'}>Recusar</button></div>`:''}</article>`}).join(''):'<div class="rv1-empty">Nenhuma movimentação neste período/filtro.</div>';bindHistoryButtons()
}'''
s=s[:start]+hist+s[end:]
s=s.replace("function render(){if(!ensureView()||!accept())return;renderCatalog();renderHistory();$('rv1New').disabled=!canWrite()||busy;$('rv1Refresh').disabled=busy}","function render(){if(!ensureView()||!accept())return;renderCatalog();window.rotinaSprint2RenderConquests?.();renderHistory();$('rv1New').disabled=!canWrite()||busy;$('rv1Refresh').disabled=busy}",1)
s=s.replace("['rv1Participant','rv1Status','rv1Date','rv1Period'].forEach(id=>$(id).onchange=renderHistory)","['rv1HistoryType','rv1Participant','rv1Status','rv1Date','rv1Period'].forEach(id=>$(id).onchange=renderHistory)",1)
p.write_text(s,encoding='utf-8')

# ---------- Página: carregar módulo real de Conquistas e forçar cache novo ----------
p=Path('sprint2-integracao-recompensas-v1.html'); s=p.read_text(encoding='utf-8')
s=s.replace('sprint2-data-store-v1.js','sprint2-data-store-v1.js?v=20260903-conquistas-v1',1)
s=s.replace('sprint2-tarefas-realdata-v2.js?v=20260903-details-v1','sprint2-tarefas-realdata-v2.js?v=20260903-editable-details-v2',1)
s=s.replace('<script src="sprint2-recompensas-realdata-v1.js"></script>','<script src="sprint2-recompensas-realdata-v1.js?v=20260903-conquistas-v1"></script><script src="sprint2-conquistas-realdata-v1.js?v=20260903-v1"></script>',1)
p.write_text(s,encoding='utf-8')

print('PATCH_OK')
