'use strict';
const A = require('./soporte');
(async () => {
  A.fs.rmSync(A.SALIDA, { recursive: true, force: true }); A.fs.mkdirSync(A.SALIDA, { recursive: true });
  const { c, srv } = await A.levantar();
  const browser = await A.chromium.launch({ executablePath: process.env.CHROME_PW || undefined, channel: process.env.CHROME_PW ? undefined : 'chrome', headless: true });
  const modulos = (process.argv[2] ? process.argv[2].split(',') : ['portal']);
  const registros = [];
  for (const m of modulos) registros.push(...(await require(`./${m}`)({ browser, c })));
  await browser.close(); srv.close();
  A.fs.writeFileSync(A.path.join(A.SALIDA, 'resultados.json'), JSON.stringify({ resultados: A.resultados, registros }, null, 2));
  for (const r of A.resultados) console.log(`${r.estado === 'aprobado' ? 'OK ' : r.estado === 'fallido' ? 'FALLA' : '??  '} [${r.flujo}] ${r.paso}${r.detalle ? ' — ' + r.detalle : ''}`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
