import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const DIAS=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const pad=n=>String(n).padStart(2,'0');
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseISO=v=>{const [a,m,d]=String(v||'').split('-').map(Number);return a&&m&&d?new Date(a,m-1,d,12,0,0):new Date();};
const inicioSemana=d=>{const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-x.getDay());return x;};
const fimSemana=d=>{const x=inicioSemana(d);x.setDate(x.getDate()+6);return x;};
const inicioMes=d=>new Date(d.getFullYear(),d.getMonth(),1,12,0,0);
const fimMes=d=>new Date(d.getFullYear(),d.getMonth()+1,0,12,0,0);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

let cache={grupoId:'',at:0,perfis:[],tarefas:[],historico:[]};
async function carregar(force=false){
  const grupoId=(document.getElementById('displayCodigoCliente')?.textContent||'').trim();
  if(!grupoId||grupoId==='--'||grupoId==='CLI-Gen') return null;
  if(!force&&cache.grupoId===grupoId&&Date.now()-cache.at<12000) return cache;
  if(!getApps().length) return null;
  const db=getFirestore(getApp());
  const [ps,ts,hs]=await Promise.all([
    getDocs(query(collection(db,'perfis'),where('grupoId','==',grupoId))),
    getDocs(query(collection(db,'tarefas'),where('grupoId','==',grupoId))),
    getDocs(query(collection(db,'historico'),where('grupoId','==',grupoId)))
  ]);
  cache={grupoId,at:Date.now(),perfis:ps.docs.map(d=>({id:d.id,...d.data()})),tarefas:ts.docs.map(d=>({id:d.id,...d.data()})),historico:hs.docs.map(d=>({id:d.id,...d.data()}))};
  return cache;
}
function pertence(reg,p){return reg.perfilId?reg.perfilId===p.id:reg.perfilNome===p.nome;}
function pontosPossiveis(p,inicio,fim,dados){
  const tarefas=dados.tarefas.filter(t=>pertence(t,p));
  let total=0;
  const d=new Date(inicio);
  while(d<=fim){
    const dia=DIAS[d.getDay()];
    total+=tarefas.filter(t=>t.diaSemana===dia).reduce((s,t)=>s+(Number(t.pontosMaximos)||0),0);
    d.setDate(d.getDate()+1);
  }
  return total;
}
function pontosGanhos(p,inicio,fim,dados){
  const a=iso(inicio),b=iso(fim);
  return dados.historico.filter(h=>pertence(h,p)).filter(h=>{const data=h.data||h.dataExecucao||'';return data>=a&&data<=b;}).reduce((s,h)=>s+(Number(h.pontosGanhos)||0),0);
}
function resumo(p,ref,dados){
  const s=inicioSemana(ref),e=fimSemana(ref),mi=inicioMes(ref),mf=fimMes(ref);
  return {
    dia:{ganho:pontosGanhos(p,ref,ref,dados),max:pontosPossiveis(p,ref,ref,dados)},
    semana:{ganho:pontosGanhos(p,s,e,dados),max:pontosPossiveis(p,s,e,dados)},
    mes:{ganho:pontosGanhos(p,mi,mf,dados),max:pontosPossiveis(p,mi,mf,dados)}
  };
}
function card(rotulo,dado,icone){
  const pct=dado.max>0?Math.max(0,Math.min(100,(dado.ganho/dado.max)*100)):0;
  return `<div class="rf-score-card"><div class="rf-score-label">${icone} ${rotulo}</div><div class="rf-score-value"><strong>${dado.ganho}</strong><span> / ${dado.max} pts</span></div><div class="rf-score-track"><i style="width:${pct}%"></i></div><small>${dado.max?Math.round(pct):0}% da pontuação possível</small></div>`;
}
function garantirEstilo(){
  if(document.getElementById('rfAdmScoreStyle'))return;
  const s=document.createElement('style');s.id='rfAdmScoreStyle';s.textContent=`
  .rf-score-wrap{margin:18px 0 24px}.rf-score-title{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px}.rf-score-title h3{margin:0;color:#334155}.rf-score-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.rf-score-card{background:linear-gradient(180deg,#fff,#f8fbff);border:1px solid #d7e3f0;border-radius:16px;padding:15px;box-shadow:0 5px 18px rgba(37,99,235,.06)}.rf-score-label{font-size:12px;font-weight:800;text-transform:uppercase;color:#4a90e2;letter-spacing:.03em}.rf-score-value{margin-top:7px;display:flex;align-items:baseline;gap:3px}.rf-score-value strong{font-size:1.55rem;color:#1f2937}.rf-score-value span{font-size:.9rem;color:#64748b}.rf-score-track{height:9px;background:#e8eef5;border-radius:999px;overflow:hidden;margin:10px 0 6px}.rf-score-track i{display:block;height:100%;background:#4a90e2;border-radius:inherit}.rf-score-card small{color:#64748b}.rf-score-person{border:1px solid #e2e8f0;border-radius:18px;padding:14px;margin:12px 0;background:#fff}.rf-score-person>strong{display:block;margin-bottom:10px;color:#1f2937}.rf-period-nav{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:8px}.rf-period-nav button{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:7px 10px;cursor:pointer;font-weight:700;color:#475569}.rf-period-note{font-size:12px;color:#64748b;margin-top:8px}@media(max-width:700px){.rf-score-grid{grid-template-columns:1fr}.rf-score-card{padding:13px}}
  `;document.head.appendChild(s);
}
function mudarData(input,delta){if(!input)return;const d=parseISO(input.value||iso(new Date()));d.setDate(d.getDate()+delta);input.value=iso(d);input.dispatchEvent(new Event('change',{bubbles:true}));}
function garantirNavegacao(input,id){
  if(!input||document.getElementById(id))return;
  const nav=document.createElement('div');nav.id=id;nav.className='rf-period-nav';nav.innerHTML='<button type="button" data-d="-1">◀ Dia anterior</button><button type="button" data-hoje="1">Hoje</button><button type="button" data-d="1">Próximo dia ▶</button>';
  input.parentElement?.appendChild(nav);
  nav.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.hoje){input.value=iso(new Date());input.dispatchEvent(new Event('change',{bubbles:true}));}else mudarData(input,Number(b.dataset.d)||0);});
}
async function renderMonitor(){
  const sec=document.getElementById('secaoPontuacaoMonitor'),sel=document.getElementById('filtroIntegrante'),dataInput=document.getElementById('filtroData');
  if(!sec||!sel||!dataInput)return;
  garantirNavegacao(dataInput,'rfMonitorDateNav');
  if(!sel.value)return;
  const dados=await carregar();if(!dados)return;
  const p=dados.perfis.find(x=>x.id===sel.value);if(!p)return;
  const ref=parseISO(dataInput.value||iso(new Date())),r=resumo(p,ref,dados);
  sec.style.display='block';
  const nome=document.getElementById('nomeIntegrantePontuacao');if(nome)nome.textContent=p.nome||'';
  const hojeReal=iso(new Date())===iso(ref);
  const ld=document.getElementById('labelDiaPontuacao');if(ld)ld.textContent=hojeReal?'Hoje':ref.toLocaleDateString('pt-BR');
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=String(v)};
  set('admPtsHoje',r.dia.ganho);set('admPtsSemana',r.semana.ganho);set('admPtsMes',r.mes.ganho);
  set('admPossivelHoje',` / ${r.dia.max} pts`);set('admPossivelSemana',` / ${r.semana.max} pts`);set('admPossivelMes',` / ${r.mes.max} pts`);
  const grid=sec.querySelector('.dash-cards-admin');if(grid){
    [...grid.children].forEach((el,i)=>{const d=[r.dia,r.semana,r.mes][i];if(!d)return;let tr=el.querySelector('.rf-score-track');if(!tr){tr=document.createElement('div');tr.className='rf-score-track';tr.innerHTML='<i></i>';el.appendChild(tr);const sm=document.createElement('small');sm.className='rf-monitor-pct';el.appendChild(sm);}const pct=d.max?Math.max(0,Math.min(100,d.ganho/d.max*100)):0;tr.querySelector('i').style.width=`${pct}%`;el.querySelector('.rf-monitor-pct').textContent=`${Math.round(pct)}% da pontuação possível`;});
  }
  let note=sec.querySelector('.rf-period-note');if(!note){note=document.createElement('div');note.className='rf-period-note';sec.appendChild(note);}note.textContent=`Semana: ${inicioSemana(ref).toLocaleDateString('pt-BR')} a ${fimSemana(ref).toLocaleDateString('pt-BR')} · Mês: ${ref.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}.`;
}
async function renderDashboard(){
  const dash=document.getElementById('dashboard'),dataInput=document.getElementById('dashboardDataRef'),sel=document.getElementById('dashboardPerfil');if(!dash||!dataInput||!sel)return;
  garantirNavegacao(dataInput,'rfDashboardDateNav');
  const dados=await carregar();if(!dados)return;
  const ref=parseISO(dataInput.value||iso(new Date()));
  let host=document.getElementById('rfDashboardScoreSummary');if(!host){host=document.createElement('section');host.id='rfDashboardScoreSummary';host.className='rf-score-wrap';const alvo=document.getElementById('dashboardFamilia');alvo?.insertAdjacentElement('beforebegin',host);}
  const perfis=dados.perfis.filter(p=>!sel.value||p.id===sel.value).sort((a,b)=>(a.nome||'').localeCompare(b.nome||''));
  host.innerHTML=`<div class="rf-score-title"><h3>📊 Acompanhamento de pontuação</h3><span style="font-size:12px;color:#64748b">Referência: ${ref.toLocaleDateString('pt-BR')}</span></div>`+(perfis.map(p=>{const r=resumo(p,ref,dados);return `<div class="rf-score-person"><strong>${esc(p.nome||'Integrante')}</strong><div class="rf-score-grid">${card(iso(ref)===iso(new Date())?'Hoje':ref.toLocaleDateString('pt-BR'),r.dia,'☀️')}${card('Semana',r.semana,'📅')}${card('Mês',r.mes,'🗓️')}</div></div>`;}).join('')||'<p>Nenhum integrante encontrado.</p>')+`<div class="rf-period-note">Os máximos são calculados pelas tarefas programadas em cada período. Ao escolher uma data antiga, Dia, Semana e Mês representam aquele período histórico completo.</div>`;
}
async function atualizar(force=false){try{if(force)cache.at=0;await Promise.all([renderMonitor(),renderDashboard()]);}catch(e){console.error('Falha nos cards históricos do ADM',e);}}
function ligar(){
  garantirEstilo();
  const monitorSel=document.getElementById('filtroIntegrante'),monitorData=document.getElementById('filtroData'),dashData=document.getElementById('dashboardDataRef'),dashPerfil=document.getElementById('dashboardPerfil');
  [monitorSel,monitorData,dashData,dashPerfil].forEach(el=>el?.addEventListener('change',()=>setTimeout(()=>atualizar(true),100)));
  document.addEventListener('click',e=>{if(e.target.closest('.tab-btn'))setTimeout(()=>atualizar(),150)});
  setInterval(()=>{if(document.getElementById('sistemaPrincipal')?.style.display!=='none')atualizar(true)},30000);
  atualizar(true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(ligar,350));else setTimeout(ligar,350);
