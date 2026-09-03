from pathlib import Path

STORE = Path('sprint2-data-store-v1.js')
PART = Path('sprint2-participantes-realdata-v1.js')

store = STORE.read_text(encoding='utf-8')
part = PART.read_text(encoding='utf-8')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: esperado 1 trecho, encontrado {count}')
    return text.replace(old, new, 1)

# Store: marca quando o grupo-base está íntegro e impede snapshots ao vivo durante transição.
store = replace_once(
    store,
    "let data={groupId:'',profiles:[],taskDocs:[],history:[],executions:[],alarms:[],lastServerSync:0,lastLiveSync:0,lastLocalSync:0,origin:'empty',version:VERSION};",
    "let data={groupId:'',readyGroup:'',profiles:[],taskDocs:[],history:[],executions:[],alarms:[],lastServerSync:0,lastLiveSync:0,lastLocalSync:0,origin:'empty',version:VERSION};",
    'store data readyGroup'
)
store = replace_once(
    store,
    "function reset(g=''){data={groupId:g,profiles:[],taskDocs:[],history:[],executions:[],alarms:[],lastServerSync:0,lastLiveSync:0,lastLocalSync:0,origin:'reset',version:VERSION}}",
    "function reset(g=''){data={groupId:g,readyGroup:'',profiles:[],taskDocs:[],history:[],executions:[],alarms:[],lastServerSync:0,lastLiveSync:0,lastLocalSync:0,origin:'reset',version:VERSION}}",
    'store reset readyGroup'
)
store = replace_once(
    store,
    "function publish(origin,server=false,failures=0){data.origin=origin;if(server&&failures===0)data.lastServerSync=Date.now();else if(!server)data.lastLocalSync=Date.now();window.dispatchEvent(new CustomEvent('rotina-sprint2-cache-updated',{detail:{groupId:data.groupId,origin,server,failures,lastServerSync:data.lastServerSync,lastLiveSync:data.lastLiveSync,version:VERSION}}))}",
    "function publish(origin,server=false,failures=0){data.origin=origin;if(server&&failures===0)data.lastServerSync=Date.now();else if(!server)data.lastLocalSync=Date.now();window.dispatchEvent(new CustomEvent('rotina-sprint2-cache-updated',{detail:{groupId:data.groupId,readyGroup:data.readyGroup,origin,server,failures,lastServerSync:data.lastServerSync,lastLiveSync:data.lastLiveSync,version:VERSION}}))}",
    'store publish readyGroup'
)
old_live = """function publishLive(origin,key,snap){
  data[key]=snap.docs.map(d=>({id:d.id,...d.data()}));
  data.groupId=groupId();data.origin=origin;data.lastLocalSync=Date.now();
  const fromCache=!!snap.metadata?.fromCache;if(!fromCache)data.lastLiveSync=Date.now();
  window.dispatchEvent(new CustomEvent('rotina-sprint2-cache-updated',{detail:{groupId:data.groupId,origin,server:!fromCache,live:true,failures:0,lastServerSync:data.lastServerSync,lastLiveSync:data.lastLiveSync,version:VERSION}}));
}
function startLive(){
  const g=groupId();if(!g||g==='SISTEMA'||!fs||!db)return false;
  if(liveGroup===g&&liveUnsubs.length===1)return true;
  stopLive();liveGroup=g;
  const q=fs.query(fs.collection(db,'execucoes'),fs.where('grupoId','==',g));
  const unsub=fs.onSnapshot(q,{includeMetadataChanges:false},snap=>publishLive('live-execucoes','executions',snap),err=>console.warn('Sprint 2 live execucoes:',err));
  liveUnsubs.push(unsub);
  return true;
}
"""
new_live = """function publishLive(origin,key,snap,listenerGroup){
  const current=groupId();
  if(!listenerGroup||listenerGroup!==current||data.groupId!==listenerGroup||data.readyGroup!==listenerGroup)return;
  data[key]=snap.docs.map(d=>({id:d.id,...d.data()}));
  data.origin=origin;data.lastLocalSync=Date.now();
  const fromCache=!!snap.metadata?.fromCache;if(!fromCache)data.lastLiveSync=Date.now();
  window.dispatchEvent(new CustomEvent('rotina-sprint2-cache-updated',{detail:{groupId:data.groupId,readyGroup:data.readyGroup,origin,server:!fromCache,live:true,failures:0,lastServerSync:data.lastServerSync,lastLiveSync:data.lastLiveSync,version:VERSION}}));
}
function startLive(expectedGroup=groupId()){
  const g=clean(expectedGroup).toUpperCase();if(!g||g==='SISTEMA'||!fs||!db||data.readyGroup!==g)return false;
  if(liveGroup===g&&liveUnsubs.length===1)return true;
  stopLive();liveGroup=g;
  const q=fs.query(fs.collection(db,'execucoes'),fs.where('grupoId','==',g));
  const unsub=fs.onSnapshot(q,{includeMetadataChanges:false},snap=>publishLive('live-execucoes','executions',snap,g),err=>console.warn('Sprint 2 live execucoes:',err));
  liveUnsubs.push(unsub);
  return true;
}
"""
store = replace_once(store, old_live, new_live, 'store live gating')
store = replace_once(
    store,
    "  data.history=copy(base.history);\n  data.lastServerSync=Math.max(data.lastServerSync,Number(base.lastLoadedAt)||0);",
    "  data.history=copy(base.history);\n  data.readyGroup=g;\n  data.lastServerSync=Math.max(data.lastServerSync,Number(base.lastLoadedAt)||0);",
    'store seed ready'
)
store = replace_once(
    store,
    "async function queryGroup(collectionName,server=true){\n  const g=groupId();\n  if(!g)throw new Error('Grupo não identificado');",
    "async function queryGroup(collectionName,server=true,expectedGroup=groupId()){\n  const g=clean(expectedGroup).toUpperCase();\n  if(!g)throw new Error('Grupo não identificado');",
    'store query expected group'
)
old_initial = """    const seeded=seedFromLogin();
    startLive();
    if(!seeded)return fullSync('store-inicial-completo',true,true);
    const results=await Promise.allSettled([queryGroup('despertadores',true)]);
"""
new_initial = """    const seeded=seedFromLogin();
    if(!seeded)return fullSync('store-inicial-completo',true,true);
    startLive(g);
    const results=await Promise.allSettled([queryGroup('despertadores',true,g)]);
"""
store = replace_once(store, old_initial, new_initial, 'store initial order')
old_full = """    if(!await firebaseReady())return false;
    if(data.groupId!==g)reset(g);
    const live=startLive();
    const reconcileAll=insideInitial||/manual|inicial-completo/.test(origin)||!live;
    const names=reconcileAll?['perfis','tarefas','historico','execucoes','despertadores']:['perfis','tarefas','historico','despertadores'];
    const results=await Promise.allSettled(names.map(c=>queryGroup(c,server)));
    results.forEach((r,i)=>{if(r.status!=='fulfilled')return;const name=names[i];if(name==='perfis')data.profiles=r.value;else if(name==='tarefas')data.taskDocs=r.value;else if(name==='historico')data.history=r.value;else if(name==='execucoes')data.executions=r.value;else if(name==='despertadores')data.alarms=r.value});
    const failures=results.filter(x=>x.status==='rejected').length;
    publish(origin,server,failures);
    return failures===0;
"""
new_full = """    if(!await firebaseReady())return false;
    if(data.groupId!==g)reset(g);
    const liveAlready=liveGroup===g&&liveUnsubs.length===1;
    const reconcileAll=insideInitial||/manual|inicial-completo/.test(origin)||!liveAlready;
    const names=reconcileAll?['perfis','tarefas','historico','execucoes','despertadores']:['perfis','tarefas','historico','despertadores'];
    const results=await Promise.allSettled(names.map(c=>queryGroup(c,server,g)));
    if(groupId()!==g)return false;
    results.forEach((r,i)=>{if(r.status!=='fulfilled')return;const name=names[i];if(name==='perfis')data.profiles=r.value;else if(name==='tarefas')data.taskDocs=r.value;else if(name==='historico')data.history=r.value;else if(name==='execucoes')data.executions=r.value;else if(name==='despertadores')data.alarms=r.value});
    const failures=results.filter(x=>x.status==='rejected').length;
    if(failures===0)data.readyGroup=g;
    publish(origin,server,failures);
    if(failures===0)startLive(g);
    return failures===0;
"""
store = replace_once(store, old_full, new_full, 'store full sync ordering')
store = replace_once(
    store,
    "  if(data.groupId!==g||(!data.taskDocs.length&&!data.history.length&&!data.executions.length))return supplementInitial();\n  if(await firebaseReady())startLive();",
    "  if(data.groupId!==g||data.readyGroup!==g||(!data.taskDocs.length&&!data.history.length&&!data.executions.length))return supplementInitial();\n  if(await firebaseReady())startLive(g);",
    'store ensure ready'
)

# Participantes: nunca normaliza tarefas ao receber mudança de perfis; ignora snapshot de grupo ainda não pronto.
part = replace_once(
    part,
    "function sourceProfiles(){return (snapshot().profiles||[]).map(p=>({...p})).sort((a,b)=>clean(a.nome).localeCompare(clean(b.nome),'pt-BR'))}\nfunction syncAppParticipants(){const st=window.RF_APP?.state;if(!st)return;st.participants=profiles.map(p=>({id:p.id,name:clean(p.nome)||'Integrante',theme:clean(p.sexo)||'Feminino',pinSet:pinSet(p)}));window.RF_APP?.normalizeState?.()}",
    "function sourceProfiles(){const snap=snapshot(),g=groupId(),ready=clean(snap.readyGroup).toUpperCase();if(!g||ready!==g)return null;return (snap.profiles||[]).map(p=>({...p})).sort((a,b)=>clean(a.nome).localeCompare(clean(b.nome),'pt-BR'))}\nfunction acceptProfiles(){const next=sourceProfiles();if(!next)return false;profiles=next;return true}\nfunction syncAppParticipants(){const st=window.RF_APP?.state;if(!st)return false;st.participants=profiles.map(p=>({id:p.id,name:clean(p.nome)||'Integrante',theme:clean(p.sexo)||'Feminino',pinSet:pinSet(p)}));return true}",
    'participants safe profile sync'
)
part = replace_once(
    part,
    "function loadProfiles(){profiles=sourceProfiles();syncAppParticipants();render()}",
    "function loadProfiles(){if(!acceptProfiles())return;syncAppParticipants();render()}",
    'participants load profiles'
)
# Replace every direct assignment from sourceProfiles with guarded acceptance.
part = part.replace("profiles=sourceProfiles();syncAppParticipants();render();", "if(acceptProfiles()){syncAppParticipants();render();}")
part = part.replace("profiles=sourceProfiles();syncAppParticipants();if(view.classList.contains('active'))render()", "if(acceptProfiles()){syncAppParticipants();if(view.classList.contains('active'))render()}")
part = part.replace("profiles=sourceProfiles();syncAppParticipants();if(sessionStorage.getItem('rf-sprint2-integration-route')==='participantes'", "if(acceptProfiles())syncAppParticipants();if(sessionStorage.getItem('rf-sprint2-integration-route')==='participantes'")

# Invariantes antes de gravar.
checks = {
    'store readyGroup': "readyGroup:''" in store and 'data.readyGroup=g' in store,
    'live gated': 'data.readyGroup!==listenerGroup' in store and 'startLive(expectedGroup=groupId())' in store,
    'stale group discarded': 'if(groupId()!==g)return false;' in store,
    'query pinned to expected group': 'queryGroup(c,server,g)' in store,
    'single onSnapshot': store.count('fs.onSnapshot(') == 1,
    'participant no normalizeState': 'normalizeState?.()' not in part,
    'participant waits ready group': 'ready!==g' in part and 'acceptProfiles()' in part,
}
for label, ok in checks.items():
    print(('OK   ' if ok else 'FALHA'), label)
if not all(checks.values()):
    raise SystemExit('Falha nas invariantes da correção')

STORE.write_text(store, encoding='utf-8')
PART.write_text(part, encoding='utf-8')
print(f'SPRINT2_GROUP_SWITCH_FIX={sum(checks.values())}/{len(checks)}')
