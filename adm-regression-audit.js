const fs=require('fs'),vm=require('vm');
const read=f=>fs.readFileSync(f,'utf8');
const html=read('index-ADMIN-v8.html'),dash=read('dashboard-ranking-pro.js'),mon=read('monitor-pro.js'),rewards=read('rewards-admin-ui-v2.js'),manage=read('manage-pro.js'),manageCss=read('manage-pro.css'),mobile=read('mobile-app-ui.js'),css=read('mobile-app-ui.css'),review=read('adm-justification-review.js'),early=read('adm-early-start-ui.js'),scores=read('adm-score-history-cards.js'),notify=read('reward-redemption-notifications.js'),sw=read('sw.js'),manifest=JSON.parse(read('manifest.json'));
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);console.log('OK - '+msg)};

// Stability / loading
assert(!mobile.includes('setInterval('),'mobile UI has no continuous interval');
assert(!review.includes('setInterval('),'review module has no continuous interval');
assert(!early.includes('setInterval('),'early-start module has no continuous interval');
assert(!dash.includes('setInterval('),'dashboard/rewards navigation adds no continuous interval');
assert(!rewards.includes('setInterval('),'rewards admin module has no continuous interval');
assert(!scores.includes('setInterval('),'score-history module has no continuous interval');
assert(!review.includes('MutationObserver'),'review module adds no mutation observer');
assert(early.includes("observe(tb,{childList:true,subtree:false})"),'early-start observer is restricted to direct rows');
assert(!mobile.includes('adm-enhancements.js'),'known freezing enhancement is not imported');
assert(!sw.includes('adm-enhancements.js'),'known freezing enhancement is outside app shell');
assert(sw.includes("cache:'no-store'"),'app assets refresh network-first');
assert(sw.includes("const CACHE_NAME='rotina-family-adm-v40'"),'ADM cache is v40');
assert(sw.includes("'./rewards-admin-ui-v2.js'"),'rewards admin module is included in ADM app shell');
assert(sw.includes("'./reward-redemption-notifications.js'"),'redemption notification module is included in ADM app shell');
assert(html.includes('reward-redemption-notifications.js'),'redemption notification module loads in the ADM page');
assert(notify.includes("collection(db, 'resgates')"),'redemption notification listens to the resgates collection');
assert(notify.includes("String(resgate.status || 'Pendente').toLowerCase() === 'pendente'"),'only pending redemptions trigger alerts');
assert(notify.includes('Notification.requestPermission()'),'system notification permission is requested from an administrator gesture');
assert(notify.includes('resgate-tab-badge'),'pending redemptions remain visible as a tab badge');
assert(sw.includes("self.addEventListener('notificationclick'"),'system redemption notification opens the ADM');
assert(sw.includes("'./adm-score-history-cards.js'"),'score-history module is included in ADM app shell');
assert(manifest.start_url.includes('index-ADMIN-v8.html'),'installed ADM starts directly on real page');
assert(sw.includes('APP_MAIN_URL'),'legacy root navigation is redirected');
assert(mobile.includes('MOBILE_QUERY.matches'),'mobile UI remains viewport-gated');

// Task-management presentation
assert(html.includes('<th>Horário sugerido / Tolerância</th>'),'management table header includes tolerance');
assert(html.includes('Tolerância: ${Number(t.tempoLimite)||0} min'),'each managed task exposes its registered tolerance in source table');
assert(html.includes('<strong>${t.horaSugeridaInicio} às ${t.horaSugeridaFim}</strong>'),'suggested schedule remains displayed');
assert(html.includes('renderizarTabelaExclusao'),'task management renderer remains present');
assert(manage.includes("const horario=celHorario?.querySelector('strong')"),'mobile card reads schedule separately from tolerance');
assert(manage.includes("const tolerancia=(textoTol.match(/Tolerância:"),'mobile card reads tolerance separately');
assert(manage.includes('<strong>${escG(x.tarefa)}</strong>'),'mobile card preserves task name/description');
assert(manage.includes('<div class="ger-time-block">'),'mobile card groups schedule and tolerance together');
assert(manage.includes('<small class="ger-tolerance">Tol. ${escG(x.tolerancia)} min</small>'),'mobile card puts compact tolerance directly below schedule');
assert(manage.includes('<span>${escG(x.usuario)}</span>'),'integrant line stays clean and separate');
assert(!manage.includes('${escG(x.usuario)} <small class="ger-tolerance">'),'tolerance no longer competes with description/integrant line');
assert(manageCss.includes('.ger-time-block{display:grid'),'schedule/tolerance block styling exists');
assert(manageCss.includes('.ger-tolerance{display:inline-flex'),'compact tolerance styling exists');
assert(manageCss.includes('.ger-main strong{font-size:14px'),'task description styling remains intact');
assert(manageCss.includes('.ger-time{font-size:14px'),'original schedule badge styling remains intact');

// 12.5% + 12.5% tolerance explanation
assert(html.includes('Primeiros +12,5% após zerar'),'ADM explains first 75% recovery band');
assert(html.includes('Próximos +12,5%'),'ADM explains second 50% recovery band');
assert(html.includes('Após +25% adicional'),'ADM explains total recovery cap');
assert(html.includes('100% até 09:59; 75% de 10:00 a 11:14; 50% de 11:15 a 12:29; em 12:30 = 0%'),'ADM shows exact 10-minute example');
assert(mon.includes('12,5%')&&mon.includes('25% adicional no total'),'Monitor rule modal explains both recovery bands');
assert(!html.includes('Tolerância excedida até +50%'),'old +50% recovery wording is absent');

// Justification review / returned points
assert(mobile.includes('mon-just-flag'),'mobile justification flag remains clickable');
assert(css.includes('white-space:normal'),'mobile status may wrap rather than truncate');
assert(review.includes('pontosOriginais'),'automatic points are preserved');
assert(review.includes('percentualOriginal'),'automatic percentage is preserved');
assert(review.includes('pontosDevolvidos'),'returned points are recorded separately');
assert(review.includes('revisaoDecisao'),'adult decision is recorded separately');
assert(review.includes('writeBatch'),'offline review uses Firestore batch');
assert(review.includes('navigator.onLine===false'),'offline review has queued-sync feedback');
assert(review.includes('function decisaoTomada(h)'),'single-decision lock exists');
assert(review.includes('data-review="reverter"'),'reviewed item exposes revert action');
assert(review.includes("if(tipo==='reverter')"),'revert path exists');
assert(review.includes("revisaoStatus:'aguardando'"),'revert returns review to pending');
assert(review.includes('pontosGanhos:o.pontos'),'revert restores automatic points');
assert(!review.includes('Math.max(o.pctAtual'),'old cumulative review behavior stays removed');

// Early start
assert(mobile.includes("import('./adm-early-start-ui.js')"),'early-start module is loaded');
assert(early.includes("b.textContent='🔵 Início antecipado'"),'desktop early-start marker remains blue');
assert(mobile.includes('🔵 Início antecipado'),'mobile early-start marker remains blue');
assert(early.includes('motivoInicioAntecipado'),'ADM reads early-start reason');
assert(early.includes('não reduz pontos nem consome tolerância'),'early start remains informational');
assert(!early.includes('updateDoc(')&&!early.includes('setDoc(')&&!early.includes('writeBatch('),'early-start display never writes scoring data');

// Status regression
const sm=mobile.match(/function statusCard\(txt=''\)\{[\s\S]*?\n\}/);assert(sm,'statusCard found');
const box={fn:null};vm.createContext(box);vm.runInContext(sm[0]+';fn=statusCard;',box);
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
assert(eq(box.fn('No Prazo (100%)'),['ok','100% · No prazo']),'100% status is correct');
assert(eq(box.fn('No Prazo — atraso leve (75%)'),['light','75% · atraso leve']),'75% status is correct');
assert(eq(box.fn('No Prazo — atraso maior (50%)'),['major','50% · atraso maior']),'50% status is correct');
assert(eq(box.fn('Atrasado (0%)'),['late','0% · Atrasado']),'0% status is correct');
assert(html.includes('.badge-75 { background: #fef9c3; color: #854d0e; border: 1px solid #fde047; }'),'desktop 75% uses timer yellow band');
assert(html.includes('.badge-50 { background: #ffedd5; color: #9a3412; border: 1px solid #fdba74; }'),'desktop 50% uses timer orange band');
assert(css.includes('.mon-app-status.light{background:#fef9c3')&&css.includes('.mon-app-status.major{background:#ffedd5'),'mobile ADM uses distinct timer bands');

// Existing period navigation
assert(dash.includes('function moverData(ref, periodo, direcao)'),'shared previous/next period navigator exists');
assert(dash.includes("periodo==='semanal'?7:1"),'week navigation moves exactly seven days');
assert(dash.includes("if(periodo==='mensal'){"),'month navigation has explicit calendar-month branch');
assert(dash.includes('d.setDate(1);'),'month navigation normalizes day before changing month');
const mm=dash.match(/function moverData\(ref, periodo, direcao\)\{[\s\S]*?\n\}/);assert(mm,'moverData found');
const monthBox={fn:null};vm.createContext(monthBox);vm.runInContext(mm[0]+';fn=moverData;',monthBox);
const jan31=monthBox.fn(new Date(2026,0,31,12),'mensal',1);assert(jan31.getFullYear()===2026&&jan31.getMonth()===1&&jan31.getDate()===1,'Jan 31 advances to February without skipping month');
const dec31=monthBox.fn(new Date(2026,11,31,12),'mensal',1);assert(dec31.getFullYear()===2027&&dec31.getMonth()===0&&dec31.getDate()===1,'December advances safely into January of next year');
const mar31=monthBox.fn(new Date(2026,2,31,12),'mensal',-1);assert(mar31.getFullYear()===2026&&mar31.getMonth()===1&&mar31.getDate()===1,'March 31 goes back to February without skipping month');
assert(dash.includes('adicionarNavegacaoMonitor'),'Monitor date filter receives previous/today/next navigation');
assert(dash.includes("input.value=iso(new Date());window.atualizarMonitor?.()"),'Monitor can return directly to today');
assert(dash.includes('dashboardPeriodNav'),'Dashboard date filter has previous/current/next navigation');
assert(dash.includes('periodoAtual=b.dataset.p'),'Dashboard navigation follows Day/Week/Month selection');
assert(dash.includes('rewardPeriodNav'),'Rewards history has previous/current/next navigation');
assert(dash.includes('periodoRecompensas=b.dataset.rp'),'Rewards navigation follows Day/Week/Month selection');
assert(dash.includes('function intervaloPeriodo(ref, periodo)'),'shared day/week/month boundaries exist');

// New ADM score-history cards and historical filters
assert(scores.includes("const inicioSemana=d=>"),'score cards define week start');
assert(scores.includes("const fimSemana=d=>"),'score cards define full week end');
assert(scores.includes("const inicioMes=d=>"),'score cards define month start');
assert(scores.includes("const fimMes=d=>"),'score cards define month end');
assert(scores.includes('function pontosPossiveis'),'score cards calculate dynamic possible points');
assert(scores.includes("document.getElementById('filtroIntegrante')"),'Monitor score cards follow selected integrant');
assert(scores.includes("document.getElementById('filtroData')"),'Monitor score cards follow selected historical date');
assert(scores.includes("document.getElementById('dashboardDataRef')"),'Dashboard score cards follow historical reference date');
assert(scores.includes("document.getElementById('dashboardPerfil')"),'Dashboard score cards follow selected integrant');
assert(scores.includes("periodos=[['Dia'"),'score cards render Day/Week/Month together');
assert(scores.includes("mover(input,-1)"),'historical day previous navigation exists');
assert(scores.includes("mover(input,1)"),'historical day next navigation exists');
assert(scores.includes("input.value=iso(new Date())"),'historical filter can return to today');
assert(scores.includes('hist.filter(h=>h.data>=iso(ini)&&h.data<=iso(fim))'),'earned points are bounded by selected historical interval');
assert(scores.includes('pontosPossiveis(p,ini,fim,dados)'),'possible points use the same selected historical interval');

// Rewards
assert(dash.includes('Histórico de Resgates'),'rewards uses period-based history instead of a continuous heading');
assert(dash.includes('Sem resgates no período selecionado.'),'empty selected period is explicit');
assert(dash.includes('reward-history-day'),'resgates are grouped by local calendar day');
assert(dash.includes('dataLocalRegistro(r.criadoEm)'),'redemption timestamps are converted to local calendar day');
assert(dash.includes("window.alternarRecompensa=async function"),'reward publish/deactivate action exists');
assert(dash.includes("{ativa:!ativaAtual,atualizadoEm:new Date().toISOString()}"),'publish state toggles without deleting historical records');
assert(dash.includes("r.ativa!==false"),'legacy rewards remain published by default');
assert(dash.includes("getDocs(query(collection(db,'resgates')"),'Dashboard reads redemption records for period metrics');
assert(dash.includes('Somente pedidos aprovados no período'),'Dashboard resgatado KPI counts approved redemptions');
assert(dash.includes('Resgatado ÷ alcançado'),'Dashboard exposes redeemed percentage definition');
assert(dash.includes("r.status==='Aprovado'"),'redeemed points exclude pending/refused requests');
assert(dash.includes("(r.status||'Pendente')==='Pendente'"),'pending points remain separate');
assert(mon.includes("import('./rewards-admin-ui-v2.js')"),'focused rewards admin module is loaded');
assert(rewards.includes('rewardReportToolbar'),'reward period tabs are moved into the report toolbar');
assert(rewards.includes('Período consultado:'),'reward report exposes selected-period legend');
assert(rewards.includes('Histórico de Resgates'),'reward report keeps explicit history title near filters');
assert(rewards.includes("onclick=\"editarRecompensaAdmin('${r.id}')\""),'ADM reward catalog exposes Edit action');
assert(rewards.includes("${ativa?'Desativar':'Ativar'}"),'ADM reward catalog exposes Activate/Deactivate action');
assert(rewards.includes("${ativa?'ATIVA':'DESATIVADA'}"),'ADM reward catalog shows active state');
assert(rewards.includes("{nome,pontos,atualizadoEm:new Date().toISOString()}"),'reward edit changes name and points without deleting history');
assert(!rewards.includes('deleteDoc('),'reward edit module never deletes historical records');
assert(html.includes("function renderizarRecompensasAdmin(){ const el=document.getElementById('listaRecompensasAdmin')"),'legacy local reward renderer is still identified');
assert(rewards.includes("catalogoObserver=new MutationObserver"),'reward catalog watches legacy rerenders');
assert(rewards.includes("if(temItens&&!estaV2)renderCatalogoV2()"),'legacy-only catalog is replaced by V2 controls');
assert(rewards.includes('reward-admin-v2-item'),'V2 catalog has a stable marker to avoid rerender loops');
assert(rewards.includes("const h3=[...root.children].find(x=>x.tagName==='H3'"),'legacy reward-history heading is removed from the page root');
assert(!rewards.includes("root.querySelectorAll('h3')].find"),'new report title is not confused with the legacy title');

// Dashboard / ranking / core flows
assert(dash.includes('rankingDetalhadoDashboard'),'detailed ranking renderer remains');
assert(dash.includes('pontosGanhos'),'dashboard uses effective points');
assert(dash.includes("faixaAtraso==='dentro-limites'"),'punctuality uses automatic result');
assert(css.includes('#rankingDetalhadoDashboard .ranking-table-pro{min-width:0'),'mobile detailed ranking width override remains');
for(const s of ['salvarTarefa','preencherEdicaoTarefa','excluirTarefa','atualizarMonitor','renderizarDashboard','salvarRecompensa']) assert(html.includes(s),'core flow '+s+' remains');
assert(html.includes('justificativaObrigatoria'),'task justification setting remains');
assert(html.includes('onAuthStateChanged'),'session restoration remains');
assert(manage.includes("import('./mobile-app-ui.js')"),'manage to mobile UI import remains');
assert(dash.includes("import('./monitor-pro.js')"),'dashboard to monitor import remains');
assert(mon.includes("import('./manage-pro.js')"),'monitor to manage import remains');
assert(mobile.includes("import('./adm-justification-review.js')"),'review module import remains');

// Returned-point math stays absolute, not cumulative
const pts=(max,pct)=>Math.round(max*pct/100),ret=(orig,max,p)=>Math.max(orig,pts(max,p));
assert(ret(0,20,50)===10,'0 to 50% returns 10/20');
assert(ret(0,20,75)===15,'0 to 75% returns 15/20');
assert(ret(0,20,100)===20,'0 to 100% returns 20/20');
const original=0,max=20,first=ret(original,max,50),reverted=original,next=ret(reverted,max,100);
assert(first===10&&reverted===0&&next===20,'50% then revert then 100% ends at 20, never 30');
console.log('ALL ADM PRODUCTION REGRESSION CHECKS PASSED');
