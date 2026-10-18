---
name: Visit Zibatá
description: Guía 3D de Zibatá, Querétaro. Mapa propio, dos idiomas, cero terceros.
colors:
  arena: "#d1c3b0"
  olivo: "#536c2a"
  lima: "#8cba37"
  papel: "#f8f4ed"
  superficie: "#fcfaf6"
  tinta: "#1f2419"
  tinta-apagada: "#62655a"
  borde: "rgb(69 74 59 / 0.12)"
  foco: "#3d6b00"
  oro-firma: "#8a5a10"
  alerta: "#a3402b"
  alerta-fondo: "#fbede9"
  corazon: "#b4432c"
  corazon-fondo: "#fbe9e4"
  ubicacion: "#2f6fde"
  arena-100: "#f1ebe0"
  arena-200: "#e6ddcd"
  arena-400: "#b9a88f"
  tinta-700: "#454a3b"
  olivo-700: "#435a22"
  lima-100: "#e7f1d4"
  lima-50: "#f3f8ea"
typography:
  display:
    fontFamily: "Fraunces, Iowan Old Style, Palatino Linotype, Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Instrument Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  firma:
    fontFamily: "Kode Mono, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "normal"
rounded:
  sm: "0.5rem"
  md: "0.875rem"
  lg: "1.25rem"
  xl: "1.75rem"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  boton-primario:
    backgroundColor: "{colors.olivo}"
    textColor: "{colors.superficie}"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
  pastilla-filtro:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  pastilla-filtro-activa:
    backgroundColor: "{colors.olivo}"
    textColor: "{colors.superficie}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
---

# Sistema de diseño

Extraído de lo que está publicado, no de intenciones. La fuente de verdad sigue siendo
[src/styles/tokens.css](src/styles/tokens.css); este archivo explica **por qué** cada valor es el que
es, que es lo que un token no puede decir.

## Overview

**Norte creativo: "un mapa de papel que alguien dobló y se llevó al centro comercial".**

La guía no compite por atención: compite por que alguien de pie en Zibatá, con una mano ocupada,
decida en diez segundos adónde entrar. Todo lo demás está subordinado a eso. El mapa ocupa la
pantalla y la interfaz flota encima en superficies translúcidas, nunca a su lado: el contenido es el
territorio, y los controles son objetos apoyados sobre él.

La paleta sale de la zona, no de un generador. Tres colores de marca fijados antes de escribir una
línea de código (arena `#d1c3b0`, olivo `#536c2a`, lima `#8cba37`) y de ahí se derivan los neutros
cálidos y los verdes. El beige no es el off-white seguro al que se recurre por reflejo: es el papel
de un mapa, y el olivo y la lima son el campo de golf y el monte que rodean la zona.

La densidad es alta y deliberada. Cien locales en una lista, cada uno con foto, nombre, giros y
estado, a quince píxeles de cuerpo. Una guía que respira demasiado obliga a desplazarse, y
desplazarse de pie en la calle es el fallo.

**Key Characteristics:**
- Superficies que flotan sobre el mapa, con desenfoque de fondo, nunca paneles opacos pegados al borde
- Una sola familia de iconos, trazo fino, siempre acompañada de texto
- Verde solo donde hay acción o afirmación; el resto es arena y tinta
- Cero peticiones a terceros, y eso condiciona el diseño: no hay fuente de CDN ni icono remoto

## Colors

Cálida, de tierra, con un solo acento que manda.

### Primary
- **Olivo** (`#536c2a`): la acción. Botón de "Cómo llegar", pastilla de filtro activa, enlaces.
  Nunca decorativo.
- **Lima** (`#8cba37`): la afirmación. El punto de "abierto ahora", la insignia de conteo, el acento
  del marcador seleccionado. Es el único verde que puede aparecer sin que haya nada que pulsar.

### Neutral
- **Papel** (`#f8f4ed`): el fondo de la aplicación, visible solo donde no hay mapa.
- **Superficie** (`rgb(252 250 246 / 0.94)`): toda tarjeta, panel y barra. Translúcida a propósito,
  con `saturate(1.4) blur(14px)`: flota sobre el mapa en vez de taparlo.
- **Arena 100-500** (`#f1ebe0` a `#978670`): separadores, fondos apagados, estados inactivos.
- **Tinta 900-500** (`#1f2419` a `#62655a`): texto. El 500 es el mínimo que mantiene 4,5:1 sobre la
  superficie arena más apagada, y por eso no hay un gris más claro en la escala.

### Tertiary
- **Oro** (`#8a5a10`): exclusivo de la firma de autoría. La marca de aurariola usa `#b7791f`, que se
  queda en 3,3:1 sobre arena; este es el mismo oro oscurecido hasta 5:1.
- **Alerta** (`#a3402b`): el aviso de cierre y el error de formulario. Solo eso.
- **Corazón** (`#b4432c`): el favorito. **No es el de alerta**, y la diferencia importa: uno dice
  "esto te gusta" y el otro dice "algo va mal". Estuvieron mezclados hasta la v4.22, cuando se
  descubrió que el borde de campo inválido del formulario se pintaba con el rojo de los corazones
  por culpa de un token mal escrito.
- **Ubicación** (`#2f6fde`): el punto de "estás aquí", y el único color que no sale de la paleta de
  marca. Es a propósito: el azul es la convención de todos los mapas que la gente ya usa, y copiarla
  es lo que lo hace entendible sin leyenda. En olivo se leería como un lugar más de la guía.

### Named Rules

**La regla del acento que cuesta.** El olivo marca acción. Si un elemento es olivo y no se puede
pulsar, está mal pintado. La única excepción es la lima, que afirma un hecho del mundo (está
abierto, hay doce aquí), nunca una invitación.

**La regla del rojo que avisa de verdad.** El rojo es para lo que hace perder el viaje, no para lo
normal. Un local cerrado a las once de la noche se pinta gris; uno en obra, ámbar. El rojo queda
libre para cuando haga falta.

**La regla del rojo que no es el mismo rojo.** Alerta y corazón son dos semánticas opuestas. Un
elemento lleva uno o el otro, nunca un tono intermedio, y ninguno se escribe a mano.

**La regla del fondo que no se inventa.** El beige viene de los tres hexadecimales de marca fijados
antes del código, documentados en la cabecera de `tokens.css`. No se cambia por gusto: se cambia
cambiando la marca.

## Typography

**Display:** Fraunces, con `Iowan Old Style` y Georgia de respaldo.
**Cuerpo:** Instrument Sans, con la pila del sistema de respaldo.
**Firma:** Kode Mono, y solo ahí.
**Mapa:** Instrument Serif, y solo en las etiquetas del mapa.

Las cuatro se sirven desde el propio origen con `@fontsource`. Ninguna viene de un CDN, porque la
política de seguridad no admite un solo destino externo.

### Hierarchy

| Token | px | Uso |
|---|---|---|
| `--text-2xs` | 11 | etiqueta legal, pie, firma |
| `--text-xs` | 12 | versalitas de sección |
| `--text-sm` | 13 | metadatos, enlaces, giros |
| `--text-base` | 15 | cuerpo |
| `--text-md` | 17 | nombre de lugar en listas |
| `--text-lg` | 22 | subtítulos |
| `--text-xl` | 24 | título de ficha |
| `--text-2xl` | 30 | título de panel y de hoja |

### Named Rules

**La regla de los cuatro papeles.** Cada familia tiene un trabajo y solo uno. Fraunces titula,
Instrument Sans habla, Kode Mono firma, Instrument Serif rotula el mapa. Una familia que empieza a
hacer dos trabajos es una familia de más.

**La regla de la cifra alineada.** Cualquier columna de números lleva `font-variant-numeric:
tabular-nums`. Un conteo que baila al cambiar de dígito se lee como un error.

## Layout

Escala de 4 px, de `--space-1` (4) a `--space-8` (32). El panel es
`clamp(22.5rem, 28vw, 27.5rem)`: ancho fijo en escritorio, hoja inferior en móvil.

En móvil manda el pulgar: lo que se toca vive abajo, lo que se lee vive arriba. La hoja se arrastra,
no se abre con un botón.

**La regla de los 16 px de margen.** Ningún contenido toca el borde de la pantalla, a ninguna
anchura. El mapa sí, porque es el fondo.

## Elevation & Depth

La profundidad se dice con translucidez y desenfoque, no con sombras fuertes. Tres sombras y una
sola receta de desenfoque:

- `--shadow-sm`: tarjetas en reposo y pastillas
- `--shadow-md`: panel y hoja
- `--shadow-lg`: diálogos, lo único que tapa el mapa entero
- `--blur-surface`: `saturate(1.4) blur(14px)`, en todo lo que flota

**La regla de la capa única.** Una superficie flotante no contiene otra superficie flotante. Si
dentro de una tarjeta hace falta separar algo, se separa con un filete o con aire, no con una
segunda tarjeta.

## Shapes

`--radius-sm` 8 px para cajas pequeñas, `md` 14 px para tarjetas, `lg` 20 px y `xl` 28 px para
paneles y hojas, `pill` para todo lo que se pulsa.

**La regla de la píldora.** Lo redondo se pulsa. Un rectángulo con esquinas blandas es contenido; una
píldora es un control. Mezclarlos enseña al dedo a dudar.

Se rompía en cuatro sitios hasta la v4.23, y los cuatro eran contenedores con forma de botón: la
barra de búsqueda (una cápsula con dos cápsulas dentro), el resumen de filtros, la franja del pie y
el aviso de carga. Si un contenedor y lo que contiene tienen la misma forma, la jerarquía desaparece.

**La regla de las dos siluetas.** Desde la v4.26 hay **dos** y no más. La **cápsula** es solo de las
categorías: dieciocho pastillas de un conjunto del que se elige una, y nada más en la guía la lleva.
La **esquina de 8** (`--radius-sm`) es de todo lo que no es una categoría: la zona, las condiciones,
la salida, los controles del mapa y los botones de la ficha. El mapa no usa ninguna de las dos, para
que un marcador no se confunda nunca con un control.

Esto corrige dos errores seguidos. El primero: dar a cada control una forma propia, que dejaba cuatro
siluetas para cuatro controles y una fila sin gramática. El segundo: dar una esquina distinta a uno
solo, que lo convierte en el raro. **Una silueta solo informa cuando la lleva una familia entera.**

**La regla de las dos direcciones.** En la ficha de un lugar, los controles se agrupan por hacia
dónde apuntan y no por cuándo se usan. *Hacia fuera* (Cómo llegar, Compartir) entregan el lugar a
algo que no es esta guía: comparten silueta con todo el derecho, porque hacen lo mismo, y lo que
los separa es el relleno. *Hacia dentro* (calificar, visita) solo cambian tu relación con el lugar
y no se publican nunca: pierden la superficie entera, que es más diferencia que cualquier esquina
nueva. El rótulo "Solo para ti" lo dice en palabras en vez de dejar que se suponga, y va sin filete:
una línea que aparece una sola vez en toda la ficha no se lee como estructura, se lee como un corte.

**La regla de la línea que no es caja.** El buscador es lo único de la guía dibujado con un filete
inferior y no con un contorno. Un contorno dice "aquí hay un objeto" y un renglón dice "aquí se
escribe". En reposo no tiene superficie ninguna, porque vive dentro de la franja de arriba y una
caja dentro de una caja no agrupa nada; la superficie aparece al enfocar, que es cuando el campo
deja de ser un sitio donde se puede escribir y pasa a ser el sitio donde se está escribiendo.

**La regla de la barra heredada.** La barra de desplazamiento se declara una sola vez, en
`global.css`, y la hereda todo lo que se desplace. Van los dos juegos de propiedades y el reparto
importa: `::-webkit-scrollbar` controla Chromium y WebKit, flechas incluidas, y `scrollbar-width`
queda detrás de `@supports not selector(::-webkit-scrollbar)` para quien no entiende el otro. Al
revés no funciona: en cuanto `scrollbar-width` se declara, Chromium pasa a su barra moderna, ignora
las reglas de arriba y en Windows devuelve las dos flechas de los extremos.

**La regla de la forma por el dato.** Dentro de una misma silueta, un control enseña lo que decide.
Un binario de efecto inmediato lleva vía y perilla. Un desplegable de once nombres enseña el nombre
elegido y el color de esa zona. Información es texto. Lo que no vale es que cuatro funciones
distintas se dibujen igual: entonces la fila no dice nada sobre qué hace cada cosa, y cambiarles el
radio solo la desempareja, porque el radio deja de ser jerarquía en cuanto todo lo lleva.

**La regla del objeto anclado.** En el mapa, la pieza que señala no se mueve nunca. La gota se queda
clavada en su punto y lo que crece o desaparece es la cinta del nombre. Un marcador que se desplaza
al abrirse deja de señalar lo que señalaba, que es lo único que un marcador tiene que hacer.

De ahí salen dos cuentas que hay que mantener a la vez: el `translate` del botón en CSS y el
rectángulo que el solucionador calcula en `PlazaMarkers.tsx`. Si se separan, el mapa se coloca mal
sin que ninguna prueba lo note.

Y de ahí sale también que la punta siga al punto. Cuando el solucionador cuelga una etiqueta por
debajo de su sitio (`data-abajo`), la gota invierte su esquina sin redondear para que la punta mire
hacia arriba. Una gota que cuelga apuntando hacia abajo señala el lado contrario del local que
marca, que es exactamente lo que esta regla prohíbe.

Y la gota manda sobre la línea. Todos los tallos viven en una banda de apilamiento por debajo de
todas las gotas (`CAPA_TALLOS` y `CAPA_ETIQUETAS`), porque una línea cruzando la gota de otra plaza
tapa justo el objeto que señala. Por eso cada plaza tiene **dos** marcadores de MapLibre, uno para
el tallo y otro para la etiqueta: MapLibre coloca cada marcador con un `transform`, que crea
contexto de apilamiento, así que dos piezas del mismo marcador no se pueden ordenar por separado. El
tallo que queda dentro del marcador de la etiqueta no desaparece, se queda de separador, porque es
su alto el que sube la etiqueta sobre el punto y así el alto no se calcula en dos sitios.

La misma regla manda en el apilado: los marcadores se ordenan entre sí por cercanía con números que
llegan a ~11 000, y esa escala solo tiene sentido dentro de su capa. El contenedor del lienzo es un
contexto de apilamiento propio (`MapView.module.css`) para que esos números no compitan con los de
la interfaz, donde los controles del mapa valen 10 (`--z-map-ui`). Sin eso una gota tapaba el botón
de acercar y se quedaba con su clic.

**La regla de la leyenda.** El índice de zonas usa las piezas del mapa, no las suyas. Cada renglón
lo encabeza la misma gota con su cifra que marca esa zona arriba, en miniatura, y no un adorno de
color: así el índice deja de ser una lista aparte y pasa a ser la leyenda de lo que estás viendo.
Lo que acompaña al nombre son las categorías que más abundan **en esa zona**, en palabras y
ordenadas por conteo. En el orden del catálogo las once líneas empiezan igual y la línea ocupa el
ancho sin distinguir nada, que era el defecto de la fila de iconos que vino a sustituir.

**La regla de la caja que pinta.** Girar un elemento no mueve su centro, pero sí cambia lo que ocupa.
Un cuadrado girado 45 grados pinta su diagonal, no su lado: 13 px pasan a 18,4 y 30 a 41. Hay que
medir sobre lo que se pinta, no sobre lo que se dispone. Centrar por la caja dejaba el alfiler
hundido, y calcular los choques por la caja dejaba solaparse dos marcadores sin que el solucionador
se enterase.

**La regla del plano.** Lo que flota sobre el mapa es **un plano**, no una colección de objetos. Los
controles van dentro, planos, y se distinguen por su forma. Quitarle el fondo a cada uno no es lo
mismo que tener un plano: detrás no hay papel, hay un mapa 3D con edificios y árboles, y ahí ningún
halo de texto se lee. Las categorías llegaron a ser dieciocho pastillas con cristal y sombra propios.

**La regla del alto prestado.** Todo lo que crece arriba se lo quita al mapa: la barra superior se
mide en vivo y los marcadores se colocan en lo que queda. Subir de 157 a 221 px empujó una plaza a
punto y la dejó bajo la insignia de la vecina. Antes de engordar la interfaz, mirar qué pasa con los
marcadores.

**La regla del cristal escaso.** El desenfoque es un acento, no un rasgo de carácter. Lo llevan la
barra de búsqueda y las pastillas de categoría, que es lo que se toca primero. Llegó a haber nueve
superficies con la misma receta (fondo translúcido, desenfoque, filete y sombra), y con nueve
primeros planos no hay ninguno. Lo demás se apoya plano sobre el mapa y se lee por su sombra de
texto, del color del papel.

**La regla del aro.** El filete de las fotos circulares va con `outline` de 1 px, no con
`box-shadow`. Una sombra sobre una curva se dibuja difuminada y escalona el borde; `outline` sigue el
radio y lo dibuja como trazo. A 1,5 px se notaba en ambos sentidos.

Las fotos de local son círculos, como el avatar de un contacto, porque es el logotipo del negocio y
así se ve en sus redes. **Sin aro desde la v4.26**: lo llevó del color de su plaza, y se quitó porque
un círculo con filete se lee como un control y la foto no se pulsa por su cuenta. El costo, escrito
para que no se olvide, es que la tarjeta ya no dice de qué zona es.

## Components

**El punto de estado.** Sobre la foto, abajo a la derecha, 11 px con aro del color de la tarjeta.
Cuatro estados y ninguno más: verde abierto, gris cerrado, hueco sin horario publicado, ámbar cerrado
temporalmente. El hueco existe porque "no se sabe" no es lo mismo que "cerrado", y pintarlo gris
sería afirmar algo que la guía no sabe.

**Las pastillas de filtro.** Píldora, superficie translúcida, conteo a la derecha en `tabular-nums`.
Una pastilla que daría cero resultados no se dibuja: el filtro de "abierto ahora" desaparece solo a
las cuatro de la mañana.

**Los botones.** Ocho estados obligatorios en cualquier control: reposo, hover, `:focus-visible`,
activo, deshabilitado, cargando, error, éxito. El anillo de foco aparece **al instante**, nunca con
transición.

## Motion

Dos curvas y tres duraciones, y nada fuera de eso:

```
--ease-out: cubic-bezier(0.22, 1, 0.36, 1)      entrar, salir, por omisión
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)   moverse por la pantalla
--duration-fast: 140ms   --duration-base: 240ms   --duration-slow: 420ms
```

**Nunca `ease-in` en interfaz.** Empieza lento justo en el instante que la persona está mirando.

**La regla de lo que se anima.** Solo `transform` y `opacity`, más color y sombra cuando el cambio
es de estado. Animar `width`, `height`, `top`, `left`, `right` o `bottom` fuerza recálculo de
disposición en cada fotograma, y esta guía dibuja un mapa 3D al mismo tiempo.

**La regla de la frecuencia.** Lo que se usa cien veces al día no se anima. Abrir el panel sí; cada
tecla del buscador, no.

Con `prefers-reduced-motion: reduce` las tres duraciones pasan a 0 ms en los tokens, además de la
regla global. No es "menos movimiento": es ninguno.

## Do's and Don'ts

**Sí**
- Decir lo que la guía no sabe. Un hueco honesto vale más que un dato inventado.
- Un solo juego de iconos (lucide), siempre con texto al lado.
- Comprobar en el navegador a 375 px antes de dar nada por bueno.

**No**
- **Ninguna petición a terceros.** `connect-src 'self'` sin excepciones, y las pruebas E2E lo fijan.
- **Ninguna media pública.** El conteo de corazones se publica a partir de cinco; las estrellas
  ordenan sin verse.
- **Ni guion largo ni comillas curvas dobles** en texto de interfaz, comentarios, datos o commits.
- **Ningún dato de negocio inventado**: ni horario, ni teléfono, ni descripción, ni foto.
- Ningún degradado de marca, ningún titular con relleno degradado, ningún icono emoji.

## Reglas del detector que están apagadas, y por qué

`.impeccable/config.json` silencia dos de las 59 reglas. Las dos se apagaron con una medición
delante, no para que el contador llegara a cero.

**`cream-palette`.** La regla dice que un beige cálido de fondo es la superficie "de buen gusto" a
la que se recurre por reflejo, y pide que el fondo salga de una paleta deliberada. Aquí sale: el
`#f8f4ed` deriva de `#d1c3b0`, uno de los tres hexadecimales de marca fijados antes de escribir
código y documentados en la cabecera de `src/styles/tokens.css`. La premisa de la regla no se cumple,
así que la regla no aplica.

**`monotonous-spacing`.** Avisó de "~4 px usado 9 de 13 veces" en una muestra de la portada. El
reparto real en las 36 hojas es otro: 8 px aparece 53 veces, 12 px 48, 16 px 44, y 4 px solo 11.
Hay ritmo; lo que había era una muestra pequeña de una pantalla concreta.

**Lo que NO se apagó: `overused-font`.** Avisa de que Instrument Sans ocupa el 74 % del texto y de
que Fraunces también está en su lista. Esa premisa sí se cumple, así que se queda sonando. Es una
decisión que vale la pena revisar algún día, no un error de medición, y apagarla sería justo lo que
convierte un defecto en estilo de la casa.

## Lo que este archivo NO canoniza

Dos cosas que el build carga hoy y que **no** son el sistema:

1. **Texto justificado sin partición** en la descripción de la ficha. Es un defecto conocido, no una
   regla: en una columna de 38 caracteres abre ríos entre palabras. Se corrige, no se hereda.
2. **El tipo de letra señalado por `impeccable detect`** (Instrument Sans en el 74 % del texto).
   Queda anotado como decisión consciente, no como regla que impida revisarla: la pareja
   Fraunces + Instrument Sans se eligió por lo que hace la primera con los nombres de las plazas, y
   cambiarla cuesta volver a medir el presupuesto de peso, que está a 0,4 KB del límite.
