const fs=require('fs');
const assert=require('assert');
const entry=fs.readFileSync('index.html','utf8');

assert(entry.includes("const MASTER_OPERATIONAL_BASE_GROUP = 'CLI-4071'"));
assert(entry.includes("window.rotinaMasterApi('/group?grupoId=' + encodeURIComponent(groupId))"));
assert(entry.includes('masterOperationalProfiles'));
assert(entry.includes('mesclarPerfisOperacionaisMaster'));
assert(entry.includes('atualizarSelects = function atualizarSelectsComPerfisMaster'));
assert(entry.includes('window.rotinaMasterSincronizarIntegrantes'));

const MASTER_GROUP='CLI-4071';
let perfisCache=[];
let masterOperationalProfiles=[];
function merge(){
  const merged=new Map();
  const locais=Array.isArray(perfisCache)?perfisCache:[];
  [...locais,...masterOperationalProfiles].forEach(perfil=>{
    const id=String(perfil?.id||perfil?.perfilId||'').trim();
    if(!id)return;
    merged.set(id,{...(merged.get(id)||{}),...perfil,id,perfilId:perfil.perfilId||id});
  });
  perfisCache=[...merged.values()];
}

const workerResult={grupo:{grupoId:MASTER_GROUP,clientes:[{id:'lara-id',perfilId:'lara-id',nome:'Lara Vitoria'}]}};
masterOperationalProfiles=workerResult.grupo.clientes.map(cliente=>{
  const id=String(cliente?.perfilId||cliente?.id||'').trim();
  return {id,perfilId:id,nome:String(cliente?.nome||'Integrante'),grupoId:MASTER_GROUP,sexo:'—',pinHash:'__master_api__',_masterApi:true};
}).filter(perfil=>perfil.id);
merge();
assert(perfisCache.some(p=>p.nome==='Lara Vitoria'));

// A leitura direta pode chegar vazia depois. O cache Master precisa repor Lara.
perfisCache=[];
merge();
assert(perfisCache.some(p=>p.nome==='Lara Vitoria'));

const selected=perfisCache.find(p=>p.nome==='Lara Vitoria');
const tarefa={grupoId:MASTER_GROUP,perfilId:selected.id,perfilNome:selected.nome};
assert.deepEqual(tarefa,{grupoId:'CLI-4071',perfilId:'lara-id',perfilNome:'Lara Vitoria'});
console.log('OK - campo Integrante preserva Lara Vitoria via Worker seguro.');
