from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
MONITOR = ROOT / 'sprint2-monitor-realdata-v2.js'
INDEX = ROOT / 'index-ADMIN-v9.html'
SW = ROOT / 'sw.js'

ACTIVE_UI = [
    'sprint2-tarefas-realdata-v2.js',
    'sprint2-participantes-realdata-v1.js',
    'sprint2-recompensas-realdata-v1.js',
    'sprint2-conquistas-realdata-v1.js',
    'sprint2-monitor-realdata-v2.js',
]
READ_TOKENS = (
    'getDocFromServer(', 'getDocsFromServer(',
    'getDocFromCache(', 'getDocsFromCache(',
    'onSnapshot(',
)


def replace_block(text, start_marker, end_marker, replacement, label):
    start = text.find(start_marker)
    if start < 0:
        raise RuntimeError(f'{label}: inicio nao encontrado')
    end = text.find(end_marker, start)
    if end < 0:
        raise RuntimeError(f'{label}: fim nao encontrado')
    return text[:start] + replacement + text[end:]


def patch_monitor():
    s = MONITOR.read_text(encoding='utf-8')
    s = re.sub(
        r"const VERSION='monitor-realdata-v3\.[^']+';",
        "const VERSION='monitor-realdata-v3.6-central-store-only';",
        s,
        count=1,
    )

    resolver = """async function resolveHistoryForReview(x){
  const cached=cachedHistoryForReview(x);
  if(cached){
    applyResolvedHistory(x,cached);
    log('sprint2.monitor_v3_historico_resolvido',{origem:'store-central',leituraFirebase:0,temHistorico:true});
    return true;
  }
  log('sprint2.monitor_v3_historico_indisponivel',{motivo:'ausente-no-store-central',leituraFirebase:0},'warning');
  return false;
}
"""
    s = replace_block(
        s,
        'async function resolveHistoryForReview(x){',
        'function occurrenceFor(task,pid,date){',
        resolver,
        'resolveHistoryForReview',
    )

    loader = """async function loadData(force=false){
  const g=groupId();
  if(!g||g==='SISTEMA'||!document.body.classList.contains('rf-auth-ready'))return false;
  if(!window.rotinaSprint2EnsureData||!window.rotinaSprint2DataSnapshot){
    log('sprint2.monitor_v3_dados_erro',{mensagem:'store-central-indisponivel',leituraFirebase:0},'error');
    return false;
  }
  try{
    if(force&&window.rotinaSprint2SyncNow)await window.rotinaSprint2SyncNow('monitor-manual');
    else await window.rotinaSprint2EnsureData();
    const shared=window.rotinaSprint2DataSnapshot();
    if(!shared||clean(shared.groupId).toUpperCase()!==g){
      log('sprint2.monitor_v3_dados_erro',{mensagem:'snapshot-central-incompativel',leituraFirebase:0},'warning');
      return false;
    }
    taskDocs=(shared.taskDocs||[]).map(x=>({...x}));
    historyDocs=(shared.history||[]).map(x=>({...x}));
    executionDocs=(shared.executions||[]).map(x=>({...x}));
    alarmDocs=(shared.alarms||[]).map(x=>({...x}));
    lastGroup=g;
    lastLoadAt=Math.max(Number(shared.lastServerSync)||0,Number(shared.lastLocalSync)||0)||Date.now();
    log('sprint2.monitor_v3_dados',{tarefas:taskDocs.length,historico:historyDocs.length,execucoes:executionDocs.length,alarmes:alarmDocs.length,storeCentral:true,leituraFirebase:0});
    return true;
  }catch(e){
    console.warn('Monitor V3 store central:',e);
    log('sprint2.monitor_v3_dados_erro',{mensagem:String(e?.message||e).slice(0,80),leituraFirebase:0},'error');
    return false;
  }
}

"""
    s = replace_block(
        s,
        'async function loadData(force=false){',
        'function fillParticipants(){',
        loader,
        'loadData',
    )

    forbidden = [t for t in READ_TOKENS if t in s]
    if forbidden:
        raise RuntimeError('Monitor ainda possui leitura direta: ' + ', '.join(forbidden))
    if 'storeCentral:false' in s:
        raise RuntimeError('Monitor ainda possui fallback fora do Store central')
    if "rotinaSprint2SyncNow('monitor-manual')" not in s:
        raise RuntimeError('Atualizacao manual nao delega ao Store central')
    if "const CACHE_TTL_MS=5*60*1000" not in s:
        raise RuntimeError('Janela de cinco minutos foi alterada')

    MONITOR.write_text(s, encoding='utf-8')


def bump_release():
    p = INDEX
    s = p.read_text(encoding='utf-8')
    s = re.sub(
        r'sprint2-monitor-realdata-v2\.js\?v=[^"\']+',
        'sprint2-monitor-realdata-v2.js?v=20260913-central-store-v36',
        s,
    )
    p.write_text(s, encoding='utf-8')

    p = SW
    s = p.read_text(encoding='utf-8')
    s = re.sub(r"const CACHE_NAME='[^']+';", "const CACHE_NAME='rotina-family-adm-v102-production-20260913.1';", s, count=1)
    s = re.sub(r"const ROTINA_SW_VERSION='[^']+';", "const ROTINA_SW_VERSION='102';", s, count=1)
    s = re.sub(r"const ROTINA_BUILD_ID='[^']+';", "const ROTINA_BUILD_ID='20260913.1';", s, count=1)
    s = re.sub(
        r'sprint2-monitor-realdata-v2\.js\?v=[^"\']+',
        'sprint2-monitor-realdata-v2.js?v=20260913-central-store-v36',
        s,
    )
    p.write_text(s, encoding='utf-8')


def audit_active_ui():
    print('ACTIVE_UI_DIRECT_READ_AUDIT_BEGIN')
    offenders = []
    for name in ACTIVE_UI:
        text = (ROOT / name).read_text(encoding='utf-8')
        hits = [token for token in READ_TOKENS if token in text]
        if hits:
            offenders.append((name, hits))
            print(f'CANDIDATE {name}: {", ".join(hits)}')
        else:
            print(f'OK {name}: sem leitura Firestore direta de tela')
    print('ACTIVE_UI_DIRECT_READ_AUDIT_END')
    if any(name == 'sprint2-monitor-realdata-v2.js' for name, _ in offenders):
        raise RuntimeError('Monitor reprovado na auditoria de leitura direta')
    return offenders


def syntax_check():
    for path in (MONITOR, SW):
        subprocess.run(['node', '--check', str(path)], check=True)


if __name__ == '__main__':
    patch_monitor()
    bump_release()
    syntax_check()
    audit_active_ui()
    print('MONITOR_CENTRAL_STORE_ONLY=OK')
