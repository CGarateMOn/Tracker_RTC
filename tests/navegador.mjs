/* ---------------------------------------------------------------------
   Pruebas de navegador (Chromium vía Playwright).

   Levanta su propio servidor estático sobre la raíz del repo, intercepta
   datos.json para servir el tablón fijo de datos.mjs y corta las
   llamadas a Apps Script, de modo que no toca la red ni depende del
   datos.json real.

   Playwright no es dependencia del repo (aquí no hay package.json). Si
   no está instalado, la suite lo dice y se salta, sin fallar:
     npx playwright install chromium
--------------------------------------------------------------------- */
import {spawn} from 'child_process';
import net from 'net';
import {TABLON,ESPERADO} from './datos.mjs';

/* ---------- ¿hay Playwright? ---------- */
async function cargarPlaywright(){
  const intentos=['playwright','playwright-core'];
  for(const m of intentos){ try{ return (await import(m)).chromium }catch(e){} }
  /* instalado por `npx playwright`: vive en la caché de npx */
  try{
    const {execSync}=await import('child_process');
    const salida=execSync('find "$HOME/.npm/_npx" -maxdepth 4 -name playwright -type d 2>/dev/null | head -1',
      {encoding:'utf8',shell:'/bin/sh'}).trim();
    if(salida) return (await import(salida+'/index.mjs')).chromium;
  }catch(e){}
  return null;
}
const chromium=await cargarPlaywright();
if(!chromium){
  console.log('\n⊘ navegador: Playwright no está instalado, se salta.');
  console.log('  Para ejecutarlas:  npx playwright install chromium');
  process.exit(0);
}

/* ---------- servidor estático propio ---------- */
const puertoLibre=()=>new Promise(r=>{const s=net.createServer();s.listen(0,()=>{const p=s.address().port;s.close(()=>r(p))})});
const PUERTO=await puertoLibre();
const RAIZ=new URL('..',import.meta.url).pathname;
const servidor=spawn('python3',['-m','http.server',String(PUERTO)],{cwd:RAIZ,stdio:'ignore'});
const cerrar=()=>{try{servidor.kill()}catch(e){}};
process.on('exit',cerrar); process.on('SIGINT',()=>{cerrar();process.exit(1)});
await new Promise(r=>setTimeout(r,700));
const BASE=`http://localhost:${PUERTO}/`;

/* ---------- aserciones ---------- */
let ok=0, fallos=[];
const eq=(a,b,m)=>{const A=JSON.stringify(a),B=JSON.stringify(b);A===B?ok++:fallos.push(`${m}\n      esperado: ${B}\n      obtenido: ${A}`)};
const cierto=(v,m)=>eq(!!v,true,m);

const navegador=await chromium.launch();
const errores=[];
/* Todo contexto sale de aquí: sirve el tablón fijo, corta Apps Script y
   corta también las fuentes de Google. Sin ese último corte, goto()
   espera al evento "load" y se queda colgado los 30 s de timeout cuando
   el entorno no tiene salida a internet. */
async function prepara(c){
  await c.route('**/datos.json*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(TABLON)}));
  await c.route('**/script.google.com/**',r=>r.abort());
  await c.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  c.setDefaultNavigationTimeout(15000);
}
/* domcontentloaded, no "load": script.js es un <script src> al final del
   body, así que ya ha corrido, y no se espera a hojas ni imágenes. */
const ir=(p,url=BASE)=>p.goto(url,{waitUntil:'domcontentloaded'});
const recargar=p=>p.reload({waitUntil:'domcontentloaded'});

async function nueva(w=430,h=932,extra={}){
  const c=await navegador.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,...extra});
  await prepara(c);
  const p=await c.newPage();
  p.on('pageerror',e=>errores.push(e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/ERR_FAILED|Failed to load resource/.test(m.text()))errores.push(m.text())});
  return {c,p};
}
const entrar=async(p,gate)=>{
  await ir(p); await p.waitForTimeout(400);
  if(await p.locator('#empezar').isVisible()){await p.click('#empezar');await p.waitForTimeout(200);}
  await p.click(`.gopt[data-g="${gate}"]`); await p.waitForTimeout(400);
  await p.click('#promoClose').catch(()=>{}); await p.waitForTimeout(150);
};

/* ============ 1. primera visita: intro → gate ============ */
{
  const {c,p}=await nueva();
  await ir(p); await p.waitForTimeout(400);
  cierto(await p.locator('#intro.on').isVisible(),'primera visita: sale la intro');
  eq(await p.locator('#gate.on').count(),0,'primera visita: el gate aún no');
  /* los widgets de muestra son funcionales, pero NO deben tocar datos reales */
  await p.click('.mock-fav');
  eq(await p.getAttribute('.mock-fav','aria-pressed'),'false','estrella de muestra se apaga');
  await p.selectOption('.mock-seg','entrevista');
  cierto(await p.locator('.mock-seg.v-entrevista').count(),'desplegable de muestra cambia de color');
  eq(await p.evaluate(()=>JSON.parse(localStorage.getItem('rtc-favoritas-v2')||'[]')),[],'los widgets de muestra NO tocan FAV');
  eq(await p.evaluate(()=>JSON.parse(localStorage.getItem('rtc-seguimiento-v1')||'{}')),{},'los widgets de muestra NO tocan SEG');
  await p.click('#empezar'); await p.waitForTimeout(250);
  cierto(await p.locator('#gate.on').isVisible(),'tras la intro sale el gate');
  eq(await p.locator('.gopt').count(),4,'el gate tiene 4 opciones');
  const textos=await p.locator('.gopt').evaluateAll(ns=>ns.map(n=>n.childNodes[0].textContent.trim()));
  eq(textos,['Prácticas','Contrato laboral','Eventos','Todo'],'las 4 opciones, en orden');
  await c.close();
}

/* ============ 2. vista de eventos: controles y tarjetas ============ */
{
  const {c,p}=await nueva();
  await entrar(p,'eventos');
  eq(await p.locator('#row1 > *').count(),3,'eventos: exactamente 3 controles');
  eq(await p.locator('#row1 summary .lb').allTextContents(),['Formato','Organizador'],'eventos: Formato y Organizador');
  cierto(await p.locator('#favbtn').isVisible(),'eventos: botón Guardados visible');
  eq(await p.locator('#row2 > *').count(),0,'eventos: no hay segunda fila (sin Orden)');
  eq(await p.textContent('#count'),ESPERADO.eventos+' eventos','eventos: contador');
  eq(await p.locator('.seg-select').count(),0,'eventos: ninguna tarjeta con seguimiento');
  eq(await p.locator('.tag-evento').count(),ESPERADO.eventos,'eventos: todas llevan etiqueta EVENTO');
  eq(await p.locator('.fav').count(),ESPERADO.eventos,'eventos: todas llevan estrella');
  eq(await p.locator('.card').first().evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 255, 255)',
     'eventos: tarjeta con fondo blanco, igual que las ofertas');
  eq(await p.locator('.card .desc').allTextContents(),ESPERADO.ordenEventos,'eventos: ordenados por fecha');

  /* filtrar por formato */
  await p.click('#row1 details[data-k="modalidad"] summary'); await p.waitForTimeout(150);
  eq(await p.locator('#row1 details[data-k="modalidad"] .panel label.opt span:not(.c)').allTextContents(),
     ['Presencial','Online'],'Formato: solo los valores que existen (sin Híbrido)');
  await p.click('#row1 details[data-k="modalidad"] .panel label.opt:has-text("Presencial")'); await p.waitForTimeout(300);
  eq(await p.textContent('#count'),'1 evento','filtrar por Presencial');
  cierto(await p.locator('#reset').isVisible(),'con filtro activo sale "Quitar filtros"');
  await p.click('#reset'); await p.waitForTimeout(300);
  eq(await p.textContent('#count'),ESPERADO.eventos+' eventos','reset devuelve todos');

  /* filtrar por organizador */
  await p.click('#row1 details[data-k="empresa"] summary'); await p.waitForTimeout(150);
  eq(await p.locator('#row1 details[data-k="empresa"] .panel label.opt span:not(.c)').allTextContents(),
     ESPERADO.organizadores,'Organizador: solo quien organiza eventos');
  await p.click('#row1 details[data-k="empresa"] .panel label.opt:has-text("McKinsey")'); await p.waitForTimeout(300);
  eq(await p.textContent('#count'),'3 eventos','filtrar por organizador');
  /* el panel debe cerrarse solo: si se queda abierto tapa "Quitar filtros" */
  eq(await p.locator('details.drop[open]').count(),0,'Organizador se cierra al elegir');
  const encima=await p.evaluate(()=>{const r=document.querySelector('#reset').getBoundingClientRect();
    const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return e?(e.id||e.className):'nada'});
  eq(encima,'reset','"Quitar filtros" queda pulsable, sin panel encima');
  await p.click('#reset'); await p.waitForTimeout(250);
  eq(await p.textContent('#count'),ESPERADO.eventos+' eventos','reset tras filtrar por organizador');
  await c.close();
}

/* ============ 3. guardar un evento y que sobreviva a la recarga ============ */
{
  const {c,p}=await nueva();
  await entrar(p,'eventos');
  await p.locator('.card').first().locator('.fav').click(); await p.waitForTimeout(250);
  eq(await p.locator('.fav[aria-pressed="true"]').count(),1,'se guarda el evento');
  eq(await p.textContent('#favbtn'),'★ Guardados1','el contador de guardados sube');
  await recargar(p); await p.waitForTimeout(600);
  eq(await p.locator('.fav[aria-pressed="true"]').count(),1,'tras recargar sigue guardado');
  await p.click('#favbtn'); await p.waitForTimeout(250);
  eq(await p.textContent('#count'),'1 evento','el filtro Guardados funciona');
  await p.click('#favbtn'); await p.waitForTimeout(200);
  await p.click('#modo'); await p.waitForTimeout(200);
  await p.click('.gopt[data-g="practicas"]'); await p.waitForTimeout(400);
  eq(await p.locator('.fav[aria-pressed="true"]').count(),0,'guardar un evento no marca ninguna oferta');
  await c.close();
}

/* ============ 3b. la promo del grupo, una sola vez ============ */
{
  const {c,p}=await nueva();
  await ir(p); await p.waitForTimeout(400);
  await p.click('#empezar'); await p.waitForTimeout(200);
  await p.click('.gopt[data-g="eventos"]'); await p.waitForTimeout(400);
  cierto(await p.locator('#promoCard').isVisible(),'promo: la primera vez se despliega sola');
  cierto(await p.locator('#promoChip').isVisible(),'promo: la píldora se ve');
  eq(await p.getAttribute('#promoChip','aria-expanded'),'true','promo: aria-expanded al desplegarse');

  /* cambiar de gate ya no la despliega */
  await p.click('#promoClose'); await p.waitForTimeout(150);
  await p.click('#modo'); await p.waitForTimeout(200);
  await p.click('.gopt[data-g="ambas"]'); await p.waitForTimeout(400);
  eq(await p.locator('#promoCard').isVisible(),false,'promo: al cambiar de gate ya no se despliega');
  cierto(await p.locator('#promoChip').isVisible(),'promo: la píldora sigue ahí tras cambiar de gate');

  /* sin cerrarla con la X tampoco vuelve */
  await p.click('#modo'); await p.waitForTimeout(200);
  await p.click('.gopt[data-g="practicas"]'); await p.waitForTimeout(400);
  eq(await p.locator('#promoCard').isVisible(),false,'promo: ni al segundo cambio de gate');

  /* recargar tampoco la trae de vuelta */
  await recargar(p); await p.waitForTimeout(700);
  eq(await p.locator('#promoCard').isVisible(),false,'promo: tras recargar no se despliega');
  cierto(await p.locator('#promoChip').isVisible(),'promo: tras recargar la píldora sigue');

  /* pero se puede abrir a mano, siempre */
  await p.click('#promoChip'); await p.waitForTimeout(200);
  cierto(await p.locator('#promoCard').isVisible(),'promo: la píldora la abre a mano');
  cierto(await p.locator('.promo-cta').isVisible(),'promo: el botón de unirse está dentro');
  await p.click('#promoChip'); await p.waitForTimeout(200);
  eq(await p.locator('#promoCard').isVisible(),false,'promo: volver a pulsar la cierra');
  await c.close();
}

/* ============ 3c. guía "ahora hay eventos" (solo usuarios antiguos) ============ */
{
  /* usuario ANTIGUO: ya pasó la intro, tiene sección elegida y vio la promo */
  const c=await navegador.newContext({viewport:{width:430,height:932}});
  await c.addInitScript(()=>{try{
    localStorage.setItem('rtc-intro-v1','1');
    localStorage.setItem('rtc-gate-v1','practicas');
    localStorage.setItem('rtc-promo-v1','1');
  }catch(e){}});
  await prepara(c);
  const p=await c.newPage();
  p.on('pageerror',e=>errores.push('guía: '+e.message));
  await ir(p); await p.waitForTimeout(700);

  eq(await p.locator('#modo.palpita').count(),1,'guía: palpita "cambiar"');
  eq(await p.locator('.gopt.palpita').count(),0,'guía: aún no palpita ninguna opción');
  eq(await p.locator('#modo').evaluate(n=>getComputedStyle(n,'::after').content),'"Nuevo"',
     'guía: la píldora lleva la insignia Nuevo');
  cierto(await p.locator('#modo').evaluate(n=>getComputedStyle(n).animationName==='palpito'),
     'guía: la píldora tiene la animación de palpito');

  /* paso 2: al abrir el gate, el testigo pasa a Eventos */
  await p.click('#modo'); await p.waitForTimeout(400);
  eq(await p.locator('#modo.palpita').count(),0,'guía: "cambiar" deja de palpitar');
  eq(await p.locator('.gopt[data-g="eventos"].palpita').count(),1,'guía: ahora palpita Eventos');
  eq(await p.locator('.gopt.palpita').count(),1,'guía: solo palpita Eventos, ninguna otra opción');
  eq(await p.locator('.gopt[data-g="eventos"]').evaluate(n=>getComputedStyle(n,'::after').content),'"Nuevo"',
     'guía: la opción Eventos lleva la insignia');

  /* elegir sección la termina */
  await p.click('.gopt[data-g="eventos"]'); await p.waitForTimeout(400);
  eq(await p.locator('.palpita').count(),0,'guía: termina al elegir sección');
  eq(await p.textContent('#count'),ESPERADO.eventos+' eventos','guía: acaba en la vista de eventos');

  /* no vuelve: ni recargando, ni cambiando de sección otra vez */
  await recargar(p); await p.waitForTimeout(700);
  eq(await p.locator('.palpita').count(),0,'guía: no vuelve al recargar');
  await p.click('#modo'); await p.waitForTimeout(300);
  eq(await p.locator('.palpita').count(),0,'guía: no vuelve al abrir el gate de nuevo');
  await c.close();
}

/* ============ 3d. al usuario nuevo la guía no le aparece ============ */
{
  const {c,p}=await nueva();
  await ir(p); await p.waitForTimeout(500);
  eq(await p.locator('.palpita').count(),0,'guía: al nuevo no le palpita nada en la intro');
  await p.click('#empezar'); await p.waitForTimeout(300);
  eq(await p.locator('.gopt.palpita').count(),0,'guía: al nuevo no le palpita Eventos en el gate');
  await p.click('.gopt[data-g="practicas"]'); await p.waitForTimeout(400);
  eq(await p.locator('.palpita').count(),0,'guía: al nuevo no le palpita "cambiar"');
  eq(await p.evaluate(()=>localStorage.getItem('rtc-novedad-eventos-v1')),'1',
     'guía: al nuevo se le da por vista, no le saltará más adelante');
  await recargar(p); await p.waitForTimeout(700);
  eq(await p.locator('.palpita').count(),0,'guía: al nuevo tampoco al volver');
  await c.close();
}

/* ============ 4. seguimiento en ofertas, persistente ============ */
{
  const {c,p}=await nueva();
  await entrar(p,'practicas');
  eq(await p.textContent('#count'),ESPERADO.practicas+' ofertas','prácticas: contador');
  await p.locator('.seg-select').first().selectOption('entrevista'); await p.waitForTimeout(300);
  eq(await p.locator('.seg-select.v-entrevista').count(),1,'se marca la entrevista');
  await recargar(p); await p.waitForTimeout(600);
  eq(await p.locator('.seg-select.v-entrevista').count(),1,'la entrevista sobrevive a la recarga');
  await p.click('#row2 details[data-k="seg"] summary'); await p.waitForTimeout(150);
  cierto(/Entrevista\s*1/.test(await p.locator('#row2 details[data-k="seg"] .panel').textContent()),
     '"Tu candidatura" cuenta 1 entrevista');
  await c.close();
}

/* ============ 5. los 4 gates: etiquetas y cero fugas ============ */
{
  const {c,p}=await nueva();
  await entrar(p,'ambas');
  eq(await p.textContent('#count'),ESPERADO.todo+' resultados','Todo: cuenta "resultados" al mezclar');
  eq(await p.locator('#modo').textContent(),'Buscas: Todo · cambiar','Todo: etiqueta de cabecera');
  eq(await p.locator('.tag-evento').count(),ESPERADO.eventos,'Todo: los eventos se ven, etiquetados');
  eq(await p.locator('.seg-select').count(),ESPERADO.todo-ESPERADO.eventos,'Todo: solo las ofertas llevan seguimiento');
  for(const [g,etiqueta,n] of [['practicas','Prácticas',ESPERADO.practicas],['full','Contrato laboral',ESPERADO.full],
                               ['eventos','Eventos',ESPERADO.eventos]]){
    await p.click('#modo'); await p.waitForTimeout(200);
    await p.click(`.gopt[data-g="${g}"]`); await p.waitForTimeout(400);
    eq(await p.locator('#modo').textContent(),`Buscas: ${etiqueta} · cambiar`,`${g}: etiqueta de cabecera`);
    eq(await p.locator('.card').count(),n,`${g}: número de tarjetas`);
    const evs=await p.locator('.tag-evento').count();
    if(g==='eventos') eq(evs,n,'eventos: todas las tarjetas son eventos');
    else eq(evs,0,`${g}: cero eventos colados`);
  }
  await c.close();
}

/* ============ 6. en ofertas, "Más filtros" sigue quedándose abierto ============ */
{
  const {c,p}=await nueva();
  await entrar(p,'practicas');
  await p.click('#row2 details[data-k="mas"] summary'); await p.waitForTimeout(200);
  await p.click('#row2 details[data-k="mas"] .panel label.opt:has-text("Rolling")'); await p.waitForTimeout(350);
  eq(await p.locator('details.drop[data-k="mas"][open]').count(),1,'ofertas: "Más filtros" NO se cierra al marcar');
  await p.click('#row2 details[data-k="mas"] .panel label.opt:has-text("Fecha fija")'); await p.waitForTimeout(350);
  eq(await p.locator('details.drop[data-k="mas"][open]').count(),1,'ofertas: se pueden marcar varias seguidas');
  await c.close();
}

/* ============ 7. búsqueda ============ */
{
  const {c,p}=await nueva();
  await entrar(p,'eventos');
  await p.fill('#q','mckinsey'); await p.waitForTimeout(400);
  eq(await p.textContent('#count'),'3 eventos','búsqueda por organizador');
  await p.fill('#q','zzzz'); await p.waitForTimeout(400);
  cierto((await p.textContent('#list')).includes('No hay ningún evento'),'sin resultados: texto propio de eventos');
  await p.fill('#q',''); await p.waitForTimeout(400);
  eq(await p.textContent('#count'),ESPERADO.eventos+' eventos','se limpia la búsqueda');
  await c.close();
}

/* ============ 8. anchos de pantalla: nada se desborda ============ */
{
  for(const w of [320,360,390,430,768,1024,1280,1440]){
    const {c,p}=await nueva(w,900);
    await entrar(p,'eventos');
    eq(await p.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1),
       false,`${w}px: sin scroll horizontal`);
    await p.click('#row1 details[data-k="empresa"] summary').catch(()=>{});
    await p.waitForTimeout(200);
    eq(await p.evaluate(()=>{const e=document.querySelector('.panel');if(!e)return false;
      const r=e.getBoundingClientRect();return r.left<-1||r.right>innerWidth+1}),
       false,`${w}px: el panel de Organizador cabe en pantalla`);
    await p.click('#modo'); await p.waitForTimeout(250);
    eq(await p.evaluate(()=>document.querySelector('#gate .inner').getBoundingClientRect().top<-1),
       false,`${w}px: el gate de 4 opciones no se recorta por arriba`);
    await c.close();
  }
}

/* ============ 9. accesibilidad básica ============ */
{
  const {c,p}=await nueva();
  await entrar(p,'eventos');
  eq(await p.locator('.fav').evaluateAll(ns=>ns.filter(n=>!n.getAttribute('aria-label')).length),0,
     'todas las estrellas tienen aria-label');
  cierto((await p.locator('.fav').first().getAttribute('aria-label')).startsWith('Guardar evento'),
     'el aria-label de un evento dice "Guardar evento"');
  eq(await p.locator('#favbtn').getAttribute('aria-pressed'),'false','Guardados expone aria-pressed');
  const foco=[];
  for(let i=0;i<12;i++){await p.keyboard.press('Tab');
    foco.push(await p.evaluate(()=>document.activeElement.className||document.activeElement.id||document.activeElement.tagName))}
  cierto(foco.some(f=>/fav|drop/.test(String(f))||String(f)==='q'),'se llega a los controles con Tab');
  eq(await p.locator('.empresa a').first().getAttribute('rel'),'noopener','los enlaces llevan rel=noopener');
  await c.close();
}

/* ============ 10. modo privado: localStorage bloqueado ============ */
{
  const {c,p}=await nueva();
  await p.addInitScript(()=>{
    const boom=()=>{throw new DOMException('bloqueado','SecurityError')};
    Object.defineProperty(window,'localStorage',{get:()=>({getItem:boom,setItem:boom,removeItem:boom})});
  });
  await ir(p); await p.waitForTimeout(500);
  await p.click('#empezar').catch(()=>{}); await p.waitForTimeout(200);
  await p.click('.gopt[data-g="eventos"]'); await p.waitForTimeout(400);
  eq(await p.textContent('#count'),ESPERADO.eventos+' eventos','localStorage bloqueado: la app funciona igual');
  await p.locator('.fav').first().click(); await p.waitForTimeout(200);
  eq(await p.locator('.fav[aria-pressed="true"]').count(),1,'localStorage bloqueado: guardar funciona en memoria');
  await c.close();
}

/* ============ 11. datos.json caído → copia local ============ */
{
  const c=await navegador.newContext({viewport:{width:430,height:932}});
  await c.addInitScript(dat=>{try{
    localStorage.setItem('rtc-datos-v2',JSON.stringify(dat));
    localStorage.setItem('rtc-intro-v1','1');
    localStorage.setItem('rtc-gate-v1','eventos');
  }catch(e){}},TABLON);
  await prepara(c);
  await c.route('**/datos.json*',r=>r.abort());   /* pisa la ruta de prepara: aquí se quiere caído */
  const p=await c.newPage();
  p.on('pageerror',e=>errores.push('sin red: '+e.message));
  await ir(p); await p.waitForTimeout(700);
  eq(await p.textContent('#count'),ESPERADO.eventos+' eventos','datos.json caído: tira de la copia de localStorage');
  await c.close();
}

await navegador.close();
cerrar();
console.log(`\n${fallos.length?'✗':'✓'} navegador: ${ok} pasan, ${fallos.length} fallan`);
fallos.forEach(f=>console.log('   ✗ '+f));
console.log(errores.length
  ? '\n⚠ errores de JS en consola:\n  '+[...new Set(errores)].join('\n  ')
  : '✓ navegador: cero errores de JS en toda la sesión');
process.exit(fallos.length||errores.length?1:0);
