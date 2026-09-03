from pathlib import Path

JS = Path('sprint2-integracao-login-realdata-v1.js')
text = JS.read_text(encoding='utf-8')

old_history = """function historyPid(h){if(h.perfilId&&appState.participants.some(p=>p.id===h.perfilId))return h.perfilId;return appState.participants.find(p=>clean(p.name).toLowerCase()===clean(h.perfilNome).toLowerCase())?.id||''}\nfunction selectedHistory(){const b=bounds(runtime.analysisRef,runtime.analysisPeriod);return runtime.history.filter(h=>clean(h.data)>=b.start&&clean(h.data)<=b.end&&(runtime.analysisParticipant==='all'||historyPid(h)===runtime.analysisParticipant))}\nfunction selectedRedemptions(){const b=bounds(runtime.analysisRef,runtime.analysisPeriod);return runtime.redemptions.filter(r=>{const date=clean(r.decididoEm||r.criadoEm).slice(0,10);const approved=clean(r.status).toLowerCase()==='aprovado';const pid=r.perfilId||appState.participants.find(p=>clean(p.name).toLowerCase()===clean(r.perfilNome).toLowerCase())?.id||'';return approved&&date>=b.start&&date<=b.end&&(runtime.analysisParticipant==='all'||pid===runtime.analysisParticipant)})}\n"""
new_history = """function participantIndexes(){const byId=new Set(),byName=new Map();for(const p of appState.participants){byId.add(p.id);byName.set(clean(p.name).toLowerCase(),p.id)}return{byId,byName}}\nfunction historyPid(h,indexes=participantIndexes()){if(h.perfilId&&indexes.byId.has(h.perfilId))return h.perfilId;return indexes.byName.get(clean(h.perfilNome).toLowerCase())||''}\nfunction selectedHistory(indexes=participantIndexes()){const b=bounds(runtime.analysisRef,runtime.analysisPeriod);return runtime.history.filter(h=>{const date=clean(h.data);return date>=b.start&&date<=b.end&&(runtime.analysisParticipant==='all'||historyPid(h,indexes)===runtime.analysisParticipant)})}\nfunction selectedRedemptions(indexes=participantIndexes()){const b=bounds(runtime.analysisRef,runtime.analysisPeriod);return runtime.redemptions.filter(r=>{const date=clean(r.decididoEm||r.criadoEm).slice(0,10),approved=clean(r.status).toLowerCase()==='aprovado',pid=r.perfilId||indexes.byName.get(clean(r.perfilNome).toLowerCase())||'';return approved&&date>=b.start&&date<=b.end&&(runtime.analysisParticipant==='all'||pid===runtime.analysisParticipant)})}\n"""
if old_history not in text:
    raise SystemExit('Bloco history/selection esperado não encontrado')
text = text.replace(old_history, new_history, 1)

old_schedule = """function countCurrentScheduleOccurrences(startIso,endIso,pid='all'){\n  const start=dateFromIso(startIso),end=dateFromIso(endIso);let count=0,possible=0;for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){const short=SHORT_ORDER[d.getDay()];for(const t of appState.tasks){if(t.status!=='active'||!t.days.includes(short))continue;const targets=(t.targets||[]).filter(id=>pid==='all'||id===pid);count+=targets.length;possible+=targets.length*(Number(t.points)||0)}}return{count,possible}}\n"""
new_schedule = """function countCurrentScheduleOccurrences(startIso,endIso,pid='all'){\n  const start=dateFromIso(startIso),end=dateFromIso(endIso),dayCounts=Object.fromEntries(SHORT_ORDER.map(d=>[d,0]));\n  for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1))dayCounts[SHORT_ORDER[d.getDay()]]++;\n  let count=0,possible=0;for(const t of appState.tasks){if(t.status!=='active')continue;const targetCount=(t.targets||[]).reduce((n,id)=>n+(pid==='all'||id===pid?1:0),0);if(!targetCount)continue;let occurrences=0;for(const day of t.days||[])occurrences+=dayCounts[day]||0;count+=occurrences*targetCount;possible+=occurrences*targetCount*(Number(t.points)||0)}return{count,possible}}\n"""
if old_schedule not in text:
    raise SystemExit('Bloco schedule esperado não encontrado')
text = text.replace(old_schedule, new_schedule, 1)

start = text.index('function renderAnalysis(){')
end = text.index('\nfunction populateAnalysisParticipants()', start)
old_render = text[start:end]
new_render = """function renderAnalysis(){\n  const started=performance.now();\n  try{\n    const indexes=participantIndexes(),hist=selectedHistory(indexes),b=bounds(runtime.analysisRef,runtime.analysisPeriod),sched=countCurrentScheduleOccurrences(b.start,b.end,runtime.analysisParticipant),redeemed=selectedRedemptions(indexes).reduce((s,r)=>s+(Number(r.pontos)||0),0);\n    let points=0,ontime=0;const totalsMap=new Map(appState.participants.map(p=>[p.id,0]));\n    for(const h of hist){const gained=Number(h.pontosGanhos)||0,pid=historyPid(h,indexes);points+=gained;if(clean(h.status).toLowerCase().includes('prazo'))ontime++;if(pid)totalsMap.set(pid,(totalsMap.get(pid)||0)+gained)}\n    const completed=hist.length,use=sched.possible?Math.round(points*100/sched.possible):0,punct=completed?Math.round(ontime*100/completed):0,fulfill=sched.count?Math.round(completed*100/sched.count):0;\n    $('kpiPoints').textContent=points;$('kpiUse').textContent=sched.possible?`${use}%`:'—';$('kpiPunctual').textContent=completed?`${punct}%`:'—';$('kpiFulfill').textContent=sched.count?`${fulfill}%`:'—';$('kpiRedeemed').textContent=redeemed;\n    const totals=appState.participants.filter(p=>runtime.analysisParticipant==='all'||p.id===runtime.analysisParticipant).map(p=>({p,pts:totalsMap.get(p.id)||0})),max=Math.max(1,...totals.map(x=>x.pts));\n    $('participantBars').innerHTML=totals.map(x=>`<div class=\"bar-row\"><span class=\"bar-name\">${esc(x.p.name)}</span><span class=\"bar-track\"><i style=\"width:${clamp(x.pts*100/max)}%\"></i></span><span class=\"bar-value\">${x.pts}</span></div>`).join('')||'<div class=\"notice\">Sem histórico no período.</div>';\n    const today=todayRows().filter(r=>runtime.analysisParticipant==='all'||r.pid===runtime.analysisParticipant);$('statusOk').textContent=today.filter(r=>r.ex.status==='ok').length;$('statusLate').textContent=today.filter(r=>r.ex.status==='late').length;$('statusOpen').textContent=today.filter(r=>['pending','running'].includes(r.ex.status)).length;\n    const top=totals.reduce((best,x)=>!best||x.pts>best.pts?x:best,null),open=today.filter(r=>['pending','late','running'].includes(r.ex.status)).length;$('insights').innerHTML=`<div class=\"insight\"><span class=\"ico\">📊</span><div><b>${top?`${esc(top.p.name)} lidera o período com ${top.pts} pts.`:'Ainda sem pontos históricos no período.'}</b><p>Leitura baseada na coleção de histórico do grupo.</p></div></div><div class=\"insight\"><span class=\"ico\">🕒</span><div><b>${open} ocorrência(s) de hoje ainda pedem acompanhamento.</b><p>Usa o estado atual das tarefas da agenda de hoje.</p></div></div><div class=\"insight\"><span class=\"ico\">ℹ️</span><div><b>Percentuais de períodos usam a agenda atual como referência.</b><p>Histórico de alterações da agenda ainda não foi conectado neste checkpoint.</p></div></div>`;\n    const elapsed=Math.round(performance.now()-started);if(elapsed>120)emitLog('sprint2.realdata_analise_lenta',{tempoMs:elapsed,historico:runtime.history.length,periodo:runtime.analysisPeriod},'warning');\n  }catch(error){console.error('Sprint2 Análise:',error);emitLog('sprint2.realdata_analise_erro',{mensagem:String(error?.message||error).slice(0,80)},'error');const box=$('insights');if(box)box.innerHTML='<div class=\"notice\">Não foi possível atualizar a análise. Troque o período ou atualize a página.</div>'}\n}"""
text = text[:start] + new_render + text[end:]

old_pane = "function setHomePane(pane){const p=pane==='analysis'?'analysis':'today';document.querySelectorAll('.home-tab').forEach(b=>b.classList.toggle('active',b.dataset.pane===p));document.querySelectorAll('.home-pane').forEach(el=>el.classList.toggle('active',el.id===`pane-${p}`));sessionStorage.setItem('rf-sprint2-integration-realdata-pane',p);if(p==='analysis')renderAnalysis();else renderToday()}"
new_pane = "function setHomePane(pane){const p=pane==='analysis'?'analysis':'today';document.querySelectorAll('.home-tab').forEach(b=>b.classList.toggle('active',b.dataset.pane===p));document.querySelectorAll('.home-pane').forEach(el=>el.classList.toggle('active',el.id===`pane-${p}`));sessionStorage.setItem('rf-sprint2-integration-realdata-pane',p);requestAnimationFrame(()=>{if(p==='analysis')renderAnalysis();else renderToday()})}"
if old_pane not in text:
    raise SystemExit('setHomePane esperado não encontrado')
text = text.replace(old_pane, new_pane, 1)

old_load = "document.body.classList.add('rf-auth-ready');renderTasksSafe();renderToday();renderAnalysis();setHomePane(sessionStorage.getItem('rf-sprint2-integration-realdata-pane')||'today');navigate(location.hash.slice(1)==='tarefas'?'tarefas':'inicio');"
new_load = "document.body.classList.add('rf-auth-ready');renderTasksSafe();setHomePane(sessionStorage.getItem('rf-sprint2-integration-realdata-pane')||'today');navigate(location.hash.slice(1)==='tarefas'?'tarefas':'inicio');"
if old_load not in text:
    raise SystemExit('Sequência de load esperada não encontrada')
text = text.replace(old_load, new_load, 1)

old_filters = "$('periodTabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{runtime.analysisPeriod=b.dataset.period;$('periodTabs').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));renderAnalysis()});$('refDate').onchange=e=>{runtime.analysisRef=e.target.value||isoDate(new Date());renderAnalysis()};$('analysisParticipant').onchange=e=>{runtime.analysisParticipant=e.target.value;renderAnalysis()};"
new_filters = "$('periodTabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{runtime.analysisPeriod=b.dataset.period;$('periodTabs').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));if($('pane-analysis')?.classList.contains('active'))requestAnimationFrame(renderAnalysis)});$('refDate').onchange=e=>{runtime.analysisRef=e.target.value||isoDate(new Date());if($('pane-analysis')?.classList.contains('active'))requestAnimationFrame(renderAnalysis)};$('analysisParticipant').onchange=e=>{runtime.analysisParticipant=e.target.value;if($('pane-analysis')?.classList.contains('active'))requestAnimationFrame(renderAnalysis)};"
if old_filters not in text:
    raise SystemExit('Handlers de análise esperados não encontrados')
text = text.replace(old_filters, new_filters, 1)

JS.write_text(text, encoding='utf-8')

# Cache-bust only Sprint 2 integration/test pages that use this shared script.
for name in [
    'sprint2-integracao-login-realdata-v1.html',
    'sprint2-integracao-monitor-v2.html',
    'sprint2-integracao-participantes-v1.html',
    'sprint2-integracao-recompensas-v1.html',
]:
    p=Path(name)
    if not p.exists():
        continue
    h=p.read_text(encoding='utf-8')
    h=h.replace('src="sprint2-integracao-login-realdata-v1.js"','src="sprint2-integracao-login-realdata-v1.js?v=20260903-analysis-fix1"')
    h=h.replace('src="sprint2-integracao-login-realdata-v1.js?v=20260903-analysis-fix0"','src="sprint2-integracao-login-realdata-v1.js?v=20260903-analysis-fix1"')
    p.write_text(h,encoding='utf-8')

print('SPRINT2_ANALYSIS_FREEZE_FIX=APPLIED')
