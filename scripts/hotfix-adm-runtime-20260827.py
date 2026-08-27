from pathlib import Path
import re

# 1) Justificativa: usar exclusivamente o cache compartilhado no clique.
p=Path('adm-justification-review.js')
s=p.read_text(encoding='utf-8')
s=s.replace("import {getFirestore,collection,query,where,getDocs,doc,getDoc,writeBatch,deleteField} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';",
            "import {getFirestore,doc,writeBatch,deleteField} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';")
start=s.index('async function localizarTarefa(ctx){')
end=s.index('function montarAcoes(h){')
cache_block=r'''function cacheSnapshot(){
  try{return typeof window.rotinaAdmCacheSnapshot==='function'?window.rotinaAdmCacheSnapshot():null;}catch{return null;}
}
function localizarTarefa(ctx){
  const snap=cacheSnapshot(),g=grupo();
  if(!snap||!g||g==='--'||g==='CLI-Gen')throw new Error('Os dados do painel ainda não estão prontos.');
  const tarefas=Array.isArray(snap.tarefas)?snap.tarefas:[];
  if(ctx.id){const t=tarefas.find(x=>String(x.id||'')===String(ctx.id));if(t)return t;}
  const horario=parseHorario(ctx.horario||ctx.schedule||'');
  const norm=v=>String(v||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const lista=tarefas.filter(t=>(!ctx.tarefa||norm(t.nome)===norm(ctx.tarefa))&&(!ctx.usuario||norm(t.perfilNome)===norm(ctx.usuario))&&(!ctx.dia||norm(t.diaSemana)===norm(ctx.dia))&&(!horario.inicio||t.horaSugeridaInicio===horario.inicio)&&(!horario.fim||t.horaSugeridaFim===horario.fim));
  return lista[0]||null;
}

function docsRelacionados(banco,t,data){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data))throw new Error('Data da ocorrência inválida.');
  const snap=cacheSnapshot();
  const historico=Array.isArray(snap?.historico)?snap.historico:[];
  const candidatos=historico.filter(h=>String(h.tarefaId||'')===String(t.id||'')&&String(h.data||'')===data&&(!t.perfilId||!h.perfilId||String(h.perfilId)===String(t.perfilId)));
  const esperado=t.perfilId?`${t.perfilId}_${t.id}_${data}`:'';
  const h=candidatos.find(x=>String(x.id||'')===esperado)||candidatos[0]||null;
  if(!h)return {hist:[],histRefs:[],execRefs:[]};
  const histId=String(h.id||esperado||'').trim();
  const histRefs=histId?[doc(banco,'historico',histId)]:[];
  const execRefs=[doc(banco,'execucoes',`${data}__${t.id}`)];
  return {hist:[{...h}],histRefs,execRefs};
}

'''
s=s[:start]+cache_block+s[end:]
s=s.replace("    const t=await localizarTarefa(ctx);if(!t)throw new Error('Não foi possível localizar esta tarefa.');\n    const rel=await docsRelacionados(banco,t,data);if(!rel.hist.length)throw new Error('Não encontrei o histórico dessa ocorrência na data selecionada.');\n    const h={id:rel.hist[0].id,...rel.hist[0].data()};",
            "    const started=performance.now();\n    const t=localizarTarefa(ctx);if(!t)throw new Error('Não foi possível localizar esta tarefa no cache atual.');\n    const rel=docsRelacionados(banco,t,data);if(!rel.hist.length)throw new Error('Não encontrei o histórico dessa ocorrência no cache atual. Aguarde a próxima sincronização e tente novamente.');\n    const h={...rel.hist[0]};\n    window.rotinaLog?.('justificativa.adm_cache_hit',{duracaoMs:Math.round(performance.now()-started),data},'info');")
s=s.replace('contextoAtual={tarefa:t,data,historico:h,histDocs:rel.hist,execDocs:rel.exec};','contextoAtual={tarefa:t,data,historico:h,histRefs:rel.histRefs,execRefs:rel.execRefs};')
s=s.replace('const {tarefa:t,data,histDocs,execDocs}=contextoAtual;','const {tarefa:t,data,histRefs,execRefs}=contextoAtual;')
s=s.replace("if(!histDocs.length)throw new Error('Histórico da ocorrência não encontrado.');","if(!histRefs.length)throw new Error('Histórico da ocorrência não encontrado.');")
s=s.replace('histDocs.forEach(d=>batch.update(d.ref,patch));','histRefs.forEach(ref=>batch.set(ref,patch,{merge:true}));')
s=s.replace('execDocs.forEach(d=>batch.update(d.ref,patch));','execRefs.forEach(ref=>batch.set(ref,patch,{merge:true}));')
p.write_text(s,encoding='utf-8')

# 2) Auth: impedir ciclo signOut/signIn e limitar chamadas remotas.
p=Path('adm-auth-session-v1.js')
s=p.read_text(encoding='utf-8')
s=s.replace('const VERSION = 6;','const VERSION = 7;').replace('const MAX_RESTORE_RETRIES = 3;','const MAX_RESTORE_RETRIES = 1;')
old=re.search(r"async function workerSession\(path, idToken, body = \{\}\) \{.*?\n\}",s,re.S)
if not old: raise SystemExit('workerSession não encontrado')
new=r'''async function workerSession(path, idToken, body = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('timeout'), 9000);
  try {
    const response = await fetch(`${API_ROOT}${path}`, {
      method: 'POST', cache: 'no-store', signal: controller.signal,
      headers: { authorization: `Bearer ${idToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.token) {
      const error = new Error(result.error || `Falha HTTP ${response.status}`);
      error.status = response.status; throw error;
    }
    return result;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('A restauração da sessão demorou além do limite seguro.');
    throw error;
  } finally { clearTimeout(timeout); }
}'''
s=s[:old.start()]+new+s[old.end():]
old=re.search(r"async function installPromotedSession\(session, reason\) \{.*?\n\}",s,re.S)
if not old: raise SystemExit('installPromotedSession não encontrado')
new=r'''async function installPromotedSession(session, reason) {
  const auth = mainAuth();
  promotedUid = auth.currentUser?.uid || promotedUid;
  window.__rotinaAdmPromotionInProgress = true;
  try {
    // signInWithCustomToken já substitui a credencial atual. Não fazemos signOut antes,
    // pois a transição vazio->usuário alimentava o loop do guard de inicialização.
    const credential = await signInWithCustomToken(auth, session.token);
    promotedUid = credential.user.uid;
    publishRole(session, reason);
    window.rotinaLog?.('auth.adm_sessao_promovida', { papel: session.papel, grupoId: session.grupoId || '', motivo: reason, authVersion: VERSION });
    return credential.user;
  } catch (error) {
    promotedUid = '';
    throw error;
  } finally {
    window.__rotinaAdmPromotionInProgress = false;
  }
}'''
s=s[:old.start()]+new+s[old.end():]
p.write_text(s,encoding='utf-8')

# 3) Guard do startup: tempo por fluxo atual e apenas uma recuperação.
p=Path('adm-startup-stability-v1.js')
s=p.read_text(encoding='utf-8')
s=s.replace('const VERSION = 4;','const VERSION = 5;').replace('const MAX_RETRIES = 3;','const MAX_RETRIES = 1;')
s=s.replace('const startedAt = performance.now();','let flowStartedAt = performance.now();\nconst flowElapsed = () => Math.max(0, Math.round(performance.now() - flowStartedAt));')
s=s.replace('Math.round(performance.now() - startedAt)','flowElapsed()')
s=s.replace('const elapsed = flowElapsed();','const elapsed = flowElapsed();')
s=s.replace('[2200, 5200, 9000].forEach(delay => {','[6500].forEach(delay => {')
s=s.replace('  }, 13000);','  }, 14000);')
s=s.replace("    authenticated = !!user;\n    log('startup.adm_auth_resolvido', { autenticado: authenticated, ms: flowElapsed() });",
            "    authenticated = !!user;\n    if (user) flowStartedAt = performance.now();\n    log('startup.adm_auth_resolvido', { autenticado: authenticated, ms: flowElapsed() });")
s=s.replace("function showLogin() {\n  sessionReady = false;","function showLogin() {\n  flowStartedAt = performance.now();\n  sessionReady = false;")
p.write_text(s,encoding='utf-8')

# 4) Build consistente e novo SW.
p=Path('runtime-build-info.js')
s=p.read_text(encoding='utf-8').replace("build:'20260826.1'","build:'20260827.3'").replace("expectedServiceWorkerVersion:'59'","expectedServiceWorkerVersion:'62'")
p.write_text(s,encoding='utf-8')

p=Path('index.html')
s=p.read_text(encoding='utf-8').replace('entry=20260827.2','entry=20260827.3')
p.write_text(s,encoding='utf-8')

p=Path('index-ADMIN-v8.html')
s=p.read_text(encoding='utf-8')
s=re.sub(r'adm-justification-review\.js\?v=\d+','adm-justification-review.js?v=6',s)
s=re.sub(r'adm-auth-session-v1\.js\?v=\d+','adm-auth-session-v1.js?v=7',s)
s=re.sub(r'adm-startup-stability-v1\.js\?v=\d+','adm-startup-stability-v1.js?v=5',s)
s=s.replace("navigator.serviceWorker.register('./sw.js?v=61')","navigator.serviceWorker.register('./sw.js?v=62',{updateViaCache:'none'})")
addon='<script type="module" src="./adm-zero-points-restitution-20260827.js?v=1"></script>'
if 'adm-zero-points-restitution-20260827.js' not in s:
    pos=s.rfind('</body>')
    if pos<0: raise SystemExit('body final não encontrado')
    s=s[:pos]+addon+'\n'+s[pos:]
p.write_text(s,encoding='utf-8')

p=Path('sw.js')
s=p.read_text(encoding='utf-8')
s=s.replace("rotina-family-adm-v61","rotina-family-adm-v62").replace("ROTINA_SW_VERSION='61'","ROTINA_SW_VERSION='62'").replace("ROTINA_BUILD_ID='20260827.2'","ROTINA_BUILD_ID='20260827.3'").replace("runtime-build-info.js?v=20260827.2","runtime-build-info.js?v=20260827.3")
if "'./adm-zero-points-restitution-20260827.js'" not in s:
    s=s.replace("'./adm-justification-review.js',","'./adm-justification-review.js','./adm-zero-points-restitution-20260827.js',")
p.write_text(s,encoding='utf-8')

print('HOTFIX_ADM_20260827=OK')
