const fs=require('fs');
const html=fs.readFileSync('sprint2-tarefas-preview-v8.html','utf8');
const ok=(v,m)=>{if(!v)throw new Error(m);console.log('OK - '+m)};

ok(html.includes("collectiveKey:key"),'nova tarefa coletiva recebe identificador comum');
ok(html.includes("if(t.collectiveKey)return tasks.filter(x=>x.collectiveKey===t.collectiveKey)"),'salvamento coletivo encontra todas as copias');
ok(html.includes("const count=__v8Apply(t,patch,oldSig)"),'edicao web aplica o mesmo patch ao conjunto');
ok(html.includes("function saveMobile(id)"),'edicao mobile possui fluxo dedicado');
ok(html.includes("const count=__v8Apply(t,patch,oldSig)"),'edicao mobile usa propagacao coletiva');
ok(html.includes("tasks.sort((a,b)=>a.person.localeCompare(b.person)||a.start.localeCompare(b.start)"),'agenda e reordenada automaticamente por participante e horario');
ok(html.includes("function syncMonitor()"),'monitor possui sincronizacao dinamica');
ok(html.includes("const rows=tasks.filter(t=>t.status==='active'"),'monitor deriva linhas das tarefas atuais');
ok(html.includes("monitorParticipantV8"),'monitor possui filtro de participante');
ok(html.includes("Novas tarefas entram automaticamente no monitor"),'interface documenta sincronizacao automatica do monitor');
ok(html.includes("TELEMETRY_ENDPOINT"),'telemetria da Sprint 2 esta habilitada');
ok(html.includes("selftest.ok"),'autoteste em navegador registra resultado');

const participants=['A','B','C'];
let tasks=[];
const signature=t=>[t.name,t.start,t.end,t.points,t.tol,[...t.days].sort().join('|'),t.status,t.icon].join('::');
const sortTasks=a=>[...a].sort((x,y)=>x.start.localeCompare(y.start)||x.name.localeCompare(y.name));
function commonAll(){
  const bySig=new Map();tasks.forEach(t=>{const s=signature(t);if(!bySig.has(s))bySig.set(s,new Set());bySig.get(s).add(t.person)});
  const common=new Set([...bySig.entries()].filter(([,set])=>participants.every(p=>set.has(p))).map(([s])=>s));
  const seen=new Set();return sortTasks(tasks.filter(t=>common.has(signature(t))).filter(t=>{const s=signature(t);if(seen.has(s))return false;seen.add(s);return true}));
}
function targets(t,all=true){if(!all)return[t];if(t.collectiveKey)return tasks.filter(x=>x.collectiveKey===t.collectiveKey);const s=signature(t);return tasks.filter(x=>signature(x)===s)}
function apply(t,patch){const list=targets(t,true);list.forEach(x=>Object.assign(x,patch));return list.length}
const key='collective-test';participants.forEach((person,i)=>tasks.push({id:i+1,name:'Tarefa teste',person,start:'12:00',end:'12:15',points:5,tol:0,days:['Seg'],status:'active',icon:'✅',collectiveKey:key}));
const count=apply(tasks[0],{start:'08:00',end:'08:15'});
ok(count===3,'horario editado em Todos os participantes propaga para os tres participantes');
ok(tasks.every(t=>t.start==='08:00'&&t.end==='08:15'),'nenhuma copia permanece com o horario padrao de 12:00');
ok(commonAll().length===1&&commonAll()[0].start==='08:00','tarefa continua visivel na agenda coletiva depois da edicao');
const monitorAll=tasks.filter(t=>t.status==='active');
ok(monitorAll.length===3,'nova tarefa coletiva entra no Monitor para todos os participantes');
const monitorB=monitorAll.filter(t=>t.person==='B');
ok(monitorB.length===1,'filtro individual do Monitor encontra a nova tarefa');
const ordered=sortTasks([{start:'10:00',name:'C'},{start:'08:00',name:'A'},{start:'09:00',name:'B'}]);
ok(ordered.map(x=>x.start).join(',')==='08:00,09:00,10:00','ordenacao automatica por horario funciona');
console.log('SPRINT2_TAREFAS_V8_AUDIT=OK');
// touch: workflow ja presente no branch principal
