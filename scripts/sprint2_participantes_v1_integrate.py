from pathlib import Path

LOGIN=Path('sprint2-integracao-login-realdata-v1.js')
STORE=Path('sprint2-data-store-v1.js')
SOURCE_HTML=Path('sprint2-integracao-monitor-v2.html')
TARGET_HTML=Path('sprint2-integracao-participantes-v1.html')
PART=Path('sprint2-participantes-realdata-v1.js')


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'FALHA: trecho não encontrado: {label}')
    return text.replace(old, new, 1)

# Login: expõe papel e perfis já lidos no login inicial para o Store central.
login=LOGIN.read_text(encoding='utf-8')
old="window.rotinaSprint2BaseSnapshot=()=>({groupId:runtime.groupId,taskDocs:runtime.taskDocs.map(x=>({...x})),history:runtime.history.map(x=>({...x})),lastLoadedAt:Number(runtime.lastLoadedAt)||0});"
new="window.rotinaSprint2BaseSnapshot=()=>({role:runtime.role,groupId:runtime.groupId,profiles:runtime.profiles.map(x=>({...x})),taskDocs:runtime.taskDocs.map(x=>({...x})),history:runtime.history.map(x=>({...x})),lastLoadedAt:Number(runtime.lastLoadedAt)||0});\nwindow.rotinaSprint2SessionSnapshot=()=>({role:runtime.role,groupId:runtime.groupId});"
login=replace_once(login,old,new,'snapshot de Login')
LOGIN.write_text(login,encoding='utf-8')

# Store: perfis entram no snapshot/reconciliação, mas NÃO ganham listener contínuo.
store=STORE.read_text(encoding='utf-8')
store=replace_once(store,
"let data={groupId:'',taskDocs:[],history:[],executions:[],alarms:[],lastServerSync:0,lastLiveSync:0,lastLocalSync:0,origin:'empty',version:VERSION};",
"let data={groupId:'',profiles:[],taskDocs:[],history:[],executions:[],alarms:[],lastServerSync:0,lastLiveSync:0,lastLocalSync:0,origin:'empty',version:VERSION};",
'data profiles')
store=replace_once(store,
"function reset(g=''){data={groupId:g,taskDocs:[],history:[],executions:[],alarms:[],lastServerSync:0,lastLiveSync:0,lastLocalSync:0,origin:'reset',version:VERSION}}",
"function reset(g=''){data={groupId:g,profiles:[],taskDocs:[],history:[],executions:[],alarms:[],lastServerSync:0,lastLiveSync:0,lastLocalSync:0,origin:'reset',version:VERSION}}",
'reset profiles')
store=replace_once(store,
"function snapshot(){return{...data,taskDocs:copy(data.taskDocs),history:copy(data.history),executions:copy(data.executions),alarms:copy(data.alarms)}}",
"function snapshot(){return{...data,profiles:copy(data.profiles),taskDocs:copy(data.taskDocs),history:copy(data.history),executions:copy(data.executions),alarms:copy(data.alarms)}}",
'snapshot profiles')
store=replace_once(store,
"  data.taskDocs=copy(base.taskDocs);\n  data.history=copy(base.history);",
"  data.profiles=copy(base.profiles);\n  data.taskDocs=copy(base.taskDocs);\n  data.history=copy(base.history);",
'seed profiles')
store=replace_once(store,
"const names=reconcileAll?['tarefas','historico','execucoes','despertadores']:['tarefas','historico','despertadores'];",
"const names=reconcileAll?['perfis','tarefas','historico','execucoes','despertadores']:['perfis','tarefas','historico','despertadores'];",
'coleções reconciliadas')
store=replace_once(store,
"results.forEach((r,i)=>{if(r.status!=='fulfilled')return;const name=names[i];if(name==='tarefas')data.taskDocs=r.value;else if(name==='historico')data.history=r.value;else if(name==='execucoes')data.executions=r.value;else if(name==='despertadores')data.alarms=r.value});",
"results.forEach((r,i)=>{if(r.status!=='fulfilled')return;const name=names[i];if(name==='perfis')data.profiles=r.value;else if(name==='tarefas')data.taskDocs=r.value;else if(name==='historico')data.history=r.value;else if(name==='execucoes')data.executions=r.value;else if(name==='despertadores')data.alarms=r.value});",
'mapeamento perfis')
store=replace_once(store,
"  if(route==='monitor')$('monitorNavButton')?.classList.add('active');\n  else nav.querySelector(`[data-route=\"${route}\"]`)?.classList.add('active');",
"  if(route==='monitor')$('monitorNavButton')?.classList.add('active');\n  else if(route==='participantes')$('participantNavButton')?.classList.add('active');\n  else nav.querySelector(`[data-route=\"${route}\"]`)?.classList.add('active');",
'seleção participantes')
store=replace_once(store,
"    const route=button.id==='monitorNavButton'?'monitor':clean(button.dataset.route);\n    if(!['inicio','tarefas','monitor'].includes(route))return;",
"    const route=button.id==='monitorNavButton'?'monitor':button.id==='participantNavButton'?'participantes':clean(button.dataset.route);\n    if(!['inicio','tarefas','monitor','participantes'].includes(route))return;",
'guarda participantes')
STORE.write_text(store,encoding='utf-8')

# Página nova: parte da integração aprovada do Monitor, sem alterar a página anterior.
html=SOURCE_HTML.read_text(encoding='utf-8')
html=html.replace('<title>Rotina Family — Sprint 2 • Monitor V2</title>','<title>Rotina Family — Sprint 2 • Participantes V1</title>',1)
html=replace_once(html,
'<button class="next-stage" disabled><span class="ico">👥</span>Participantes</button>',
'<button id="participantNavButton"><span class="ico">👥</span>Participantes</button>',
'botão participantes')
html=replace_once(html,
'<div class="realdata-strip"><span>🔗</span><b>Firebase real</b><span id="syncStatus">Autenticando e carregando…</span><span>•</span><span>Modo leitura nesta rodada</span></div>',
'<div class="realdata-strip"><span>🔗</span><b>Firebase real</b><span id="syncStatus">Autenticando e carregando…</span><span>•</span><span>Store central • operação controlada</span></div>',
'faixa de dados reais')
html=html.replace('<b>Integração 3:</b> Login + Início + Tarefas + Monitor usando os mesmos dados reais do grupo.','<b>Integração 4:</b> Login + Início + Tarefas + Monitor + Participantes usando a mesma sessão e o Store central.',1)
needle='<section class="view" id="view-monitor">'
if needle not in html:
    raise SystemExit('FALHA: view-monitor não encontrada')
html=html.replace(needle,'<section class="view" id="view-participantes"></section>\n'+needle,1)
html=replace_once(html,
'<script src="sprint2-data-store-v1.js"></script><script src="sprint2-monitor-realdata-v2.js"></script>',
'<script src="sprint2-data-store-v1.js"></script><script src="sprint2-participantes-realdata-v1.js"></script><script src="sprint2-monitor-realdata-v2.js"></script>',
'ordem scripts')
html=html.replace('<div class="version">Sprint 2 • Monitor V2 completo</div>','<div class="version">Sprint 2 • Participantes V1 integrado</div>',1)
TARGET_HTML.write_text(html,encoding='utf-8')

# Auditoria local do integrador.
part=PART.read_text(encoding='utf-8')
checks={
    'Participantes sem listener próprio': 'onSnapshot(' not in part,
    'Store mantém um único listener': store.count('fs.onSnapshot(')==1,
    'Listener continua em execucoes': "fs.collection(db,'execucoes')" in store,
    'Perfis entram no Store': 'profiles:[]' in store and "['perfis','tarefas','historico','despertadores']" in store,
    'Login expõe perfis': 'profiles:runtime.profiles.map' in login,
    'Login expõe papel': 'rotinaSprint2SessionSnapshot' in login,
    'Participantes usa Store': 'rotinaSprint2DataSnapshot' in part,
    'Atualização manual usa Store': "rotinaSprint2SyncNow('participantes-manual')" in part,
    'Pós-gravação usa cache local': "rotinaSprint2SyncLocal('participantes-cache-local')" in part,
    'PIN usa SHA-256': "crypto.subtle.digest('SHA-256'" in part,
    'Grava em perfis': "fs.collection(db,'perfis')" in part and "fs.doc(db,'perfis',p.id)" in part,
    'Sem exclusão de participante': 'deleteDoc(' not in part,
    'Protege renomeação legada': 'legacyRenameBlocked' in part,
    'Página tem botão Participantes': 'id="participantNavButton"' in html,
    'Página tem view Participantes': 'id="view-participantes"' in html,
    'Scripts Login Store Participantes Monitor': html.find('sprint2-integracao-login-realdata-v1.js') < html.find('sprint2-data-store-v1.js') < html.find('sprint2-participantes-realdata-v1.js') < html.find('sprint2-monitor-realdata-v2.js'),
}
for label,ok in checks.items():
    print(('OK   ' if ok else 'FALHA'),label)
if not all(checks.values()):
    raise SystemExit(1)
print(f'SPRINT2_PARTICIPANTES_V1={sum(checks.values())}/{len(checks)}')
