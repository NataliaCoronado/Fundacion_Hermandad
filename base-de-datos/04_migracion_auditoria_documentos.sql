ALTER TABLE auditoria ALTER COLUMN operacion TYPE VARCHAR(80);
ALTER TABLE auditoria ALTER COLUMN id_entidad TYPE VARCHAR(120);
ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS resultado VARCHAR(10) NOT NULL DEFAULT 'EXITOSO';
ALTER TABLE auditoria DROP CONSTRAINT IF EXISTS ck_auditoria_resultado;
ALTER TABLE auditoria ADD CONSTRAINT ck_auditoria_resultado CHECK (resultado IN ('EXITOSO', 'RECHAZADO', 'ERROR'));

ALTER TABLE documento ADD COLUMN IF NOT EXISTS etiqueta_tipo VARCHAR(40);
ALTER TABLE documento ADD COLUMN IF NOT EXISTS nombre_original VARCHAR(120);
ALTER TABLE documento ADD COLUMN IF NOT EXISTS id_policlinico SMALLINT;
ALTER TABLE documento ADD COLUMN IF NOT EXISTS especialidad VARCHAR(80);
ALTER TABLE documento ADD COLUMN IF NOT EXISTS vigente_hasta DATE;
ALTER TABLE documento ADD COLUMN IF NOT EXISTS reemplaza BIGINT;
ALTER TABLE documento ADD COLUMN IF NOT EXISTS archivado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE documento ALTER COLUMN ruta_archivo DROP NOT NULL;
ALTER TABLE documento ALTER COLUMN formato DROP NOT NULL;
ALTER TABLE documento ALTER COLUMN tamano_kb DROP NOT NULL;

ALTER TABLE documento DROP CONSTRAINT IF EXISTS fk_documento_id_policlinico;
ALTER TABLE documento ADD CONSTRAINT fk_documento_id_policlinico FOREIGN KEY (id_policlinico) REFERENCES policlinico (id_policlinico) ON DELETE SET NULL;
ALTER TABLE documento DROP CONSTRAINT IF EXISTS fk_documento_reemplaza;
ALTER TABLE documento ADD CONSTRAINT fk_documento_reemplaza FOREIGN KEY (reemplaza) REFERENCES documento (id_documento) ON DELETE SET NULL;
ALTER TABLE documento DROP CONSTRAINT IF EXISTS ck_documento_formato;
ALTER TABLE documento ADD CONSTRAINT ck_documento_formato CHECK (formato IS NULL OR formato IN ('PDF', 'JPG', 'PNG'));
ALTER TABLE documento DROP CONSTRAINT IF EXISTS ck_documento_tamano;
ALTER TABLE documento ADD CONSTRAINT ck_documento_tamano CHECK (tamano_kb IS NULL OR tamano_kb BETWEEN 1 AND 10240);
ALTER TABLE documento DROP CONSTRAINT IF EXISTS ck_documento_archivo;
ALTER TABLE documento ADD CONSTRAINT ck_documento_archivo CHECK ((ruta_archivo IS NULL) = (formato IS NULL) AND (formato IS NULL) = (tamano_kb IS NULL));
