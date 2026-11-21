CREATE TABLE IF NOT EXISTS credencial (
	id_usuario     UUID PRIMARY KEY,
	hash           TEXT NOT NULL,
	actualizada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
	CONSTRAINT fk_credencial_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario) ON DELETE CASCADE
);
