(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.RFRewardCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function clone(v){return JSON.parse(JSON.stringify(v));}
  function int(v,min){const n=Math.floor(Number(v)||0);return Math.max(min||0,n);}
  function maxAttempts(c){
    if(c.cycleMode==='continuous') return Infinity;
    if(c.cycleMode==='periodic') return Math.max(2,int(c.repeatCount,2));
    return 1;
  }
  function participantVisible(c){return !!(c&&c.active&&!c.closed);}
  function cycleLabel(c){
    if(c.cycleMode==='continuous') return 'Contínua';
    if(c.cycleMode==='periodic') return `Periódica · ${maxAttempts(c)} ciclos`;
    return 'Única';
  }
  function attemptLabel(c){
    const used=int(c?.runtime?.attemptsUsed,0), lim=maxAttempts(c);
    if(lim===Infinity) return `Ciclo atual ${used+1} · ${used} concluído(s)`;
    if(c.closed) return `${used}/${lim} ciclo(s) concluído(s)`;
    return `Ciclo ${Math.min(used+1,lim)} de ${lim} · ${used} concluído(s)`;
  }
  function resetProgress(c){
    c.runtime.progress=0;
    c.runtime.lastResult='';
  }
  function ensureRuntime(c){
    c.runtime=c.runtime||{};
    c.runtime.progress=Number(c.runtime.progress)||0;
    c.runtime.attemptsUsed=int(c.runtime.attemptsUsed,0);
    c.runtime.rewardsValidated=int(c.runtime.rewardsValidated,0);
    c.runtime.pendingValidation=!!c.runtime.pendingValidation;
    c.runtime.closed=!!c.runtime.closed;
    c.runtime.lastResult=c.runtime.lastResult||'';
    return c;
  }
  function closeIfExhausted(c){
    const lim=maxAttempts(c);
    if(c.runtime.attemptsUsed>=lim){
      c.runtime.closed=true;
      c.active=false;
      return true;
    }
    return false;
  }
  function finishAttempt(input,success){
    const c=ensureRuntime(clone(input));
    if(c.runtime.pendingValidation||c.runtime.closed||!c.active) return c;
    c.runtime.attemptsUsed++;
    c.runtime.lastResult=success?'Meta atingida neste ciclo.':'Meta não atingida neste ciclo.';
    if(success){
      c.runtime.pendingValidation=true;
      closeIfExhausted(c);
    }else if(closeIfExhausted(c)){
      c.runtime.progress=0;
      c.runtime.lastResult='Sem novos ciclos válidos. Conquista desativada.';
    }else{
      resetProgress(c);
      c.runtime.lastResult='Novo ciclo iniciado.';
    }
    return c;
  }
  function validateReward(input){
    const c=ensureRuntime(clone(input));
    if(!c.runtime.pendingValidation) return c;
    c.runtime.pendingValidation=false;
    c.runtime.rewardsValidated++;
    const lim=maxAttempts(c);
    if(c.runtime.attemptsUsed>=lim){
      c.runtime.closed=true;
      c.active=false;
      c.runtime.progress=0;
      c.runtime.lastResult='Recompensa validada. Conquista encerrada e desativada.';
    }else{
      c.runtime.closed=false;
      c.active=true;
      resetProgress(c);
      c.runtime.lastResult='Recompensa validada. Novo ciclo iniciado.';
    }
    return c;
  }
  function addProgress(input,amount){
    const c=ensureRuntime(clone(input));
    if(!c.active||c.runtime.closed||c.runtime.pendingValidation) return c;
    c.runtime.progress=Math.max(0,Number(c.runtime.progress)||0)+Math.max(0,Number(amount)||0);
    if(c.runtime.progress>=Number(c.target||1)) return finishAttempt(c,true);
    return c;
  }
  function resetDemoRuntime(input){
    const c=clone(input);
    c.active=true;
    c.runtime={progress:0,attemptsUsed:0,rewardsValidated:0,pendingValidation:false,closed:false,lastResult:''};
    return c;
  }
  function status(c){
    ensureRuntime(c);
    if(c.runtime.pendingValidation&&c.runtime.closed) return {key:'pending_closed',label:'DESATIVADA · recompensa aguardando validação'};
    if(c.runtime.pendingValidation) return {key:'pending',label:'Recompensa aguardando validação do ADM'};
    if(c.runtime.closed||!c.active) return {key:'inactive',label:'DESATIVADA'};
    return {key:'active',label:'ATIVA'};
  }

  return {maxAttempts,participantVisible,cycleLabel,attemptLabel,finishAttempt,validateReward,addProgress,resetDemoRuntime,status,ensureRuntime};
});