# Cuentas y señales de la comunidad

Fecha: 2026-10-04, decisiones tomadas el 2026-10-06 · Estado: **plan acordado, sin empezar**.

Complementa a [ESCALABILIDAD.md](ESCALABILIDAD.md), que trata de ampliar el **catálogo** (más
sectores). Aquí se trata de ampliar el **modelo**: identidad, datos personales en un servidor y
señales de la comunidad.

Lo que sigue hasta "Antecedentes" es el plan. El resto del documento es la evaluación que lo
precedió, y se conserva porque explica por qué el plan es este y no otro.

## Las decisiones

Tomadas por el propietario el 2026-10-06, después de que el conteo de visitas (v4.9.0) demostrara que
hay servidor y que cuesta cero.

| Pregunta | Decisión |
|---|---|
| ¿Qué es público? | Los **corazones**. Las estrellas alimentan el orden pero **no se muestran**. Ver abajo |
| ¿Para qué sirve Google? | **Solo** para llegar a lo tuyo desde varios dispositivos. No desbloquea nada más |
| ¿Y si alguien borra el navegador? | **Se acepta la pérdida**, y se dice claro |
| ¿Cuánta defensa contra el inflado? | Toda la que **no cueste dinero** |
| ¿Los números públicos serán auditables? | **No.** Se guardan las filas para poder moderar, no para exhibir de dónde sale cada número |

Y una regla que queda derogada: *"sin reseñas, ratings, publicidad"* y *"la guía no publica medias"*
se escribieron cuando todo era local y no había con qué hacer nada mejor. La intención de fondo (una
guía útil que recoja los menos datos posibles) manda sobre la letra.

### Qué se publica, exactamente

**Corazones, sí.** Requieren intención, van uno por cuenta y a esta escala se leen bien: "12 vecinos
lo guardaron" dice algo verdadero. Con un umbral: **por debajo de cinco no se muestra nada**, porque
"1 persona lo guardó" es peor que el silencio para un local recién abierto.

**Visitas, no.** Miden curiosidad, no calidad; son lo más fácil de inflar (basta recargar) y lo más
caro de defender sin guardar más datos por persona, que es lo contrario de lo que se busca. Y repiten
la señal del corazón con más ruido. Si alguna vez hace falta superficie de popularidad, a esta escala
rinde más una **lista** ("lo más abierto esta semana en tu zona") que un número por ficha.

**Estrellas, nunca a la vista.** Pero con un matiz que no es menor: un promedio escondido que
reordena sigue siendo visible **en su efecto**, y con 101 locales y pocos votos, tres votos
malintencionados hunden a alguien que no puede verlo ni rebatirlo. Por eso el promedio global
**solo puede subir, nunca bajar**: un lugar muy bien calificado gana impulso; uno mal calificado
nunca cae por debajo de su línea base. Así una brigada no sirve como arma, solo como empujón, que
hace menos daño y se nota antes.

Con esto, *"la guía no publica medias"* **sigue siendo cierto**: se publica un conteo, nunca una nota.

## El diseño

### La identidad es una sola, y Google es solo otra llave

La pieza que decide todo lo demás. Si la cuenta anónima y la de Google fueran dos cosas distintas, el
día que llegue Google se perdería el historial de todo el mundo. Así que no lo son: hay **una cuenta**
y puede tener **varias credenciales**.

```sql
cuenta(id TEXT PRIMARY KEY, creada TEXT)

credencial(
  proveedor TEXT,        -- 'dispositivo' hoy, 'google' mañana
  sujeto    TEXT,        -- el secreto del navegador, o el `sub` de Google
  cuenta_id TEXT,
  creada    TEXT,
  PRIMARY KEY (proveedor, sujeto)
)
```

Entrar con Google no crea una cuenta: **añade una fila a `credencial`** apuntando a la que ya tienes.
Por eso Google puede llegar después sin tocar nada de lo anterior, que es justo lo que se decidió.

El `id` de cuenta es opaco y aleatorio. No se guarda correo, ni nombre, ni IP, ni user agent. El día
que entre Google se guarda su `sub`, que es un identificador suyo, no un dato personal legible.

### El secreto del dispositivo

El Worker lo genera al primer gesto que lo necesite (dar un corazón, no al entrar), lo devuelve una
vez y el navegador lo guarda junto a lo demás de Mi Zibatá. Viaja como cabecera en las escrituras.

**Quien lo pierde, pierde la cuenta.** Es la decisión tomada, y la página de privacidad tiene que
decirlo con esas palabras, no esconderlo. Un "código de transferencia" para recuperarla sería peor:
quien tenga el código es dueño de los datos, y eso sí hay que prometerlo y sostenerlo.

### Los datos

```sql
favorito(cuenta_id, lugar_id, creado,        PRIMARY KEY (cuenta_id, lugar_id))
calificacion(cuenta_id, lugar_id, estrellas, actualizada, PRIMARY KEY (cuenta_id, lugar_id))
visita(cuenta_id, lugar_id, veces, ultima,   PRIMARY KEY (cuenta_id, lugar_id))
```

Tres tablas, todas con la misma clave. Esa clave primaria **es** la primera defensa contra el
inflado: una cuenta cuenta una vez, y atacar exige fabricar cuentas, no repetir clics.

La tabla `visitas` del conteo anónimo (fecha, ruta, idioma) **no se toca y no se mezcla**: sigue sin
identidad, como está hoy. Son dos cosas distintas y conviene que lo sigan siendo.

### La fusión, que es donde se pierden los datos si se hace mal

Cuando alguien entra con Google en un segundo dispositivo hay tres casos, y el tercero es el que hay
que escribir con cuidado:

1. **Google desconocido** → se añade la credencial a la cuenta de este dispositivo. Nada más.
2. **Google conocido, dispositivo sin cuenta** → este dispositivo adopta esa cuenta.
3. **Google conocido y dispositivo con cuenta propia** → hay que **fusionar**. Favoritos, la unión.
   Visitas, la suma. Calificaciones, la más reciente por lugar. La credencial del dispositivo
   reapunta a la cuenta que se queda, y la otra se borra.

Tiene que ser idempotente (repetirla no cambia el resultado) y no puede perder nada. Es la única
parte de todo esto que merece pruebas antes de escribir el código que la usa.

### Contra el inflado, sin gastar un peso

En este orden, porque cada capa encarece la anterior y ninguna cuesta dinero:

1. **La clave primaria `(cuenta_id, lugar_id)`.** Una cuenta, un corazón. Estructural, gratis, y la
   que más trabajo ahorra: atacar exige fabricar cuentas, no repetir clics.
2. **Prueba de trabajo al crear la cuenta**, no en cada gesto. El navegador busca un secreto cuya
   huella empiece por 16 ceros; el servidor lo comprueba con un hash. Que cada prueba valga una sola
   vez sale gratis, porque la huella es la clave primaria de `credencial`.
3. **Límite de ritmo** en el borde de Cloudflare sobre `POST /api/cuenta`. Es configuración, no
   código, y la IP la cuenta Cloudflare sin que llegue nunca a este código ni a la base.
4. **Edad mínima de 24 horas**: los corazones de una cuenta recién creada no cuentan para el número
   público. Convierte un ataque instantáneo en uno que hay que sostener un día entero.
5. **Umbral de 5** y **tope por cuenta**. El umbral es un suelo de privacidad; el tope sigue al
   catálogo (ver abajo).
6. **Se guardan las filas, no solo el contador.** Con un número suelto, un ataque es irreversible;
   con las filas se borra lo sospechoso y se recalcula. Esto es para **poder moderar**, no para
   exhibir de dónde sale cada número: lo segundo se descartó.

Lo que esto **no** hace: eliminar el abuso. Lo encarece. Para corazones el daño de un ataque exitoso
es bajo y se asume.

#### Por qué una prueba de trabajo y no un captcha

La capa 2 fue Turnstile durante la v4.11, y se cambió por una razón concreta. Turnstile funciona
rechazando navegadores: ese es su trabajo. Quien usa Tor, un bloqueador duro o una red que filtra
dominios se quedaba fuera, y el fallo era **mudo**: su corazón se guardaba en su dispositivo, no
contaba nunca, y no había nada que pudiera hacer al respecto. Se comprobó en un navegador real antes
de decidirlo: el widget ni emitía ficha ni dibujaba nada que se pudiera resolver.

La prueba de trabajo no rechaza a nadie: solo usa `crypto.subtle`, que existe en todos los
navegadores, y de paso devolvió la política de seguridad a `script-src 'self'` y `frame-src 'none'`,
sin un solo script de terceros en toda la guía.

El costo, sin adornos: es más débil contra alguien decidido, porque la CPU se alquila y en código
nativo cada intento cuesta una fracción. Lo que para en seco es el bucle de veinte líneas que pide
mil cuentas, que es la forma que de verdad tiene este problema en una guía de barrio. El resto lo
sostienen las capas 3, 4 y 5.

#### Qué escala y qué no

| Defensa | ¿Escala? |
|---|---|
| Clave primaria | Sí, es estructural |
| Prueba de trabajo (16 bits) | Es un dial. Lo que manda para elegirlo es el peor teléfono que se quiera admitir, no el mejor |
| Límite de ritmo | Sí, lo aplica Cloudflare |
| Edad mínima (24 h) | Sí: mide tiempo, no gente |
| Umbral (5) | **No sube a propósito.** Es un suelo de privacidad, no un filtro de popularidad: con uno o dos, el número delata a quien lo guardó, y esa razón no cambia con el tamaño. Atarlo a la población solo escondería a los locales pequeños cuando la guía creciera |
| Tope por cuenta (150) | Sigue al catálogo, y lo ata una prueba: `worker/favoritos.test.ts` lee `data/` y falla si los lugares se acercan al tope. Así no se queda en un número de otra época, que es lo que le pasó al 500 anterior con 101 locales |
| Tope por petición (100) | Es un guardia de tamaño de cuerpo, no depende de nada |

### Qué cuesta

Todo cabe en los planes gratuitos que ya se usan: Workers (100.000 peticiones al día) y D1 (5 GB,
millones de lecturas y 100.000 escrituras al día). La prueba de trabajo no cuesta nada porque la paga
el navegador de quien crea la cuenta. Con 101 locales y público de barrio, no se rozan. Si algún día se rozaran, sería una buena noticia y habría con qué pagarlo.

### El orden de la obra

Cada paso deja algo funcionando y se puede parar ahí:

1. **Identidad y credencial de dispositivo, sin datos todavía.** Crear la cuenta, devolver el secreto,
   reconocerla. Prueba el camino entero con el riesgo más bajo posible.
2. **Favoritos al servidor**, con lo local como caché y la escritura optimista. Es la pieza que prueba
   el patrón completo: carga, error, escritura pendiente y conflicto.
3. **Calificaciones y visitas**, que ya son el mismo patrón.
4. **El corazón público en la interfaz**, con su umbral de cinco, y el promedio que solo sube.
5. **Google como credencial extra**, con la fusión. Lo último, porque hasta aquí no hace falta.

### Lo que hay que reescribir cuando llegue el paso 2

La página de privacidad, otra vez, y esta vez de verdad: deja de ser cierto que *"todo se guarda
únicamente en este navegador"*. Habrá que decir qué sube, que no hay correo ni nombre, que perder el
navegador es perder la cuenta, y cómo se borra todo. Se escribe cuando el paso 2 esté hecho, no
antes, para no prometer una forma que todavía puede cambiar.

## Antecedentes

Lo que sigue es la evaluación del 2026-10-04, anterior a que existiera el servidor. Se conserva
porque explica por qué el plan de arriba es este y no otro. Algunas de sus conclusiones ya no
aplican: el alojamiento dejó de ser el bloqueo (hay Worker y D1 desde la v4.9.0) y la regla que
prohíbe cuentas ya no está vigente.

## Conclusión corta

El catálogo está listo. Lo personal está preparado sobre el papel pero no en la práctica. El
alojamiento y lo que la guía tiene publicado son el cuello de botella real, y ninguno de los dos es
código.

Dicho de otro modo: **las costuras están puestas en los sitios correctos**, y aun así migrar no es
registrar tres implementaciones nuevas. Lo que falta es el contrato que esas costuras suponen hoy
(síncrono, sin fallo posible, un solo usuario) y todo lo que rodea al código.

## Lo que ya está listo

| Pieza | Por qué aguanta | Qué habría que hacer |
|---|---|---|
| Catálogo | `PlacesRepository` es una interfaz asíncrona de tres métodos, inyectada en `src/app/App.tsx`. `CatalogProvider` ya tiene estados de carga, error y reintento. | Una clase nueva. Nada más. |
| Señales de comunidad | `SocialStatsSource` en `src/features/favorites/socialStats.ts`, con objeto nulo por defecto y `setSocialStatsSource`. La ficha y las tarjetas ya saben dibujarlas. | Registrar la fuente. |
| Señales personales | `PreferenceSource` en `src/features/ranking/preferences.ts`, con `setPreferenceSource`. `rankPlaces` no sabe de dónde salen. | Registrar la fuente. |
| Migración del historial | `localProfileSnapshot()` ya devuelve exactamente lo que habría que subir una vez: favoritos, calificaciones, visitas e interacciones. | Llamarla al vincular la cuenta. |
| Estado de la aplicación | `AppState` es solo navegación y vista. No hay identidad en ningún sitio, así que añadirla es aditivo, no una reescritura. | Un contexto de sesión al lado. |
| Validación | Zod en el build y validación registro a registro en runtime (`runtimeValidation.ts`), que omite lo inválido con aviso. Sirve igual para una respuesta de API que para un JSON. | Nada. |
| Disciplina asíncrona | Ya existe: `CatalogProvider` cancela al desmontar, hay reintento, y hay pruebas de datos caídos, mapa caído, cartografía caída y sin conexión. | Nada. |
| Enrutado y OAuth | Con PKCE el código vuelve en la **query**, y `useUrlSync` conserva `window.location.search` al reescribir la URL. | Limpiar el parámetro tras canjearlo. |
| Dependencias | No hay enrutador ni librería de estado ni de datos que quitar o pelear. | Nada. |

## Lo que no está listo

### 1. Todo lo personal es síncrono y no puede fallar

Es el punto caro. `LocalStore` (`src/lib/localStore.ts`) declara `read(): T` y `write(value: T):
void`, y esa forma se usa **durante el render**: `preferences.read()` se llama dentro de un `useMemo`
en `src/features/ranking/usePersonalOrder.ts` y en `src/app/useExperience.ts`. Un servidor es
asíncrono y falla.

Hay dos salidas y conviene elegir a conciencia:

- **Caché caliente detrás de la misma interfaz.** La implementación nueva sirve de memoria lo último
  conocido (que es lo que `useSyncExternalStore` necesita) y revalida contra el servidor en segundo
  plano, avisando por `subscribe`. Casi nada cambia aguas arriba. **Es la que recomiendo.**
- Hacer asíncrona la interfaz. Obliga a tocar todos los consumidores y a inventar estados de carga
  donde hoy no hay ninguno.

Con cualquiera de las dos sigue faltando lo que hoy no existe porque no hacía falta: **estado de
carga, estado de error, escritura pendiente y resolución de conflicto entre dispositivos**. Esa es la
mayor parte del trabajo, y no la ahorra ninguna costura.

### 2. Las claves de almacenamiento no llevan usuario

`'zibata:favoritos'`, `'zibata:calificaciones'`, `'zibata:visitas'`, `'zibata:interacciones'` son
globales del navegador. Dos cuentas en el mismo dispositivo se pisarían. La clave tendría que
derivarse de la sesión, y hay que decidir qué pasa al cerrar sesión: si se borra lo local, quien
entre con otra cuenta no ve lo ajeno; si no se borra, se filtra entre personas.

### 3. Las escrituras no pueden fallar a la vista

`write()` devuelve `void`. Hoy, si el almacenamiento está bloqueado (modo privado), se queda en
memoria en silencio, y es aceptable porque el dato nunca salió del dispositivo. Con servidor hay 401,
409 y sin conexión, y la interfaz no tiene hoy ninguna forma de decir "esto no se guardó".

### 4. La CSP y la prueba que la respalda

`connect-src 'self' https://api.web3forms.com` tendría que admitir el origen de la API, y
`tests/e2e/security.spec.ts` afirma **cero peticiones externas** en todo el recorrido. Las dos cosas
son fáciles de cambiar; lo que importa es que son una decisión consciente, no un descuido que
corregir.

### 5. El alojamiento (el bloqueo real)

GitHub Pages no sirve cabeceras propias (ya está anotado en [SEGURIDAD.md](SEGURIDAD.md) a cuenta de
`frame-ancestors`) ni reescrituras. Sin cabeceras no hay cookie de sesión del mismo origen, así que
quedan dos caminos:

- apoyarse en un tercero (Supabase, Auth0, Clerk) con el token en JavaScript, con lo que eso implica
  para XSS y para la promesa de "todo es del propio origen";
- mudar el alojamiento a uno que sirva cabeceras y rutas.

Esa mudanza ya se hizo por el SEO ([MARCA.md](MARCA.md) §6): el sitio lo sirve un Worker de
Cloudflare con assets estáticos y cabeceras propias, así que de los dos caminos queda abierto solo el
primero, y es una decisión de infraestructura, no de código.

### 6. Lo publicado promete lo contrario

No son comentarios internos, es producto: `about.privacyLead` y `about.privacyBody` en los dos
idiomas, [SEGURIDAD.md](SEGURIDAD.md), la auditoría de la 1.0.0 y una prueba que afirma la cadena
"no usa cuentas, analítica ni cookies". Pasar a cuentas obliga a reescribir la política y, muy
probablemente, a añadir consentimiento, exportación y borrado de datos. Es trabajo de cumplimiento,
no de refactor, y es el que más tarda.

### 7. El presupuesto de peso ya está al tope

`initialJs` está en 120,6 KB con un límite de 120 (ver CHANGELOG 4.1.0). Un SDK de autenticación no
cabe sin resolver antes esa decisión. Conviene contarlo como parte del costo, no como una sorpresa.

## Por qué tendrían que existir las cuentas

Conviene decirlo porque cambia el cálculo: **guardar favoritos no justifica una cuenta**, eso ya lo
hace localStorage sin pedir nada a nadie. Las cuentas se pagan solas por dos cosas:

1. **Sincronizar entre dispositivos.** Lo que marcas en el teléfono aparece en la computadora.
2. **Publicar señales de la comunidad.** Cuánta gente ha guardado un lugar y su media. Es lo que la
   arquitectura ya tiene preparado (`SocialStatsSource`) y lo único que una guía estática no puede
   dar.

Si no se va a hacer la segunda, el costo (política de privacidad, consentimiento, borrado,
alojamiento, mantenimiento de una base de datos) probablemente no se paga.

## El orden en que lo haría

1. **Sesión sin datos.** Identidad, entrar y salir, nada más. Todo lo personal sigue en el
   dispositivo. Sirve para resolver alojamiento, CSP y política con el riesgo más bajo posible.
2. **Una sola colección al servidor: favoritos.** Con la implementación de caché caliente detrás de
   `createLocalStore`. Es la pieza más barata y prueba el patrón entero: carga, error, escritura
   pendiente y conflicto.
3. **El resto de colecciones**, y `localProfileSnapshot()` como subida única al vincular la cuenta.
4. **Señales de comunidad** (`setSocialStatsSource`), que es lo que de verdad justificaba todo.

## Anónimo primero: lo que hace falta de verdad

Añadido el 2026-10-04, a petición del propietario: señales globales **sin registro**, con registro
opcional encima.

Conviene decirlo antes que nada porque cambia la conclusión de arriba: **este modelo es mejor que el
que evalúa el resto del documento.** Si lo global funciona sin cuenta, la cuenta deja de ser un peaje
y pasa a ser un extra (sincronizar entre dispositivos). Desaparece la fricción de alta, el
consentimiento forzado y casi toda la política dura, y se conserva lo único que justifica tener
servidor: que lo que hace la gente se vea.

### Las tres piezas

**1. Alojamiento.** [DESPLIEGUE.md](DESPLIEGUE.md) ya lista los requisitos de hoy. Lo que cambia al
cambiar de hosting:

| | Hoy | Con usuarios |
|---|---|---|
| `Range` para el mapa | **Ya no hace falta**: las teselas se sirven sueltas desde la v4.7.0 | Igual: nada que verificar |
| CSP | En `<meta>` y en cabecera, de la misma constante | Igual, más el origen del backend en `connect-src` |
| Reescrituras | No hacen falta: hay un archivo HTML por ruta, generado en el build | Igual: el prerenderizado ya cubre el enrutado |
| Variables de entorno | `BASE_PATH` y `SITE_URL` al compilar | Más la URL y la clave pública del backend |

Cualquier servidor de archivos estáticos cumple las cuatro. Esa lista encogió a propósito: el
requisito de `Range` se quitó porque fue el que tumbó el mapa al mudarse a un Worker con assets
estáticos, y un requisito que nadie vuelve a comprobar es una trampa esperando a la siguiente mudanza.

**Esto ya está hecho y no espera al backend:** el build prerenderiza una página por lugar, por plaza
y por página de información, en los dos idiomas (234 archivos), cada una con su `<title>`, su
`description`, su `canonical`, sus `hreflang` y su imagen de vista previa. No necesitó servidor ni
dependencia nueva: es el mismo patrón de los plugins de `vite.config.ts`, emitiendo varios archivos
([ARQUITECTURA.md](ARQUITECTURA.md) § Una página por ruta).

**2. Identidad anónima.** Lo que describes tiene nombre y está resuelto: *anonymous sign-in*. Al
primer gesto que lo necesite, el backend crea un usuario real sin correo ni contraseña y guarda la
sesión en el navegador. Desde ahí:

- lo que marcas se atribuye a ese id, así que un corazón por persona, se puede quitar, y sobrevive a
  recargar;
- el día que quieras registrarte, se **vincula** un correo o un proveedor a esa misma fila: no se
  pierde nada de lo ya marcado y no hay que migrar nada;
- quien solo lee no necesita sesión de ninguna clase.

Supabase lo trae de serie (Postgres, políticas por fila, sesión anónima y vinculación posterior).
La alternativa, si se prefiere un solo proveedor y el cliente más liviano posible, es Cloudflare
Workers con D1, a cambio de escribir el manejo de sesión a mano.

**3. Datos.** Dos tablas de escritura (marcas y calificaciones, con clave primaria `(user_id,
place_id)`, que es lo que impide contar dos veces) y una tabla de agregados mantenida por disparador.
Las políticas por fila hacen el trabajo:

- en las tablas de escritura, cada quien solo ve y toca sus filas;
- la tabla de agregados es **legible por el rol anónimo**, sin sesión ninguna.

Eso último es literalmente lo que pediste: los números globales salen en la primera pintura sin que
nadie haya iniciado nada. Y como son agregados públicos, se pueden cachear en el borde.

### Cómo encaja con lo que ya existe

- `SocialStatsSource` es el lado de lectura. Ya es registrable y la interfaz ya sabe dibujar lo que
  devuelva.
- `PreferenceSource` es el lado de escritura. También registrable.
- `localProfileSnapshot()` es la subida única al vincular una cuenta.
- Sigue faltando lo del § 1 de este documento: carga, error, escritura pendiente y conflicto. No lo
  ahorra ningún proveedor.

### El truco para no romper el presupuesto de peso

`initialJs` está en 120,6 KB con límite de 120, así que un SDK en el arranque no cabe. No hace falta:

- **las lecturas son públicas** y se piden con `fetch` a secas, sin SDK y sin sesión;
- **solo las escrituras** necesitan sesión, así que el SDK se carga en diferido al primer gesto que
  escriba.

Con ese reparto el paquete inicial no se mueve.

### Qué verificar antes de comprometerse

1. **Cómo sirve los archivos el host elegido.** Ya no hace falta `Range`, pero sí que un camino
   inexistente dé 404 y que no se añada una barra final a los archivos. La lección de la v4.7.0 es
   que esto se comprueba **contra el sitio publicado**, no en la documentación del proveedor.
2. **Cuánto pesa el SDK**, medido y no supuesto, antes de decidir si se carga en diferido o se habla
   con la API a mano.
3. **Qué hace el plan gratuito con la inactividad.** Varios proveedores suspenden proyectos sin
   tráfico, y una guía de barrio tiene semanas tranquilas.

### Los dos problemas honestos

**Abuso.** Una identidad anónima es gratis de crear: quien quiera inflar un contador puede. Se
mitiga (una fila por identidad, límite de ritmo, no contar hasta que haya algún uso real), no se
elimina. Para corazones y visitas el daño es bajo y se asume. Para una calificación pública no.

**La regla del proyecto lo prohíbe, y por una razón que conviene mirar de frente.**
[AGENTS.md](../AGENTS.md) dice: *"Sin reseñas, ratings, publicidad, reservas ni rastreo"*. Corazones
y visitas son señales de interés agregadas y encajan razonablemente con el espíritu de la guía. Una
**media de estrellas pública es otra cosa**: convierte la guía en un sitio de reseñas. Un negocio
puede verse perjudicado por una media baja construida con cuatro votos anónimos, y eso trae
moderación, derecho de réplica y una vía de reclamación, con una sola persona manteniéndolo.

Recomendación: **abrir corazones y visitas, y dejar las calificaciones privadas en el dispositivo**,
como están hoy. Se obtiene casi toda la señal de comunidad con una fracción de la responsabilidad. Si
aun así se quieren públicas, que sea una decisión escrita, con un mínimo de votos antes de publicar
una media y una vía para que un negocio reclame.

Un apunte de redacción: "visitas" aquí son visitas **que la gente marca a mano**, no afluencia
medida. Al publicarlas en global conviene que el texto lo diga, o se leerán como lo segundo.

### La privacidad hay que reescribirla, y con precisión

Hoy la guía dice *"no usa cuentas, analítica ni cookies de rastreo"* y que todo *"se guarda
únicamente en este navegador"*. Con sesión anónima hay **un identificador seudónimo persistente** en
el navegador. No es rastreo entre sitios, pero es un identificador, y describirlo de menos sería
exactamente lo que esta guía no hace con los datos de los negocios. El texto nuevo tiene que decir
qué se guarda, dónde, por cuánto tiempo y cómo se borra.

## Preguntas resueltas (2026-10-04)

### Hetzner: evaluado y descartado

Proveedor alemán de máquinas virtuales, muy barato y muy bueno en lo suyo. No sirve aquí porque
entrega **una máquina vacía, no un servicio**: sistema, nginx, TLS, Postgres, respaldos, cortafuegos
y actualizaciones pasan a ser trabajo propio, que es justo el trabajo que hoy no existe. Dos pegas
concretas más: desde Querétaro a sus regiones europeas hay unos 150 ms (habría que usar la de Estados
Unidos), y sin CDN delante los 2 MB de teselas se arrastran, así que acabaría
habiendo dos cosas que mantener en lugar de una. Tendría sentido el día que se quiera ser dueño de la
base de datos; con 101 locales y público de barrio, los planes gratuitos quedan lejos de agotarse.

### Capas contra el inflado de contadores

En este orden, porque cada una encarece la anterior:

1. **Clave primaria `(user_id, place_id)`**: una identidad cuenta una vez. Atacar exige fabricar
   identidades, no repetir clics.
2. **Turnstile** (Cloudflare, gratis y sin captcha visible) antes de crear una identidad.
3. **Límite de ritmo** por identidad y por IP, en el borde.
4. **Guardar las filas, no solo los contadores.** Es lo más importante: con solo el número, un ataque
   es irreversible; con las filas se borra lo sospechoso y se recalcula.
5. **Detección de anomalías** por ráfaga y por red de origen.

No elimina el abuso, lo encarece. Para corazones y visitas el daño es bajo y se asume.

### Varios dispositivos: solo con cuenta

Una sesión anónima vive en ese navegador por definición. Cruzar dispositivos exige algo que la
persona pueda demostrar en el otro lado, y esa es la razón de ofrecer registro opcional. **Entrar con
Google** es lo más corto para este público y evita entrar en el negocio de entregar correo. Al
vincular, se enlaza a la misma fila anónima: no se pierde lo marcado. Un "código de transferencia"
entre dispositivos evita la cuenta y es mala idea: quien tenga el código es dueño de los datos.

### Qué hace falta montar

**Paso cero, ya hecho: subir el repositorio a un remoto.** El código vive en
<https://github.com/aurariola-studio/visit-zibata> y se publica desde GitHub Actions.

| Qué | Para qué | Costo | Estado |
|---|---|---|---|
| Dominio `visitzibata.com` | Identificado como libre en [MARCA.md](MARCA.md) | ~12 USD/año | Hecho |
| Alojamiento en Cloudflare | Cabeceras, Turnstile, CDN | 0 | Hecho: Worker con assets estáticos |
| `.github/workflows/deploy.yml` | Compilar, pasar las puertas y publicar | 0 | Hecho |
| Proyecto de backend, región este de EE. UU. | Identidad y señales | 0, o ~25 USD/mes al crecer | Pendiente |

Y tres cosas que no son cuentas y son el trabajo real:

- **Las llaves.** La clave pública va en el build a propósito: lo que protege los datos son las
  políticas por fila, no la llave. La de servicio **nunca** toca el cliente.
- **Respaldos propios**, sin confiarse al plan gratuito.
- **Quién se entera cuando se rompe.** Hoy no hace falta que nadie se entere.

### Qué más abre un backend

Por valor, de mayor a menor:

1. **Métrica agregada y anónima.** [ESCALABILIDAD.md](ESCALABILIDAD.md) cierra diciendo que antes de
   ampliar sectores hay que saber si la gente vuelve, y hoy no hay ninguna señal. Es lo más barato y
   lo que más decisiones desbloquea.
2. **El formulario de sugerencias deja de depender de un tercero**: las correcciones caen en una
   tabla con estado en vez de en un correo, y sale un origen externo de la CSP.
3. **Que el negocio confirme sus propios datos**, con fecha de última confirmación y caducidad. Es el
   "cuello de botella real" que ESCALABILIDAD.md § 3 identifica para crecer, y no se puede resolver
   sin servidor.

Pensar dos veces: comentarios (ver abajo), calificaciones públicas (§ "Los dos problemas honestos") y
fotos subidas por usuarios, que chocan con la regla de no usar fotos de terceros.

**Tener backend no significa mover todo ahí.** El catálogo sigue siendo JSON estático en el
repositorio: rápido, versionado, revisable en un diff y no se cae. Datos de negocios en git, señales
de personas en la base de datos. Mezclarlos es el error común.

### Comentarios: recomendación de no hacerlo

No existen hoy y abrirlos es otro producto, no una ampliación. Son contenido público de terceros
**sobre negocios reales con nombre**: difamación, suplantación y venganzas, con una sola persona
respondiendo. La única moderación que funciona a esa escala es la cola previa, es decir, leerlo todo
para siempre. Y el canal correcto ya existe: "Sugiere un cambio" recoge correcciones en privado, que
es la necesidad real. El valor de la guía es que el dato está verificado; una zona de comentarios
invierte exactamente eso.

## Riesgos

1. **La privacidad es parte del producto.** Hoy "no hay cuentas" no es una limitación que se disculpa,
   es un argumento que la guía dice en voz alta en su propia interfaz. Cambiarlo cambia lo que la guía
   es, no solo lo que hace.
2. **Una base de datos hay que cuidarla.** Hoy un fallo del sitio es una página que no carga. Con
   cuentas hay datos de personas que se pueden perder, filtrar o corromper, y una persona sola
   manteniéndolos.
3. **Nada de esto se revierte barato.** Publicada una cuenta, retirarla es perder datos de gente.

## Señal para decidir

La misma que cierra [ESCALABILIDAD.md](ESCALABILIDAD.md): si la guía todavía no es un hábito, las
cuentas no la harán más útil. Antes de abrir la fase 1 conviene saber si la gente vuelve, y si lo que
pide es sincronizar entre sus dispositivos o ver lo que opinan los demás. Son dos productos distintos
y solo el segundo necesita que la comunidad sea visible.
