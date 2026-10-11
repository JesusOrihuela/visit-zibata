-- Identidad sin registro. Se aplica con `npm run analitica:esquema` (el mismo comando aplica los dos
-- archivos de esquema; ver docs/DESPLIEGUE.md).
--
-- Dos tablas y ninguna columna de más: no hay correo, ni nombre, ni IP, ni user agent. Una cuenta es
-- un identificador aleatorio, y lo único que la liga a un navegador es la huella de un secreto.

CREATE TABLE IF NOT EXISTS cuenta (
  id     TEXT PRIMARY KEY,   -- aleatorio y opaco: no codifica nada de nadie
  creada TEXT NOT NULL       -- ISO 8601, para la edad mínima que exige el conteo público
);

-- Varias credenciales por cuenta. Hoy solo 'dispositivo'; el día que entre Google se añade una fila
-- con proveedor 'google' apuntando a la MISMA cuenta, y por eso nadie pierde su historial.
CREATE TABLE IF NOT EXISTS credencial (
  proveedor TEXT NOT NULL,   -- 'dispositivo' | 'google'
  sujeto    TEXT NOT NULL,   -- la huella del secreto, o el `sub` de Google. Nunca el secreto en claro
  cuenta_id TEXT NOT NULL REFERENCES cuenta(id) ON DELETE CASCADE,
  creada    TEXT NOT NULL,
  PRIMARY KEY (proveedor, sujeto)
);

CREATE INDEX IF NOT EXISTS credencial_por_cuenta ON credencial (cuenta_id);

-- Los corazones. La clave primaria ES la primera defensa contra el inflado: una cuenta cuenta una
-- vez, y atacar exige fabricar cuentas, no repetir clics.
CREATE TABLE IF NOT EXISTS favorito (
  cuenta_id TEXT NOT NULL REFERENCES cuenta(id) ON DELETE CASCADE,
  lugar_id  TEXT NOT NULL,
  creado    TEXT NOT NULL,
  PRIMARY KEY (cuenta_id, lugar_id)
);

-- El conteo público agrupa por lugar y cruza con cuenta para la edad mínima.
CREATE INDEX IF NOT EXISTS favorito_por_lugar ON favorito (lugar_id);

-- Las estrellas. Una cuenta, una nota por lugar: volver a calificar sustituye, no suma.
--
-- Se guardan para que no se pierdan al cambiar de dispositivo y para alimentar el orden personal,
-- NUNCA para publicarlas. La media no sale de este servidor: lo que viaja al navegador es un empuje
-- ya calculado (ver worker/senales.ts), para que la interfaz no pueda enseñar una nota ni aunque
-- alguien quiera.
CREATE TABLE IF NOT EXISTS calificacion (
  cuenta_id TEXT NOT NULL REFERENCES cuenta(id) ON DELETE CASCADE,
  lugar_id  TEXT NOT NULL,
  estrellas REAL NOT NULL,   -- 0,5 a 5, de media en media
  creada    TEXT NOT NULL,
  PRIMARY KEY (cuenta_id, lugar_id)
);

CREATE INDEX IF NOT EXISTS calificacion_por_lugar ON calificacion (lugar_id);

-- Las visitas marcadas a mano. Una fila por cuenta, lugar y día, como la libreta del dispositivo.
--
-- No alimentan ninguna señal pública: se inflan recargando y repiten lo que ya dice el corazón con
-- más ruido. Están aquí para que el historial propio sobreviva a un cambio de dispositivo.
CREATE TABLE IF NOT EXISTS visita_marcada (
  cuenta_id TEXT NOT NULL REFERENCES cuenta(id) ON DELETE CASCADE,
  lugar_id  TEXT NOT NULL,
  fecha     TEXT NOT NULL,   -- AAAA-MM-DD en el calendario de la persona
  PRIMARY KEY (cuenta_id, lugar_id, fecha)
);

CREATE INDEX IF NOT EXISTS visita_marcada_por_cuenta ON visita_marcada (cuenta_id);
