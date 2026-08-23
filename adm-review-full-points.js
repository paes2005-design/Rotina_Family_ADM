(()=>{
  const VERSION=1;
  const log=(evento,detalhes={},nivel='info')=>{try{window.rotinaLog?.(evento,detalhes,nivel);}catch{}};

  function normalizarAcoes(){
    const acoes=document.getElementById('admReviewAcoes');
    if(!acoes)return;
    const devolver=[...acoes.querySelectorAll('button[data-review="devolver"]')];
    if(!devolver.length)return;
    let total=devolver.find(b=>String(b.dataset.pct||'')==='100')||devolver[devolver.length-1];
    devolver.forEach(b=>{if(b!==total)b.remove();});
    if(total){
      total.dataset.pct='100';
      const pequeno=total.querySelector('small')?.textContent?.trim()||'';
      total.innerHTML=`Devolver todos os pontos da tarefa${pequeno?`<br><small>${pequeno}</small>`:''}`;
      total.style.background='#dcfce7';total.style.color='#166534';
    }
    log('justificativa.revisao_pontos_integrais_ui',{versao:VERSION});
  }

  // Garantia adicional: qualquer botão legado de devolução que apareça por alguns
  // milissegundos é convertido para devolução total antes de chegar ao handler antigo.
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('#admReviewAcoes button[data-review="devolver"]');
    if(!b)return;
    b.dataset.pct='100';
  },true);

  function instalar(){
    normalizarAcoes();
    const alvo=document.body;
    new MutationObserver(normalizarAcoes).observe(alvo,{childList:true,subtree:true});
    log('justificativa.revisao_pontos_integrais_pronta',{versao:VERSION});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',instalar,{once:true});else instalar();
})();
