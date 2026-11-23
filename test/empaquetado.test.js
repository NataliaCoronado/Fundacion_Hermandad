"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const raiz = path.join(__dirname, "..");
const leer = (f) => fs.readFileSync(path.join(raiz, f), "utf8");

test("Dockerfile: la imagen es de producción, no corre como root y trae los scripts", () => {
  const d = leer("Dockerfile");
  assert.match(d, /^ENV NODE_ENV=production$/m);
  assert.match(d, /^COPY scripts \.\/scripts$/m, "crear-admin y respaldo necesitan scripts/ dentro de la imagen");
  assert.match(d, /^USER node$/m);
  assert.match(d, /^HEALTHCHECK /m);
  const usuario = d.indexOf("USER node");
  assert.ok(d.indexOf("chown") !== -1 && d.indexOf("chown") < usuario, "datos/ debe pertenecer al usuario node antes de cambiar de usuario");
  assert.ok(d.indexOf("CMD") > usuario, "el proceso arranca ya como node");
});

test("Dockerfile: todo lo que usan los scripts de package.json está en la imagen", () => {
  const d = leer("Dockerfile");
  const copiado = [...d.matchAll(/^COPY (\S+) /gm)].map((m) => m[1]);
  for (const [nombre, orden] of Object.entries(require("../package.json").scripts)) {
    const archivo = orden.match(/node (?:--[\w=-]+ )*(\S+\.js)/)?.[1];
    if (!archivo || !["crear-admin", "respaldo", "restaurar", "start"].includes(nombre)) continue;
    assert.ok(copiado.some((c) => archivo === c || archivo.startsWith(`${c.replace(/^\.\//, "").replace(/\/$/, "")}/`)), `${nombre}: ${archivo} no se copia a la imagen`);
  }
});

test("README: documenta el primer administrador y las variables de producción", () => {
  const r = leer("README.md");
  for (const termino of ["crear-admin", "NODE_ENV=production", "COOKIE_SECURE", "DATOS_DEMO", "POSTGRES_PASSWORD", "TRUST_PROXY"])
    assert.ok(r.includes(termino), `el README no menciona ${termino}`);
  assert.ok(!/La imagen Docker aún no incluye el script/.test(r), "texto desactualizado sobre el script de respaldo");
});
