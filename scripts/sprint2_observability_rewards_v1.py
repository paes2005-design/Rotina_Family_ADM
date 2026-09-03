from pathlib import Path
p=Path('sprint2-integracao-recompensas-v1.html')
s=p.read_text(encoding='utf-8')
needle='<script src="sprint2-teste-core.js"></script><script src="sprint2-integracao-login-realdata-bridge-v1.js"></script>'
repl='<script src="sprint2-teste-core.js"></script><script src="sprint2-observability-v1.js"></script><script src="sprint2-integracao-login-realdata-bridge-v1.js"></script>'
if needle not in s and 'sprint2-observability-v1.js' not in s:
    raise SystemExit('Ponto de inserção da observabilidade não encontrado')
if 'sprint2-observability-v1.js' not in s:
    s=s.replace(needle,repl)
p.write_text(s,encoding='utf-8')
print('OK: observabilidade contextual integrada à Recompensas V1')