/* ---------------------------------------------------------------------
   Lanza toda la suite y resume.

     node tests/todos.mjs

   Sale con código 1 si falla algo, para poder colgarlo de un hook o de
   una GitHub Action sin más envoltorio. Las pruebas de navegador se
   saltan solas (sin fallar) si no hay Playwright instalado.
--------------------------------------------------------------------- */
import {spawnSync} from 'child_process';

const FICHEROS=['logica.mjs','render.mjs','estado.mjs','limites.mjs','navegador.mjs'];
let pasan=0, fallan=0, saltados=[];

for(const f of FICHEROS){
  const r=spawnSync(process.execPath,[new URL(f,import.meta.url).pathname],{encoding:'utf8'});
  const salida=(r.stdout||'')+(r.stderr||'');
  process.stdout.write(salida);
  for(const m of salida.matchAll(/(\d+) pasan, (\d+) fallan/g)){ pasan+=+m[1]; fallan+=+m[2]; }
  if(salida.includes('⊘')) saltados.push(f);
  if(r.status!==0 && !salida.includes('⊘')) fallan=Math.max(fallan,1);
}

console.log('\n' + '─'.repeat(52));
console.log(`${fallan?'✗':'✓'} TOTAL: ${pasan} pruebas pasan, ${fallan} fallan`);
if(saltados.length) console.log(`⊘ saltadas: ${saltados.join(', ')}`);
process.exit(fallan?1:0);
