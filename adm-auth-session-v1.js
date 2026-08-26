// Emergency compatibility rollback — 2026-08-26
// The secure role-session bridge is temporarily disabled so the stable
// ADM authentication implemented in index-ADMIN-v8.html remains authoritative.
// Do not override realizarLogin/cadastrarNovoAdministrador here.
const VERSION = 4;

try {
  window.__rotinaAdminAuthVersion = VERSION;
  window.__rotinaAdminAuthBridgeDisabled = true;
  window.rotinaLog?.('auth.adm_bridge_desativada_emergencia', {
    authVersion: VERSION,
    modo: 'legacy-stable'
  }, 'warning');
  window.dispatchEvent(new CustomEvent('rotina-adm-auth-bridge-disabled', {
    detail: { version: VERSION, mode: 'legacy-stable' }
  }));
} catch (_) {}
