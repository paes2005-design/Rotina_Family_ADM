from pathlib import Path
import subprocess

GOOD_REF='3f2aa2b5395a1af10212b43badb781dfdb89ab1d'
login_path=Path('sprint2-integracao-login-realdata-v1.js')
tasks_path=Path('sprint2-tarefas-realdata-v2.js')

# Restaura a implementação original da Análise, que funcionava antes da liberação de Tarefas V2.
login=subprocess.check_output(['git','show',f'{GOOD_REF}:sprint2-integracao-login-realdata-v1.js'],text=True)

# A tela Tarefas V2 é dona exclusiva da própria UI. O shell não deve mais procurar
# nem manipular os controles legados que Tarefas V2 substitui.
legacy_block="""function readOnlyToast(){window.RF_APP.toast('Modo leitura: primeiro valide os dados reais.');}\nconst coreToggleDetails=window.RF_APP.toggleTaskDetails.bind(window.RF_APP);\nwindow.RF_APP.addTask=readOnlyToast;window.RF_APP.editTask=readOnlyToast;window.RF_APP.saveTask=readOnlyToast;window.RF_APP.removeTask=readOnlyToast;window.RF_APP.toggleTaskDay=readOnlyToast;window.RF_APP.setTaskDetail=readOnlyToast;\nwindow.RF_APP.toggleTaskDetails=id=>{coreToggleDetails(id);requestAnimationFrame(lockTaskActions)};\nfunction lockTaskActions(){document.querySelectorAll('#view-tarefas button[title=\"Editar\"],#view-tarefas button[title=\"Excluir\"]').forEach(b=>{b.disabled=true;b.classList.add('read-only')});document.querySelectorAll('#view-tarefas .expand .day,#view-tarefas .details-mobile .day,#view-tarefas .expand input,#view-tarefas .expand textarea,#view-tarefas .details-mobile input,#view-tarefas .details-mobile textarea').forEach(el=>el.disabled=true)}\nfunction renderTasksSafe(){window.RF_APP.renderTasks();requestAnimationFrame(lockTaskActions)}\n"""
if legacy_block not in login:
    raise SystemExit('Bloco legado de Tarefas não encontrado no código-base')
login=login.replace(legacy_block,"function renderTasksSafe(){window.rotinaSprint2TasksRender?.()}\n",1)

legacy_bind="""$('taskParticipant').addEventListener('change',e=>{appState.taskParticipant=e.target.value;appState.editingTask=null;appState.openTask=null;renderTasksSafe()});$('taskSearch').addEventListener('input',e=>{appState.taskSearch=e.target.value;renderTasksSafe()});$('taskFilter').addEventListener('change',e=>{appState.taskFilter=e.target.value;renderTasksSafe()});"""
if legacy_bind not in login:
    raise SystemExit('Bindings legados de Tarefas não encontrados no código-base')
login=login.replace(legacy_bind,'',1)
login_path.write_text(login,encoding='utf-8')

# Tarefas V2 deixa de sobrescrever RF_APP.renderTasks e expõe somente sua API dedicada.
tasks=tasks_path.read_text(encoding='utf-8')
old_activate="function activate(){if(!window.RF_APP)return;window.RF_APP.renderTasks=render;ensureView();if(document.body.classList.contains('rf-auth-ready'))render()}"
new_activate="function activate(){if(!window.RF_APP)return;ensureView();if(document.body.classList.contains('rf-auth-ready'))render()}\nwindow.rotinaSprint2TasksRender=()=>render();"
if old_activate not in tasks:
    raise SystemExit('Ponto de ownership de Tarefas V2 não encontrado')
tasks=tasks.replace(old_activate,new_activate,1)
tasks_path.write_text(tasks,encoding='utf-8')

# Cache-bust da versão limpa apenas nas páginas integradas da Sprint 2.
for name in [
    'sprint2-integracao-login-realdata-v1.html',
    'sprint2-integracao-monitor-v2.html',
    'sprint2-integracao-participantes-v1.html',
    'sprint2-integracao-recompensas-v1.html',
]:
    p=Path(name)
    if not p.exists():
        continue
    h=p.read_text(encoding='utf-8')
    import re
    h=re.sub(r'src="sprint2-integracao-login-realdata-v1\.js(?:\?v=[^"]*)?"','src="sprint2-integracao-login-realdata-v1.js?v=20260903-tasks-ownership-v1"',h)
    p.write_text(h,encoding='utf-8')

print('SPRINT2_TASKS_OWNERSHIP_REFACTOR=APPLIED')
