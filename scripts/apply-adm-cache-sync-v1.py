from pathlib import Path
import re

ROOT=Path('.')

def rep(s,a,b,label,count=1):
    if a not in s: raise SystemExit(f'Marcador ausente: {label}')
    return s.replace(a,b,count)

def reg(s,pat,repl,label):
    out,n=re.subn(pat,repl,s,count=1,flags=re.S)
    if n!=1: raise SystemExit(f'Regex {label}: {n}')
    return out

p=ROOT/'index-ADMIN-v8.html'
s=p.read_text(encoding='utf-8')
s=rep(s,
'collection, query, where, onSnapshot, addDoc, getDocs, writeBatch, doc, deleteDoc, updateDoc, getDoc, setDoc, deleteField',
'collection, query, where, addDoc, getDocs, getDocsFromCache, getDocsFromServer, writeBatch, doc, deleteDoc, updateDoc, getDoc, getDocFromCache, getDocFromServer, setDoc, deleteField',
'import cache-first ADM')
s=rep(s,
'    let unsubscribeResgates = null;\n\n    const diasSemana',
'''    let unsubscribeResgates = null;\n    const SINCRONIZACAO_ADM_MS = 5 * 60 * 1000;\n    let sincronizacaoAdmTimer = null;\n    let sincronizacaoAdmEmCurso = false;\n    let ultimaSincronizacaoAdmServidor = 0;\n    let eventosSincronizacaoAdmInstalados = false;\n    let migracaoLegadaConferida = false;\n\n    const diasSemana''',
'estado sync ADM')

new_block=r'''    function snapshotAdmCompartilhado(){
        return {grupoId:adminLogadoAtual?.codigoCliente||adminLogadoAtual?.grupoId||'',perfis:perfisCache.map(x=>({...x})),tarefas:tarefasCache.map(x=>({...x})),historico:historicoGrupoCache.map(x=>({...x})),recompensas:recompensasCache.map(x=>({...x})),resgates:resgatesCache.map(x=>({...x})),regraAtraso:{...regraAtrasoAtual},ultimaSincronizacaoServidor:ultimaSincronizacaoAdmServidor};
    }
    window.rotinaAdmCacheSnapshot=snapshotAdmCompartilhado;

    function renderizarCachesAdm(){
        atualizarSelects();
        atualizarMonitor();
        renderizarTabelaExclusao();
        renderizarDashboard();
        renderizarRecompensasAdmin();
        renderizarResgatesAdmin();
        atualizarExplicacaoRegraAtrasoAdmin();
        window.dispatchEvent(new CustomEvent('rotina-family-tasks-rendered',{detail:{origem:'cache-central-adm'}}));
        window.dispatchEvent(new CustomEvent('rotina-adm-cache-updated',{detail:{grupoId:adminLogadoAtual?.codigoCliente||adminLogadoAtual?.grupoId||''}}));
    }

    async function sincronizarDadosAdm(origem='intervalo-5min',servidor=true){
        const gId=adminLogadoAtual?.codigoCliente||adminLogadoAtual?.grupoId;
        if(!gId||sincronizacaoAdmEmCurso)return false;
        sincronizacaoAdmEmCurso=true;
        const inicio=performance.now();
        try{
            const lerColecao=servidor?getDocsFromServer:getDocsFromCache;
            const lerDocumento=servidor?getDocFromServer:getDocFromCache;
            const resultados=await Promise.allSettled([
                lerColecao(query(collection(db,'perfis'),where('grupoId','==',gId))),
                lerColecao(query(collection(db,'tarefas'),where('grupoId','==',gId))),
                lerColecao(query(collection(db,'historico'),where('grupoId','==',gId))),
                lerColecao(query(collection(db,'recompensas'),where('grupoId','==',gId))),
                lerColecao(query(collection(db,'resgates'),where('grupoId','==',gId))),
                lerDocumento(doc(db,'configGrupos',gId))
            ]);
            const [perfis,tarefas,historico,recompensas,resgates,config]=resultados;
            if(perfis.status==='fulfilled')perfisCache=perfis.value.docs.map(d=>({id:d.id,perfilId:d.data().perfilId||d.id,...d.data()}));
            if(tarefas.status==='fulfilled')tarefasCache=tarefas.value.docs.map(d=>({id:d.id,...d.data()}));
            if(historico.status==='fulfilled')historicoGrupoCache=historico.value.docs.map(d=>({id:d.id,...d.data()}));
            if(recompensas.status==='fulfilled')recompensasCache=recompensas.value.docs.map(d=>({id:d.id,...d.data()}));
            if(resgates.status==='fulfilled')resgatesCache=resgates.value.docs.map(d=>({id:d.id,...d.data()}));
            if(config.status==='fulfilled')regraAtrasoAtual=normalizarRegraAtraso(config.value.exists()?config.value.data():{});
            const falhas=resultados.filter(x=>x.status==='rejected').length;
            if(servidor&&falhas<resultados.length)ultimaSincronizacaoAdmServidor=Date.now();
            renderizarCachesAdm();
            if(!migracaoLegadaConferida&&perfisCache.length&&tarefasCache.length){migracaoLegadaConferida=true;migrarTarefasLegadas().catch(console.error);}
            window.rotinaLog?.('sync.adm_ciclo',{origem,servidor,tempoMs:Math.round(performance.now()-inicio),falhas,intervaloMin:5},falhas?'warning':'info');
            window.dispatchEvent(new CustomEvent('rotina-adm-sync-complete',{detail:{origem,servidor,falhas}}));
            return falhas<resultados.length;
        }catch(e){window.rotinaLog?.('sync.adm_erro',{origem,servidor,mensagem:String(e?.message||e)},'warning');return false;}
        finally{sincronizacaoAdmEmCurso=false;}
    }
    window.rotinaSincronizarAdmAgora=(motivo='manual')=>sincronizarDadosAdm(motivo,true);
    window.rotinaAtualizarAdmCacheLocal=(motivo='acao-local')=>sincronizarDadosAdm(motivo,false);

    function encerrarSincronizacaoAdm(){if(sincronizacaoAdmTimer){clearInterval(sincronizacaoAdmTimer);sincronizacaoAdmTimer=null;}}
    function iniciarEscutasFirebase() {
        // Cache-first: o ADM não mantém mais cinco listeners funcionais permanentes.
        [unsubscribePerfis,unsubscribeTarefasAdmin,unsubscribeHistoricoGrupo,unsubscribeRecompensas,unsubscribeResgates].forEach(u=>u&&u());
        encerrarSincronizacaoAdm();
        unsubscribePerfis=encerrarSincronizacaoAdm;unsubscribeTarefasAdmin=null;unsubscribeHistoricoGrupo=null;unsubscribeRecompensas=null;unsubscribeResgates=null;
        sincronizarDadosAdm('cache-inicial',false).finally(()=>sincronizarDadosAdm('servidor-inicial',true));
        sincronizacaoAdmTimer=setInterval(()=>{if(!document.hidden)sincronizarDadosAdm('intervalo-5min',true);},SINCRONIZACAO_ADM_MS);
        if(!eventosSincronizacaoAdmInstalados){
            eventosSincronizacaoAdmInstalados=true;
            document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-ultimaSincronizacaoAdmServidor>=SINCRONIZACAO_ADM_MS)sincronizarDadosAdm('retorno-visivel-stale',true);});
            window.addEventListener('online',()=>{if(Date.now()-ultimaSincronizacaoAdmServidor>=SINCRONIZACAO_ADM_MS)sincronizarDadosAdm('reconectado-stale',true);});
            // Após comandos locais, releia somente o IndexedDB local; isso não gera leitura cobrada.
            document.addEventListener('click',e=>{
                const el=e.target.closest?.('button,[role="button"]');if(!el)return;
                const acao=String(el.getAttribute('onclick')||el.dataset?.action||el.dataset?.act||'');
                if(!/(salvar|excluir|aprovar|recusar|bloquear|desbloquear|confirmar|reverter|retirar|ativar)/i.test(acao))return;
                setTimeout(()=>sincronizarDadosAdm('acao-local-cache',false),700);
                setTimeout(()=>sincronizarDadosAdm('acao-local-cache-tardio',false),1800);
            },true);
        }
    }

    async function migrarTarefasLegadas'''
s=reg(s,r'    function iniciarEscutasFirebase\(\) \{.*?\n    \}\n\n    async function migrarTarefasLegadas',new_block,'listeners ADM')

# Login: a regra já vem no ciclo central; evita leitura duplicada imediata da configuração.
s=rep(s,
"        iniciarEscutasFirebase();\n        Promise.allSettled([verificarEExecutarResetSemanal(adminLogadoAtual.codigoCliente || adminLogadoAtual.grupoId),carregarRegraAtraso()]);",
"        iniciarEscutasFirebase();\n        // Regra/configuração é carregada pelo cache central. Reset semanal permanece em tarefa de manutenção separada.\n        setTimeout(()=>verificarEExecutarResetSemanal(adminLogadoAtual.codigoCliente || adminLogadoAtual.grupoId),1500);",
'login sem regra duplicada')

# Logout encerra timer.
s=rep(s,
"    window.realizarLogout = () => {\n        window.desvincularAdmDoPush?.();",
"    window.realizarLogout = () => {\n        encerrarSincronizacaoAdm();\n        window.desvincularAdmDoPush?.();",
'logout encerra ADM sync')
p.write_text(s,encoding='utf-8')

# Alarme ADM: cache persistente + servidor a cada 5 minutos, sem listener permanente.
p=ROOT/'family-alarm-admin.js'
s=p.read_text(encoding='utf-8')
s=rep(s,
"import {addDoc,collection,doc,getFirestore,onSnapshot,query,serverTimestamp,setDoc,where} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';",
"import {addDoc,collection,doc,getFirestore,getDocsFromCache,getDocsFromServer,query,serverTimestamp,setDoc,where} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';",
'alarme ADM imports')
s=rep(s,
"let alarmes=ler(KEY_STATE,{}),unsub=null,grupoEscutado='',documentosRemotos=[];",
"let alarmes=ler(KEY_STATE,{}),unsub=null,grupoEscutado='',documentosRemotos=[],alarmSyncTimer=null,alarmSyncBusy=false,lastAlarmServerSync=0;\nconst ALARM_SYNC_MS=5*60*1000;",
'alarme ADM state')
new_alarm="""function aplicarAlarmesSnapshot(s,origem){const g=grupo(),proximos={};documentosRemotos=s.docs.map(d=>({ref:d.ref,dados:{id:d.id,...d.data()}}));documentosRemotos.forEach(item=>{const a=item.dados;if(a.tarefaId&&naSemanaAtual(a))proximos[a.tarefaId]=a});ler(KEY_PENDING,[]).filter(a=>a.grupoId===g&&naSemanaAtual(a)).forEach(a=>{proximos[a.tarefaId]=a});alarmes=proximos;salvar(KEY_STATE,alarmes);expirarAlarmesRemotos();atualizarBotoes();window.dispatchEvent(new CustomEvent('rotina-family-alarm-sync',{detail:{origem}}));}\nasync function sincronizarAlarmes(servidor=true,origem='intervalo-5min'){const g=grupo();if(!g||!getApps().length||alarmSyncBusy)return false;alarmSyncBusy=true;try{const q=query(collection(getFirestore(getApp()),'despertadores'),where('grupoId','==',g)),snap=await (servidor?getDocsFromServer(q):getDocsFromCache(q));aplicarAlarmesSnapshot(snap,origem);if(servidor)lastAlarmServerSync=Date.now();return true}catch(e){return false}finally{alarmSyncBusy=false;}}\nfunction escutar(tentativa=0){const g=grupo();if(!g||!getApps().length){if(tentativa<120)setTimeout(()=>escutar(tentativa+1),100);return}if(grupoEscutado===g&&alarmSyncTimer)return;grupoEscutado=g;if(alarmSyncTimer)clearInterval(alarmSyncTimer);unsub=()=>{if(alarmSyncTimer){clearInterval(alarmSyncTimer);alarmSyncTimer=null;}};sincronizarAlarmes(false,'cache-persistente').finally(()=>sincronizarAlarmes(true,'servidor-inicial'));alarmSyncTimer=setInterval(()=>{if(!document.hidden)sincronizarAlarmes(true,'intervalo-5min');},ALARM_SYNC_MS);sincronizarFila()}\n\nfunction zerarViradaSemana"""
s=reg(s,r'function escutar\(tentativa=0\)\{.*?\}\n\nfunction zerarViradaSemana',new_alarm,'alarme ADM sync 5m')
s=s.replace('setInterval(decorarTarefas,5000)','setInterval(decorarTarefas,60000)')
s=s.replace("window.addEventListener('online',()=>{sincronizarFila();expirarAlarmesRemotos()});document.addEventListener('visibilitychange',()=>{if(!document.hidden){zerarViradaSemana();expirarAlarmesRemotos();decorarTarefas()}});",
"window.addEventListener('online',()=>{sincronizarFila();if(Date.now()-lastAlarmServerSync>=ALARM_SYNC_MS)sincronizarAlarmes(true,'reconectado-stale');expirarAlarmesRemotos()});document.addEventListener('visibilitychange',()=>{if(!document.hidden){zerarViradaSemana();if(Date.now()-lastAlarmServerSync>=ALARM_SYNC_MS)sincronizarAlarmes(true,'retorno-visivel-stale');expirarAlarmesRemotos();decorarTarefas()}});")
p.write_text(s,encoding='utf-8')

# Entrada/SW.
p=ROOT/'index.html';s=p.read_text(encoding='utf-8');s=s.replace('entry=20260826.4','entry=20260827.1');p.write_text(s,encoding='utf-8')
p=ROOT/'sw.js';s=p.read_text(encoding='utf-8');s=s.replace("rotina-family-adm-v59","rotina-family-adm-v60").replace("ROTINA_SW_VERSION='59'","ROTINA_SW_VERSION='60'").replace("ROTINA_BUILD_ID='20260825.2'","ROTINA_BUILD_ID='20260827.1'").replace("runtime-build-info.js?v=20260825.2","runtime-build-info.js?v=20260827.1");p.write_text(s,encoding='utf-8')

print('ADM_CACHE_SYNC_V1_APLICADO')
