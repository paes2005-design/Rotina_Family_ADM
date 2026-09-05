from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    assert count == 1, f'{label}: esperado 1, encontrado {count}'
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


def replace_between(path, start, end, new, label):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    a = text.find(start)
    assert a >= 0, f'{label}: início não encontrado'
    b = text.find(end, a)
    assert b >= 0, f'{label}: fim não encontrado'
    p.write_text(text[:a] + new + text[b:], encoding='utf-8')


task = 'sprint2-tarefas-realdata-v2.js'
replace_once(
    task,
    "const VERSION='tarefas-realdata-v2.7-create-name-fix';",
    "const VERSION='tarefas-realdata-v2.8-create-with-details';",
    'versão tarefas',
)
replace_once(
    task,
    "function agendaFields(day,start,end){const date=dateForDay(day),mk=t=>`${date}T${t}:00`;return{dataAgendada:date,semanaInicio:isoDate(mondayOfWeek()),inicioEm:mk(start),fimEm:mk(end)}}",
    "function agendaFields(day,start,end){const date=dateForDay(day),mk=t=>`${date}T${t}:00`;return{dataAgendada:date,semanaInicio:isoDate(mondayOfWeek()),inicioEm:mk(start),fimEm:mk(end)}}\nfunction alarmMoments(mode){return mode==='both'?['inicio','fim']:mode==='end'?['fim']:['inicio']}\nfunction alarmData({g,pid,participant,taskId,tg,name,day,start,end,mode,now}){const common={grupoId:g,perfilId:pid,perfilNome:participant,tarefaId:taskId,tarefaGrupoId:tg,nomeTarefa:name,diaSemana:day,horaSugeridaInicio:start,horaSugeridaFim:end,...agendaFields(day,start,end),versaoAgenda:3,origem:'ADM',schedulerPendente:true,schedulerVersao:1,schedulerSolicitadoEm:now,atualizadoEm:now};return mode==='off'?{...common,ativo:false,bloqueado:false,encerradoEm:now,encerradoPor:'ADM'}:{...common,momentos:alarmMoments(mode),ativo:true,bloqueado:true,acionadoEm:now,acionadoPor:'ADM'}}",
    'helper alarme',
)
replace_once(
    task,
    "    const momentos=mode==='both'?['inicio','fim']:mode==='end'?['fim']:['inicio'];\n    for(const item of kept){const agenda=agendaFields(item.day,row.start,row.end),aid=alarmDocId(g,row.pid,item.id),common={grupoId:g,perfilId:row.pid,perfilNome:row.participant,tarefaId:item.id,tarefaGrupoId:tg,nomeTarefa:row.name,diaSemana:item.day,horaSugeridaInicio:row.start,horaSugeridaFim:row.end,...agenda,versaoAgenda:3,origem:'ADM',schedulerPendente:true,schedulerVersao:1,schedulerSolicitadoEm:now,atualizadoEm:now};batch.set(fs.doc(db,'despertadores',aid),mode==='off'?{...common,ativo:false,bloqueado:false,encerradoEm:now,encerradoPor:'ADM'}:{...common,momentos,ativo:true,bloqueado:true,acionadoEm:now,acionadoPor:'ADM'},{merge:true})}",
    "    for(const item of kept){const aid=alarmDocId(g,row.pid,item.id);batch.set(fs.doc(db,'despertadores',aid),alarmData({g,pid:row.pid,participant:row.participant,taskId:item.id,tg,name:row.name,day:item.day,start:row.start,end:row.end,mode,now}),{merge:true})}",
    'reuso alarme detalhes',
)

creation_ui = r'''function iconOptions(current){return ICONS.map(i=>`<option value="${esc(i)}" ${i===current?'selected':''}>${esc(i)}</option>`).join('')}
function iconPicker(id,current){return `<label class="tv2-icon-picker" title="Trocar ícone"><span class="tv2-icon-face" aria-hidden="true">${esc(current)}</span><select id="${esc(id)}" aria-label="Ícone da tarefa">${iconOptions(current)}</select><span class="tv2-icon-chevron" aria-hidden="true">⌄</span></label>`}
function createDetailFields(mobile=false){
  const prefix=mobile?'tv2-m-new-':'tv2-new-',week=DAYS.map(d=>`<button type="button" class="tv2-day-choice ${WEEKDAYS.includes(d)?'on':''}" data-tv2-create-day data-day="${esc(d)}">${esc(d.slice(0,3))}</button>`).join('');
  return `<div class="${mobile?'tv2-mdetails':''}"><div class="tv2-details"><div class="tv2-detail"><small>Semana</small><div class="tv2-days">${week}</div><span class="tv2-muted">Defina os dias já no cadastro.</span></div><div class="tv2-detail"><small>Alarme</small><select id="${prefix}alarm"><option value="off">Desligado</option><option value="start">No início</option><option value="end">No fim</option><option value="both">No início e no fim</option></select><span class="tv2-muted">O despertador nasce junto com a tarefa quando ativado.</span></div><div class="tv2-detail"><small>Observação</small><textarea id="${prefix}note" placeholder="Opcional"></textarea><span class="tv2-muted">Depois de criada, edite estes detalhes pelos três pontos.</span></div></div></div>`;
}
function createSelectedDays(mobile=false){const root=mobile?$('tv2Mobile'):$('tv2Body');return root?[...root.querySelectorAll('[data-tv2-create-day].on')].map(b=>b.dataset.day):[]}
function createDesktop(){return `<tr class="tv2-create"><td><div class="tv2-editgrid">${iconPicker('tv2-new-icon','✅')}<input id="tv2-new-name" value="Nova tarefa" aria-label="Nome da nova tarefa"></div></td><td><b>${esc(draftParticipantLabel())}</b><small class="tv2-muted">${participantFilter==='all'?'Será aplicada a todos':'Participante selecionado'}</small></td><td><span class="tv2-muted">Defina abaixo</span></td><td><input id="tv2-new-start" type="time" value="12:00"></td><td><input id="tv2-new-end" type="time" value="12:15"></td><td><input id="tv2-new-points" type="number" min="0" step="1" value="5"></td><td><input id="tv2-new-tol" type="number" min="0" step="1" value="0"></td><td><span class="tv2-pill tv2-on">ATIVA</span></td><td><div class="tv2-actions"><button class="tv2-btn" data-tv2-create-save>Salvar</button><button class="tv2-btn" data-tv2-create-cancel>Cancelar</button></div></td></tr><tr class="tv2-details-row"><td colspan="9">${createDetailFields(false)}</td></tr>`}
function createMobile(){return `<article class="tv2-mcard tv2-create"><div class="tv2-mhead"><div><b>＋ Nova tarefa</b><small class="tv2-muted">${esc(draftParticipantLabel())}</small></div><span class="tv2-pill tv2-on">ATIVA</span></div><div class="tv2-medit">${iconPicker('tv2-m-new-icon','✅')}<input id="tv2-m-new-name" value="Nova tarefa" aria-label="Nome da nova tarefa"><div class="tv2-mgrid"><div><small>Início</small><input id="tv2-m-new-start" type="time" value="12:00"></div><div><small>Fim</small><input id="tv2-m-new-end" type="time" value="12:15"></div><div><small>Pontos</small><input id="tv2-m-new-points" type="number" min="0" value="5"></div><div><small>Tolerância</small><input id="tv2-m-new-tol" type="number" min="0" value="0"></div></div>${createDetailFields(true)}<div class="tv2-actions"><button class="tv2-btn" data-tv2-create-save data-mobile="1">Salvar</button><button class="tv2-btn" data-tv2-create-cancel>Cancelar</button></div></div></article>`}
'''
replace_between(task, 'function iconOptions(current){', 'function editDesktop(r){', creation_ui, 'formulário completo de criação')

bind_rows = r'''function bindRows(){
  const root=$('view-tarefas');
  root?.querySelectorAll('[data-tv2-edit]').forEach(b=>b.onclick=()=>{creating=false;editing=b.dataset.tv2Edit;opened='';render()});
  root?.querySelectorAll('[data-tv2-cancel]').forEach(b=>b.onclick=()=>{editing='';render()});
  root?.querySelectorAll('[data-tv2-save]').forEach(b=>b.onclick=()=>save(b.dataset.tv2Save,b.dataset.mobile==='1'));
  root?.querySelectorAll('[data-tv2-create-save]').forEach(b=>b.onclick=()=>createTask(b.dataset.mobile==='1'));
  root?.querySelectorAll('[data-tv2-create-cancel]').forEach(b=>b.onclick=()=>{creating=false;render()});
  root?.querySelectorAll('[data-tv2-create-day]').forEach(b=>b.onclick=()=>b.classList.toggle('on'));
  root?.querySelectorAll('.tv2-icon-picker select').forEach(sel=>sel.onchange=()=>{const face=sel.closest('.tv2-icon-picker')?.querySelector('.tv2-icon-face');if(face)face.textContent=sel.value});
  root?.querySelectorAll('[data-tv2-more]').forEach(b=>b.onclick=()=>{opened=opened===b.dataset.tv2More?'':b.dataset.tv2More;log('details_toggle',{aberto:!!opened});render()});
  root?.querySelectorAll('[data-tv2-detail-day]').forEach(b=>b.onclick=()=>b.classList.toggle('on'));
  root?.querySelectorAll('[data-tv2-detail-save]').forEach(b=>b.onclick=()=>saveDetails(b.dataset.tv2DetailSave));
}
'''
replace_between(task, 'function bindRows(){', 'function render(){', bind_rows, 'eventos criação')

create_task = r'''async function createTask(mobile){
  if(!creating||busy||!canWrite())return;
  if(!await firebaseReady()){log('create_error',{etapa:'firebase_ready',codigo:'firebase-nao-pronto',mensagem:'Aplicativo Firebase da Sprint 2 não disponível.'},'error');return toast('Não foi possível preparar a gravação da tarefa.');}
  const prefix=mobile?'tv2-m-new-':'tv2-new-';
  const icon=clean($(prefix+'icon')?.value),name=clean($(prefix+'name')?.value),start=clean($(prefix+'start')?.value),end=clean($(prefix+'end')?.value),points=Number($(prefix+'points')?.value),tol=Number($(prefix+'tol')?.value),note=clean($(prefix+'note')?.value),alarm=$(prefix+'alarm')?.value||'off',targets=draftTargets(),days=createSelectedDays(mobile);
  if(!targets.length)return toast('Cadastre ou selecione pelo menos um participante.');
  if(!days.length)return toast('Selecione pelo menos um dia da semana.');
  if(!ICONS.includes(icon)||!name||!validTime(start,end)||!Number.isFinite(points)||points<0||!Number.isFinite(tol)||tol<0)return toast('Revise ícone, nome, horários, pontos e tolerância.');
  for(const pid of targets){const conflict=draftConflict(pid,days,start,end);if(conflict)return toast(`Conflito de horário para ${profileName(pid)} com "${clean(conflict.nome)||'outra tarefa'}".`)}
  const g=groupId(),role=clean(session().role);let stage='prepare',committed=false,detailsCommitted=false,docs=0;const created=[];
  busy=true;render();
  try{
    const batch=fs.writeBatch(db),stamp=Date.now();
    for(const pid of targets){
      const participant=profileName(pid),tg=`tg-${stamp}-${Math.random().toString(36).slice(2,8)}`;
      for(const day of days){
        const ref=fs.doc(fs.collection(db,'tarefas'));
        batch.set(ref,{grupoId:g,nome:name,icone:icon,perfilNome:participant,perfilId:pid,tarefaGrupoId:tg,horaSugeridaInicio:start,horaSugeridaFim:end,diaSemana:day,tempoLimite:tol,pontosMaximos:points,justificativaObrigatoria:false,status:'Pendente',pontosGanhos:0,horarioInicio:'',horarioTermino:''});
        created.push({id:ref.id,pid,participant,tg,day});docs++;
      }
    }
    stage='commit_task';
    await batch.commit();
    committed=true;
    log('create_commit_success',{grupo:g,papel:role,participantes:targets.length,dias:days.length,docs});

    if(note||alarm!=='off'){
      stage='commit_details';
      const detailsBatch=fs.writeBatch(db),now=new Date().toISOString();
      for(const item of created){
        if(note)detailsBatch.update(fs.doc(db,'tarefas',item.id),{observacao:note,atualizadoEm:now});
        if(alarm!=='off'){
          const aid=alarmDocId(g,item.pid,item.id);
          detailsBatch.set(fs.doc(db,'despertadores',aid),alarmData({g,pid:item.pid,participant:item.participant,taskId:item.id,tg:item.tg,name,day:item.day,start,end,mode:alarm,now}),{merge:true});
        }
      }
      await detailsBatch.commit();
      detailsCommitted=true;
      log('create_details_success',{grupo:g,papel:role,dias:days.length,docs,alarme:alarm!=='off',observacao:!!note});
    }

    creating=false;
    stage='sync';
    try{
      const synced=await window.rotinaSprint2SyncNow?.('tarefas-criar-real-v28');
      if(synced===false)log('create_sync_warning',{grupo:g,papel:role,participantes:targets.length,docs,mensagem:'Sincronização pós-criação retornou false.'},'warning');
    }catch(syncError){
      log('create_sync_warning',{grupo:g,papel:role,participantes:targets.length,docs,codigo:clean(syncError?.code)||'erro',mensagem:clean(syncError?.message)||String(syncError),tipo:clean(syncError?.name)||'Error'},'warning');
    }
    stage='render';
    accept();render();
    log('create_success',{grupo:g,papel:role,participantes:targets.length,dias:days.length,docs,detalhes:detailsCommitted||(!note&&alarm==='off')});
    toast(targets.length>1?'Tarefa criada para todos os participantes.':'Nova tarefa criada.');
  }catch(e){
    console.error('Tarefas V2 criar:',e);
    log('create_error',{etapa:stage,commitRealizado:committed,detalhesRealizados:detailsCommitted,grupo:g,papel:role,participantes:targets.length,dias:days.length,docs,codigo:clean(e?.code)||'erro',mensagem:clean(e?.message)||String(e),tipo:clean(e?.name)||'Error'},'error');
    toast(committed?'A tarefa foi criada, mas algum detalhe não foi salvo. Use os três pontos para revisar.':'Não foi possível criar a tarefa.');
  }finally{busy=false;render()}
}
'''
replace_between(task, 'async function createTask(mobile){', 'async function save(key,mobile){', create_task, 'gravação completa da criação')

master = 'sprint2-master-realdata-v1.js'
replace_once(
    master,
    "const VERSION='master-realdata-v1.2-visibility-gated';",
    "const VERSION='master-realdata-v1.3-role-visibility';",
    'versão master',
)
replace_between(
    master,
    'function masterNav(){',
    'function openMaster(){',
    r'''function masterNav(){const b=$('masterNavButton');if(!b)return null;b.classList.remove('next-stage');b.disabled=false;b.hidden=false;b.removeAttribute('aria-hidden');b.onclick=e=>{e.preventDefault();openMaster()};return b}
function hideMasterForNonMaster(){const b=$('masterNavButton');if(b){b.hidden=true;b.disabled=true;b.setAttribute('aria-hidden','true');b.classList.remove('active')}const view=$('view-master');if(view)view.classList.remove('active')}
''',
    'visibilidade Master por papel',
)

replace_once(
    'sprint2-integracao-login-realdata-bridge-v1.js',
    "script.src='sprint2-master-realdata-v1.js?v=20260905-master-realdata-v12-visibility-gated';",
    "script.src='sprint2-master-realdata-v1.js?v=20260905-master-realdata-v13-role-visibility';",
    'cache master',
)

html = 'sprint2-integracao-recompensas-v1.html'
replace_once(
    html,
    ".next-stage{opacity:.48;cursor:not-allowed}#masterNavButton[hidden]{display:none!important}",
    ".next-stage{opacity:.48;cursor:not-allowed}",
    'remove css corretivo master',
)
replace_once(
    html,
    'sprint2-tarefas-realdata-v2.js?v=20260905-create-name-fix-v27',
    'sprint2-tarefas-realdata-v2.js?v=20260905-create-with-details-v28',
    'cache tarefas',
)
