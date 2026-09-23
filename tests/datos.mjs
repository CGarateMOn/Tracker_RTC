/* ---------------------------------------------------------------------
   Datos de prueba, en el formato CRUDO de la hoja (claves en español y
   con mayúsculas), que es justo lo que llega de Apps Script.

   Son fijos a propósito: datos.json lo reescribe la GitHub Action cada
   hora, así que ninguna prueba debe leerlo o los conteos cambiarían
   solos. Las fechas van relativas a hoy con dia(n), para que la suite no
   caduque.
--------------------------------------------------------------------- */
import {dia} from './entorno.mjs';

export const oferta=(o={})=>({
  ID:'RTC-0001', Empresa:'ACME', 'Descripción':'Puesto', 'Tipo de Oferta':'Prácticas',
  Estado:'Abierta', Ciudad:'Madrid', Link:'https://ejemplo.test/oferta', Deadline:dia(10),
  'Práctica':'Estrategia', Modalidad:'Summer', Curso:'Todos', 'Tipo de plazo':'Fecha fija', ...o});

export const evento=(o={})=>oferta({
  'Tipo de Oferta':'Evento', Modalidad:'On-line', 'Tipo de plazo':'', Curso:'', ...o});

export const respuesta=ofertas=>({actualizado:new Date().toISOString(), ofertas});

/* Tablón completo para las pruebas de navegador: 5 ofertas (una cerrada,
   una de auditoría que la app descarta) y 6 eventos de 3 organizadores,
   5 online y 1 presencial, en fechas conocidas y crecientes. */
export const TABLON=respuesta([
  oferta({ID:'O-1', Empresa:'McKinsey & Company', 'Descripción':'Business Analyst Intern',
          Ciudad:'Madrid Barcelona', Deadline:dia(12), 'Práctica':'Estrategia', Modalidad:'Summer'}),
  oferta({ID:'O-2', Empresa:'Deloitte', 'Descripción':'Consultoría Tecnológica',
          Ciudad:'Bilbao', Deadline:dia(40), 'Práctica':'Tecnología y AI', Modalidad:'Off-cycle'}),
  oferta({ID:'O-3', Empresa:'PwC', 'Descripción':'Strategy& Graduate', 'Tipo de Oferta':'Tiempo completo',
          Ciudad:'Madrid', Deadline:dia(30), 'Práctica':'Estrategia', Modalidad:'Entrada directa', Curso:''}),
  oferta({ID:'O-4', Empresa:'KPMG', 'Descripción':'Oferta ya cerrada', Estado:'Cerrada',
          Ciudad:'Madrid', Deadline:dia(-10), 'Práctica':'Estrategia'}),
  oferta({ID:'O-5', Empresa:'EY', 'Descripción':'Auditoría (la app la descarta)',
          Ciudad:'Madrid', 'Práctica':'Auditoría & Legal'}),

  evento({ID:'E-1', Empresa:'McKinsey & Company', 'Descripción':'International Students Meetup',
          Ciudad:'', Deadline:dia(15)}),
  evento({ID:'E-2', Empresa:'Bain & Company', 'Descripción':'Bain Breaks it Down - Virtual',
          Ciudad:'', Deadline:dia(22)}),
  evento({ID:'E-3', Empresa:'McKinsey & Company', 'Descripción':'Skills for Success - Europe',
          Ciudad:'', Deadline:dia(27)}),
  evento({ID:'E-4', Empresa:'McKinsey & Company', 'Descripción':'WomEngineering - Women matter',
          Ciudad:'', Deadline:dia(57)}),
  evento({ID:'E-5', Empresa:'Boston Consulting Group', 'Descripción':'Discover BCG online',
          Ciudad:'Madrid', Deadline:dia(59)}),
  evento({ID:'E-6', Empresa:'Boston Consulting Group', 'Descripción':'Discover BCG presencial',
          Ciudad:'', Deadline:dia(61), Modalidad:'En persona'}),
]);

/* lo que la app debe enseñar del TABLON, por vista */
export const ESPERADO={
  eventos:6,          /* los 6 eventos, todos futuros */
  practicas:2,        /* O-1 y O-2 (O-5 se descarta por auditoría) */
  full:1,             /* O-3 */
  todo:9,             /* 3 ofertas abiertas + 6 eventos (O-4 cerrada, O-5 descartada) */
  organizadores:['Bain & Company','Boston Consulting Group','McKinsey & Company'],
  /* eventos ordenados por fecha, que es como deben salir siempre */
  ordenEventos:['International Students Meetup','Bain Breaks it Down - Virtual','Skills for Success - Europe',
                'WomEngineering - Women matter','Discover BCG online','Discover BCG presencial'],
};
