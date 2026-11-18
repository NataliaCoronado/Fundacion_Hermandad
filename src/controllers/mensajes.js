'use strict';
// Texto para el usuario según el código de error de negocio. Nada técnico se muestra en pantalla.
const MENSAJES = {
  PACIENTE_NO_ENCONTRADO: 'No existe un paciente con ese RUT. Crea primero su ficha en «Pacientes».',
  BLOQUE_NO_DISPONIBLE: 'El cupo no está disponible.',
  BLOQUE_OCUPADO: 'Ese cupo ya fue reservado por otra cita. Elige otro.',
  BLOQUE_DUPLICADO: 'Ya existe un bloque para ese profesional, fecha y hora.',
  SIN_AGENDA: 'Ese profesional no tiene una agenda vigente para esa fecha.',
  FUERA_DE_SEDE: 'Ese cupo es de otro policlínico distinto al tuyo.',
  CITA_NO_ENCONTRADA: 'La cita no existe.',
  CITA_NO_ACTIVA: 'La cita no está activa.',
  RESULTADO_INVALIDO: 'Resultado de contacto inválido.',
  RUT_INVALIDO: 'El RUT no es válido. Usa el formato 11111111-1.',
  DATOS_INCOMPLETOS: 'Completa todos los campos obligatorios.',
  TELEFONO_INVALIDO: 'El teléfono no es válido (8 a 15 dígitos, puede llevar +).',
  CORREO_INVALIDO: 'El correo no es válido.',
  FECHA_INVALIDA: 'La fecha de nacimiento no es válida.',
  RESPONSABLE_REQUERIDO: 'El paciente es menor de 18 años: registra a su adulto responsable.',
  RESPONSABLE_INCOMPLETO: 'Completa los cuatro datos del adulto responsable (nombre, relación, RUT y teléfono) o déjalos todos vacíos.',
  RESPONSABLE_RUT_INVALIDO: 'El RUT del adulto responsable no es válido.',
  ARCHIVO_INVALIDO: 'El archivo debe ser PDF, JPG o PNG.',
  ARCHIVO_MUY_GRANDE: 'El archivo supera el máximo de 5 MB.',
  SIN_ARCHIVO: 'Ese documento no tiene un archivo adjunto.',
  RANGO_INVALIDO: 'Revisa las fechas: «desde» no puede ser posterior a «hasta».',
  RANGO_MUY_LARGO: 'El rango es demasiado largo: programa hasta 4 meses o 1.000 cupos a la vez.',
  HORARIO_INVALIDO: 'Revisa el horario: la hora de término debe ser posterior a la de inicio y cada cupo dura entre 10 y 120 minutos.',
  SIN_DIAS: 'Marca al menos un día de la semana.',
  SIN_PROFESIONALES: 'No hay profesionales activos que coincidan con esa selección.',
  CONSENTIMIENTO_REQUERIDO: 'Falta el consentimiento del paciente.',
  PACIENTE_EXISTE: 'Ya existe una ficha con ese RUT.',
  YA_EN_ESPERA: 'El paciente ya está en la lista de espera para esa sede y especialidad.',
  ESPERA_NO_ENCONTRADA: 'La solicitud de espera no existe o ya no está vigente.',
  POLICLINICO_INVALIDO: 'Policlínico inválido.',
  ESPECIALIDAD_INVALIDA: 'Especialidad inválida.',
  ESPECIALIDAD_NO_EN_SEDE: 'Esa especialidad no se atiende en ese policlínico.',
  TIPO_INVALIDO: 'Tipo de documento inválido.',
  DOCUMENTO_NO_ENCONTRADO: 'El documento no existe.',
  PROFESIONAL_NO_ENCONTRADO: 'El profesional no existe.',
  MOTIVO_REQUERIDO: 'Indica el motivo.',
  REEMPLAZO_IGUAL: 'El reemplazante debe ser otro profesional.',
  REEMPLAZO_NO_COMPATIBLE: 'El reemplazante debe estar activo y ser de la misma especialidad y sede.',
  NOTA_INVALIDA: 'La nota debe ser de 1 a 5.',
  SIN_ATENCION: 'No encontramos una atención registrada para responder la encuesta.',
  YA_RESPONDIDA: 'Ya respondiste la encuesta de tu última atención.',
  CREDENCIALES_INVALIDAS: 'Correo o contraseña incorrectos.',
  DEMASIADOS_INTENTOS: 'Demasiados intentos. Espera unos minutos.',
  WHATSAPP_NO_CONFIGURADO: 'WhatsApp real aún no está configurado.',
};
// Los códigos (SIN_ESPACIOS) se traducen; los mensajes ya redactados para la persona se muestran tal cual.
const legible = (m) => /\s/.test(String(m || '')) && !/^\w+Error\b|is not|undefined|Cannot /.test(m);
const error = (e) => {
  if (MENSAJES[e.message]) return { tipo: 'error', texto: MENSAJES[e.message] };
  if (legible(e.message)) return { tipo: 'error', texto: e.message };
  console.error(e);
  return { tipo: 'error', texto: 'Ocurrió un error inesperado.' };
};
const ok = (texto) => ({ tipo: 'ok', texto });
module.exports = { error, ok, MENSAJES };
