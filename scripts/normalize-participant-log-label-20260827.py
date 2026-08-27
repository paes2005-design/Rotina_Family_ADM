from pathlib import Path


def require_replace(path, old, new, count=1):
    p=Path(path)
    text=p.read_text(encoding='utf-8')
    actual=text.count(old)
    if actual < count:
        raise SystemExit(f'Trecho esperado não encontrado em {path}: {old!r} (achado {actual})')
    text=text.replace(old,new,count)
    p.write_text(text,encoding='utf-8')

# Monitor Master: todo legado "cliente" passa a ser apresentado/filtrado como Participante.
p=Path('app-monitoring-dashboard.js')
text=p.read_text(encoding='utf-8')
anchor="const formatDate = value => { const d=new Date(value||''); return Number.isFinite(d.getTime())?d.toLocaleString('pt-BR'):'—'; };\n"
if 'const normalizeApp =' not in text:
    if anchor not in text: raise SystemExit('Âncora formatDate não encontrada')
    text=text.replace(anchor,anchor+"const normalizeApp = value => String(value||'')==='cliente'?'participante':String(value||'');\n",1)
text=text.replace("function filteredLogs(){const app=document.getElementById('appMonitorApp')?.value||'',level=document.getElementById('appMonitorLevel')?.value||'';return cachedLogs.filter(i=>(!app||i.aplicativo===app)&&(!level||i.nivel===level));}","function filteredLogs(){const app=document.getElementById('appMonitorApp')?.value||'',level=document.getElementById('appMonitorLevel')?.value||'';return cachedLogs.filter(i=>(!app||normalizeApp(i.aplicativo)===app)&&(!level||i.nivel===level));}")
text=text.replace('<option value=\"cliente\">Cliente</option>','<option value=\"participante\">Participante</option>')
text=text.replace("${escapeHtml(i.aplicativo||'')}","${escapeHtml(normalizeApp(i.aplicativo))}")
text=text.replace("cachedLogs=l.value||[];renderCachedLogs();","cachedLogs=(l.value||[]).map(i=>({...i,aplicativo:normalizeApp(i.aplicativo)}));renderCachedLogs();")
p.write_text(text,encoding='utf-8')

# Força atualização do módulo no PWA e deixa build auditável.
require_replace('index-ADMIN-v8.html','./app-monitoring-dashboard.js?v=2','./app-monitoring-dashboard.js?v=3')
# A chamada do SW atual pode aparecer uma ou mais vezes; trocamos todas com segurança.
p=Path('index-ADMIN-v8.html')
text=p.read_text(encoding='utf-8').replace("./sw.js?v=62","./sw.js?v=63")
p.write_text(text,encoding='utf-8')

p=Path('index.html')
text=p.read_text(encoding='utf-8').replace('entry=20260827.3','entry=20260827.4')
p.write_text(text,encoding='utf-8')

p=Path('runtime-build-info.js')
text=p.read_text(encoding='utf-8').replace("build:'20260827.3'","build:'20260827.4'").replace("expectedServiceWorkerVersion:'62'","expectedServiceWorkerVersion:'63'")
p.write_text(text,encoding='utf-8')

p=Path('sw.js')
text=p.read_text(encoding='utf-8').replace("rotina-family-adm-v62","rotina-family-adm-v63").replace("ROTINA_SW_VERSION='62'","ROTINA_SW_VERSION='63'").replace("ROTINA_BUILD_ID='20260827.3'","ROTINA_BUILD_ID='20260827.4'")
p.write_text(text,encoding='utf-8')

# Invariantes.
dash=Path('app-monitoring-dashboard.js').read_text(encoding='utf-8')
main=Path('index-ADMIN-v8.html').read_text(encoding='utf-8')
entry=Path('index.html').read_text(encoding='utf-8')
runtime=Path('runtime-build-info.js').read_text(encoding='utf-8')
sw=Path('sw.js').read_text(encoding='utf-8')
assert "const normalizeApp =" in dash
assert '<option value="participante">Participante</option>' in dash
assert '<option value="cliente">Cliente</option>' not in dash
assert 'normalizeApp(i.aplicativo)' in dash
assert 'app-monitoring-dashboard.js?v=3' in main
assert 'entry=20260827.4' in entry
assert "build:'20260827.4'" in runtime
assert "expectedServiceWorkerVersion:'63'" in runtime
assert "ROTINA_SW_VERSION='63'" in sw
assert "ROTINA_BUILD_ID='20260827.4'" in sw
print('NORMALIZE_ADM_PARTICIPANTE=OK')
