'use strict';
const encolar = (c, fn) => {
  const previa = c.colaMutacion || Promise.resolve();
  const p = previa.then(fn);
  c.colaMutacion = p.catch(() => {});
  return p;
};

async function ejecutarCiclo(c) {
  const bot = process.env.BOT_WHATSAPP === '1' ? await c.bot.procesar() : null;
  const bandeja = await c.despachador.procesar();
  const hubo = (bot && (bot.enviados || bot.omitidos || bot.errores)) || bandeja.enviados || bandeja.simulados || bandeja.errores || bandeja.reintentos;
  if (hubo) c.guardar();
  return { bot, bandeja, hubo: Boolean(hubo) };
}

function iniciarAutomaticos(c, { cadaMs = 60_000, log = console.log } = {}) {
  if (process.env.MENSAJES_AUTOMATICOS === '0') return null;
  const temporizador = setInterval(() => {
    encolar(c, () => ejecutarCiclo(c)).then((r) => {
      if (r.hubo) log(`Mensajes automáticos: ${JSON.stringify(r)}`);
    }).catch((e) => console.error('Mensajes automáticos:', e));
  }, cadaMs);
  temporizador.unref();
  return temporizador;
}
module.exports = { iniciarAutomaticos, ejecutarCiclo };
