'use strict';
const vistas = require('../views/paciente');
const { normalizarRut } = require('../util/rut');
const { error, ok } = require('./mensajes');
const { cargarContexto, detalleCita } = require('./contexto');
const { crearLimitador } = require('../util/limitador');
const { infoSede } = require('../models/sedesInfo');

const LIMITE = 5;            // intentos por minuto y por cliente (protección básica contra enumeración, RNF03)
const VENTANA_MS = 60_000;

function crearPacienteController({ citaRepo, catalogo, encuestas, cuentas }) {
  const limitar = crearLimitador(VENTANA_MS);
  const excedido = (ip) => limitar(ip, LIMITE);
  return {
    formulario: ({ usuario }) => ({ html: vistas.formulario(null, usuario) }),
    consultar: async ({ cuerpo, ip, usuario }) => {
      if (excedido(ip)) return { estado: 429, html: vistas.formulario({ bloqueado: true }, usuario) };
      // Verificación de acceso: RUT + fecha de nacimiento + últimos 4 dígitos del celular registrado.
      // Si algo no coincide (o el RUT no existe) se responde lo mismo, sin revelar qué dato falló.
      // La misma verificación del portal: además del límite por cliente, bloquea el RUT tras fallos repetidos.
      const rut = normalizarRut(cuerpo.rut);
      const verificado = await cuentas.verificarIdentidad({ rut, fechaNacimiento: cuerpo.fechaNacimiento, celular4: cuerpo.celular4 });
      if (!verificado) return { html: vistas.formulario({ noVerificado: true }, usuario) };
      const ctx = await cargarContexto(catalogo);
      const citas = (await citaRepo.buscarPorRut(rut))
        .filter((c) => c.estadoReserva === 'ACTIVA')
        .map((c) => { const d = detalleCita(c, ctx); return { fecha: d.b?.fecha, hora: d.b?.hora, policlinico: d.pol?.nombre, whatsapp: d.pol && infoSede(d.pol.id)?.whatsapp, especialidad: d.prof?.especialidad, profesional: (d.reemplazo || d.prof)?.nombre, confirmada: c.estadoConfirmacion === 'CONFIRMADA' }; });
      return { html: vistas.formulario({ citas }, usuario) };
    },
    ayuda: async ({ usuario }) => ({ html: vistas.ayuda(usuario, await catalogo.policlinicos()) }),
    privacidad: ({ usuario }) => ({ html: vistas.privacidad(usuario) }),
    encuesta: ({ usuario }) => ({ html: vistas.encuesta({ usuario }) }),
    responderEncuesta: async ({ cuerpo, ip, usuario }) => {
      if (excedido(ip)) return { estado: 429, html: vistas.encuesta({ mensaje: { tipo: 'error', texto: 'Demasiados intentos. Espera un minuto.' }, usuario }) };
      try {
        await encuestas.registrar(cuerpo);
        return { html: vistas.encuesta({ mensaje: ok('Gracias por responder.'), usuario }) };
      } catch (e) { return { html: vistas.encuesta({ mensaje: error(e), usuario }) }; }
    },
  };
}
module.exports = { crearPacienteController };
