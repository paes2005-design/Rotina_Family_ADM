(()=>{
  'use strict';
  const INFO=Object.freeze({
    app:'ADM',
    appVersion:'1.0.0',
    build:'20260915.6',
    htmlVersion:'index-ADMIN-v9',
    rulesModuleVersion:'6',
    expectedServiceWorkerVersion:'109'
  });
  window.ROTINA_BUILD_INFO=INFO;
  const emit=(event,details={})=>{try{window.rotinaLog?.(event,{...INFO,...details});}catch{}};
  function footer(){
    document.getElementById('rotinaBuildBadge')?.remove();
    const candidates=[...document.querySelectorAll('#rotinaBuildFooter,.version,[data-version-footer]')];
    const legacy=candidates.find(el=>/Rotina\s+Family/i.test(el.textContent||'')&&/Build/i.test(el.textContent||''))||candidates.find(el=>el.classList?.contains('version'))||null;
    const legacyVersion=String(legacy?.textContent||'').match(/Vers(?:ão|ao)\s*([0-9.]+)/i)?.[1]||INFO.appVersion;
    let el=document.getElementById('rotinaBuildFooter')||legacy;
    if(!el){el=document.createElement('div');el.id='rotinaBuildFooter';}
    if(!el.id)el.id='rotinaBuildFooter';
    el.classList.remove('version');
    el.classList.add('rotina-build-footer');
    el.removeAttribute('type');
    el.textContent=`Rotina Family ADM · Versão ${legacyVersion} · Build ${INFO.build}`;
    el.title=`HTML ${INFO.htmlVersion} · Regras v${INFO.rulesModuleVersion} · Service Worker esperado v${INFO.expectedServiceWorkerVersion}`;
    el.style.cssText='position:static;inset:auto;display:block;width:100%;margin:28px 0 8px;padding:0;text-align:center;background:transparent;border:0;border-radius:0;box-shadow:none;color:#9aa0ad;font:500 11px/1.4 system-ui;opacity:1;pointer-events:none;';
    const host=document.getElementById('mainScroll')||document.querySelector('.main')||document.body;
    if(el.parentElement!==host)host.appendChild(el);
    for(const node of candidates){
      if(node!==el&&(node.id==='rotinaBuildBadge'||node.classList?.contains('version')||(/Rotina\s+Family/i.test(node.textContent||'')&&/Build/i.test(node.textContent||''))))node.remove();
    }
  }
  async function checkSw(){
    try{
      if(!('serviceWorker' in navigator)){emit('build.sw_indisponivel');return;}
      const reg=await navigator.serviceWorker.ready;
      const worker=navigator.serviceWorker.controller||reg.active;
      if(!worker){emit('build.sw_sem_controlador');return;}
      const token=Math.random().toString(36).slice(2);
      const listener=e=>{
        if(e.data?.type!=='ROTINA_BUILD_INFO'||e.data?.token!==token)return;
        navigator.serviceWorker.removeEventListener('message',listener);
        window.ROTINA_SW_VERSION=String(e.data.swVersion||'');
        emit('build.runtime',{
          serviceWorkerVersion:window.ROTINA_SW_VERSION,
          serviceWorkerCache:e.data.cacheName||'',
          serviceWorkerBuild:e.data.build||'',
          swMatchesExpected:String(e.data.swVersion)===INFO.expectedServiceWorkerVersion
        });
      };
      navigator.serviceWorker.addEventListener('message',listener);
      worker.postMessage({type:'ROTINA_GET_BUILD_INFO',token});
      setTimeout(()=>{navigator.serviceWorker.removeEventListener('message',listener);if(!window.ROTINA_SW_VERSION)emit('build.sw_sem_resposta');},1800);
    }catch(e){emit('build.sw_erro',{mensagem:String(e?.message||e)});}
  }
  const boot=()=>{
    footer();
    setTimeout(footer,700);
    setTimeout(footer,1800);
    emit('build.html_carregado',{href:location.href,userAgent:navigator.userAgent});
    setTimeout(checkSw,150);
    setTimeout(()=>emit('build.regra_modulo_esperado',{rulesModuleVersion:INFO.rulesModuleVersion}),400);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
