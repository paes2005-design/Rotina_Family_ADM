from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if new in text:
        print(f'OK - {label} já aplicado')
        return
    if old not in text:
        raise SystemExit(f'FALHA - padrão não encontrado: {label}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'OK - {label}')


MONITOR = 'sprint2-monitor-realdata-v2.js'
STORE = 'sprint2-data-store-v1.js'

replace_once(
    MONITOR,
    "document.querySelectorAll('#mainNav [data-route]').forEach(b=>b.addEventListener('click',()=>sessionStorage.setItem('rf-sprint2-integration-route',b.dataset.route||'inicio')));",
    "document.querySelectorAll('#mainNav [data-route]').forEach(b=>b.addEventListener('click',()=>{$('monitorNavButton')?.classList.remove('active');sessionStorage.setItem('rf-sprint2-integration-route',b.dataset.route||'inicio')}));",
    'Monitor perde seleção ao voltar para Início/Tarefas'
)

replace_once(
    MONITOR,
    "lastGroup=g;lastLoadAt=Number(shared.lastServerSync)||Date.now();",
    "lastGroup=g;lastLoadAt=Math.max(Number(shared.lastServerSync)||0,Number(shared.lastLiveSync)||0)||Date.now();",
    'Monitor considera atualização em tempo real do store'
)

replace_once(
    MONITOR,
    "Store central: sincronização remota a cada 5 minutos; ações locais reaproveitam o cache persistente sem nova leitura remota.",
    "Store central: execuções e conclusões chegam automaticamente; a reconciliação remota periódica permanece como segurança e o botão Atualizar força uma conferência imediata.",
    'Texto do Monitor explica sync automático'
)

replace_once(
    STORE,
    "let db=null,fs=null,app=null,timer=null,syncing=null,installed=false;",
    "let db=null,fs=null,app=null,timer=null,syncing=null,installed=false,liveGroup='';\nlet liveUnsubs=[];",
    'Store mantém listeners centrais únicos'
)

replace_once(
    STORE,
    "let data={groupId:'',taskDocs:[],history:[],executions:[],alarms:[],lastServerSync:0,lastLocalSync:0,origin:'empty',version:VERSION};",
    "let data={groupId:'',taskDocs:[],history:[],executions:[],alarms:[],lastServerSync:0,lastLiveSync:0,lastLocalSync:0,origin:'empty',version:VERSION};",
    'Store registra relógio de sync ao vivo'
)

replace_once(
    STORE,
    "function reset(g=''){data={groupId:g,taskDocs:[],history:[],executions:[],alarms:[],lastServerSync:0,lastLocalSync:0,origin:'reset',version:VERSION}}",
    "function reset(g=''){data={groupId:g,taskDocs:[],history:[],executions:[],alarms:[],lastServerSync:0,lastLiveSync:0,lastLocalSync:0,origin:'reset',version:VERSION}}",
    'Reset limpa relógio de sync ao vivo'
)

old_publish = "function publish(origin,server=false,failures=0){data.origin=origin;if(server&&failures===0)data.lastServerSync=Date.now();else if(!server)data.lastLocalSync=Date.now();window.dispatchEvent(new CustomEvent('rotina-sprint2-cache-updated',{detail:{groupId:data.groupId,origin,server,failures,lastServerSync:data.lastServerSync,version:VERSION}}))}\n"
new_publish = "function publish(origin,server=false,failures=0){data.origin=origin;if(server&&failures===0)data.lastServerSync=Date.now();else if(!server)data.lastLocalSync=Date.now();window.dispatchEvent(new CustomEvent('rotina-sprint2-cache-updated',{detail:{groupId:data.groupId,origin,server,failures,lastServerSync:data.lastServerSync,lastLiveSync:data.lastLiveSync,version:VERSION}}))}\n\nfunction stopLive(){\n  for(const unsub of liveUnsubs.splice(0)){try{unsub()}catch(_){ }}\n  liveGroup='';\n}\nfunction publishLive(origin,key,snap){\n  data[key]=snap.docs.map(d=>({id:d.id,...d.data()}));\n  data.groupId=groupId();data.origin=origin;data.lastLocalSync=Date.now();\n  const fromCache=!!snap.metadata?.fromCache;if(!fromCache)data.lastLiveSync=Date.now();\n  window.dispatchEvent(new CustomEvent('rotina-sprint2-cache-updated',{detail:{groupId:data.groupId,origin,server:!fromCache,live:true,failures:0,lastServerSync:data.lastServerSync,lastLiveSync:data.lastLiveSync,version:VERSION}}));\n}\nfunction startLive(){\n  const g=groupId();if(!g||g==='SISTEMA'||!fs||!db)return false;\n  if(liveGroup===g&&liveUnsubs.length===2)return true;\n  stopLive();liveGroup=g;\n  const bind=(collectionName,key)=>{\n    const q=fs.query(fs.collection(db,collectionName),fs.where('grupoId','==',g));\n    const unsub=fs.onSnapshot(q,{includeMetadataChanges:false},snap=>publishLive(`live-${collectionName}`,key,snap),err=>console.warn(`Sprint 2 live ${collectionName}:`,err));\n    liveUnsubs.push(unsub);\n  };\n  bind('historico','history');bind('execucoes','executions');\n  return true;\n}\n"
replace_once(STORE, old_publish, new_publish, 'Store cria listeners centrais de histórico e execuções')

old_supplement = "    const seeded=seedFromLogin();\n    if(!seeded)return fullSync('store-inicial-completo',true,true);\n    const results=await Promise.allSettled([queryGroup('execucoes',true),queryGroup('despertadores',true)]);\n    if(results[0].status==='fulfilled')data.executions=results[0].value;\n    if(results[1].status==='fulfilled')data.alarms=results[1].value;\n    const failures=results.filter(x=>x.status==='rejected').length;\n    publish('store-inicial-complementar',true,failures);\n    return failures===0;"
new_supplement = "    const seeded=seedFromLogin();\n    startLive();\n    if(!seeded)return fullSync('store-inicial-completo',true,true);\n    const results=await Promise.allSettled([queryGroup('despertadores',true)]);\n    if(results[0].status==='fulfilled')data.alarms=results[0].value;\n    const failures=results.filter(x=>x.status==='rejected').length;\n    publish('store-inicial-complementar',true,failures);\n    return failures===0;"
replace_once(STORE, old_supplement, new_supplement, 'Carga inicial evita leitura duplicada de execuções')

old_full = "    if(data.groupId!==g)reset(g);\n    const results=await Promise.allSettled(['tarefas','historico','execucoes','despertadores'].map(c=>queryGroup(c,server)));\n    if(results[0].status==='fulfilled')data.taskDocs=results[0].value;\n    if(results[1].status==='fulfilled')data.history=results[1].value;\n    if(results[2].status==='fulfilled')data.executions=results[2].value;\n    if(results[3].status==='fulfilled')data.alarms=results[3].value;\n    const failures=results.filter(x=>x.status==='rejected').length;"
new_full = "    if(data.groupId!==g)reset(g);\n    const live=startLive();\n    const reconcileAll=insideInitial||/manual|inicial-completo/.test(origin)||!live;\n    const names=reconcileAll?['tarefas','historico','execucoes','despertadores']:['tarefas','despertadores'];\n    const results=await Promise.allSettled(names.map(c=>queryGroup(c,server)));\n    results.forEach((r,i)=>{if(r.status!=='fulfilled')return;const name=names[i];if(name==='tarefas')data.taskDocs=r.value;else if(name==='historico')data.history=r.value;else if(name==='execucoes')data.executions=r.value;else if(name==='despertadores')data.alarms=r.value});\n    const failures=results.filter(x=>x.status==='rejected').length;"
replace_once(STORE, old_full, new_full, 'Reconciliação periódica não relê coleções que já estão ao vivo')

old_ensure = "async function ensure(){\n  const g=groupId();if(!g||g==='SISTEMA')return false;\n  if(data.groupId!==g||(!data.taskDocs.length&&!data.history.length&&!data.executions.length))return supplementInitial();\n  return true;\n}"
new_ensure = "async function ensure(){\n  const g=groupId();if(!g||g==='SISTEMA')return false;\n  if(data.groupId!==g||(!data.taskDocs.length&&!data.history.length&&!data.executions.length))return supplementInitial();\n  if(await firebaseReady())startLive();\n  return true;\n}"
replace_once(STORE, old_ensure, new_ensure, 'Store restaura listener único ao garantir dados')

replace_once(
    STORE,
    "  const start=()=>{if(document.body.classList.contains('rf-auth-ready'))setTimeout(()=>ensure().catch(()=>{}),0)};",
    "  const start=()=>{if(document.body.classList.contains('rf-auth-ready'))setTimeout(()=>ensure().catch(()=>{}),0);else stopLive()};",
    'Logout encerra listeners do grupo'
)

replace_once(
    STORE,
    "if(g&&g!==data.groupId){reset(g);setTimeout(()=>ensure().catch(()=>{}),0)",
    "if(g&&g!==data.groupId){stopLive();reset(g);setTimeout(()=>ensure().catch(()=>{}),0)",
    'Troca de grupo encerra listener anterior'
)

# Sanity checks
monitor = Path(MONITOR).read_text(encoding='utf-8')
store = Path(STORE).read_text(encoding='utf-8')
checks = [
    ("monitorNavButton')?.classList.remove('active')" in monitor, 'menu Monitor é desmarcado'),
    ('lastLiveSync' in monitor, 'Monitor reconhece sync ao vivo'),
    ("fs.onSnapshot" in store and "bind('historico','history')" in store and "bind('execucoes','executions')" in store, 'listeners centrais existem'),
    ("const names=reconcileAll?['tarefas','historico','execucoes','despertadores']:['tarefas','despertadores']" in store, 'reconciliação economiza leituras'),
    ('else stopLive()' in store, 'listeners param no logout'),
]
for ok, label in checks:
    if not ok:
        raise SystemExit(f'FALHA - {label}')
    print(f'OK - {label}')
print('SPRINT2_MONITOR_NAV_LIVE_SYNC=5/5')
