import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const DIAS=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const hojeISO=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
const dataSelecionada=()=>document.getElementById('filtroData')?.value||document.getElementById('monitorData')?.value||hojeISO();
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const periodoSelecionado=()=>window.rotinaMonitorPeriodoAtual?.()||document.querySelector('#monitorPeriodTabs [data-monitor-periodo].active')?.dataset.monitorPeriodo||'dia';
function datasDoPeriodo(data,periodo){
  const ref=new Date(`${data}T12:00:00`),ini=new Date(ref),fim=new Date(ref);
  if(periodo==='semana'){ini.setDate(ini.getDate()-ini.getDay());fim.setTime(ini.getTime());fim.setDate(fim.getDate()+6);}
  if(periodo==='mes'){ini.setDate(1);fim.setFullYear(ref.getFullYear(),ref.getMonth()+1,0);}
  if(periodo==='ano'){ini.setFullYear(ref.getFullYear(),0,1);fim.setFullYear(ref.getFullYear(),11,31);}
  const datas=[];for(const d=new Date(ini);d<=fim;d.setDate(d.getDate()+1))datas.push(iso(d));return datas;
}
const grupoAtual=()=>String(document.getElementById('displayCodigoCliente')?.textContent||'').trim();
let cache={grupoId:'',at:0,tarefas:[],historico:[]};
let renderToken=0;

function marcados(id){return new Set([...document.querySelectorAll(`#${id} input[type="checkbox"]:checked`)].map(x=>x.value));}
function perfilDaTarefa(t,p){return t.perfilId?p.id===t.perfilId:p.nome===t.perfilNome;}
function registroDoPerfil(h,p){return h.perfilId?h.perfilId===p.id:h.perfilNome===p.nome;}
function formatarSegundos(total){
  if(total===null||total===undefined||total==='')return '--:--';
  const s=Math.max(0,Math.floor(Number(total)||0));
  return `${Math.floor(s/60)}:${pad(s%60)}`;
}
function horaPrecisa(valor,fallback='--:--'){
  if(valor){const d=new Date(valor);if(Number.isFinite(d.getTime()))return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;}
  return fallback?`${fallback}${/^\d{2}:\d{2}$/.test(fallback)?':00':''}`:'--:--';
}
function statusNormalizado(txt=''){
  const t=String(txt).toLowerCase();
  if(t.includes('atrasado')||/(^|[^\d])0%/.test(t))return 'Atrasado';
  if(t.includes('prazo'))return 'No Prazo';
  if(t.includes('andamento'))return 'Em andamento';
  return 'Pendente';
}
function badge(x){
  const status=String(x?.status||'');
  if(status.includes('Atrasado'))return 'badge-falta';
  if(x?.faixaAtraso==='atraso-maior'||status.includes('50%'))return 'badge-50';
  if(x?.faixaAtraso==='atraso-leve'||status.includes('75%'))return 'badge-75';
  if(status.includes('Prazo'))return 'badge-ok';
  if(status.toLowerCase().includes('andamento'))return 'badge-andamento';
  return 'badge-pendente';
}
async function carregar(force=false){
  const grupoId=grupoAtual();
  if(!grupoId||grupoId==='--'||grupoId==='CLI-Gen'||!getApps().length)return null;
  if(!force&&cache.grupoId===grupoId&&Date.now()-cache.at<8000)return cache;
  const db=getFirestore(getApp());
  const [ts,hs]=await Promise.all([
    getDocs(query(collection(db,'tarefas'),where('grupoId','==',grupoId))),
    getDocs(query(collection(db,'historico'),where('grupoId','==',grupoId)))
  ]);
  cache={grupoId,at:Date.now(),tarefas:ts.docs.map(d=>({id:d.id,...d.data()})),historico:hs.docs.map(d=>({id:d.id,...d.data()}))};
  return cache;
}
function perfisVisiveis(dados){
  const select=document.getElementById('filtroIntegrante');
  const id=select?.value||'';
  const usuariosMarcados=marcados('monitorUsuarios');
  const base=[...new Map(dados.tarefas.map(t=>[t.perfilId||`nome:${t.perfilNome}`,{id:t.perfilId||'',nome:t.perfilNome||''}])).values()].filter(p=>p.nome);
  if(id)return base.filter(p=>p.id===id);
  if(usuariosMarcados.size)return base.filter(p=>usuariosMarcados.has(p.nome));
  return base;
}
function ocorrenciaPara(t,p,data,dados){
  const hist=dados.historico.find(h=>h.tarefaId===t.id&&registroDoPerfil(h,p)&&(h.data||h.dataExecucao)===data);
  if(hist)return {...t,...hist,id:t.id,__historico:true};
  const hoje=data===hojeISO();
  const pertenceHoje=(t.dataExecucao||'')===data;
  if(hoje&&((t.status==='Em andamento'&&pertenceHoje)||(t.horarioInicio&&pertenceHoje)))return {...t,__historico:false};
  return {...t,status:'Pendente',horarioInicio:'',horarioTermino:'',inicioExecutadoEm:'',terminoExecutadoEm:'',pontosGanhos:0,percentualAplicado:null,faixaAtraso:'',toleranciaConsumidaSeg:null,toleranciaConsumidaMin:null,justificativaAtraso:'',justificativaRecusada:false,inicioAntecipado:false,__historico:false};
}
function detalheExecucao(x){
  const tolSeg=Math.max(0,Number(x.tempoLimite)||0)*60;
  const temExecucao=Boolean(x.inicioExecutadoEm||x.horarioInicio);
  if(!temExecucao)return `Real: Não executada | Tol: ${formatarSegundos(tolSeg)}`;
  const inicio=horaPrecisa(x.inicioExecutadoEm,x.horarioInicio||'--:--');
  const fim=horaPrecisa(x.terminoExecutadoEm,x.horarioTermino||'--:--');
  const consumido=x.toleranciaConsumidaSeg!==undefined&&x.toleranciaConsumidaSeg!==null?Number(x.toleranciaConsumidaSeg):(x.toleranciaConsumidaMin!==undefined&&x.toleranciaConsumidaMin!==null?Number(x.toleranciaConsumidaMin)*60:null);
  return `Real: ${inicio} até ${fim} | Tol: ${formatarSegundos(tolSeg)}${consumido===null?'':` | Consumido: ${formatarSegundos(consumido)}`}`;
}
function linha(x,p,data,periodo){
  const status=String(x.status||'Pendente');
  const icon=x.icone?`<span class="task-icon-cell">${esc(x.icone)}</span>`:'';
  let detalhe=detalheExecucao(x);
  if(x.justificativaAtraso)detalhe+=` <span class="tooltip-justificativa">🚩 texto<span class="tooltip-texto">${esc(x.justificativaAtraso)}</span></span>`;
  if(x.justificativaRecusada===true)detalhe+=` <span class="tooltip-justificativa" style="color:#6c757d;border-color:#6c757d">Usuário não quis justificar<span class="tooltip-texto">Usuário não quis justificar.</span></span>`;
  const early=x.inicioAntecipado===true?`<button type="button" class="early-start-adm-badge" title="Ver motivo do início antecipado" data-task-name="${esc(x.nome||'')}" data-user="${esc(p.nome)}" data-date="${esc(x.data||x.dataExecucao||'')}" data-schedule="${esc(`${x.horaSugeridaInicio||''} - ${x.horaSugeridaFim||''}`)}" data-early-reason="${esc(x.motivoInicioAntecipado||'')}" data-early-minutes="${esc(x.antecipacaoMin||0)}">🔵 Início antecipado</button>`:'';
  const pontos=`${Number(x.pontosGanhos)||0} / ${Number(x.pontosMaximos)||0} pts`;
  const dataRotulo=periodo==='dia'?'':` · ${data.split('-').reverse().join('/')}`;
  return `<tr data-history-source="${x.__historico?'historico':'programacao'}" data-history-date="${esc(data)}" data-family-task-id="${esc(x.id||x.tarefaId||'')}" data-family-task-group="${esc(x.tarefaGrupoId||'')}" data-family-task-name="${esc(x.nome||'Tarefa')}" data-family-task-day="${esc(x.diaSemana||'')}" data-family-task-time="${esc(x.horaSugeridaInicio||'')}" data-family-profile-id="${esc(p.id||'')}" data-family-profile-name="${esc(p.nome||'')}"><td><strong>${esc(x.horaSugeridaInicio||'--:--')} - ${esc(x.horaSugeridaFim||'--:--')}</strong><div style="font-size:11px;color:#555;margin-top:3px">${detalhe}</div></td><td>${icon}<strong>${esc(x.nome||'Tarefa')}</strong></td><td>${esc(p.nome)}</td><td>${esc(x.diaSemana||'')}${esc(dataRotulo)}</td><td><span class="badge ${badge(x)}">${esc(status)}</span>${early}</td><td>${esc(pontos)}</td></tr>`;
}
async function renderHistoricoMonitor(force=false){
  const meuToken=++renderToken;
  const tbody=document.getElementById('tbodyMonitor');
  if(!tbody)return;
  const dados=await carregar(force);if(!dados||meuToken!==renderToken)return;
  const data=dataSelecionada(),periodo=periodoSelecionado();
  const datas=datasDoPeriodo(data,periodo);if(!datas.length)return;
  const perfis=perfisVisiveis(dados);
  const tarefasMarcadas=marcados('monitorTarefas');
  const statusMarcados=marcados('monitorStatus');
  const ocorrencias=[];
  for(const dataOcorrencia of datas){
    const d=new Date(`${dataOcorrencia}T12:00:00`),dia=DIAS[d.getDay()];
    for(const p of perfis){
      const tarefas=dados.tarefas.filter(t=>perfilDaTarefa(t,p)&&t.diaSemana===dia);
      for(const t of tarefas){
        if(tarefasMarcadas.size&&!tarefasMarcadas.has(t.nome||''))continue;
        const x=ocorrenciaPara(t,p,dataOcorrencia,dados);
        if(statusMarcados.size&&!statusMarcados.has(statusNormalizado(x.status)))continue;
        ocorrencias.push({x,p,data:dataOcorrencia});
      }
    }
  }
  ocorrencias.sort((a,b)=>a.data.localeCompare(b.data)||String(a.x.horaSugeridaInicio||'').localeCompare(String(b.x.horaSugeridaInicio||''))||String(a.p.nome||'').localeCompare(String(b.p.nome||'')));
  const linhas=ocorrencias.map(o=>linha(o.x,o.p,o.data,periodo));
  if(meuToken!==renderToken)return;
  tbody.innerHTML=linhas.join('')||'<tr><td colspan="6" style="text-align:center;color:#777">Nenhum registro encontrado para os filtros e a data selecionada.</td></tr>';
  [...tbody.querySelectorAll('tr')].forEach(r=>[...r.children].forEach((td,i)=>td.dataset.label=['Horário','Tarefa','Integrante','Dia','Status','Pontos'][i]||''));
  window.dispatchEvent(new CustomEvent('rotina-monitor-history-rendered',{detail:{data,periodo,total:linhas.length}}));
}
function instalar(t=0){
  if(window.__rfAdmHistoryMonitorInstalled)return;
  if(typeof window.atualizarMonitor!=='function'){if(t<80)setTimeout(()=>instalar(t+1),100);return;}
  window.__rfAdmHistoryMonitorInstalled=true;
  const original=window.atualizarMonitor;
  window.atualizarMonitor=function(){const r=original.apply(this,arguments);setTimeout(()=>renderHistoricoMonitor(true),0);return r;};
  document.addEventListener('change',e=>{if(['filtroData','filtroIntegrante','monitorData'].includes(e.target?.id))setTimeout(()=>renderHistoricoMonitor(true),0);});
  document.addEventListener('click',e=>{if(e.target?.closest('#monitorAplicar,#monitorLimpar,#rfMonitorDateNav button,#monitorPeriodNav button,#monitorPeriodTabs button,#monitorPeriodNavPro button'))setTimeout(()=>renderHistoricoMonitor(true),40);});
  window.addEventListener('rotina-monitor-period-change',()=>setTimeout(()=>renderHistoricoMonitor(true),0));
  setTimeout(()=>renderHistoricoMonitor(true),120);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>instalar(),{once:true});else instalar();
