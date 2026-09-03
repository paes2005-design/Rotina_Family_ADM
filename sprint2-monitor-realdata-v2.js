(function(){
'use strict';

const VERSION='monitor-realdata-v3-readmodel';
const PAGE='sprint2-integracao-monitor-v2.html';
const API_ROOT='https://rotina-family-onesignal-scheduler.rotina-family-onesignal-scheduler.workers.dev';
const TIME_ZONE='America/Bahia';
const DAY_SHORT=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DAY_FULL=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const CACHE_TTL_MS=5*60*1000;
const $=id=>document.getElementById(id);
const clean=v=>String(v??'').trim();
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');

let current='__ALL__';
let period='day';
let refDate=todayIso();
let statusFilter='all';
let db=null,fs=null,app=null;
let taskDocs=[],historyDocs=[],executionDocs=[],alarmDocs=[];
let lastGroup='',lastLoadAt=0,bound=false;

function zonedParts(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false
  }).formatToParts(date);
  const out={};
  for(const p of parts)if(p.type!=='literal')out[p.type]=p.value;
  return out;
}
function todayIso(){
  const p=zonedParts();
  return `${p.year}-${p.month}-${p.day}`;
}
function nowHm(){
  const p=zonedParts();
  return `${p.hour}:${p.minute}:${p.second}`;
}
function dateLocal(iso){
  const [y,m,d]=String(iso||todayIso()).split('-').map(Number);
  return new Date(y,m-1,d,12,0,0,0);
}
function isoLocal(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function addDays(iso,n){const d=dateLocal(iso);d.setDate(d.getDate()+n);return isoLocal(d)}
function dayFullFor(iso){return DAY_FULL[dateLocal(iso).getDay()]}
function dayShortFor(iso){return DAY_SHORT[dateLocal(iso).getDay()]}
function rangeFor(reference=refDate,p=period){
  const r=dateLocal(reference),a=new Date(r),b=new Date(r);
  if(p==='week'){a.setDate(a.getDate()-a.getDay());b.setTime(a.getTime());b.setDate(b.getDate()+6)}
  else if(p==='month'){a.setDate(1);b.setFullYear(r.getFullYear(),r.getMonth()+1,0)}
  else if(p==='year'){a.setFullYear(r.getFullYear(),0,1);b.setFullYear(r.getFullYear(),11,31)}
  return {start:isoLocal(a),end:isoLocal(b)};
}
function datesForRange(){
  const {start,end}=rangeFor();
  const out=[];
  for(let d=start;d<=end;d=addDays(d,1))out.push(d);
  return out;
}
function state(){return window.RF_APP?.state||null}
function participant(pid){return state()?.participants?.find(p=>p.id===pid)||null}
function participantName(pid){return participant(pid)?.name||pid||'Integrante'}
function groupId(){return clean($('topGroup')?.textContent).replace(/^Grupo\s+/i,'').toUpperCase()}
function browserFamily(){const u=navigator.userAgent;if(/Edg\//.test(u))return'Edge';if(/Firefox\//.test(u))return'Firefox';if(/Chrome\//.test(u))return'Chrome';if(/Safari\//.test(u))return'Safari';return'Outro'}

async function log(evento,detalhes={},nivel='info'){
  const safe={};
  for(const[k,v]of Object.entries(detalhes||{})){
    if(/email|senha|password|token|pin|nome|name|texto|justificativa/i.test(k)||typeof v==='object')continue;
    safe[k]=typeof v==='number'||typeof v==='boolean'?v:String(v).slice(0,120);
  }
  try{
    const response=await fetch(`${API_ROOT}/app-log`,{
      method:'POST',keepalive:true,headers:{'content-type':'application/json'},
      body:JSON.stringify({events:[{
        aplicativo:'adm',versaoMonitor:3,evento,nivel,
        detalhes:{versao:VERSION,...safe},grupoId:groupId()||'SPRINT2-PREVIEW',
        perfilId:'',sessaoId:'sprint2-monitor-v3',clienteEm:new Date().toISOString(),
        pagina:PAGE,navegador:browserFamily(),online:navigator.onLine,
        visibilidade:document.visibilityState,instalado:false
      }]})
    });
    if(!response.ok)throw new Error(`Log HTTP ${response.status}`);
    const result=await response.json().catch(()=>({}));
    if(Number(result.accepted)!==1)throw new Error('Log não confirmado');
  }catch(e){console.warn('Monitor V3 telemetria:',e?.message||e)}
}

function injectStyle(){
  if($('monitorV3Style'))return;
  const s=document.createElement('style');
  s.id='monitorV3Style';
  s.textContent=`
  .mv3-controls{display:grid;gap:9px;margin-bottom:12px;padding:11px;border:1px solid #e4e6ee;border-radius:13px;background:#fbfbfd}
  .mv3-periods,.mv3-nav,.mv3-selects{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
  .mv3-periods button,.mv3-nav button,.mv3-refresh{border:1px solid #dcd7eb;background:#fff;color:#625c7a;border-radius:9px;padding:8px 10px;font-weight:800;cursor:pointer}
  .mv3-periods button.active{background:#6b35df;border-color:#6b35df;color:#fff}
  .mv3-nav input,.mv3-selects select{border:1px solid #dcdde7;border-radius:9px;padding:8px;background:#fff}
  .mv3-source{font-size:9px;color:#7d8294;margin-top:3px}.mv3-source b{color:#4f5568}.mv3-past{opacity:.9}
  .monitor-v2-row,.monitor-v2-header{display:grid;grid-template-columns:38px minmax(170px,1.35fr) minmax(118px,.8fr) minmax(155px,1fr) minmax(145px,1fr) 82px 92px minmax(150px,1fr);gap:9px;align-items:center;padding:10px 12px;border-bottom:1px solid #edf0f4;font-size:11px}
  .monitor-v2-header{font-size:9px;text-transform:uppercase;font-weight:900;color:#73798d;background:#fafbfc;border:1px solid #e6e8f0;border-radius:12px 12px 0 0}.monitor-v2-row{background:#fff}.monitor-v2-title b{display:block;font-size:12px}.monitor-v2-title small,.monitor-v2-real small{display:block;color:#7a8092;margin-top:2px;line-height:1.35}
  .score-band{display:inline-flex;align-items:center;justify-content:center;min-width:50px;padding:6px 8px;border-radius:999px;font-weight:900}.score-100{background:#dcfce7;color:#166534}.score-75{background:#fef3c7;color:#92400e}.score-50{background:#ffedd5;color:#9a3412}.score-0{background:#fee2e2;color:#991b1b}.score-na{background:#f1f5f9;color:#64748b}
  .monitor-v2-status{font-weight:850;line-height:1.35}.monitor-v2-actions{display:flex;gap:6px;flex-wrap:wrap}.monitor-v2-actions button{border:1px solid #d8dce6;border-radius:9px;background:#fff;padding:7px 8px;font-size:10px;font-weight:850;cursor:pointer}.monitor-v2-actions .alarm-on{border-color:#f87171;color:#991b1b;background:#fff7f7}.monitor-v2-actions .just-btn{border-color:#f5c15c;color:#8a4b00;background:#fffaf0}.monitor-v2-actions button:disabled{opacity:.45;cursor:not-allowed}
  .monitor-v2-card{border:1px solid #e6e8f0;border-radius:15px;padding:12px;background:#fff;margin-bottom:10px}.monitor-v2-card-head{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:8px;align-items:center}.monitor-v2-card-head b{font-size:12px}.monitor-v2-card-head small{display:block;color:#7a8092;font-size:10px;margin-top:2px}.monitor-v2-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}.monitor-v2-grid>div{padding:8px;border-radius:10px;background:#f8f9fc}.monitor-v2-grid small{display:block;font-size:8px;text-transform:uppercase;color:#7d8294}.monitor-v2-grid b{display:block;font-size:11px;margin-top:3px;line-height:1.35}.monitor-v2-card .monitor-v2-actions{margin-top:10px}.monitor-v2-legend{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px;font-size:10px}.monitor-v2-legend span{padding:5px 8px;border-radius:999px}
  .mv2-modal{position:fixed;inset:0;z-index:80000;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;padding:16px}.mv2-modal-card{width:min(520px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:20px;padding:20px;box-shadow:0 24px 70px rgba(15,23,42,.28)}.mv2-modal-card h2{margin:0 42px 6px 0;font-size:20px}.mv2-modal-card p{color:#64748b;font-size:12px;line-height:1.5}.mv2-close{float:right;border:0;background:#f1f5f9;border-radius:50%;width:34px;height:34px;font-size:20px}.mv2-box{padding:12px;border-radius:12px;background:#f8fafc;margin:10px 0;font-size:12px;line-height:1.5}.mv2-just{background:#fffbeb;border:1px solid #fde68a;white-space:pre-wrap}.mv2-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.mv2-actions button{border:0;border-radius:11px;padding:11px;font-weight:850}.mv2-primary{background:#6b35df;color:#fff}.mv2-danger{background:#fee2e2;color:#991b1b}.mv2-neutral{background:#e2e8f0;color:#334155}.mv2-msg{font-size:11px;color:#64748b;min-height:18px;margin-top:8px}.mv2-select{width:100%;padding:11px;border:1px solid #d6dae5;border-radius:10px;margin:6px 0 10px}
  .monitor-v2-warning{border:1px solid #c7d7f7;background:#f6f9ff;color:#35527d;padding:10px 12px;border-radius:11px;font-size:10px;margin-bottom:12px}
  @media(max-width:1100px){.monitor-v2-row,.monitor-v2-header{grid-template-columns:34px minmax(150px,1fr) 110px 140px 130px 72px 80px minmax(130px,.9fr)}}
  @media(max-width:900px){.monitor-v2-header,.monitor-v2-row{display:none}.monitor-v2-card{display:block}.mv2-actions{grid-template-columns:1fr}.monitor-v2-grid{grid-template-columns:1fr 1fr}.mv3-controls{padding:9px}.mv3-nav,.mv3-selects{display:grid;grid-template-columns:1fr 1fr}.mv3-nav input{width:100%}}
  `;
  document.head.appendChild(s);
}

async function firebaseReady(){
  if(db&&fs&&app)return true;
  try{
    const appMod=await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    const fsMod=await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
    const named=appMod.getApps().find(x=>x.name==='rotina-sprint2-integracao-realdata');
    if(!named)return false;
    app=named;fs=fsMod;db=fsMod.getFirestore(named);return true;
  }catch(e){console.warn('Monitor V3 Firebase:',e);return false}
}
function sameProfile(doc,pid){
  if(clean(doc?.perfilId))return clean(doc.perfilId)===clean(pid);
  return clean(doc?.perfilNome).toLowerCase()===clean(participantName(pid)).toLowerCase();
}
function sourceTaskFor(task,pid,date){
  const day=dayFullFor(date);
  const exact=taskDocs.find(d=>sameProfile(d,pid)&&clean(d.diaSemana)===day&&clean(d.nome)===clean(task.name)&&clean(d.horaSugeridaInicio)===clean(task.start)&&clean(d.horaSugeridaFim)===clean(task.end));
  if(exact)return exact;
  return taskDocs.find(d=>sameProfile(d,pid)&&clean(d.diaSemana)===day&&clean(d.nome)===clean(task.name))||null;
}
function recordDate(x){return clean(x?.data||x?.dataExecucao).slice(0,10)}
function finalRecord(x){
  const s=clean(x?.status).toLowerCase();
  return Boolean(x&&(x.terminoExecutadoEm||x.horarioTermino||s.includes('prazo')||s.includes('atrasado')||x.percentualAplicado!==null&&x.percentualAplicado!==undefined));
}
function inProgressRecord(x){
  const s=clean(x?.status).toLowerCase();
  return Boolean(x&&(s.includes('andamento')||(x.inicioExecutadoEm||x.horarioInicio)&&!(x.terminoExecutadoEm||x.horarioTermino)));
}
function findByOccurrence(list,source,pid,date){
  if(!source?.id)return null;
  return list.find(x=>clean(x.tarefaId)===clean(source.id)&&sameProfile(x,pid)&&recordDate(x)===date)||null;
}
function occurrenceFor(task,pid,date){
  const source=sourceTaskFor(task,pid,date);
  const hist=findByOccurrence(historyDocs,source,pid,date);
  const exec=findByOccurrence(executionDocs,source,pid,date);
  const sourceLive=source&&recordDate(source)===date?source:null;
  let result=null,sourceKind='programacao',stateKind='pending';
  if(hist&&finalRecord(hist)){result=hist;sourceKind='historico';stateKind='final'}
  else if(exec&&finalRecord(exec)){result=exec;sourceKind='execucao';stateKind='final'}
  else if(exec&&inProgressRecord(exec)){result=exec;sourceKind='execucao';stateKind='running'}
  else if(sourceLive&&inProgressRecord(sourceLive)){result=sourceLive;sourceKind='tarefa-viva';stateKind='running'}
  else if(hist&&inProgressRecord(hist)){result=hist;sourceKind='historico';stateKind='running'}
  return {
    ...(source||{}),
    ...(result||{}),
    __sourceId:source?.id||'',
    __historyId:hist?.id||'',
    __executionId:exec?.id||'',
    __pid:pid,__task:task,__date:date,
    __resultSource:sourceKind,__state:stateKind
  };
}

function hasStart(x){return x.__state!=='pending'&&!!(x.inicioExecutadoEm||x.horarioInicio)}
function hasEnd(x){return x.__state==='final'&&!!(x.terminoExecutadoEm||x.horarioTermino||finalRecord(x))}
function formatClock(v,fallback='—'){
  if(!v)return fallback;
  if(/^\d{1,2}:\d{2}(:\d{2})?$/.test(String(v)))return String(v).length===5?`${v}:00`:String(v);
  const d=typeof v?.toDate==='function'?v.toDate():new Date(v);
  return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('pt-BR',{timeZone:TIME_ZONE,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d):fallback;
}
function maxPoints(x){return Number(x.pontosMaximos??x.__task?.points)||0}
function wonPoints(x){return x.__state==='pending'?0:(Number(x.pontosGanhos)||0)}
function storedPercentage(x){
  if(x.__state!=='final')return null;
  for(const v of [x.percentualRevisado,x.percentualAplicado]){
    if(v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v)))return Math.max(0,Math.min(100,Math.round(Number(v))));
  }
  const faixa=clean(x.faixaAtraso).toLowerCase();
  if(faixa==='dentro-limites')return 100;
  if(faixa==='atraso-leve')return 75;
  if(faixa==='atraso-maior')return 50;
  if(faixa==='estourado')return 0;
  const raw=clean(x.status);
  if(/75%/.test(raw))return 75;
  if(/50%/.test(raw))return 50;
  if(/(^|[^\d])0%/.test(raw)||/atrasado/i.test(raw))return 0;
  if(/prazo/i.test(raw))return 100;
  return null;
}
function schedulePassed(x){
  if(x.__date!==todayIso()||x.__state!=='pending')return false;
  const end=clean(x.__task.start||'');
  if(!/^\d{1,2}:\d{2}$/.test(end))return false;
  return nowHm().slice(0,5)>end;
}
function statusInfo(x){
  if(x.__state==='pending')return schedulePassed(x)?{label:'Pendente · horário previsto passou',icon:'⏳'}:{label:'Pendente',icon:'⏳'};
  if(x.__state==='running')return{label:'Em andamento',icon:'▶️'};
  const pct=storedPercentage(x),raw=clean(x.status),faixa=clean(x.faixaAtraso).toLowerCase();
  if(x.inicioAntecipado===true&&(pct===100||/prazo/i.test(raw)))return{label:'No prazo · início antecipado',icon:'🔵'};
  if(pct===100||/prazo/i.test(raw))return{label:'No prazo · 100%',icon:'✅'};
  if(pct===75||faixa==='atraso-leve')return{label:'Atraso leve · 75%',icon:'🟡'};
  if(pct===50||faixa==='atraso-maior')return{label:'Atraso maior · 50%',icon:'🟠'};
  if(pct===0||faixa==='estourado'||/atrasado/i.test(raw))return{label:'Tolerância estourada · 0%',icon:'🔴'};
  return{label:raw||'Concluída',icon:'✅'};
}
function scoreClass(p){if(p===null)return'score-na';if(p===100)return'score-100';if(p===75)return'score-75';if(p===50)return'score-50';return'score-0'}
function scoreText(p){return p===null?'—':`${p}%`}
function toleranceText(x){
  const base=Math.max(0,Number(x.tempoLimite??x.__task?.tolerance)||0)*60;
  const used=x.__state==='pending'?null:(x.toleranciaConsumidaSeg!==null&&x.toleranciaConsumidaSeg!==undefined?Number(x.toleranciaConsumidaSeg):(x.toleranciaConsumidaMin!==null&&x.toleranciaConsumidaMin!==undefined?Number(x.toleranciaConsumidaMin)*60:null));
  const fmt=s=>`${Math.floor(Math.max(0,s)/60)}:${pad(Math.floor(Math.max(0,s)%60))}`;
  return used===null?`Tol. ${fmt(base)}`:`Tol. ${fmt(base)} · usada ${fmt(used)}`;
}
function actualText(x){
  if(x.__state==='pending')return'Não iniciada';
  const a=formatClock(x.inicioExecutadoEm||x.horarioInicio);
  const b=x.__state==='final'?formatClock(x.terminoExecutadoEm||x.horarioTermino):'em andamento';
  return `${a} → ${b}`;
}
function justificationState(x){
  if(x.__state!=='final')return null;
  if(x.justificativaRecusada===true)return{kind:'refused',label:'🚩 Não quis justificar',text:'Usuário não quis justificar.'};
  const txt=clean(x.justificativaAtraso);
  if(txt)return{kind:'text',label:'🚩 Ver justificativa',text:txt};
  return null;
}
function alarmFor(x){
  return alarmDocs.find(a=>clean(a.tarefaId)===clean(x.__sourceId)&&sameProfile(a,x.__pid)&&clean(a.dataAgendada)===x.__date)||null;
}
function sourceLabel(x){
  if(x.__resultSource==='historico')return'Histórico do participante';
  if(x.__resultSource==='execucao')return'Execução do participante';
  if(x.__resultSource==='tarefa-viva')return'Execução em andamento';
  return'Programação';
}

function appRows(){
  const s=state();if(!s)return[];
  const out=[];
  for(const date of datesForRange()){
    const dShort=dayShortFor(date);
    for(const task of s.tasks||[]){
      if(task.status!=='active'||!(task.days||[]).includes(dShort))continue;
      for(const pid of task.targets||[]){
        if(current!=='__ALL__'&&pid!==current)continue;
        const x=occurrenceFor(task,pid,date);
        if(statusFilter!=='all'){
          const key=x.__state==='pending'?'pending':x.__state==='running'?'running':storedPercentage(x)===100?'ok':'late';
          if(key!==statusFilter)continue;
        }
        out.push(x);
      }
    }
  }
  return out.sort((a,b)=>a.__date.localeCompare(b.__date)||clean(a.__task.start).localeCompare(clean(b.__task.start))||participantName(a.__pid).localeCompare(participantName(b.__pid),'pt-BR'));
}

async function loadData(force=false){
  const g=groupId();
  if(!g||g==='SISTEMA'||!document.body.classList.contains('rf-auth-ready'))return false;
  try{
    if(window.rotinaSprint2EnsureData&&window.rotinaSprint2DataSnapshot){
      if(force&&window.rotinaSprint2SyncNow)await window.rotinaSprint2SyncNow('monitor-manual');
      else await window.rotinaSprint2EnsureData();
      const shared=window.rotinaSprint2DataSnapshot();
      if(shared&&clean(shared.groupId).toUpperCase()===g){
        taskDocs=(shared.taskDocs||[]).map(x=>({...x}));
        historyDocs=(shared.history||[]).map(x=>({...x}));
        executionDocs=(shared.executions||[]).map(x=>({...x}));
        alarmDocs=(shared.alarms||[]).map(x=>({...x}));
        lastGroup=g;lastLoadAt=Math.max(Number(shared.lastServerSync)||0,Number(shared.lastLiveSync)||0)||Date.now();
        await log('sprint2.monitor_v3_dados',{tarefas:taskDocs.length,historico:historyDocs.length,execucoes:executionDocs.length,alarmes:alarmDocs.length,storeCentral:true});
        return true;
      }
    }
  }catch(e){console.warn('Monitor V3 store central:',e)}
  if(!force&&g===lastGroup&&Date.now()-lastLoadAt<CACHE_TTL_MS&&taskDocs.length)return true;
  if(!await firebaseReady())return false;
  try{
    const q=c=>fs.query(fs.collection(db,c),fs.where('grupoId','==',g));
    const [ts,hs,es,as]=await Promise.all([
      fs.getDocsFromServer(q('tarefas')),
      fs.getDocsFromServer(q('historico')),
      fs.getDocsFromServer(q('execucoes')).catch(()=>({docs:[]})),
      fs.getDocsFromServer(q('despertadores')).catch(()=>({docs:[]}))
    ]);
    taskDocs=ts.docs.map(d=>({id:d.id,...d.data()}));
    historyDocs=hs.docs.map(d=>({id:d.id,...d.data()}));
    executionDocs=(es.docs||[]).map(d=>({id:d.id,...d.data()}));
    alarmDocs=(as.docs||[]).map(d=>({id:d.id,...d.data()}));
    lastGroup=g;lastLoadAt=Date.now();
    await log('sprint2.monitor_v3_dados',{tarefas:taskDocs.length,historico:historyDocs.length,execucoes:executionDocs.length,alarmes:alarmDocs.length,storeCentral:false});
    return true;
  }catch(e){
    console.error('Monitor V3 dados:',e);
    await log('sprint2.monitor_v3_dados_erro',{mensagem:String(e?.message||e).slice(0,80)},'error');
    return false;
  }
}

function fillParticipants(){
  const sel=$('monitorParticipant'),s=state();if(!sel||!s)return;
  const keep=current;
  sel.innerHTML='<option value="__ALL__">Todos</option>'+(s.participants||[]).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  current=[...sel.options].some(o=>o.value===keep)?keep:'__ALL__';sel.value=current;
}
function ensureControls(){
  if($('mv3Controls'))return;
  const toolbar=$('view-monitor')?.querySelector('.monitor-toolbar');
  if(!toolbar)return;
  const box=document.createElement('div');
  box.id='mv3Controls';box.className='mv3-controls';
  box.innerHTML=`
    <div class="mv3-periods" id="mv3Periods"><button type="button" data-period="day" class="active">Dia</button><button type="button" data-period="week">Semana</button><button type="button" data-period="month">Mês</button><button type="button" data-period="year">Ano</button></div>
    <div class="mv3-nav"><button type="button" data-move="-1">‹ Anterior</button><input id="mv3RefDate" type="date" value="${esc(refDate)}"><button type="button" data-current="1">Hoje</button><button type="button" data-move="1">Próximo ›</button><button type="button" class="mv3-refresh" id="mv3Refresh">↻ Atualizar</button></div>
    <div class="mv3-selects"><select id="mv3Status"><option value="all">Todos os status</option><option value="pending">Pendentes</option><option value="running">Em andamento</option><option value="ok">Concluídas no prazo</option><option value="late">Concluídas com perda</option></select></div>`;
  toolbar.parentNode.insertBefore(box,toolbar);
  box.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{period=b.dataset.period;box.querySelectorAll('[data-period]').forEach(x=>x.classList.toggle('active',x===b));render(false)});
  box.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>{const d=dateLocal(refDate),n=Number(b.dataset.move)||0;if(period==='year')d.setFullYear(d.getFullYear()+n);else if(period==='month')d.setMonth(d.getMonth()+n);else d.setDate(d.getDate()+n*(period==='week'?7:1));refDate=isoLocal(d);$('mv3RefDate').value=refDate;render(false)});
  box.querySelector('[data-current]').onclick=()=>{refDate=todayIso();$('mv3RefDate').value=refDate;render(false)};
  $('mv3RefDate').onchange=e=>{refDate=e.target.value||todayIso();render(false)};
  $('mv3Status').onchange=e=>{statusFilter=e.target.value;render(false)};
  $('mv3Refresh').onclick=()=>{lastLoadAt=0;render(true)};
}
function periodLabel(){
  const {start,end}=rangeFor();
  if(period==='day')return start.split('-').reverse().join('/');
  if(period==='year')return start.slice(0,4);
  if(period==='month')return dateLocal(start).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  return `${start.split('-').reverse().join('/')} a ${end.split('-').reverse().join('/')}`;
}

function actionsHtml(x){
  const a=alarmFor(x),j=justificationState(x),past=x.__date<todayIso(),alarmLabel=a?.ativo?'🔒 Alarme':'⏰ Programar';
  return `<div class="monitor-v2-actions"><button type="button" class="mv2-alarm ${a?.ativo?'alarm-on':''}" data-source="${esc(x.__sourceId)}" data-pid="${esc(x.__pid)}" data-date="${esc(x.__date)}" ${past||!x.__sourceId?'disabled':''}>${alarmLabel}</button>${j?`<button type="button" class="just-btn mv2-just-open" data-history="${esc(x.__historyId)}" data-source="${esc(x.__sourceId)}" data-pid="${esc(x.__pid)}" data-date="${esc(x.__date)}">${esc(j.label)}</button>`:''}</div>`;
}
function rowHtml(x){
  const st=statusInfo(x),pct=storedPercentage(x),dateLabel=period==='day'?'':`<small>${esc(x.__date.split('-').reverse().join('/'))}</small>`;
  return `<div class="monitor-v2-row ${x.__date<todayIso()?'mv3-past':''}" data-family-task-id="${esc(x.__sourceId)}" data-family-profile-id="${esc(x.__pid)}"><span style="font-size:18px">${st.icon}</span><span class="monitor-v2-title"><b>${esc(x.__task.icon||'✅')} ${esc(x.__task.name)}</b><small>${esc(participantName(x.__pid))}</small>${dateLabel}</span><span><b>${esc(x.__task.start)}–${esc(x.__task.end)}</b><br><small>${esc(toleranceText(x))}</small></span><span class="monitor-v2-real"><b>${esc(actualText(x))}</b><small>${x.inicioAntecipado===true?'Início antecipado':''}</small><div class="mv3-source">Fonte: <b>${esc(sourceLabel(x))}</b></div></span><span class="monitor-v2-status">${esc(st.label)}</span><span><span class="score-band ${scoreClass(pct)}">${scoreText(pct)}</span></span><span><b>${wonPoints(x)}/${maxPoints(x)}</b><br><small>pts</small></span><span>${actionsHtml(x)}</span></div>`;
}
function cardHtml(x){
  const st=statusInfo(x),pct=storedPercentage(x);
  return `<article class="monitor-v2-card" data-family-task-id="${esc(x.__sourceId)}" data-family-profile-id="${esc(x.__pid)}"><div class="monitor-v2-card-head"><span style="font-size:19px">${st.icon}</span><div><b>${esc(x.__task.icon||'✅')} ${esc(x.__task.name)}</b><small>${esc(participantName(x.__pid))} · ${esc(x.__date.split('-').reverse().join('/'))}</small></div><span class="score-band ${scoreClass(pct)}">${scoreText(pct)}</span></div><div class="monitor-v2-grid"><div><small>Previsto</small><b>${esc(x.__task.start)}–${esc(x.__task.end)}</b></div><div><small>Real</small><b>${esc(actualText(x))}</b></div><div><small>Situação</small><b>${esc(st.label)}</b></div><div><small>Pontos</small><b>${wonPoints(x)}/${maxPoints(x)} pts</b></div><div><small>Tolerância</small><b>${esc(toleranceText(x))}</b></div><div><small>Fonte</small><b>${esc(sourceLabel(x))}</b></div></div>${actionsHtml(x)}</article>`;
}
function bindRowActions(container,rows){
  container.querySelectorAll('.mv2-alarm').forEach(b=>b.onclick=()=>{const x=rows.find(r=>r.__sourceId===b.dataset.source&&r.__pid===b.dataset.pid&&r.__date===b.dataset.date);if(x)openAlarm(x)});
  container.querySelectorAll('.mv2-just-open').forEach(b=>b.onclick=()=>{const x=rows.find(r=>r.__historyId===b.dataset.history&&r.__sourceId===b.dataset.source&&r.__pid===b.dataset.pid&&r.__date===b.dataset.date);if(x)openJustification(x)});
}

async function render(force=false){
  if(!state()||!$('monitorTimeline'))return;
  fillParticipants();ensureControls();
  if(!(await loadData(force))){$('monitorInfo').textContent='Não foi possível carregar os detalhes do Monitor.';return}
  const rows=appRows();
  const done=rows.filter(x=>x.__state==='final').length;
  const running=rows.filter(x=>x.__state==='running').length;
  const pending=rows.filter(x=>x.__state==='pending').length;
  const late=rows.filter(x=>x.__state==='final'&&[75,50,0].includes(storedPercentage(x))).length;
  $('mExpected').textContent=rows.length;$('mDone').textContent=done;$('mRunning').textContent=running;$('mPending').textContent=pending;
  const who=current==='__ALL__'?'todos os participantes':participantName(current);
  $('monitorInfo').innerHTML=`<b>${esc(periodLabel())}</b> · ${esc(who)} · ${done} concluída(s), ${running} em andamento, ${pending} pendente(s)${late?` · ${late} com perda de pontuação`:''}.`;
  const legend=`<div class="monitor-v2-legend"><span class="score-na">Pendente não é atraso</span><span class="score-100">100% no prazo</span><span class="score-75">75% atraso leve</span><span class="score-50">50% atraso maior</span><span class="score-0">0% tolerância estourada</span></div>`;
  const header='<div class="monitor-v2-header"><span></span><span>Tarefa</span><span>Previsto / tolerância</span><span>Real / fonte</span><span>Situação oficial</span><span>Faixa</span><span>Pontos</span><span>Ações</span></div>';
  $('monitorTimeline').innerHTML=legend+(rows.length?header+rows.map(rowHtml).join(''):'<div class="notice">Nenhuma ocorrência corresponde aos filtros.</div>');
  $('monitorMobile').innerHTML=legend+(rows.length?rows.map(cardHtml).join(''):'<div class="notice">Nenhuma ocorrência corresponde aos filtros.</div>');
  bindRowActions($('monitorTimeline'),rows);bindRowActions($('monitorMobile'),rows);
  await log('sprint2.monitor_v3_render',{linhas:rows.length,concluidas:done,andamento:running,atrasos:late,pendentes:pending});
}

function closeModal(){document.querySelector('.mv2-modal')?.remove()}
function modalBase(title,body){
  closeModal();const m=document.createElement('div');m.className='mv2-modal';
  m.innerHTML=`<div class="mv2-modal-card"><button class="mv2-close" type="button">×</button><h2>${title}</h2>${body}</div>`;
  document.body.appendChild(m);m.querySelector('.mv2-close').onclick=closeModal;m.onclick=e=>{if(e.target===m)closeModal()};return m;
}
function alarmKey(g,p,t){return[g,p,t].map(v=>clean(v).replaceAll('/','_')).join('__')}
function alarmSchedule(x){
  const date=x.__date,start=clean(x.__task.start),end=clean(x.__task.end),week=dateLocal(date);week.setHours(0,0,0,0);week.setDate(week.getDate()+(week.getDay()===0?-6:1-week.getDay()));
  const weekIso=isoLocal(week);let endDate=date;if(start&&end&&end<=start)endDate=addDays(date,1);return{semanaInicio:weekIso,inicioEm:start?`${date}T${start}:00`:'',fimEm:end?`${endDate}T${end}:00`:''};
}
async function openAlarm(x){
  const existing=alarmFor(x);
  const m=modalBase(`⏰ ${esc(x.__task.name)}`,`<p><strong>${esc(participantName(x.__pid))}</strong> · ${esc(x.__date.split('-').reverse().join('/'))} · ${esc(x.__task.start)} às ${esc(x.__task.end)}</p><label><b>Quando tocar</b></label><select class="mv2-select" id="mv2AlarmMoment" ${existing?.ativo?'disabled':''}><option value="inicio">No início da tarefa</option><option value="fim">No fim da tarefa</option><option value="ambos">No início e no fim</option></select><div class="mv2-box">${existing?.ativo?'🔒 Alarme ativo e bloqueado pelo ADM.':'⚪ Alarme desligado nesta ocorrência.'}</div><div class="mv2-actions"><button class="mv2-primary" id="mv2AlarmOn" ${existing?.ativo?'disabled':''}>Ativar</button><button class="mv2-danger" id="mv2AlarmOff" ${existing?.ativo?'':'disabled'}>Retirar</button></div><div class="mv2-msg" id="mv2AlarmMsg"></div>`);
  if(existing?.momentos?.includes('fim'))m.querySelector('#mv2AlarmMoment').value=existing.momentos.includes('inicio')?'ambos':'fim';
  await log('sprint2.monitor_v3_alarme_abrir',{ativo:!!existing?.ativo});
  const command=async ativo=>{
    const msg=m.querySelector('#mv2AlarmMsg');msg.textContent='Salvando…';
    try{
      if(!await firebaseReady())throw new Error('Firebase indisponível');
      const v=m.querySelector('#mv2AlarmMoment').value,momentos=v==='ambos'?['inicio','fim']:[v],now=new Date().toISOString();
      const payload={grupoId:groupId(),perfilId:x.__pid,perfilNome:participantName(x.__pid),tarefaId:x.__sourceId,tarefaGrupoId:clean(x.tarefaGrupoId),nomeTarefa:x.__task.name,diaSemana:dayFullFor(x.__date),dataAgendada:x.__date,horaSugeridaInicio:x.__task.start,horaSugeridaFim:x.__task.end,...alarmSchedule(x),momentos,versaoAgenda:3,ativo,origem:'ADM',bloqueado:ativo,schedulerPendente:true,schedulerVersao:1,schedulerSolicitadoEm:now,atualizadoEm:now,...(ativo?{acionadoEm:now,acionadoPor:'ADM'}:{encerradoEm:now,encerradoPor:'ADM'})};
      await fs.setDoc(fs.doc(db,'despertadores',alarmKey(groupId(),x.__pid,x.__sourceId)),payload,{merge:true});
      await fs.addDoc(fs.collection(db,'despertadorHistorico'),{...payload,evento:ativo?'ativado-na-data':'retirado-da-data',criadoEm:fs.serverTimestamp()});
      await log(ativo?'sprint2.monitor_v3_alarme_ativado':'sprint2.monitor_v3_alarme_retirado',{tarefaIdentificada:!!x.__sourceId});
      msg.textContent=ativo?'Alarme ativado.':'Alarme retirado.';if(window.rotinaSprint2SyncLocal)await window.rotinaSprint2SyncLocal('monitor-alarme-cache-local').catch(()=>{});setTimeout(()=>{closeModal();render(false)},350);
    }catch(e){msg.textContent='Não foi possível salvar o alarme.';await log('sprint2.monitor_v3_alarme_erro',{mensagem:String(e?.message||e).slice(0,70)},'error')}
  };
  m.querySelector('#mv2AlarmOn').onclick=()=>command(true);m.querySelector('#mv2AlarmOff').onclick=()=>command(false);
}
function originalOutcome(x){
  const max=maxPoints(x),points=Number.isFinite(Number(x.pontosOriginais))?Number(x.pontosOriginais):wonPoints(x),pct=Number.isFinite(Number(x.percentualOriginal))?Number(x.percentualOriginal):(storedPercentage(x)??0);return{max,points,pct};
}
async function applyReview(x,type,targetPct=null,msg){
  try{
    if(!x.__historyId)throw new Error('Histórico não identificado');if(!await firebaseReady())throw new Error('Firebase indisponível');
    const o=originalOutcome(x),batch=fs.writeBatch(db),histRef=fs.doc(db,'historico',x.__historyId),execRef=x.__sourceId?fs.doc(db,'execucoes',`${x.__date}__${x.__sourceId}`):null,execSnap=execRef?await fs.getDoc(execRef).catch(()=>null):null;
    let patch;
    if(type==='reverter')patch={pontosGanhos:o.points,pontosOriginais:o.points,percentualOriginal:o.pct,revisaoStatus:'aguardando',percentualRevisado:fs.deleteField(),pontosDevolvidos:fs.deleteField(),revisaoDecisao:fs.deleteField(),revisadoEm:fs.deleteField()};
    else{const pct=type==='manter'?o.pct:Math.max(o.pct,Number(targetPct)||o.pct),points=type==='manter'?o.points:Math.max(o.points,Math.round(o.max*pct/100));patch={pontosGanhos:points,pontosOriginais:o.points,percentualOriginal:o.pct,percentualRevisado:pct,pontosDevolvidos:Math.max(0,points-o.points),revisaoStatus:'revisado',revisaoDecisao:type==='manter'?'manter':`devolver-${pct}`,revisadoEm:new Date().toISOString()}}
    batch.update(histRef,patch);if(execSnap?.exists())batch.update(execRef,patch);await batch.commit();
    await log(type==='reverter'?'sprint2.monitor_v3_justificativa_reverter':'sprint2.monitor_v3_justificativa_decisao',{alvoPct:targetPct===null?-1:Number(targetPct),reversao:type==='reverter'});
    msg.textContent='Decisão registrada na ocorrência.';if(window.rotinaSprint2SyncLocal)await window.rotinaSprint2SyncLocal('monitor-revisao-cache-local').catch(()=>{});setTimeout(()=>{closeModal();render(false)},350);
  }catch(e){msg.textContent=e.message||'Não foi possível registrar a decisão.';await log('sprint2.monitor_v3_justificativa_erro',{mensagem:String(e?.message||e).slice(0,70)},'error')}
}
async function openJustification(x){
  const j=justificationState(x);if(!j)return;const o=originalOutcome(x),reviewed=x.revisaoStatus==='revisado'&&!!x.revisaoDecisao;
  const buttons=reviewed?'<button class="mv2-danger" data-review="reverter">↩️ Reverter decisão</button>':'<button class="mv2-neutral" data-review="manter">Manter resultado automático</button><button class="mv2-neutral" data-review="devolver" data-pct="50">Devolver até 50%</button><button class="mv2-neutral" data-review="devolver" data-pct="75">Devolver até 75%</button><button class="mv2-primary" data-review="devolver" data-pct="100">Devolver até 100%</button>';
  const m=modalBase('🚩 Revisar justificativa',`<p><strong>${esc(x.__task.name)}</strong> · ${esc(participantName(x.__pid))}<br>${esc(x.__task.start)}–${esc(x.__task.end)} · ${esc(x.__date.split('-').reverse().join('/'))}</p><div class="mv2-box mv2-just">${esc(j.text)}</div><div class="mv2-box">Resultado registrado pelo Participante: <strong>${o.pct}%</strong> · <strong>${o.points}/${o.max} pts</strong>${reviewed?`<br>Resultado revisado: <strong>${storedPercentage(x)}%</strong> · <strong>${wonPoints(x)}/${o.max} pts</strong>`:''}</div><div class="mv2-actions">${buttons}</div><div class="mv2-msg" id="mv2JustMsg">${reviewed?'Esta ocorrência já possui decisão. Reverta para escolher novamente.':''}</div>`);
  await log('sprint2.monitor_v3_justificativa_abrir',{temHistorico:!!x.__historyId,revisada:reviewed});
  m.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>{const msg=m.querySelector('#mv2JustMsg');msg.textContent='Registrando…';m.querySelectorAll('[data-review]').forEach(btn=>btn.disabled=true);applyReview(x,b.dataset.review,b.dataset.pct?Number(b.dataset.pct):null,msg)});
}

function patchUi(){
  injectStyle();ensureControls();const note=$('view-monitor')?.querySelector('.integration-note');if(note)note.innerHTML='<b>Monitor V3:</b> o ADM não recalcula a execução. Ele lê a ocorrência oficial registrada pelo Participante; sem ocorrência, a tarefa permanece Pendente.';
  const pill=$('view-monitor')?.querySelector('.activepill');if(pill)pill.textContent='V3 • FONTE ÚNICA';
  const n=$('view-monitor')?.querySelector('.monitor-note');if(n){n.className='monitor-v2-warning monitor-note';n.textContent='Arquitetura desta etapa: ADM configura a regra; Participante registra a execução; Monitor apenas acompanha o resultado. Store central: execuções e conclusões chegam automaticamente; a reconciliação remota periódica permanece como segurança e o botão Atualizar força uma conferência imediata.'}
  const title=$('view-monitor')?.querySelector('h2');if(title)title.textContent='Acompanhamento operacional';const desc=$('view-monitor')?.querySelector('.head p');if(desc)desc.textContent='Previsto x realizado, resultado oficial do Participante, alarmes e revisão de justificativas.';const lastKpi=$('mPending')?.parentElement?.querySelector('small');if(lastKpi)lastKpi.textContent='Pendentes';
}
function reorderMenu(){const nav=$('mainNav'),monitor=$('monitorNavButton');if(!nav||!monitor)return;const participants=[...nav.children].find(b=>/Participantes/.test(b.textContent));if(participants&&monitor.nextElementSibling!==participants)nav.insertBefore(monitor,participants)}
function openMonitor(logOpen=true){
  if(!document.body.classList.contains('rf-auth-ready'))return;document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-monitor'));document.querySelectorAll('#mainNav button').forEach(b=>b.classList.remove('active'));$('monitorNavButton')?.classList.add('active');sessionStorage.setItem('rf-sprint2-integration-route','monitor');history.replaceState(null,'','#monitor');if($('mainScroll'))$('mainScroll').scrollTop=0;render(false);if(logOpen)log('sprint2.monitor_v3_aberto',{filtro:current==='__ALL__'?'todos':'participante'});
}
function bind(){
  if(bound)return true;const nav=$('monitorNavButton'),sel=$('monitorParticipant');if(!nav||!sel||!window.RF_APP)return false;bound=true;patchUi();reorderMenu();nav.addEventListener('click',()=>openMonitor(true));sel.addEventListener('change',()=>{current=sel.value;render(false);log('sprint2.monitor_v3_filtro',{filtro:current==='__ALL__'?'todos':'participante'})});document.querySelectorAll('#mainNav [data-route]').forEach(b=>b.addEventListener('click',()=>{$('monitorNavButton')?.classList.remove('active');sessionStorage.setItem('rf-sprint2-integration-route',b.dataset.route||'inicio')}));
  const observer=new MutationObserver(()=>{if(document.body.classList.contains('rf-auth-ready')){const wanted=sessionStorage.getItem('rf-sprint2-integration-route');if(wanted==='monitor'&&!$('view-monitor')?.classList.contains('active'))setTimeout(()=>openMonitor(false),0)}});observer.observe(document.body,{attributes:true,attributeFilter:['class']});
  if(document.body.classList.contains('rf-auth-ready')&&sessionStorage.getItem('rf-sprint2-integration-route')==='monitor')openMonitor(false);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&$('view-monitor')?.classList.contains('active')&&Date.now()-lastLoadAt>CACHE_TTL_MS)render(true)});window.addEventListener('online',()=>{if($('view-monitor')?.classList.contains('active')&&Date.now()-lastLoadAt>CACHE_TTL_MS)render(true)});window.addEventListener('rotina-sprint2-cache-updated',()=>{if($('view-monitor')?.classList.contains('active'))render(false)});return true;
}

let tries=0;const timer=setInterval(()=>{tries++;if(bind())clearInterval(timer);else if(tries>160)clearInterval(timer)},50);
})();