from pathlib import Path

p=Path('sprint2-participantes-realdata-v1.js')
s=p.read_text(encoding='utf-8')

old="function canWrite(){return ['adm_familia','adm_convidado'].includes(clean(session().role))}"
new="function canWrite(){return ['adm_familia','adm_convidado','master'].includes(clean(session().role))}"
assert old in s, 'canWrite esperado nao encontrado'
s=s.replace(old,new,1)

old_msg="Conta Master em modo leitura. Alterações de participantes ficam disponíveis para administradores do grupo."
new_msg="Conta Master: edição e troca de PIN ficam restritas ao grupo atualmente aberto."
assert old_msg in s, 'mensagem master esperada nao encontrada'
s=s.replace(old_msg,new_msg,1)

old_guard="async function save(id,mobile){if(busy||!canWrite())return;const isNew=id==='new',p=isNew?null:profiles.find(x=>x.id===id);if(!isNew&&!p)return;"
new_guard="async function save(id,mobile){if(busy||!canWrite())return;const isNew=id==='new',p=isNew?null:profiles.find(x=>x.id===id);if(!isNew&&!p)return;const g=groupId(),sg=clean(session().groupId).toUpperCase();if(!g||sg!==g)return toast('Grupo da sessão não confere. Atualize e tente novamente.');if(!isNew&&clean(p.grupoId).toUpperCase()!==g)return toast('Participante não pertence ao grupo aberto.');"
assert old_guard in s, 'inicio de save esperado nao encontrado'
s=s.replace(old_guard,new_guard,1)

p.write_text(s,encoding='utf-8')

checks={
 'master incluido em canWrite': "['adm_familia','adm_convidado','master']" in s,
 'sessao deve coincidir com grupo aberto': "sg!==g" in s,
 'participante deve pertencer ao grupo aberto': "clean(p.grupoId).toUpperCase()!==g" in s,
 'sem listener proprio': 'onSnapshot(' not in s,
 'sem normalizeState destrutivo': 'normalizeState?.()' not in s,
}
for k,v in checks.items(): print(('OK   ' if v else 'FALHA'),k)
print(f'MASTER_PARTICIPANT_EDIT_FIX={sum(checks.values())}/{len(checks)}')
if not all(checks.values()): raise SystemExit(1)
