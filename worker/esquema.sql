-- Visitas de la guía. Se aplica con `npm run analitica:crear` (ver docs/DESPLIEGUE.md).
--
-- Una fila por día, ruta e idioma, con un contador. No hay tabla de eventos ni de personas: nunca
-- existe una fila que diga "alguien hizo algo", solo "esta página se abrió N veces este día".
--
-- La clave primaria es la que hace posible el UPSERT de worker/analitica.ts, y de paso impide que
-- se dupliquen filas si dos visitas llegan a la vez.
CREATE TABLE IF NOT EXISTS visitas (
  fecha  TEXT    NOT NULL,            -- AAAA-MM-DD, hora de Querétaro
  ruta   TEXT    NOT NULL,            -- /lugar/tomassa
  idioma TEXT    NOT NULL,            -- es | en
  cuenta INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (fecha, ruta, idioma)
);

-- Para la consulta de siempre: "lo más visitado del último mes".
CREATE INDEX IF NOT EXISTS visitas_por_fecha ON visitas (fecha);

-- Las veces que se pegó un enlace de la guía en algún sitio.
--
-- No es tráfico y por eso no está en `visitas`: una vista previa la pide el servidor de WhatsApp (o
-- de Telegram, o de Slack) para dibujar la tarjeta, la pide aunque nadie toque el enlace, y contarla
-- como visita inflaría el número con peticiones que nadie vio. Lo que sí dice es que alguien
-- compartió esa página, que es una señal distinta y hasta ahora se tiraba a la basura.
--
-- Es un piso, no una cuenta: algunas apps repiten la petición, otras no previsualizan, y cada una
-- se identifica a su manera. Dice la tendencia, no la cifra exacta.
CREATE TABLE IF NOT EXISTS comparticiones (
  fecha  TEXT NOT NULL,
  ruta   TEXT NOT NULL,
  cuenta INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (fecha, ruta)
);

-- Las sugerencias de "Sugiere un cambio".
--
-- No cuelgan de ninguna cuenta a proposito: mandar un recado no es guardar algo tuyo, y obligar a
-- crear identidad para avisar de un horario mal puesto seria pedir mas de lo que hace falta. Lo
-- unico que se guarda de quien escribe es lo que escribio y, si quiso, un contacto para responderle.
--
-- `sello` es la huella de la prueba de trabajo que costo mandarla (la huella, no el secreto), y es
-- UNIQUE: esa sola columna hace que cada prueba valga una vez, sin tabla aparte ni caducidades (el
-- mismo arreglo que ya usa `credencial`).
--
-- `atendida` no la mueve ningun endpoint: el panel solo lee, asi que el contador de "sin leer" se
-- pone a cero con `wrangler d1 execute` (ver docs/DESPLIEGUE.md). Es a proposito: una casilla en el
-- panel seria la primera escritura que aceptara, y por ahora no la vale.
CREATE TABLE IF NOT EXISTS sugerencia (
  id       TEXT PRIMARY KEY,
  creada   TEXT NOT NULL,
  quien    TEXT NOT NULL,   -- 'vecino' | 'negocio' | 'otro'
  lugar    TEXT NOT NULL,   -- lo que escribio, no un identificador del catalogo
  mensaje  TEXT NOT NULL,
  contacto TEXT NOT NULL,   -- vacio si no quiso dejarlo
  atendida INTEGER NOT NULL DEFAULT 0,
  sello    TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS sugerencia_por_fecha ON sugerencia (creada DESC);
