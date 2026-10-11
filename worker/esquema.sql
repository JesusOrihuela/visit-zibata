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
