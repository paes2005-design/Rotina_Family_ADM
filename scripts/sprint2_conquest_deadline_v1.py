from pathlib import Path

p=Path('sprint2-conquistas-realdata-v1.js')
s=p.read_text(encoding='utf-8')
s=s.replace("const VERSION='conquistas-realdata-v1';","const VERSION='conquistas-realdata-v1.1-deadline';",1)

start=s.index('function modal(c){')
end=s.index('\nasync function eventLog',start)
modal=r'''function modal(c){
  document.getElementById('cq1Modal')?.remove();
  const d=c||{perfilId:'__ALL__',tipo:'on_time_days',meta:5,modoContagem:'consecutive',modoCiclo:'unique',repeticoes:1,ativa:true,periodoPercentual:'week',prazo:'none',prazoValor:7,prazoUnidade:'days'};
  const deadline=clean(d.prazo||d.deadline||'none')==='with'?'with':'none';
  const deadlineValue=Math.max(1,Number(d.prazoValor??d.deadlineValue)||7);
  const unitRaw=clean(d.prazoUnidade||d.deadlineUnit||'days');
  const deadlineUnit=['days','weeks','months'].includes(unitRaw)?unitRaw:'days';
  const m=document.createElement('div');
  m.id='cq1Modal';m.className='cq-modal';
  m.innerHTML=`<div class="cq-card"><h3>${c?'Editar':'Nova'} conquista</h3><div class="cq-grid">
    <div class="cq-field"><label>Participante</label><select id="cqFormPerson"><option value="__ALL__" ${d.perfilId==='__ALL__'?'selected':''}>Todos</option>${profiles.map(p=>`<option value="${esc(p.id)}" ${d.perfilId===p.id?'selected':''}>${esc(p.nome)}</option>`).join('')}</select></div>
    <div class="cq-field"><label>Regra</label><select id="cqFormType">${Object.entries(RULES).map(([k,v])=>`<option value="${k}" ${d.tipo===k?'selected':''}>${esc(v.label)}</option>`).join('')}</select></div>
    <div class="cq-field"><label>Meta</label><input id="cqFormTarget" type="number" min="1" value="${Number(d.meta)||1}"></div>
    <div class="cq-field"><label>Contagem</label><select id="cqFormCount"><option value="consecutive" ${d.modoContagem==='consecutive'?'selected':''}>Consecutiva</option><option value="accumulated" ${d.modoContagem==='accumulated'?'selected':''}>Acumulada</option></select></div>
    <div class="cq-field"><label>Ciclo</label><select id="cqFormCycle"><option value="unique" ${d.modoCiclo==='unique'?'selected':''}>Única</option><option value="periodic" ${d.modoCiclo==='periodic'?'selected':''}>Periódica</option><option value="continuous" ${d.modoCiclo==='continuous'?'selected':''}>Contínua</option></select></div>
    <div class="cq-field"><label>Repetições periódicas</label><input id="cqFormRepeat" type="number" min="2" value="${Math.max(2,Number(d.repeticoes)||2)}"></div>
    <div class="cq-field"><label>Período percentual</label><select id="cqFormPeriod"><option value="week" ${d.periodoPercentual!=='month'?'selected':''}>Semana</option><option value="month" ${d.periodoPercentual==='month'?'selected':''}>Mês</option></select></div>
    <div class="cq-field"><label>Situação</label><select id="cqFormActive"><option value="1" ${d.ativa!==false?'selected':''}>Ativa</option><option value="0" ${d.ativa===false?'selected':''}>Desativada</option></select></div>
    <div class="cq-field" id="cqDeadlineWrap"><label>Prazo (regra de pontos)</label><select id="cqFormDeadline"><option value="none" ${deadline==='none'?'selected':''}>Sem prazo</option><option value="with" ${deadline==='with'?'selected':''}>Com prazo</option></select></div>
    <div class="cq-field" id="cqDeadlineValueWrap"><label>Prazo</label><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><input id="cqFormDeadlineValue" type="number" min="1" max="999" value="${deadlineValue}"><select id="cqFormDeadlineUnit"><option value="days" ${deadlineUnit==='days'?'selected':''}>dias</option><option value="weeks" ${deadlineUnit==='weeks'?'selected':''}>semanas</option><option value="months" ${deadlineUnit==='months'?'selected':''}>meses</option></select></div></div>
  </div><div class="cq-note">A regra é calculada com os registros reais de tarefas/histórico do Store central. Ao atingir a meta, fica aguardando validação do ADM. O prazo da regra de pontos é armazenado exatamente como configuração nesta etapa; não há expiração automática inventada.</div><div class="cq-modal-actions"><button class="cq-btn" id="cqFormCancel">Cancelar</button><button class="primary" id="cqFormSave">Salvar conquista</button></div></div>`;
  document.body.appendChild(m);
  const type=m.querySelector('#cqFormType'),deadlineSel=m.querySelector('#cqFormDeadline'),deadlineWrap=m.querySelector('#cqDeadlineWrap'),valueWrap=m.querySelector('#cqDeadlineValueWrap');
  function syncDeadline(){const points=type.value==='points';deadlineWrap.hidden=!points;valueWrap.hidden=!points||deadlineSel.value!=='with'}
  type.addEventListener('change',syncDeadline);deadlineSel.addEventListener('change',syncDeadline);syncDeadline();
  m.querySelector('#cqFormCancel').onclick=()=>m.remove();
  m.onclick=e=>{if(e.target===m)m.remove()};
  m.querySelector('#cqFormSave').onclick=()=>saveForm(c?.id||'',m)
}'''
s=s[:start]+modal+s[end:]

start=s.index('async function saveForm(id,m){')
end=s.index('\nasync function queuePending',start)
save=r'''async function saveForm(id,m){
  if(busy||!canWrite()||!await firebaseReady())return;
  const now=new Date().toISOString(),type=m.querySelector('#cqFormType').value,deadline=type==='points'?m.querySelector('#cqFormDeadline').value:'none';
  const payload={
    grupoId:groupId(),
    perfilId:m.querySelector('#cqFormPerson').value,
    tipo:type,
    meta:Math.max(1,Number(m.querySelector('#cqFormTarget').value)||1),
    modoContagem:m.querySelector('#cqFormCount').value,
    modoCiclo:m.querySelector('#cqFormCycle').value,
    periodoPercentual:m.querySelector('#cqFormPeriod').value,
    ativa:m.querySelector('#cqFormActive').value==='1',
    prazo:deadline,
    prazoValor:Math.max(1,Number(m.querySelector('#cqFormDeadlineValue').value)||1),
    prazoUnidade:m.querySelector('#cqFormDeadlineUnit').value,
    atualizadoEm:now
  };
  payload.repeticoes=payload.modoCiclo==='unique'?1:Math.max(2,Number(m.querySelector('#cqFormRepeat').value)||2);
  busy=true;
  try{
    if(id){await fs.updateDoc(fs.doc(db,'conquistas',id),payload)}
    else{
      Object.assign(payload,{pendenteValidacao:false,validadas:0,ciclosUsados:0,encerrada:false,cicloIniciadoEm:now,criadoEm:now});
      const ref=await fs.addDoc(fs.collection(db,'conquistas'),payload);payload.id=ref.id;
      await eventLog(payload,'Ativa','Conquista configurada')
    }
    m.remove();await sync('conquistas-salvar');toast('Conquista salva.');log('save_success',{edicao:!!id,prazo:type==='points'&&deadline==='with'})
  }catch(e){console.error(e);toast('Não foi possível salvar a conquista.');log('save_error',{codigo:clean(e?.code)||'erro'},'error')}
  finally{busy=false;render()}
}'''
s=s[:start]+save+s[end:]
p.write_text(s,encoding='utf-8')

p=Path('sprint2-integracao-recompensas-v1.html')
h=p.read_text(encoding='utf-8')
h=h.replace('sprint2-conquistas-realdata-v1.js?v=20260903-v1','sprint2-conquistas-realdata-v1.js?v=20260903-deadline-v1',1)
p.write_text(h,encoding='utf-8')
print('CONQUEST_DEADLINE_PATCH_OK')
