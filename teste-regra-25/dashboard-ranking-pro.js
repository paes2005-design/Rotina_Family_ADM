import { getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

if(!document.querySelector('link[data-monitor-pro]')){
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='./monitor-pro.css';
  link.dataset.monitorPro='1';
  document.head.appendChild(link);
}
import('./monitor-pro.js').catch(e=>console.error('Monitor profissional:',e));

const obterDb = () => getApps().length ? getFirestore(getApp()) : null;
let periodoAtual = 'semanal';
let dashboardMontada = false;

const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const inicioSemana = d => { const x=new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate()-x.getDay()); return x; };
const cores=['#315e8a','#4d8f74','#d39b3a','#9c6ade','#d1605d','#5b7c99','#7b8f47'];

function montarDashboard(){
  const root=document.getElementById('dashboard'); if(!root||dashboardMontada) return;
  root.innerHTML=`
    <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap">
      <div><h2 style="margin-bottom:4px">Dashboard de Desempenho</h2><p style="color:#667788;margin-top:0">Ranking, pontualidade e evolução da rotina familiar.</p></div>
      <div class="period-tabs">
        <button id="dashTabDiario" class="period-tab" data-p="diario">Dia</button>
        <button id="dashTabSemanal" class="period-tab active" data-p="semanal">Semana</button>
        <button id="dashTabMensal" class="period-tab" data-p="mensal">Mês</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:15px 0">
      <div><label for="dashboardDataRef">Data de referência</label><input type="date" id="dashboardDataRef"></div>
      <div><label for="dashboardPerfil">Filtrar integrante</label><select id="dashboardPerfil"><option value="">Todos</option></select></div>
    </div>
    <div class="dashboard-pro">
      <div id="dashboardFamilia" class="dashboard-summary"></div>
      <div class="dashboard-grid-2">
        <div class="dashboard-panel"><h3>🏆 Pódio do período</h3><div class="sub" id="dashboardPeriodoLegenda">Classificação pela pontuação</div><div id="podioDashboard" class="podium"></div></div>
        <div class="dashboard-panel"><h3>📊 Pontos por integrante</h3><div class="sub">Comparação direta no período selecionado</div><div id="graficoPontosDashboard" class="chart-wrap"></div></div>
      </div>
      <div class="dashboard-grid-2">
        <div class="dashboard-panel"><h3>✅ Cumprimento das tarefas</h3><div class="sub">No prazo, atraso parcial e tarefas zeradas</div><div id="graficoStatusDashboard" class="chart-wrap"></div></div>
        <div class="dashboard-panel"><h3>📈 Evolução dos últimos 7 dias</h3><div class="sub">Pontos conquistados por dia</div><div id="graficoEvolucaoDashboard" class="chart-wrap"></div></div>
      </div>
      <div class="dashboard-panel"><h3>Ranking detalhado</h3><div class="sub">Pontuação, pontualidade, tarefas e sequência</div><div class="tabela-scroll"><div id="rankingDetalhadoDashboard"></div></div></div>
    </div>`;
  document.getElementById('dashboardDataRef').value=iso(new Date());
  root.querySelectorAll('.period-tab').forEach(b=>b.addEventListener('click',()=>{periodoAtual=b.dataset.p;root.querySelectorAll('.period-tab').forEach(x=>x.classList.toggle('active',x===b));window.renderizarDashboard();}));
  document.getElementById('dashboardDataRef').addEventListener('change',()=>window.renderizarDashboard());
  document.getElementById('dashboardPerfil').addEventListener('change',()=>window.renderizarDashboard());
  dashboardMontada=true;
}

function svgBarras(dados,campo){
  if(!dados.length) return '<p style="color:#777">Sem dados no período.</p>';
  const max=Math.max(1,...dados.map(x=>x[campo])),w=620,h=Math.max(190,dados.length*44+35),left=105,right=35,bw=w-left-right;let g=`<svg viewBox="0 0 ${w} ${h}">`;
  dados.forEach((x,i)=>{const y=15+i*44,bar=Math.max(2,(x[campo]/max)*bw);g+=`<text x="${left-9}" y="${y+18}" text-anchor="end" font-size="12" fill="#526579">${esc((x.nome||'').slice(0,14))}</text><rect x="${left}" y="${y+5}" width="${bar}" height="20" rx="7" fill="${cores[i%cores.length]}"/><text x="${Math.min(w-28,left+bar+7)}" y="${y+19}" font-size="11" font-weight="700" fill="#34495e">${x[campo]} pts</text>`});
  return g+'</svg>';
}
function svgStatus(c){
  const total=Math.max(1,c.prazo100+c.parcial+c.zerado),vals=[c.prazo100,c.parcial,c.zerado],cs=['#4d8f74','#d39b3a','#d1605d'],labs=['No prazo','Atraso parcial','Zeradas'];let x=28,s='<svg viewBox="0 0 620 210"><rect x="28" y="45" width="564" height="34" rx="12" fill="#edf1f5"/>';
  vals.forEach((v,i)=>{const ww=v/total*564;if(ww>0){s+=`<rect x="${x}" y="45" width="${ww}" height="34" fill="${cs[i]}"/>`;x+=ww;}});
  vals.forEach((v,i)=>s+=`<circle cx="${65+i*185}" cy="135" r="6" fill="${cs[i]}"/><text x="${78+i*185}" y="140" font-size="12" fill="#53677b">${labs[i]}: ${v}</text><text x="${65+i*185}" y="168" font-size="18" font-weight="700" fill="#2f4358">${Math.round(v/total*100)}%</text>`);
  return s+'</svg>';
}
function svgLinha(pontos){
  const w=620,h=230,l=42,r=22,t=24,b=42,max=Math.max(1,...pontos.map(x=>x.valor)),pw=w-l-r,ph=h-t-b,coords=pontos.map((x,i)=>({x:l+i*(pw/Math.max(1,pontos.length-1)),y:t+ph-(x.valor/max)*ph,...x}));let s=`<svg viewBox="0 0 ${w} ${h}"><line x1="${l}" y1="${t+ph}" x2="${w-r}" y2="${t+ph}" stroke="#dbe4ec"/>`;
  [0,.5,1].forEach(k=>{const yy=t+ph-k*ph;s+=`<line x1="${l}" y1="${yy}" x2="${w-r}" y2="${yy}" stroke="#edf1f5"/><text x="${l-7}" y="${yy+4}" text-anchor="end" font-size="10" fill="#8795a4">${Math.round(max*k)}</text>`});
  if(coords.length){s+=`<polyline fill="none" stroke="#315e8a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" points="${coords.map(c=>c.x+','+c.y).join(' ')}"/>`;coords.forEach(c=>s+=`<circle cx="${c.x}" cy="${c.y}" r="5" fill="#fff" stroke="#315e8a" stroke-width="3"/><text x="${c.x}" y="${h-14}" text-anchor="middle" font-size="10" fill="#67798c">${c.label}</text>`)}return s+'</svg>';
}
function ehPontual(h){return h.faixaAtraso?h.faixaAtraso==='dentro-limites':(h.status?.includes('Prazo')&&!h.iniciouComAtraso);}
function sequencia(hist){const datas=new Set(hist.filter(ehPontual).map(h=>h.data));let d=new Date(),n=0;for(let i=0;i<60;i++){const k=iso(d);if(datas.has(k))n++;else if(i>0)break;d.setDate(d.getDate()-1)}return n;}

async function carregarDados(grupoId, db){
  const [ps,hs]=await Promise.all([getDocs(query(collection(db,'perfis'),where('grupoId','==',grupoId))),getDocs(query(collection(db,'historico'),where('grupoId','==',grupoId)))]);
  return {perfis:ps.docs.map(d=>({id:d.id,...d.data()})),historico:hs.docs.map(d=>({id:d.id,...d.data()}))};
}

window.renderizarDashboard=async function(){
  montarDashboard(); const db=obterDb(); if(!db) return;
  const grupoId=(document.getElementById('displayCodigoCliente')?.innerText||'').trim(); if(!grupoId||grupoId==='--'||grupoId==='CLI-Gen') return;
  const root=document.getElementById('dashboardFamilia'); root.innerHTML='<div class="dashboard-kpi"><small>Atualizando</small><strong>...</strong><em>Carregando dados</em></div>';
  try{
    const {perfis,historico}=await carregarDados(grupoId,db),sel=document.getElementById('dashboardPerfil'),atual=sel.value;
    sel.innerHTML='<option value="">Todos</option>'+perfis.map(p=>`<option value="${esc(p.id)}">${esc(p.nome)}</option>`).join(''); if([...sel.options].some(o=>o.value===atual))sel.value=atual;
    const ref=new Date((document.getElementById('dashboardDataRef').value||iso(new Date()))+'T12:00:00'),dia=iso(ref),iniS=iso(inicioSemana(ref)),fimSD=new Date(inicioSemana(ref));fimSD.setDate(fimSD.getDate()+6);const fimS=iso(fimSD),iniM=`${ref.getFullYear()}-${String(ref.getMonth()+1).padStart(2,'0')}-01`,fimM=iso(new Date(ref.getFullYear(),ref.getMonth()+1,0));
    const campo=periodoAtual;
    const periodoIni=campo==='diario'?dia:campo==='mensal'?iniM:iniS, periodoFim=campo==='diario'?dia:campo==='mensal'?fimM:fimS;
    const vis=perfis.filter(p=>!sel.value||p.id===sel.value).map(p=>{
      const h=historico.filter(x=>x.perfilId===p.id||(!x.perfilId&&x.perfilNome===p.nome));
      const soma=(a,b)=>h.filter(x=>x.data>=a&&x.data<=b).reduce((q,x)=>q+(Number(x.pontosGanhos)||0),0);
      const hpPerfil=h.filter(x=>x.data>=periodoIni&&x.data<=periodoFim);
      return{id:p.id,nome:p.nome,hist:h,diario:soma(dia,dia),semanal:soma(iniS,fimS),mensal:soma(iniM,fimM),concluidas:hpPerfil.length,prazo:hpPerfil.filter(ehPontual).length,seq:sequencia(h)};
    });
    const ord=[...vis].sort((a,b)=>b[campo]-a[campo]);
    const perfilSelecionado=perfis.find(p=>p.id===sel.value);
    const hp=historico.filter(x=>x.data>=periodoIni&&x.data<=periodoFim&&(!sel.value||x.perfilId===sel.value||(!x.perfilId&&x.perfilNome===perfilSelecionado?.nome)));
    const pts=ord.reduce((q,x)=>q+x[campo],0),concl=hp.length,prazo=hp.filter(ehPontual).length,taxa=concl?Math.round(prazo/concl*100):0,lead=ord[0];
    root.innerHTML=`<div class="dashboard-kpi"><small>🏆 Líder</small><strong>${lead?esc(lead.nome):'—'}</strong><em>${lead?lead[campo]+' pontos':'Sem dados'}</em></div><div class="dashboard-kpi"><small>⭐ Pontos do período</small><strong>${pts}</strong><em>Somatório da seleção</em></div><div class="dashboard-kpi"><small>✅ Pontualidade</small><strong>${taxa}%</strong><em>${prazo} de ${concl} concluídas</em></div><div class="dashboard-kpi"><small>🔥 Maior sequência</small><strong>${ord.length?Math.max(...ord.map(x=>x.seq)):0} dias</strong><em>Sequência atual</em></div>`;
    const top=ord.slice(0,3),slots=[top[1],top[0],top[2]],cls=['second','first','third'],med=['🥈','🥇','🥉'];document.getElementById('podioDashboard').innerHTML=slots.map((x,i)=>x?`<div class="podium-card ${cls[i]}"><div class="podium-rank">${med[i]}</div><div class="podium-name">${esc(x.nome)}</div><div class="podium-points">${x[campo]} pontos<br>🔥 ${x.seq} dias</div></div>`:'<div></div>').join('');
    document.getElementById('dashboardPeriodoLegenda').innerText=campo==='diario'?'Ranking do dia selecionado':campo==='mensal'?'Ranking do mês selecionado':'Ranking da semana selecionada';document.getElementById('graficoPontosDashboard').innerHTML=svgBarras(ord,campo);
    const cont={prazo100:hp.filter(ehPontual).length,parcial:hp.filter(x=>x.status?.includes('Prazo')&&!ehPontual(x)).length,zerado:hp.filter(x=>x.status?.includes('Atrasado')||Number(x.percentualAplicado)===0).length};document.getElementById('graficoStatusDashboard').innerHTML=svgStatus(cont);
    const ev=[];for(let i=6;i>=0;i--){const d=new Date(ref);d.setDate(d.getDate()-i);const k=iso(d);ev.push({label:d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.',''),valor:historico.filter(x=>x.data===k&&(!sel.value||x.perfilId===sel.value)).reduce((q,x)=>q+(Number(x.pontosGanhos)||0),0)})}document.getElementById('graficoEvolucaoDashboard').innerHTML=svgLinha(ev);
    document.getElementById('rankingDetalhadoDashboard').innerHTML=ord.length?`<table class="ranking-table-pro"><thead><tr><th>#</th><th>Integrante</th><th>Pontos</th><th>Pontualidade</th><th>Concluídas</th><th>Sequência</th></tr></thead><tbody>${ord.map((x,i)=>`<tr><td>${i+1}º</td><td><strong>${esc(x.nome)}</strong></td><td>${x[campo]}</td><td>${x.concluidas?Math.round(x.prazo/x.concluidas*100):0}%</td><td>${x.concluidas}</td><td>🔥 ${x.seq}</td></tr>`).join('')}</tbody></table>`:'<p>Sem dados no período.</p>';
  }catch(e){console.error('Dashboard ranking:',e);root.innerHTML='<div class="dashboard-kpi"><small>Dashboard</small><strong>Não foi possível carregar</strong><em>Atualize a página e tente novamente.</em></div>'}
};

const ordemDiasRecorrencia=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
let exclusaoRecorrenteContexto=null;

function fecharModalExclusaoRecorrente(){
  const modal=document.getElementById('modalExclusaoRecorrente');
  if(modal) modal.style.display='none';
  exclusaoRecorrenteContexto=null;
}

function garantirModalExclusaoRecorrente(){
  if(document.getElementById('modalExclusaoRecorrente')) return;
  const modal=document.createElement('div');
  modal.id='modalExclusaoRecorrente';
  modal.style.cssText='display:none;position:fixed;inset:0;background:rgba(15,23,42,.58);z-index:12000;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(2px)';
  modal.innerHTML=`
    <div style="background:#fff;width:min(520px,100%);border-radius:18px;padding:22px;box-shadow:0 24px 70px rgba(15,23,42,.28)">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px">
        <div><div style="font-size:12px;font-weight:800;letter-spacing:.06em;color:#64748b;text-transform:uppercase">Tarefa recorrente</div><h2 style="margin:5px 0 7px;color:#1e293b">O que você deseja excluir?</h2></div>
        <button id="fecharExclusaoRecorrente" aria-label="Fechar" style="border:0;background:#f1f5f9;color:#475569;width:34px;height:34px;border-radius:50%;font-size:20px;cursor:pointer">×</button>
      </div>
      <p id="textoExclusaoRecorrente" style="margin:0 0 16px;color:#64748b;line-height:1.5"></p>
      <div style="display:grid;gap:10px">
        <button data-exclusao="esta" style="text-align:left;border:1px solid #dbe3ec;background:#fff;border-radius:13px;padding:13px 15px;cursor:pointer"><strong style="display:block;color:#1e293b">Somente esta ocorrência</strong><span style="font-size:12px;color:#64748b">Remove apenas o dia selecionado desta tarefa.</span></button>
        <button data-exclusao="frente" style="text-align:left;border:1px solid #dbe3ec;background:#fff;border-radius:13px;padding:13px 15px;cursor:pointer"><strong style="display:block;color:#1e293b">Esta e as próximas</strong><span style="font-size:12px;color:#64748b">Remove esta ocorrência e as seguintes na sequência semanal cadastrada.</span></button>
        <button data-exclusao="todas" style="text-align:left;border:1px solid #fecaca;background:#fff7f7;border-radius:13px;padding:13px 15px;cursor:pointer"><strong style="display:block;color:#b91c1c">Todas as ocorrências</strong><span style="font-size:12px;color:#7f1d1d">Remove completamente esta tarefa recorrente.</span></button>
      </div>
      <button id="cancelarExclusaoRecorrente" style="margin-top:14px;width:100%;border:0;background:#f1f5f9;color:#475569;border-radius:12px;padding:11px;font-weight:700;cursor:pointer">Cancelar</button>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('fecharExclusaoRecorrente').onclick=fecharModalExclusaoRecorrente;
  document.getElementById('cancelarExclusaoRecorrente').onclick=fecharModalExclusaoRecorrente;
  modal.addEventListener('click',e=>{if(e.target===modal)fecharModalExclusaoRecorrente();});
  modal.querySelectorAll('[data-exclusao]').forEach(btn=>btn.addEventListener('click',()=>executarExclusaoRecorrente(btn.dataset.exclusao)));
}

async function executarExclusaoRecorrente(tipo){
  const ctx=exclusaoRecorrenteContexto;
  if(!ctx) return;
  const db=obterDb(); if(!db) return alert('Banco de dados ainda não está disponível. Atualize a página e tente novamente.');
  let alvos=[];
  if(tipo==='esta') alvos=[ctx.alvo];
  else if(tipo==='todas') alvos=[...ctx.relacionadas];
  else {
    const indiceSelecionado=ordemDiasRecorrencia.indexOf(ctx.alvo.diaSemana);
    alvos=ctx.relacionadas.filter(t=>{
      const i=ordemDiasRecorrencia.indexOf(t.diaSemana);
      return indiceSelecionado<0 || i>=indiceSelecionado;
    });
  }
  if(!alvos.length) return fecharModalExclusaoRecorrente();
  try{
    const batch=writeBatch(db);
    alvos.forEach(t=>batch.delete(doc(db,'tarefas',t.id)));
    await batch.commit();
    fecharModalExclusaoRecorrente();
    const descricao=tipo==='esta'?'Esta ocorrência foi excluída.':tipo==='frente'?'Esta ocorrência e as próximas foram excluídas.':'Todas as ocorrências da tarefa foram excluídas.';
    alert(descricao);
  }catch(e){
    console.error('Exclusão recorrente:',e);
    alert('Não foi possível excluir a tarefa. Tente novamente.');
  }
}

window.excluirTarefa=async function(idTarefa){
  const db=obterDb(); if(!db) return alert('Banco de dados ainda não está disponível. Atualize a página e tente novamente.');
  const grupoId=(document.getElementById('displayCodigoCliente')?.innerText||'').trim();
  if(!grupoId||grupoId==='--'||grupoId==='CLI-Gen') return alert('Grupo da família não identificado.');
  try{
    const snap=await getDocs(query(collection(db,'tarefas'),where('grupoId','==',grupoId)));
    const tarefas=snap.docs.map(d=>({id:d.id,...d.data()}));
    const alvo=tarefas.find(t=>t.id===idTarefa);
    if(!alvo) return alert('Tarefa não encontrada. Atualize a tela e tente novamente.');
    const relacionadas=alvo.tarefaGrupoId?tarefas.filter(t=>t.tarefaGrupoId===alvo.tarefaGrupoId):[alvo];
    if(relacionadas.length<=1){
      if(!confirm(`Excluir a tarefa "${alvo.nome}" de ${alvo.diaSemana||'este dia'}?`)) return;
      const batch=writeBatch(db); batch.delete(doc(db,'tarefas',alvo.id)); await batch.commit();
      alert('Tarefa excluída com sucesso.');
      return;
    }
    garantirModalExclusaoRecorrente();
    exclusaoRecorrenteContexto={alvo,relacionadas};
    const dias=relacionadas.slice().sort((a,b)=>ordemDiasRecorrencia.indexOf(a.diaSemana)-ordemDiasRecorrencia.indexOf(b.diaSemana)).map(t=>t.diaSemana).join(', ');
    document.getElementById('textoExclusaoRecorrente').innerHTML=`A tarefa <strong>${esc(alvo.nome)}</strong> está cadastrada em mais de um dia (${esc(dias)}). Você selecionou <strong>${esc(alvo.diaSemana||'esta ocorrência')}</strong>.`;
    document.getElementById('modalExclusaoRecorrente').style.display='flex';
  }catch(e){
    console.error('Preparação da exclusão:',e);
    alert('Não foi possível carregar as ocorrências desta tarefa. Tente novamente.');
  }
};

window.addEventListener('DOMContentLoaded',()=>{montarDashboard();garantirModalExclusaoRecorrente();});
