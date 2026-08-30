import {getApps,getApp} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {getFirestore,collection,query,where,getDocs,doc,getDoc,writeBatch,deleteField} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const hojeISO=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
let contextoAtual=null;
let salvando=false;

function db(){return getApps().length?getFirestore(getApp()):null;}
function grupo(){return (document.getElementById('displayCodigoCliente')?.textContent||'').trim();}
function dataSelecionada(){return document.getElementById('filtroData')?.value||'';}
function parseHorario(txt=''){
  const m=String(txt).match(/(\d{2}:\d{2}).*?(\d{2}:\d{2})/);
  return m?{inicio:m[1],fim:m[2]}:{inicio:'',fim:''};
}
function pontosPara(max,pct){return Math.round((Number(max)||0)*(Number(pct)||0)/100);}
function originalDaOcorrencia(h){
  const max=Number(h.pontosMaximos)||0;
  const pontos=Number.isFinite(Number(h.pontosOriginais))?Number(h.pontosOriginais):(Number(h.pontosGanhos)||0);
  const pct=Number.isFinite(Number(h.percentualOriginal))?Number(h.percentualOriginal):(Number.isFinite(Number(h.percentualAplicado))?Number(h.percentualAplicado):(max?Math.round(pontos/max*100):0));
  return {max,pontos,pct,pontosAtuais:Number(h.pontosGanhos)||0};
}
function decisaoTomada(h){return h?.revisaoStatus==='revisado'&&Boolean(h?.revisaoDecisao);}

function garantirModal(){
  let m=document.getElementById('admReviewJustModal');
  if(m)return m;
  m=document.createElement('div');
  m.id='admReviewJustModal';
  m.innerHTML=`<div class="adm-review-card" role="dialog" aria-modal="true" aria-labelledby="admReviewTitulo">
    <button type="button" class="adm-review-close" aria-label="Fechar">×</button>
    <div class="adm-review-kicker">🚩 Justificativa</div>
    <h2 id="admReviewTitulo">Revisar ocorrência</h2>
    <div id="admReviewResumo" class="adm-review-summary"></div>
    <div class="adm-review-text"><small>Justificativa enviada</small><p id="admReviewTexto"></p></div>
    <div class="adm-review-original" id="admReviewOriginal"></div>
    <div class="adm-review-actions" id="admReviewAcoes"></div>
    <div class="adm-review-msg" id="admReviewMsg" aria-live="polite"></div>
  </div>`;
  const style=document.createElement('style');
  style.textContent=`#admReviewJustModal{display:none;position:fixed;inset:0;z-index:30000;background:rgba(15,23,42,.62);align-items:center;justify-content:center;padding:16px;box-sizing:border-box}.adm-review-card{position:relative;width:min(520px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:20px;padding:20px;box-shadow:0 24px 70px rgba(15,23,42,.28);box-sizing:border-box}.adm-review-close{position:absolute;right:14px;top:12px;border:0;background:#f1f5f9;width:34px;height:34px;border-radius:50%;font-size:22px;color:#475569;cursor:pointer}.adm-review-kicker{font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:800;color:#b45309}.adm-review-card h2{margin:5px 42px 14px 0;color:#1e293b}.adm-review-summary{font-size:13px;color:#64748b;line-height:1.5}.adm-review-text{margin:14px 0;padding:13px;border:1px solid #fde68a;background:#fffbeb;border-radius:13px}.adm-review-text small{display:block;font-weight:800;color:#92400e;text-transform:uppercase;font-size:10px;margin-bottom:5px}.adm-review-text p{margin:0;color:#334155;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}.adm-review-original{padding:11px 12px;background:#f8fafc;border-radius:12px;color:#475569;font-size:12px;line-height:1.45}.adm-review-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.adm-review-actions button{border:0;border-radius:11px;padding:11px 9px;font-weight:800;cursor:pointer;background:#e2e8f0;color:#334155}.adm-review-actions button[data-pct="75"]{background:#fff4dd;color:#a35200}.adm-review-actions button[data-pct="100"]{background:#dcfce7;color:#166534}.adm-review-actions button[data-review="reverter"]{grid-column:1/-1;background:#fee2e2;color:#991b1b}.adm-review-actions button:disabled{opacity:.45;cursor:not-allowed}.adm-review-msg{font-size:12px;margin-top:10px;color:#64748b;min-height:18px}@media(max-width:480px){.adm-review-card{padding:18px 15px;border-radius:18px}.adm-review-actions{grid-template-columns:1fr}.adm-review-actions button{padding:12px}.adm-review-actions button[data-review="reverter"]{grid-column:1}.adm-review-card h2{font-size:20px}}`;
  document.head.appendChild(style);
  document.body.appendChild(m);
  m.querySelector('.adm-review-close').onclick=()=>fecharModal();
  m.addEventListener('click',e=>{if(e.target===m)fecharModal();});
  m.querySelector('#admReviewAcoes').addEventListener('click',e=>{
    const b=e.target.closest('button[data-review]');if(!b)return;
    salvarRevisao(b.dataset.review,b.dataset.pct===''?null:Number(b.dataset.pct));
  });
  return m;
}
function fecharModal(){if(salvando)return;const m=document.getElementById('admReviewJustModal');if(m)m.style.display='none';contextoAtual=null;}

async function localizarTarefa(ctx){
  const banco=db(),g=grupo();if(!banco||!g||g==='--'||g==='CLI-Gen')throw new Error('Grupo não identificado.');
  if(ctx.id){const s=await getDoc(doc(banco,'tarefas',ctx.id));if(s.exists())return{id:s.id,...s.data()};}
  const snap=await getDocs(query(collection(banco,'tarefas'),where('grupoId','==',g)));
  const horario=parseHorario(ctx.horario||ctx.schedule||'');
  const lista=snap.docs.map(d=>({id:d.id,...d.data()})).filter(t=>(!ctx.tarefa||t.nome===ctx.tarefa)&&(!ctx.usuario||t.perfilNome===ctx.usuario)&&(!ctx.dia||t.diaSemana===ctx.dia)&&(!horario.inicio||t.horaSugeridaInicio===horario.inicio)&&(!horario.fim||t.horaSugeridaFim===horario.fim));
  return lista[0]||null;
}

async function docsRelacionados(banco,t,data){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data))throw new Error('Data da ocorrência inválida.');
  const hist=[],exec=[];
  if(t.perfilId){const h=await getDoc(doc(banco,'historico',`${t.perfilId}_${t.id}_${data}`));if(h.exists())hist.push(h);}
  const e=await getDoc(doc(banco,'execucoes',`${data}__${t.id}`));if(e.exists())exec.push(e);
  if(!hist.length){
    const hs=await getDocs(query(collection(banco,'historico'),where('tarefaId','==',t.id)));
    hs.docs.filter(d=>{const x=d.data();return x.data===data&&(!t.perfilId||!x.perfilId||x.perfilId===t.perfilId);}).forEach(d=>hist.push(d));
  }
  return {hist,exec};
}

function montarAcoes(h){
  const o=originalDaOcorrencia(h);
  if(decisaoTomada(h)){
    return {html:'<button type="button" data-review="reverter" data-pct="">↩️ Reverter decisão</button>',...o};
  }
  const botoes=[50,75,100].map(p=>`<button type="button" data-review="devolver" data-pct="${p}" ${p<=o.pct?'disabled':''}>Devolver até ${p}%<br><small>${Math.max(o.pontos,pontosPara(o.max,p))} pts</small></button>`).join('');
  return {html:`<button type="button" data-review="manter" data-pct="">Manter resultado automático</button>${botoes}`,...o};
}

function resumoResultado(h,o){
  return `Resultado automático preservado: <strong>${esc(h.status||'—')}</strong> · <strong>${o.pontos}/${o.max} pts</strong>${decisaoTomada(h)?`<br>Revisão atual: <strong>${Number(h.pontosGanhos)||0}/${o.max} pts</strong> · devolvidos ${Number(h.pontosDevolvidos)||0} pts`:''}`;
}

async function abrir(ctx={}){
  const m=garantirModal(),msg=m.querySelector('#admReviewMsg'),data=ctx.data||dataSelecionada();
  m.style.display='flex';msg.textContent='Carregando ocorrência…';m.querySelector('#admReviewAcoes').innerHTML='';m.querySelector('#admReviewTexto').textContent=ctx.justificativa||'Carregando…';
  try{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(data))throw new Error('Selecione a data da ocorrência no Monitor antes de revisar.');
    const banco=db();if(!banco)throw new Error('Firebase ainda não está disponível.');
    const t=await localizarTarefa(ctx);if(!t)throw new Error('Não foi possível localizar esta tarefa.');
    const rel=await docsRelacionados(banco,t,data);if(!rel.hist.length)throw new Error('Não encontrei o histórico dessa ocorrência na data selecionada.');
    const h={id:rel.hist[0].id,...rel.hist[0].data()};
    const justificativa=(h.justificativaAtraso||ctx.justificativa||'').trim();
    contextoAtual={tarefa:t,data,historico:h,histDocs:rel.hist,execDocs:rel.exec};
    const a=montarAcoes(h);
    m.querySelector('#admReviewTitulo').textContent=h.nomeTarefa||t.nome||'Revisar ocorrência';
    m.querySelector('#admReviewResumo').innerHTML=`<strong>${esc(h.perfilNome||t.perfilNome||ctx.usuario||'Integrante')}</strong> · ${esc(h.diaSemana||t.diaSemana||ctx.dia||'')} · ${esc(data.split('-').reverse().join('/'))}<br>${esc(h.horaSugeridaInicio||t.horaSugeridaInicio||'--:--')}–${esc(h.horaSugeridaFim||t.horaSugeridaFim||'--:--')}`;
    m.querySelector('#admReviewTexto').textContent=justificativa||'Nenhuma justificativa em texto foi encontrada.';
    m.querySelector('#admReviewOriginal').innerHTML=resumoResultado(h,a);
    m.querySelector('#admReviewAcoes').innerHTML=justificativa?a.html:'<div style="grid-column:1/-1;color:#64748b;font-size:12px">Sem justificativa enviada, não há pontos para revisar por este fluxo.</div>';
    msg.textContent=decisaoTomada(h)?'Esta ocorrência já possui uma decisão. Para escolher outra, reverta primeiro.':'';
  }catch(e){console.error('Revisão de justificativa:',e);msg.textContent=e.message||'Não foi possível carregar a justificativa.';}
}

function commitSemBloquearOffline(batch,operacaoId,msg){
  // O SDK completo do Firestore persiste writeBatch offline. O Promise só resolve
  // quando o servidor confirmar, por isso não bloqueamos a interface esperando-o.
  batch.commit().then(()=>{
    if(operacaoId!==ultimaOperacao)return;
    if(msg&&navigator.onLine!==false)msg.textContent=(msg.dataset.okOnline||msg.textContent);
  }).catch(e=>{
    console.error('Sincronizar revisão:',e);
    if(operacaoId!==ultimaOperacao)return;
    if(msg)msg.textContent='⚠️ A alteração ficou local, mas o servidor recusou a sincronização. Reconecte e tente novamente.';
  });
}

let ultimaOperacao=0;
async function salvarRevisao(tipo,pct){
  if(salvando||!contextoAtual?.tarefa||!contextoAtual?.historico)return;
  salvando=true;
  const operacaoId=++ultimaOperacao;
  const m=garantirModal(),msg=m.querySelector('#admReviewMsg'),buttons=[...m.querySelectorAll('#admReviewAcoes button')];
  buttons.forEach(b=>b.disabled=true);
  msg.textContent=tipo==='reverter'?'Registrando reversão…':'Registrando parecer…';
  try{
    const banco=db();if(!banco)throw new Error('Firebase ainda não está disponível.');
    const {tarefa:t,data,histDocs,execDocs}=contextoAtual;
    if(!histDocs.length)throw new Error('Histórico da ocorrência não encontrado.');

    // O estado local/cache é a referência imediata. Isso mantém a decisão única na
    // interface e permite reverter + escolher novamente sem depender de internet.
    const atual={...contextoAtual.historico};
    const o=originalDaOcorrencia(atual);
    const batch=writeBatch(banco);
    let atualizado;

    if(tipo==='reverter'){
      if(!decisaoTomada(atual))throw new Error('Esta ocorrência não possui uma decisão para reverter.');
      const patch={
        pontosGanhos:o.pontos,
        pontosOriginais:o.pontos,
        percentualOriginal:o.pct,
        revisaoStatus:'aguardando',
        percentualRevisado:deleteField(),
        pontosDevolvidos:deleteField(),
        revisaoDecisao:deleteField(),
        revisadoEm:deleteField()
      };
      histDocs.forEach(d=>batch.update(d.ref,patch));
      execDocs.forEach(d=>batch.update(d.ref,patch));
      if(data===hojeISO())batch.update(doc(banco,'tarefas',t.id),patch);

      atualizado={...atual,pontosGanhos:o.pontos,pontosOriginais:o.pontos,percentualOriginal:o.pct,revisaoStatus:'aguardando'};
      delete atualizado.percentualRevisado;delete atualizado.pontosDevolvidos;delete atualizado.revisaoDecisao;delete atualizado.revisadoEm;
      contextoAtual.historico=atualizado;
      msg.dataset.okOnline='Decisão revertida e sincronizada.';
      msg.textContent=navigator.onLine===false?'📴 Decisão revertida neste aparelho. Será sincronizada quando a internet voltar.':'Decisão revertida. O resultado automático foi restaurado; escolha uma nova opção se desejar.';
      m.querySelector('#admReviewOriginal').innerHTML=resumoResultado(atualizado,o);
      m.querySelector('#admReviewAcoes').innerHTML=montarAcoes(atualizado).html;
      commitSemBloquearOffline(batch,operacaoId,msg);
      return;
    }

    if(decisaoTomada(atual))throw new Error('Já existe uma decisão para esta ocorrência. Reverta a decisão atual antes de escolher outra.');
    const alvoPct=tipo==='manter'?o.pct:Math.max(o.pct,Number(pct)||0);
    const novosPts=tipo==='manter'?o.pontos:Math.max(o.pontos,pontosPara(o.max,alvoPct));
    const devolvidos=Math.max(0,novosPts-o.pontos);
    const agora=new Date().toISOString();
    const decisao=tipo==='manter'?'resultado-mantido':alvoPct>=100?'devolucao-total':`devolucao-${alvoPct}`;
    const patch={pontosGanhos:novosPts,pontosOriginais:o.pontos,percentualOriginal:o.pct,percentualRevisado:alvoPct,pontosDevolvidos:devolvidos,revisaoStatus:'revisado',revisaoDecisao:decisao,revisadoEm:agora};
    histDocs.forEach(d=>batch.update(d.ref,patch));
    execDocs.forEach(d=>batch.update(d.ref,patch));
    if(data===hojeISO())batch.update(doc(banco,'tarefas',t.id),patch);

    atualizado={...atual,...patch};
    contextoAtual.historico=atualizado;
    const textoOnline=tipo==='manter'?'Decisão salva: resultado automático mantido. Para mudar, reverta primeiro.':`Decisão salva: ${devolvidos} ponto(s) devolvido(s). Para mudar, reverta primeiro.`;
    msg.dataset.okOnline=textoOnline;
    msg.textContent=navigator.onLine===false?`📴 Parecer salvo neste aparelho${tipo==='manter'?'':` (${devolvidos} ponto(s) devolvido(s))`}. Será sincronizado quando a internet voltar.`:textoOnline;
    m.querySelector('#admReviewOriginal').innerHTML=resumoResultado(atualizado,o);
    m.querySelector('#admReviewAcoes').innerHTML=montarAcoes(atualizado).html;
    commitSemBloquearOffline(batch,operacaoId,msg);
  }catch(e){
    console.error('Salvar revisão:',e);
    msg.textContent=e.message||'Não foi possível registrar a revisão. Tente novamente.';
    buttons.forEach(b=>b.disabled=false);
  }finally{
    salvando=false;
  }
}

window.abrirRevisaoJustificativa=abrir;

document.addEventListener('click',e=>{
  const mobile=e.target.closest?.('.mon-just-flag');
  if(mobile){e.preventDefault();abrir({tarefa:mobile.dataset.taskName||'',usuario:mobile.dataset.user||'',dia:mobile.dataset.day||'',horario:mobile.dataset.schedule||'',justificativa:mobile.dataset.justification||'',data:mobile.dataset.date||''});return;}
  const flag=e.target.closest?.('.tooltip-justificativa');
  if(flag){
    e.preventDefault();
    const r=flag.closest('tr'),c=r?.children;if(!c||c.length<4)return;
    abrir({tarefa:c[1]?.querySelector('strong')?.textContent.trim()||c[1]?.textContent.trim()||'',usuario:c[2]?.textContent.trim()||'',dia:c[3]?.textContent.trim()||'',horario:c[0]?.querySelector('strong')?.textContent.trim()||'',justificativa:flag.querySelector('.tooltip-texto')?.textContent.trim()||'',data:dataSelecionada()});
  }
});
