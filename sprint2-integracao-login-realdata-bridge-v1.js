"use strict";
(function(){
  if (typeof state === 'undefined' || typeof renderTasks !== 'function' || typeof normalizeTasks !== 'function') {
    throw new Error('Ponte realdata: nucleo de Tarefas indisponivel.');
  }

  function syncIntoCore(){
    if (Object.prototype.hasOwnProperty.call(state,'taskParticipant')) taskParticipant=state.taskParticipant||'__ALL__';
    if (Object.prototype.hasOwnProperty.call(state,'taskSearch')) taskSearch=state.taskSearch||'';
    if (Object.prototype.hasOwnProperty.call(state,'taskFilter')) taskFilter=state.taskFilter||'all';
    if (Object.prototype.hasOwnProperty.call(state,'editingTask')) editingTask=state.editingTask ?? null;
    if (Object.prototype.hasOwnProperty.call(state,'openTask')) openTaskId=state.openTask ?? null;
  }
  function syncFromCore(){
    state.taskParticipant=taskParticipant;
    state.taskSearch=taskSearch;
    state.taskFilter=taskFilter;
    state.editingTask=editingTask;
    state.openTask=openTaskId;
  }
  function wrap(fn){return (...args)=>{syncIntoCore();const out=fn(...args);syncFromCore();return out}}

  window.RF_APP={
    state,
    normalizeState(){normalizeTasks();syncIntoCore();syncFromCore()},
    renderTasks:wrap(renderTasks),
    toast,
    addTask:wrap(addTask),
    editTask:wrap(editTask),
    saveTask:wrap(saveTaskInline),
    cancelTaskEdit:wrap(cancelTaskEdit),
    removeTask:wrap(deleteTask),
    toggleTaskDetails:wrap(toggleTaskDetails),
    toggleTaskDay:wrap(toggleTaskDay),
    setTaskDetail:wrap(setTaskDetail)
  };

  window.RF={
    editTask:(...a)=>window.RF_APP.editTask(...a),
    saveTask:(...a)=>window.RF_APP.saveTask(...a),
    cancelTaskEdit:(...a)=>window.RF_APP.cancelTaskEdit(...a),
    toggleTaskDetails:(...a)=>window.RF_APP.toggleTaskDetails(...a),
    toggleTaskDay:(...a)=>window.RF_APP.toggleTaskDay(...a),
    setTaskDetail:(...a)=>window.RF_APP.setTaskDetail(...a),
    deleteTask:(...a)=>window.RF_APP.removeTask(...a)
  };

  if(!document.getElementById('sprint2MasterRealDataScript')){
    const script=document.createElement('script');
    script.id='sprint2MasterRealDataScript';
    script.src='sprint2-master-realdata-v1.js?v=20260904-master-realdata-v1-idempotent';
    script.async=true;
    script.onerror=()=>techLog('master_realdata_load_error',{bridge:1},'error');
    document.head.appendChild(script);
  }

  techLog('realdata_bridge_ready',{bridge:1,masterRealData:1});
})();