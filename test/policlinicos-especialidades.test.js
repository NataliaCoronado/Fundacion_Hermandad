"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const { crearContenedor } = require("../src/armarAplicacion");
const { crearServidor } = require("../src/server");

async function sitio() {
  const c = crearContenedor();
  await c.inicializar();
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const r = await fetch(base + "/login", { method: "POST", redirect: "manual", body: new URLSearchParams({ correo: "admin@ejemplo.cl", clave: "demo1234" }) });
  const a = r.headers.get("set-cookie").split(";")[0];
  return { get: (ruta) => fetch(base + ruta, { headers: { Cookie: a } }).then((x) => x.text()), cerrar: () => new Promise((r) => srv.close(r)) };
}

test("Policlínicos: las especialidades van como chips (máx. 3 visibles) con el resto plegado", async () => {
  const s = await sitio();
  try {
    const h = await s.get("/admin/policlinicos");
    const tarjetas = h.match(/<article class="work-panel location"[\s\S]*?<\/article>/g);
    assert.ok(tarjetas.length >= 6);
    let conResto = 0;
    for (const t of tarjetas) {
      assert.doesNotMatch(t, /<p>[^<]* · [^<]*<\/p>/, "sin lista en texto plano");
      assert.ok(((t.match(/<li class="esp-chip">/g) || []).length) <= 3 + (t.match(/class="esp-mas"[\s\S]*?<\/details>/)?.[0].match(/<li class="esp-chip">/g) || []).length);
      const visibles = t.replace(/<details class="esp-mas">[\s\S]*?<\/details>/, "").match(/<li class="esp-chip">/g) || [];
      assert.ok(visibles.length <= 3, "máx. 3 chips visibles");
      if (/<details class="esp-mas"><summary>\+\d+ más<\/summary>/.test(t)) conResto++;
    }
    assert.ok(conResto > 0, "al menos una tarjeta pliega el resto");
  } finally { await s.cerrar(); }
});
