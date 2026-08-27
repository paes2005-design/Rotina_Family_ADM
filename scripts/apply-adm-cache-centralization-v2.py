from pathlib import Path
import re


def replace_once(s, old, new, label):
    if old not in s:
        raise SystemExit(f'Marcador ausente: {label}')
    return s.replace(old, new, 1)


def regex_once(s, pattern, repl, label):
    out, n = re.subn(pattern, repl, s, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(f'Regex {label}: {n}')
    return out

# 1) Monitor individual: reutiliza historicoGrupoCache, sem novo listener.
p=Path('index-ADMIN-v8.html')
s=p.read_text(encoding='utf-8')
new_panel="""    function atualizarPainelPontuacaoAdmin() {
        const filtroPerfilId = document.getElementById('filtroIntegrante').value;
        const perfilSelecionado = perfisCache.find(p=>p.id===filtroPerfilId) || null;
        const filtroUsuario = perfilSelecionado?.nome || '';
        const secao = document.getElementById('secaoPontuacaoMonitor');

        if(!filtroUsuario) {
            secao.style.display = 'none';
            integranteHistoricoAtual = null;
            historicoAdminCache = [];
            return;
        }

        secao.style.display = 'block';
        integranteHistoricoAtual = filtroUsuario;
        historicoAdminCache = historicoGrupoCache.filter(h => h.perfilId ? h.perfilId === filtroPerfilId : h.perfilNome === filtroUsuario);
        renderizarPainelPontuacaoAdmin(historicoAdminCache);
    }

    window.atualizarMonitor"""
s=regex_once(s,r"    function atualizarPainelPontuacaoAdmin\(\) \{.*?\n    \}\n\n    window\.atualizarMonitor",new_panel,'painel sem snapshot')
# Restauração de sessão: regra/config já vem no ciclo central.
s=s.replace("            Promise.allSettled([verificarEExecutarResetSemanal(adminLogadoAtual.codigoCliente || adminLogadoAtual.grupoId),carregarRegraAtraso()]);",
            "            setTimeout(()=>verificarEExecutarResetSemanal(adminLogadoAtual.codigoCliente || adminLogadoAtual.grupoId),1500);",1)
# Bump scripts ativos e SW.
s=s.replace('./reward-redemption-notifications.js?v=2','./reward-redemption-notifications.js?v=3')
s=s.replace("navigator.serviceWorker.register('./sw.js?v=39')","navigator.serviceWorker.register('./sw.js?v=61')")
p.write_text(s,encoding='utf-8')

# 2) Avisos de resgate: consomem o cache central do ADM; push continua imediato.
p=Path('reward-redemption-notifications.js')
s=p.read_text(encoding='utf-8')
s=replace_once(s,
'import { getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";\nimport { getFirestore, collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";\n\n',
'', 'imports reward listener')
s=s.replace('function processarSnapshot(snapshot, grupoId) {\n  const pendentes = snapshot.docs\n    .map(docSnap => ({ id: docSnap.id, grupoId, ...docSnap.data() }))',
'''function processarLista(lista, grupoId) {
  const pendentes = (lista || [])
    .map(item => ({ grupoId, ...item }))''',1)
new_listen="""function iniciarEscuta() {
  const grupoId = grupoAtual();
  if (!grupoId) return;
  grupoEmEscuta = grupoId;
  const lista = window.rotinaAdmCacheSnapshot?.().resgates || [];
  processarLista(lista, grupoId);
}

function instalar() {
  garantirEstilo();
  iniciarEscuta();
  window.addEventListener('rotina-admin-session-ready',()=>setTimeout(iniciarEscuta,100));
  window.addEventListener('rotina-adm-cache-updated',iniciarEscuta);
  if (new URLSearchParams(location.search).get('abrir') === 'resgates') setTimeout(abrirRecompensas, 700);
}

if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', instalar, { once: true });
else instalar();
"""
s=regex_once(s,r"function iniciarEscuta\(\) \{.*?if \(document\.readyState === 'loading'\).*?else instalar\(\);",new_listen,'reward central cache')
p.write_text(s,encoding='utf-8')

# 3) Entry/SW.
p=Path('index.html');s=p.read_text(encoding='utf-8')
s=s.replace('entry=20260827.1','entry=20260827.2')
p.write_text(s,encoding='utf-8')
p=Path('sw.js');s=p.read_text(encoding='utf-8')
s=s.replace('rotina-family-adm-v60','rotina-family-adm-v61')
s=s.replace("ROTINA_SW_VERSION='60'","ROTINA_SW_VERSION='61'")
s=s.replace("ROTINA_BUILD_ID='20260827.1'","ROTINA_BUILD_ID='20260827.2'")
s=s.replace('runtime-build-info.js?v=20260827.1','runtime-build-info.js?v=20260827.2')
p.write_text(s,encoding='utf-8')
print('ADM_CACHE_CENTRALIZATION_V2=OK')
