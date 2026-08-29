(function(){
'use strict';
const BUILD='inicio-v3';
const SCENARIO_DATE='2026-08-29';
let analysisPeriod='day';
let analysisRef=SCENARIO_DATE;
let analysisParticipant='all';

function rowsAll(){
  const rows=[];
  for(const task of state.tasks){
    if(task.status==='inactive') continue;
    for(const participantId of task.targets||[]){
      const ex=state.executions[`${task.id}::${participantId}`]||{start:'',end:'',status:'pending',points:`0/${task.points||0}`};
      rows.push({task,participantId,ex,date:SCENARIO_DATE});
    }
  }
  return rows;
}

function pointsFrom(row){
  const raw=String(row.ex.points||`0/${row.task.points||0}`).split('/');
  return {done:Number(raw[0])||0,possible:Number(raw[1])||Number(row.task.points)||0};
}

function setText(id,value){const el=$(id);if(el)el.textContent=String(value)}
function isoDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function dateFromIso(v){const [y,m,d]=String(v||SCENARIO_DATE).split('-').map(Number);return new Date(y||2026,(m||8)-1,d||29,12,0,0)}
function bounds(refIso,period){
  const ref=dateFromIso(refIso);
  if(period==='day') return {start:refIso,end:refIso,label:ref.toLocaleDateString('pt-BR')};
  if(period==='month'){
    const start=`${ref.getFullYear()}-${String(ref.getMonth()+1).padStart(2,'0')}-01`;
    const end=isoDate(new Date(ref.getFullYear(),ref.getMonth()+1,0,12));
    return {start,end,label:ref.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})};
  }
  const startD=new Date(ref);startD.setDate(startD.getDate()-startD.getDay());
  const endD=new Date(startD);endD.setDate(endD.getDate()+6);
  return {start:isoDate(startD),end:isoDate(endD),label:`${startD.toLocaleDateString('pt-BR')} a ${endD.toLocaleDateString('pt-BR')}`};
}
function inBounds(date,b){return date>=b.start&&date<=b.end}
function participantName(id){return state.participants.find(p=>p.id===id)?.name||id}
function participantRows(rows,id){return id==='all'?rows:rows.filter(r=>r.participantId===id)}

function actionCard(icon,title,count,text,route,target){
  const disabled=count===0?' is-clear':'';
  return `<button class="dash-pending-item${disabled}" onclick="RFInicio.go('${route}','${target||''}')"><span class="dash-pending-icon">${icon}</span><span><b>${count} ${esc(title)}</b><small>${esc(text)}</small></span><span class="dash-arrow">›</span></button>`;
}

function participantLine(participant,rows){
  const mine=rows.filter(x=>x.participantId===participant.id);
  const done=mine.filter(x=>['ok','late'].includes(x.ex.status)).length;
  const pts=mine.reduce((sum,row)=>sum+pointsFrom(row).done,0);
  const pct=mine.length?Math.round(done*100/mine.length):0;
  return `<button class="dash-person" onclick="RFInicio.openParticipant('${participant.id}')"><span class="dash-person-avatar">${pIcon(participant.theme)}</span><span class="dash-person-main"><b>${esc(participant.name)}</b><small>${done}/${mine.length} tarefas concluídas</small><span class="dash-mini-progress"><i style="width:${pct}%"></i></span></span><span class="dash-person-points">${pts} pts</span><span class="dash-arrow">›</span></button>`;
}

function ensureAnalysisShell(){
  if($('dashAnalysis')) return;
  const host=$('dashboardHome'); if(!host)return;
  host.insertAdjacentHTML('beforeend',`
    <section class="dash-analysis" id="dashAnalysis">
      <div class="dash-analysis-head">
        <div><div class="crumb">Análise gerencial • Preview V3</div><h2>Desempenho</h2><p>Classificação geral separada da análise individual.</p></div>
        <div class="dash-period-tabs" id="dashPeriodTabs">
          <button data-period="day" class="active">Dia</button>
          <button data-period="week">Semana</button>
          <button data-period="month">Mês</button>
        </div>
      </div>
      <div class="dash-filterbar">
        <label>Data de referência<input type="date" id="dashAnalysisDate" value="${SCENARIO_DATE}"></label>
        <label>Analisar integrante<select id="dashAnalysisParticipant"><option value="all">Todos</option></select><small class="dash-filter-help">Este filtro não altera líder, pódio ou ranking geral.</small></label>
        <div class="dash-period-label"><small>Período analisado</small><b id="dashAnalysisPeriodLabel">—</b></div>
      </div>

      <section class="dash-scope dash-scope-general" id="dashGeneralScope">
        <div class="dash-scope-head">
          <div><span class="dash-scope-kicker">VISÃO GERAL DO GRUPO</span><h3>Classificação do período</h3><p>Líder, pódio e ranking usam sempre todos os participantes. Só mudam com Dia/Semana/Mês ou data.</p></div>
          <span class="dash-scope-lock">🔒 Sem filtro individual</span>
        </div>
        <div class="dash-general-leader" id="dashGeneralLeader"></div>
        <div class="dash-analysis-grid dash-general-grid">
          <article class="dash-analysis-panel">
            <div class="dash-panel-head"><div><h3>🏆 Pódio do período</h3><p>1º, 2º e 3º lugares do grupo.</p></div></div>
            <div class="dash-podium" id="dashPodium"></div>
          </article>
          <article class="dash-analysis-panel">
            <div class="dash-panel-head"><div><h3>📊 Pontos por participante</h3><p>Comparação entre todos no período selecionado.</p></div></div>
            <div class="dash-chart" id="dashPointsChart"></div>
          </article>
          <article class="dash-analysis-panel dash-ranking-panel">
            <div class="dash-panel-head"><div><h3>Ranking geral detalhado</h3><p>Classificação do grupo, independente do integrante escolhido abaixo.</p></div></div>
            <div class="dash-ranking" id="dashDetailedRanking"></div>
          </article>
        </div>
      </section>

      <section class="dash-scope dash-scope-individual" id="dashIndividualScope">
        <div class="dash-scope-head">
          <div><span class="dash-scope-kicker">DESEMPENHO FILTRÁVEL</span><h3 id="dashIndividualTitle">Todos os participantes</h3><p>Esta área responde ao filtro “Analisar integrante”.</p></div>
          <span class="dash-scope-person" id="dashIndividualBadge">Todos</span>
        </div>
        <div class="dash-analysis-kpis" id="dashAnalysisKpis"></div>
        <div class="dash-analysis-grid dash-individual-grid">
          <article class="dash-analysis-panel">
            <div class="dash-panel-head"><div><h3>✅ Cumprimento das tarefas</h3><p>No prazo, atrasadas, em andamento e pendentes do recorte escolhido.</p></div></div>
            <div class="dash-chart" id="dashStatusChart"></div>
          </article>
          <article class="dash-analysis-panel">
            <div class="dash-panel-head"><div><h3>📈 Evolução dos últimos 7 dias</h3><p>Evolução do grupo ou do integrante selecionado.</p></div></div>
            <div class="dash-chart" id="dashTrendChart"></div>
          </article>
        </div>
      </section>
      <div class="dash-analysis-note">Cenário de teste: as execuções de tarefas disponíveis estão concentradas em <b>29/08/2026</b>. Por isso a evolução de 7 dias mostra zero onde não há histórico de execução no fixture. Na integração oficial, essa área deve consumir o histórico real, como o Dashboard atual.</div>
    </section>`);
  const participant=$('dashAnalysisParticipant');
  participant.innerHTML='<option value="all">Todos</option>'+state.participants.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  $('dashAnalysisDate').addEventListener('change',e=>{analysisRef=e.target.value||SCENARIO_DATE;renderAnalytics()});
  participant.addEventListener('change',e=>{analysisParticipant=e.target.value||'all';renderAnalytics()});
  $('dashPeriodTabs').querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{
    analysisPeriod=btn.dataset.period;
    $('dashPeriodTabs').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===btn));
    renderAnalytics();
  }));
  const tag=document.querySelector('.dash-date');if(tag)tag.textContent='PREVIEW V3';
  const version=document.querySelector('.version');if(version)version.textContent='Sprint 2 • teste completo v6 • Início v3';
}

function svgBars(items){
  if(!items.length)return '<div class="dash-chart-empty">Sem dados no período.</div>';
  const max=Math.max(1,...items.map(x=>x.points)),w=620,h=Math.max(190,items.length*48+36),left=120,right=46,bw=w-left-right;
  let s=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Pontos por participante">`;
  items.forEach((x,i)=>{
    const y=18+i*48,bar=Math.max(2,(x.points/max)*bw);
    s+=`<text x="${left-10}" y="${y+18}" text-anchor="end" font-size="12" fill="#626b7e">${esc(x.name.slice(0,17))}</text><rect x="${left}" y="${y+4}" width="${bar}" height="22" rx="8" fill="#6b35df" opacity="${Math.max(.55,.92-i*.08)}"/><text x="${Math.min(w-34,left+bar+8)}" y="${y+20}" font-size="11" font-weight="800" fill="#4b3f73">${x.points} pts</text>`;
  });
  return s+'</svg>';
}

function svgStatus(counts){
  const vals=[counts.ok,counts.late,counts.running,counts.pending],labels=['No prazo','Atrasadas','Em andamento','Pendentes'],fills=['#1c9b67','#e45454','#3478d4','#d98a00'];
  const total=Math.max(1,vals.reduce((a,b)=>a+b,0)),w=620;let x=28;
  let s=`<svg viewBox="0 0 ${w} 235" role="img" aria-label="Cumprimento das tarefas"><rect x="28" y="42" width="564" height="34" rx="12" fill="#ececf3"/>`;
  vals.forEach((v,i)=>{const ww=v/total*564;if(ww>0){s+=`<rect x="${x}" y="42" width="${ww}" height="34" fill="${fills[i]}"/>`;x+=ww}});
  vals.forEach((v,i)=>{const col=i%2,row=Math.floor(i/2),cx=85+col*290,cy=125+row*56;s+=`<circle cx="${cx}" cy="${cy}" r="6" fill="${fills[i]}"/><text x="${cx+14}" y="${cy+4}" font-size="12" fill="#626b7e">${labels[i]}: ${v}</text><text x="${cx}" y="${cy+29}" font-size="17" font-weight="800" fill="#34394c">${Math.round(v/total*100)}%</text>`});
  return s+'</svg>';
}

function svgTrend(points){
  const w=620,h=230,l=42,r=22,t=24,b=44,max=Math.max(1,...points.map(x=>x.value)),pw=w-l-r,ph=h-t-b;
  const coords=points.map((p,i)=>({x:l+i*(pw/Math.max(1,points.length-1)),y:t+ph-(p.value/max)*ph,...p}));
  let s=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Evolução de pontos nos últimos sete dias">`;
  [0,.5,1].forEach(k=>{const yy=t+ph-k*ph;s+=`<line x1="${l}" y1="${yy}" x2="${w-r}" y2="${yy}" stroke="#ececf3"/><text x="${l-7}" y="${yy+4}" text-anchor="end" font-size="10" fill="#8a90a1">${Math.round(max*k)}</text>`});
  s+=`<polyline fill="none" stroke="#6b35df" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" points="${coords.map(c=>`${c.x},${c.y}`).join(' ')}"/>`;
  coords.forEach(c=>s+=`<circle cx="${c.x}" cy="${c.y}" r="5" fill="#fff" stroke="#6b35df" stroke-width="3"/><text x="${c.x}" y="${h-15}" text-anchor="middle" font-size="10" fill="#72788f">${c.label}</text>`);
  return s+'</svg>';
}

function renderPodium(items){
  const top=items.slice(0,3),slots=[top[1],top[0],top[2]],classes=['second','first','third'],medals=['🥈','🥇','🥉'];
  return slots.map((x,i)=>x?`<div class="dash-podium-card ${classes[i]}"><span>${medals[i]}</span><b>${esc(x.name)}</b><small>${x.points} pts • ${x.done}/${x.expected} concluídas</small></div>`:'<div></div>').join('');
}

function renderRanking(items){
  if(!items.length)return '<div class="dash-chart-empty">Sem dados no período.</div>';
  return `<table><thead><tr><th>#</th><th>Integrante</th><th>Pontos</th><th>Conclusão</th><th>Pontualidade</th><th>Atenção</th></tr></thead><tbody>${items.map((x,i)=>`<tr><td>${i+1}º</td><td><b>${esc(x.name)}</b></td><td>${x.points}</td><td>${x.completion}%</td><td>${x.punctuality}%</td><td>${x.attention}</td></tr>`).join('')}</tbody></table>`;
}

function peopleMetrics(rows){
  return state.participants.map(p=>{
    const mine=rows.filter(r=>r.participantId===p.id);
    const done=mine.filter(r=>['ok','late'].includes(r.ex.status)).length;
    const ontime=mine.filter(r=>r.ex.status==='ok').length;
    const points=mine.reduce((s,r)=>s+pointsFrom(r).done,0);
    const attention=mine.filter(r=>['late','pending'].includes(r.ex.status)).length;
    return {id:p.id,name:p.name,points,expected:mine.length,done,completion:mine.length?Math.round(done/mine.length*100):0,punctuality:done?Math.round(ontime/done*100):0,attention};
  }).sort((a,b)=>b.points-a.points||b.completion-a.completion||a.name.localeCompare(b.name,'pt-BR'));
}

function renderAnalytics(){
  ensureAnalysisShell();
  const b=bounds(analysisRef,analysisPeriod);setText('dashAnalysisPeriodLabel',b.label);
  const allRows=rowsAll();
  const groupRows=inBounds(SCENARIO_DATE,b)?allRows:[];
  const groupPeople=peopleMetrics(groupRows);
  const groupLeader=groupPeople.find(p=>p.points>0);

  $('dashGeneralLeader').innerHTML=`<div class="dash-leader-card"><small>🏆 LÍDER GERAL DO PERÍODO</small><strong>${groupLeader?esc(groupLeader.name):'—'}</strong><em>${groupLeader?groupLeader.points+' pts':'Sem pontos no período'}</em><span>Classificação do grupo • não recebe filtro individual</span></div>`;
  $('dashPodium').innerHTML=renderPodium(groupPeople);
  $('dashPointsChart').innerHTML=svgBars(groupPeople);
  $('dashDetailedRanking').innerHTML=renderRanking(groupPeople);

  const filteredRows=participantRows(groupRows,analysisParticipant);
  const selectedName=analysisParticipant==='all'?'Todos os participantes':participantName(analysisParticipant);
  setText('dashIndividualTitle',analysisParticipant==='all'?'Desempenho consolidado do grupo':`Desempenho de ${selectedName}`);
  setText('dashIndividualBadge',analysisParticipant==='all'?'Todos':selectedName);

  const achieved=filteredRows.reduce((s,r)=>s+pointsFrom(r).done,0);
  const completed=filteredRows.filter(r=>['ok','late'].includes(r.ex.status)).length;
  const ontime=filteredRows.filter(r=>r.ex.status==='ok').length;
  const punctuality=completed?Math.round(ontime/completed*100):0;
  const requests=state.requests.filter(r=>inBounds(r.date||'',b)&&(analysisParticipant==='all'||r.participantId===analysisParticipant));
  const redeemed=requests.filter(r=>r.status==='Aprovado').reduce((s,r)=>s+(Number(r.points)||0),0);
  const pendingPoints=requests.filter(r=>r.status==='Pendente').reduce((s,r)=>s+(Number(r.points)||0),0);
  const redeemedPct=achieved?Math.round(redeemed/achieved*100):0;

  $('dashAnalysisKpis').innerHTML=`
    <div class="dash-analysis-kpi"><small>⭐ Alcançado</small><strong>${achieved} pts</strong><em>${analysisParticipant==='all'?'Total do grupo':'Pontos do integrante'}</em></div>
    <div class="dash-analysis-kpi"><small>🎁 Resgatado</small><strong>${redeemed} pts</strong><em>Pedidos aprovados</em></div>
    <div class="dash-analysis-kpi"><small>📉 % resgatado</small><strong>${redeemedPct}%</strong><em>Resgatado ÷ alcançado</em></div>
    <div class="dash-analysis-kpi"><small>⏳ Pendente</small><strong>${pendingPoints} pts</strong><em>Aguardando decisão</em></div>
    <div class="dash-analysis-kpi"><small>✅ Pontualidade</small><strong>${punctuality}%</strong><em>${ontime} de ${completed} concluídas</em></div>
    <div class="dash-analysis-kpi muted-kpi"><small>🔥 Maior sequência</small><strong>—</strong><em>Fixture sem histórico diário suficiente</em></div>`;

  $('dashStatusChart').innerHTML=svgStatus({
    ok:filteredRows.filter(r=>r.ex.status==='ok').length,
    late:filteredRows.filter(r=>r.ex.status==='late').length,
    running:filteredRows.filter(r=>r.ex.status==='running').length,
    pending:filteredRows.filter(r=>r.ex.status==='pending').length
  });

  const ref=dateFromIso(analysisRef),trend=[];
  for(let i=6;i>=0;i--){
    const d=new Date(ref);d.setDate(d.getDate()-i);const key=isoDate(d);
    const dayRows=key===SCENARIO_DATE?participantRows(allRows,analysisParticipant):[];
    trend.push({label:d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.',''),value:dayRows.reduce((s,r)=>s+pointsFrom(r).done,0)});
  }
  $('dashTrendChart').innerHTML=svgTrend(trend);
  techLog('dashboard_analysis_render',{build:BUILD,periodo:analysisPeriod,linhasGrupo:groupRows.length,linhasRecorte:filteredRows.length,filtroIndividual:analysisParticipant!=='all',pontos:achieved,pedidos:requests.length});
}

function renderInicio(){
  if(!$('dashboardHome')) return;
  ensureAnalysisShell();
  const rows=rowsAll();
  const done=rows.filter(x=>['ok','late'].includes(x.ex.status)).length;
  const running=rows.filter(x=>x.ex.status==='running').length;
  const pending=rows.filter(x=>x.ex.status==='pending').length;
  const late=rows.filter(x=>x.ex.status==='late').length;
  const attention=late+pending;
  const points=rows.reduce((sum,row)=>sum+pointsFrom(row).done,0);
  const possible=rows.reduce((sum,row)=>sum+pointsFrom(row).possible,0);
  const completion=rows.length?Math.round(done*100/rows.length):0;
  const rewardPending=state.requests.filter(x=>x.status==='Pendente').length;
  const conquestPending=state.conquests.filter(x=>x.rt&&x.rt.pending).length;
  setText('dashExpected',rows.length);setText('dashDone',done);setText('dashRunning',running);setText('dashAttention',attention);setText('dashPoints',points);setText('dashPossiblePoints',possible);setText('dashCompletion',completion+'%');
  const bar=$('dashCompletionBar');if(bar)bar.style.width=Math.max(0,Math.min(100,completion))+'%';
  const headline=$('dashHeadline');if(headline)headline.textContent=`${done} de ${rows.length} tarefas concluídas`;
  const pendingBox=$('dashPendingList');
  if(pendingBox)pendingBox.innerHTML=
    actionCard('⚠️','ocorrência(s) para revisar',late,late?'Execuções atrasadas sinalizadas no Monitor.':'Nenhum atraso sinalizado.','monitor','')+
    actionCard('🎁','resgate(s) pendente(s)',rewardPending,rewardPending?'Pedidos aguardando decisão do ADM.':'Nenhum resgate aguardando decisão.','recompensas','rewardsCard')+
    actionCard('🏆','conquista(s) aguardando ADM',conquestPending,conquestPending?'Metas atingidas aguardando validação.':'Nenhuma conquista aguardando validação.','recompensas','conquestsCard');
  const summary=$('dashParticipantList');if(summary)summary.innerHTML=state.participants.length?state.participants.map(p=>participantLine(p,rows)).join(''):'<div class="empty">Nenhum participante cadastrado.</div>';
  renderAnalytics();
  techLog('dashboard_render',{build:BUILD,previstas:rows.length,concluidas:done,emAndamento:running,atencao:attention,resgatesPendentes:rewardPending,conquistasPendentes:conquestPending});
}

function go(routeName,targetId){
  setRoute(routeName);
  if(routeName==='tarefas'&&targetId==='newTaskBtn')return setTimeout(()=>$('newTaskBtn')?.click(),0);
  if(routeName==='participantes'&&targetId==='newParticipantBtn')return setTimeout(()=>$('newParticipantBtn')?.click(),0);
  if(routeName==='recompensas'&&targetId){
    setTimeout(()=>{
      if(targetId==='rewardsCard'&&$('requestStatus')){$('requestStatus').value='Pendente';renderRewards()}
      if(targetId==='conquestsCard'&&$('conquestStatus')){$('conquestStatus').value='pending';renderConquests()}
      $(targetId)?.scrollIntoView({behavior:'smooth',block:'start'});
    },0);
  }
}
function openParticipant(participantId){monitorParticipant=participantId;setRoute('monitor');if($('monitorParticipant'))$('monitorParticipant').value=participantId;renderMonitor()}

function audit(){
  renderInicio();
  const rows=rowsAll();
  const b=bounds(analysisRef,analysisPeriod);
  const groupRows=inBounds(SCENARIO_DATE,b)?rows:[];
  const groupPeople=peopleMetrics(groupRows);
  const expectedLeader=groupPeople.find(p=>p.points>0)?.name||'—';
  const originalParticipant=analysisParticipant;
  const firstParticipant=state.participants[0]?.id||'all';
  analysisParticipant=firstParticipant;renderAnalytics();
  const leaderAfterIndividualFilter=$('dashGeneralLeader')?.querySelector('strong')?.textContent||'—';
  const rankingRowsAfterFilter=$('dashDetailedRanking')?.querySelectorAll('tbody tr').length||0;
  analysisParticipant=originalParticipant;renderAnalytics();
  const checks=[
    ['dashboard operacional montado',!!$('dashboardHome')],
    ['cards Hoje presentes',['dashExpected','dashDone','dashRunning','dashAttention','dashPoints'].every(id=>!!$(id))],
    ['pendencias presentes',!!$('dashPendingList')],
    ['atalhos presentes',document.querySelectorAll('.dash-shortcut').length>=5],
    ['resumo participantes presente',!!$('dashParticipantList')],
    ['analise gerencial montada',!!$('dashAnalysis')],
    ['filtros Dia/Semana/Mês',document.querySelectorAll('#dashPeriodTabs button').length===3],
    ['visao geral separada',!!$('dashGeneralScope')&&!!$('dashGeneralLeader')&&!!$('dashPodium')&&!!$('dashDetailedRanking')],
    ['desempenho filtravel separado',!!$('dashIndividualScope')&&!!$('dashAnalysisKpis')&&!!$('dashStatusChart')&&!!$('dashTrendChart')],
    ['lider geral nao muda com filtro individual',leaderAfterIndividualFilter===expectedLeader],
    ['ranking geral mantem todos com filtro individual',rankingRowsAfterFilter===state.participants.length],
    ['podio presente',!!$('dashPodium')],
    ['tres graficos presentes',['dashPointsChart','dashStatusChart','dashTrendChart'].every(id=>!!$(id)?.querySelector('svg'))],
    ['ranking detalhado presente',!!$('dashDetailedRanking')?.querySelector('table')],
    ['dados Hoje vinculados ao estado',Number($('dashExpected')?.textContent)===rows.length],
    ['sem iframe',!$('dashboardHome')?.querySelector('iframe')],
    ['sem duplicar timeline do Monitor',!$('dashboardHome')?.querySelector('.timeline')]
  ];
  const report={build:BUILD,passed:checks.filter(x=>x[1]).length,total:checks.length,checks:checks.map(([name,ok])=>({name,ok:!!ok}))};
  techLog('dashboard_audit',{build:BUILD,aprovados:report.passed,total:report.total},report.passed===report.total?'info':'error');
  return report;
}

const originalSetRoute=setRoute;
setRoute=function(routeName){originalSetRoute(routeName);if(routeName==='inicio')renderInicio()};
window.RFInicio={render:renderInicio,renderAnalytics,go,openParticipant,audit};
})();