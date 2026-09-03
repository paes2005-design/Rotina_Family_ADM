from pathlib import Path

html_src=Path('sprint2-integracao-participantes-v1.html')
html=html_src.read_text(encoding='utf-8')
html=html.replace('Rotina Family — Sprint 2 • Participantes V1','Rotina Family — Sprint 2 • Recompensas V1')
html=html.replace('<button class="next-stage" disabled><span class="ico">🎁</span>Recompensas</button>','<button id="rewardNavButton"><span class="ico">🎁</span>Recompensas</button>')
html=html.replace('<section class="view" id="view-participantes"></section>','<section class="view" id="view-participantes"></section>\n<section class="view" id="view-recompensas"></section>')
html=html.replace('<b>Integração 4:</b> Login + Início + Tarefas + Monitor + Participantes usando a mesma sessão e o Store central.','<b>Integração 5:</b> Login + Início + Tarefas + Monitor + Participantes + Recompensas usando a mesma sessão e o Store central.')
html=html.replace('<div class="version">Sprint 2 • Participantes V1 integrado</div>','<div class="version">Sprint 2 • Recompensas V1 integrado</div>')
html=html.replace('<script src="sprint2-participantes-realdata-v1.js"></script><script src="sprint2-monitor-realdata-v2.js"></script>','<script src="sprint2-participantes-realdata-v1.js"></script><script src="sprint2-recompensas-realdata-v1.js"></script><script src="sprint2-monitor-realdata-v2.js"></script>')
if 'id="rewardNavButton"' not in html or 'id="view-recompensas"' not in html or 'sprint2-recompensas-realdata-v1.js' not in html:
    raise SystemExit('Falha ao integrar Recompensas no HTML')
Path('sprint2-integracao-recompensas-v1.html').write_text(html,encoding='utf-8')

p=Path('sprint2-data-store-v1.js')
s=p.read_text(encoding='utf-8')
s=s.replace("let data={groupId:'',readyGroup:'',profiles:[],taskDocs:[],history:[],executions:[],alarms:[],lastServerSync:0,lastLiveSync:0,lastLocalSync:0,origin:'empty',version:VERSION};","let data={groupId:'',readyGroup:'',profiles:[],taskDocs:[],history:[],executions:[],alarms:[],rewards:[],redemptions:[],lastServerSync:0,lastLiveSync:0,lastLocalSync:0,origin:'empty',version:VERSION};")
s=s.replace("function reset(g=''){data={groupId:g,readyGroup:'',profiles:[],taskDocs:[],history:[],executions:[],alarms:[],lastServerSync:0,lastLiveSync:0,lastLocalSync:0,origin:'reset',version:VERSION}}","function reset(g=''){data={groupId:g,readyGroup:'',profiles:[],taskDocs:[],history:[],executions:[],alarms:[],rewards:[],redemptions:[],lastServerSync:0,lastLiveSync:0,lastLocalSync:0,origin:'reset',version:VERSION}}")
s=s.replace("function snapshot(){return{...data,profiles:copy(data.profiles),taskDocs:copy(data.taskDocs),history:copy(data.history),executions:copy(data.executions),alarms:copy(data.alarms)}}","function snapshot(){return{...data,profiles:copy(data.profiles),taskDocs:copy(data.taskDocs),history:copy(data.history),executions:copy(data.executions),alarms:copy(data.alarms),rewards:copy(data.rewards),redemptions:copy(data.redemptions)}}")
s=s.replace("else if(route==='participantes')$('participantNavButton')?.classList.add('active');","else if(route==='participantes')$('participantNavButton')?.classList.add('active');\n  else if(route==='recompensas')$('rewardNavButton')?.classList.add('active');")
s=s.replace("const route=button.id==='monitorNavButton'?'monitor':button.id==='participantNavButton'?'participantes':clean(button.dataset.route);\n    if(!['inicio','tarefas','monitor','participantes'].includes(route))return;","const route=button.id==='monitorNavButton'?'monitor':button.id==='participantNavButton'?'participantes':button.id==='rewardNavButton'?'recompensas':clean(button.dataset.route);\n    if(!['inicio','tarefas','monitor','participantes','recompensas'].includes(route))return;")
s=s.replace("const results=await Promise.allSettled([queryGroup('despertadores',true,g)]);\n    if(results[0].status==='fulfilled')data.alarms=results[0].value;","const results=await Promise.allSettled([queryGroup('despertadores',true,g),queryGroup('recompensas',true,g),queryGroup('resgates',true,g)]);\n    if(results[0].status==='fulfilled')data.alarms=results[0].value;\n    if(results[1].status==='fulfilled')data.rewards=results[1].value;\n    if(results[2].status==='fulfilled')data.redemptions=results[2].value;")
s=s.replace("const names=reconcileAll?['perfis','tarefas','historico','execucoes','despertadores']:['perfis','tarefas','historico','despertadores'];","const names=reconcileAll?['perfis','tarefas','historico','execucoes','despertadores','recompensas','resgates']:['perfis','tarefas','historico','despertadores','recompensas','resgates'];")
s=s.replace("else if(name==='despertadores')data.alarms=r.value","else if(name==='despertadores')data.alarms=r.value;else if(name==='recompensas')data.rewards=r.value;else if(name==='resgates')data.redemptions=r.value")
checks=['rewards:[]','redemptions:[]','rewardNavButton','recompensas','resgates']
if not all(x in s for x in checks):
    raise SystemExit('Falha ao integrar Recompensas no Store')
p.write_text(s,encoding='utf-8')
print('OK: Recompensas V1 integrada ao HTML e Store central')