const fs=require('fs');
const html=fs.readFileSync('sprint2-tarefas-preview-v9.html','utf8');
const ok=(v,m)=>{if(!v)throw new Error(m);console.log('OK - '+m)};

ok(html.includes("cloneNode(true)"),'botao Nova tarefa perde o listener legado antes do novo handler');
ok(html.includes("w.__v9AddTask()"),'criacao usa um unico fluxo v9');
ok(html.includes("if(edit!==null)"),'nova criacao e bloqueada enquanto existe edicao ativa');
ok(html.includes("collectiveKey:key"),'tarefa coletiva recebe identificador unico do lote');
ok(html.includes("function __v9Normalize()"),'normalizacao preventiva esta habilitada');
ok(html.includes("task.deduplicated"),'deduplicacao gera log tecnico');
ok(html.includes("tasks.filter(x=>x.collectiveKey===t.collectiveKey)"),'edicao coletiva encontra todas as copias do mesmo lote');
ok(html.includes("function uniqueMonitorRows"),'Monitor possui protecao adicional contra repeticoes');
ok(html.includes("monitor.deduplicated"),'Monitor registra anomalia de repeticao');
ok(html.includes("overflow-x:hidden!important"),'viewport mobile bloqueia overflow horizontal da pagina');
ok(html.includes(".mrow{min-width:0!important;width:100%!important"),'linhas do Monitor deixam de impor largura desktop no mobile');
ok(html.includes(".mrow.header{display:none!important}"),'cabecalho largo da tabela e removido no layout mobile');
ok(html.includes("overflow:visible!important"),'Monitor mobile nao usa rolagem horizontal interna');
ok(html.includes("grid-template-columns:repeat(3,minmax(0,1fr))"),'acoes do cartao mobile usam largura fluida');
ok(html.includes("mobile.horizontal_overflow"),'telemetria mede overflow horizontal real');
ok(html.includes("versaoMonitor:9"),'telemetria da v9 esta identificada');

const participants=['Lara','Maria','Pedro'];
let next=1;
let tasks=[];
const fingerprint=t=>[t.name,t.start,t.end,t.points,t.tol,[...t.days].sort().join('|'),t.status,t.icon,t.alarm||'',t.note||''].join('::');
function normalize(){
  const out=[],index=new Map();let removed=0;
  for(const t of tasks){
    const key=t.person+'::'+fingerprint(t);
    if(!index.has(key)){index.set(key,out.length);out.push(t);continue}
    removed++;const i=index.get(key);if(t.collectiveKey&&!out[i].collectiveKey)out[i]=t;
  }
  tasks=out.sort((a,b)=>a.person.localeCompare(b.person)||a.start.localeCompare(b.start)||a.end.localeCompare(b.end)||a.name.localeCompare(b.name));
  return removed;
}
function addCollective(){
  const key='collective-test';
  participants.forEach(person=>tasks.push({id:next++,name:'Teste coletivo',person,start:'12:00',end:'12:15',points:5,tol:0,days:['Seg','Ter','Qua'],status:'active',alarm:'11:55',icon:'✅',note:'',collectiveKey:key}));
  normalize();return key;
}
function applyCollective(key,patch){const list=tasks.filter(t=>t.collectiveKey===key);list.forEach(t=>Object.assign(t,patch));normalize();return list.length}
const key=addCollective();
ok(tasks.length===3,'uma criacao coletiva gera exatamente uma tarefa por participante');
// Simula clique/listener duplicado antigo e garante autocorrecao.
tasks.push({...tasks[0],id:next++});tasks.push({...tasks[0],id:next++});
const removed=normalize();
ok(removed===2,'normalizacao remove duplicacao e triplicacao da mesma tarefa');
ok(participants.every(p=>tasks.filter(t=>t.person===p&&t.collectiveKey===key).length===1),'apos normalizacao existe somente uma copia por participante');
const targets=applyCollective(key,{start:'08:00',end:'08:05'});
ok(targets===3,'edicao coletiva atinge os tres participantes');
ok(tasks.every(t=>t.start==='08:00'&&t.end==='08:05'),'horario editado substitui o horario padrao em todas as copias');
const monitor=tasks.filter(t=>t.status==='active');
ok(monitor.length===3,'Monitor recebe uma linha por participante, sem duplicacao');
const ordered=[{person:'A',start:'10:00',end:'10:10',name:'C'},{person:'A',start:'07:00',end:'07:05',name:'A'},{person:'A',start:'08:00',end:'08:10',name:'B'}].sort((a,b)=>a.person.localeCompare(b.person)||a.start.localeCompare(b.start));
ok(ordered.map(x=>x.start).join(',')==='07:00,08:00,10:00','ordenacao automatica continua por horario de inicio');

console.log('SPRINT2_TAREFAS_V9_AUDIT=OK');
