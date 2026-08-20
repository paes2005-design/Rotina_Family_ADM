(() => {
  const MASTER_ROOT = '#masterUsers';

  function isMissingUid(button) {
    return button?.hasAttribute('data-uid') && !String(button.dataset.uid || '').trim();
  }

  function markOrphan(container) {
    if (!container || container.dataset.masterIntegrityChecked === '1') return;
    const actionButtons = [...container.querySelectorAll('button[data-action][data-uid]')];
    const missing = actionButtons.filter(isMissingUid);
    if (!missing.length) return;

    container.dataset.masterIntegrityChecked = '1';
    missing.forEach(button => {
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
      button.title = 'Este cadastro não possui UID vinculado ao Firebase Authentication.';
      button.style.opacity = '.45';
      button.style.cursor = 'not-allowed';
    });

    const actions = missing[0]?.closest('.master-actions');
    if (actions && !actions.previousElementSibling?.classList?.contains('master-orphan-warning')) {
      const warning = document.createElement('div');
      warning.className = 'master-orphan-warning';
      warning.textContent = '⚠️ Cadastro sem login no Firebase Authentication';
      warning.style.cssText = 'margin-top:8px;padding:8px 10px;border-radius:10px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:11px;font-weight:700;line-height:1.3';
      actions.before(warning);
    }
  }

  function scan() {
    const root = document.querySelector(MASTER_ROOT);
    if (!root) return;
    root.querySelectorAll('tr, .master-user-card').forEach(markOrphan);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button[data-action][data-uid]');
    if (!button || !isMissingUid(button)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    alert('Este cadastro administrativo está incompleto: não existe UID vinculado ao Firebase Authentication. As ações de login foram bloqueadas para evitar erro.');
  }, true);

  const observer = new MutationObserver(scan);
  function start() {
    scan();
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
