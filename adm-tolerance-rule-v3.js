import {getApps,getApp} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {getFirestore,doc,getDoc,setDoc} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const VERSION=5;
let fatorAtual=100;

const clamp=v=>Math.max(0,Math.min(100,Number.isFinite(Number(v))?Number(v):100));
const fmt=v=>Number(Number(v).toFixed(2)).toLocaleString('pt-BR');
const grupoAtual=()=>String(document.getElementById('displayCodigoCliente')?.textContent||'').trim().toUpperCase();
const log=(evento,detalhes={},nivel='info')=>{try{window.rotinaLog?.(evento,detalhes,nivel);}catch{}};

function banco(){return getApps().length?getFirestore(getApp()):null;}
function fatorDaConfig(config={}){
  const r=config.regraAtraso||config||{};
  return clamp(r.janelaAdicionalPct ?? r.percentualJanelaAdicional ?? r.dentroLimites ?? 100);
}

function explicacao(fator=fatorAtual){
  const f=clamp(fator),extra=25*f/100,metade=extra/2;
  return `<strong>Faixas de tempo: 100% / 75% / 50% / 0%.</strong><br>`+
    `• A tolerância-base é o número de minutos cadastrado na tarefa.<br>`+
    `• Faixa 100%: consumo dentro da tolerância-base.<br>`+
    `• Faixa 75%: primeira metade da janela adicional (${fmt(metade)}% da tolerância-base).<br>`+
    `• Faixa 50%: segunda metade da janela adicional (${fmt(metade)}% da tolerância-base).<br>`+
    `• Faixa 0%: toda a tolerância válida foi consumida.<br>`+
    `• Esta família usa <strong>${fmt(f)}%</strong> da janela adicional padrão de 25%, equivalente a até <strong>${fmt(extra)}%</strong> da tolerância-base além do saldo principal.<br><br>`+
    `<strong>Pontuação:</strong> esses percentuais representam somente <strong>tempo de tolerância</strong>. Uma tarefa concluída nas faixas 100%, 75% ou 50% recebe <strong>todos os pontos cadastrados</strong>. Somente a faixa 0% zera a pontuação automática.`;
}

function ajustarCard(){
  const titulo=[...document.querySelectorAll('#cadastro h3')].find(el=>/Regra de pontua[cç][aã]o por atraso/i.test(el.textContent||'')||/Regra de toler[aâ]ncia por atraso/i.test(el.textContent||''));
  if(!titulo)return;
  const novoTitulo='Regra de tolerância por atraso';
  if(titulo.textContent!==novoTitulo)titulo.textContent=novoTitulo;
  const descricao='Os percentuais 100% / 75% / 50% / 0% identificam faixas de tempo. A configuração abaixo altera somente o tamanho da janela adicional de tolerância; os pontos da tarefa permanecem integrais.';
  const p=titulo.parentElement?.querySelector('p');
  if(p&&p.textContent!==descricao)p.textContent=descricao;
  const botao=[...titulo.parentElement?.parentElement?.querySelectorAll('button')||[]].find(b=>/Mudar regra|Ajustar tolerância/i.test(b.textContent||''));
  if(botao&&botao.textContent!=='⚙️ Ajustar tolerância')botao.textContent='⚙️ Ajustar tolerância';
}

function garantirModal(){
  const modal=document.getElementById('modalRegraAtrasoAdmin');
  if(!modal)return null;
  if(modal.dataset.toleranceV3==='1')return modal;
  const card=modal.firstElementChild;
  if(!card)return null;
  card.innerHTML=`
    <h2 style="margin-top:0">Configurar janela adicional de tolerância</h2>
    <p style="color:#666;font-size:13px">A regra padrão permite uma janela adicional máxima de 25% da tolerância-base, dividida igualmente entre as faixas 75% e 50%. Escolha quanto dessa janela adicional a família utilizará. <strong>Este percentual nunca reduz os pontos.</strong></p>
    <div class="form-group">
      <label for="regraPct100">Uso da janela adicional padrão (%)</label>
      <input id="regraPct100" type="number" min="0" max="100" step="1" value="100">
      <small style="display:block;color:#64748b;margin-top:6px">Ex.: 100% usa os 25% adicionais completos. 80% usa 80% desses 25%, ou seja, 20% da tolerância-base.</small>
    </div>
    <input id="regraPct75" type="hidden" value="75">
    <input id="regraPct50" type="hidden" value="50">
    <input id="regraPct0" type="hidden" value="0">
    <div id="previewRegraAtrasoAdmin" style="padding:10px;background:#f8fafc;border-radius:8px;font-size:13px;margin:10px 0"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
      <button class="btn-action" style="width:auto;background:#64748b" onclick="fecharConfiguracaoRegraAtraso()">Cancelar</button>
      <button class="btn-action" style="width:auto;background:#2563eb" onclick="salvarConfiguracaoRegraAtraso()">Salvar tolerância</button>
    </div>`;
  modal.dataset.toleranceV3='1';
  card.querySelector('#regraPct100')?.addEventListener('input',e=>{
    const prev=card.querySelector('#previewRegraAtrasoAdmin');
    if(prev)prev.innerHTML=explicacao(clamp(e.target.value));
  });
  return modal;
}

function atualizarExplicacoes(){
  ajustarCard();
  const info=document.getElementById('explicacaoRegraAtrasoAdmin');
  const texto=explicacao();
  if(info&&info.innerHTML!==texto)info.innerHTML=texto;
  const modal=garantirModal();
  const input=modal?.querySelector('#regraPct100');
  const prev=modal?.querySelector('#previewRegraAtrasoAdmin');
  if(input&&document.activeElement!==input&&input.value!==String(fatorAtual))input.value=String(fatorAtual);
  const preview=explicacao(input?.value??fatorAtual);
  if(prev&&prev.innerHTML!==preview)prev.innerHTML=preview;
}

async function carregarFator(){
  const g=grupoAtual(),db=banco();
  if(!g||g==='--'||g==='CLI-GEN'||!db)return fatorAtual;
  try{
    const snap=await getDoc(doc(db,'configGrupos',g));
    fatorAtual=fatorDaConfig(snap.exists()?snap.data():{});
    atualizarExplicacoes();
    log('tolerancia.adm_carregada',{grupoId:g,janelaAdicionalPct:fatorAtual,versao:VERSION});
  }catch(e){log('tolerancia.adm_carga_erro',{grupoId:g,mensagem:String(e?.message||e)},'warning');}
  return fatorAtual;
}

function instalarGlobais(){
  window.abrirConfiguracaoRegraAtraso=async()=>{
    await carregarFator();
    const modal=garantirModal();
    const input=modal?.querySelector('#regraPct100');
    if(input)input.value=String(fatorAtual);
    const prev=modal?.querySelector('#previewRegraAtrasoAdmin');
    if(prev)prev.innerHTML=explicacao(fatorAtual);
    if(modal)modal.style.display='flex';
  };
  window.fecharConfiguracaoRegraAtraso=()=>{const modal=document.getElementById('modalRegraAtrasoAdmin');if(modal)modal.style.display='none';};
  window.alternarExplicacaoRegraAtrasoAdmin=()=>{
    const el=document.getElementById('explicacaoRegraAtrasoAdmin');if(!el)return;
    el.innerHTML=explicacao();el.style.display=el.style.display==='none'?'block':'none';
  };
  window.salvarConfiguracaoRegraAtraso=async()=>{
    const g=grupoAtual(),db=banco();if(!g||g==='--'||g==='CLI-GEN'||!db)return alert('Grupo ainda não identificado.');
    const input=document.getElementById('regraPct100');
    const bruto=Number(input?.value);
    if(!Number.isFinite(bruto)||bruto<0||bruto>100)return alert('Use um percentual entre 0 e 100.');
    const fator=clamp(bruto);
    // `dentroLimites` recebe o mesmo fator apenas como ponte de compatibilidade com
    // clientes que ainda leem o campo legado. No modelo v3 ele representa TEMPO.
    const regraAtraso={dentroLimites:fator,atrasoLeve:75,atrasoMaior:50,estourado:0,janelaAdicionalPct:fator};
    try{
      await setDoc(doc(db,'configGrupos',g),{grupoId:g,regraAtraso,regraAtrasoVersao:3,regraAtrasoAtualizadaEm:new Date().toISOString()},{merge:true});
      fatorAtual=fator;atualizarExplicacoes();window.fecharConfiguracaoRegraAtraso();
      log('tolerancia.adm_salva',{grupoId:g,janelaAdicionalPct:fator,extraEfetivoPct:Number((25*fator/100).toFixed(2)),versao:VERSION});
      alert('Regra de tolerância atualizada. O percentual altera somente o tempo; os pontos da tarefa permanecem integrais.');
    }catch(e){console.error(e);alert('Não foi possível salvar a regra agora. Tente novamente.');}
  };
  atualizarExplicacoes();
}

function iniciar(){
  instalarGlobais();atualizarExplicacoes();
  const alvo=document.getElementById('sistemaPrincipal')||document.body;
  new MutationObserver(ajustarCard).observe(alvo,{childList:true,subtree:true});
  setTimeout(carregarFator,250);
}
window.addEventListener('rotina-admin-session-ready',()=>setTimeout(()=>{instalarGlobais();carregarFator();},100));
window.addEventListener('rotina-master-operational-group-ready',()=>setTimeout(()=>{instalarGlobais();carregarFator();},100));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar,{once:true});else iniciar();
