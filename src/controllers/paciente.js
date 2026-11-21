'use strict';
const vistas = require('../views/paciente');
const { normalizarRut } = require('../herramientas/rut');
const { error, ok } = require('./mensajesDeError');
const { cargarContexto, detalleCita } = require('./cargarListasBase');
const { crearLimitador } = require('../herramientas/limitador');
const { infoSede } = require('../models/informacionDeSedes');

const LIMITE = 5;
const VENTANA_MS = 60_000;

function crearControladorPaciente({ citaRepo, catalogo, encuestas, cuentas }) {
  const limitar = crearLimitador(VENTANA_MS);
  const excedido = (ip) => limitar(ip, LIMITE);
  return {
    formulario: ({ usuario }) => ({ html: vistas.formulario(null, usuario) }),
    consultar: async ({ cuerpo, ip, usuario }) => {
      if (excedido(ip)) return { estado: 429, html: vistas.formulario({ bloqueado: true }, usuario) };
      const rut = normalizarRut(cuerpo.rut);
      const verificado = await cuentas.verificarIdentidad({ rut, fechaNacimiento: cuerpo.fechaNacimiento, celular4: cuerpo.celular4 });
      if (!verificado) return { html: vistas.formulario({ noVerificado: true }, usuario) };
      const ctx = await cargarContexto(catalogo);
      const citas = (await citaRepo.buscarPorRut(rut))
        .filter((c) => c.estadoReserva === 'ACTIVA')
        .map((c) => { const detalle = detalleCita(c, ctx); return { fecha: detalle.b?.fecha, hora: detalle.b?.hora, policlinico: detalle.pol?.nombre, whatsapp: detalle.pol && infoSede(detalle.pol.id)?.whatsapp, especialidad: detalle.prof?.especialidad, profesional: (detalle.reemplazo || detalle.prof)?.nombre, confirmada: c.estadoConfirmacion === 'CONFIRMADA' }; });
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
module.exports = { crearControladorPaciente };
