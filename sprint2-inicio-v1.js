(function(){
'use strict';
const BUILD='inicio-v1';

function rowsAll(){
  const rows=[];
  for(const task of state.tasks){
    if(task.status==='inactive') continue;
    for(const participantId of task.targets||[]){
      const ex=state.executions[`${task.id}::${participantId}`]||{start:'',end:'',status:'pending',points:`0/${task.points||0}`};
      rows.push({task,participantId,ex});
    }
  }
  return rows;
}

function pointsFrom(row){
  const raw=String(row.ex.points||`0/${row.task.points||0}`).split('/');
  return {done:Number(raw[0])||0,possible:Number(raw[1])||Number(row.task.points)||0};
}

function setText(id,value){const el=$(id);if(el)el.textContent=String(value)}

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

function renderInicio(){
  if(!$('dashboardHome')) return;
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

  setText('dashExpected',rows.length);
  setText('dashDone',done);
  setText('dashRunning',running);
  setText('dashAttention',attention);
  setText('dashPoints',points);
  setText('dashPossiblePoints',possible);
  setText('dashCompletion',completion+'%');
  const bar=$('dashCompletionBar');if(bar)bar.style.width=Math.max(0,Math.min(100,completion))+'%';
  const headline=$('dashHeadline');if(headline)headline.textContent=`${done} de ${rows.length} tarefas concluídas`;

  const pendingBox=$('dashPendingList');
  if(pendingBox){
    pendingBox.innerHTML=
      actionCard('⚠️','ocorrência(s) para revisar',late,late?'Execuções atrasadas sinalizadas no Monitor.':'Nenhum atraso sinalizado.','monitor','')+
      actionCard('🎁','resgate(s) pendente(s)',rewardPending,rewardPending?'Pedidos aguardando decisão do ADM.':'Nenhum resgate aguardando decisão.','recompensas','rewardsCard')+
      actionCard('🏆','conquista(s) aguardando ADM',conquestPending,conquestPending?'Metas atingidas aguardando validação.':'Nenhuma conquista aguardando validação.','recompensas','conquestsCard');
  }

  const summary=$('dashParticipantList');
  if(summary)summary.innerHTML=state.participants.length?state.participants.map(p=>participantLine(p,rows)).join(''):'<div class="empty">Nenhum participante cadastrado.</div>';

  techLog('dashboard_render',{build:BUILD,previstas:rows.length,concluidas:done,emAndamento:running,atencao:attention,resgatesPendentes:rewardPending,conquistasPendentes:conquestPending});
}

function go(routeName,targetId){
  setRoute(routeName);
  if(routeName==='tarefas'&&targetId==='newTaskBtn') return setTimeout(()=>$('newTaskBtn')?.click(),0);
  if(routeName==='participantes'&&targetId==='newParticipantBtn') return setTimeout(()=>$('newParticipantBtn')?.click(),0);
  if(routeName==='recompensas'&&targetId){
    setTimeout(()=>{
      if(targetId==='rewardsCard'&&$('requestStatus')){$('requestStatus').value='Pendente';renderRewards()}
      if(targetId==='conquestsCard'&&$('conquestStatus')){$('conquestStatus').value='pending';renderConquests()}
      $(targetId)?.scrollIntoView({behavior:'smooth',block:'start'});
    },0);
  }
}

function openParticipant(participantId){
  monitorParticipant=participantId;
  setRoute('monitor');
  if($('monitorParticipant'))$('monitorParticipant').value=participantId;
  renderMonitor();
}

function audit(){
  const rows=rowsAll();
  const checks=[
    ['dashboard montado',!!$('dashboardHome')],
    ['cards Hoje presentes',['dashExpected','dashDone','dashRunning','dashAttention','dashPoints'].every(id=>!!$(id))],
    ['pendencias presentes',!!$('dashPendingList')],
    ['atalhos presentes',document.querySelectorAll('.dash-shortcut').length>=5],
    ['resumo participantes presente',!!$('dashParticipantList')],
    ['dados vinculados ao estado',Number($('dashExpected')?.textContent)===rows.length],
    ['sem duplicar Monitor',!$('dashboardHome')?.querySelector('.timeline')]
  ];
  const report={build:BUILD,passed:checks.filter(x=>x[1]).length,total:checks.length,checks:checks.map(([name,ok])=>({name,ok:!!ok}))};
  techLog('dashboard_audit',{build:BUILD,aprovados:report.passed,total:report.total},report.passed===report.total?'info':'error');
  return report;
}

const originalSetRoute=setRoute;
setRoute=function(routeName){
  originalSetRoute(routeName);
  if(routeName==='inicio')renderInicio();
};

window.RFInicio={render:renderInicio,go,openParticipant,audit};
})();