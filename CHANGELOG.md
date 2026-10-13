# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico.

## [4.25.0]: 2026-10-12

### Cambiado

- **Los filtros viven sobre un plano, no flotando sueltos sobre el mapa.** La versión anterior les
  quitó el fondo a los controles, y eso no es lo mismo que tener un plano: detrás no hay papel, hay
  un mapa 3D con edificios, calles y árboles, y ahí ninguna sombra de texto se lee. Se veían como
  piezas sueltas flotando.

  Ahora hay una superficie **sólida** que los contiene, y dentro los controles van planos y se
  distinguen por su forma. Las categorías eran **dieciocho pastillas con cristal y sombra propios**,
  que es el caso extremo de "cuando todo flota, nada está delante"; ahora son planas dentro del
  plano. La franja del pie recupera también superficie, por el mismo motivo.

  Quedan **dos** superficies de cristal en toda la guía, de las diez que había: el plano de búsqueda
  y el velo del diálogo que esté abierto, y nunca coinciden más de dos en pantalla.

- **La fila de contexto es una retícula con tres sitios con nombre** (ámbito, llaves, salida) en vez
  de un `flex-wrap`. Con `wrap` los controles saltaban de renglón en cualquier orden según el ancho,
  y una barra que se recoloca sola no se puede aprender. Debajo de 600 px van apilados, encima en
  línea, y nunca cambian de orden. La consulta es **de contenedor**, no de ventana, porque la barra
  también se estrecha al abrir el panel de escritorio.

  Con dos sitios, "Abierto ahora" se partía en dos renglones a 375 px: medido, llaves y salida juntas
  pedían 420 px contra 358 disponibles. Un texto que se pulsa no se parte nunca.

### Corregido

- **Una plaza degradada a punto podía quedar bajo la insignia de la vecina y dejar de poder pulsarse.**
  El solucionador comparaba el punto solo contra otros puntos, ignorando las etiquetas, para que
  "ninguna plaza desaparezca del mapa". La promesa era falsa: un punto tapado no desaparece, pero
  tampoco se alcanza, que es peor porque parece alcanzable.

  Ahora el punto prefiere un sitio limpio y, si no hay ninguno, entra igual y se dibuja por encima.
  Se cumplen las dos promesas: ninguna plaza queda fuera y la que entra forzada se puede pulsar.

  El fallo no venía de esta tanda: llevaba en esa línea desde que se escribió. Lo destapó que la
  barra superior creciera de **157 a 221 px** al ganar áreas pulsables de 44 px, porque lo que crece
  arriba se lo quita al mapa. Antes del cambio ya había cinco plazas degradadas a punto.

## [4.24.0]: 2026-10-12

### Cambiado

- **Cada filtro toma la forma de su dato, en vez de ser todos una píldora.** Las dos versiones
  anteriores cambiaron color y agrupación, pero los cuatro controles seguían siendo cápsulas
  iguales. El radio deja de ser una herramienta de jerarquía en cuanto todo lo lleva: entonces solo
  es adorno, y moverlo desparejaba la fila sin explicar nada.

  | Control | Qué es | Forma |
  |---|---|---|
  | Zona | un desplegable de once nombres | texto con filete debajo |
  | Abierto ahora, Favoritos | binarios de efecto inmediato | interruptores con vía y perilla |
  | Resultados | información | texto |
  | Categorías | muchas opciones de un eje | píldoras, que es su uso correcto |

  Los interruptores son `role="switch"` con `aria-checked`, no botones disfrazados: lo que se ve y lo
  que se escucha dicen lo mismo.

- **La fila de filtros deja de aportar superficies de cristal.** Había **nueve** con la misma receta
  (fondo translúcido, desenfoque, filete y sombra) y con nueve primeros planos no hay ninguno. El
  desenfoque queda para la barra de búsqueda y las pastillas de categoría, que es lo que se toca
  primero; el resto se apoya plano sobre el mapa y se lee por su sombra de texto.

  Medido contra los dos peores fondos del mapa: los interruptores dan 10,3:1 y el resumen 7,3:1.

- **El nombre de la zona va en tinta y el color de la zona en el filete.** En color daba 4,42:1 sobre
  las manchas verdes del mapa, por debajo del 4,5 que pide un texto. En tinta da 8,97. El filete es
  un objeto gráfico y le basta 3:1: comprobadas las once plazas, la peor da 3,36.

## [4.23.0]: 2026-10-12

### Corregido

- **El tallo de los marcadores se había soltado de su etiqueta.** En la v4.21 se cambió de `height` a
  `scale` aplicando la regla de no animar propiedades de disposición, sin mirar qué hacía esa
  propiedad: `.anchor` es una columna flex anclada por su base, así que **el alto del tallo es lo que
  sube la etiqueta**. Con `scale` la caja seguía midiendo 14 px, el tallo se estiraba hacia abajo y
  la etiqueta se quedaba donde estaba.

  Vuelve a `height`, y queda escrito en el CSS que ahí la regla tiene excepción: el nivel de
  elevación solo cambia cuando el solucionador de choques reparte etiquetas, no en cada fotograma.
  Medido: los once marcadores dan 0 px de separación entre el pie de la etiqueta y la cabeza del
  tallo, incluidos los elevados a 62 y 110 px.

- **Un local cerrado temporalmente decía "Abierto" en su horario.** `estadoDe()` se escribió para que
  la pregunta viviera en un sitio y quedó una llamada sin migrar: `HoursTable` seguía preguntándole
  al horario, que responde "Abierto" con razón y aun así es falso. Ahora recibe el cierre y calla el
  estado en vivo; el aviso ámbar de arriba es la única afirmación.

- **El aviso de cierre tenía 32 px arriba y 20 abajo**, por un `margin-top` encima del `gap` del
  contenedor. El hueco lo reparte el contenedor.

- **El aro de las fotos salía grueso y escalonado.** Iba a 1,5 px y con `box-shadow`, que sobre una
  curva se dibuja como sombra difuminada y escalona. Ahora es `outline` a 1 px: sigue el radio, lo
  dibuja el navegador como trazo, y vuelve a ser el filete fino de siempre con el color de su plaza.

- **El contador de "Abierto ahora" anunciaba un resultado más de los que daba.** `useExperience`
  seguía preguntándole al horario directamente, así que contaba como abierto un local en obra que el
  filtro excluía. Es el tercer sitio del mismo cambio donde se escapó la misma pregunta.

  Para que no haya un cuarto, `scripts/convenciones.test.ts` falla si cualquier archivo fuera de tres
  permitidos importa `getOpenStatus`. Probada introduciendo la violación a propósito: señala el
  archivo culpable por su nombre. Una convención que se rompe tres veces no se sostiene con un
  comentario.

- **En "Tu Zibatá", diez de las once zonas se pintaban con el verde de la primera.** `plazaTones`
  reparte los colores **por posición en la lista** que recibe, y la lista de lugares pedía el tono
  pasando una lista de un solo elemento: siempre el índice 0. El mismo lugar salía verde ahí y de su
  color en el mapa. No venía de los cambios de esta tanda; apareció al revisar el sistema de color.

- **Los dos estados de espera del mapa no se parecían.** El que se ve mientras baja el trozo de
  código era beige plano y el de las teselas ya tenía la trama de puntos, así que a mitad de carga
  cambiaba el fondo, como si algo hubiera fallado y vuelto a empezar. Ahora comparten la misma
  rejilla de 26 px.

### Cambiado

- **La fila de filtros deja de ser una hilera de cápsulas iguales.** Eran cuatro cosas distintas con
  la misma forma: dónde estás, qué filtras, qué llaves están puestas y cuántos resultados hay. Ahora
  el peso visual dice de qué tipo es cada una.

  **El selector de zona se pinta del color de esa zona**, el mismo del mapa, en vez del olivo de
  marca. Es una revisión de una decisión tomada al revés dos versiones antes: entonces se dejó olivo
  razonando que los controles son olivo, y el costo fue que la fila quedó sin diferenciación. La
  regla de los dos canales, bien leída, apunta a esto: el olivo marca acción y el acento marca lugar,
  y este control nombra un lugar. De paso, basta mirar la barra para saber en qué zona estás.

  **Los dos interruptores viven en una sola superficie**, separados por un filete, como un grupo de
  llaves. Se leen como lo que son y la fila pasa de cuatro objetos a tres.

  **El resumen pierde su superficie.** No es un filtro: es una cifra y una salida. Ahora es texto, con
  una sombra del color del papel para que se lea sobre el mapa sin añadir una caja.

  La barra de búsqueda, la franja del pie y el aviso de carga pasan a radio de contenedor, porque
  tampoco se pulsan. Las pastillas de categoría no cambian: esas sí son filtros y sí se pulsan.

- **La cifra de los interruptores estaba alta.** Heredaba `line-height: 1.45` del cuerpo, y a 11 px
  eso deja la caja más alta que el glifo dentro de una fila centrada por caja. Con `line-height: 1`
  el desfase medido es 0,00.

- **La espera del mapa ya no es una pastilla flotando en una pantalla vacía.** El aviso pierde su
  caja y el hueco lo ocupa la trama de puntos de la marca, la misma de la página 404, respirando muy
  despacio. El problema no era el indicador, era el beige vacío detrás. Solo se anima `opacity`, que
  es lo único que puede animarse sobre un área entera sin costar repintado, y en CSS, que corre fuera
  del hilo principal justo cuando el navegador está más ocupado.

## [4.22.0]: 2026-10-12

### Añadido

- **El color de cada plaza llega hasta el final del recorrido.** El sistema de dos familias
  cromáticas de `src/config/palette.ts` estaba bien construido y se cortaba en la cabecera del
  panel: el mapa pintaba cada zona de su color y la lista las devolvía a todas al mismo gris. Esa
  discontinuidad era lo que se sentía como falta de personalidad.

  Ahora el acento viaja a cuatro sitios más, y siempre como aro o como texto, nunca como fondo: el
  aro de la foto del lugar (en la tarjeta y en la ficha), el nombre de la zona en los grupos de
  resultados, y el alfiler de la dirección. Comprobado en el navegador: el marcador de Paseo Zibatá
  y el aro de las fotos de sus lugares pintan el mismo `rgb(103, 60, 30)`.

  Las once plazas activas dan entre 5,01:1 y 13,53:1 contra las tres superficies, así que el nombre
  coloreado pasa incluso el 4,5 de texto normal.

- **`docs/IDENTIDAD.md`**, con el plan, lo que se hizo, lo que se descartó y por qué. Tres de las
  seis fases planeadas se quedaron casi sin contenido al medirlas, y eso está escrito ahí.

### Corregido

- **Un campo de formulario con error se marcaba con el rojo de los favoritos.** El borde decía
  `var(--color-danger, #c0453c)` y ese token **nunca existió**, así que lo que se pintaba era el
  valor de reserva. Dos semánticas opuestas (esto te gusta / algo va mal) con el mismo color, por un
  nombre mal escrito que no se ve a ojo.

  Lo encontró `impeccable detect` sobre el código, y solo después de escribir `DESIGN.md`: sin una
  paleta declarada, el detector no tenía contra qué comparar.

- **Cuatro rojos haciendo el trabajo de dos.** `#b4432c` en el botón de favorito y en el filtro,
  `#c0453c` en la ilustración del tutorial, `#a33a32` en el error del formulario. Ahora son dos
  tokens con nombre, `--heart-600` y `--danger-600`, y una regla en `DESIGN.md` que dice que no se
  mezclan.

- **El azul de "estás aquí" estaba escrito a mano**, fuera de la paleta. El color es correcto (es la
  convención de todos los mapas, y en olivo se leería como un lugar más de la guía), pero no estaba
  registrado en ningún sitio. Ahora es `--blue-ubicacion`, con el porqué escrito.

### Cambiado

- **La lista de lugares ya no entra escalonada.** Eran 22 ms por fila hasta doce. Se ve bien una vez
  y mal las siguientes cincuenta, porque la lista se redibuja en cada tecla del buscador y en cada
  filtro. Lo que se ve decenas de veces al día no se anima.

## [4.21.0]: 2026-10-12

### Añadido

- **`DESIGN.md`: el sistema de diseño escrito.** Sale de lo que está publicado, no de intenciones:
  los tokens con su porqué, las reglas con nombre (el acento que cuesta, el rojo que avisa de verdad,
  la capa única, la píldora que se pulsa) y, al final, lo que el build carga como defecto sin que sea
  regla. Lo leen las dos herramientas de diseño del proyecto, así que es una sola fuente y no dos.

- **`.impeccable/config.json`.** Apaga dos de las 59 reglas del detector, las dos con una medición
  delante. `cream-palette` no aplica porque el beige deriva de un hexadecimal de marca fijado antes
  del código. `monotonous-spacing` midió "4 px el 69 % de las veces" en una muestra de la portada,
  pero el reparto real en las 36 hojas es 8 px 53 veces, 12 px 48 y 16 px 44. La tercera,
  `overused-font`, se deja sonando: esa premisa sí se cumple.

### Corregido

- **La descripción de la ficha ya no va justificada.** En una columna de 38 caracteres y sin partir
  palabras, justificar abre ríos: "En␣␣␣TOMASSA␣␣|␣␣Almacén␣␣de␣␣Pastas" es lo que se publicaba. El
  comentario del código describía ese fallo exacto y la línea siguiente lo provocaba.

- **Dos animaciones dejan de recalcular la disposición en cada fotograma**, las dos encima del mapa,
  que es el peor sitio posible para hacerlo.

  Los controles del mapa movían `right` y `bottom` durante 420 ms al abrirse el panel; ahora la caja
  se queda quieta y lo que se mueve es `translate`.

  El tallo de los marcadores crecía con `height` cuando una etiqueta se eleva para no chocar con
  otra, y son hasta quince a la vez mientras el mapa se mueve; ahora crece con `scale` y
  `transform-origin: bottom`, así que el pie sigue clavado en la plaza. Medido en el navegador: con
  elevación 2 pinta 110 px, los mismos de antes, con la caja en 14.

## [4.20.0]: 2026-10-12

### Añadido

- **Cerrado temporalmente.** Un local en obra, de vacaciones o en traspaso lleva ahora un campo
  `cierre` con el motivo y la fecha en que empezó, y la guía lo dice en vez de callarlo. El primero
  es Agave Grill, en remodelación desde el 9 de octubre.

  Hasta ahora la guía solo sabía dos cosas de un local: su horario, o nada. "Cerrado por obra" no es
  ninguna de las dos, y las dos salidas que había eran malas. Dejarle el horario normal manda gente
  a una puerta tapiada, que es el peor fallo que puede cometer una guía. Vaciárselo lo deja igual
  que los once de los que no sabemos nada, perdiendo además un dato verificado que volverá a valer
  cuando reabra.

  Lo que hace el campo, en cuatro sitios:

  - El punto de la tarjeta se vuelve **ámbar**, el único de los cuatro estados que avisa de algo.
  - La ficha abre con un aviso **antes del botón de "Cómo llegar"**, no después: un aviso debajo del
    botón que te manda allí llega tarde. El horario sigue abajo tal cual, porque volverá a valer.
  - Queda fuera del filtro "Abierto ahora" aunque su horario diga que a esta hora abre, y **baja en
    el orden**: es el único valor negativo de la tabla de apertura. No desaparece, porque quien lo
    busque por su nombre tiene que encontrarlo y leer por qué está cerrado.
  - El aviso va también en el HTML prerenderizado, antes que nada, para quien lea sin JavaScript.

  Sin fecha de reapertura mientras el negocio no la dé: inventarla sería inventar un dato. El motivo
  sale de una lista cerrada de tres, porque el aviso se escribe en los dos idiomas y un texto libre
  no se podría traducir.

  La pregunta de "en qué estado está este lugar" vive ahora en un solo sitio (`src/lib/estado.ts`).
  Si cada pantalla siguiera preguntándoselo al horario por su cuenta, el filtro de abiertos acabaría
  colando un local en obra porque su horario dice que a esta hora abre.

- **Las tres páginas de texto viajan en su propio trozo.** Lo que empujó a esto fue el presupuesto:
  con los términos y el aviso de cierre, el paquete inicial llegó a 122,1 KB contra un límite de 122.
  `InfoDialog` se importaba de forma estática, 7 KB de fuente más toda su prosa, para un diálogo que
  la mayoría de las visitas no abre. Lo que toca cuando se choca con el techo es partir, no subir el
  número, y está escrito así en `scripts/perf/check-bundle.ts` desde la v4.2.0. Queda en 121,2 KB, y
  el CSS inicial baja de 10,2 a 9,9.

### Corregido

- El guion largo que se colaba entre la plaza y la dirección en el HTML prerenderizado, que
  `AGENTS.md` prohíbe en todo el proyecto.

## [4.19.0]: 2026-10-12

### Cambiado

- **El punto de "abierto ahora" se mueve a la foto**, abajo a la derecha, como el indicador de "en
  línea" de cualquier lista de contactos. Es un sitio que la gente ya sabe leer sin que se lo
  expliquen.

  También arregla lo que tenía mal donde estaba. Al lado del nombre, su posición dependía del largo
  del texto: caía en un sitio distinto en cada fila, así que una columna de cien tarjetas no se
  podía recorrer de un vistazo, que es justo para lo que sirve un punto. Sobre la foto cae siempre
  igual.

  Se ve un poco más (de 6 a 11 px) porque sobre una fotografía un punto de 6 px se pierde, y lleva
  un aro del color de la tarjeta para separarlo de la imagen sin dibujarle un borde encima. El aro
  es una variable y no un valor fijo, porque el fondo cambia al pasar el ratón.

- **Ahora lo llevan todos, con tres estados.** Verde abierto, gris cerrado y hueco los once sin
  horario publicado. Antes solo se dibujaba el verde, y la ausencia tenía que significar las otras
  dos cosas a la vez.

  El tercer estado no es un adorno. De esos once la guía no sabe si están abiertos, y pintarlos
  grises sería afirmar que están cerrados; un punto hueco dice "no se sabe", que es la verdad. El
  cerrado es gris y no rojo porque el rojo dice "algo va mal", y que una panadería esté cerrada a
  las once de la noche no tiene nada de malo.
## [4.18.1]: 2026-10-12

### Cambiado

- **El panel privado queda abierto para su dueño.** `ACCESS_TEAM` y `ACCESS_AUD` estaban vacíos
  desde que se escribió el panel, y con ellos vacíos el Worker responde 403 a todo el mundo. Ahora
  llevan los identificadores de la aplicación de Cloudflare Access que ya está configurada, que
  cubre `visitzibata.com/panel` y `visitzibata.com/api/panel` con una política de un solo correo.

  No son secretos y por eso van versionados: el dominio del equipo sale en la URL de inicio de
  sesión y la etiqueta AUD identifica la aplicación, como un `client_id`. Lo que decide quién entra
  es la política de Access, no estos dos valores: si se borra la regla, el panel vuelve a 403 en vez
  de quedar abierto.

## [4.18.0]: 2026-10-12

### Añadido

- **Formulario de sugerencias propio.** "Sugiere un cambio" ya no sale a Web3Forms: envía a
  `POST /api/sugerencia` y lo que llega se guarda en D1 (`worker/sugerencias.ts`). El servicio de
  terceros nunca llegó a usarse en producción, porque faltaba la clave y el formulario no se
  dibujaba; para cuando tocaba ponerla ya había servidor propio, así que abrir un destino externo
  para algo que podemos guardar nosotros dejó de tener sentido.

  Con eso **`connect-src` vuelve a ser `'self'` a secas**: no solo navegar, usar la guía entera,
  incluido escribir, no hace una sola petición fuera del propio origen. Se fueron también la clave
  de cliente incrustada en el JavaScript publicado y la lista de dominios permitidos en un panel
  ajeno. Lo que se pierde es el aviso por correo: hay que entrar al panel privado a mirar, y por eso
  el panel cuenta las que faltan por atender.

  Frenan el spam las tres cosas que ya frenaban el alta de cuenta, y ninguna pide nada a quien
  escribe: el campo trampa, una prueba de trabajo de uno o dos segundos de CPU en el propio
  navegador, y que esa prueba valga una sola vez (es la clave única de la fila, así que reenviarla
  responde 409 y no escribe nada). Lo que se guarda es lo que la persona escribió, sin colgar de
  ninguna cuenta y sin IP, user agent ni referente.

- **Privacidad y términos, en una sola página.** Eran dos avisos cortos que se iban a repetir, así
  que `/info/privacidad` ahora los lleva juntos: el aviso de privacidad arriba y los términos de uso
  debajo, con lo que hay que poder leer antes de usar la guía. Qué es esta guía (independiente, sin
  relación comercial con ningún lugar, nadie paga por estar ni por salir más arriba), qué tan fiable
  es el dato (se revisa por temporada y aun así puede estar desactualizado, así que lo que importe se
  confirma con el lugar), cómo pedir que se corrija o se quite (por "Sugiere un cambio", sin explicar
  por qué), y de quién es cada cosa.

  La dirección no cambió, porque ya estaba indexada. El título de la página dice las dos cosas y es
  el que se indexa; en la franja del mapa y en el pasaporte la etiqueta sigue siendo "Privacidad",
  que es lo que cabe.

## [4.17.0]: 2026-10-12

### Anadido

- **Filtro de "Abierto ahora"**, junto al de favoritos. Solo aparece si hay algo abierto, asi que a
  las cuatro de la manana desaparece solo, y el numero de la pastilla dice cuantos resultados dara
  al pulsarla. Deja fuera los once locales sin horario publicado: el filtro dice "abierto ahora", y
  de esos no se sabe.
- **Lo abierto sube en el orden de las listas**, con peso 0,5. Pesa mas que la comunidad y que el
  giro, pero no manda: un favorito aporta 0,76 por la via directa, asi que un lugar guardado y
  cerrado puede seguir por delante de uno indiferente y abierto. Los que no publican horario quedan
  en medio (0,35) y no en el suelo: no se sabe si estan abiertos, y hundirlos castigaria al negocio
  por un hueco de la guia.
- **Un punto verde discreto** en la tarjeta de lo que esta abierto, con texto para lectores de
  pantalla. Nada para cerrado ni para los que no tienen horario: la ausencia significa "no
  necesariamente", que es lo que la guia sabe. Un segundo punto para "cerrado" convertiria la lista
  en un semaforo de cien luces.

### Decisiones que quedan escritas

- **Sin haber marcado nada, lo abierto tambien sube.** Estar abierto no es una senal personal, es
  una propiedad del mundo. Va por un camino aparte que solo reordena por apertura y conserva el
  orden curado dentro de cada grupo: el resto de la maquinaria (afinidades, descubrimiento, rotacion
  diaria) si espera a que haya algo marcado, porque barajarle la guia cada dia a quien llega por
  primera vez no le sirve de nada.
- El reloj es el compartido de `OpenStatus`, que avanza al cambiar el minuto, asi que el filtro y el
  orden se reevaluan solos cuando un local abre o cierra mientras alguien mira la guia.

### Corregido

- `AGENTS.md` decia que el despliegue era a GitHub Pages. Es Cloudflare desde la v4.9.0.

## [4.16.0]: 2026-10-12

Las paginas dejan de estar vacias para quien no ejecuta JavaScript.

### Anadido

- **Cada pagina trae su contenido escrito** dentro de `<div id="root">`: el nombre como `<h1>`, los
  giros, la zona con su direccion, la descripcion, el horario dia por dia, los enlaces de contacto y
  enlaces a la zona y a los locales vecinos. Las zonas listan sus locales y la portada sus zonas.
  React lo sustituye al montar, asi que no es contenido distinto del que ensena la aplicacion (eso
  seria enganar a un buscador): es el mismo, servido antes.
- Las paginas de informacion tambien. Importa sobre todo en privacidad: una politica que solo existe
  si se ejecuta JavaScript no se puede citar ni archivar.
- `tests/e2e/sin-javascript.spec.ts`, con JavaScript desactivado, comprueba que el texto y los
  enlaces esten en el HTML en los dos arboles de idioma.

### Por que

El cuerpo de las 234 paginas eran 193 bytes identicos: un `<noscript>` y un `<div>` vacio. Eso tenia
dos costos. Google las renderiza, pero lo hace en una cola aparte y la deja para el final en sitios
sin autoridad, asi que un dominio nuevo con 234 paginas sin texto es el peor caso. Y como los
enlaces de la guia los dibuja React, un rastreador veia 234 URL sueltas sin nada que las uniera:
Search Console lo decia con todas sus letras, "Pagina de referencia: no se ha detectado ninguna".

### Cambiado

- El presupuesto de CSS inicial pasa de 10 a 11 KB. El estilo del contenido escrito dejo la medida
  en 9,9 de 10, y cien bytes de margen hacen que el siguiente cambio honesto rompa la compilacion.
## [4.15.2]: 2026-10-12

### Corregido

- **La pagina 404 se publicaba sin estilo.** Serif del sistema, enlace morado, nada de la marca. La
  cabecera del sitio decia `style-src 'self'` y la pagina llevaba su propio `<meta>` con
  `'unsafe-inline'`: cuando hay dos politicas el navegador aplica **las dos**, asi que la
  interseccion prohibia el bloque entero.

  Ahora las dos admiten la huella SHA-256 de ese bloque exacto, que calcula el build desde el mismo
  modulo que escribe la pagina. Ninguna recurre a `'unsafe-inline'`.

  No lo vio nadie porque `vite preview` no sirve `_headers`: en local solo existia el `<meta>`
  permisivo y se veia bien, y el E2E del 404 comprueba el codigo de estado, no el aspecto. Lo fija
  ahora `scripts/build/pagina-404.test.ts`, que compara la huella publicada con la del bloque de
  verdad y exige que la politica del sitio la admita.
- El HTML de la 404 sale de `scripts/build/pagina-404.ts` y no de dentro de `vite.config.ts`: la
  pagina y su huella tienen que salir del mismo sitio o se separan, que es justo lo que paso.

## [4.15.1]: 2026-10-11

### Corregido

- **El favicon se veia de baja calidad fuera del navegador.** Es un vector, asi que no pierde calidad
  solo: lo que pasaba es que quien no usa el SVG tiene que rasterizarlo el, y lo hace al tamano que
  elige. Search Console lo convertia a 32 px y luego su interfaz lo ampliaba, con lo que el aro se
  escalonaba y la Z se emborronaba. Ahora se generan `favicon-48.png` y `favicon-96.png` desde la
  misma fuente y se declaran detras del SVG, asi que no hay nada que convertir. 48 y 96 porque
  Google pide multiplos de 48.
- **El sitemap decia que las 234 paginas habian cambiado hoy, en cada publicacion.** Todas llevaban
  la fecha del build. Google usa `lastmod` para decidir que vale la pena volver a rastrear, y cuando
  lo comprueba y no ha cambiado nada, deja de creerlo: una fecha falsa en todas las paginas es peor
  que ninguna fecha. Ahora las fichas llevan la ultima verificacion de sus datos
  (`verification.lastVerifiedAt`), las zonas la mas reciente de sus locales, y la portada y las
  paginas de informacion no llevan ninguna, porque cambian con el codigo y no con el catalogo.

## [4.15.0]: 2026-10-11

### Anadido

- **Panel privado en `/panel`**, con las visitas por dia, las paginas mas abiertas, los enlaces
  compartidos, los lugares mas guardados y cuantas notas tiene cada uno. Lo protege Cloudflare
  Access, que es configuracion y no codigo nuestro: aqui no hay inicio de sesion, ni contrasenas, ni
  sesiones. El Worker comprueba ademas la cabecera que Access inyecta y **falla cerrado**: sin ella,
  403.
- Es una pagina aparte de la guia (HTML, CSS y JavaScript a mano en `public/`), no entra en el
  paquete de la aplicacion, no se prerenderiza, no esta en el sitemap y lleva `noindex`.

### Seguridad

- **El Worker ya no se sirve en `workers.dev`.** Ahi el nombre de host no es el dominio, asi que no
  lo cubrian ni la regla de Access del panel ni la de limite de peticiones del alta de cuentas: era
  una puerta de atras a lo que hay detras de las dos.
- **La firma del testigo de Access se verifica**, contra el JWKS del equipo y con emisor,
  destinatario y vigencia. La primera version de este cambio solo miraba que la cabecera existiera,
  con el argumento de que Cloudflare borra las cabeceras `Cf-*` de fuera. El argumento fallaba en dos
  casos que estan escritos en [docs/SEGURIDAD.md](docs/SEGURIDAD.md): una regla de Access que no
  cubra la ruta exacta, y `workers.dev`.
- **La salida de desarrollo es una variable explicita** (`PANEL_ABIERTO`, que pone
  `npm run worker:dev`) y no el nombre de host.

### Cambiado

- `scripts/analitica/ver.ts` decia que no habria panel "porque proteger algo es el trabajo que este
  proyecto no quiere tener". La objecion era buena y dejo de aplicar: la proteccion es ahora una
  regla en un panel ajeno. El comando se queda, porque sirve para lo que el panel no: leerlo desde
  la terminal y mirar la base local con `--local`.
- **El panel tampoco ensena el promedio de estrellas.** Podria discutirse (quien mantiene la guia no
  es el publico), pero la regla vale mas entera que con una excepcion, y esta seria justo la que
  alguien copiaria manana. Se ve cuantas notas hay, nunca cuanto valen. Hay una prueba que lo exige
  en el SQL.
- Los lugares mas guardados salen **sin el umbral de cinco**. Ese umbral existe porque un numero
  chico delata a quien lo guardo, y aqui no hay a quien delatar: lo que se guarda es una cuenta sin
  correo ni nombre. Sin los numeros chicos el panel no sirve para lo que se hizo.

## [4.14.0]: 2026-10-11

Tercer paso del plan de [docs/CUENTAS.md](docs/CUENTAS.md). Las calificaciones y las visitas llegan
al servidor, y la aritmetica de la comunidad deja de tener numeros escritos a mano.

### Anadido

- **Las calificaciones y las visitas viajan a la cuenta**, con el mismo patron que los favoritos: el
  gesto es local e instantaneo, el envio va detras y nunca lo bloquea ni anuncia fallos. Lo que ya
  habia en el dispositivo sube con el primer gesto, no al entrar.
- **El empuje de la comunidad.** El servidor manda por lugar un numero de 0 a 1 con los corazones y
  las notas ya mezclados, en vez de la media y los votos. **La media no sale del servidor**: no es
  que la interfaz decida no enseniarla, es que no la recibe. Taparla en un componente habria sido una
  promesa; no enviarla es un hecho.
- **Contador de comparticiones.** Cuando una app de mensajeria pide una pagina para dibujar la
  tarjetita de un enlace, se apunta en su propia tabla. No es trafico (esa peticion la hace el
  servidor de la app, y la hace aunque nadie toque el enlace), pero dice que alguien pego ese enlace
  en algun sitio, que es una senial distinta y hasta ahora se tiraba. Sale en `npm run analitica:ver`.
- **El corazon de la ficha refleja tu estado**: relleno si lo guardaste, de contorno si no, con el
  mismo texto. Un solo objeto leido a dos escalas en vez de dos cosas separadas.

### Cambiado

- **Toda la calibracion sale del propio catalogo.** Antes habia tres constantes a mano (dividir los
  corazones entre 25, confianza a los 20 votos, centro en 3,5 estrellas) y las tres fallaban en los
  dos extremos: con cincuenta personas la senial valia cero, con cinco mil todo se saturaba. Ahora el
  divisor es el percentil 75 de los conteos, el centro es la media ponderada del catalogo y la escala
  es su desviacion. Queda un solo numero de politica, los votos de referencia de la media bayesiana.
- **El aviso de privacidad lo dice.** Decia que las calificaciones se guardaban unicamente en este
  navegador, y dejo de ser cierto. Ahora dice que suben, para que, y que no se publican nunca, ni
  siquiera como promedio. En los dos idiomas, con pruebas que lo exigen en la pagina.
- `/api/corazones` pasa a `/api/senales`, y `corazones.ts` a `senales.ts`: devuelven mas que un
  conteo.
- `AGENTS.md` deja de decir que la regla de no publicar medias cambiara "cuando se implemente el
  plan". Ya esta implementada, y el motivo de que se cumpla es estructural.

## [4.13.0]: 2026-10-11

### Anadido

- **El tutorial tiene ruta propia** (`/info/tutorial` y `/en/info/tutorial`), como las otras tres
  ventanas de informacion. Era la unica emergente que el boton atras no cerraba: con el tutorial
  abierto, atras sacaba de la pagina. Ahora cierra la ventana.
- Es un tema de informacion mas, con el mismo trato que los otros tres en todo: ruta, sitemap,
  titulo, descripcion y `hreflang`. La fila de enlaces lo lista sin ningun caso especial. La unica
  diferencia es que en la primera visita se abre solo.
- El build pasa de 232 a 234 paginas.

### Cambiado

- En la primera visita el tutorial sigue saliendo sin tocar la URL. Cambiarla al entrar dejaria
  `/info/tutorial` como puerta de la guia y como lo que se copia de la barra de direcciones.
- La franja del mapa sigue mostrando solo las tres paginas de texto: dice quien hace la guia y como
  corregirla, y al tutorial se llega desde cualquiera de ellas.

## [4.12.1]: 2026-10-06

### Corregido

- **El icono se perdia en una pestana en modo oscuro.** El simbolo suelto es olivo oscuro sobre fondo
  transparente, asi que contra el gris de una pestana oscura casi no se leia. Ahora el favicon va
  sobre su baldosa olivo, con el simbolo en papel, y se lee igual en los dos modos.

### Cambiado

- **El corte chico del simbolo pasa a `public/simbolo.svg`**, y `public/favicon.svg` es ese corte ya
  montado sobre la baldosa, generado por `npm run images:icons`. No se edita a mano, para que el
  simbolo siga teniendo una sola fuente por corte. Esquina de 56 de 256 (a 16 px, una de 48 se lee
  casi cuadrada) y simbolo al 78 % (al 84 % el aro toca la curva, comparados los tres antes de
  elegir).

## [4.12.0]: 2026-10-06

Crear una cuenta cuesta trabajo de CPU, no un captcha. La guía vuelve a no tener ni un script de
terceros.

### Cambiado

- **Prueba de trabajo en lugar de Turnstile.** El navegador busca un secreto cuya huella empiece por
  16 ceros; el servidor lo comprueba con un solo hash. Medio segundo en un escritorio, dos o tres en
  un telefono de gama media, repartidos en trozos y sin bloquear nada: el corazon ya esta puesto en el
  dispositivo y nadie espera a esto.
- **El motivo del cambio**, que es el que importa: Turnstile funciona rechazando navegadores. Quien
  usa Tor, un bloqueador duro o una red que filtra dominios se quedaba fuera, y el fallo era mudo (su
  corazon se guardaba en su dispositivo y no contaba nunca). Comprobado en un navegador real: el
  widget ni emitia ficha ni dibujaba nada que se pudiera resolver. La prueba de trabajo no rechaza a
  nadie, porque solo usa `crypto.subtle`.
- **La politica de seguridad vuelve a `script-src 'self'` y `frame-src 'none'`.** Era el precio que se
  habia pagado por el captcha.
- **El secreto lo genera el navegador**, no el servidor: buscarlo *es* la prueba. Que cada prueba valga
  una sola vez sale gratis, porque la huella es la clave primaria de `credencial`.
- **Edad minima de 24 horas** en vez de 10 minutos. Diez minutos eran un cafe; un dia obliga a
  sostener el ataque. A una persona no le cuesta nada.
- **Tope por cuenta atado al catalogo** (150 para 101 lugares), con una prueba que lee `data/` y falla
  si se acercan. El 500 anterior no freno nunca nada.
- **El umbral de 5 se queda en 5, a proposito.** Es un suelo de privacidad, no un filtro de
  popularidad: con uno o dos el numero delata a quien lo guardo, y esa razon no cambia con el tamano.
  Atarlo a la poblacion solo esconderia a los locales pequenos cuando la guía creciera.
- **El aviso de privacidad lo dice**: usar la guía, y guardar un lugar, no generan ni una peticion a
  terceros. Antes solo se decia de navegar.

### Eliminado

- `src/lib/turnstile.ts`, la variable `VITE_TURNSTILE_SITEKEY` y el secreto `TURNSTILE_SECRET`. En
  [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md) quedan los comandos para borrarlos de Cloudflare y GitHub.

## [4.11.2]: 2026-10-06

### Corregido

- **El tutorial salia en cada visita.** La marca de "ya lo vio" estaba en `sessionStorage`, asi que
  volvia a aparecer cada vez que se abria el navegador. Pasa a `localStorage`: se muestra una vez por
  dispositivo. Quien limpie el almacenamiento vuelve a verlo, igual que pierde sus favoritos.
- **No habia forma de volver a abrir el tutorial.** Ahora hay un enlace "Ver el tutorial" junto a
  Privacidad y Sugiere un cambio, en las tres paginas de informacion.
- **El tutorial se abria encima de una pagina de informacion compartida.** Quien recibia un enlace a
  /info/privacidad se encontraba el tutorial por delante. Esas rutas cuentan ya como enlace directo,
  igual que las de una zona o un lugar.
- **La firma de autoria flotaba medio renglon por encima de la version** en "Acerca de esta guia".
  La linea base de una caja flex la pone su primer hijo, y ahi es un SVG. Ahora van apiladas y
  alineadas a la derecha, la firma arriba y la version debajo, y el conector empieza en mayuscula
  porque abre la frase.
- **`analitica:ver` reintenta una vez ante el error 7403 de Cloudflare.** Es un rechazo pasajero (tres
  veces en una semana, siempre con el permiso de D1 correcto y siempre bien al segundo intento). Solo
  se reintenta ese codigo; cualquier otro fallo sale directo.

## [4.11.1]: 2026-10-06

La v4.11.0 no llegó a publicarse: la tiró su propio flujo de publicación.

### Corregido

- **Turnstile le faltaba la mitad del navegador.** El Worker exigía una ficha que nadie mandaba, así
  que con la clave secreta ya puesta en producción, toda alta de cuenta habría respondido 403 en
  silencio: los corazones seguirían guardándose en el dispositivo y el número público no crecería
  nunca. Ahora el navegador pide la ficha, y pide el script de Cloudflare **tarde**: no al abrir una
  página, sino la primera vez que alguien da un corazón. Quien solo lee la guía no descarga nada de
  terceros, y el E2E que exige cero peticiones externas en todo el recorrido de lectura lo fija.
- **Un script que ni carga ni falla dejaba la petición colgada.** El reloj de veinte segundos cubría
  el desafío pero no la descarga, y una red que traga la conexión no dispara `load` ni `error`. Ahora
  arranca antes que nada.
- **La clave pública solo en el paso que la usa.** Estaba a nivel de job, así que la heredaban también
  los tests, y ahí cambiaba su comportamiento: ocho pruebas de `cuenta.ts` que pasaban en el pull
  request y en local se colgaron al publicar, en el único sitio donde nadie las estaba mirando. Esas
  pruebas simulan ahora el módulo del desafío, para que no vuelvan a depender del entorno.
- **La prueba de compartir ya no corre contra un reloj.** Afirmaba un acuse que vive 2,4 segundos y se
  borra solo; con el runner cargado, a veces llegaba tarde. Ahora espera a lo copiado, que no caduca
  y es lo que la prueba dice en su nombre que vino a comprobar.

### Cambiado

- **La CSP abre `challenges.cloudflare.com`** en `script-src` y en `frame-src`, que era `'none'`. Es
  el primer script de terceros del proyecto y el costo queda escrito en
  [docs/SEGURIDAD.md](docs/SEGURIDAD.md), no disimulado.
- **Un widget de Turnstile tiene dos claves y hacen falta las dos.** Puestas por separado el fallo es
  mudo, así que [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md) lo dice con esas palabras y en ese orden.

## [4.11.0]: 2026-10-06

Segundo paso del plan de [docs/CUENTAS.md](docs/CUENTAS.md), y el primero que se ve.

### Añadido

- **El corazón público.** La ficha dice cuántas personas han guardado el lugar. Es la única señal de
  la comunidad que sale a la vista, y la decisión de que sea esa y no otra está razonada: el corazón
  exige intención y va uno por cuenta, mientras que las visitas miden curiosidad y se inflan
  recargando.
- **Los favoritos viajan a la cuenta.** El gesto sigue siendo local e instantáneo; el aviso al
  servidor va detrás y nunca lo bloquea. Lo que ya había guardado antes de que existieran las
  cuentas sube con el primer gesto, para que nadie empiece de cero.

### Decisiones que quedan escritas

- **Las dos reglas del conteo viven en el SQL, no en la interfaz**, para que no haya forma de pedirle
  al servidor los números que decidió no publicar. Umbral de cinco (por debajo no se devuelve nada,
  porque con uno o dos delataría a quien lo guardó) y edad mínima de diez minutos (un ataque
  instantáneo pasa a ser uno que hay que sostener).
- **Las estrellas no se muestran, y se garantiza porque la interfaz no las recibe**: la fuente
  devuelve `rating: null` siempre. Taparlas en el componente habría sido una promesa; no enviárselas
  es un hecho.
- **La media de la comunidad solo puede subir, nunca bajar.** Sin ese tope, con 101 locales y pocos
  votos, tres votos malintencionados hunden a un negocio que no puede verlo ni rebatirlo, porque la
  media no se publica. Así una brigada queda reducida a un empujón. El gusto propio sí puede restar,
  porque ahí nadie ataca a nadie.
- **Sin red, sin cuenta o con el servidor caído, la guía funciona igual**: los favoritos son los de
  siempre y el número sencillamente no aparece.

### Cambiado

- **El aviso de privacidad lo dice.** Decía que los favoritos se guardaban únicamente en este
  navegador, y dejó de ser cierto. Ahora dice que se envían, para qué, que viajan atados a un
  identificador al azar sin correo ni nombre, y que ese identificador vive solo en este navegador:
  borrarlo es empezar de cero. En los dos idiomas, con pruebas que lo exigen en la página.

## [4.10.0]: 2026-10-06

Primer paso del plan de [docs/CUENTAS.md](docs/CUENTAS.md). Nada de esto se ve todavía: es la
tubería sobre la que van los corazones públicos.

### Añadido

- **Identidad sin registro.** Una cuenta es un identificador aleatorio y nada más: sin correo, sin
  nombre, sin contraseña, sin IP y sin user agent. Se crea sola la primera vez que alguien hace algo
  que haya que guardar fuera de su dispositivo, y **nunca al entrar**: quien solo mira la guía no
  genera ninguna cuenta.
- **Una cuenta, varias credenciales.** Hoy solo la del dispositivo. El día que entre Google se añade
  una fila apuntando a la **misma** cuenta, y por eso nadie pierde su historial. Es la pieza que
  decide todo lo demás, y está puesta desde el principio aunque todavía no se use.
- `/api/cuenta` en el Worker, que convive con los 232 archivos del sitio sin que ninguno sepa del
  otro: la API responde si la ruta es suya y, si no, devuelve el archivo.

### Decisiones que quedan escritas

- **Lo que se guarda del secreto es su huella, no el secreto.** Si alguien se llevara la base entera
  no podría suplantar a nadie. SHA-256 a secas y no una derivación lenta: eso hace falta para
  contraseñas, que son cortas y adivinables; un secreto de 256 bits aleatorios no se adivina por
  fuerza bruta, así que gastar CPU en cada petición no compra nada.
- **Quien pierde el secreto pierde la cuenta.** Es la decisión tomada, no un descuido. Un código de
  recuperación sería peor: quien tuviera el código sería dueño de los datos.
- **Nada de esto puede romper la guía.** Si el servidor no responde, si el almacenamiento está
  bloqueado o si la respuesta viene rara, se sigue con lo local, que es lo que ha funcionado siempre.
- **Turnstile queda enchufado pero no exigido**, porque mientras los corazones no se vean, fabricar
  cuentas no sirve de nada. Tiene que exigirse antes de que se vean, y así está anotado en
  DESPLIEGUE.md.

### Nota

El orden del plan cambia un poco: los favoritos al servidor y el conteo público van juntos en el paso
siguiente. Sincronizarlos por separado no le da nada a nadie, porque ya funcionan en local y el
secreto vive en el navegador; lo primero que alguien **ve** es el número de corazones.

## [4.9.0]: 2026-10-06

### Añadido

- **La guía cuenta visitas, y son suyas.** `worker/` es el primer código de servidor del proyecto:
  sirve los mismos archivos de `dist/` y suma una fila por **día, ruta e idioma** con un contador.
  "El 5 de octubre, /lugar/tomassa se abrió 12 veces, en español". Eso es todo lo que se guarda.
- **Se cuenta en el servidor, no en la página.** Cero bytes de JavaScript, que importa porque el
  paquete inicial está a 300 bytes de su límite; no lo bloquea un bloqueador de anuncios; funciona
  sin JavaScript; y es imposible que recoja algo de la persona porque nunca toca el navegador. A
  cambio hay que descartar robots, que se hace por user agent.
- `npm run analitica:crear`, `analitica:esquema` y `analitica:ver` para montar la base y leer los
  números desde la máquina del propietario. No hay endpoint de lectura ni panel: una cosa menos que
  proteger.

### Decisiones que quedan escritas

- **No hay identificador, ni cookie, ni IP, ni user agent, ni referente en la base.** No es que se
  anonimice después: es que no se recoge. El costo hay que saberlo y está anotado: **no se puede
  saber cuántas personas distintas** hubo, solo cuántas veces se abrió cada página. Para decidir qué
  locales interesan alcanza, y a cambio no hay nada que prometer sobre el resto.
- **Es un `UPSERT`, no un registro por visita.** Con una fila por visita la tabla crece sin fin y hay
  que acordarse de purgarla; así se queda en cientos de filas al mes, y no existe ningún instante en
  el que la base haya guardado un evento individual. Hay una prueba que falla si deja de serlo.
- **Contar jamás puede romper la página.** La respuesta se obtiene primero y se devuelve igual aunque
  la base no exista, esté caída o falle a mitad. Sin enlace a la base, el sitio sirve y no cuenta.
- **El Worker corre solo en las ocho rutas de página.** Con `run_worker_first: true` cada tesela,
  imagen y archivo de `assets/` sería una invocación facturada, y son cientos por visita. La lista
  blanca también evita contar un archivo como si fuera una visita.

### Cambiado

- **El aviso de privacidad lo dice.** Decía "no usa cuentas, analítica ni cookies de rastreo", y la
  parte de la analítica dejó de ser cierta. Ahora dice qué se cuenta, con qué detalle y qué no se
  guarda, en los dos idiomas, y hay pruebas que lo exigen en la página que la gente abre, no solo en
  el repositorio. Lo que **no** cambia es que navegar no genera peticiones a terceros: el conteo
  ocurre en el mismo origen, así que la CSP no se tocó y la prueba de cero peticiones externas sigue
  en pie.
- La regla de AGENTS.md pasa de "nada de backend" a decir exactamente lo único que corre en el
  servidor y bajo qué condiciones.

### Por qué no se usó lo de Cloudflare

Cloudflare Web Analytics estaba inyectándose solo en el sitio y la CSP lo bloqueaba. Es honesto (no
usa cookies ni huella digital), y habría dado el mismo número gratis, pero exigía abrir `script-src`
a un tercero. `script-src` es la directiva que más pesa: lo que entra por ahí se ejecuta y puede leer
el almacenamiento local, donde vive Mi Zibatá (favoritos, calificaciones, visitas). La diferencia de
fondo es que hoy la promesa es **comprobable**, porque una prueba falla si hay una sola petición
externa, y así habría pasado a ser **confiada**. Se apagó en el panel de Cloudflare.

## [4.8.1]: 2026-10-06

### Cambiado

- **Cada visita baja un solo idioma.** Hasta ahora el catálogo viajaba con el español **y** el inglés
  en el mismo archivo, y nadie usa los dos: eran unos kilobytes de lastre en cada carga. El paquete
  inicial pasa de **121,7 a 119,3 KB**.

  Es la jugada que el propio presupuesto tenía escrita desde la v4.2.0 (*"si el paquete vuelve a
  crecer, esa partición es lo siguiente, no otra subida"*), y tocó hacerla cuando el aviso de
  privacidad nuevo desbordó el límite por 0,1 KB. Recortar un aviso de privacidad para que quepa en
  un presupuesto de bytes habría sido optimizar justo lo que no toca.

  Lo que lo impedía era el botón de idioma: escribe su etiqueta en el idioma **al que lleva**, así
  que la primera pantalla ya necesitaba el otro catálogo. Esas cuatro cadenas viven ahora en
  `cambioDeIdioma.ts`, unos 120 bytes que sí viajan siempre, y con eso el resto se puede aplazar.
  `tIn()` desaparece: era su único uso.

- **`setLocale()` pasa a ser asíncrona.** Si el idioma de destino todavía no está, hay que esperarlo
  antes de cambiar, o se pintaría una pantalla con los textos del anterior. Quien no necesite esperar
  llama y se olvida (`void setLocale(x)`): la interfaz se re-renderiza sola.
- El español sigue importándose de forma estática, a propósito: es el idioma por omisión y el
  respaldo de `localized()`, así que `t()` nunca puede quedarse sin nada que devolver.

### Corregido

- **Un enlace en inglés abría con la interfaz en español.** Al arrancar en `/en/...`, `locale` ya
  valía `en` pero el catálogo inglés aún no existía, así que los textos apuntaban al respaldo y ahí
  se quedaban: cargar el catálogo no lo ponía en uso. En pantalla se veía mitad y mitad, con los
  datos en inglés (que son datos, no catálogo) y la interfaz en español. Encontrado abriendo la
  página, no en las pruebas.

### Nota de implementación

El catálogo se espera **encadenado** y no con `await` de nivel superior en `main.tsx`. Ese `await`
vuelve asíncrono el módulo de entrada y Rollup reparte el código de otra manera: medido, el paquete
inicial no bajaba (121,9 KB) y el CSS inicial se iba de 9,8 a 10,7, rompiendo su propio límite.
## [4.8.0]: 2026-10-05

### Añadido

- **Datos estructurados en las 232 páginas.** Cada ficha lleva un bloque JSON-LD con lo mismo que ya
  dice la página, pero en el vocabulario de schema.org, para que el buscador no tenga que deducirlo
  del texto: nombre, tipo de negocio, descripción, teléfono, dirección, coordenadas, enlace de Maps
  y perfiles oficiales. La portada lista sus zonas y cada zona lista sus locales, como `ItemList` con
  solo nombre y URL, porque los datos de cada destino los lee el buscador de su propia página.
- **El tipo sale de la categoría, no todo es un `Restaurant`**: una panadería es `Bakery` y un bar es
  `BarOrPub`. Cuando la categoría no identifica una forma concreta de negocio se usa el padre común
  (`FoodEstablishment`), y "Otros" se queda en `LocalBusiness`, porque la guía va más allá de la
  comida. Hoy salen 56 restaurantes, 13 cafeterías, 8 de comida rápida, 7 panaderías, 7 bares y 10
  establecimientos sin forma más concreta.

### Decisiones que quedan escritas

- **Sin `openingHours`, a propósito.** El horario es el único dato de la ficha que se pudre solo
  (festivos, temporada, un cambio cualquiera), y si el buscador anuncia "Abierto ahora" sobre un dato
  viejo, alguien hace el viaje para encontrar la puerta cerrada. Hoy los 101 locales llevan el mismo
  `lastVerifiedAt`, así que no hay forma de distinguir un horario fresco de uno rancio. Cuando exista
  una segunda ronda de verificación, ese campo ya da el criterio y emitirlo pasa a ser un filtro. El
  teléfono sí entra: no se pudre igual, y un número viejo es una llamada perdida, no un viaje.
- **Nada que no esté en el dataset**: sin `aggregateRating` (la guía no publica medias), sin
  `priceRange` (nadie lo ha verificado) y sin `review`.
- **Un campo que falta se omite, no se rellena.** Eso deja 24 fichas sin teléfono, 13 sin coordenadas
  y 3 sin dirección: exactamente las que no tienen el dato.
- La dirección de un local es la de su zona, porque está dentro de una plaza y no tiene una propia.
  La localidad, el estado y el país salen de `data/geographic/config.json`.

### Cambiado

- **El E2E del despliegue pasa a ser un humo** (un proyecto, una base). Los mismos 264 tests corrían
  tres veces sobre el mismo código: dos en `ci.yml`, una por cada base, y otra más al publicar.
  Publicar costaba más de media hora y una prueba sensible al tiempo llegó a tumbar un despliegue
  que ya había pasado las dos rondas anteriores. No se quita del todo porque al fusionar con squash
  el commit que llega a `main` nunca existió en el pull request, y es ese artefacto el que se publica.

### Corregido

- **Las 232 páginas llevaban dos descripciones.** El `index.html` de origen está formateado y sus
  etiquetas largas reparten los atributos en varias líneas; los patrones del prerenderizado estaban
  escritos con un solo espacio, así que no encontraban `description` ni `og:description`, creían que
  no existían y añadían una segunda copia. Cada página publicaba la descripción general de la portada
  **y** la suya, y el buscador elegía. Salió publicado en la v4.6.0 y no se vio porque no rompe nada
  a la vista. Ahora los patrones toleran el salto de línea, y el build **falla** si alguna de esas
  etiquetas aparece dos veces: un metadato duplicado deja de ser algo que nadie mira.
- **El acuse de "Enlace copiado" se comprobaba demasiado tarde.** Vive 2,4 segundos y se borra solo;
  la prueba hacía dos viajes al navegador antes de mirarlo, y en un runner cargado ya se había ido.
  Se invierte el orden en vez de alargar la espera: así la carrera no existe, en lugar de ser menos
  probable.

### Nota

El presupuesto de peso **no sube**: `initialJs` sigue en 121,7 KB porque nada de esto llega al
navegador, se escribe al compilar. Lo que sí queda escrito es de qué están hechos esos 121,7 KB y
cuánto cuesta la partición del catálogo de i18n, que el propio archivo ya había señalado en la
v4.2.0 como la jugada siguiente.
### Corregido

- **El mapa no cargaba en producción.** `zibata.pmtiles` se lee con **peticiones Range**, y el hosting
  (Cloudflare Workers con assets estáticos) no las sirve: a un `Range: bytes=0-16383` responde `200`
  con los 2,1 MB enteros, sin `Accept-Ranges`, y lo mismo con cualquier otro archivo. La librería
  aborta con *"Check that your storage backend supports HTTP Byte Serving"*, y la guía mostraba "El
  mapa 3D no está disponible". No es una opción que se pueda activar: ese servidor no hace byte
  serving.

  **Las teselas pasan a servirse sueltas.** Al compilar, el archivo se extrae a 259 archivos
  `dist/map/tiles/{z}/{x}/{y}.pbf` (z12 a z16) más su TileJSON, y MapLibre los pide uno a uno, como
  cualquier mapa. Por la red cuesta **lo mismo**, 2,04 MB, porque dentro del archivo las teselas ya
  viajaban comprimidas, y la mayor sigue pesando 98 KB. Encima quita 7 KB del paquete del mapa (283,5
  a 276,4 KB), porque la librería `pmtiles` deja de viajar al navegador.

  Se descartaron las dos alternativas. Mudar el archivo a R2 o S3, que es lo que recomienda Protomaps,
  sería un segundo origen, y la guía promete y comprueba en sus pruebas que no hace ni una petición
  externa. Y escribir un Worker que implemente los rangos dejaría el proyecto atado a que el hosting
  haga algo especial, que es el problema de hoy con otro disfraz. El archivo único existe para no
  poner millones de teselas en un bucket: con 259 esa ventaja no aplica y el costo sí.

### Cambiado

- **El requisito de `Range` desaparece del proyecto.** Ya no hace falta nada del hosting salvo que
  responda 404 a lo que no existe. Las teselas se escriben en crudo para que funcionen en cualquier
  servidor, y es el `Content-Type: application/x-protobuf` del `_headers` el que hace que el CDN las
  comprima (ese tipo sí está en la lista que comprime Cloudflare; sin declararlo viajarían sin
  comprimir y el mapa pasaría de 2 a 4,2 MB). Un hosting que no lea ese archivo sigue sirviendo el
  mapa, solo que más pesado: nunca roto.
- El presupuesto de peso mide ahora el directorio de teselas (`tiles`) en vez del archivo único. El
  límite se queda en 2100 KB porque el peso por la red no cambió.
- `pmtiles` pasa de dependencia a dependencia de desarrollo: ya solo se usa al compilar.

### Por qué no lo vieron las pruebas

`vite preview` **sí** sirve peticiones `Range`, así que las 222 pruebas E2E pasaban con el mapa roto en
producción. El requisito estaba escrito en DESPLIEGUE.md desde el primer día y el propio `MapView.tsx`
lo nombraba en un comentario, pero nadie lo volvió a comprobar al cambiar de hosting. Queda anotado en
PRUEBAS.md, donde toca: toda la suite corre contra un servidor que no es el de verdad, así que una
publicación se comprueba abriendo el sitio.

### Documentación

- **El README decía cosas que ya no eran ciertas** y es la portada de un repositorio público: se
  llamaba "Zibatá · Comer y beber", prometía un sitio en GitHub Pages y describía una publicación que
  ya no existe. Ahora dice qué es, dónde vive y cómo se publica, con las cifras del dataset al día.
- ARQUITECTURA, MAPA, DESPLIEGUE, CUENTAS y PRUEBAS pierden el requisito de `Range` y explican el
  porqué de las teselas sueltas donde corresponde.

## [4.7.0]: 2026-10-05

### Corregido

- **El mapa no cargaba en producción.** `zibata.pmtiles` se lee con **peticiones Range**, y el hosting
  (Cloudflare Workers con assets estáticos) no las sirve: a un `Range: bytes=0-16383` responde `200`
  con los 2,1 MB enteros, sin `Accept-Ranges`, y lo mismo con cualquier otro archivo. La librería
  aborta con *"Check that your storage backend supports HTTP Byte Serving"*, y la guía mostraba "El
  mapa 3D no está disponible". No es una opción que se pueda activar: ese servidor no hace byte
  serving.

  **Las teselas pasan a servirse sueltas.** Al compilar, el archivo se extrae a 259 archivos
  `dist/map/tiles/{z}/{x}/{y}.pbf` (z12 a z16) más su TileJSON, y MapLibre los pide uno a uno, como
  cualquier mapa. Por la red cuesta **lo mismo**, 2,04 MB, porque dentro del archivo las teselas ya
  viajaban comprimidas, y la mayor sigue pesando 98 KB. Encima quita 7 KB del paquete del mapa (283,5
  a 276,4 KB), porque la librería `pmtiles` deja de viajar al navegador.

  Se descartaron las dos alternativas. Mudar el archivo a R2 o S3, que es lo que recomienda Protomaps,
  sería un segundo origen, y la guía promete y comprueba en sus pruebas que no hace ni una petición
  externa. Y escribir un Worker que implemente los rangos dejaría el proyecto atado a que el hosting
  haga algo especial, que es el problema de hoy con otro disfraz. El archivo único existe para no
  poner millones de teselas en un bucket: con 259 esa ventaja no aplica y el costo sí.

### Cambiado

- **El requisito de `Range` desaparece del proyecto.** Ya no hace falta nada del hosting salvo que
  responda 404 a lo que no existe. Las teselas se escriben en crudo para que funcionen en cualquier
  servidor, y es el `Content-Type: application/x-protobuf` del `_headers` el que hace que el CDN las
  comprima (ese tipo sí está en la lista que comprime Cloudflare; sin declararlo viajarían sin
  comprimir y el mapa pasaría de 2 a 4,2 MB). Un hosting que no lea ese archivo sigue sirviendo el
  mapa, solo que más pesado: nunca roto.
- El presupuesto de peso mide ahora el directorio de teselas (`tiles`) en vez del archivo único. El
  límite se queda en 2100 KB porque el peso por la red no cambió.
- `pmtiles` pasa de dependencia a dependencia de desarrollo: ya solo se usa al compilar.

### Por qué no lo vieron las pruebas

`vite preview` **sí** sirve peticiones `Range`, así que las 222 pruebas E2E pasaban con el mapa roto en
producción. El requisito estaba escrito en DESPLIEGUE.md desde el primer día y el propio `MapView.tsx`
lo nombraba en un comentario, pero nadie lo volvió a comprobar al cambiar de hosting. Queda anotado en
PRUEBAS.md, donde toca: toda la suite corre contra un servidor que no es el de verdad, así que una
publicación se comprueba abriendo el sitio.

### Documentación

- **El README decía cosas que ya no eran ciertas** y es la portada de un repositorio público: se
  llamaba "Zibatá · Comer y beber", prometía un sitio en GitHub Pages y describía una publicación que
  ya no existe. Ahora dice qué es, dónde vive y cómo se publica, con las cifras del dataset al día.
- ARQUITECTURA, MAPA, DESPLIEGUE, CUENTAS y PRUEBAS pierden el requisito de `Range` y explican el
  porqué de las teselas sueltas donde corresponde.

## [4.6.0]: 2026-10-05

### Cambiado

- **Las rutas salen del hash y se abre un árbol por idioma.** `#/lugar/tomassa` pasa a
  `/lugar/tomassa`, y el inglés tiene el suyo: `/en/place/tomassa`. También `/zona/x` y
  `/en/area/x`, `/info/privacidad` y `/en/info/privacy`. La zona sale a la URL como **zona** y no
  como `plaza`: la palabra del código se queda en el código, porque una URL se ve y se comparte. El motivo es tajante: **lo que va después
  de `#` nunca se envía al servidor**, así que el rastreador de Google o el de WhatsApp solo veían
  la portada, daba igual el enlace. El hash existía porque GitHub Pages no sabe reescribir rutas;
  desde que el sitio lo sirve un Worker de Cloudflare con un archivo por ruta, ya no hace falta.
- **El filtro de categoría se traduce entero, nombre y valor**: `?categoria=desayunos-y-cafe` y
  `?category=breakfast-and-coffee`. Una URL mitad en un idioma y mitad en otro no la reconoce nadie,
  y no había enlaces antiguos que respetar porque el filtro nunca llegó a publicarse.
- **La URL manda sobre la preferencia de idioma guardada.** Antes ganaba lo que dijera el
  dispositivo; ahora un enlace a `/en/place/x` abre en inglés aunque este navegador tenga el español
  recordado. La preferencia sigue valiendo para quien entra por la portada, y solo al cargar: si
  redirigiera también con el botón atrás, no se podría volver al árbol español.
- **Cambiar de idioma lleva a la misma página en el otro árbol**, no a la portada: el idioma entra en
  el cálculo de la ruta, así que `LocaleSwitch` no necesita navegar por su cuenta y sigue habiendo un
  único sitio que escribe la URL.
- **Un enlace a un lugar o una zona que no se publica ahora responde 404**, con la página propia del
  sitio, en vez de abrir la guía con un aviso. Es lo correcto: esa dirección no existe, y devolver un
  200 hacía que Google indexara la portada bajo mil direcciones distintas. El aviso en la aplicación
  se queda como red de seguridad para el caso raro de que un registro desaparezca entre dos
  despliegues.
- **El `404.html` estrena la marca del sitio.** Era un texto suelto de cuando el proyecto no tenía
  identidad, y desde que el enrutado salió del hash es una página que la gente ve de verdad. Sin
  JavaScript y con el estilo en línea a propósito: es lo que aparece cuando algo falla, así que no
  debe depender de que el resto cargue.

### Añadido

- **Una página real por ruta: 232 archivos HTML** (116 por idioma), cada uno con su `<html lang>`,
  su `<title>`, su `description`, su `canonical` y las tres `hreflang` (`es`, `en` y `x-default`
  apuntando al español). Las 232 cargan exactamente la misma aplicación; lo único distinto es el
  `<head>`. No se escriben a mano: salen de `data/commercial/*.json` en cada compilación, así que
  añadir un local o cambiarle el nombre se refleja solo en la siguiente publicación.
- **`sitemap.xml` y `robots.txt`** con los dos árboles, generados en el mismo paso.
- **Una imagen de vista previa por local** (`dist/og/<slug>.jpg`), compuesta al publicar y no
  guardada en el repositorio. Hoy ningún local tiene foto, así que la mitad derecha de la tarjeta
  usa el tono de su categoría; el día que haya fotos, esa misma mitad las toma sin tocar código. Se
  renderiza con el navegador de Playwright, que ya era dependencia, en una sola página con las 101
  tarjetas, y se pasa por `sharp` a JPEG: en PNG pesaban 20 MB y en JPEG pesan 1,9 MB.
- **`slug: { es, en }` en las 18 categorías** de `research/taxonomy.json`, derivado de su etiqueta
  inglesa, con esquema Zod, validación en runtime y regeneración de `categories.json`. El `id` sigue
  siendo la clave estable con la que los locales se relacionan con su categoría; el slug es cara
  pública y se puede retocar sin tocar un dato. La validación exige que no se repitan **dentro de un
  mismo idioma** y el build falla si colisionan; entre idiomas sí pueden coincidir (`bar` es `bar`).
- **Pruebas de rutas** (`src/lib/urls.test.ts`) de los dos árboles, el parámetro traducido y la
  traducción de un enlace antiguo con hash. Corren con la base `/visit-zibata/` y nunca con la raíz,
  a propósito: así una ruta construida sin tener en cuenta la base falla en vez de pasar por
  casualidad.

### Corregido

- **Un enlace antiguo con hash sigue llevando a donde prometía.** Al cargar se traduce a su ruta y se
  reescribe, de modo que a partir de ahí todo funciona con el formato nuevo.
- **`vite preview` servía su propio 404 vacío**, así que la prueba de la página de error no
  comprobaba nada. Un plugin le hace servir el `404.html` del build, como el hosting real. El plugin
  no puede declararse `apply: 'build'`: `vite preview` resuelve la configuración como `serve`, y con
  eso quedaba fuera y su middleware no llegaba a registrarse.
- **Las rutas son archivos planos** (`dist/lugar/tomassa.html`) y no carpetas con índice. Cloudflare
  sirve un archivo individual sin barra final, pero redirige `/lugar/tomassa` a `/lugar/tomassa/` si
  es una carpeta: un salto extra en cada enlace compartido y una URL canónica distinta de la que se
  comparte.
- **La detección del idioma del navegador se retira.** Con un árbol por idioma, detectarlo hacía que
  un rastreador que pide la portada en inglés acabara redirigido a `/en` y la portada española
  dejara de indexarse. La preferencia elegida a mano se conserva.

### Corregido (hallazgos de la revisión)

- **El campo trampa del formulario no protegia de nada.** Se enviaba `botcheck` siempre vacío y
  codificado a mano, y no existía ningún campo en la página que un robot pudiera rellenar: el
  comentario prometía una defensa que no podía ocurrir. Ahora el campo existe de verdad, fuera de
  pantalla y fuera del tabulador, con etiqueta propia para quien use lector de pantalla (un control
  enfocable con `aria-hidden` sería una violación de accesibilidad). Si llega relleno, el envío se
  descarta antes de salir del navegador y el robot ve el mismo acuse que si hubiera funcionado.
- **El paquete se llamaba `zibata-comer-y-beber`**, nombre anterior al cambio de lema, y su
  descripción seguía diciendo "comida y bebida". Pasa a `visit-zibata`. También el `user-agent` con
  el que el pipeline de mapas se presenta ante los servidores de OpenStreetMap, que es la única de
  las dos cosas que se ve desde fuera.

### Nota de despliegue

El paso de imágenes va **después** del build en `deploy.yml`, nunca antes: el build limpia `dist/`,
así que unas imágenes generadas primero desaparecerían sin dejar rastro y cada enlace compartido
volvería a mostrar la imagen de la portada. Los navegadores de Playwright se instalan antes del build
porque la composición de esas imágenes también usa Chromium.

## [4.5.1]: 2026-10-05

### Añadido

- **Kode Mono para el wordmark de la firma**, que es lo que pide la guía de marca de aurariola.com y
  hasta ahora caía a la monoespaciada del sistema. Cuesta **10,4 KB**: el navegador descarga solo
  `kode-mono-latin-600-normal.woff2`, porque "aurariola.com" es latín puro y el archivo de latín
  extendido nunca se pide. No bloquea el pintado (`font-display: swap`) y no toca `initialJs`; el
  CSS inicial pasa de 9,7 a 9,8 KB con las declaraciones `@font-face`.

## [4.5.0]: 2026-10-05

### Corregido

- **Gitleaks fallaba desde el traslado a la organización.** `gitleaks-action` exige clave de licencia
  cuando el repositorio pertenece a una organización: *"[aurariola-studio] is an organization. License
  key is required."*. Pasa a usarse el **binario** con la versión fijada (8.30.1), que es el mismo
  escáner bajo licencia MIT y no pide clave. El `checkout` del workflow de publicación gana
  `fetch-depth: 0`, porque el escaneo recorre la historia y no solo el árbol de trabajo.

## [4.4.0]: 2026-10-04

### Cambiado

- **El lema deja de ser "Comer y beber" y pasa a "La guía de zibateños para zibateños"**, porque el
  proyecto apunta más allá de la comida. En inglés va "By locals, for locals": el gentilicio no tiene
  equivalente y forzarlo sonaría a traducción. Cambia en el `<h1>`, el título, Open Graph, el
  manifiesto y la imagen social. Y también en los textos que describen la guía: el resumen de zonas,
  los tres pasos del tutorial, "Acerca de esta guía" y la hoja de perfil. Se fue "busca un antojo" y
  se fue "lo que más se te antoja", que acotaban a comida sin nombrarla. El criterio es que ningún
  texto de interfaz prometa un alcance menor que el del proyecto.
- **Sobre el mapa, la marca es solo el símbolo.** Antes la barra superior llevaba nombre y lema, que
  competían con el buscador justo donde más falta hace el ancho. El nombre sigue estando para quien
  escucha, en el `<h1>` oculto, así que no se pierde nada. Las pantallas de carga y de error sí
  conservan el lockup completo: ahí la marca está sola y tiene sitio.
- **La firma de autoría pasa a ser el lockup oficial de aurariola.com**: su símbolo, "un proyecto de"
  y el wordmark, tal como lo define su guía de marca. Antes era un "by aurariola.com" inventado. El
  símbolo se reconstruye desde la guía (anillo de píxeles sobre teja, rejilla de 256 con paso 32) y
  respeta su regla principal: **un solo módulo en oro**, el cursor.
- En la franja del mapa la firma va sin el conector: con el lockup entero, la leyenda de
  independencia pasaba a dos renglones incluso a 1920 px. En "Acerca de esta guía" va completo.

### Nota de accesibilidad

El oro de marca (`#b7791f`) va **tal cual en el símbolo**, que es un dibujo y le basta con 3:1. En el
punto del wordmark, que es texto de 11 px, se usa `--gold-700` (`#8a5a10`): el oro de marca se queda
en 3,3:1 sobre las superficies arena cuando hace falta 4,5:1.

### Pendiente

La guía de marca pide **Kode Mono** para el wordmark y no está empaquetada: hoy cae a la monoespaciada
del sistema. Añadirla cuesta unos 12 KB de fuente para cuatro palabras, así que es una decisión del
propietario, no del código.

## [4.3.0]: 2026-10-04

### Añadido

- **Licencias explícitas, que en un repositorio público faltaban.** Sin archivo `LICENSE` lo
  predeterminado es "todos los derechos reservados": el código estaba a la vista y legalmente nadie
  podía usarlo ni contribuir. Son dos licencias porque son dos cosas: **MIT** para el código y
  **CC BY 4.0** para los datos comerciales y la investigación. Las capas del mapa siguen bajo ODbL
  1.0, que es obligación heredada de OpenStreetMap y manda sobre lo anterior.
- **`SECURITY.md` y `CONTRIBUTING.md` en la raíz**, apuntando a los documentos de `docs/`. GitHub
  busca esos nombres exactos, así que con `docs/SEGURIDAD.md` y `docs/CONTRIBUIR.md` no aparecía el
  botón de reportar una vulnerabilidad.
- **`.nvmrc`**: los workflows fijaban Node 24 pero quien clonara no tenía forma de saberlo.

### Corregido

- **Gitleaks nunca se había ejecutado.** Estaba solo en `ci.yml`, que corre con pull requests, y
  hasta ahora todo fue directo a `main`. Ahora también corre en el workflow de publicación.
- **`ci.yml` probaba la subruta `/zibata-comer-y-beber/`**, nombre anterior al rebranding.

### Cambiado

- **El presupuesto de `initialJs` sube de 120 a 122 KB**, con la razón escrita al lado del número
  como las dos subidas anteriores de `dataJs`: el botón de compartir de la v4.1.0 cuesta 0,7 KB gzip
  medidos con y sin la función, y solo quedaban 0,1 de margen. Queda anotado que si el paquete vuelve
  a crecer, lo siguiente es partir el catálogo de i18n por idioma (unos 5 KB, porque hoy viajan los
  dos y solo se usa uno), no otra subida del límite.
- **`SITE_URL` apunta por omisión a `https://visitzibata.com/`**, el dominio del proyecto.
- **El destino en Cloudflare es un Worker con assets estáticos, no un proyecto de Pages**, con su
  `wrangler.jsonc`. Cloudflare está integrando Pages dentro de Workers y los sitios estáticos nuevos
  se crean así. Para el sitio no cambia nada (los mismos archivos, el mismo `_headers`, que los
  Workers con assets también leen); cambia el comando (`wrangler deploy`) y el permiso que necesita
  el token. `not_found_handling: "404-page"` conserva los 404 reales, que es lo que impide que un
  error de tecleo responda 200 y acabe indexado.

## [4.2.0]: 2026-10-04

### Cambiado

- **La publicación pasa de GitHub Pages a Cloudflare Pages, y se hace desde GitHub Actions, no con la
  integración de Git de Cloudflare.** Esa integración compila por su cuenta y no corre las pruebas:
  publicaría igual con el presupuesto de peso roto, con axe en rojo o con los tests de CSP fallando.
  Las puertas de este repositorio solo sirven si nada se publica sin pasarlas, así que el workflow
  valida, compila, mide y prueba, y solo entonces llama a `wrangler pages deploy`.
- **La página 404 decía "Zibatá · Comer y beber"**, un resto del rebranding de la 4.0.0.

### Añadido

- **`dist/_headers`, generado por el build** desde la misma constante que el `<meta>` de la CSP, para
  que no puedan divergir: cuando las dos existen el navegador aplica la intersección, y tocar una sin
  la otra daría un bloqueo difícil de diagnosticar. Añade lo que un `<meta>` no puede declarar
  (`frame-ancestors`), más `Referrer-Policy`, `X-Content-Type-Options`, `Cross-Origin-Opener-Policy`,
  `Permissions-Policy` y el `Cache-Control` por tipo de archivo.
- **`wrangler` como dependencia de desarrollo fijada en el lockfile**, en vez de descargarla sin fijar
  al publicar: es la misma disciplina con la que las acciones van fijadas por SHA.

## [4.1.0]: 2026-10-04

### Añadido

- **Botón de compartir en la ficha de cada lugar**, con la hoja del sistema donde la hay y el
  portapapeles donde no. Si el navegador no trae ninguna de las dos, el botón no se dibuja: uno que
  no puede hacer nada estorba más de lo que ayuda.
- **La URL que se comparte es la canónica del lugar, no la de la vista.** El hash arrastra la
  categoría activa, así que compartir lo que hay en pantalla daría una URL distinta por cada filtro
  desde el que alguien comparta el mismo local. Que todos los enlaces entrantes converjan en una
  sola URL es lo único que este botón aporta de verdad al SEO. La raíz sale de `SITE_URL` cuando se
  compiló con ella (`__SITE_URL__`), para que compartir desde github.io y desde el dominio propio
  dé el mismo enlace.

### Nota sobre el alcance

El botón **no** hace indexable una ficha, y conviene no darlo por hecho: los rastreadores no indexan
fragmentos, de modo que `#/lugar/tomassa` es para Google la misma URL que la portada, y la vista
previa de un enlace compartido es siempre la de Open Graph de `index.html`, porque los rastreadores
de los chats no ejecutan JavaScript. Eso depende de sacar el enrutado del hash (MARCA.md §6).

### Por qué no está en la tarjeta del índice

Se pidió por tarjeta y se implementó ahí primero, pero medido no cabe. El botón ocupa 36 px de la
fila y, a 375 px de ventana, **19 de 86 tarjetas pasaban a cortarse con puntos suspensivos**: las
líneas de giros cortadas subían de 0 a 12 y los nombres de 2 a 11, deshaciendo el ajuste de la v3.2.0.
Barriendo anchos, la fila solo deja de cortarse a partir de 448 px de tarjeta, y en escritorio la
tarjeta del panel mide entre 306 y 386 px: una consulta de contenedor dejaría el botón visible solo
en tableta vertical. La ficha es la vista individual del lugar y ahí sí hay sitio.

## [4.0.0]: 2026-09-29

### Cambiado

- **La guía se llama Visit Zibatá y tiene marca nueva: una brújula cuya aguja es la letra Z.** El
  símbolo anterior era un volumen isométrico dentro de una baldosa, que decía "plaza" pero no decía
  ni el lugar ni que esto fuera una guía. La pieza nueva se dibuja una sola vez: media Z, de la
  punta al centro, y la otra mitad es esa misma girada 180 grados. Encajan exactas porque el punto
  medio de la diagonal de una Z es su centro. El trazo nace en cero en las dos puntas y engorda
  hacia el centro, así que la pieza entera es a la vez la aguja de una brújula y la letra, y donde
  cambia de color es el pivote. El aro y la rosa repiten el olivo de la mitad de arriba: nada se
  lee como un objeto pegado encima.
- **El contorno de la Z se construye como una letra, no desplazando una línea central a los dos
  lados por igual.** Ese método falla en los codos: por fuera no puede cerrar más apretado que el
  propio grosor, y en una vuelta tan cerrada como la de una Z eso da media luna; por dentro las dos
  orillas se cruzan, el lazo se recorre al revés y el relleno lo cancela, dejando una grieta donde
  debía haber esquina. Ahora cada tramo se desplaza por su cuenta y se juntan en la esquina, con
  inglete por dentro y una vuelta de tensión regulada por fuera.
- **Hay dos cortes del mismo dibujo, como una tipografía tiene su versión de texto.** Por debajo de
  40 px el trazo, el aro y las puntas van más gordos y el hueco entre las dos mitades baja de 12 a
  8: con el corte grande, a 16 px el hueco se come la diagonal y la Z se parte en dos piezas
  sueltas. Aun así, a 16 px la letra es más una insinuación que una letra: es el límite de meter
  una letra dentro de un aro.
- **El símbolo entra por `<img>` desde `public/logo.svg`, no en línea en el paquete.** En línea
  suma cerca de 3 KB gzip y el paquete inicial está en 119,8 de 120 KB de presupuesto.
- **Los cinco PNG de icono salen de `public/logo.svg`** con `npm run images:icons`, que antes solo
  generaba los dos "maskable" y llevaba el símbolo copiado dentro. Sobre el olivo del fondo el
  símbolo va en papel y en lima clara: el lima de la marca queda demasiado cerca del olivo y la
  aguja pierde sus dos mitades.

### Añadido

- **Firma de autoría "by aurariola.com"** en la franja inferior y en "Acerca de esta guía", en
  monoespaciada y con el punto en oro. El oro de esa marca (#b7791f) se queda en 3,3:1 sobre las
  superficies arena y no llega al 4,5:1 que pide un texto de 11 px, así que se usa el mismo oro
  oscurecido hasta 5:1 (`--gold-700`).

### Corregido

- **La franja de la guía ya no sale en la imagen social.** Pasa de `<div>` a `<footer>`, que es lo
  que es, y el generador puede ocultarla: las clases de los módulos CSS llevan un hash distinto en
  cada build y no se pueden seleccionar desde fuera.
- **`npm run images:og` documentaba que servía contra `npm run preview`, y no.** El build inyecta
  una CSP con `style-src 'self'` que bloquea el `addStyleTag` del propio script. Solo corre contra
  `npm run dev`, que es ahora el valor por omisión.

## [3.2.0]: 2026-09-29

### Cambiado

- **El ritmo vertical de la ficha pasa a ser una escala de tres pasos, escrita en el CSS.** Antes
  eran 16 px dentro de la cabecera y 20 px entre secciones: un sistema, pero con los dos pasos tan
  cerca que se leían como un descuido. Ahora son 4 px entre un texto y su pie, 12 px entre las
  piezas de un mismo bloque y 20 px entre los bloques de la ficha. La proporción de 3 a 5 entre el
  paso de dentro y el de fuera es lo que los hace legibles como dos niveles. De paso baja el aire
  alrededor de las estrellas y la cabecera pasa de 213 a 201 px.
- **El dibujo de los elotes lleva la línea central y las dos hojas hacia arriba**, una a cada lado,
  que es lo que se pidió. Se probaron tres separaciones de hoja a 64, 28 y 20 px: con las hojas
  largas la silueta se emborrona al tamaño de la lista.

### Añadido

- **Dos pruebas de regresión** que faltaban: una comprueba que la flecha de desplazamiento aparece
  sobre el mapa y que su centro y su altura coinciden con los de las pastillas; la otra, que el
  ritmo vertical de la ficha sigue siendo uniforme en cada uno de sus niveles. Las dos vigilan
  fallos que se colaron porque nada los miraba.

## [3.1.0]: 2026-09-29

### Arreglado

- **Las flechas para desplazar las pastillas de filtro no aparecían sobre el mapa.** La barra
  superior alinea a la izquierda para que el buscador no se estire, y sin `align-self: stretch` la
  fila de filtros crecía hasta su ancho de contenido (2739 px en escritorio): se salía de la
  pantalla, pero dentro de su propio carril no desbordaba, así que el componente no tenía nada que
  detectar y nunca dibujaba la flecha.
- **Las flechas no quedaban centradas con las pastillas.** El carril llevaba un relleno vertical
  desigual (2 px arriba, 4 px abajo), así que la flecha, centrada sobre el carril, caía 2 px baja
  respecto de las pastillas. El relleno se iguala y la flecha pasa a medir lo mismo que una
  pastilla.
- **El hueco sobre la leyenda de traducción era enorme** (26 px). La descripción y su leyenda eran
  dos hijos del panel, que separa a los suyos con 20 px, y encima sumaban el margen propio. Ahora
  son un solo bloque y el hueco es de 6 px.
- **El dibujo de Elotes y Esquites era un borrón a 20 píxeles.** Iba inclinado 42 grados y con los
  granos punto a punto, que a ese tamaño se apelmazan. Se redibujó de pie, con los granos en
  hileras y una hoja abajo.

### Cambiado

- La leyenda de traducción pasa a "Automatic Translation" ("Traducción automática" en español) y
  baja de 13 a 12 px.
- "Contact and social" pasa a "Contact and socials".

## [3.0.0]: 2026-09-29

### Añadido

- **La guía se lee entera en inglés.** Las 18 categorías y los 58 giros estrenan o corrigen su
  `label.en`, en Title Case y sin calcos: "Entre Panes" deja de ser "Between bread" y pasa a
  "Sandwiches & Wraps", "Antojitos" a "Street Snacks" y "Papas Preparadas" a "Loaded Chips". Antes
  faltaban 31 giros y una categoría, y catorce de los que había mezclaban minúsculas.
- **Las 15 descripciones de plaza en inglés.** Las escribe la guía, así que su inglés es texto
  propio y va sin leyenda.
- **Las descripciones de los locales, traducidas y marcadas como tal.** En inglés se lee la
  traducción con la leyenda "Machine translation" y un botón que devuelve al original en español,
  porque el texto lo escribió el negocio y quien quiera leerlo tal cual debe poder. 90 de los 101
  locales activos estrenan traducción; los otros 11 ya venían en inglés y se muestran sin leyenda.

### Cambiado

- **`description` pasa de texto suelto a `{ es, en }`** en locales y plazas, con el mismo patrón que
  ya usaban las etiquetas. En el CSV son dos columnas, `description` y `descriptionEn`. El buscador
  indexa los dos idiomas.
- **El giro "Café" lleva la taza**, no el filtro de café de especialidad.

### Rendimiento

- **El presupuesto de `dataJs` sube de 30 a 34 KB.** Las etiquetas y las descripciones viajan ahora
  en dos idiomas y el paquete de datos pasa de 28.6 a 32.0 KB. Es el mismo caso que en v1.5.0, y
  queda registrado junto al límite: si el dato vuelve a crecer, antes de subir el número toca partir
  el paquete por idioma, que hoy no se hace porque obligaría a recargar los datos al cambiar de
  idioma en caliente.

### Quitado

- **Cuatro restos sin uso**: el dibujo `pour-over`, que se quedó sin giro al darle la taza a Café;
  el componente `StarScale`, que no renderizaba nadie; la constante `CONTACT_URL`, cuyo comentario
  prometía que la interfaz la mostraba sola y no la leía nadie; y `loadDataset`, un agregador sin
  llamadas. La lista de iconos de la documentación estaba desactualizada y se regenera del propio
  componente.

## [2.0.0]: 2026-09-29

Vuelta grande: se revisaron los 101 locales uno por uno y salieron cambios de fondo en el modelo.

### Quitado

- **El tercer nivel (`tags`).** Era un cajón invisible que solo alimentaba al buscador, y complicaba
  el modelo sin que nadie lo viera. Lo que vivía ahí y merecía existir se convirtió en giro; lo demás
  se fue. Fuera del esquema, del CSV, del índice de búsqueda y de la documentación.
- **El giro "Café de Especialidad"**, fusionado con "Cafetería" en uno solo llamado **Café**, que
  deja de ser el general de su estante: no hay un "esto en general" que abarque café y desayuno a la
  vez, así que se ponen los dos giros, o brunch.

### Añadido

- **Siete giros nuevos**: Cecina (Mexicana), Empanadas (Tacos y Antojitos), Wraps y el general
  Entre Panes (Entre Panes), Papas Fritas y Hot Dogs (Comida Rápida) y Crepas (Postres y Dulces).
- **Seis dibujos nuevos**, probados a 64, 28 y 20 px y comparados con los que ya existían para que
  ninguno se confunda: la cecina en lámina, el cono de papas a la francesa (distinto de la bolsa de
  Papas Preparadas), el hot dog con la mostaza de punta a punta, la empanada con su repulgue, el
  wrap con la costura del enrollado y la crepa doblada en cuarto. La crepa se rehízo dos veces: el
  primer intento se leía como rebanada de pizza.

### Cambiado

- **"Crepas y Waffles" se parte en dos**: Crepas y Waffles, cada uno por su lado.
- **"Alitas y Hamburguesas" pasa a "Comida Rápida"** para recoger también Papas Fritas y Hot Dogs.
  Cuando un estante junta más platos de los que caben en su nombre, se le busca uno que los abarque
  en vez de alargar la lista.
- **Los giros se llaman por la comida, no por el local**: Taquería pasa a **Tacos** y Marisquería a
  **Mariscos**, porque se dice "quiero tacos" y no "quiero taquería". Las cocinas enteras siguen
  igual ("quiero comida italiana") y Panadería, Repostería y Pastelería también, que ahí el nombre
  del oficio es el de lo que se come.
- **"Casera" vuelve a ser "Comida Casera"**: era la única de las seis renombradas donde el arranque
  genérico formaba parte del nombre que la gente usa.
- **35 locales reasignados** siguiendo la revisión uno por uno, sin inventar nada: cada cambio sale
  de un comentario. Los ids de giro no se tocan, así que ningún enlace se rompe.

## [1.27.0]: 2026-09-29

### Cambiado

- **En la ficha, principales y secundarios se pintan igual.** Se acabó el gris y el dibujo tenue del
  secundario: ahí todos son lo que se vende en el local, y el orden ya dice cuál manda. El nivel
  sigue decidiendo quién lleva icono en la lista y quién sale en la ilustración redonda, que es
  donde falta sitio. Con eso desaparece el atributo `data-nivel`, que ya no pintaba nada.

### Añadido

- **Dos pruebas que faltaban del contrato de los dos niveles.** El filtro ya tenía la suya, pero
  nadie comprobaba que un giro secundario se busque igual que un principal ni que arrastre igual en
  el orden personal, que es justo lo que quiere decir "el nivel es peso visual, no visibilidad".

## [1.26.0]: 2026-09-29

### Arreglado

- **La diferencia de estilo entre principales y secundarios no se estaba aplicando.** Los tres
  selectores apuntaban a `li` y el marcado había pasado a `span` al convertir la lista en párrafo:
  el formateador reescribió las comillas del archivo entre un paso y el siguiente, y la sustitución
  dejó de coincidir en silencio. Los dos niveles se veían idénticos en la ficha.
- **Una prueba de foco fallaba de vez en cuando.** El foco del título lo pone un efecto y la prueba
  no lo esperaba, así que a veces le ganaba la carrera. Ahora espera.

### Cambiado

- **La ficha decide sola entre una fila y un renglón por giro**, según el ancho que de verdad tiene
  el bloque, con una consulta de contenedor y no una media query: con el panel estrecho o la
  pantalla partida la ventana es ancha y el hueco no. El corte son 21 rem, el ancho del caso peor
  (tres giros y treinta y seis letras, que ocupan 323 px), así que dentro de una misma vista todos
  los locales se leen igual. A 375 px el bloque mide 267 px y va en columna; a 450 px mide 342 px y
  va en fila con 19 px de holgura.
- **El título de la ficha reparte sus líneas** (`text-wrap: balance`), para que no quede un renglón
  largo arriba y una palabra suelta abajo ("La Marmota Wings and / Beer").

## [1.25.0]: 2026-09-29

### Quitado

- **El sistema de nombres cortos** (`short` en la taxonomía). Tener dos nombres para el mismo giro,
  uno para la lista y otro para la ficha, costaba más de lo que resolvía. Los giros que sobraban de
  largo se renombraron de verdad, uno solo para todas partes.

### Cambiado

- **El giro general de una cocina se llama como su estante**: Cocina Italiana pasa a Italiana,
  Cocina Mexicana a Mexicana, Cocina Asiática a Asiática, Cocina Internacional a Internacional,
  Comida Saludable a Saludable y Comida Casera a Casera. El arranque genérico no decía nada que el
  adjetivo no dijera ya. Los ids no cambian (`cocina-italiana` sigue siendo `cocina-italiana`),
  así que ningún local se toca.
- **La línea de la lista deja de tener un tope fijo de nombres y pasa a tener un presupuesto.**
  Caben los giros que entren en 25 letras, siempre al menos uno, y el resto se cuenta. El tope de
  dos no bastaba sin los nombres cortos: "Jugos y Smoothies · Alto en Proteína" son dos nombres y
  se cortaban igual. De paso, donde caben tres ahora se leen los tres ("Pasta · Italiana · Pizza").
  Medido sobre los 86 locales de las once plazas: cero cortados.
- **La ficha lleva un renglón por giro**, no uno por nivel. Repartirlos dos y uno partía la lista
  por donde no hay junta. El nivel se lee en el estilo de cada renglón: el principal en verde y
  negrita, el secundario en gris y con el dibujo más tenue. Los renglones se apretaron a 17 px, así
  que tres giros ocupan 52 px y la cabecera pasa de 97 a 107 px en un teléfono.

## [1.24.0]: 2026-09-29

### Añadido

- **Nombre corto para los giros de nombre largo** (`short` en la taxonomía, hoy diecinueve: Pub y
  Cervecería -> Cervecería, Cocina Mexicana -> Mexicana, Jugos y Smoothies -> Jugos). Solo se usa
  donde hay una sola línea; la ficha sigue leyendo el nombre completo.

### Cambiado

- **La línea de giros de la lista ya no se corta.** Se nombran dos giros como mucho, con su nombre
  corto, y el resto se cuenta ("Alitas · Hamburguesas +1"); la lista entera con los nombres
  completos queda en el `title`. Se probaron cinco formas contra los ocho locales de línea más larga
  a 375 px: la de antes cortaba ocho de ocho, esta no corta ninguno.
- **Los dibujos de la ilustración redonda comparten una sola placa** en vez de llevar una cada uno.
  Con una por dibujo se tocaban entre sí y rozaban el borde del círculo, y el tercero no cabía: por
  eso Castore, con tres giros principales, solo enseñaba dos. Ahora la placa crece con la cuenta
  (46%, 66% y 82% de ancho) y los tres se ven con aire alrededor.
- **La ficha ya no dice "También" delante de los secundarios.** El renglón de abajo, más tenue y con
  sus iconos, ya dice lo mismo sin gastar una palabra. Cada nivel sigue en su renglón, y los dos
  juntos miden 38 px, así que la cabecera no crece.

## [1.23.1]: 2026-09-29

### Arreglado

- **La ilustración redonda volvía diminutos los dibujos.** Al meter el icono compuesto, el ancho de
  cada placa pasó a medirse contra un contenedor que se encogía al tamaño de su propio contenido, así
  que el porcentaje se medía contra sí mismo. El contenedor ocupa ahora todo el marco y el dibujo
  llena más su placa (64% en vez de 56%).
- **La línea de giros se cortaba a media palabra en la lista.** En un contenedor flex,
  `text-overflow` no alcanza al texto suelto: hacía falta envolverlo. Ahora recorta con puntos
  suspensivos y el texto completo queda en el `title`. No era culpa de los secundarios: de las
  dieciséis líneas que pasan de treinta caracteres, once son de puros principales.
- **En la ficha, cada nivel tiene su renglón.** Antes los tres giros iban en una sola línea que se
  partía por donde caía; ahora los principales van arriba y los secundarios debajo, con su "También"
  y en tono más tenue.

## [1.23.0]: 2026-09-28

### Añadido

- **Dos niveles de giro.** Cada local reparte sus giros entre **principales** (lo que lo define) y
  **secundarios** (lo demás que se vende ahí), con el tope de tres contando entre los dos. El nivel
  es peso visual, no visibilidad: los dos filtran, se buscan y pesan igual en el orden personal, así
  que un secundario sigue llevando al local a su estante. Lo que cambia es dónde se dibuja cada uno:
  en la lista solo los principales llevan icono y los secundarios se leen; la ilustración redonda
  del local sin foto enseña hasta dos dibujos, siempre de los principales; y la ficha es la única
  vista que enseña el dibujo de todos, con el del secundario más tenue.
- **Doce locales estrenan secundario**, y ninguno inventado: son los que ya declaraban esa línea en
  sus propios `tags` (Cosi Fan Tutte hace pizza, Bocuze hace brunch, La Marmota tiene cervecería).

### Cambiado

- La columna `secundarios` se suma al CSV de importación, al esquema (con la regla de tres entre los
  dos niveles y la prohibición de repetir un giro) y a la tubería de `research/decisions.json`.

## [1.22.3]: 2026-09-28

### Arreglado

- **La quesadilla estaba al revés**: al doblar una tortilla redonda el doblez es el lado recto y la
  curva es por donde se abre, así que el queso salía por donde no. Le di la vuelta.
- **El elote se rehace desde cero**, calcado de la referencia: mazorca inclinada con los granos
  dibujados uno por uno, no con rayas, y la hoja grande abajo.
- **La memela pierde el plato**: queda la masa, la salsa como mancha irregular dentro y el queso
  encima.

## [1.22.2]: 2026-09-28

### Arreglado

- **El bolillo del icono de "Entre Panes" vuelve**: se había perdido al rehacer la rebanada, que
  ahora va detrás, más chica y con sus hombros. También se rehacen la mazorca (inclinada y sola, con
  los granos en rombo), la memela (en su plato y vista desde arriba, con el borde irregular de la
  masa) y la quesadilla (tres gotas de queso de largos distintos).

## [1.22.1]: 2026-09-28

### Arreglado

- **Cuatro iconos, dos de ellos contra referencias nuevas**: la rebanada de pan de caja recupera sus
  hombros y su miga, la mazorca se rehace con la hoja separada del cuerpo y su palo, la memela deja
  de ser un círculo plano y pasa a tener canto, y el queso de la quesadilla cuelga en gota, cargado a
  un lado para que no parezca el mango de un paraguas.

## [1.22.0]: 2026-09-28

### Añadido

- **Giro "Ramen"** en Asiática. Castore MX se presenta como hamburguesas, alitas y ramen, las tres con
  la misma jerarquía, así que ahora lleva esos tres giros y sale en dos estantes. Pierde "Desayunos"
  porque el tope siguen siendo tres giros por local.

### Arreglado

- **Nueve iconos**: Italiana pasa a un plato de pasta a la bolonesa (en plato plano, para no
  confundirse con el tazón con tenedor del giro Pasta), las papas a una bolsa sellada, el brunch
  cambia el vaso por una taza de café, el elote se rehace con su contorno de bultos y su hoja, la
  memela queda en una sola pieza con el relleno visible, el queso de la quesadilla se agranda hasta
  verse, la rebanada de pan de caja se ensancha y el cerdo de las carnitas mejora orejas y hocico.

## [1.21.1]: 2026-09-28

### Arreglado

- **Nueve iconos rehechos comparándolos contra la referencia**, no de memoria: poner tu imagen al
  lado de mi versión enseñó lo que faltaba, que siempre era el detalle que los hace reconocibles. La
  arepa recupera su borde ondulado, las memelas van sobre el plato, la quesadilla va ladeada, los
  hot cakes pasan a discos sueltos (unidos parecían una hamburguesa), la birria empareja el tamaño
  del taco y el consomé, y la rebanada de pizza, el pan de caja, el elote y el bote de papas se
  ajustan a tu ejemplo.

## [1.21.0]: 2026-09-28

### Cambiado

- **"Pizza y Pasta" se funde en "Italiana"**, con Cocina Italiana de giro general y Pizza y Pasta
  dentro. Es tu decisión, tomada a sabiendas de que Domino's y El Hornero caen en un estante con
  nombre de cocina: quien quiere italiano busca "Italiana", la ficha del local nunca imprime la
  categoría y El Hornero se sigue leyendo "Parrilla Argentina · Pizza". Queda escrito en DATOS.md.
- **El açaí se separa de la fruta**: "Açaí" y "Bowls de Fruta" son dos giros. All Berries lleva los
  dos, porque su propio texto dice "Açai & fruit bowls".
- **Castore MX Game & Snack** pasa de Botanas a Hamburguesas y Alitas, revisado en campo. El giro
  "Botanas" se queda vacío a propósito, esperando al primero que sí venda botana de bolsa.

### Arreglado

- **Catorce iconos redibujados sobre las referencias que mandaste**: rebanada de pizza con tazón de
  pasta (Italiana), tenedor y fetuccine (Pasta), dos rollos de maki (Sushi), pan de caja con barra
  (Entre Panes), bote con papas asomando, vaso de esquites con elote (Elotes), hot cakes con bebida
  (Brunch), arepa con marcas de comal, dos memelas encimadas, tortilla doblada escurriendo queso
  (Quesadillas), taco con su consomé (Birria), un cerdo (Carnitas), el comal con medios círculos
  (Antojitos) y el tazón de fruta.

## [1.20.0]: 2026-09-28

### Añadido

- **"Italiana" es su propio estante**, con Cocina Italiana de giro general. Tenías razón en que un
  giro no puede abarcar más que la categoría que lo contiene: colgar la cocina italiana de "Pizza y
  Pasta" prometía menos de lo que sirve el local. Así queda como Mexicana y Asiática, y la pizza
  sigue sin arrastrar a Domino's ni a El Hornero a un estante de cocina italiana.
- **"Bebidas"**, con Jugos y Smoothies y Boba dentro. Ninguno de los dos vivía donde se busca: nadie
  filtra "Postres y Dulces" para un té de tapioca ni "Saludable" para un jugo.

### Cambiado

- **Las alitas se van con las hamburguesas**, y el estante pasa a llamarse "Alitas y Hamburguesas".
  Tres de los cinco locales con alitas ya hacían hamburguesas, y ninguno servía las alitas como
  botana de bolsa. "Para Picar" se queda con lo que sí se pica: botanas, papas, elotes y gaspachos.
- **Memelas y Quesadillas se separan de "Antojitos"**, igual que las arepas, porque los dos locales
  lo dicen en su propio texto: "las tradicionales Memelas de la Rana" y "nuestras quesadillas
  fritas". "Antojitos" se queda para el que vende de todo un poco.
- **"Bowls de Açaí" pasa a "Bowls de Fruta"**, que también cubre los de granola y fruta sola, y
  **"Gastrobar" a "Restaurante Bar"**.
- La prueba que prohibía la palabra "alitas" en el nombre de una categoría se sustituye por la que
  comprueba la regla nueva: una cocina entera solo puede ser el giro general de su estante.

### Arreglado

- **Catorce iconos**: jitomate (Italiana), pizza entera (el estante), maraña de fetuccine (Pasta),
  dos rebanadas (Entre Panes), nigiri con la lonja encima, mazorca con los granos en rombo, bolsa de
  frituras, campana de servicio (Brunch), tazón con carne (Birria), pierna (Carnitas), comal
  (Antojitos), memela, quesadilla, arepa partida y las perlas del boba, que se apelmazaban.

## [1.19.0]: 2026-09-28

### Cambiado

- **Cocina Italiana cambia de estante**: pasa de "Internacional" a "Pizza y Pasta". Una cocina con
  nombre propio vive donde vive su plato, como la parrilla argentina, y en Internacional solo queda
  lo que no tiene un plato que lo represente (bistró, fusión). Cosi Fan Tutte ya sale al filtrar
  Pizza y Pasta, que es donde lo busca quien quiere comida italiana.
- **"Botanas" pasa a "Para Picar"** como nombre del estante. El nombre viejo dejaba fuera las
  alitas, que son cinco locales y ninguno las sirve como plato fuerte. El giro "Botanas" se queda
  dentro para lo que sí es botana.
- **"Bowls" pasa a "Bowls de Açaí"**: el envase no es el antojo, y con el nombre anterior cabía
  cualquier tazón, incluido el de ensalada o el de poke.
- **"Antojitos de Masa" pasa a "Antojitos"** y **"Gastrobar" a "Bar con Cocina"**, que es como se
  dice hablando. "Gastrobar" sigue funcionando como sinónimo de búsqueda.

### Arreglado

- **Once iconos redibujados**: pan de caja (Entre Panes), nigiri, huarache (Antojitos), arepa
  partida, consomé (Birria), cazo con pala (Carnitas), hotcakes (Brunch), mazorca, bolsa de
  frituras (Papas), trompo (Kebabs) y moño de pasta. Cada uno se eligió probándolo a 20 px, que es
  el tamaño al que se ven en la guía, y no a tamaño de lienzo.

## [1.18.1]: 2026-09-27

### Cambiado

- **Sello del perfil**: una persona dentro de un pin de ubicación, que era la combinación pedida. El
  pin se lee como "un lugar" sin tener que aprender nada y la persona cabe dentro sin apelmazarse,
  también a 18 px.

### Documentación

- El artefacto de taxonomía se queda solo con el árbol: cada categoría con sus giros, cuántos lugares
  lleva cada uno y tres ejemplos, para revisar la división antes que ninguna otra cosa. La lista
  completa de los 101 lugares queda plegada al final.

## [1.18.0]: 2026-09-27

Decimoctava ronda: la taxonomía nueva entra en la guía. Un local ya no tiene categoría y subcategoría:
tiene giros.

### Cambiado

- **Los locales llevan de uno a tres giros, en orden** (`giros[]`), y nada más. Desaparecen del dato
  `category`, `subcategory` y `alsoIn`: la categoría se deduce de los giros con el catálogo. Los
  101 locales quedaron migrados en una sola pasada, sin ninguno sin giro.
- **Las categorías son estantes, no etiquetas del local**: agrupan giros, viven solo en el catálogo y
  en la barra de filtros, y se nombran por el antojo y nunca por la cocina. Por eso "Italiana" vuelve
  a ser "Pizza y Pasta" (una parrilla que hace pizza no es italiana) y "Cocina Italiana" pasa a ser un
  giro dentro de "Internacional". Quedan 17 categorías y 48 giros.
- **Cada categoría puede tener un giro general** (Cafetería, Cocina Mexicana, Hamburguesas), el cajón
  de "es esto, en general", así que ningún local se queda sin giro y la ficha siempre dice lo mismo.
- **La ficha y la tarjeta enseñan los iconos de todos los giros**, en el mismo orden que los nombres;
  donde solo cabe uno (la ilustración redonda, el escalón del podio) va el del primero.
- **Quince dibujos nuevos** (sope, consomé, cazo, hotcakes, nigiri, pan, bagel, kebab, cupcake, açaí,
  jugo, boba, papas, elote y aceite) y fuera los que ya no usa nadie. Ninguno se repite entre dos
  giros: hay una prueba que lo exige.
- **El podio del perfil marca mejor los escalones** (el alto lo declara cada puesto en vez de salir del
  relleno, que es como el segundo acabó a la altura del tercero) y suelta la plaza: solo lugar y giros.
- **Sello del perfil otra vez desde cero**: una persona de pie sobre el rombo de una plaza, que es la
  forma con la que este producto dibuja Zibatá. Dice las dos cosas que tenía que decir.
- **"Toca para deshacer, solo hoy"**: el punto medio entre el aviso que explicaba el gesto y el que
  explicaba el plazo.
- El importador de CSV y el generador del dataset hablan de giros; la columna `category` más
  `subcategory` pasa a una sola, `giros`, separada por punto y coma.

### Documentación

- [docs/DATOS.md](docs/DATOS.md) explica el modelo nuevo: giros, estantes, giro general, iconos y
  cuándo nace un giro. La propuesta y su revisión siguen en el artefacto de taxonomía.

## [1.17.0]: 2026-09-27

Decimoséptima ronda: el podio se ve como un podio, la hoja del perfil cabe sin desplazarla y el sello
vuelve a empezar, esta vez sin personas.

### Cambiado

- **"Tus tres de siempre" se ve como un podio**: el primero al centro y más alto, cada escalón con su
  puesto en grande y la zona debajo, y arriba el icono del giro en el color que su plaza tiene en el
  mapa. Lo que se lee sigue siendo lugar, giro y zona: el criterio que los ordena no se enseña.
- **La hoja del perfil cabe sin desplazarse** en un teléfono normal y en escritorio: los antojos
  pasan a pastillas, las insignias se aprietan un punto, los tres enlaces del pie caben en una fila y
  la hoja aprovecha hasta el 90 % del alto. En pantallas de menos de 740 px de alto suelta el
  subtítulo y los iconos del podio para seguir cabiendo.
- **"Vas por X lugares" pasa a "Has visitado X lugares de Zibatá, en X de sus X zonas."**
- **Sello del perfil, otra vez desde cero**: ahora es una libreta, que es lo que hay detrás del botón
  (visitas, favoritos y notas), y no una silueta de persona.
- **La fecha de la última visita se lee completa**: "Última visita: 25/Sept/2026", con el mes
  abreviado en el idioma activo y sin punto.
- **"Toca para deshacer" pasa a "Solo hoy puedes deshacerla"**, que dice lo que antes no se decía: el
  plazo.

### Documentación

- La propuesta de taxonomía se explica en cuatro frases y una tabla de ejemplos, y responde a las dos
  preguntas de esta ronda: qué pasa con un local que hace dos cosas igual de importantes sin un tag
  que las englobe (lleva los dos tags y sale en las dos categorías; el principal solo decide el
  icono) y cómo quedan los filtros (igual que hoy: un local entra en una categoría si cualquiera de
  sus tags pertenece a ella).

## [1.16.0]: 2026-09-26

Decimosexta ronda: el perfil se vuelve una vista, el sello se dibuja otra vez desde cero y el
contador de visitas se mete dentro de su botón.

### Cambiado

- **Tu Zibatá es para mirar, no para tocar**: las insignias de zona dejan de ser botones (para ir a
  una zona está el mapa), queda una sola frase arriba, "Vas por 4 lugares de Zibatá, en 1 de sus 11
  zonas", y se va el pie de "Te faltan 11 zonas por estrenar".
- **"Tu podio" pasa a ser "Tus tres de siempre"**: sin números, sin medallas y sin enseñar la cuenta
  que los ordena. De cada lugar se ve lo que importa, nombre, giro y plaza, con el icono de su giro
  en el color que su plaza tiene en el mapa. El orden sigue siendo el mismo por dentro.
- **Lo que más se te antoja ya no cuenta las fichas abiertas**: solo visitas, notas y corazones.
  Abrir una ficha es curiosidad, no gusto.
- **Sello del perfil dibujado de nuevo**: una persona con una hoja de olivo, con trazo de 1,5 en vez
  de 1,9, que a 31 px pesaba más que el resto de la barra.
- **La cuenta de visitas va dentro del botón**, con la misma forma que la cifra de las pastillas de
  categoría, así que se lee como parte de la misma acción. Sin visitas, el aviso dice "Registra tu
  primera visita".
- **Formulario**: "Opcional" a secas en el correo, "Tu mensaje" en vez de "Qué hay que cambiar" (el
  formulario acepta cualquier comentario, no solo correcciones) y el rótulo de "¿Quién escribe?" ya
  guarda la misma distancia con sus pastillas que las demás etiquetas con su campo.

### Corregido

- **La separación entre "¿Quién escribe?" y sus pastillas era cero**, aunque el CSS declarara 8 px:
  una `legend` no es un elemento flexible, así que el `gap` del contenedor nunca la separaba de
  nada. Ahora lo pone su propio margen y mide lo mismo que en los otros tres campos, 6 px medidos.
- **El resumen de visitas usaba el plural del número equivocado**: con una visita a un lugar decía
  "Llevas 1 visita a 1 lugar" pero con tres visitas a un lugar decía "Llevas 3 visita a 1 lugar". La
  frase nueva depende de un solo número.

### Documentación

- Propuesta de taxonomía v3 en el artefacto de revisión: fuera los seis tipos de lugar, un solo
  concepto en el dato del local (los giros, de uno a tres) y un giro general por categoría para el
  local que es la categoría entera. Con eso, crecer (comida china, frituras, otro tipo de local) es
  añadir filas al catálogo sin migrar ningún local.

## [1.15.0]: 2026-09-26

Decimoquinta ronda: el perfil cabe en una pantalla, la ficha respira con un solo ritmo y el registro
de visitas ocupa una sola línea.

### Cambiado

- **El perfil, más corto y mejor jerarquizado**: las zonas pasan a insignias pequeñas con el nombre
  corto ("Plaza Luna" se lee "Luna"), el resumen de visitas deja de fingir que es un titular y vuelve
  a ser texto, y los antojos siguen en tres.
- **El podio se decide por lo que dice la persona**, en cascada: estrellas, visitas registradas,
  corazón, fichas abiertas, visita más reciente, frecuencia a esa plaza y, si todo empata, orden
  alfabético. Pasa a llamarse "Tu podio" porque ya no solo mira favoritos, y cada puesto enseña por
  qué está ahí. Los tres metales salen de la propia paleta (olivo, lima y arena).
- **El sello del perfil dibuja mejor a su habitante**: la persona manda sobre el techo y el dibujo
  llena el círculo del botón igual que dentro de la hoja.
- **Registrar una visita ocupa una sola línea**: botón, la cuenta en su propia insignia (también
  cuando es cero) y, a la derecha, "Primera visita", "Última: 25 sept" o "Toca para deshacer".
- **Un solo ritmo en la ficha de lugar**: --space-5 entre bloques y --space-4 entre las filas de la
  cabecera, sin márgenes sueltos en las piezas. La fila de estrellas ajusta su alto al dibujo para no
  arrastrar aire.
- **Formulario**: "¿Quién escribe?" en vez de "Escribes como", "Negocio" en vez de "El negocio", las
  pastillas se despegan de su rótulo y "Opcional" deja de tocar la etiqueta.

### Documentación

- Los casos difíciles de la taxonomía (Mr. Miches, El Hornero, La Barra Verde, Rometta, Domino's,
  Tacos Carly, birria, carnitas, Masaru, Romani, Boba Station, Castore y los dos que solo decían qué
  tipo de lugar son) quedan explicados y revisables en el artefacto de taxonomía, junto con la regla
  que sale de ellos: el giro principal es el más específico que aplique.

## [1.14.0]: 2026-09-26

Decimocuarta ronda: el perfil deja de recomendar y se vuelve un mapa de lo que ya hiciste, el control
de visitas se despeja y el formulario acepta a quien sea.

### Cambiado

- **El perfil es una foto del presente**: fuera "Algo nuevo para ti". "Tu paso por Zibatá" pasa de
  párrafo a pastillas de zona con el color que cada plaza tiene en el mapa, llenas las estrenadas y de
  contorno las que faltan, y tocar una la abre en el mapa. "Tus favoritos" se ve como un podio de tres,
  ordenado por las veces que has ido, con el resto resumido en una línea.
- **El control de visitas deja de verse amontonado**: el botón y la cuenta van en una sola fila, la
  cuenta con peso propio y sin partirse en dos líneas, el aviso debajo en una línea corta, y el bloque
  se despega de la dirección. "Visita de hoy registrada" se acorta a "Visita registrada".
- **Copia de las notas**: "Calificar con x estrellas" al elegir y "Calificado con x estrellas" una vez
  puesta.
- **El formulario de sugerencias cabe sin desplazarse y lo abre cualquiera**: primero se pregunta si
  escribes como vecino, como el negocio o como otro, los campos cortos comparten fila y el aviso dice
  a dónde va el mensaje: "Al enviar, tu mensaje se envía por Web3Forms y se recibe por correo. La guía
  no guarda ninguna información."
- **El cuarto paso del tutorial ya enseña una estrella**, no un tenedor, y el dibujo de cada paso va
  dentro de su propio recuadro, con la tarjeta más compacta.
- **El sello del perfil dibuja al habitante más grande** (1,65 rem): dentro de la hoja se veía bien y
  en la barra se veía pequeño.

### Documentación

- Propuesta de taxonomía de la ronda 14 (dos ejes, siete reglas, 16 categorías, 31 giros, seis tipos
  de lugar y 15 iconos nuevos), en un artefacto de revisión aparte. Los datos de `data/commercial` no
  cambian todavía: primero se revisa la estructura.

## [1.13.0]: 2026-09-26

Decimotercera ronda: vuelven las estrellas, esta vez con medias de verdad; el perfil se queda con lo
que sirve, y el canal de sugerencias ya está abierto.

### Añadido

- **Formulario de sugerencias en marcha**: con la clave de Web3Forms puesta en `.env.local`
  (`.env.example` documenta el formato), "Sugiere un cambio" muestra el formulario y entrega por
  correo. La dirección sigue sin aparecer en el código.
- **Icono de habitante** para el sello del perfil: una persona bajo el techo de su casa, en vez de la
  silueta genérica de usuario.
- **"Algo nuevo para ti"** en el perfil: un lugar que todavía no visitas, elegido con el mismo orden
  personal que ordena las listas.

### Cambiado

- **Las notas vuelven a ser estrellas**, con medias: la mitad izquierda pone el medio punto y la
  derecha el entero, y al pasar por encima la escala se llena hasta donde caería la nota y el texto
  dice cuál es. Las notas guardadas no cambian de valor.
- **Registrar una visita se explica solo**: el botón dice "Registrar visita", y al lado va la cuenta
  con la fecha de la última. Registrada la de hoy, el mismo botón la deshace y lo dice.
- **El perfil se queda con cuatro bloques** (tu paso por Zibatá, tus favoritos, lo que más se te
  antoja y algo nuevo), en filas de una línea: se acabaron las tarjetas grandes y los desplegables.
- **La atribución del mapa se alinea con la franja de la guía**: las dos piezas del pie arrancan en el
  mismo borde.
- Texto del cuarto paso del tutorial, más claro y sin jerga.
- **Fuera las comillas angulares de todo el proyecto** (interfaz, código, documentación y datos),
  junto al guion largo. La convención queda escrita en [AGENTS.md](AGENTS.md).
- El tutorial viaja en su propio trozo de JS: solo se descarga en la primera visita de la sesión.

### Eliminado

- **BeeWaffle** sale de la guía: cerró (verificado en campo el 2026-09-26). Quedan 101 locales.
  Trecielos ya estaba fuera desde el 2026-09-20.

## [1.12.0]: 2026-09-26

Duodécima ronda: la guía aprende a contar visitas, las notas pasan a tenedores con medios, y "Sugiere
un cambio" tiene por fin un formulario.

### Añadido

- **Visitas**: en cada ficha, "Ya vine" marca el día que fuiste y lleva la cuenta. El mismo día se
  puede deshacer, al siguiente ya no, y cada visita suma. Pesa en el orden personal más que abrir una
  ficha, que no es lo mismo que haber ido.
- **Formulario de "Sugiere un cambio"** con Web3Forms: campos propios, diseño de la guía y envío solo
  al pulsar. El correo de destino vive en Web3Forms, nunca en el código. Sin clave configurada, la
  página explica que el canal todavía no está abierto y no dibuja el formulario.
- **Cuarto paso del tutorial**: qué se puede hacer en una ficha (marcar visita, guardar y calificar).

### Cambiado

- **Las calificaciones son tenedores, y admiten medios**: la unidad de toda la vida en una guía de
  comer, de 0,5 en 0,5. La mitad izquierda de cada tenedor es el medio y la derecha el entero. Las
  notas enteras que ya existían siguen valiendo.
- **"Tu Zibatá" se cuenta con visitas**, no con fichas abiertas: por dónde has pasado, qué zonas te
  faltan por estrenar, tus favoritos y tus notas (con sus lugares solo al desplegarlas). Los antojos
  solo aparecen cuando hay marcas de verdad detrás.
- **La atribución plegada deja de descolgarse**: MapLibre le daba 4 px menos de alto que a su propio
  botón y abría un hueco bajo la franja de la guía.
- La hoja de "Tu Zibatá" y el formulario viajan en su propio trozo de JS, así que el arranque no
  engorda por algo que casi nunca se abre.

### Eliminado

- **Sushi Itto** sale de la guía: cerró (verificado en campo el 2026-09-25). Quedan 102 locales.

## [1.11.0]: 2026-09-25

Undécima ronda: la guía se recategoriza entera con la descripción de cada local, entra DiDi Food y "Tu
Zibatá" pasa a contar cómo te ha ido en Zibatá.

### Añadido

- **Enlaces de reparto de verdad**: 39 locales con Rappi, 36 con Uber Eats y 3 con DiDi Food, una
  plataforma nueva con su icono de aplicación (`public/brands/didi-food.svg`) y su campo `didiFood` en
  el esquema. Una ficha puede mostrar hasta ocho enlaces.
- **Giros nuevos** salidos del análisis: "Desayunos" (separado de "Brunch"), "Bar", "Papas Preparadas"
  y "Comida Rápida".
- **"Tu Zibatá" responde a una pregunta**: cuánto llevas abierto de la guía y en cuántas zonas, tus
  favoritos y tus calificaciones con su promedio, y qué giro se te antoja más. Cada lugar abre su ficha
  desde ahí.

### Cambiado

- **Recategorización completa de los 103 locales** con la descripción en lenguaje natural de cada uno
  ([research/taxonomy-review.md](research/taxonomy-review.md)). Los bares se ordenan por lo que son y no
  por el trago que sirven, el desayuno deja de confundirse con el brunch y "Snacks" deja de ser un
  cajón. 49 locales tienen más de un giro, con un tope de tres.
- **La atribución de OpenStreetMap arranca plegada**: a la vista queda la ⓘ y el texto aparece al
  pulsarla, como en cualquier mapa.
- **Textos de "Acerca" y "Sugiere un cambio"**: la guía se presenta como "de la comunidad para la
  comunidad", hecha con información pública.

### Eliminado

- Los giros "Coctelería", "Micheladas" y el "Snacks" genérico, que describían el tipo de bar o no
  describían nada.

## [1.10.0]: 2026-09-25

Décima ronda: los iconos de reparto tal como se ven en el teléfono, "plaza" deja de ser la palabra para
todo y los textos de la guía hablan de para qué sirve, no de cómo está hecha.

### Añadido

- **Iconos de aplicación de Rappi y Uber Eats** (`public/brands`), compuestos con los vectores de
  dominio público de Wikimedia Commons sobre el color de cada aplicación. Los enlaces de reparto son
  ahora esa ficha de color y el resto de contactos mantiene su círculo.
- `tIn()` en `src/i18n`: traduce a un idioma concreto sin cambiar el de la interfaz.

### Cambiado

- **"Zona" en lugar de "plaza"** en toda la interfaz. La Universidad Anáhuac o el campo de golf no son
  plazas, y la palabra tenía que servir para lo que venga. Los datos y el código siguen usando `plaza`
  como identificador.
- **La etiqueta del botón de idioma se escribe en el idioma de destino** ("View the guide in English"),
  en vez de mezclar los dos en una misma frase.
- **La franja de la guía deja libre la atribución**: sube 10 px por encima del control de
  OpenStreetMap y se ajusta a su contenido, así que en pantalla normal la leyenda va en una sola fila.
- **El círculo de "Tu Zibatá" mide lo mismo que la barra de búsqueda**, con el alto calculado una sola
  vez para las dos piezas.
- **"Tu Zibatá" habla de la experiencia**: qué has guardado y calificado y cómo ordena eso la guía. Que
  todo viva en este navegador pasa a la línea final, y las cifras quedan centradas en su tarjeta.
- **Textos de "Acerca" y "Privacidad" reescritos**: la esencia de la guía por delante del estado actual
  del proyecto, registro más medido en privacidad y sin dos puntos ni puntos y coma.
- **Descripciones de las zonas corregidas** con la revisión en campo del mantenedor, y "Plaza Loop"
  pasa a llamarse **Plaza Loop Urban**.

### Eliminado

- **Centro Médico Comercial Zibatá** sale de las listas y del mapa hasta tener datos suficientes. Con
  él desaparece su volumen generado en `public/map/plaza-buildings.geojson`.
- Las marcas de trazo de Arcticons, que dejan de usarse.

## [1.9.0]: 2026-09-24

Novena ronda: marcas de verdad en los enlaces, una escala tipográfica documentada y "Tu Zibatá" con
forma de sección de usuario.

### Añadido

- **Marcas reales de Rappi y Uber Eats** en los enlaces de reparto (Arcticons, CC BY-SA 4.0), en el
  mismo trazo que el resto de iconos. Sustituyen a la bicicleta y la bolsa genéricas.
- **Banderas de verdad** en el selector de idioma: SVG de circle-flags (MIT) servidos como archivo
  estático, en vez de dibujos propios.
- Escala tipográfica documentada en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md): qué tamaño se usa en
  cada sitio, con qué familia y con qué peso.

### Cambiado

- **Los títulos bajan un peldaño**: los de panel y hoja de 40 a 30 px; el nombre de la ficha sube de 22
  a 24 px. Toda la escala vive en `tokens.css` y ningún componente fija tamaños sueltos.
- **El selector de idioma muestra el idioma que estás viendo**, no al que vas, y mide lo mismo en los
  dos: la etiqueta accesible sigue diciendo a dónde lleva pulsarlo.
- **"Tu Zibatá" sale de la tarjeta de búsqueda**: ahora es un círculo suelto en la esquina superior
  derecha, con silueta de persona en vez de la hoja, y la hoja se presenta como una sección de usuario
  (avatar, "Invitado", "sin cuenta · solo en este dispositivo") lista para el día que haya cuentas.
- **Textos de la guía reescritos** en capas (titular, cuerpo y detalle), como se recomienda para avisos
  de privacidad: qué es la guía y quién la mantiene, qué se guarda en tu navegador y qué no sale de él,
  y cómo proponer un cambio.
- "Corregir un dato" pasa a llamarse **"Sugiere un cambio"** (ruta `#/info/sugerir`).
- La franja de la guía va pegada a la atribución, con menos aire, para que las dos se lean como un pie.

### Quitado

- La página "Apoyar la guía": se retoma después del MVP, con link de pago de Mercado Pago
  ([docs/ESCALABILIDAD.md](docs/ESCALABILIDAD.md)).

## [1.8.0]: 2026-09-24

Octava ronda: tu rincón en la guía, la ficha mejor repartida y el guion largo fuera del proyecto.

### Añadido

- **Tu Zibatá**: el sello del final de la barra superior reúne lo que has marcado en este dispositivo
  (favoritos, calificaciones y fichas vistas), dice que no sale de ahí y lleva a las páginas de la guía.
  Se llena cuando ya hay marcas y muestra cuántos favoritos llevas. Es el sitio reservado para la cuenta
  el día que exista.
- **Apoyar la guía** (`#/info/apoyar`): quién la mantiene, qué cuesta y cómo ayudar mientras no haya
  forma de invitar un café.
- Enlaces de reparto reales: Uber Eats en Tortas Fifthy Fifthy y Rappi en Tacos la Chusma.
- Banderas SVG (México y Estados Unidos) en el botón de idioma.

### Cambiado

- **Los giros van debajo del nombre**, no encima: son el detalle del lugar.
- **Giro principal revisado**: D'Lu, OMA Bakery, Wake Cup y Enoff son cafeterías con panadería como
  segundo giro; Punta Cacao es brunch con pastelería. En "Panadería y Repostería" quedan como principal
  las cuatro que solo hacen pan o pastel.
- La descripción sigue justificada pero **ya no parte palabras con guion**.
- Los enlaces de contacto van **siempre alineados a la izquierda**, con el tamaño justo para que los
  siete posibles cubran el ancho de la tarjeta en una fila.
- Títulos de ficha un escalón más pequeños: con Fraunces casi ningún nombre pasa de dos líneas.
- La franja de la guía ocupa menos y las hojas se centran también en móvil.
- Leyenda más corta: "Guía independiente de establecimientos y servicios de la zona".
- El icono de café de especialidad tiene el cono más estrecho y la taza más grande.
- **Fuera el guion largo de todo el proyecto** (interfaz, comentarios y documentación), salvo la
  expresión regular que lee los horarios que escriben los negocios y la transcripción archivada de NVDA.

### Corregido

- **El buscador ya no pierde el foco** al escribir la primera letra con una ficha abierta: el panel que
  se monta detrás ya no le quita el foco a quien está escribiendo.
- Erratas en ocho fichas: "ingrediented organicos", "Panaderia", "Taqueria", "pero si los mejores",
  "especializado cecina", "RESTAURANT -BAR" y dos signos de admiración de apertura que faltaban.

### Quitado

- El botón de información de la barra en móvil: ahora vive dentro de "Tu Zibatá", que deja la barra con
  tres controles y el buscador completo.

## [1.7.0]: 2026-09-23

Séptima ronda: la ficha aprovecha el ancho, la información de la guía sale de su escondite con ruta
propia y los títulos estrenan tipografía.

### Añadido

- **Tres rutas de información**: `#/info/acerca`, `#/info/privacidad` y `#/info/corregir`. Cada una es su
  propia página, se puede enlazar y compartir, y lleva a las otras dos. En escritorio se llega desde la
  franja inferior del mapa; en móvil, desde el botón de información de la barra superior.
- **Categoría "Panadería y Repostería"** con los giros panadería, pastelería y repostería. Las panaderías
  que además son cafetería conservan ese segundo giro y siguen en "Desayunos y Café".
- **Myköna Frozen Yogurt** (Plaza Condesa) con su web, redes, teléfono, horario y ubicación exacta; ocupa
  el local de La Michoacana de Mi Corazón, que pasa a `removed` con su historial.
- El esquema de enlaces admite **Rappi y Uber Eats**; sin enlace del negocio no se dibuja botón.
- Iconos propios nuevos: **molcajete** (cocina mexicana), **galleta** (repostería), y baguette y cono de
  filtrado redibujados.
- Ubicación exacta de Tortas Fifthy Fifthy y descripción para Tim Hortons, Starbucks (Centro Zibatá) y
  Grünen Lush.

### Cambiado

- **Fraunces 600 es la tipografía de los títulos** (autoalojada, solo ese peso). Los rótulos del mapa
  siguen en Instrument Serif.
- **La ficha aprovecha el ancho**: descripción justificada con partición de palabras, "Cómo llegar" a todo
  el ancho y los enlaces de contacto repartidos a lo largo de la fila (hasta ocho en una sola línea).
- Los giros pueden ocupar **dos líneas** antes de recortarse.
- **El número de resultados aparece siempre** que algo acote la lista, también al elegir solo una plaza.
- El botón que abre la lista se llama **"Explora Zibatá"**, para no competir con el filtro "Todas las
  plazas".
- El **selector de idioma** lleva icono SVG (nunca un emoji de bandera) y en pantallas estrechas se queda
  solo con el símbolo.
- El **buscador** usa un aviso corto en móvil y reserva el hueco del botón de borrar únicamente cuando hay
  texto: el texto ya no se corta.
- Mismo aire arriba y abajo del separador de "En construcción".
- La leyenda de independencia se acorta: "Guía independiente de los establecimientos y servicios de la
  zona: no los representa ni está afiliada a ellos".

### Quitado

- El pie de información del panel de plazas: ahora vive a la vista desde el primer segundo.
- La hoja "Acerca de esta guía" con todo amontonado: son tres páginas independientes.

## [1.6.0]: 2026-09-23

Sexta ronda: la ficha se lee de un vistazo, la búsqueda mira en todo Zibatá y los extras salen de su
escondite.

### Añadido

- **Cambio de idioma en la barra superior** (`LocaleSwitch`): un botón que nombra el idioma al que lleva,
  visible en cualquier vista. Antes había que abrir una hoja para encontrarlo.
- **Pie de la guía** en el panel: la leyenda de guía independiente y tres enlaces ·corregir un dato,
  privacidad y "Acerca de esta guía"· que abren la hoja por su sección.
- Aviso visible de independencia: la guía no representa a los establecimientos ni está afiliada a ellos.
- `displayName()` en el pipeline del mapa: los nombres que OSM guarda en mayúsculas se rotulan con
  capital inicial ("PARQUE NANDÚ" → "Parque Nandú").
- Guardia de mantenimiento para los negocios cerrados (`scripts/research/closed-records.test.ts`): ninguno
  se publica y ninguno se queda sin motivo, fecha ni fuente.

### Cambiado

- **Las descripciones se publican como las escribió el negocio**: con sus emojis y respetando sus saltos
  de línea (máximo tres). Antes todo se unía en una línea corrida y sin emojis.
- **Los giros van en una sola línea** en la ficha: las subcategorías reales, separadas por " · ", sin la
  fila aparte de "También". La categoría la sigue diciendo el icono.
- **La búsqueda mira en todo Zibatá** aunque haya una plaza abierta; la plaza vuelve a acotar en cuanto
  se borra la búsqueda.
- **Contacto y redes: solo el icono**, en un círculo de 44 px con su nombre accesible. Caben todos en una
  fila y queda sitio para los enlaces que falten.
- El botón "Cómo llegar" es más pequeño y no ocupa el ancho del panel; el nombre del lugar se queda en su
  etiqueta accesible, que es donde hacía falta.
- El estado del horario ya no repite la hora ("Abierto", no "Abierto · Cierra a las 21:00"): la tabla que
  va debajo ya la dice.
- El selector de plaza se llama "Filtrar por plaza", para no competir con el botón "Ver plazas" que abre
  la lista.

### Quitado

- El texto "Confirmadas y en obra: todavía sin locales abiertos" y la nota del pie anterior.
- El selector de idioma dentro de la hoja "Acerca de" (ahora vive en la barra superior).

## [1.5.0]: 2026-09-22

Quinta ronda: los 103 locales revisados por el propietario, árboles que parecen árboles y la guía en
dos idiomas.

### Añadido

- **Contenido verificado local por local**: 100 descripciones escritas por los propios negocios, 92
  horarios, 88 ubicaciones exactas y 78 teléfonos. El pipeline unifica el formato (emojis fuera,
  teléfonos en E.164, horarios leídos del texto libre) y reporta lo que no puede leer sin adivinar.
- **Dos giros por local**: El Hornero aparece en Parrilla y en Pizzería; Escarola, en Saludable y en
  Sándwiches. La ficha lo dice ("También: …") y los filtros y la búsqueda lo respetan.
- **Categoría "Internacional y Casera"** y giro "Baguettes"; icono de cafetera de filtro para el café de
  especialidad (el grano parecía un frijol).
- **Acerca de esta guía**: hoja con selector de **español/inglés**, privacidad, cómo corregir un dato,
  lo que viene y los créditos de los datos. La interfaz está traducida entera al inglés.
- El orden personal da **segundas oportunidades** (lo que no abres desde hace 60 días vuelve a asomar),
  acepta **señales de la comunidad** para cuando haya cuentas y ordena también **las pastillas de
  categoría** según lo que sueles elegir.
- Evaluaciones pedidas: [docs/MARCA.md](docs/MARCA.md) (propuesta "Visit Zibatá") y
  [docs/ESCALABILIDAD.md](docs/ESCALABILIDAD.md) (crecer más allá de comer y beber).

### Cambiado

- **Árboles**: tronco y copa en dos pisos (antes eran prismas), verdes más apagados y traslúcidos, y
  también en parques y camellones, no solo donde la imagen satelital ve copa. Ninguno invade ya una
  calle ni se monta en un edificio: el despeje descuenta el radio de la copa y depende de la clase de
  vía.
- **Ficha del lugar**: el logo va redondo junto al nombre, como en las redes, y sin galería; cabe sin
  desplazarse. Las miniaturas de la lista también son redondas.
- En público se muestran los **corazones** de un lugar, nunca la media de estrellas: esa media ordena tu
  lista, pero no señala a un negocio pequeño.
- Se retiró el **número de local**: cada plaza numera a su manera y confundía más de lo que ayudaba.
- Presupuesto de peso: teselas 1 900 → 2 100 KB (el arbolado) y datos 20 → 30 KB (el contenido
  verificado), con un guardia nuevo para la tesela más pesada, que es lo que afecta al render.

### Corregido

- "Todo" contaba giros en vez de lugares cuando un local tenía dos.
- La hoja "Acerca de" se montaba dentro del panel: ahora cubre la pantalla completa.
- Instagram de Masaru retirado (ya no existe) y nombre corregido: Chilakiles → **Los Chikaliles**.

## [1.4.0]: 2026-09-21

Cuarta ronda de ajustes del propietario: árboles reales, orden personal y taxonomía por antojo.

### Añadido

- **Árboles 3D** solo donde hay arbolado real según ESA WorldCover (vía Overture): ~5 200 copas en las
  cañadas, el corredor central y el golf. OSM no tiene árboles mapeados en Zibatá.
- **Orden personal** de las listas: favoritos, calificaciones y fichas abiertas (solo en este
  dispositivo) suben lo que te gusta y lo parecido; una de cada cuatro posiciones es para algo que aún no
  has abierto. Sin historial, el orden curado. Preparado para una fuente con cuentas
  (`setPreferenceSource`).
- **Formulario de verificación** para que el propietario confirme ubicación, giro, descripción y redes
  local por local, y `npm run data:apply-review` para aplicarlo.
- Categoría **Snacks**; iconos propios para cada giro (tortilla, torta, waffle, bagel, lúpulo, cacao…).

### Cambiado

- **Taxonomía por antojo**: la categoría responde a "¿qué se me antoja?" y la subcategoría al giro de
  cada local, revisado uno por uno (`research/taxonomy-review.md`). "Bar y Bistró" pasa a **Bar y
  Botana**; Bocuze a Café Bistró; Kazu's Kitchen a Cocina Japonesa; La Gaspachería y Al Grano a Snacks.
- Instagram de Burger & Fries Forever: @burgernfriesmx.

### Corregido

- **Plaza Luna sin edificio**: el mapa no se había regenerado tras darla de alta. Ahora lleva volumen y
  una prueba impide que vuelva a pasar con otra plaza.
- **Xënica cruzaba la calle**: su huella se centraba en el punto del enlace de Maps, que cae sobre la vía.
  `map:suggest-plaza` coloca ahora el rectángulo del lado libre y `map:build` avisa si una plaza cruza una
  calle.

## [1.3.0]: 2026-09-20

Tercera ronda de ajustes del propietario: silueta corregida, taxonomía más fiel y plazas nuevas.

### Añadido

- **Plaza Luna** con Baguettia y Smoothie Lab; sucursales de **Luka, Sinforosa y Starbucks** en el campus
  Anáhuac (registros aparte, uno por sucursal). 103 locales en 11 plazas activas.
- **Xënica** y **Centro Médico Comercial Zibatá** como plazas "Próximamente", ubicadas con los enlaces del
  propietario.
- Enlaces de Maps verificados para MOL Pitahaya, Xentric Zibatá y Plaza Luna; la ficha de un local lleva a
  su propia puerta solo si su ubicación está verificada (hoy, Smoothie Lab) y si no, a la plaza.
- Iconos propios por subcategoría: sushi, alitas, bebidas, bowls, panadería, brunch, pastelería,
  coctelería, jugos, mariscos…

### Cambiado

- **Taxonomía**: "Hamburguesas y Alitas" pasa a **Hamburguesas** (las alitas, a Bar y Bistró);
  "Bowls y Sándwiches" se divide en **Tortas y Sándwiches** y **Saludable**; "Té de Burbujas" pasa a
  **Bebidas**. Enoff es cafetería/brunch y NOMAD, "Alto en Proteína", con la descripción del propietario.
- "Próximamente" en el mapa es una insignia redonda con icono de obra, como la cifra de locales; con la
  vista alejada solo se ve la insignia, para que dos obras vecinas no se pisen.
- Calificación: "Califica este lugar" / "Gracias por calificar".

### Corregido

- **Silueta**: el contorno sigue el polígono del Master Plan del propietario, georreferenciado contra las
  vías de OSM (88 % de coincidencia). Sale el romboide al oriente del Ejido San Vicente que la versión
  anterior incluía (10,9 → 10,3 km²).
- Las etiquetas de las plazas ya no se dibujan encima del panel lateral ni de la barra superior.
- Las pastillas de categoría del panel arrancan alineadas con el resto del contenido.
- Burger & Fries Forever: se retira el Instagram antiguo que ya no es el oficial.

## [1.2.0]: 2026-09-20

Segunda ronda de ajustes del propietario: contenido al día, silueta del Master Plan y afinado del mapa.

### Añadido

- **Contenido**: 98 locales en 10 plazas activas (antes 76). Altas en el campus Anáhuac, Xentric Anáhuac,
  Xentric Zibatá, Plaza Zielo, Centro Zibatá, Paseo Zibatá, Plaza Condesa y Plaza Loop, que estrena
  inventario (Tacos el Pata, Enoff y NOMAD junto a Burger & Fries Forever).
- **Verificación en sitio como fuente**: un registro puede sostenerse en una URL pública o en una
  comprobación en sitio fechada (`campo:AAAA-MM-DD`). Muchos negocios de barrio no tienen presencia
  pública y dejarlos fuera no hacía la guía más veraz, solo más pobre.
- **Silueta del Master Plan**: `npm run map:masterplan` amplía el contorno hasta la MEX 57D y la QRO 540
  (geometría real de OpenStreetMap) rodeando el Ejido San Vicente. Zibatá pasa de 6,7 a 10,9 km² e
  incluye el suelo del futuro Town Center, aunque siga vacío.
- **Plazas "Próximamente"**: una plaza confirmada y en obra (hoy Distrito Nandú) aparece en el mapa con
  contorno punteado y en la lista con su leyenda, sin entrar en filtros ni conteos.
- **Calificación por estrellas** por lugar, guardada en este dispositivo, junto al corazón. La foto de lo
  marcado (`localProfileSnapshot`) es lo que subiría una futura cuenta para no perder nada.
- Categoría **Carnes y Parrilla**, separada de Mexicana.

### Cambiado

- **Color**: las dos familias se generan desde HSL y viven en registros distintos ·plaza en color pleno,
  categoría en tinte muy claro·, así que ya no parece que una plaza y una categoría compartan color. El
  tono de cada categoría se declara en los datos (`hue`), no en el código.
- **Límite de exploración**: se limita el centro de la pantalla (contorno + ~440 m) en vez del encuadre
  completo. Con la cámara inclinada, un `maxBounds` ajustado obligaba a MapLibre a recentrar y dejaba
  plazas fuera de pantalla en los teléfonos.
- El encuadre general se calcula sin inclinación y después se inclina: en pantallas bajas la vista ya no
  se aleja de más.
- "Cómo llegar" usa el nombre y la dirección de la plaza como destino: Google ya no rotula la ruta con un
  local de dentro.
- El punto de "mi ubicación" es más discreto, va por debajo de las etiquetas y no intercepta toques.
- Los E2E leen los conteos del dataset (`placesInPlaza`) en vez de llevarlos escritos a mano.
- El idioma se resuelve del navegador entre los catálogos registrados (hoy solo español) y se refleja en
  `<html lang>`: añadir inglés es registrar `en.ts`, sin tocar componentes.

### Corregido

- **Marcadores trabados**: la pasada extra de colocación se repetía sin fin cuando dos plazas se turnaban
  la etiqueta; ahora solo se repite mientras se aprendan anchos nuevos.
- **Orden de capas de los marcadores**: quien está más abajo en pantalla (más cerca) va por encima; el
  tallo de una plaza lejana ya no cruza sobre la etiqueta de una cercana.
- La barra de desplazamiento del panel ya no se pega al borde redondeado ni se recorta en la esquina.
- 11 negocios cerrados salieron de la guía (Los Morros de Sonora, Ciao Bella, Bistrot Marino, Ramen
  Express, Tacos La Capilla, Sixties Burger, La Borra del Café (dos sucursales), Ichos, Trecielos y
  Quetacos).

## [1.1.0]: 2026-09-16

Ronda de ajustes pedidos por el propietario tras usar la guía. Sin cambios de arquitectura.

### Añadido

- **Plaza Loop** (10 plazas activas), con geometría tomada del polígono `shop=mall` de OpenStreetMap, y
  Burger & Fries Forever movido ahí desde Plaza Condesa.
- El generador del dataset acepta **plazas nuevas** que no estaban en la lista beta
  (`research/decisions.json` → `plazas[].new`); procedimiento en [docs/DATOS.md](docs/DATOS.md).
- **Color de identidad**: un tono por plaza en el mapa y en la cabecera de su panel, y un tono por
  categoría en listas y fichas (`src/config/palette.ts`). Antes el color de cada placa salía de un hash
  del identificador y no significaba nada.
- Marcador **punto** (24 px, pulsable) cuando una plaza no tiene sitio ni para su cifra: ninguna plaza
  desaparece del mapa por falta de espacio.
- Estructura preparada para señales sociales futuras (corazones de la comunidad y calificación media):
  `socialStats.ts` + `SocialStats.tsx`, sin efecto mientras no haya una fuente registrada.
- `boundaryExtensions` en la configuración GIS: suelo ya planeado sin calles todavía (Master Plan) que se
  suma al contorno cuando haya una fuente georreferenciada.

### Cambiado

- **Taxonomía**: de 16 categorías (seis con tres lugares o menos) a 10, todas con cuatro o más; lo
  específico baja a subcategoría. Nombres en Mayúsculas Principales. La taxonomía curada vive ahora en
  `research/taxonomy.json`.
- "Cómo llegar" lleva **siempre a la plaza**, nunca a la puerta del local (su ubicación exacta no está
  verificada).
- Horario y número de local se muestran solo en la ficha, no en las listas: los publica una minoría y
  dejaban filas desiguales.
- Los límites de exploración pasan del bbox de extracción al **contorno real de Zibatá + ~330 m**.
- El encuadre general reserva la columna de controles y deja más aire abajo (la cámara inclinada baja los
  puntos cercanos): en la vista inicial ninguna plaza queda bajo el panel.
- La lista de plazas muestra el número de lugares como texto y un rombo del color de la plaza, en vez de
  una insignia numerada que se leía como un ranking.
- Tutorial: no aparece sobre un enlace directo a una plaza o un lugar, el botón de cerrar se alinea con los
  márgenes de la tarjeta y las ilustraciones se rehicieron (el gesto del paso 1 y el volumen de los pasos
  2 y 3, que salía cortado).

### Corregido

- La fila de categorías no se podía desplazar con ratón: la rueda vertical ahora desplaza en horizontal y
  aparecen flechas en los extremos (solo con puntero fino).
- "Limpiar filtros" quedaba descentrado en su pastilla cuando no había cifra de resultados.
- El botón de cerrar del panel salía cortado con la hoja a media altura (la zona con scroll no tenía
  margen superior).
- Sin fotografías, la ficha ya no muestra un marcador de imagen ni el aviso "Aún sin fotografías"; con
  fotografía, la imagen principal ocupa menos alto.

### Eliminado

- La insignia "+N" de plazas agrupadas (su función la cumple ahora el marcador punto).
- El botón de vista 2D/cenital: la guía se queda solo con la vista 3D.

## [1.0.0]: 2026-09-15

Primera versión completa de la guía: datos verificados, mapa propio y la ronda final de correcciones,
endurecimiento y documentación. El detalle de cada corrección, con su evidencia, está en
[docs/release/FINAL_REMEDIATION_CHECKLIST.md](docs/release/FINAL_REMEDIATION_CHECKLIST.md).

### Contenido

- Dataset verificado: **76 locales en 9 plazas activas**, 135 registros auditados con estado, confianza,
  motivo y fuentes (investigación del 2026-09-14).
- Teléfono y WhatsApp de Masaru desde su sitio oficial; cobertura de contenido medida y documentada.
- Punto del marcador de Centro Zibatá corregido para que caiga dentro de su propio polígono.

### Añadido

- Enlace "Ir al buscador" como primer elemento con teclado.
- Aviso cuando un enlace apunta a un lugar que ya no está en la guía, con limpieza de la URL.
- Aviso de falta de conexión (la guía ya cargada sigue siendo usable).
- `Escape` cierra la ficha, el panel y el tutorial.
- Política de seguridad de contenido (CSP) en el build, `404.html` propio e iconos "maskable" separados.
- Presupuesto de peso (`npm run perf:budget`) y proyectos E2E de tableta y WebKit (iPhone emulado).
- Documentación: mapa, pruebas, seguridad, accesibilidad, despliegue y guía de contribución.

### Cambiado

- Validación de datos en el navegador sin Zod: **JS inicial 131,6 → 107,7 KB gzip (−18 %)**; un registro
  inválido se omite con aviso en lugar de bloquear la guía.
- Búsqueda: prioridad por inicio de palabra ("bar" ya no trae "barista" ni "gastrobar"), términos de una
  letra ignorados de forma coherente con el indicador de filtros, y caché de la última consulta.
- Mapa: teselas z13 sin huellas menores de 60 m² (−23 % de peso en la vista inicial móvil), alturas
  estimadas con más variación (13 → 59 valores), rótulos que quedaban bajo los marcadores retirados,
  rumbo de la cámara según la forma del área libre y "+N" que acerca hasta revelar las plazas agrupadas.
- Interfaz: la barra superior se mide para reservar espacio al mapa; los controles pasan a fila cuando no
  caben en columna; la hoja expandida deja visible la barra; una sola región `aria-live`.
- Accesibilidad: pastillas con nombre accesible ("Todo, 76 lugares"), marca separada del lema y controles
  de MapLibre en español (correcciones salidas de la sesión con NVDA).
- Reloj compartido para el estado "abierto/cerrado" (un temporizador en vez de uno por tarjeta).

### Corregido

- Una plaza seleccionada nada más cargar podía quedar descartada por la sincronización inicial de la URL.
- Un marcador con el foco del teclado podía ocultarse al moverse la cámara y perder el foco.
- Arrastrar la hoja inferior y soltar sobre el asa deshacía el gesto.
- El contador de favoritos incluía identificadores que ya no están en la guía.
- README: coincidencia cartográfica real (96 %/89 % a 11 m) y alcance real de la accesibilidad.

### Seguridad

- CSP verificada con control negativo; 0 peticiones externas en los recorridos E2E.
- `gitleaks` sin hallazgos; `npm audit` sin vulnerabilidades; acciones de CI fijadas por SHA.

### No incluido (limitaciones declaradas)

- La guía **no está publicada**: la versión se etiqueta en local, sin repositorio remoto.
- **Safari real en iOS** sin probar (solo WebKit emulado).
- Horarios en 3/76 locales y sin fotografías propias: límite de las fuentes públicas permitidas.
- 61 de los 76 locales son `likely_active` (evidencia documental reciente, sin verificación en campo).
