(function(){
'use strict';

const VERSION='tarefas-realdata-v4.2-selected-days';
const DAYS=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const WEEKDAYS=['Segunda','Terça','Quarta','Quinta','Sexta'];
const ICONS=['🛏️','📚','🧹','🎻','🍴','🗑️','🧼','🪥','🐶','✅'];
const $=id=>document.getElementById(id);
const clean=v=>String(v??'').trim();
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let db=null,fs=null,app=null;
let busy=false,installed=false,pendingDataRefresh=false;
let profiles=[],series=[];
let participantFilter='all',dayFilter=todayFull(),statusFilter='all',searchFilter='';
let editor=null; // {mode,key,draft,touched:Set}

function todayFull(){return DAYS[new Date().getDay()]}
function groupId(){return clean($('topGroup')?.textContent).replace(/^Grupo\s+/i,'').toUpperCase()}
function session(){return window.rotinaSprint2SessionSnapshot?.()||{role:'',groupId:groupId()}}
function canWrite(){return['adm_familia','adm_convidado','master'].includes(clean(session().role))}
function snap(){return window.rotinaSprint2DataSnapshot?.()||{profiles:[],taskDocs:[],alarms:[],readyGroup:''}}
function sameGroup(d,g){return clean(d?.grupoId).toUpperCase()===g}
function isActive(d){return !(d?.ativa===false||d?.ativo===false||d?.active===false||clean(d?.status).toLowerCase()==='inativa')}
function log(e,d={},level='info'){try{window.techLog?.(`tarefas_v4_${e}`,{versaoModulo:VERSION,...d},level)}catch(_){}}
function toast(t){if(window.RF_APP?.toast)return window.RF_APP.toast(t);const e=$('toast');if(!e)return;e.textContent=t;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),2200)}
function dayOrder(d){const i=DAYS.indexOf(d);return i<0?99:i}
function sortDays(a){return[...new Set((a||[]).filter(Boolean))].sort((x,y)=>dayOrder(x)-dayOrder(y))}
function validTime(a,b){return /^\d{2}:\d{2}$/.test(a)&&/^\d{2}:\d{2}$/.test(b)&&a<b}
function most(a){const m=new Map();for(const v of a)m.set(v,(m.get(v)||0)+1);return[...m].sort((x,y)=>y[1]-x[1])[0]?.[0]??''}

function pidFor(d){
  if(d?.perfilId&&profiles.some(p=>p.id===d.perfilId))return d.perfilId;
  return profiles.find(p=>clean(p.nome).toLowerCase()===clean(d?.perfilNome).toLowerCase())?.id||'';
}
function pname(pid,d){return clean(profiles.find(p=>p.id===pid)?.nome)||clean(d?.perfilNome)||'Integrante'}
function noteOf(d){
  for(const k of['observacao','observações','observacoes','nota','descricao']){
    const v=clean(d?.[k]);if(v)return v;
  }
  return'';
}
function cfg(d){
  return{
    name:clean(d?.nome)||'Tarefa',
    icon:clean(d?.icone)||'✅',
    start:clean(d?.horaSugeridaInicio),
    end:clean(d?.horaSugeridaFim),
    points:Number(d?.pontosMaximos)||0,
    tolerance:Number(d?.tempoLimite)||0,
    active:isActive(d),
    note:noteOf(d)
  };
}
function sig(d){
  const c=cfg(d);
  return JSON.stringify([c.name,c.icon,c.start,c.end,c.points,c.tolerance,c.active,c.note]);
}
function tgFor(docs){
  return most((docs||[]).map(d=>clean(d.tarefaGrupoId)).filter(Boolean))
    ||`tg-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}
function alarmFor(d){
  const s=snap(),g=groupId();
  const exact=(s.alarms||[]).find(a=>sameGroup(a,g)&&clean(a.tarefaId)===clean(d?.id));
  if(exact)return exact;
  const tg=clean(d?.tarefaGrupoId);
  return tg?(s.alarms||[]).find(a=>sameGroup(a,g)&&clean(a.tarefaGrupoId)===tg&&clean(a.diaSemana)===clean(d?.diaSemana))||null:null;
}
function alarmMode(a){
  if(!a||a.ativo===false)return'off';
  const m=Array.isArray(a.momentos)?a.momentos:[];
  return m.includes('inicio')&&m.includes('fim')?'both':m.includes('fim')?'end':'start';
}

function build(){
  const s=snap(),g=groupId();
  profiles=(s.profiles||[]).filter(p=>!p.grupoId||sameGroup(p,g)).map(x=>({...x}));
  const raw=new Map();

  for(const source of(s.taskDocs||[]).filter(x=>sameGroup(x,g))){
    const d={...source},pid=pidFor(d);
    if(!pid)continue;
    const tg=clean(d.tarefaGrupoId);
    const key=tg?`${pid}::tg::${tg}`:`${pid}::legacy::${sig(d)}`;
    if(!raw.has(key))raw.set(key,{pid,key,docs:[]});
    raw.get(key).docs.push(d);
  }

  const merged=new Map();
  for(const r of raw.values()){
    const signatures=[...new Set(r.docs.map(sig))];
    const key=signatures.length===1?`${r.pid}::same::${signatures[0]}`:r.key;
    if(!merged.has(key))merged.set(key,{pid:r.pid,key,docs:[]});
    merged.get(key).docs.push(...r.docs);
  }

  series=[...merged.values()].map(r=>{
    const docs=r.docs.sort((a,b)=>dayOrder(clean(a.diaSemana))-dayOrder(clean(b.diaSemana)));
    const common=most(docs.map(sig));
    const baseDoc=docs.find(d=>sig(d)===common)||docs[0]||{};
    const base=cfg(baseDoc);
    const alarms=docs.map(d=>alarmMode(alarmFor(d)));
    const configUniform=new Set(docs.map(sig)).size===1;
    const alarmUniform=new Set(alarms).size<=1;
    const activeCount=docs.filter(isActive).length;
    const inactiveCount=docs.length-activeCount;
    return{
      key:r.key,pid:r.pid,docs,
      participant:pname(r.pid,baseDoc),
      days:sortDays(docs.map(d=>clean(d.diaSemana))),
      ...base,
      active:activeCount>0,
      allActive:inactiveCount===0,
      mixedActive:activeCount>0&&inactiveCount>0,
      alarm:alarms[0]||'off',
      canBulk:configUniform&&alarmUniform,
      configUniform,
      sortStart:base.start||'99:99'
    };
  }).sort((a,b)=>a.participant.localeCompare(b.participant,'pt-BR')||a.sortStart.localeCompare(b.sortStart)||a.name.localeCompare(b.name,'pt-BR'));

  if(editor?.mode==='edit'&&!series.some(r=>r.key===editor.key)){
    log('editor_closed_stale',{key:editor.key},'warning');
    editor=null;
  }
}

function draftFrom(r){
  if(!r){
    return{icon:'✅',name:'Nova tarefa',start:'12:00',end:'12:15',points:5,tolerance:0,active:true,alarm:'off',note:'',days:[...WEEKDAYS]};
  }
  return{
    icon:r.icon,
    name:r.name,
    start:r.start,
    end:r.end,
    points:Number(r.points)||0,
    tolerance:Number(r.tolerance)||0,
    active:!!r.active,
    alarm:r.alarm,
    note:r.note||'',
    days:[...r.days]
  };
}
function currentSeries(){return editor?.mode==='edit'?series.find(r=>r.key===editor.key)||null:null}

function conflict({pid,days,start,end,ignore=[]}){
  const ids=new Set(ignore.map(clean)),g=groupId();
  for(const d of snap().taskDocs||[]){
    if(ids.has(clean(d.id))||!sameGroup(d,g)||!isActive(d)||pidFor(d)!==pid||!days.includes(clean(d.diaSemana)))continue;
    const a=clean(d.horaSugeridaInicio),b=clean(d.horaSugeridaFim);
    if(validTime(a,b)&&start<b&&end>a)return d;
  }
  return null;
}

async function firebaseReady(){
  if(db&&fs&&app)return true;
  try{
    const appMod=await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    const fsMod=await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
    const named=appMod.getApps().find(x=>x.name==='rotina-sprint2-integracao-realdata');
    if(!named)throw new Error('Aplicação Firebase do ADM não inicializada');
    app=named;fs=fsMod;db=fsMod.getFirestore(named);
    return true;
  }catch(e){
    log('firebase_error',{codigo:clean(e?.code)||'erro',mensagem:clean(e?.message)||String(e)},'error');
    return false;
  }
}
function monday(){
  const d=new Date();d.setHours(0,0,0,0);
  d.setDate(d.getDate()+(d.getDay()===0?-6:1-d.getDay()));
  return d;
}
function iso(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function dateDay(day){
  const i=DAYS.indexOf(day),d=monday();
  d.setDate(d.getDate()+(i===0?6:i-1));
  return iso(d);
}
function alarmId(g,p,t){return[g,p,t].map(v=>String(v||'').replaceAll('/','_')).join('__')}
function alarmData({g,pid,participant,taskId,tg,name,day,start,end,mode,now}){
  const date=dateDay(day);
  const common={
    grupoId:g,perfilId:pid,perfilNome:participant,tarefaId:taskId,tarefaGrupoId:tg,
    nomeTarefa:name,diaSemana:day,horaSugeridaInicio:start,horaSugeridaFim:end,
    dataAgendada:date,semanaInicio:iso(monday()),
    inicioEm:`${date}T${start}:00`,fimEm:`${date}T${end}:00`,
    versaoAgenda:4,origem:'ADM',schedulerPendente:true,schedulerVersao:1,
    schedulerSolicitadoEm:now,atualizadoEm:now
  };
  const moments=mode==='both'?['inicio','fim']:mode==='end'?['fim']:['inicio'];
  return mode==='off'
    ?{...common,ativo:false,bloqueado:false,encerradoEm:now,encerradoPor:'ADM'}
    :{...common,momentos:moments,ativo:true,bloqueado:true,acionadoEm:now,acionadoPor:'ADM'};
}
function createPayload({g,pid,participant,tg,day,v}){
  return{
    grupoId:g,nome:v.name,icone:v.icon,perfilNome:participant,perfilId:pid,tarefaGrupoId:tg,
    horaSugeridaInicio:v.start,horaSugeridaFim:v.end,diaSemana:day,
    tempoLimite:v.tolerance,pontosMaximos:v.points,justificativaObrigatoria:false,
    observacao:v.note,ativa:v.active,status:'Pendente',pontosGanhos:0,horarioInicio:'',horarioTermino:''
  };
}
function validate(v,days){
  if(!ICONS.includes(v.icon)||!v.name||!validTime(v.start,v.end)||!Number.isFinite(Number(v.points))||Number(v.points)<0||!Number.isFinite(Number(v.tolerance))||Number(v.tolerance)<0){
    toast('Revise ícone, nome, horários, pontos e tolerância.');
    return false;
  }
  if(!days.length){toast('Selecione pelo menos um dia.');return false}
  return true;
}

async function createTask(v){
  const targets=participantFilter==='all'?profiles.map(p=>p.id):[participantFilter];
  const days=sortDays(v.days);
  if(!targets.length||!validate(v,days))return false;
  if(v.active){
    for(const pid of targets){
      const c=conflict({pid,days,start:v.start,end:v.end});
      if(c){toast(`Conflito real em ${clean(c.diaSemana)} com “${clean(c.nome)}”.`);return false}
    }
  }
  const g=groupId(),now=new Date().toISOString(),b=fs.writeBatch(db),made=[];
  for(const pid of targets){
    const participant=pname(pid),tg=`tg-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    for(const day of days){
      const ref=fs.doc(fs.collection(db,'tarefas'));
      b.set(ref,createPayload({g,pid,participant,tg,day,v}));
      b.set(
        fs.doc(db,'despertadores',alarmId(g,pid,ref.id)),
        alarmData({g,pid,participant,taskId:ref.id,tg,name:v.name,day,start:v.start,end:v.end,mode:v.active?v.alarm:'off',now}),
        {merge:true}
      );
      made.push({id:ref.id,pid,participant,tg,day});
    }
  }
  await b.commit();
  log('create_success',{docs:made.length,dias:days.length,ativa:v.active});
  toast('Nova tarefa criada.');
  return true;
}

function selectedDocs(r,days){
  const set=new Set(sortDays(days));
  return r.docs.filter(d=>set.has(clean(d.diaSemana)));
}
function touched(field){return !!editor?.touched?.has(field)}
function selectedPatch(tg,v,now){
  const patch={tarefaGrupoId:tg,atualizadoEm:now};
  if(touched('name'))patch.nome=v.name;
  if(touched('icon'))patch.icone=v.icon;
  if(touched('start'))patch.horaSugeridaInicio=v.start;
  if(touched('end'))patch.horaSugeridaFim=v.end;
  if(touched('points'))patch.pontosMaximos=v.points;
  if(touched('tolerance'))patch.tempoLimite=v.tolerance;
  if(touched('note'))patch.observacao=v.note;
  if(touched('active'))patch.ativa=v.active;
  return patch;
}

async function saveSelected(r,v){
  const days=sortDays(v.days).filter(d=>r.days.includes(d));
  if(!days.length){toast('Selecione pelo menos um dia da tarefa.');return false}
  if(!editor.touched?.size){toast('Nenhuma alteração foi feita.');return false}
  if(!validate(v,days))return false;

  const docs=selectedDocs(r,days);
  if(!docs.length){toast('Nenhum dia selecionado foi encontrado.');return false}

  const ignore=r.docs.map(d=>d.id);
  for(const d of docs){
    const base=cfg(d);
    const start=touched('start')?v.start:base.start;
    const end=touched('end')?v.end:base.end;
    const active=touched('active')?v.active:base.active;
    if(active){
      const c=conflict({pid:r.pid,days:[clean(d.diaSemana)],start,end,ignore});
      if(c){toast(`Conflito real em ${clean(d.diaSemana)} com “${clean(c.nome)}”.`);return false}
    }
  }

  const g=groupId(),now=new Date().toISOString(),tg=tgFor(r.docs),b=fs.writeBatch(db);
  const alarmNeedsUpdate=['name','start','end','active','alarm'].some(touched);

  for(const d of docs){
    b.update(fs.doc(db,'tarefas',d.id),selectedPatch(tg,v,now));

    if(alarmNeedsUpdate){
      const base=cfg(d);
      const name=touched('name')?v.name:base.name;
      const start=touched('start')?v.start:base.start;
      const end=touched('end')?v.end:base.end;
      const active=touched('active')?v.active:base.active;
      const preservedMode=alarmMode(alarmFor(d));
      const requestedMode=touched('alarm')?v.alarm:preservedMode;
      const mode=active?requestedMode:'off';

      b.set(
        fs.doc(db,'despertadores',alarmId(g,r.pid,d.id)),
        alarmData({
          g,pid:r.pid,participant:r.participant,taskId:d.id,tg,
          name,day:clean(d.diaSemana),start,end,mode,now
        }),
        {merge:true}
      );
    }
  }

  await b.commit();
  log('edit_selected_success',{
    dias:days,
    docs:docs.length,
    campos:[...editor.touched],
    ativa:touched('active')?v.active:null
  });
  toast(`${days.length} dia${days.length===1?'':'s'} atualizado${days.length===1?'':'s'}.`);
  return true;
}

function setBusyUI(state){
  busy=state;
  document.querySelectorAll('#view-tarefas button,#view-tarefas select,#view-tarefas input,#view-tarefas textarea').forEach(el=>{
    if(el.dataset.keepEnabled==='1')return;
    el.disabled=state;
  });
  const save=document.querySelector('#view-tarefas [data-action="save"]');
  if(save)save.textContent=state?'Salvando…':save.dataset.label||'Salvar';
}

async function saveEditor(){
  if(busy||!editor||!canWrite())return;
  const r=currentSeries(),v={...editor.draft,points:Number(editor.draft.points),tolerance:Number(editor.draft.tolerance),days:sortDays(editor.draft.days)};
  if(editor.mode==='edit'&&!r){toast('A série mudou. Atualize a lista.');editor=null;render();return}
  if(!await firebaseReady()){toast('Firebase indisponível para edição.');return}

  setBusyUI(true);
  log('save_start',{
    modo:editor.mode,
    dias:v.days.length,
    key:editor.key||'',
    campos:editor.mode==='edit'?[...editor.touched]:['create']
  });
  try{
    const ok=editor.mode==='create'?await createTask(v):await saveSelected(r,v);
    if(!ok)return;

    editor=null;
    pendingDataRefresh=false;
    await window.rotinaSprint2SyncLocal?.('tarefas-v42-save');
    render();
  }catch(e){
    console.error(e);
    log('save_error',{codigo:clean(e?.code)||'erro',mensagem:clean(e?.message)||String(e)},'error');
    toast('Não foi possível salvar. A edição foi mantida.');
  }finally{
    setBusyUI(false);
    if(!editor&&pendingDataRefresh){pendingDataRefresh=false;render()}
  }
}

function startCreate(){
  if(busy||editor||!canWrite())return;
  if(!profiles.length){toast('Cadastre um participante primeiro.');return}
  editor={mode:'create',key:'',draft:draftFrom(null),touched:new Set()};
  log('create_open',{todos:participantFilter==='all'});
  render();
}
function startEdit(key){
  if(busy||editor)return;
  const r=series.find(x=>x.key===key);
  if(!r)return;
  editor={mode:'edit',key,draft:draftFrom(r),touched:new Set()};
  log('edit_open',{dias:r.days.length,docs:r.docs.length,inline:true,statusMisto:r.mixedActive});
  render();
}
function cancelEdit(){
  if(!editor||busy)return;
  log('edit_cancel',{modo:editor.mode});
  editor=null;
  const shouldRefresh=pendingDataRefresh;pendingDataRefresh=false;
  render();
  if(shouldRefresh)render();
}
function toggleDraftDay(day){
  if(!editor||!DAYS.includes(day))return;
  const r=currentSeries();
  if(editor.mode==='edit'&&r&&!r.days.includes(day))return;
  const set=new Set(editor.draft.days);
  set.has(day)?set.delete(day):set.add(day);
  editor.draft.days=sortDays([...set]);
  render();
}
function updateDraft(field,value){
  if(!editor)return;
  if(field==='active'&&value==='keep'){
    editor.touched?.delete('active');
    return;
  }
  if(field==='points'||field==='tolerance')editor.draft[field]=value;
  else if(field==='active')editor.draft.active=value==='active';
  else editor.draft[field]=value;

  if(editor.mode==='edit')editor.touched.add(field);

  if(field==='icon'){
    document.querySelectorAll('[data-icon-face]').forEach(el=>el.textContent=value);
  }
}

function style(){
  if($('tv4Style'))return;
  const s=document.createElement('style');s.id='tv4Style';s.textContent=`
.tv4-card{background:#fff;border:1px solid #e6e8f0;border-radius:18px;overflow:hidden}
.tv4-head{padding:18px 20px;border-bottom:1px solid #e6e8f0;display:flex;justify-content:space-between;gap:12px;align-items:end}
.tv4-head h2{margin:4px 0;font-size:23px}.tv4-muted{color:#72788f;font-size:10px;display:block;margin-top:2px}
.tv4-primary{border:0;background:#6b35df;color:#fff;padding:10px 14px;border-radius:10px;font-weight:900;cursor:pointer}
.tv4-btn,.tv4-refresh{border:1px solid #ded8f5;background:#fff;color:#6b35df;padding:9px 10px;border-radius:9px;font-weight:850;cursor:pointer}
.tv4-primary:disabled,.tv4-btn:disabled,.tv4-refresh:disabled{opacity:.45;cursor:not-allowed}
.tv4-filters{display:grid;grid-template-columns:1fr 1fr .7fr 1fr auto;gap:8px;padding:12px 16px;background:#fbf9ff;border-bottom:1px solid #e6e8f0}
.tv4-field label,.tv4-edit label{display:block;font-size:8px;text-transform:uppercase;font-weight:900;color:#625c7a;margin-bottom:5px}
.tv4-field select,.tv4-field input,.tv4-edit input,.tv4-edit select,.tv4-edit textarea{width:100%;border:1px solid #dcdde7;border-radius:9px;padding:8px;background:#fff}
.tv4-count{padding:9px 16px;color:#72788f;font-size:10px;border-bottom:1px solid #eef0f4}
.tv4-tablewrap{overflow:auto}.tv4-table{width:100%;border-collapse:collapse;min-width:930px}
.tv4-table th{background:#f7f3ff;color:#514c75;text-transform:uppercase;font-size:9px;text-align:left;padding:10px}
.tv4-table td{padding:10px;border-bottom:1px solid #eef0f4;font-size:11px;vertical-align:middle}
.tv4-name{display:flex;gap:8px;align-items:center}.tv4-name>span{font-size:18px}
.tv4-pill{display:inline-block;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:850}.tv4-on{background:#e7f8ef;color:#17744e}.tv4-off{background:#f1f2f5;color:#666}.tv4-partial{background:#fff3d7;color:#8a5b10}.tv4-var{color:#8a5b10;font-weight:800}
.tv4-edit-main td{background:#fffdf8;border-top:2px solid #cab9f5}.tv4-edit-main .tv4-task-edit{display:grid;grid-template-columns:48px minmax(150px,1fr);gap:7px;align-items:end}
.tv4-icon{position:relative;height:38px;display:grid;place-items:center;border:1px solid #dcdde7;border-radius:9px;background:#fff}.tv4-icon span{font-size:21px}.tv4-icon select{position:absolute;inset:0;opacity:0}
.tv4-time{display:grid;grid-template-columns:1fr 1fr;gap:5px}.tv4-inline-actions{display:flex;gap:5px;align-items:center;flex-wrap:wrap}
.tv4-detail-row td{padding:0;background:#fbfaff}.tv4-details{padding:14px 16px 16px;display:grid;grid-template-columns:1.25fr .8fr 1.2fr;gap:10px;border-bottom:1px solid #ded8f5}
.tv4-box{background:#fff;border:1px solid #e4def2;border-radius:12px;padding:10px}.tv4-box textarea{min-height:64px;resize:vertical}
.tv4-days{display:flex;gap:5px;flex-wrap:wrap}.tv4-day{border:1px solid #d9d2ef;background:#fff;color:#5e32bc;border-radius:999px;padding:6px 8px;font-size:9px;font-weight:850;cursor:pointer}.tv4-day.on{background:#6b35df;color:#fff}.tv4-day:disabled{opacity:.28;cursor:not-allowed}
.tv4-note,.tv4-warning{grid-column:1/-1;padding:8px 10px;border-radius:9px;font-size:10px}.tv4-note{background:#f4efff;color:#5e4c85}.tv4-warning{background:#fff6e8;border:1px solid #f4d8a6;color:#805315}
.tv4-mobile{display:none;padding:9px}.tv4-mcard{border:1px solid #e6e8f0;border-radius:13px;padding:12px;margin-bottom:9px}.tv4-mhead{display:flex;justify-content:space-between;gap:8px}.tv4-mgrid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}.tv4-mcell{background:#faf9fd;border-radius:9px;padding:8px}
.tv4-mobile-edit{border:2px solid #cab9f5;background:#fffdf8}.tv4-mobile-form{display:grid;gap:9px;margin-top:10px}.tv4-mobile-form .tv4-time{grid-template-columns:1fr 1fr}
.tv4-empty{padding:22px;text-align:center;color:#72788f}
@media(max-width:900px){.tv4-filters{grid-template-columns:1fr 1fr}.tv4-tablewrap{display:none}.tv4-mobile{display:block}.tv4-details{grid-template-columns:1fr}.tv4-note,.tv4-warning{grid-column:auto}}
@media(max-width:520px){.tv4-head{display:grid}.tv4-primary{width:100%}.tv4-filters{grid-template-columns:1fr}.tv4-mobile-form .tv4-time{grid-template-columns:1fr 1fr}}
`;
  document.head.appendChild(s);
}

function view(){
  return`<div class="tv4-card">
    <div class="tv4-head">
      <div><div class="crumb">Tarefas</div><h2>Agenda de tarefas</h2><p class="tv4-muted">Organize horários, pontos e dias de cada tarefa.</p></div>
      <button id="tv4Add" class="tv4-primary" data-action="create">＋ Nova tarefa</button>
    </div>
    <div class="tv4-filters">
      <div class="tv4-field"><label>Participante</label><select id="tv4Participant"></select></div>
      <div class="tv4-field"><label>Dia</label><select id="tv4Day"><option value="all">Todos os dias</option>${DAYS.map(d=>`<option>${d}</option>`).join('')}</select></div>
      <div class="tv4-field"><label>Status</label><select id="tv4Status"><option value="all">Todas</option><option value="active">Ativas</option><option value="inactive">Inativas</option></select></div>
      <div class="tv4-field"><label>Buscar</label><input id="tv4Search"></div>
      <button id="tv4Refresh" class="tv4-refresh" data-action="refresh">↻ Atualizar</button>
    </div>
    <div id="tv4Count" class="tv4-count"></div>
    <div class="tv4-tablewrap"><table class="tv4-table"><thead><tr><th>Tarefa</th><th>Participante</th><th>Dias</th><th>Horário</th><th>Pontos</th><th>Tolerância</th><th>Status</th><th>Ações</th></tr></thead><tbody id="tv4Body"></tbody></table></div>
    <div id="tv4Mobile" class="tv4-mobile"></div>
  </div>`;
}

function fillParticipant(){
  const e=$('tv4Participant'),keep=participantFilter;
  e.innerHTML='<option value="all">Todos os participantes</option>'+profiles.map(p=>`<option value="${esc(p.id)}">${esc(p.nome||'Integrante')}</option>`).join('');
  e.value=[...e.options].some(o=>o.value===keep)?keep:'all';
  participantFilter=e.value;
}
function filteredRows(){
  const q=searchFilter.toLowerCase();
  return series.filter(r=>
    (participantFilter==='all'||r.pid===participantFilter)&&
    (dayFilter==='all'||r.days.includes(dayFilter))&&
    (statusFilter==='all'||(statusFilter==='active'?r.active:!r.active))&&
    (!q||r.name.toLowerCase().includes(q)||r.participant.toLowerCase().includes(q))
  );
}
function daySummary(days){return sortDays(days).map(d=>d.slice(0,3)).join(', ')}
function displayValue(r,k,suffix=''){
  const vals=new Set(r.docs.map(d=>String(cfg(d)[k])));
  return vals.size===1?esc([...vals][0])+suffix:'Varia por dia';
}
function statusBadge(r){return r.mixedActive?'<span class="tv4-pill tv4-partial">PARCIAL</span>':`<span class="tv4-pill ${r.active?'tv4-on':'tv4-off'}">${r.active?'ATIVA':'INATIVA'}</span>`}
function normalRow(r){
  const disabled=editor||busy?'disabled':'';
  return`<tr>
    <td><div class="tv4-name"><span>${esc(r.icon)}</span><div><b>${esc(r.name)}</b><small class="tv4-muted">${r.days.length} dia(s) na semana</small>${r.canBulk?'':'<small class="tv4-muted tv4-var">Há variação entre dias</small>'}</div></div></td>
    <td>${esc(r.participant)}</td><td>${esc(daySummary(r.days))}</td>
    <td>${displayValue(r,'start')} → ${displayValue(r,'end')}</td>
    <td>${displayValue(r,'points')}</td><td>${displayValue(r,'tolerance',' min')}</td>
    <td>${statusBadge(r)}</td>
    <td><button class="tv4-btn" data-action="edit" data-key="${esc(r.key)}" ${disabled}>✎ Editar</button></td>
  </tr>`;
}
function iconField(v){
  return`<label class="tv4-icon"><span data-icon-face>${esc(v)}</span><select data-field="icon">${ICONS.map(i=>`<option value="${i}" ${i===v?'selected':''}>${i}</option>`).join('')}</select></label>`;
}
function dayButtons(days,available=null){
  return DAYS.map(d=>{
    const disabled=available&&!available.includes(d);
    return`<button type="button" class="tv4-day ${days.includes(d)?'on':''}" data-action="toggle-day" data-day="${d}" ${disabled?'disabled':''}>${d.slice(0,3)}</button>`;
  }).join('');
}
function statusField(r,d){
  if(r?.mixedActive&&!touched('active')){
    return`<select data-field="active"><option value="keep" selected>Varia por dia</option><option value="active">Ativa</option><option value="inactive">Inativa</option></select>`;
  }
  return`<select data-field="active"><option value="active" ${d.active?'selected':''}>Ativa</option><option value="inactive" ${!d.active?'selected':''}>Inativa</option></select>`;
}
function applicationBox(r,d){
  if(!r)return`<div class="tv4-box"><label>Aplicação</label><b>${esc(participantFilter==='all'?'Todos os participantes':pname(participantFilter))}</b></div>`;
  return`<div class="tv4-box"><label>Aplicar alterações nos dias</label><div class="tv4-days">${dayButtons(d.days,r.days)}</div><small class="tv4-muted">Todos os dias desta tarefa vêm selecionados. Desmarque os dias que não deseja alterar.</small></div>`;
}
function detailRow(r,d){
  return`<tr class="tv4-detail-row"><td colspan="8"><div class="tv4-details">
    ${applicationBox(r,d)}
    ${r?'':`<div class="tv4-box"><label>Dias da semana</label><div class="tv4-days">${dayButtons(d.days)}</div></div>`}
    <div class="tv4-box"><label>Alarme</label><select data-field="alarm">
      <option value="off" ${d.alarm==='off'?'selected':''}>Desligado</option>
      <option value="start" ${d.alarm==='start'?'selected':''}>No início</option>
      <option value="end" ${d.alarm==='end'?'selected':''}>No fim</option>
      <option value="both" ${d.alarm==='both'?'selected':''}>No início e no fim</option>
    </select></div>
    <div class="tv4-box"><label>Observação</label><textarea data-field="note">${esc(d.note)}</textarea></div>
    ${r&&!r.canBulk?'<div class="tv4-warning">Há variações entre os dias. Somente os campos que você alterar serão aplicados aos dias selecionados; os demais valores permanecem como estão.</div>':''}
  </div></td></tr>`;
}
function editRows(r){
  const d=editor.draft,label=editor.mode==='create'?'Criar tarefa':'Salvar alterações';
  return`<tr class="tv4-edit-main tv4-edit">
    <td><div class="tv4-task-edit">${iconField(d.icon)}<div><label>Nome</label><input data-field="name" value="${esc(d.name)}"></div></div></td>
    <td><b>${esc(r?r.participant:(participantFilter==='all'?'Todos':pname(participantFilter)))}</b></td>
    <td>${esc(daySummary(d.days))}</td>
    <td><div class="tv4-time"><div><label>Início</label><input data-field="start" type="time" value="${esc(d.start)}"></div><div><label>Fim</label><input data-field="end" type="time" value="${esc(d.end)}"></div></div></td>
    <td><label>Pontos</label><input data-field="points" type="number" min="0" value="${esc(d.points)}"></td>
    <td><label>Tolerância</label><input data-field="tolerance" type="number" min="0" value="${esc(d.tolerance)}"></td>
    <td><label>Status</label>${statusField(r,d)}</td>
    <td><div class="tv4-inline-actions"><button class="tv4-primary" data-action="save" data-label="${label}">${label}</button><button class="tv4-btn" data-action="cancel">Cancelar</button></div></td>
  </tr>${detailRow(r,d)}`;
}
function mobileNormal(r){
  const disabled=editor||busy?'disabled':'';
  return`<article class="tv4-mcard">
    <div class="tv4-mhead"><div class="tv4-name"><span>${esc(r.icon)}</span><div><b>${esc(r.name)}</b><small class="tv4-muted">${esc(r.participant)} · ${esc(daySummary(r.days))}</small>${r.canBulk?'':'<small class="tv4-muted tv4-var">Há variação entre dias</small>'}</div></div>${statusBadge(r)}</div>
    <div class="tv4-mgrid"><div class="tv4-mcell"><small>Horário</small><b>${displayValue(r,'start')} → ${displayValue(r,'end')}</b></div><div class="tv4-mcell"><small>Pontos / tolerância</small><b>${displayValue(r,'points')} pts · ${displayValue(r,'tolerance')} min</b></div></div>
    <div class="tv4-inline-actions" style="margin-top:9px"><button class="tv4-btn" data-action="edit" data-key="${esc(r.key)}" ${disabled}>✎ Editar</button></div>
  </article>`;
}
function mobileEdit(r){
  const d=editor.draft,label=editor.mode==='create'?'Criar tarefa':'Salvar alterações';
  return`<article class="tv4-mcard tv4-mobile-edit tv4-edit">
    <div class="tv4-mhead"><b>${editor.mode==='create'?'Nova tarefa':`Editar · ${esc(r.name)}`}</b><button class="tv4-btn" data-action="cancel">Cancelar</button></div>
    <div class="tv4-mobile-form">
      <div><label>Ícone</label>${iconField(d.icon)}</div>
      <div><label>Nome</label><input data-field="name" value="${esc(d.name)}"></div>
      <div class="tv4-time"><div><label>Início</label><input data-field="start" type="time" value="${esc(d.start)}"></div><div><label>Fim</label><input data-field="end" type="time" value="${esc(d.end)}"></div></div>
      <div class="tv4-time"><div><label>Pontos</label><input data-field="points" type="number" min="0" value="${esc(d.points)}"></div><div><label>Tolerância</label><input data-field="tolerance" type="number" min="0" value="${esc(d.tolerance)}"></div></div>
      <div><label>Status</label>${statusField(r,d)}</div>
      ${applicationBox(r,d)}
      ${r?'':`<div class="tv4-box"><label>Dias da semana</label><div class="tv4-days">${dayButtons(d.days)}</div></div>`}
      <div><label>Alarme</label><select data-field="alarm"><option value="off" ${d.alarm==='off'?'selected':''}>Desligado</option><option value="start" ${d.alarm==='start'?'selected':''}>No início</option><option value="end" ${d.alarm==='end'?'selected':''}>No fim</option><option value="both" ${d.alarm==='both'?'selected':''}>No início e no fim</option></select></div>
      <div><label>Observação</label><textarea data-field="note">${esc(d.note)}</textarea></div>
      ${r&&!r.canBulk?'<div class="tv4-warning">Há variações entre os dias. Somente os campos alterados serão aplicados aos dias selecionados.</div>':''}
      <button class="tv4-primary" data-action="save" data-label="${label}">${label}</button>
    </div>
  </article>`;
}

function render(){
  if(!ensureView())return;
  const s=snap(),g=groupId();
  if(!g||clean(s.readyGroup).toUpperCase()!==g)return;

  build();
  fillParticipant();
  $('tv4Day').value=dayFilter;
  $('tv4Status').value=statusFilter;
  $('tv4Search').value=searchFilter;

  const list=filteredRows();
  $('tv4Count').textContent=`${list.length} série${list.length===1?'':'s'} de tarefa`;

  const r=currentSeries();
  let web='';
  if(editor?.mode==='create')web+=editRows(null);
  for(const item of list)web+=editor?.mode==='edit'&&item.key===editor.key?editRows(item):normalRow(item);
  $('tv4Body').innerHTML=web||'<tr><td colspan="8" class="tv4-empty">Nenhuma tarefa encontrada.</td></tr>';

  let mobile='';
  if(editor?.mode==='create')mobile+=mobileEdit(null);
  for(const item of list)mobile+=editor?.mode==='edit'&&item.key===editor.key?mobileEdit(item):mobileNormal(item);
  $('tv4Mobile').innerHTML=mobile||'<div class="tv4-empty">Nenhuma tarefa encontrada.</div>';

  $('tv4Add').disabled=busy||!canWrite()||!!editor;
  $('tv4Refresh').disabled=busy||!!editor;
}
function ensureView(){
  const v=$('view-tarefas');
  if(!v)return false;
  if(v.dataset.tv4!=='1'){
    style();v.innerHTML=view();v.dataset.tv4='1';bindOnce(v);
  }
  return true;
}

function bindOnce(v){
  v.addEventListener('click',async e=>{
    const b=e.target.closest('[data-action]');
    if(!b||!v.contains(b))return;
    const action=b.dataset.action;
    if(action==='create')startCreate();
    else if(action==='edit')startEdit(b.dataset.key);
    else if(action==='cancel')cancelEdit();
    else if(action==='save')await saveEditor();
    else if(action==='toggle-day')toggleDraftDay(b.dataset.day);
    else if(action==='refresh'){
      if(busy||editor)return;
      busy=true;render();
      try{await window.rotinaSprint2SyncHot?.('tarefas-v42-manual-refresh')}
      finally{busy=false;render()}
    }
  });

  v.addEventListener('change',e=>{
    const target=e.target;
    if(target.id==='tv4Participant'){participantFilter=target.value;editor=null;render();return}
    if(target.id==='tv4Day'){dayFilter=target.value;editor=null;render();return}
    if(target.id==='tv4Status'){statusFilter=target.value;editor=null;render();return}
    if(target.dataset.field){updateDraft(target.dataset.field,target.value)}
  });

  v.addEventListener('input',e=>{
    const target=e.target;
    if(target.id==='tv4Search'){searchFilter=target.value;render();return}
    if(target.dataset.field)updateDraft(target.dataset.field,target.value);
  });
}

function activate(){
  if(!window.RF_APP)return;
  ensureView();
  if(document.body.classList.contains('rf-auth-ready'))render();
}
window.rotinaSprint2TasksRender=render;

function install(){
  if(installed)return;installed=true;
  new MutationObserver(()=>document.body.classList.contains('rf-auth-ready')&&setTimeout(activate,0))
    .observe(document.body,{attributes:true,attributeFilter:['class']});

  window.addEventListener('rotina-sprint2-cache-updated',event=>{
    if(!$('view-tarefas')?.classList.contains('active'))return;
    const origin=clean(event?.detail?.origin);

    if(origin==='live-execucoes')return;

    if(editor){
      pendingDataRefresh=true;
      log('data_refresh_deferred',{origin});
      return;
    }
    render();
  });
  setTimeout(activate,300);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();