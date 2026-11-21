'use strict';
const MENSAJES = {
  PACIENTE_NO_ENCONTRADO: 'No encontramos un paciente con ese RUT. Crea primero su ficha en «Pacientes».',
  BLOQUE_NO_DISPONIBLE: 'Ese cupo ya no está disponible. Elige otro horario.',
  BLOQUE_OCUPADO: 'Ese cupo ya fue reservado por otra cita. Elige otro horario.',
  BLOQUE_DUPLICADO: 'Ya existe un cupo para ese profesional, fecha y hora. Cambia alguno de los tres datos.',
  SIN_AGENDA: 'Ese profesional no tiene una agenda vigente para esa fecha. Elige otra fecha u otro profesional.',
  FUERA_DE_SEDE: 'Ese cupo pertenece a otro policlínico. Elige uno de tu policlínico.',
  CITA_NO_ENCONTRADA: 'No encontramos esa cita. Actualiza la página e inténtalo de nuevo.',
  CITA_NO_ACTIVA: 'Esa cita ya no está activa, así que no se puede modificar.',
  RESULTADO_INVALIDO: 'Elige un resultado de contacto de la lista.',
  RUT_INVALIDO: 'Revisa el RUT: escríbelo con guion y dígito verificador, por ejemplo 12345678-5.',
  DATOS_INCOMPLETOS: 'Completa todos los campos obligatorios.',
  TELEFONO_INVALIDO: 'Revisa el teléfono: debe tener entre 8 y 15 dígitos y puede comenzar con +.',
  CORREO_INVALIDO: 'Revisa el correo: debe tener un formato como nombre@dominio.cl.',
  FECHA_INVALIDA: 'Revisa la fecha de nacimiento: no es una fecha válida.',
  RESPONSABLE_REQUERIDO: 'El paciente es menor de 18 años: registra a su adulto responsable.',
  RESPONSABLE_INCOMPLETO: 'Completa los cuatro datos del adulto responsable (nombre, relación, RUT y teléfono) o deja los cuatro vacíos.',
  RESPONSABLE_RUT_INVALIDO: 'Revisa el RUT del adulto responsable: escríbelo con guion y dígito verificador.',
  ARCHIVO_INVALIDO: 'Ese tipo de archivo no se puede adjuntar. Sube un PDF, JPG o PNG.',
  ARCHIVO_MUY_GRANDE: 'El archivo pesa más de 5 MB. Sube uno más liviano.',
  SIN_ARCHIVO: 'Ese documento no tiene un archivo adjunto.',
  RANGO_INVALIDO: 'Revisa las fechas: «desde» no puede ser posterior a «hasta».',
  RANGO_MUY_LARGO: 'El rango es demasiado largo: programa hasta 4 meses o 1.000 cupos a la vez.',
  HORARIO_INVALIDO: 'Revisa el horario: la hora de término debe ser posterior a la de inicio y cada cupo dura entre 10 y 120 minutos.',
  SIN_DIAS: 'Marca al menos un día de la semana.',
  SIN_PROFESIONALES: 'No hay profesionales activos que coincidan con esa selección. Prueba con otra.',
  CONSENTIMIENTO_REQUERIDO: 'Falta el consentimiento del paciente.',
  PACIENTE_EXISTE: 'Ya existe una ficha con ese RUT.',
  YA_EN_ESPERA: 'El paciente ya está en la lista de espera para esa sede y especialidad.',
  ESPERA_NO_ENCONTRADA: 'La solicitud de espera no existe o ya no está vigente.',
  POLICLINICO_INVALIDO: 'Elige un policlínico de la lista.',
  ESPECIALIDAD_INVALIDA: 'Elige una especialidad de la lista.',
  ESPECIALIDAD_SIN_LISTA: 'Esa especialidad no tiene lista de espera. Administración puede activarla en «Policlínicos y especialidades».',
  ESPECIALIDAD_NO_EN_SEDE: 'Esa especialidad no se atiende en ese policlínico.',
  TIPO_INVALIDO: 'Elige un tipo de documento de la lista.',
  DOCUMENTO_NO_ENCONTRADO: 'No encontramos ese documento. Actualiza la página e inténtalo de nuevo.',
  PROFESIONAL_NO_ENCONTRADO: 'No encontramos a ese profesional. Actualiza la página e inténtalo de nuevo.',
  MOTIVO_REQUERIDO: 'Indica el motivo para poder continuar.',
  REEMPLAZO_IGUAL: 'El reemplazante debe ser otro profesional.',
  REEMPLAZO_NO_COMPATIBLE: 'El reemplazante debe estar activo y ser de la misma especialidad y sede.',
  NOTA_INVALIDA: 'Elige una nota de 1 a 5.',
  SIN_ATENCION: 'Aún no hay una atención registrada para responder la encuesta. Podrás hacerlo después de tu atención.',
  YA_RESPONDIDA: 'Ya respondiste la encuesta de tu última atención.',
  YA_RESPONDIDA_AGENDAMIENTO: 'Ya respondiste la encuesta de esta reserva.',
  CREDENCIALES_INVALIDAS: 'Correo o contraseña incorrectos. Revisa los datos e inténtalo de nuevo.',
  DEMASIADOS_INTENTOS: 'Hiciste demasiados intentos. Espera unos minutos y vuelve a probar.',
  WHATSAPP_NO_CONFIGURADO: 'WhatsApp real aún no está configurado.',
};
const legible = (m) => /\s/.test(String(m || '')) && !/^\w+Error\b|is not|undefined|Cannot /.test(m);
const error = (e) => {
  require('../herramientas/contextoSolicitud').actual()?.registrarRechazo?.(e);
  if (MENSAJES[e.message]) return { tipo: 'error', texto: MENSAJES[e.message] };
  if (legible(e.message)) return { tipo: 'error', texto: e.message };
  console.error(e);
  // Conserva «Ocurrió un error inesperado»: las pruebas de humo y e2e lo usan para detectar fallas.
  return { tipo: 'error', texto: 'Ocurrió un error inesperado y no se completó la acción. Inténtalo de nuevo en unos minutos.' };
};
const ok = (texto) => ({ tipo: 'ok', texto });
module.exports = { error, ok, MENSAJES };
