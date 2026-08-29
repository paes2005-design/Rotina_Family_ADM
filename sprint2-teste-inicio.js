(function(){
'use strict';
const HOME_VERSION=1;

function injectHomeStyles(){
  if(document.getElementById('sprint2HomeStyles')) return;
  const style=document.createElement('style');
  style.id='sprint2HomeStyles';
  style.textContent=`
  .home-shell{display:grid;gap:14px}.home-hero{background:linear-gradient(135deg,#fff,#f8f4ff);border:1px solid var(--line);border-radius:19px;box-shadow:0 15px 42px rgba(31,24,77,.09);overflow:hidden}.home-head{padding:22px 25px 16px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;border-bottom:1px solid var(--line)}.home-head h2{margin:0 0 5px;font-size:26px}.home-head p{margin:0;color:var(--muted);font-size:13px}.home-live{display:inline-flex;align-items:center;gap:7px;padding:6px 9px;border-radius:999px;background:#e7f8ef;color:#17744e;font-size:10px;font-weight:850;white-space:nowrap}.home-live:before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor}.home-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;padding:16px 20px}.home-metric{border:1px solid var(--line);border-radius:14px;background:#fff;padding:14px;min-width:0}.home-metric small{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;font-weight:850;letter-spacing:.03em}.home-metric strong{display:block;font-size:27px;margin-top:5px}.home-metric span{display:block;color:var(--muted);font-size:10px;margin-top:4px}.home-progress-wrap{padding:0 20px 19px}.home-progress-line{display:flex;justify-content:space-between;gap:10px;color:var(--muted);font-size:11px;margin-bottom:7px}.home-progress{height:9px;background:#ebe8f2;border-radius:999px;overflow:hidden}.home-progress>span{display:block;height:100%;background:linear-gradient(90deg,var(--purple),var(--purple2));border-radius:inherit}.home-columns{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);gap:14px}.home-card{background:#fff;border:1px solid var(--line);border-radius:19px;box-shadow:0 15px 42px rgba(31,24,77,.07);overflow:hidden}.home-card-head{padding:17px 19px;border-bottom:1px solid var(--line)}.home-card-head h3{margin:0 0 4px;font-size:18px}.home-card-head p{margin:0;color:var(--muted);font-size:11px}.home-pending-list{display:grid;gap:8px;padding:12px}.home-pending{display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center;padding:11px;border:1px solid var(--line);border-radius:12px;background:#fff}.home-pending-icon{width:38px;height:38px;border-radius:11px;background:#f7f3ff;display:grid;place-items:center;font-size:19px}.home-pending b{font-size:12px}.home-pending p{margin:3px 0 0;color:var(--muted);font-size:10px}.home-pending .btn{white-space:nowrap}.home-empty{padding:28px 18px;text-align:center;color:var(--muted);font-size:12px}.home-shortcuts{display:grid;grid-template-columns:1fr 1fr;gap:9px;padding:12px}.home-shortcut{border:1px solid #e1dcf4;background:#fff;color:var(--ink);border-radius:13px;padding:13px 10px;text-align:left;font-weight:800;min-height:72px}.home-shortcut span{display:block;font-size:19px;margin-bottom:5px}.home-shortcut small{display:block;color:var(--muted);font-size:9px;font-weight:600;margin-top:3px}.home-summary{grid-column:1/-1}.home-summary-list{display:grid}.home-person{display:grid;grid-template-columns:minmax(170px,1.2fr) 1fr 100px 92px;gap:12px;align-items:center;padding:12px 18px;border-bottom:1px solid var(--line)}.home-person:last-child{border-bottom:0}.home-person-name{display:flex;align-items:center;gap:9px;min-width:0}.home-person-avatar{width:35px;height:35px;border-radius:10px;background:#faf7ff;border:1px solid #ded5f7;display:grid;place-items:center}.home-person-name b{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.home-person-name small{display:block;color:var(--muted);font-size:9px}.home-person-progress{height:7px;background:#eeeaf8;border-radius:999px;overflow:hidden}.home-person-progress span{display:block;height:100%;background:linear-gradient(90deg,var(--purple),#a66cff)}.home-person-stat{text-align:right}.home-person-stat b{display:block;font-size:12px}.home-person-stat small{display:block;color:var(--muted);font-size:9px}.home-method-note{padding:12px 18px;background:#fbf9ff;border-top:1px solid #e7dffa;color:#676d82;font-size:10px;line-height:1.45}.home-method-note b{color:#4b3f73}
  @media(max-width:1050px){.home-metrics{grid-template-columns:repeat(3,1fr)}.home-columns{grid-template-columns:1fr}.home-summary{grid-column:auto}.home-person{grid-template-columns:minmax(160px,1fr) 1fr 88px}}
  @media(max-width:900px){.home-head{padding:17px 14px;align-items:flex-start}.home-head h2{font-size:23px}.home-metrics{grid-template-columns:1fr 1fr;padding:11px 12px;gap:7px}.home-metric{padding:11px;text-align:center}.home-metric strong{font-size:24px}.home-progress-wrap{padding:2px 12px 15px}.home-columns{gap:10px}.home-shortcuts{grid-template-columns:1fr 1fr}.home-person{grid-template-columns:1fr 82px;padding:11px 13px}.home-person-progress{grid-column:1/-1;grid-row:2}.home-person-stat.points{display:none}}
  @media(max-width:480px){.home-head{display:block}.home-live{margin-top:10px}.home-metrics{grid-template-columns:1fr 1fr}.home-metric:last-child{grid-column:1/-1}.home-shortcuts{grid-template-columns:1fr}.home-pending{grid-template-columns:38px 1fr}.home-pending .btn{grid-column:1/-1;width:100%}.home-person{grid-template-columns:1fr 74px}}
  `;
  document.head.appendChild(style);
}

function activePairs(){
  const pairs=[];
  state.tasks.filter(t=>t.status==='active').forEach(task=>{
    (task.targets||[]).forEach(participantId=>pairs.push({task,participantId,execution:state.executions[`${task.id}::${participantId}`]||{start:'',end:'',status:'pending',points:`0/${task.points||0}`}}));
  });
  return pairs;
}
function pointsEarned(execution){
  const raw=String(execution?.points||'0').split('/')[0];
  const n=Number(raw);return Number.isFinite(n)?n:0;
}
function dashboardStats(){
  const pairs=activePairs();
  const concluded=pairs.filter(x=>['ok','late'].includes(x.execution.status)).length;
  const running=pairs.filter(x=>x.execution.status==='running').length;
  const pending=pairs.filter(x=>!['ok','late','running'].includes(x.execution.status)).length;
  const late=pairs.filter(x=>x.execution.status==='late').length;
  const earned=pairs.reduce((sum,x)=>sum+pointsEarned(x.execution),0);
  const possible=pairs.reduce((sum,x)=>sum+Number(x.task.points||0),0);
  const completion=pairs.length?Math.round(concluded/pairs.length*100):0;
  return {pairs,expected:pairs.length,concluded,running,pending,late,earned,possible,completion};
}
function pendingItems(stats){
  const items=[];
  const rewardPending=state.requests.filter(r=>r.status==='Pendente').length;
  const conquestPending=state.conquests.filter(c=>c.rt&&c.rt.pending).length;
  if(rewardPending)items.push({icon:'🎁',title:`${rewardPending} ${rewardPending===1?'resgate pendente':'resgates pendentes'}`,text:'Solicitação aguardando decisão do ADM.',action:'reward',label:'Analisar'});
  if(conquestPending)items.push({icon:'🏆',title:`${conquestPending} ${conquestPending===1?'conquista para validar':'conquistas para validar'}`,text:'Meta atingida aguardando validação do ADM.',action:'conquest',label:'Validar'});
  if(stats.late)items.push({icon:'⏱️',title:`${stats.late} ${stats.late===1?'tarefa concluída com atraso':'tarefas concluídas com atraso'}`,text:'Verifique o ocorrido no Monitor antes de qualquer ação.',action:'monitor',label:'Ver monitor'});
  if(stats.pending)items.push({icon:'⚠️',title:`${stats.pending} ${stats.pending===1?'tarefa pendente':'tarefas pendentes'}`,text:'Itens previstos ainda sem conclusão no cenário de teste.',action:'monitor',label:'Acompanhar'});
  return items;
}
function participantRows(){
  return state.participants.map(p=>{
    const pairs=activePairs().filter(x=>x.participantId===p.id);
    const done=pairs.filter(x=>['ok','late'].includes(x.execution.status)).length;
    const earned=pairs.reduce((sum,x)=>sum+pointsEarned(x.execution),0);
    const possible=pairs.reduce((sum,x)=>sum+Number(x.task.points||0),0);
    const pct=pairs.length?Math.round(done/pairs.length*100):0;
    return {p,expected:pairs.length,done,earned,possible,pct};
  });
}
function renderInicio(){
  const host=$('view-inicio');if(!host)return;
  const stats=dashboardStats(),pendings=pendingItems(stats),people=participantRows();
  host.innerHTML=`<div class="home-shell">
    <section class="home-hero">
      <div class="home-head"><div><div class="crumb">Início • Parte 3 em teste</div><h2>Hoje</h2><p>Visão rápida do dia: situação da rotina, pontos e itens que exigem atenção.</p></div><span class="home-live">DADOS DO TESTE</span></div>
      <div class="home-metrics">
        <div class="home-metric"><small>Previstas</small><strong>${stats.expected}</strong><span>tarefas do cenário</span></div>
        <div class="home-metric"><small>Concluídas</small><strong>${stats.concluded}</strong><span>${stats.late?`${stats.late} com atraso`:'sem atraso registrado'}</span></div>
        <div class="home-metric"><small>Em andamento</small><strong>${stats.running}</strong><span>execução aberta</span></div>
        <div class="home-metric"><small>Pendentes</small><strong>${stats.pending}</strong><span>ainda sem conclusão</span></div>
        <div class="home-metric"><small>Pontos hoje</small><strong>${stats.earned}</strong><span>de ${stats.possible} possíveis</span></div>
      </div>
      <div class="home-progress-wrap"><div class="home-progress-line"><b>${stats.concluded} de ${stats.expected} concluídas</b><span>${stats.completion}% do previsto</span></div><div class="home-progress"><span style="width:${Math.max(0,Math.min(100,stats.completion))}%"></span></div></div>
    </section>
    <div class="home-columns">
      <section class="home-card"><div class="home-card-head"><h3>Pendências</h3><p>Somente situações que merecem leitura ou ação do administrador.</p></div><div class="home-pending-list">${pendings.length?pendings.map((x,i)=>`<div class="home-pending"><div class="home-pending-icon">${x.icon}</div><div><b>${esc(x.title)}</b><p>${esc(x.text)}</p></div><button class="btn" data-home-action="${x.action}">${esc(x.label)}</button></div>`).join(''):'<div class="home-empty">Nenhuma pendência no cenário atual.</div>'}</div></section>
      <section class="home-card"><div class="home-card-head"><h3>Atalhos</h3><p>Acesso rápido, sem duplicar formulários no Dashboard.</p></div><div class="home-shortcuts">
        <button class="home-shortcut" data-home-action="new-task"><span>＋📝</span>Nova tarefa<small>abre Tarefas</small></button>
        <button class="home-shortcut" data-home-action="new-participant"><span>＋👤</span>Novo participante<small>abre Participantes</small></button>
        <button class="home-shortcut" data-home-action="monitor"><span>👁️</span>Monitor<small>acompanhar o dia</small></button>
        <button class="home-shortcut" data-home-action="reward"><span>🎁</span>Resgates pendentes<small>ir para Recompensas</small></button>
        <button class="home-shortcut" data-home-action="conquest"><span>🏆</span>Conquistas pendentes<small>validar metas</small></button>
      </div></section>
      <section class="home-card home-summary"><div class="home-card-head"><h3>Resumo do dia por participante</h3><p>Leitura gerencial curta; os detalhes continuam no Monitor.</p></div><div class="home-summary-list">${people.map(x=>`<div class="home-person"><div class="home-person-name"><div class="home-person-avatar">${pIcon(x.p.theme)}</div><div><b>${esc(x.p.name)}</b><small>${x.done}/${x.expected} tarefas concluídas</small></div></div><div><div class="home-person-progress"><span style="width:${Math.max(0,Math.min(100,x.pct))}%"></span></div></div><div class="home-person-stat points"><b>${x.earned}/${x.possible}</b><small>pontos</small></div><div class="home-person-stat"><b>${x.pct}%</b><small>conclusão</small></div></div>`).join('')}</div><div class="home-method-note"><b>Princípio da tela:</b> visualizar o estado, identificar a restrição/pendência e agir pelo módulo correto. O Dashboard informa; Monitor e módulos específicos executam o detalhe.</div></section>
    </div>
  </div>`;
  host.querySelectorAll('[data-home-action]').forEach(btn=>btn.onclick=()=>homeAction(btn.dataset.homeAction));
  techLog('inicio_render',{previstas:stats.expected,concluidas:stats.concluded,pendentes:stats.pending,acoes:pendings.length});
}
function homeAction(action){
  techLog('inicio_atalho',{atalho:action});
  if(action==='new-task'){setRoute('tarefas');addTask();return;}
  if(action==='new-participant'){setRoute('participantes');openParticipant(null);return;}
  if(action==='monitor'){setRoute('monitor');return;}
  if(action==='reward'){setRoute('recompensas');$('requestStatus').value='Pendente';renderRewards();$('rewardsCard').scrollIntoView({behavior:'smooth',block:'start'});return;}
  if(action==='conquest'){setRoute('recompensas');$('conquestStatus').value='pending';renderConquests();$('conquestsCard').scrollIntoView({behavior:'smooth',block:'start'});}
}

injectHomeStyles();
const baseSetRoute=setRoute;
setRoute=function(r){baseSetRoute(r);if(r==='inicio')renderInicio();};
const baseSelfTest=selfTest;
selfTest=function(){
  const report=baseSelfTest();
  setRoute('inicio');
  const extra=[
    {name:'dashboard Parte 3 renderizado',ok:!!document.querySelector('.home-shell')},
    {name:'dashboard 5 indicadores',ok:document.querySelectorAll('.home-metric').length===5},
    {name:'dashboard pendencias',ok:!!document.querySelector('.home-pending-list')},
    {name:'dashboard atalhos',ok:document.querySelectorAll('.home-shortcut').length===5},
    {name:'dashboard resumo participantes',ok:document.querySelectorAll('.home-person').length===state.participants.length}
  ];
  report.results.push(...extra);report.total=report.results.length;report.passed=report.results.filter(x=>x.ok).length;
  $('selfTestReport').textContent=JSON.stringify(report);document.body.dataset.selftest=`${report.passed}/${report.total}`;
  techLog('selftest_dashboard',{aprovados:extra.filter(x=>x.ok).length,total:extra.length},extra.every(x=>x.ok)?'info':'error');
  return report;
};
window.RF.selfTest=selfTest;
window.RF.renderInicio=renderInicio;
renderInicio();
techLog('inicio_module_loaded',{versao:HOME_VERSION});
})();
