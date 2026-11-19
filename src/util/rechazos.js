"use strict";

// Errores de tipeo o de formato: no son un rechazo de seguridad ni de regla de negocio, no se registran.
const VALIDACION = new Set([
  "RUT_INVALIDO", "DATOS_INCOMPLETOS", "TELEFONO_INVALIDO", "CORREO_INVALIDO", "FECHA_INVALIDA", "RANGO_INVALIDO", "RANGO_MUY_LARGO",
  "HORARIO_INVALIDO", "SIN_DIAS", "NOTA_INVALIDA", "TIPO_INVALIDO", "ARCHIVO_INVALIDO", "ARCHIVO_MUY_GRANDE", "MOTIVO_REQUERIDO",
  "POLICLINICO_INVALIDO", "ESPECIALIDAD_INVALIDA", "RESPONSABLE_REQUERIDO", "RESPONSABLE_INCOMPLETO", "RESPONSABLE_RUT_INVALIDO",
  "RESULTADO_INVALIDO", "ORIGEN_INVALIDO", "SIN_PROFESIONALES",
  // Búsquedas que no encontraron nada (RUT mal escrito, registro inexistente): no son un rechazo.
  "PACIENTE_NO_ENCONTRADO", "CITA_NO_ENCONTRADA", "DOCUMENTO_NO_ENCONTRADO", "PROFESIONAL_NO_ENCONTRADO", "ESPERA_NO_ENCONTRADA",
]);
const TEXTO_DE_FORMULARIO = /^(Revisa|Completa|Indica|Selecciona|Escribe|Marca|Elige|Ingresa)\b/i;

const esValidacion = (mensaje) => VALIDACION.has(mensaje) || TEXTO_DE_FORMULARIO.test(String(mensaje || ""));
module.exports = { esValidacion, VALIDACION };
