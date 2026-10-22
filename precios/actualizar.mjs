// Descarga el último precio en euros de cada activo de activos.json (fuente: justETF, por ISIN)
// y escribe precios.json. Si un activo falla, conserva el último precio bueno que había.
// Uso: node precios/actualizar.mjs <precios-anteriores.json> <salida.json>
import { readFile, writeFile } from 'node:fs/promises';

const [previoPath, salidaPath] = process.argv.slice(2);
if (!salidaPath) { console.error('Uso: node actualizar.mjs <previo.json> <salida.json>'); process.exit(2); }

const { activos } = JSON.parse(await readFile(new URL('./activos.json', import.meta.url), 'utf8'));
let previo = {};
try { previo = JSON.parse(await readFile(previoPath, 'utf8')); } catch { previo = {}; }
const anteriores = (previo && previo.precios) || {};

const ISIN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function cotizacion(isin) {
  const url = `https://www.justetf.com/api/etfs/${isin}/quote?locale=es&currency=EUR&isin=${isin}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'APP-AHORRO (uso personal, una consulta por activo cada 15 minutos)' },
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  const precio = j && j.latestQuote && Number(j.latestQuote.raw);
  if (!(precio > 0)) throw new Error('respuesta sin precio');
  return {
    precio,
    fecha: j.latestQuoteDate || null,
    mercado: j.quoteTradingVenue || null,
    cambioDia: j.dtdPrc && Number.isFinite(Number(j.dtdPrc.raw)) ? Number(j.dtdPrc.raw) : null
  };
}

const salida = { actualizado: new Date().toISOString(), fuente: 'justETF', moneda: 'EUR', precios: {} };
let ok = 0;
for (const a of activos) {
  const isin = String(a.isin || '').trim().toUpperCase();
  if (!ISIN.test(isin)) { console.warn(`ISIN no válido, se salta: ${a.isin}`); continue; }
  try {
    salida.precios[isin] = { nombre: a.nombre || '', ...(await cotizacion(isin)) };
    ok++;
    console.log(`${isin} ${salida.precios[isin].precio} € (${salida.precios[isin].mercado}, ${salida.precios[isin].fecha})`);
  } catch (e) {
    console.warn(`${isin}: ${e.message}`);
    if (anteriores[isin]) salida.precios[isin] = { ...anteriores[isin], viejo: true };
  }
  await espera(800);
}

if (!ok) {
  console.error('No se pudo descargar ningún precio. Se mantienen los anteriores.');
  if (previo && previo.precios) { await writeFile(salidaPath, JSON.stringify(previo, null, 2) + '\n'); process.exit(0); }
  process.exit(1);
}
await writeFile(salidaPath, JSON.stringify(salida, null, 2) + '\n');
console.log(`Precios actualizados: ${ok} de ${activos.length}`);
