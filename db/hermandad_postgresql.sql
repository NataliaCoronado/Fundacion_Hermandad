CREATE OR REPLACE FUNCTION fn_rut_valido(p_rut TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
	v_num TEXT;
	v_dv TEXT;
	v_sum INTEGER := 0;
	v_expected INTEGER;
	i INTEGER;
BEGIN
	IF p_rut !~ '^[0-9]{7,8}-[0-9K]$' THEN
    	RETURN FALSE;
	END IF;
	v_num := split_part(p_rut, '-', 1);
	v_dv := split_part(p_rut, '-', 2);
	FOR i IN REVERSE length(v_num)..1 LOOP
    	v_sum := v_sum + substring(v_num from i for 1)::INTEGER
                     	* (2 + ((length(v_num) - i) % 6));
	END LOOP;
	v_expected := (11 - (v_sum % 11)) % 11;
	RETURN v_dv = CASE WHEN v_expected = 10 THEN 'K' ELSE v_expected::TEXT END;
END;
$$;
 
CREATE TABLE rol (
	id_rol  SMALLINT GENERATED ALWAYS AS IDENTITY,
	codigo  VARCHAR(20) NOT NULL,
	nombre  VARCHAR(60) NOT NULL,
	CONSTRAINT pk_rol PRIMARY KEY (id_rol),
	CONSTRAINT uq_rol_codigo UNIQUE (codigo),
	CONSTRAINT ck_rol_codigo CHECK (codigo IN ('TENS_TONS', 'TELEMEDICINA', 'ADMINISTRACION'))
);
 
CREATE TABLE permiso (
	id_permiso   SMALLINT GENERATED ALWAYS AS IDENTITY,
	codigo       VARCHAR(40) NOT NULL,
	descripcion  VARCHAR(150) NOT NULL,
	CONSTRAINT pk_permiso PRIMARY KEY (id_permiso),
	CONSTRAINT uq_permiso_codigo UNIQUE (codigo)
);
 
CREATE TABLE rol_permiso (
	id_rol      SMALLINT NOT NULL,
	id_permiso  SMALLINT NOT NULL,
	CONSTRAINT pk_rol_permiso PRIMARY KEY (id_rol, id_permiso),
	CONSTRAINT fk_rol_permiso_id_rol FOREIGN KEY (id_rol)
    	REFERENCES rol (id_rol) ON DELETE CASCADE,
	CONSTRAINT fk_rol_permiso_id_permiso FOREIGN KEY (id_permiso)
    	REFERENCES permiso (id_permiso) ON DELETE CASCADE
);
 
CREATE TABLE comuna (
	id_comuna  SMALLINT GENERATED ALWAYS AS IDENTITY,
	nombre     VARCHAR(60) NOT NULL,
	region     VARCHAR(60) NOT NULL,
	CONSTRAINT pk_comuna PRIMARY KEY (id_comuna),
	CONSTRAINT uq_comuna_nombre_region UNIQUE (nombre, region)
);
 
CREATE TABLE especialidad (
	id_especialidad  SMALLINT GENERATED ALWAYS AS IDENTITY,
	nombre       	VARCHAR(60) NOT NULL,
	requiere_orden   BOOLEAN NOT NULL DEFAULT FALSE,
	activo       	BOOLEAN NOT NULL DEFAULT TRUE,
	CONSTRAINT pk_especialidad PRIMARY KEY (id_especialidad),
	CONSTRAINT uq_especialidad_nombre UNIQUE (nombre)
);
 
CREATE TABLE policlinico (
	id_policlinico   SMALLINT GENERATED ALWAYS AS IDENTITY,
	nombre       	VARCHAR(80) NOT NULL,
	direccion    	VARCHAR(150),
	id_comuna    	SMALLINT,
	correo       	VARCHAR(120) NOT NULL,
	whatsapp     	VARCHAR(15) NOT NULL,
	telefono     	VARCHAR(15),
	es_telemedicina  BOOLEAN NOT NULL DEFAULT FALSE,
	activo       	BOOLEAN NOT NULL DEFAULT TRUE,
	CONSTRAINT pk_policlinico PRIMARY KEY (id_policlinico),
	CONSTRAINT uq_policlinico_nombre UNIQUE (nombre),
	CONSTRAINT fk_policlinico_id_comuna FOREIGN KEY (id_comuna)
    	REFERENCES comuna (id_comuna) ON DELETE RESTRICT,
	CONSTRAINT ck_policlinico_presencial CHECK (es_telemedicina OR (direccion IS NOT NULL AND id_comuna IS NOT NULL)),
	CONSTRAINT ck_policlinico_correo CHECK (correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
	CONSTRAINT ck_policlinico_whatsapp CHECK (whatsapp ~ '^\+?[0-9]{8,15}$')
);
 
CREATE TABLE policlinico_especialidad (
	id_policlinico   SMALLINT NOT NULL,
	id_especialidad  SMALLINT NOT NULL,
	visible_web  	BOOLEAN NOT NULL DEFAULT TRUE,
	whatsapp_agenda  VARCHAR(15),
	activo       	BOOLEAN NOT NULL DEFAULT TRUE,
	CONSTRAINT pk_policlinico_especialidad PRIMARY KEY (id_policlinico, id_especialidad),
	CONSTRAINT fk_policlinico_especialidad_id_policlinico FOREIGN KEY (id_policlinico)
    	REFERENCES policlinico (id_policlinico) ON DELETE CASCADE,
	CONSTRAINT fk_policlinico_especialidad_id_especialidad FOREIGN KEY (id_especialidad)
    	REFERENCES especialidad (id_especialidad) ON DELETE RESTRICT
);
 
CREATE TABLE usuario (
	id_usuario  	UUID NOT NULL DEFAULT gen_random_uuid(),
	nombres     	VARCHAR(80) NOT NULL,
	apellidos   	VARCHAR(80) NOT NULL,
	correo      	VARCHAR(120) NOT NULL,
	id_rol      	SMALLINT NOT NULL,
	id_policlinico  SMALLINT,
	activo      	BOOLEAN NOT NULL DEFAULT TRUE,
	creado_en   	TIMESTAMPTZ NOT NULL DEFAULT now(),
	CONSTRAINT pk_usuario PRIMARY KEY (id_usuario),
	CONSTRAINT uq_usuario_correo UNIQUE (correo),
	CONSTRAINT fk_usuario_id_rol FOREIGN KEY (id_rol)
    	REFERENCES rol (id_rol) ON DELETE RESTRICT,
	CONSTRAINT fk_usuario_id_policlinico FOREIGN KEY (id_policlinico)
    	REFERENCES policlinico (id_policlinico) ON DELETE RESTRICT,
	CONSTRAINT ck_usuario_correo CHECK (correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
CREATE INDEX ix_usuario_policlinico ON usuario (id_policlinico);
 
CREATE TABLE profesional (
	id_profesional     	BIGINT GENERATED ALWAYS AS IDENTITY,
	rut                	VARCHAR(12) NOT NULL,
	nombres            	VARCHAR(80) NOT NULL,
	apellidos          	VARCHAR(80) NOT NULL,
	correo_institucional   VARCHAR(120) NOT NULL,
	telefono           	VARCHAR(15),
	telefono_videollamada  VARCHAR(15),
	foto_url           	TEXT,
	activo             	BOOLEAN NOT NULL DEFAULT TRUE,
	creado_en          	TIMESTAMPTZ NOT NULL DEFAULT now(),
	CONSTRAINT pk_profesional PRIMARY KEY (id_profesional),
	CONSTRAINT uq_profesional_rut UNIQUE (rut),
	CONSTRAINT uq_profesional_correo_institucional UNIQUE (correo_institucional),
	CONSTRAINT ck_profesional_rut CHECK (fn_rut_valido(rut)),
	CONSTRAINT ck_profesional_correo CHECK (correo_institucional ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
 
CREATE TABLE profesional_asignacion (
	id_profesional   BIGINT NOT NULL,
	id_policlinico   SMALLINT NOT NULL,
	id_especialidad  SMALLINT NOT NULL,
	activo       	BOOLEAN NOT NULL DEFAULT TRUE,
	CONSTRAINT pk_profesional_asignacion PRIMARY KEY (id_profesional, id_policlinico, id_especialidad),
	CONSTRAINT fk_profesional_asignacion_id_profesional FOREIGN KEY (id_profesional)
    	REFERENCES profesional (id_profesional) ON DELETE CASCADE,
	CONSTRAINT fk_profesional_asignacion_policlinico_especialidad FOREIGN KEY (id_policlinico, id_especialidad)
    	REFERENCES policlinico_especialidad (id_policlinico, id_especialidad) ON DELETE RESTRICT
);
 
CREATE TABLE agenda (
	id_agenda       	BIGINT GENERATED ALWAYS AS IDENTITY,
	id_profesional  	BIGINT NOT NULL,
	id_policlinico  	SMALLINT NOT NULL,
	id_especialidad 	SMALLINT NOT NULL,
	vigente_desde   	DATE NOT NULL,
	vigente_hasta   	DATE NOT NULL,
	hora_inicio     	TIME NOT NULL,
	hora_termino    	TIME NOT NULL,
	duracion_min    	SMALLINT NOT NULL,
	estado_publicacion  VARCHAR(12) NOT NULL DEFAULT 'BORRADOR',
	creado_por      	UUID NOT NULL,
	creado_en       	TIMESTAMPTZ NOT NULL DEFAULT now(),
	CONSTRAINT pk_agenda PRIMARY KEY (id_agenda),
	CONSTRAINT fk_agenda_profesional_asignacion FOREIGN KEY (id_profesional, id_policlinico, id_especialidad)
    	REFERENCES profesional_asignacion (id_profesional, id_policlinico, id_especialidad) ON DELETE RESTRICT,
	CONSTRAINT fk_agenda_creado_por FOREIGN KEY (creado_por)
    	REFERENCES usuario (id_usuario) ON DELETE RESTRICT,
	CONSTRAINT ck_agenda_horas CHECK (hora_termino > hora_inicio),
	CONSTRAINT ck_agenda_vigencia CHECK (vigente_hasta >= vigente_desde),
	CONSTRAINT ck_agenda_duracion CHECK (duracion_min BETWEEN 10 AND 120),
	CONSTRAINT ck_agenda_estado CHECK (estado_publicacion IN ('BORRADOR', 'PUBLICADA', 'OCULTA'))
);
CREATE INDEX ix_agenda_profesional ON agenda (id_profesional);
CREATE INDEX ix_agenda_sede_especialidad ON agenda (id_policlinico, id_especialidad);
 
CREATE TABLE agenda_dia (
	id_agenda   BIGINT NOT NULL,
	dia_semana  SMALLINT NOT NULL,
	CONSTRAINT pk_agenda_dia PRIMARY KEY (id_agenda, dia_semana),
	CONSTRAINT fk_agenda_dia_id_agenda FOREIGN KEY (id_agenda)
    	REFERENCES agenda (id_agenda) ON DELETE CASCADE,
	CONSTRAINT ck_agenda_dia CHECK (dia_semana BETWEEN 1 AND 7)
);
 
CREATE TABLE publicacion_programada (
	id_publicacion	BIGINT GENERATED ALWAYS AS IDENTITY,
	id_agenda     	BIGINT NOT NULL,
	fecha_liberacion  DATE NOT NULL,
	libera_desde  	DATE NOT NULL,
	libera_hasta  	DATE NOT NULL,
	estado        	VARCHAR(10) NOT NULL DEFAULT 'PROGRAMADA',
	CONSTRAINT pk_publicacion_programada PRIMARY KEY (id_publicacion),
	CONSTRAINT fk_publicacion_programada_id_agenda FOREIGN KEY (id_agenda)
    	REFERENCES agenda (id_agenda) ON DELETE CASCADE,
	CONSTRAINT ck_publicacion_rango CHECK (libera_hasta >= libera_desde),
	CONSTRAINT ck_publicacion_estado CHECK (estado IN ('PROGRAMADA', 'EJECUTADA', 'CANCELADA'))
);
CREATE INDEX ix_publicacion_fecha ON publicacion_programada (fecha_liberacion);
 
CREATE TABLE bloqueo (
	id_bloqueo  	BIGINT GENERATED ALWAYS AS IDENTITY,
	id_profesional  BIGINT NOT NULL,
	inicio      	TIMESTAMPTZ NOT NULL,
	termino     	TIMESTAMPTZ NOT NULL,
	motivo      	VARCHAR(200) NOT NULL,
	creado_por  	UUID NOT NULL,
	creado_en   	TIMESTAMPTZ NOT NULL DEFAULT now(),
	CONSTRAINT pk_bloqueo PRIMARY KEY (id_bloqueo),
	CONSTRAINT fk_bloqueo_id_profesional FOREIGN KEY (id_profesional)
    	REFERENCES profesional (id_profesional) ON DELETE RESTRICT,
	CONSTRAINT fk_bloqueo_creado_por FOREIGN KEY (creado_por)
    	REFERENCES usuario (id_usuario) ON DELETE RESTRICT,
	CONSTRAINT ck_bloqueo_rango CHECK (termino > inicio)
);
CREATE INDEX ix_bloqueo_profesional ON bloqueo (id_profesional, inicio);
 
CREATE TABLE bloque_horario (
	id_bloque 	BIGINT GENERATED ALWAYS AS IDENTITY,
	id_agenda 	BIGINT NOT NULL,
	fecha     	DATE NOT NULL,
	hora_inicio   TIME NOT NULL,
	hora_termino  TIME NOT NULL,
	estado    	VARCHAR(12) NOT NULL DEFAULT 'NO_PUBLICADO',
	id_bloqueo	BIGINT,
	CONSTRAINT pk_bloque_horario PRIMARY KEY (id_bloque),
	CONSTRAINT uq_bloque_horario_id_agenda_fecha_hora_inicio UNIQUE (id_agenda, fecha, hora_inicio),
	CONSTRAINT fk_bloque_horario_id_agenda FOREIGN KEY (id_agenda)
    	REFERENCES agenda (id_agenda) ON DELETE CASCADE,
	CONSTRAINT fk_bloque_horario_id_bloqueo FOREIGN KEY (id_bloqueo)
    	REFERENCES bloqueo (id_bloqueo) ON DELETE SET NULL,
	CONSTRAINT ck_bloque_horas CHECK (hora_termino > hora_inicio),
	CONSTRAINT ck_bloque_estado CHECK (estado IN ('NO_PUBLICADO', 'DISPONIBLE', 'RESERVADO', 'BLOQUEADO')),
	CONSTRAINT ck_bloque_bloqueado CHECK (estado <> 'BLOQUEADO' OR id_bloqueo IS NOT NULL)
);
CREATE INDEX ix_bloque_fecha_estado ON bloque_horario (fecha, estado);
 
CREATE TABLE paciente (
	id_paciente   	BIGINT GENERATED ALWAYS AS IDENTITY,
	tipo_documento	VARCHAR(10) NOT NULL DEFAULT 'RUT',
	numero_documento  VARCHAR(20) NOT NULL,
	nombres       	VARCHAR(80) NOT NULL,
	apellidos     	VARCHAR(80) NOT NULL,
	fecha_nacimiento  DATE NOT NULL,
	genero        	VARCHAR(12) NOT NULL,
	nacionalidad  	VARCHAR(60) NOT NULL,
	telefono_celular  VARCHAR(15) NOT NULL,
	tiene_whatsapp	BOOLEAN NOT NULL DEFAULT TRUE,
	correo        	VARCHAR(120),
	direccion     	VARCHAR(150) NOT NULL,
	id_comuna     	SMALLINT NOT NULL,
	creado_en     	TIMESTAMPTZ NOT NULL DEFAULT now(),
	actualizado_en	TIMESTAMPTZ NOT NULL DEFAULT now(),
	CONSTRAINT pk_paciente PRIMARY KEY (id_paciente),
	CONSTRAINT uq_paciente_tipo_documento_numero_documento UNIQUE (tipo_documento, numero_documento),
	CONSTRAINT fk_paciente_id_comuna FOREIGN KEY (id_comuna)
    	REFERENCES comuna (id_comuna) ON DELETE RESTRICT,
	CONSTRAINT ck_paciente_tipo_doc CHECK (tipo_documento IN ('RUT', 'PASAPORTE', 'OTRO')),
	CONSTRAINT ck_paciente_rut CHECK (tipo_documento <> 'RUT' OR fn_rut_valido(numero_documento)),
	CONSTRAINT ck_paciente_genero CHECK (genero IN ('FEMENINO', 'MASCULINO', 'OTRO', 'NO_INFORMA')),
	CONSTRAINT ck_paciente_nacimiento CHECK (fecha_nacimiento >= DATE '1900-01-01'),
	CONSTRAINT ck_paciente_fono CHECK (telefono_celular ~ '^\+?[0-9]{8,15}$'),
	CONSTRAINT ck_paciente_correo CHECK (correo IS NULL OR correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
CREATE INDEX ix_paciente_apellidos ON paciente (apellidos, nombres);
 
CREATE TABLE responsable (
	id_responsable  BIGINT GENERATED ALWAYS AS IDENTITY,
	rut         	VARCHAR(12),
	nombres     	VARCHAR(80) NOT NULL,
	apellidos   	VARCHAR(80) NOT NULL,
	telefono    	VARCHAR(15) NOT NULL,
	correo      	VARCHAR(120),
	CONSTRAINT pk_responsable PRIMARY KEY (id_responsable),
	CONSTRAINT uq_responsable_rut UNIQUE (rut),
	CONSTRAINT ck_responsable_rut CHECK (fn_rut_valido(rut)),
	CONSTRAINT ck_responsable_fono CHECK (telefono ~ '^\+?[0-9]{8,15}$')
);
 
CREATE TABLE paciente_responsable (
	id_paciente   	BIGINT NOT NULL,
	id_responsable	BIGINT NOT NULL,
	relacion      	VARCHAR(30) NOT NULL,
	es_representante  BOOLEAN NOT NULL DEFAULT FALSE,
	vigente       	BOOLEAN NOT NULL DEFAULT TRUE,
	CONSTRAINT pk_paciente_responsable PRIMARY KEY (id_paciente, id_responsable),
	CONSTRAINT fk_paciente_responsable_id_paciente FOREIGN KEY (id_paciente)
    	REFERENCES paciente (id_paciente) ON DELETE CASCADE,
	CONSTRAINT fk_paciente_responsable_id_responsable FOREIGN KEY (id_responsable)
    	REFERENCES responsable (id_responsable) ON DELETE RESTRICT
);
 
CREATE TABLE consentimiento (
	id_consentimiento  BIGINT GENERATED ALWAYS AS IDENTITY,
	id_paciente    	BIGINT NOT NULL,
	version_texto  	VARCHAR(10) NOT NULL,
	aceptado_en    	TIMESTAMPTZ NOT NULL DEFAULT now(),
	canal          	VARCHAR(10) NOT NULL,
	registrado_por 	UUID,
	CONSTRAINT pk_consentimiento PRIMARY KEY (id_consentimiento),
	CONSTRAINT fk_consentimiento_id_paciente FOREIGN KEY (id_paciente)
    	REFERENCES paciente (id_paciente) ON DELETE CASCADE,
	CONSTRAINT fk_consentimiento_registrado_por FOREIGN KEY (registrado_por)
    	REFERENCES usuario (id_usuario) ON DELETE SET NULL,
	CONSTRAINT ck_consentimiento_canal CHECK (canal IN ('WEB', 'PRESENCIAL', 'TELEFONO')),
	CONSTRAINT ck_consentimiento_asistido CHECK (canal = 'WEB' OR registrado_por IS NOT NULL)
);
 
CREATE TABLE documento (
	id_documento 	BIGINT GENERATED ALWAYS AS IDENTITY,
	id_paciente  	BIGINT NOT NULL,
	tipo         	VARCHAR(14) NOT NULL,
	ruta_archivo 	TEXT NOT NULL,
	formato      	VARCHAR(4) NOT NULL,
	tamano_kb    	INTEGER NOT NULL,
	origen       	VARCHAR(8) NOT NULL,
	cargado_por  	UUID,
	cargado_en   	TIMESTAMPTZ NOT NULL DEFAULT now(),
	estado_revision  VARCHAR(10) NOT NULL DEFAULT 'PENDIENTE',
	revisado_por 	UUID,
	revisado_en  	TIMESTAMPTZ,
	observacion  	VARCHAR(300),
	CONSTRAINT pk_documento PRIMARY KEY (id_documento),
	CONSTRAINT uq_documento_ruta_archivo UNIQUE (ruta_archivo),
	CONSTRAINT fk_documento_id_paciente FOREIGN KEY (id_paciente)
    	REFERENCES paciente (id_paciente) ON DELETE CASCADE,
	CONSTRAINT fk_documento_cargado_por FOREIGN KEY (cargado_por)
    	REFERENCES usuario (id_usuario) ON DELETE SET NULL,
	CONSTRAINT fk_documento_revisado_por FOREIGN KEY (revisado_por)
    	REFERENCES usuario (id_usuario) ON DELETE SET NULL,
	CONSTRAINT ck_documento_tipo CHECK (tipo IN ('FONASA', 'CESFAM', 'ORDEN_MEDICA', 'DERIVACION', 'OTRO')),
	CONSTRAINT ck_documento_formato CHECK (formato IN ('PDF', 'JPG', 'PNG')),
	CONSTRAINT ck_documento_tamano CHECK (tamano_kb BETWEEN 1 AND 10240),
	CONSTRAINT ck_documento_origen CHECK (origen IN ('PORTAL', 'PERSONAL')),
	CONSTRAINT ck_documento_estado CHECK (estado_revision IN ('PENDIENTE', 'VALIDADO', 'OBSERVADO')),
	CONSTRAINT ck_documento_revision CHECK (estado_revision = 'PENDIENTE' OR (revisado_por IS NOT NULL AND revisado_en IS NOT NULL))
);
CREATE INDEX ix_documento_paciente ON documento (id_paciente, tipo);
 
CREATE TABLE orden_medica (
	id_orden        	BIGINT GENERATED ALWAYS AS IDENTITY,
	id_paciente     	BIGINT NOT NULL,
	id_especialidad 	SMALLINT NOT NULL,
	id_documento    	BIGINT,
	sesiones_indicadas  SMALLINT NOT NULL,
	fecha_emision   	DATE NOT NULL,
	estado          	VARCHAR(10) NOT NULL DEFAULT 'VIGENTE',
	CONSTRAINT pk_orden_medica PRIMARY KEY (id_orden),
	CONSTRAINT uq_orden_medica_id_documento UNIQUE (id_documento),
	CONSTRAINT fk_orden_medica_id_paciente FOREIGN KEY (id_paciente)
    	REFERENCES paciente (id_paciente) ON DELETE CASCADE,
	CONSTRAINT fk_orden_medica_id_especialidad FOREIGN KEY (id_especialidad)
    	REFERENCES especialidad (id_especialidad) ON DELETE RESTRICT,
	CONSTRAINT fk_orden_medica_id_documento FOREIGN KEY (id_documento)
    	REFERENCES documento (id_documento) ON DELETE SET NULL,
	CONSTRAINT ck_orden_sesiones CHECK (sesiones_indicadas BETWEEN 1 AND 60),
	CONSTRAINT ck_orden_estado CHECK (estado IN ('VIGENTE', 'COMPLETADA', 'ANULADA'))
);
 
CREATE TABLE cita (
	id_cita               	BIGINT GENERATED ALWAYS AS IDENTITY,
	id_paciente           	BIGINT NOT NULL,
	id_bloque             	BIGINT NOT NULL,
	id_orden              	BIGINT,
	id_profesional_reemplazo  BIGINT,
	id_responsable        BIGINT,
	canal_reserva         	VARCHAR(10) NOT NULL,
	telefono_contacto     	VARCHAR(15) NOT NULL,
	correo_contacto       	VARCHAR(120),
	estado_reserva        	VARCHAR(12) NOT NULL DEFAULT 'RESERVADA',
	estado_confirmacion   	VARCHAR(14) NOT NULL DEFAULT 'PENDIENTE',
	origen_cancelacion    	VARCHAR(14),
	motivo_cancelacion    	VARCHAR(200),
	cancelada_en          	TIMESTAMPTZ,
	creada_por            	UUID,
	creada_en             	TIMESTAMPTZ NOT NULL DEFAULT now(),
	actualizada_en        	TIMESTAMPTZ NOT NULL DEFAULT now(),
	CONSTRAINT pk_cita PRIMARY KEY (id_cita),
	CONSTRAINT fk_cita_id_paciente FOREIGN KEY (id_paciente)
    	REFERENCES paciente (id_paciente) ON DELETE RESTRICT,
	CONSTRAINT fk_cita_id_bloque FOREIGN KEY (id_bloque)
    	REFERENCES bloque_horario (id_bloque) ON DELETE RESTRICT,
	CONSTRAINT fk_cita_id_orden FOREIGN KEY (id_orden)
    	REFERENCES orden_medica (id_orden) ON DELETE SET NULL,
	CONSTRAINT fk_cita_id_profesional_reemplazo FOREIGN KEY (id_profesional_reemplazo)
    	REFERENCES profesional (id_profesional) ON DELETE RESTRICT,
	CONSTRAINT fk_cita_paciente_responsable FOREIGN KEY (id_paciente, id_responsable)
    	REFERENCES paciente_responsable (id_paciente, id_responsable) ON DELETE RESTRICT,
	CONSTRAINT fk_cita_creada_por FOREIGN KEY (creada_por)
    	REFERENCES usuario (id_usuario) ON DELETE SET NULL,
	CONSTRAINT ck_cita_canal CHECK (canal_reserva IN ('WEB', 'PRESENCIAL', 'TELEFONO')),
	CONSTRAINT ck_cita_asistida CHECK (canal_reserva = 'WEB' OR creada_por IS NOT NULL),
	CONSTRAINT ck_cita_estado CHECK (estado_reserva IN ('RESERVADA', 'CANCELADA', 'ASISTIO', 'NO_ASISTIO')),
	CONSTRAINT ck_cita_confirmacion CHECK (estado_confirmacion IN ('PENDIENTE', 'CONFIRMADA', 'SIN_RESPUESTA')),
	CONSTRAINT ck_cita_origen CHECK (origen_cancelacion IS NULL OR origen_cancelacion IN ('PACIENTE_WSP', 'ASISTIDA', 'INSTITUCIONAL')),
	CONSTRAINT ck_cita_cancelacion CHECK ((estado_reserva = 'CANCELADA') = (origen_cancelacion IS NOT NULL AND cancelada_en IS NOT NULL)),
	CONSTRAINT ck_cita_fono CHECK (telefono_contacto ~ '^\+?[0-9]{8,15}$')
);
CREATE UNIQUE INDEX ux_cita_bloque_activa ON cita (id_bloque) WHERE estado_reserva <> 'CANCELADA';
CREATE INDEX ix_cita_paciente ON cita (id_paciente);
CREATE INDEX ix_cita_pendientes ON cita (estado_confirmacion) WHERE estado_reserva = 'RESERVADA';
 
CREATE TABLE cita_historial (
	id_historial 	BIGINT GENERATED ALWAYS AS IDENTITY,
	id_cita      	BIGINT NOT NULL,
	operacion    	VARCHAR(30) NOT NULL,
	estado_anterior  VARCHAR(14),
	estado_nuevo 	VARCHAR(14),
	origen       	VARCHAR(10) NOT NULL,
	id_usuario   	UUID,
	registrado_en	TIMESTAMPTZ NOT NULL DEFAULT now(),
	detalle      	VARCHAR(300),
	CONSTRAINT pk_cita_historial PRIMARY KEY (id_historial),
	CONSTRAINT fk_cita_historial_id_cita FOREIGN KEY (id_cita)
    	REFERENCES cita (id_cita) ON DELETE CASCADE,
	CONSTRAINT fk_cita_historial_id_usuario FOREIGN KEY (id_usuario)
    	REFERENCES usuario (id_usuario) ON DELETE SET NULL,
	CONSTRAINT ck_historial_origen CHECK (origen IN ('SISTEMA', 'PACIENTE', 'PERSONAL'))
);
CREATE INDEX ix_historial_cita ON cita_historial (id_cita, registrado_en);
 
CREATE TABLE recepcion (
	id_cita             	BIGINT NOT NULL,
	llegada_en          	TIMESTAMPTZ NOT NULL DEFAULT now(),
	documentos_verificados  BOOLEAN NOT NULL DEFAULT FALSE,
	registrado_por      	UUID NOT NULL,
	CONSTRAINT pk_recepcion PRIMARY KEY (id_cita),
	CONSTRAINT fk_recepcion_id_cita FOREIGN KEY (id_cita)
    	REFERENCES cita (id_cita) ON DELETE CASCADE,
	CONSTRAINT fk_recepcion_registrado_por FOREIGN KEY (registrado_por)
    	REFERENCES usuario (id_usuario) ON DELETE RESTRICT
);
 
CREATE TABLE contacto_seguimiento (
	id_contacto   BIGINT GENERATED ALWAYS AS IDENTITY,
	id_cita   	BIGINT NOT NULL,
	id_usuario	UUID NOT NULL,
	canal     	VARCHAR(10) NOT NULL,
	motivo    	VARCHAR(14) NOT NULL,
	resultado 	VARCHAR(14) NOT NULL,
	realizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
	observacion   VARCHAR(300),
	CONSTRAINT pk_contacto_seguimiento PRIMARY KEY (id_contacto),
	CONSTRAINT fk_contacto_seguimiento_id_cita FOREIGN KEY (id_cita)
    	REFERENCES cita (id_cita) ON DELETE CASCADE,
	CONSTRAINT fk_contacto_seguimiento_id_usuario FOREIGN KEY (id_usuario)
    	REFERENCES usuario (id_usuario) ON DELETE RESTRICT,
	CONSTRAINT ck_contacto_canal CHECK (canal IN ('LLAMADA', 'WHATSAPP', 'PRESENCIAL')),
	CONSTRAINT ck_contacto_motivo CHECK (motivo IN ('CONFIRMACION', 'CAMBIO_AGENDA', 'OTRO')),
	CONSTRAINT ck_contacto_resultado CHECK (resultado IN ('CONTACTADO', 'NO_CONTESTA', 'NUMERO_ERRONEO', 'CONFIRMA', 'CANCELA'))
);
CREATE INDEX ix_contacto_cita ON contacto_seguimiento (id_cita);
 
CREATE TABLE cambio_agenda (
	id_cambio             	BIGINT GENERATED ALWAYS AS IDENTITY,
	tipo                  	VARCHAR(12) NOT NULL,
	id_profesional_original   BIGINT NOT NULL,
	id_profesional_reemplazo  BIGINT,
	id_bloqueo            	BIGINT,
	motivo                	VARCHAR(200) NOT NULL,
	registrado_por        	UUID NOT NULL,
	registrado_en         	TIMESTAMPTZ NOT NULL DEFAULT now(),
	CONSTRAINT pk_cambio_agenda PRIMARY KEY (id_cambio),
	CONSTRAINT fk_cambio_agenda_id_profesional_original FOREIGN KEY (id_profesional_original)
    	REFERENCES profesional (id_profesional) ON DELETE RESTRICT,
	CONSTRAINT fk_cambio_agenda_id_profesional_reemplazo FOREIGN KEY (id_profesional_reemplazo)
    	REFERENCES profesional (id_profesional) ON DELETE RESTRICT,
	CONSTRAINT fk_cambio_agenda_id_bloqueo FOREIGN KEY (id_bloqueo)
    	REFERENCES bloqueo (id_bloqueo) ON DELETE SET NULL,
	CONSTRAINT fk_cambio_agenda_registrado_por FOREIGN KEY (registrado_por)
    	REFERENCES usuario (id_usuario) ON DELETE RESTRICT,
	CONSTRAINT ck_cambio_tipo CHECK (tipo IN ('REEMPLAZO', 'CANCELACION')),
	CONSTRAINT ck_cambio_reemplazo CHECK ((tipo = 'REEMPLAZO') = (id_profesional_reemplazo IS NOT NULL)),
	CONSTRAINT ck_cambio_distinto CHECK (id_profesional_reemplazo IS NULL OR id_profesional_reemplazo <> id_profesional_original)
);
 
CREATE TABLE cita_afectada (
	id_cambio       	BIGINT NOT NULL,
	id_cita         	BIGINT NOT NULL,
	respuesta_paciente  VARCHAR(14) NOT NULL DEFAULT 'PENDIENTE',
	requiere_llamada	BOOLEAN NOT NULL DEFAULT FALSE,
	respondido_en   	TIMESTAMPTZ,
	CONSTRAINT pk_cita_afectada PRIMARY KEY (id_cambio, id_cita),
	CONSTRAINT fk_cita_afectada_id_cambio FOREIGN KEY (id_cambio)
    	REFERENCES cambio_agenda (id_cambio) ON DELETE CASCADE,
	CONSTRAINT fk_cita_afectada_id_cita FOREIGN KEY (id_cita)
    	REFERENCES cita (id_cita) ON DELETE CASCADE,
	CONSTRAINT ck_afectada_respuesta CHECK (respuesta_paciente IN ('PENDIENTE', 'CONSERVA', 'CANCELA', 'SIN_RESPUESTA'))
);
CREATE INDEX ix_afectada_cita ON cita_afectada (id_cita);
 
CREATE TABLE plantilla_mensaje (
	id_plantilla   	SMALLINT GENERATED ALWAYS AS IDENTITY,
	codigo         	VARCHAR(40) NOT NULL,
	tipo           	VARCHAR(24) NOT NULL,
	canal          	VARCHAR(8) NOT NULL,
	categoria_meta 	VARCHAR(10),
	estado_aprobacion  VARCHAR(10) NOT NULL DEFAULT 'BORRADOR',
	contenido      	TEXT NOT NULL,
	CONSTRAINT pk_plantilla_mensaje PRIMARY KEY (id_plantilla),
	CONSTRAINT uq_plantilla_mensaje_codigo UNIQUE (codigo),
	CONSTRAINT ck_plantilla_tipo CHECK (tipo IN ('COMPROBANTE', 'RECORDATORIO', 'CONSEJOS_TELEMEDICINA', 'AVISO_CAMBIO', 'CANCELACION', 'AGRADECIMIENTO', 'ENCUESTA_AGENDAMIENTO', 'ENCUESTA_ATENCION')),
	CONSTRAINT ck_plantilla_canal CHECK (canal IN ('WHATSAPP', 'CORREO')),
	CONSTRAINT ck_plantilla_categoria CHECK (categoria_meta IS NULL OR categoria_meta IN ('UTILIDAD', 'MARKETING')),
	CONSTRAINT ck_plantilla_wsp CHECK (canal <> 'WHATSAPP' OR categoria_meta IS NOT NULL),
	CONSTRAINT ck_plantilla_estado CHECK (estado_aprobacion IN ('BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA'))
);
 
CREATE TABLE mensaje (
	id_mensaje   	BIGINT GENERATED ALWAYS AS IDENTITY,
	id_cita      	BIGINT NOT NULL,
	id_plantilla 	SMALLINT NOT NULL,
	destino      	VARCHAR(120) NOT NULL,
	programado_para  TIMESTAMPTZ NOT NULL,
	enviado_en   	TIMESTAMPTZ,
	estado_envio 	VARCHAR(10) NOT NULL DEFAULT 'PROGRAMADO',
	id_externo   	VARCHAR(80),
	respuesta    	VARCHAR(10),
	respondido_en	TIMESTAMPTZ,
	CONSTRAINT pk_mensaje PRIMARY KEY (id_mensaje),
	CONSTRAINT uq_mensaje_id_externo UNIQUE (id_externo),
	CONSTRAINT fk_mensaje_id_cita FOREIGN KEY (id_cita)
    	REFERENCES cita (id_cita) ON DELETE CASCADE,
	CONSTRAINT fk_mensaje_id_plantilla FOREIGN KEY (id_plantilla)
    	REFERENCES plantilla_mensaje (id_plantilla) ON DELETE RESTRICT,
	CONSTRAINT ck_mensaje_estado CHECK (estado_envio IN ('PROGRAMADO', 'ENVIADO', 'ENTREGADO', 'LEIDO', 'FALLIDO', 'ANULADO')),
	CONSTRAINT ck_mensaje_respuesta CHECK (respuesta IS NULL OR respuesta IN ('CONFIRMAR', 'CANCELAR', 'CONSERVAR', 'NINGUNA')),
	CONSTRAINT ck_mensaje_respondido CHECK (respuesta IS NULL OR respondido_en IS NOT NULL)
);
CREATE INDEX ix_mensaje_programados ON mensaje (programado_para) WHERE estado_envio = 'PROGRAMADO';
CREATE INDEX ix_mensaje_cita ON mensaje (id_cita);
 
CREATE TABLE solicitud_espera (
	id_solicitud 	BIGINT GENERATED ALWAYS AS IDENTITY,
	id_paciente  	BIGINT NOT NULL,
	id_policlinico   SMALLINT NOT NULL,
	id_especialidad  SMALLINT NOT NULL,
	id_orden     	BIGINT,
	ingresada_en 	TIMESTAMPTZ NOT NULL DEFAULT now(),
	prioridad    	SMALLINT NOT NULL DEFAULT 3,
	estado       	VARCHAR(14) NOT NULL DEFAULT 'EN_ESPERA',
	registrado_por   UUID NOT NULL,
	observacion  	VARCHAR(300),
	CONSTRAINT pk_solicitud_espera PRIMARY KEY (id_solicitud),
	CONSTRAINT fk_solicitud_espera_id_paciente FOREIGN KEY (id_paciente)
    	REFERENCES paciente (id_paciente) ON DELETE CASCADE,
	CONSTRAINT fk_solicitud_espera_policlinico_especialidad FOREIGN KEY (id_policlinico, id_especialidad)
    	REFERENCES policlinico_especialidad (id_policlinico, id_especialidad) ON DELETE RESTRICT,
	CONSTRAINT fk_solicitud_espera_id_orden FOREIGN KEY (id_orden)
    	REFERENCES orden_medica (id_orden) ON DELETE SET NULL,
	CONSTRAINT fk_solicitud_espera_registrado_por FOREIGN KEY (registrado_por)
    	REFERENCES usuario (id_usuario) ON DELETE RESTRICT,
	CONSTRAINT ck_espera_prioridad CHECK (prioridad BETWEEN 1 AND 5),
	CONSTRAINT ck_espera_estado CHECK (estado IN ('EN_ESPERA', 'CUPO_OFRECIDO', 'ASIGNADA', 'RETIRADA'))
);
CREATE UNIQUE INDEX ux_espera_activa ON solicitud_espera (id_paciente, id_policlinico, id_especialidad) WHERE estado IN ('EN_ESPERA','CUPO_OFRECIDO');
CREATE INDEX ix_espera_cola ON solicitud_espera (id_policlinico, id_especialidad, estado, prioridad, ingresada_en);
 
CREATE TABLE notificacion (
	id_notificacion  BIGINT GENERATED ALWAYS AS IDENTITY,
	id_policlinico   SMALLINT NOT NULL,
	tipo         	VARCHAR(14) NOT NULL,
	id_cita      	BIGINT,
	id_bloque    	BIGINT,
	creada_en    	TIMESTAMPTZ NOT NULL DEFAULT now(),
	atendida_por 	UUID,
	atendida_en  	TIMESTAMPTZ,
	decision     	VARCHAR(14),
	CONSTRAINT pk_notificacion PRIMARY KEY (id_notificacion),
	CONSTRAINT fk_notificacion_id_policlinico FOREIGN KEY (id_policlinico)
    	REFERENCES policlinico (id_policlinico) ON DELETE CASCADE,
	CONSTRAINT fk_notificacion_id_cita FOREIGN KEY (id_cita)
    	REFERENCES cita (id_cita) ON DELETE CASCADE,
	CONSTRAINT fk_notificacion_id_bloque FOREIGN KEY (id_bloque)
    	REFERENCES bloque_horario (id_bloque) ON DELETE CASCADE,
	CONSTRAINT fk_notificacion_atendida_por FOREIGN KEY (atendida_por)
    	REFERENCES usuario (id_usuario) ON DELETE SET NULL,
	CONSTRAINT ck_notif_tipo CHECK (tipo IN ('CUPO_LIBERADO', 'SIN_CONFIRMAR', 'CAMBIO_AGENDA', 'SIN_WHATSAPP')),
	CONSTRAINT ck_notif_cupo CHECK (tipo <> 'CUPO_LIBERADO' OR id_bloque IS NOT NULL),
	CONSTRAINT ck_notif_decision CHECK (decision IS NULL OR decision IN ('OFRECER_ESPERA', 'LIBERAR', 'LLAMAR')),
	CONSTRAINT ck_notif_atendida CHECK ((atendida_en IS NULL) = (atendida_por IS NULL))
);
CREATE INDEX ix_notif_pendientes ON notificacion (id_policlinico, creada_en) WHERE atendida_en IS NULL;
 
CREATE TABLE oferta_cupo (
	id_oferta 	BIGINT GENERATED ALWAYS AS IDENTITY,
	id_solicitud  BIGINT NOT NULL,
	id_bloque 	BIGINT NOT NULL,
	ofrecido_por  UUID NOT NULL,
	ofrecido_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
	resultado 	VARCHAR(14) NOT NULL DEFAULT 'PENDIENTE',
	id_cita   	BIGINT,
	CONSTRAINT pk_oferta_cupo PRIMARY KEY (id_oferta),
	CONSTRAINT uq_oferta_cupo_id_cita UNIQUE (id_cita),
	CONSTRAINT fk_oferta_cupo_id_solicitud FOREIGN KEY (id_solicitud)
    	REFERENCES solicitud_espera (id_solicitud) ON DELETE CASCADE,
	CONSTRAINT fk_oferta_cupo_id_bloque FOREIGN KEY (id_bloque)
    	REFERENCES bloque_horario (id_bloque) ON DELETE CASCADE,
	CONSTRAINT fk_oferta_cupo_ofrecido_por FOREIGN KEY (ofrecido_por)
    	REFERENCES usuario (id_usuario) ON DELETE RESTRICT,
	CONSTRAINT fk_oferta_cupo_id_cita FOREIGN KEY (id_cita)
    	REFERENCES cita (id_cita) ON DELETE SET NULL,
	CONSTRAINT ck_oferta_resultado CHECK (resultado IN ('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'SIN_RESPUESTA')),
	CONSTRAINT ck_oferta_aceptada CHECK (resultado <> 'ACEPTADA' OR id_cita IS NOT NULL)
);
CREATE INDEX ix_oferta_solicitud ON oferta_cupo (id_solicitud);
 
CREATE TABLE encuesta (
	id_encuesta 	SMALLINT GENERATED ALWAYS AS IDENTITY,
	tipo        	VARCHAR(12) NOT NULL,
	titulo      	VARCHAR(120) NOT NULL,
	url_formulario  TEXT,
	vigente     	BOOLEAN NOT NULL DEFAULT TRUE,
	CONSTRAINT pk_encuesta PRIMARY KEY (id_encuesta),
	CONSTRAINT ck_encuesta_tipo CHECK (tipo IN ('AGENDAMIENTO', 'ATENCION'))
);
CREATE UNIQUE INDEX ux_encuesta_vigente ON encuesta (tipo) WHERE vigente;
 
CREATE TABLE pregunta_encuesta (
	id_pregunta 	INTEGER GENERATED ALWAYS AS IDENTITY,
	id_encuesta 	SMALLINT NOT NULL,
	orden       	SMALLINT NOT NULL,
	texto       	VARCHAR(250) NOT NULL,
	tipo_respuesta  VARCHAR(8) NOT NULL,
	CONSTRAINT pk_pregunta_encuesta PRIMARY KEY (id_pregunta),
	CONSTRAINT uq_pregunta_encuesta_id_encuesta_orden UNIQUE (id_encuesta, orden),
	CONSTRAINT fk_pregunta_encuesta_id_encuesta FOREIGN KEY (id_encuesta)
    	REFERENCES encuesta (id_encuesta) ON DELETE CASCADE,
	CONSTRAINT ck_pregunta_tipo CHECK (tipo_respuesta IN ('ESCALA', 'SI_NO', 'TEXTO'))
);
 
CREATE TABLE respuesta_encuesta (
	id_respuesta   BIGINT GENERATED ALWAYS AS IDENTITY,
	id_encuesta	SMALLINT NOT NULL,
	id_cita    	BIGINT NOT NULL,
	respondida_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
	CONSTRAINT pk_respuesta_encuesta PRIMARY KEY (id_respuesta),
	CONSTRAINT uq_respuesta_encuesta_id_encuesta_id_cita UNIQUE (id_encuesta, id_cita),
	CONSTRAINT fk_respuesta_encuesta_id_encuesta FOREIGN KEY (id_encuesta)
    	REFERENCES encuesta (id_encuesta) ON DELETE RESTRICT,
	CONSTRAINT fk_respuesta_encuesta_id_cita FOREIGN KEY (id_cita)
    	REFERENCES cita (id_cita) ON DELETE CASCADE
);
 
CREATE TABLE respuesta_detalle (
	id_respuesta  BIGINT NOT NULL,
	id_pregunta   INTEGER NOT NULL,
	valor_escala  SMALLINT,
	valor_texto   VARCHAR(500),
	CONSTRAINT pk_respuesta_detalle PRIMARY KEY (id_respuesta, id_pregunta),
	CONSTRAINT fk_respuesta_detalle_id_respuesta FOREIGN KEY (id_respuesta)
    	REFERENCES respuesta_encuesta (id_respuesta) ON DELETE CASCADE,
	CONSTRAINT fk_respuesta_detalle_id_pregunta FOREIGN KEY (id_pregunta)
    	REFERENCES pregunta_encuesta (id_pregunta) ON DELETE RESTRICT,
	CONSTRAINT ck_detalle_escala CHECK (valor_escala IS NULL OR valor_escala BETWEEN 0 AND 5),
	CONSTRAINT ck_detalle_valor CHECK (valor_escala IS NOT NULL OR valor_texto IS NOT NULL)
);
 
CREATE TABLE auditoria (
	id_auditoria	BIGINT GENERATED ALWAYS AS IDENTITY,
	id_usuario  	UUID,
	id_policlinico  SMALLINT,
	operacion   	VARCHAR(40) NOT NULL,
	entidad     	VARCHAR(40) NOT NULL,
	id_entidad  	VARCHAR(40) NOT NULL,
	realizado_en	TIMESTAMPTZ NOT NULL DEFAULT now(),
	detalle     	JSONB,
	CONSTRAINT pk_auditoria PRIMARY KEY (id_auditoria),
	CONSTRAINT fk_auditoria_id_usuario FOREIGN KEY (id_usuario)
    	REFERENCES usuario (id_usuario) ON DELETE SET NULL,
	CONSTRAINT fk_auditoria_id_policlinico FOREIGN KEY (id_policlinico)
    	REFERENCES policlinico (id_policlinico) ON DELETE SET NULL
);
CREATE INDEX ix_auditoria_fecha ON auditoria (realizado_en);
CREATE INDEX ix_auditoria_sede ON auditoria (id_policlinico, realizado_en);
 
CREATE INDEX ix_bloque_agenda ON bloque_horario (id_agenda);
CREATE INDEX ix_paciente_comuna ON paciente (id_comuna);
CREATE INDEX ix_orden_paciente ON orden_medica (id_paciente);
 
CREATE OR REPLACE FUNCTION fn_valida_encuesta_atencion() RETURNS trigger AS $$
BEGIN
  IF (SELECT tipo FROM encuesta WHERE id_encuesta = NEW.id_encuesta) = 'ATENCION'
 	AND (SELECT estado_reserva FROM cita WHERE id_cita = NEW.id_cita) <> 'ASISTIO' THEN
	RAISE EXCEPTION 'La encuesta de atención requiere una cita con asistencia (cita %)', NEW.id_cita;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
 
CREATE TRIGGER trg_encuesta_atencion
BEFORE INSERT OR UPDATE ON respuesta_encuesta
FOR EACH ROW EXECUTE FUNCTION fn_valida_encuesta_atencion();
 
 
CREATE OR REPLACE FUNCTION fn_agenda_dia_sin_solape()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_agenda agenda%ROWTYPE;
BEGIN
	SELECT * INTO v_agenda FROM agenda WHERE id_agenda = NEW.id_agenda;
	IF v_agenda.estado_publicacion <> 'PUBLICADA' THEN RETURN NEW; END IF;
	PERFORM pg_advisory_xact_lock(v_agenda.id_profesional);
	IF EXISTS (
    	SELECT 1 FROM agenda otra JOIN agenda_dia od ON od.id_agenda = otra.id_agenda
    	WHERE otra.id_agenda <> NEW.id_agenda
      	AND otra.id_profesional = v_agenda.id_profesional
      	AND otra.estado_publicacion = 'PUBLICADA'
      	AND od.dia_semana = NEW.dia_semana
      	AND otra.vigente_desde <= v_agenda.vigente_hasta
      	AND otra.vigente_hasta >= v_agenda.vigente_desde
      	AND otra.hora_inicio < v_agenda.hora_termino
      	AND v_agenda.hora_inicio < otra.hora_termino
	) THEN
    	RAISE EXCEPTION 'Agenda incompatible: profesional % ya posee una agenda publicada en ese horario', v_agenda.id_profesional;
	END IF;
	RETURN NEW;
END;
$$;
CREATE TRIGGER trg_agenda_dia_sin_solape
BEFORE INSERT OR UPDATE OF id_agenda, dia_semana ON agenda_dia
FOR EACH ROW EXECUTE FUNCTION fn_agenda_dia_sin_solape();
 
CREATE OR REPLACE FUNCTION fn_agenda_publicacion_sin_solape()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NEW.estado_publicacion <> 'PUBLICADA' THEN RETURN NEW; END IF;
	PERFORM pg_advisory_xact_lock(NEW.id_profesional);
	IF EXISTS (
    	SELECT 1 FROM agenda otra
    	JOIN agenda_dia d_otra ON d_otra.id_agenda = otra.id_agenda
    	JOIN agenda_dia d_actual ON d_actual.id_agenda = NEW.id_agenda
                            	AND d_actual.dia_semana = d_otra.dia_semana
    	WHERE otra.id_agenda <> NEW.id_agenda
      	AND otra.id_profesional = NEW.id_profesional
      	AND otra.estado_publicacion = 'PUBLICADA'
      	AND otra.vigente_desde <= NEW.vigente_hasta
      	AND otra.vigente_hasta >= NEW.vigente_desde
      	AND otra.hora_inicio < NEW.hora_termino
      	AND NEW.hora_inicio < otra.hora_termino
	) THEN
    	RAISE EXCEPTION 'Agenda publicada solapada para profesional %', NEW.id_profesional;
	END IF;
	RETURN NEW;
END;
$$;
CREATE TRIGGER trg_agenda_publicacion_sin_solape
BEFORE UPDATE OF id_profesional, vigente_desde, vigente_hasta,
	hora_inicio, hora_termino, estado_publicacion ON agenda
FOR EACH ROW EXECUTE FUNCTION fn_agenda_publicacion_sin_solape();
 
CREATE OR REPLACE FUNCTION fn_cita_verifica_cupo()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_estado VARCHAR(12); v_requiere BOOLEAN := FALSE;
BEGIN
	IF TG_OP = 'INSERT' THEN
    	v_requiere := NEW.estado_reserva <> 'CANCELADA';
	ELSIF TG_OP = 'UPDATE' THEN
    	v_requiere := NEW.estado_reserva <> 'CANCELADA'
                  	AND (OLD.estado_reserva = 'CANCELADA' OR OLD.id_bloque <> NEW.id_bloque);
	END IF;
	IF v_requiere THEN
    	SELECT estado INTO v_estado FROM bloque_horario
    	WHERE id_bloque = NEW.id_bloque FOR UPDATE;
    	IF v_estado IS DISTINCT FROM 'DISPONIBLE' THEN
        	RAISE EXCEPTION 'El cupo % no está DISPONIBLE', NEW.id_bloque;
    	END IF;
	END IF;
	RETURN NEW;
END;
$$;
CREATE TRIGGER trg_cita_verifica_cupo
BEFORE INSERT OR UPDATE OF id_bloque, estado_reserva ON cita
FOR EACH ROW EXECUTE FUNCTION fn_cita_verifica_cupo();
 
CREATE OR REPLACE FUNCTION fn_cita_sincroniza_cupo()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
    	IF NEW.estado_reserva <> 'CANCELADA' THEN
        	UPDATE bloque_horario SET estado = 'RESERVADO' WHERE id_bloque = NEW.id_bloque;
    	END IF;
	ELSIF TG_OP = 'UPDATE' THEN
    	IF OLD.id_bloque <> NEW.id_bloque OR
       	(OLD.estado_reserva <> 'CANCELADA' AND NEW.estado_reserva = 'CANCELADA') THEN
        	UPDATE bloque_horario SET estado = 'DISPONIBLE'
        	WHERE id_bloque = OLD.id_bloque AND estado = 'RESERVADO'
          	AND NOT EXISTS (SELECT 1 FROM cita otra
                          	WHERE otra.id_bloque = OLD.id_bloque
                            	AND otra.estado_reserva <> 'CANCELADA');
    	END IF;
    	IF NEW.estado_reserva <> 'CANCELADA' AND
       	(OLD.id_bloque <> NEW.id_bloque OR OLD.estado_reserva = 'CANCELADA') THEN
        	UPDATE bloque_horario SET estado = 'RESERVADO' WHERE id_bloque = NEW.id_bloque;
    	END IF;
	END IF;
	RETURN NULL;
END;
$$;
CREATE TRIGGER trg_cita_sincroniza_cupo
AFTER INSERT OR UPDATE OF id_bloque, estado_reserva ON cita
FOR EACH ROW EXECUTE FUNCTION fn_cita_sincroniza_cupo();
 
CREATE OR REPLACE FUNCTION fn_bloque_no_liberar_ocupado()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NEW.estado IN ('DISPONIBLE','NO_PUBLICADO') AND EXISTS (
    	SELECT 1 FROM cita c WHERE c.id_bloque = NEW.id_bloque
    	AND c.estado_reserva <> 'CANCELADA'
	) THEN
    	RAISE EXCEPTION 'No se puede liberar el cupo %, tiene una cita vigente', NEW.id_bloque;
	END IF;
	RETURN NEW;
END;
$$;
CREATE TRIGGER trg_bloque_no_liberar_ocupado
BEFORE UPDATE OF estado ON bloque_horario
FOR EACH ROW EXECUTE FUNCTION fn_bloque_no_liberar_ocupado();
 
CREATE OR REPLACE FUNCTION fn_orden_documento_mismo_paciente()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NEW.id_documento IS NOT NULL AND NOT EXISTS (
    	SELECT 1 FROM documento d WHERE d.id_documento=NEW.id_documento
    	AND d.id_paciente=NEW.id_paciente
	) THEN
    	RAISE EXCEPTION 'La orden debe utilizar documentos del mismo paciente';
	END IF;
	RETURN NEW;
END;
$$;
CREATE TRIGGER trg_orden_documento_mismo_paciente
BEFORE INSERT OR UPDATE OF id_paciente, id_documento ON orden_medica
FOR EACH ROW EXECUTE FUNCTION fn_orden_documento_mismo_paciente();
 
CREATE OR REPLACE FUNCTION fn_cita_orden_mismo_paciente()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NEW.id_orden IS NOT NULL AND NOT EXISTS (
    	SELECT 1 FROM orden_medica o
    	JOIN bloque_horario b ON b.id_bloque = NEW.id_bloque
    	JOIN agenda a ON a.id_agenda = b.id_agenda
    	WHERE o.id_orden = NEW.id_orden AND o.id_paciente = NEW.id_paciente
      	AND o.id_especialidad = a.id_especialidad
	) THEN
    	RAISE EXCEPTION 'La orden médica no coincide con el paciente o la especialidad de la cita';
	END IF;
	RETURN NEW;
END;
$$;
CREATE TRIGGER trg_cita_orden_mismo_paciente
BEFORE INSERT OR UPDATE OF id_paciente, id_orden, id_bloque ON cita
FOR EACH ROW EXECUTE FUNCTION fn_cita_orden_mismo_paciente();
 
CREATE OR REPLACE FUNCTION fn_espera_orden_mismo_paciente()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NEW.id_orden IS NOT NULL AND NOT EXISTS (
    	SELECT 1 FROM orden_medica o
    	WHERE o.id_orden = NEW.id_orden AND o.id_paciente = NEW.id_paciente
    	AND o.id_especialidad = NEW.id_especialidad
	) THEN
    	RAISE EXCEPTION 'La orden no corresponde a paciente y especialidad de la lista de espera';
	END IF;
	RETURN NEW;
END;
$$;
CREATE TRIGGER trg_espera_orden_mismo_paciente
BEFORE INSERT OR UPDATE OF id_paciente, id_orden, id_especialidad ON solicitud_espera
FOR EACH ROW EXECUTE FUNCTION fn_espera_orden_mismo_paciente();
 
CREATE OR REPLACE FUNCTION fn_oferta_cita_coherente()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NEW.id_cita IS NOT NULL AND NOT EXISTS (
    	SELECT 1 FROM cita c JOIN solicitud_espera s ON s.id_solicitud = NEW.id_solicitud
    	WHERE c.id_cita = NEW.id_cita AND c.id_bloque = NEW.id_bloque
    	AND c.id_paciente = s.id_paciente AND c.estado_reserva <> 'CANCELADA'
	) THEN
    	RAISE EXCEPTION 'La cita resultante no corresponde al paciente y cupo ofrecidos';
	END IF;
	RETURN NEW;
END;
$$;
CREATE TRIGGER trg_oferta_cita_coherente
BEFORE INSERT OR UPDATE OF id_solicitud, id_bloque, id_cita ON oferta_cupo
FOR EACH ROW EXECUTE FUNCTION fn_oferta_cita_coherente();
 
CREATE OR REPLACE FUNCTION fn_respuesta_pregunta_misma_encuesta()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NOT EXISTS (
    	SELECT 1 FROM respuesta_encuesta r JOIN pregunta_encuesta p
      	ON p.id_pregunta = NEW.id_pregunta
    	WHERE r.id_respuesta = NEW.id_respuesta AND r.id_encuesta = p.id_encuesta
	) THEN
    	RAISE EXCEPTION 'La pregunta no pertenece a la encuesta respondida';
	END IF;
	RETURN NEW;
END;
$$;
CREATE TRIGGER trg_respuesta_pregunta_misma_encuesta
BEFORE INSERT OR UPDATE OF id_respuesta, id_pregunta ON respuesta_detalle
FOR EACH ROW EXECUTE FUNCTION fn_respuesta_pregunta_misma_encuesta();
 
CREATE OR REPLACE FUNCTION fn_prohibe_reasignacion_referenciada()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF TG_TABLE_NAME = 'documento' THEN
    	IF OLD.id_paciente IS DISTINCT FROM NEW.id_paciente
       	AND EXISTS (SELECT 1 FROM orden_medica o WHERE o.id_documento = OLD.id_documento) THEN
        	RAISE EXCEPTION 'Documento vinculado a orden: no se puede reasignar paciente';
    	END IF;
	ELSIF TG_TABLE_NAME = 'orden_medica' THEN
    	IF OLD.id_paciente IS DISTINCT FROM NEW.id_paciente
       	AND (EXISTS (SELECT 1 FROM cita c WHERE c.id_orden = OLD.id_orden)
            	OR EXISTS (SELECT 1 FROM solicitud_espera s WHERE s.id_orden = OLD.id_orden)) THEN
        	RAISE EXCEPTION 'Orden vinculada: no se puede reasignar paciente';
    	END IF;
	ELSIF TG_TABLE_NAME = 'pregunta_encuesta' THEN
    	IF OLD.id_encuesta IS DISTINCT FROM NEW.id_encuesta
       	AND EXISTS (SELECT 1 FROM respuesta_detalle d WHERE d.id_pregunta = OLD.id_pregunta) THEN
        	RAISE EXCEPTION 'Pregunta respondida: no se puede mover a otra encuesta';
    	END IF;
	ELSIF TG_TABLE_NAME = 'respuesta_encuesta' THEN
    	IF OLD.id_encuesta IS DISTINCT FROM NEW.id_encuesta
       	AND EXISTS (SELECT 1 FROM respuesta_detalle d WHERE d.id_respuesta = OLD.id_respuesta) THEN
        	RAISE EXCEPTION 'Respuesta con detalles: no se puede cambiar su encuesta';
    	END IF;
	END IF;
	RETURN NEW;
END;
$$;
CREATE TRIGGER trg_documento_no_reasignar BEFORE UPDATE OF id_paciente ON documento
FOR EACH ROW EXECUTE FUNCTION fn_prohibe_reasignacion_referenciada();
CREATE TRIGGER trg_orden_no_reasignar BEFORE UPDATE OF id_paciente ON orden_medica
FOR EACH ROW EXECUTE FUNCTION fn_prohibe_reasignacion_referenciada();
CREATE TRIGGER trg_pregunta_no_reasignar BEFORE UPDATE OF id_encuesta ON pregunta_encuesta
FOR EACH ROW EXECUTE FUNCTION fn_prohibe_reasignacion_referenciada();
CREATE TRIGGER trg_respuesta_no_reasignar BEFORE UPDATE OF id_encuesta ON respuesta_encuesta
FOR EACH ROW EXECUTE FUNCTION fn_prohibe_reasignacion_referenciada();
 
CREATE VIEW v_cita_detalle WITH (security_invoker = true) AS
SELECT c.id_cita, c.id_paciente, p.id_policlinico, p.nombre AS policlinico,
   	CASE WHEN p.es_telemedicina THEN 'TELEMEDICINA' ELSE 'PRESENCIAL' END AS modalidad,
   	e.id_especialidad, e.nombre AS especialidad,
   	COALESCE(c.id_profesional_reemplazo, a.id_profesional) AS id_profesional,
   	b.fecha, b.hora_inicio, c.canal_reserva, c.estado_reserva, c.estado_confirmacion, c.origen_cancelacion
  FROM cita c
  JOIN bloque_horario b ON b.id_bloque = c.id_bloque
  JOIN agenda a ON a.id_agenda = b.id_agenda
  JOIN policlinico p ON p.id_policlinico = a.id_policlinico
  JOIN especialidad e ON e.id_especialidad = a.id_especialidad;
 
CREATE VIEW v_indicadores_citas WITH (security_invoker = true) AS
SELECT fecha, id_policlinico, policlinico, id_especialidad, especialidad,
   	COUNT(*) AS reservas,
   	COUNT(*) FILTER (WHERE estado_confirmacion = 'CONFIRMADA') AS confirmadas,
   	COUNT(*) FILTER (WHERE estado_reserva = 'ASISTIO') AS asistencias,
   	COUNT(*) FILTER (WHERE estado_reserva = 'NO_ASISTIO') AS inasistencias,
   	COUNT(*) FILTER (WHERE estado_reserva = 'CANCELADA') AS canceladas,
   	COUNT(*) FILTER (WHERE estado_confirmacion = 'CONFIRMADA' AND estado_reserva = 'NO_ASISTIO') AS confirma_y_no_asiste,
   	COUNT(*) FILTER (WHERE estado_confirmacion = 'SIN_RESPUESTA') AS sin_respuesta
  FROM v_cita_detalle
 GROUP BY fecha, id_policlinico, policlinico, id_especialidad, especialidad;
 
CREATE VIEW v_ocupacion WITH (security_invoker = true) AS
SELECT a.id_profesional, a.id_policlinico, a.id_especialidad, b.fecha,
   	COUNT(*) FILTER (WHERE b.estado IN ('DISPONIBLE','RESERVADO')) AS bloques_ofrecidos,
   	COUNT(*) FILTER (WHERE activa.id_bloque IS NOT NULL) AS bloques_reservados
  FROM bloque_horario b JOIN agenda a ON a.id_agenda = b.id_agenda
  LEFT JOIN LATERAL (SELECT c.id_bloque FROM cita c WHERE c.id_bloque = b.id_bloque
                    	AND c.estado_reserva <> 'CANCELADA' LIMIT 1) activa ON TRUE
 GROUP BY a.id_profesional, a.id_policlinico, a.id_especialidad, b.fecha;
 
CREATE VIEW v_caracterizacion_pacientes WITH (security_invoker = true) AS
SELECT d.id_policlinico, d.fecha, pa.genero, pa.nacionalidad, co.nombre AS comuna,
   	CASE WHEN age(d.fecha, pa.fecha_nacimiento) < INTERVAL '18 years' THEN '0-17'
        	WHEN age(d.fecha, pa.fecha_nacimiento) < INTERVAL '60 years' THEN '18-59'
        	ELSE '60+' END AS tramo_edad
  FROM v_cita_detalle d
  JOIN paciente pa ON pa.id_paciente = d.id_paciente
  JOIN comuna co ON co.id_comuna = pa.id_comuna
 WHERE d.estado_reserva = 'ASISTIO';
 
CREATE VIEW v_resultado_encuestas WITH (security_invoker = true) AS
SELECT e.tipo, q.id_pregunta, q.texto, COUNT(rd.id_respuesta) AS respuestas, ROUND(AVG(rd.valor_escala), 2) AS promedio
  FROM pregunta_encuesta q
  JOIN encuesta e ON e.id_encuesta = q.id_encuesta
  LEFT JOIN respuesta_detalle rd ON rd.id_pregunta = q.id_pregunta
 GROUP BY e.tipo, q.id_pregunta, q.texto;
 
CREATE VIEW v_sesiones_orden WITH (security_invoker = true) AS
SELECT o.id_orden, o.id_paciente, o.sesiones_indicadas,
   	COUNT(c.id_cita) FILTER (WHERE c.estado_reserva = 'ASISTIO') AS asistidas,
   	COUNT(c.id_cita) FILTER (WHERE c.estado_reserva = 'NO_ASISTIO') AS inasistidas,
   	COUNT(c.id_cita) FILTER (WHERE c.estado_reserva = 'RESERVADA') AS agendadas
  FROM orden_medica o LEFT JOIN cita c ON c.id_orden = o.id_orden
 GROUP BY o.id_orden, o.id_paciente, o.sesiones_indicadas;
 
