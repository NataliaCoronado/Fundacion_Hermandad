-- Contraseñas de los usuarios del sistema
CREATE TABLE IF NOT EXISTS credencial (
	id_usuario     UUID PRIMARY KEY,
	hash           TEXT NOT NULL,
	actualizada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
	CONSTRAINT fk_credencial_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario) ON DELETE CASCADE
);
COMMENT ON TABLE credencial IS 'Hash scrypt de la contraseña de cada usuario del sistema.';
