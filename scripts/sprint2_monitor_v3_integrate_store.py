from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
login_path = ROOT / 'sprint2-integracao-login-realdata-v1.js'
html_path = ROOT / 'sprint2-integracao-monitor-v2.html'
monitor_path = ROOT / 'sprint2-monitor-realdata-v2.js'
store_path = ROOT / 'sprint2-data-store-v1.js'


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f'{label}: trecho esperado nao encontrado')
    return text.replace(old, new, 1)


def patch_login():
    s = login_path.read_text(encoding='utf-8')
    if 'window.rotinaSprint2BaseSnapshot' in s:
        return
    s = replace_once(
        s,
        "runtime.redemptions=redemptionsSnap.docs.map(d=>({id:d.id,...d.data()}));mapRealDataToState();",
        "runtime.redemptions=redemptionsSnap.docs.map(d=>({id:d.id,...d.data()}));runtime.lastLoadedAt=Date.now();mapRealDataToState();",
        'login lastLoadedAt'
    )
    s = replace_once(
        s,
        'function readOnlyToast(){',
        "window.rotinaSprint2BaseSnapshot=()=>({groupId:runtime.groupId,taskDocs:runtime.taskDocs.map(x=>({...x})),history:runtime.history.map(x=>({...x})),lastLoadedAt:Number(runtime.lastLoadedAt)||0});\n\nfunction readOnlyToast(){",
        'login snapshot base'
    )
    login_path.write_text(s, encoding='utf-8')


def patch_html():
    s = html_path.read_text(encoding='utf-8')
    if 'sprint2-data-store-v1.js' in s:
        return
    s = replace_once(
        s,
        '<script src="sprint2-integracao-login-realdata-v1.js"></script><script src="sprint2-monitor-realdata-v2.js"></script>',
        '<script src="sprint2-integracao-login-realdata-v1.js"></script><script src="sprint2-data-store-v1.js"></script><script src="sprint2-monitor-realdata-v2.js"></script>',
        'ordem de scripts'
    )
    html_path.write_text(s, encoding='utf-8')


def patch_monitor():
    s = monitor_path.read_text(encoding='utf-8')
    if 'storeCentral:true' in s and 'rotinaSprint2SyncLocal' in s:
        return
    s = replace_once(s, 'const CACHE_TTL_MS=120000;', 'const CACHE_TTL_MS=5*60*1000;', 'TTL Monitor')

    pattern = r"async function loadData\(force=false\)\{[\s\S]*?\n\}\n\nfunction fillParticipants\(\)\{"
    match = re.search(pattern, s)
    if not match:
        raise RuntimeError('loadData do Monitor nao encontrado')
    replacement = """async function loadData(force=false){
  const g=groupId();
  if(!g||g==='SISTEMA'||!document.body.classList.contains('rf-auth-ready'))return false;
  try{
    if(window.rotinaSprint2EnsureData&&window.rotinaSprint2DataSnapshot){
      if(force&&window.rotinaSprint2SyncNow)await window.rotinaSprint2SyncNow('monitor-manual');
      else await window.rotinaSprint2EnsureData();
      const shared=window.rotinaSprint2DataSnapshot();
      if(shared&&clean(shared.groupId).toUpperCase()===g){
        taskDocs=(shared.taskDocs||[]).map(x=>({...x}));
        historyDocs=(shared.history||[]).map(x=>({...x}));
        executionDocs=(shared.executions||[]).map(x=>({...x}));
        alarmDocs=(shared.alarms||[]).map(x=>({...x}));
        lastGroup=g;lastLoadAt=Number(shared.lastServerSync)||Date.now();
        await log('sprint2.monitor_v3_dados',{tarefas:taskDocs.length,historico:historyDocs.length,execucoes:executionDocs.length,alarmes:alarmDocs.length,storeCentral:true});
        return true;
      }
    }
  }catch(e){console.warn('Monitor V3 store central:',e)}
  if(!force&&g===lastGroup&&Date.now()-lastLoadAt<CACHE_TTL_MS&&taskDocs.length)return true;
  if(!await firebaseReady())return false;
  try{
    const q=c=>fs.query(fs.collection(db,c),fs.where('grupoId','==',g));
    const [ts,hs,es,as]=await Promise.all([
      fs.getDocsFromServer(q('tarefas')),
      fs.getDocsFromServer(q('historico')),
      fs.getDocsFromServer(q('execucoes')).catch(()=>({docs:[]})),
      fs.getDocsFromServer(q('despertadores')).catch(()=>({docs:[]}))
    ]);
    taskDocs=ts.docs.map(d=>({id:d.id,...d.data()}));
    historyDocs=hs.docs.map(d=>({id:d.id,...d.data()}));
    executionDocs=(es.docs||[]).map(d=>({id:d.id,...d.data()}));
    alarmDocs=(as.docs||[]).map(d=>({id:d.id,...d.data()}));
    lastGroup=g;lastLoadAt=Date.now();
    await log('sprint2.monitor_v3_dados',{tarefas:taskDocs.length,historico:historyDocs.length,execucoes:executionDocs.length,alarmes:alarmDocs.length,storeCentral:false});
    return true;
  }catch(e){
    console.error('Monitor V3 dados:',e);
    await log('sprint2.monitor_v3_dados_erro',{mensagem:String(e?.message||e).slice(0,80)},'error');
    return false;
  }
}

function fillParticipants(){"""
    s = s[:match.start()] + replacement + s[match.end():]

    s = replace_once(
        s,
        "msg.textContent=ativo?'Alarme ativado.':'Alarme retirado.';lastLoadAt=0;setTimeout(()=>{closeModal();render(true)},350);",
        "msg.textContent=ativo?'Alarme ativado.':'Alarme retirado.';if(window.rotinaSprint2SyncLocal)await window.rotinaSprint2SyncLocal('monitor-alarme-cache-local').catch(()=>{});setTimeout(()=>{closeModal();render(false)},350);",
        'pos-write alarme'
    )
    s = replace_once(
        s,
        "msg.textContent='Decisão registrada na ocorrência.';lastLoadAt=0;setTimeout(()=>{closeModal();render(true)},350);",
        "msg.textContent='Decisão registrada na ocorrência.';if(window.rotinaSprint2SyncLocal)await window.rotinaSprint2SyncLocal('monitor-revisao-cache-local').catch(()=>{});setTimeout(()=>{closeModal();render(false)},350);",
        'pos-write revisao'
    )
    s = replace_once(
        s,
        'Cache de tela: 2 minutos, com atualização manual.',
        'Store central: sincronização remota a cada 5 minutos; ações locais reaproveitam o cache persistente sem nova leitura remota.',
        'texto arquitetura cache'
    )
    s = replace_once(
        s,
        "document.addEventListener('visibilitychange',()=>{if(!document.hidden&&$('view-monitor')?.classList.contains('active')&&Date.now()-lastLoadAt>CACHE_TTL_MS)render(true)});window.addEventListener('online',()=>{if($('view-monitor')?.classList.contains('active')){lastLoadAt=0;render(true)}});return true;",
        "document.addEventListener('visibilitychange',()=>{if(!document.hidden&&$('view-monitor')?.classList.contains('active')&&Date.now()-lastLoadAt>CACHE_TTL_MS)render(true)});window.addEventListener('online',()=>{if($('view-monitor')?.classList.contains('active')&&Date.now()-lastLoadAt>CACHE_TTL_MS)render(true)});window.addEventListener('rotina-sprint2-cache-updated',()=>{if($('view-monitor')?.classList.contains('active'))render(false)});return true;",
        'eventos store central'
    )
    monitor_path.write_text(s, encoding='utf-8')


def assert_architecture():
    login = login_path.read_text(encoding='utf-8')
    html = html_path.read_text(encoding='utf-8')
    monitor = monitor_path.read_text(encoding='utf-8')
    store = store_path.read_text(encoding='utf-8')
    checks = [
        ('window.rotinaSprint2BaseSnapshot' in login, 'login expoe carga inicial'),
        ('runtime.lastLoadedAt=Date.now()' in login, 'login marca carga do servidor'),
        ('const SYNC_MS=5*60*1000' in store, 'store sincroniza em 5 minutos'),
        ('window.rotinaSprint2SyncLocal' in store and 'getDocsFromCache' in store, 'writes usam cache local'),
        ('window.rotinaSprint2SyncNow' in store and 'getDocsFromServer' in store, 'refresh manual tem caminho remoto'),
        ("['tarefas','historico','execucoes','despertadores']" in store, 'store centraliza colecoes operacionais'),
        (html.index('sprint2-integracao-login-realdata-v1.js') < html.index('sprint2-data-store-v1.js') < html.index('sprint2-monitor-realdata-v2.js'), 'ordem Login -> Store -> Monitor'),
        ('window.rotinaSprint2DataSnapshot' in monitor and 'storeCentral:true' in monitor, 'Monitor prioriza store'),
        ('storeCentral:false' in monitor, 'Monitor tem fallback resiliente'),
        ('const CACHE_TTL_MS=5*60*1000' in monitor, 'Monitor segue janela de cinco minutos'),
        ("rotinaSprint2SyncLocal('monitor-alarme-cache-local')" in monitor, 'alarme reaproveita cache'),
        ("rotinaSprint2SyncLocal('monitor-revisao-cache-local')" in monitor, 'revisao reaproveita cache'),
        ('rotina-sprint2-cache-updated' in monitor, 'Monitor reage ao store'),
        ("if(x.__state!=='final')return null" in monitor, 'pendente nao ganha faixa'),
        ('batch.update(taskRef,patch)' not in monitor, 'revisao nao duplica resultado em tarefas'),
        ('won*100/max' not in monitor and 'won * 100 / max' not in monitor, 'Monitor nao recalcula percentual'),
    ]
    for ok, label in checks:
        if not ok:
            raise RuntimeError(f'AUDIT FAIL: {label}')
        print(f'OK - {label}')
    print(f'SPRINT2_CENTRAL_STORE_RESULT={len(checks)}/{len(checks)}')


def syntax_check():
    for path in (login_path, store_path, monitor_path):
        subprocess.run(['node', '--check', str(path)], check=True)


if __name__ == '__main__':
    patch_login()
    patch_html()
    patch_monitor()
    syntax_check()
    assert_architecture()
