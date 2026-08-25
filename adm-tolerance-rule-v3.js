import {getApps,getApp} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {getFirestore,doc,getDoc,setDoc,deleteField} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const VERSION=6;
let fatorAtual=100;

const clamp=v=>Math.max(0,Math.min(100,Number.isFinite(Number(v))?Number(v):100));
const grupoAtual=()=>String(document.getElementById('displayCodigoCliente')?.textContent||'').trim().toUpperCase();
const log=(evento,detalhes={},nivel='info')=>{try{window.rotinaLog?.(evento,detalhes,nivel);}catch{}};

function banco(){return getApps().length?getFirestore(getApp()):null;}
function fatorDaConfig(config={}){
  const nova=config.regraTolerancia||{};
  const legado=config.regraAtraso||{};
  return clamp(nova.usoJanelaAdicionalPct ?? legado.janelaAdicionalPct ?? legado.percentualJanelaAdicional ?? 100);
}

function explicacao(){
  return `<strong>Faixas</strong><br>`+
    `• <strong>100%:</strong> tolerância-base<br>`+
    `• <strong>75%:</strong> 1ª metade da janela adicional<br>`+
    `• <strong>50%:</strong> 2ª metade da janela adicional<br>`+
    `• <strong>0%:</strong> tolerância consumida`;
}

function ajustarCard(){
  const titulo=[...document.querySelectorAll('#cadastro h3')].find(el=>/Regra de pontua[cç][aã]o por atraso/i.test(el.textContent||'')||/Regra de toler[aâ]ncia por atraso/i.test(el.textContent||''));
  if(!titulo)return;
  const novoTitulo='Regra de tolerância por atraso';
  if(titulo.textContent!==novoTitulo)titulo.textContent=novoTitulo;
  const descricao='Ajuste quanto da janela adicional padrão de 25% será usada. A pontuação permanece fixa em 100% / 75% / 50% / 0%.';
  const p=titulo.parentElement?.querySelector('p');
  if(p&&p.textContent!==descricao)p.textContent=descricao;
  const escopo=titulo.parentElement?.parentElement;
  const botoes=[...escopo?.querySelectorAll('button')||[]];
  const botaoAjuste=botoes.find(b=>/Mudar regra|Ajustar tolerância/i.test(b.textContent||''));
  if(botaoAjuste&&botaoAjuste.textContent!=='⚙️ Ajustar tolerância')botaoAjuste.textContent='⚙️ Ajustar tolerância';
  botoes.filter(b=>/Entender a regra/i.test(b.textContent||'')).forEach(b=>b.remove());
  const info=document.getElementById('explicacaoRegraAtrasoAdmin');
  if(info)info.style.display='block';
}

function garantirModal(){
  const modal=document.getElementById('modalRegraAtrasoAdmin');
  if(!modal)return null;
  if(modal.dataset.toleranceV3==='1')return modal;
  const card=modal.firstElementChild;
  if(!card)return null;
  card.innerHTML=`
    <h2 style="margin-top:0">Configurar janela adicional de tolerância</h2>
    <p style="color:#666;font-size:13px">Defina quanto da janela adicional padrão (25% da tolerância-base) será usada. <strong>Esse ajuste altera apenas o tempo.</strong></p>
    <div class="form-group">
      <label for="regraPct100">Uso da janela adicional padrão (%)</label>
      <input id="regraPct100" type="number" min="0" max="100" step="1" value="100">
      <small style="display:block;color:#64748b;margin-top:6px">100% = 25% adicionais completos<br>80% = 20% da tolerância-base</small>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px">
      <button class="btn-action" style="width:auto;background:#64748b" onclick="fecharConfiguracaoRegraAtraso()">Cancelar</button>
      <button class="btn-action" style="width:auto;background:#2563eb" onclick="salvarConfiguracaoRegraAtraso()">Salvar tolerância</button>
    </div>`;
  modal.dataset.toleranceV3='1';
  return modal;
}

function atualizarExplicacoes(){
  ajustarCard();
  const info=document.getElementById('explicacaoRegraAtrasoAdmin');
  const texto=explicacao();
  if(info&&info.innerHTML!==texto)info.innerHTML=texto;
  if(info)info.style.display='block';
  const modal=garantirModal();
  const input=modal?.querySelector('#regraPct100');
  if(input&&document.activeElement!==input&&input.value!==String(fatorAtual))input.value=String(fatorAtual);
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
    if(modal)modal.style.display='flex';
  };
  window.fecharConfiguracaoRegraAtraso=()=>{const modal=document.getElementById('modalRegraAtrasoAdmin');if(modal)modal.style.display='none';};
  window.salvarConfiguracaoRegraAtraso=async()=>{
    const g=grupoAtual(),db=banco();if(!g||g==='--'||g==='CLI-GEN'||!db)return alert('Grupo ainda não identificado.');
    const input=document.getElementById('regraPct100');
    const bruto=Number(input?.value);
    if(!Number.isFinite(bruto)||bruto<0||bruto>100)return alert('Use um percentual entre 0 e 100.');
    const fator=clamp(bruto);
    const regraTolerancia={versao:4,janelaAdicionalMaximaPct:25,usoJanelaAdicionalPct:fator};
    const regraPontuacao={dentroLimites:100,atrasoLeve:75,atrasoMaior:50,estourado:0};
    try{
      await setDoc(doc(db,'configGrupos',g),{
        grupoId:g,
        regraTolerancia,
        regraPontuacao,
        regraOperacionalVersao:4,
        regraOperacionalAtualizadaEm:new Date().toISOString(),
        regraAtraso:deleteField(),
        regraAtrasoVersao:deleteField(),
        regraAtrasoAtualizadaEm:deleteField()
      },{merge:true});
      fatorAtual=fator;atualizarExplicacoes();window.fecharConfiguracaoRegraAtraso();
      log('tolerancia.adm_salva',{grupoId:g,janelaAdicionalPct:fator,extraEfetivoPct:Number((25*fator/100).toFixed(2)),versao:VERSION});
      alert('Regra atualizada. O ajuste altera somente a janela adicional de tempo; a pontuação permanece fixa em 100% / 75% / 50% / 0% conforme a faixa atingida.');
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
