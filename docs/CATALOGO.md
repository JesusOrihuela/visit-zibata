# Catálogo de interfaz

La fuente única: qué forma, qué letra y qué superficie lleva cada cosa en la guía, y por qué. Si se
cambia algo aquí se cambia parejo en toda la guía; si se añade algo, ya se sabe de antemano cómo
tiene que ser.

Los valores viven en [`src/styles/tokens.css`](../src/styles/tokens.css) y
[`src/styles/controls.module.css`](../src/styles/controls.module.css). Las reglas con nombre que
salen de aquí están en [DESIGN.md](../DESIGN.md).

## Las tres reglas

| | |
|---|---|
| **La forma** la decide el **tipo de acción**, no el sitio | botón, cápsula, interruptor, enlace, campo |
| **El tamaño de letra** lo decide el **papel del texto**, no el componente | título, cuerpo, control, etiqueta, cifra |
| **La esquina de una superficie** la decide **dónde está apoyada**, no su contenido | anclada a un borde, flotando, o dentro de otra |

Las tres dicen lo mismo de tres maneras: **lo que decide es la función, nunca el sitio.** Cuando
cada componente elige por su cuenta, dos cosas que hacen lo mismo acaban dibujándose distinto y la
pantalla deja de enseñar nada sobre sí misma.

## Por qué existe

Había diecinueve valores de esquina repartidos por los módulos, diez tratamientos de hover y diez
piezas sin hover ninguno. No era un problema de gusto: la forma de un control es lo que anuncia qué
va a pasar al pulsarlo, y cuando cuatro funciones distintas se dibujan igual, la fila no dice nada.

---

# 1 · Lo que se pulsa

Cinco familias, una por tipo de acción, y ninguna pieza de la guía está fuera de ellas sin un motivo
escrito.

| # | Familia | Qué hace | Forma | Clase |
|---|---|---|---|---|
| 1 | Elegir de un conjunto | eliges una de varias, a la vista | cápsula hueca que se rellena, `--radius-pill` | `.pildora` |
| 2 | Sí o no | un ajuste que queda puesto | interruptor desnudo, vía `pill` y perilla `round` | `.interruptor` |
| 3 | Ejecutar | pasa algo ahora | rectángulo, `--radius-control` (6 px) | `.boton` `.botonIcono` `.dia` |
| 4 | Navegar | te lleva a una dirección | sin caja, elemento `<a href>` siempre | `.enlace` `.zonaPulsable` |
| 5 | Escribir | metes texto | campo, `--radius-control` | `.campo` |

El mapa tiene vocabulario propio y no usa ninguna de las cinco, a propósito: un marcador no se puede
confundir nunca con un control de la interfaz.

## Las variantes, y cuál lleva borde

Dentro de *Ejecutar* hay tres pesos, y es lo que responde a "por qué unos botones tienen filete y
otros no":

| Variante | Fondo | Filete | Cuándo |
|---|---|---|---|
| `principal` | olivo | **no**: el relleno ya dibuja su canto | una sola por grupo, la acción que esperas |
| `secundario` | arena apagada | **sí** | la acompañante: arena sobre arena necesita canto o no se ve dónde empieza |
| `fantasma` | ninguno | **no**: no hay superficie que delimitar | la tercera en importancia, dentro de una frase o de una fila ya cargada |

**La superficie apagada siempre va con su filete.** Son la misma materia, así que un cuadrado de
icono con esa superficie (el corazón en la ficha, compartir, cerrar) lleva exactamente el mismo
canto que el botón secundario. Lo llevaba solo el botón, y en la fila de arriba de la ficha se veían
los tres juntos: "Volver" con filete, el corazón y la cruz sin él. Dos materiales para tres piezas
que hacen lo mismo. Está en el modificador `conSuperficie`, no repetido en ocho módulos.

## Los altos

| Token | px | Qué |
|---|---|---|
| `--control-h` | 40 | **todo lo que se pulsa**: botones, campos, cápsulas, interruptores, cuadrados de icono |
| `--control-h-mini` | 32 | los atajos de ratón: flechas de carril y de mes, cruz del buscador |

WCAG 2.2 AA pide 24 px de objetivo y los dos lo pasan. Los 44 del nivel mejorado quedan apuntados,
no cumplidos: subir a 44 obliga a rehacer la barra superior entera.

**Un solo alto, y antes hubo dos.** Las cápsulas y la fila de filtros midieron 36 mientras los
botones median 40, y era un error: la barra flota sobre la hoja, así que una cápsula de arriba y un
botón de la ficha se ven a la vez, y cuatro píxeles de diferencia entre dos cosas que se pulsan
igual se leen como un descuido. Unificar cuesta ocho píxeles de mapa, cuatro por cada fila de la
barra, y los vale.

## Pieza por pieza, las 75

Las cuentas entre paréntesis son **lo que encuentra quien usa la guía**, no lo que hay en el código:
un solo `<button>` dentro de un bucle pinta dieciocho cápsulas. El inventario cuenta lo otro, los
elementos escritos (75 en 27 archivos), y por eso los dos números no cuadran ni tienen que cuadrar.
El que importa para no dejarse una pieza fuera es el del inventario.

### 1 · Elegir de un conjunto

| Pieza | Dónde | Forma |
|---|---|---|
| Pastilla de categoría (18) | carril superior y panel | `.pildora` con `.cifra` |
| Opción de "¿Quién escribe?" (3) | formulario de sugerencias | `.pildora` sobre `label` + radio |
| Selector de zona | barra de filtros | `.pildora` + `sobreMapa`. **La única cápsula con fondo**: abre una lista del sistema, no elige en sitio |

### 2 · Sí o no

| Pieza | Dónde | Forma |
|---|---|---|
| Abierto ahora | barra de filtros | `.interruptor` desnudo, sin rótulo; la cuenta al lado como texto suelto |
| Favoritos | barra de filtros | igual |
| Corazón | tarjeta (36 px, `round`, sin fondo) y ficha (40 px, `control`, con superficie) | `.botonIcono` + `aria-pressed`. No lleva interruptor: encima de una tarjeta pediría la caja que este catálogo quita |
| Ver original / traducción | descripción de la ficha | `.boton fantasma` + `aria-pressed`. Excepción: vive dentro de un párrafo y un interruptor a media frase rompe el renglón |

### 3 · Ejecutar

| Pieza | Dónde | Forma |
|---|---|---|
| Cómo llegar | ficha | `.boton principal` (es un `<a>`: ver "Las dos que no coinciden") |
| Compartir | tarjeta (cromo 36 px) y ficha (`.boton secundario` con su palabra) | |
| Registrar visita | ficha | `.boton secundario`, lleno cuando hay alguna anotada |
| Enviar | formulario | `.boton principal` |
| Reintentar | aviso de mapa caído y error de carga | `.boton principal` |
| Siguiente / Saltar | tutorial | `principal` y `fantasma`: una sola llena por grupo |
| Explora Zibatá | hoja móvil colapsada | `.boton principal` |
| Zoom, brújula, ubicación, casa (5) | mapa | `.botonIcono` sin esquina propia: la pila que los contiene es la que la lleva |
| Cerrar (6) | paneles, hojas y diálogos | `.botonIcono` con superficie apagada |
| Contacto y redes | ficha | `.botonIcono` (ver "Las dos que no coinciden") |
| Quitar filtros, en icono | barra de filtros | `.botonIcono` en tinta, hover `--hover-strong` |
| Quitar filtros, en texto (3) | panel de zona y resultados | `.boton fantasma` |
| Día del calendario | registro de visitas | `.dia` |
| Flechas del mes y cruz (3) | calendario | `.botonIcono mini` |
| Flechas del carril (2) | categorías | `.botonIcono mini sobreMapa`, fuera del orden de tabulación |
| Borrar la búsqueda | dentro del campo | `.botonIcono mini` |
| Avatar de Tu Zibatá | barra superior | `.botonIcono` redondo: abre una hoja, no navega |
| Cerrar el aviso sin conexión | bajo la barra | `.botonIcono sobreColor` |
| Ver todas las visitas | ficha | `.boton fantasma` dentro de una frase |
| Quitar una fecha | lista de visitas | `.botonIcono` de 24 px |
| Velo de los diálogos (2) | información y Tu Zibatá | solo `base`: no se ve nunca, y lo único que necesita es nombre accesible |
| Ir al buscador | primer tabulador | `.boton principal` en tinta, invisible hasta el foco |

### 4 · Navegar

| Pieza | Dónde | Forma |
|---|---|---|
| Tarjeta de lugar | listas | `.zonaPulsable`: la pieza entera |
| Renglón del índice de zonas | Explora Zibatá | `.zonaPulsable` |
| Cabecera de grupo | resultados | `.zonaPulsable` |
| Columna del podio | Tu Zibatá | `.zonaPulsable` |
| Marcador de zona | mapa | banderín: vocabulario propio |
| Volver a la zona | ficha | `.boton secundario` |
| Acerca / Privacidad / Sugerir (6) | franja de la guía y pie de Tu Zibatá | `.enlace` |
| Enlaces entre páginas de información (3) | diálogo de información | `.enlace`, tutorial incluido |
| Idioma | barra superior | `.zonaPulsable`: bandera y código son una pieza |
| Firma de aurariola | pie | `base`, sin subrayado: el logotipo es el enlace |
| Ir a la guía | página 404 | forma de `boton principal`, con los valores a mano (ver abajo) |

### 5 · Escribir

| Pieza | Dónde | Forma |
|---|---|---|
| Buscador | barra superior | `.campo` sin filete ni fondo en reposo: la franja ya es la superficie opaca |
| Nombre, correo, lugar (4) | formulario | `.campo` |
| Mensaje | formulario | `.campo areaTexto` |
| Fecha (respaldo) | registro de visitas | campo nativo, solo donde no hay `showPicker` |
| Campo trampa | formulario | fuera de pantalla, no oculto: hay robots que saltan lo evidente |

### 6 · El mapa

El marcador de zona es un **banderín que sale de la gota**, con el pico hacia fuera.

| | |
|---|---|
| Forma | la tela sale de la gota; el recorte lo hace la silueta (`clip-path`), no un radio |
| Gota | 30 px, esquina sin redondear y giro de -45° |
| Cifra | disco de 19 px dentro de la gota, desgirado, centrado por óptica |
| Tela | 26 px de alto, pico de 11 px, entra 17 px bajo la gota |
| Asta | 2 px, nace en el punto exacto |
| Opacidad | ninguna: sólido, como todo lo que va sobre el mapa |
| Compacto | sin sitio para el nombre, se queda la gota sola |

Era una cápsula con el extremo redondeado, y ahí estaba el problema: la cápsula es la forma de
"elegir de un conjunto" en la interfaz, así que el mapa hablaba el idioma de los filtros siendo otra
cosa. La mezcla resuelve las dos a la vez: la gota sigue señalando el punto exacto, que es lo único
que un marcador tiene que hacer, y la tela deja de ser una cápsula. El pico hacia fuera da además
una dirección de lectura, de la gota hacia el nombre.

El marcador de "próximamente" lleva la misma silueta: lo que lo separa de una zona abierta es la
materia (arena hueca contra el color de la zona), no la forma.

---

---

# 2 · Las superficies

Lo que no se pulsa tampoco elige su esquina. **La decide el tamaño**, y es lo que hacen Uber Base,
Material 3 y Apple: ninguno reparte por el sitio donde está la superficie.

## 1 · El radio sigue al lado corto

| Token | px | Lado corto | Dónde |
|---|---|---|---|
| `--radius-sm` | 8 | menos de 48 | la franja de la guía, el globo del mapa, el aviso sin conexión, la pila de controles |
| `--radius-md` | 14 | de 48 a 80 | la tarjeta de búsqueda, las de lugar, las tablas de horario, los avisos de la ficha |
| `--radius-lg` | 20 | de 80 a 320 | el calendario de visitas |
| `--radius-xl` | 28 | más de 320 | la hoja inferior, el panel lateral, los diálogos, el tutorial, Tu Zibatá |

Manda el **lado más corto**, que es lo que el ojo usa para juzgar si una curva es proporcionada.
Y resuelve el caso que ninguna regla por sitio resolvía: la tarjeta de búsqueda mide 51 px de alto,
así que con los 20 de "lo que flota" su esquina era el **39 % de su propia altura**, o sea casi una
cápsula. La misma cifra no puede hacer lo mismo en una caja de 51 y en una hoja de 596.

## 2 · Lo que se apoya en una esquina resta el relleno

Si una superficie se apoya en la esquina de otra, su radio es **el de fuera menos el relleno**. Es
la concentricidad de Apple, y lo que Material pide en el fondo: dos curvas concéntricas con el mismo
radio se ven mal, y es de lo poco que el ojo detecta sin saber por qué.

Dos límites, y los dos importan:

- **Solo donde se ve.** Una tarjeta a mitad de una lista que se desplaza no toca ninguna esquina de
  la hoja que la contiene, así que ahí manda el tamaño y no la resta.
- **No a los controles.** Su forma la decide el tipo de acción, que es una regla más fuerte: un
  botón dentro de una tarjeta no cambia de esquina por estar ahí.

Medido en la guía corriendo, **una sola superficie cumple las dos condiciones**: el cuadro de
ilustración del tutorial, 28 de la tarjeta menos sus 20 de relleno lateral son 8. Lo comprueba
`tests/e2e/catalogo.spec.ts` en los cuatro tamaños, así que una segunda no puede aparecer sin que
salte.

## Lo que esto corrigió

Antes había tres escalones sin regla, y la diferencia entre llevar uno u otro no se podía deducir
mirando: el calendario flotaba como el diálogo y llevaba el de dentro; la franja de la guía flotaba
sobre el mapa y también. El tutorial usaba la esquina del panel lateral siendo un diálogo centrado.

## Identidad y puntos

`--radius-round` (50 %) para fotos, logotipos, avatares, el punto de estado y el de ubicación. No
entra en la regla del tamaño: un círculo es un círculo mida lo que mida.

## Las siluetas, que no son radios

| Silueta | Qué | Cómo |
|---|---|---|
| La gota | el marcador que señala un punto | `border-radius: 50% 50% 50% 0` girado -45°, y `50% 0 50% 50%` cuando cuelga por debajo |
| El banderín | la tela que sale de la gota | `clip-path`, con el pico hacia fuera |

Un `box-shadow` no sabe nada de un recorte: dibuja el contorno de la **caja**, que es un rectángulo,
y luego el `clip-path` lo corta. Por eso el banderín de "próximamente" lleva su filete con cuatro
`drop-shadow` de un píxel, que se calculan sobre la silueta ya recortada.

---

# 3 · La letra

## Tres familias, y solo dos trabajan

| Familia | Token | Papel |
|---|---|---|
| Instrument Sans | `--font-sans` | todo lo que se lee y todo lo que se pulsa |
| Fraunces | `--font-display` | los títulos, y nada más |
| Kode Mono | `--font-mono` | dos sitios, los dos dibujo: el wordmark de aurariola (lo pide su guía de marca) y el matasellos de la tarjeta de zona, al 16 % de opacidad |

Tres es el techo de lo razonable y aquí solo dos hacen trabajo de interfaz. **Una familia nueva
necesita un papel que ninguna de las tres pueda hacer**, no una ocasión. El `system-ui` del aviso
"sin JavaScript" no cuenta como una cuarta: esa página se pinta antes de que llegue ninguna fuente.

## Tres pesos

| Peso | Papel |
|---|---|
| `400` | cuerpo que se lee de corrido, y lo que se escribe en un campo |
| `600` | **el peso por omisión de la interfaz**: controles, títulos, nombres, etiquetas |
| `700` | solo cifras y versalitas, donde el tamaño pequeño necesita cuerpo para leerse |

No hay `500` ni `800`. Instrument Sans los tiene, pero un paso intermedio entre 400 y 600 no dice
nada que no diga ya el tamaño, y lo único que consigue es que dos textos del mismo papel se vean
distintos sin motivo. Se cargan tres ficheros de fuente y no cinco.

## La escala, por papel

| Token | px | Papel | Peso | Dónde |
|---|---|---|---|---|
| `--text-2xl` | 30 | **Título de una zona** | 600 display | la portada de ese sitio; es el único de toda la guía |
| `--text-xl` | 24 | **Título de lo que abres** | 600 display | ficha, tutorial, Tu Zibatá, aviso de mapa caído, diálogos |
| `--text-lg` | 22 | **Subtítulo y cifra grande** | 600 | estado vacío, cabecera de grupo, hoja colapsada, el número del podio |
| `--text-md` | 17 | **Título de algo que se abre encima** | 600 display | el mes del calendario de visitas |
| `--text-campo` | 16 | **Lo que se escribe** | 400 | buscador, formulario |
| `--text-base` | 14 | **Cuerpo que se lee** | 400 | es el `font-size` del `body`: descripciones, páginas de información, nombre de un lugar en una lista (600), y todo lo que no pide otro escalón |
| `--text-sm` | 13 | **Control** | 600 | botones, cápsulas, días, enlaces, metadatos |
| `--text-xs` | 12 | **Etiqueta y nota** | 600 | rótulos de formulario, versalitas de sección, líneas de ayuda |
| `--text-2xs` | 11 | **Cifra y pie legal** | 700 | la cuenta de una cápsula, la firma, la versión |

Las filas de **control** y **campo** las pone el catálogo y no cada módulo: la tipografía vive
dentro de `.pildora`, `.boton`, `.botonIcono`, `.dia` y `.campo`. Componer la familia basta.

**Esto antes vivía en `.base`, y era una trampa.** Un módulo que compusiera `boton principal` sin
componer también `base` se quedaba sin tipografía y heredaba la del texto que lo rodeaba: "Cómo
llegar" salía a 15 px y peso 400 en vez de 13 y 600, y las tres opciones de "¿Quién escribe?" igual.
Se veía a simple vista y no lo cazó ninguna puerta, porque ninguna miraba la letra.

### Por qué el cuerpo mide 14

Estuvo en 15, y donde se notaba era en las páginas que son solo texto: cinco párrafos seguidos del
mismo tamaño no dan jerarquía donde descansar la vista. En una ficha el mismo 15 convivía con
metadatos de 12 y 13 y se leía bien, que es por qué el problema parecía estar solo en los pop-ups.
Se bajó el escalón y no solo esas páginas: **un cuerpo que mide distinto según dónde esté deja de
ser un escalón.**

### Por qué el campo mide 16 y no 14

Es el único escalón que no sale de la escala de lectura. Safari en iPhone amplía la página entera al
enfocar un campo que mide menos de 16, y deja la guía a medio zoom sin forma obvia de volver. Es una
restricción de la plataforma, no una preferencia, y por eso tiene nombre propio: un `1rem` suelto
dentro de una hoja se borra en la siguiente edición.

### Por qué `--text-md` tiene un solo usuario

Un escalón con un solo usuario es sospechoso y conviene decir por qué este se queda. El mes del
calendario es el título de una superficie que se abre **encima** de otra y mide 19 rem de ancho: con
los 22 del subtítulo ocupa media cabecera, y con los 14 del cuerpo deja de leerse como título. Si
aparece una segunda superficie así, usa este escalón; si pasan meses sin que aparezca, se funde.

## Lo que está fuera de la escala

| Pieza | Tamaño | Motivo |
|---|---|---|
| El wordmark de "Visit Zibatá" | 26 px | es un logotipo, no texto: lo gobierna [docs/MARCA.md](MARCA.md) |
| El matasellos de la tarjeta de zona | 17 px mono | es un dibujo al 16 % de opacidad, no algo que se lea |
| La página 404 | rem literales | se sirve sola, sin la hoja de la guía |
| El contenido previo a React y el aviso sin JavaScript | rem literales | se pintan antes de que cargue ningún token |

Son cuatro y las cuatro se explican solas: ninguna es texto de interfaz.

---

# 4 · El color y los estados

## Las superficies

| Token | Qué |
|---|---|
| `--color-surface-solid` | papel: lo que flota sobre el mapa y lo que abre encima |
| `--color-surface-muted` | arena apagada: la materia del botón secundario y de los cuadrados de icono, **siempre con su filete** |
| `--color-accent` | olivo: lo elegido y la acción principal |
| `--color-border-strong` | el filete de la superficie apagada y de las cápsulas huecas |

**Lo que flota sobre el mapa no es transparente.** Nada que se lea contra calles, manzanas y
arbolado puede fiarse de lo que haya detrás: lleva superficie sólida y una sombra que lo despega.
"Hueco" pasa a significar *sin el acento*, no *sin fondo*.

## El hover: tres tokens, y la regla que los ordena

**Al pasar por encima, todo se mueve un paso hacia el acento.**

| Token | Valor | Para qué |
|---|---|---|
| `--hover-quiet` | `lime-50` | lo hueco, lo apagado y lo que no tiene fondo: aparece o se tiñe de verde claro |
| `--hover-strong` | `olive-700` | lo que ya está lleno de olivo o de tinta: se oscurece |
| `--hover-ghost` | blanco al 16 % | lo transparente sobre una superficie de color, donde teñir se pelearía con el fondo |

Una pieza se sale del token: los enlaces de texto cambian de color y de subrayado en vez de ganar
fondo, porque un enlace dentro de un párrafo no tiene caja donde poner ese fondo.

**Si un módulo reemplaza la superficie de un control, le toca decir qué hace al pasar por encima.**
Es consecuencia directa de cómo funciona la precedencia (ver más abajo) y está escrito en cada uno
de los sitios donde pasa.

## Los estados, en todo lo que se pulsa

| Estado | Cómo se dibuja |
|---|---|
| Foco | `outline: 2.5px solid var(--color-focus)`, `offset: 2px`. **Uno solo en toda la guía**, y al instante, sin transición |
| Pulsado | `scale(0.98)` en botones de texto, `0.9` en cuadrados de icono. Sin transición: lo que confirma un toque es que responda en el acto |
| Elegido | relleno de acento, y **sale del atributo de accesibilidad**: `[aria-pressed]`, `[aria-checked]` o `:has(input:checked)`, nunca de una clase propia |
| Apagado | `--sand-400` y `cursor: default`; se apaga, no se esconde, para que la rejilla conserve su forma |
| Transición | `--duration-fast` con `--ease-out`, solo color y sombra |

**El estado visual sale del atributo de accesibilidad** y eso no es formalismo: la única forma de
conseguir el relleno es poner el atributo, así que no se puede pintar algo como elegido sin que un
lector de pantalla lo diga. Un estado que se ve pero no se anuncia deja de ser posible por
construcción, no por disciplina.

## Dos reglas de contraste que mandan sobre todo lo anterior

**1 · Ninguna parte de un control baja de 3:1 contra la de al lado** (WCAG 1.4.11). Cambia tres
cosas y ninguna es un capricho:

- **el contraste del interruptor lo lleva la vía, no la perilla.** La norma pide que los estados de
  un control se distingan entre sí, y la vía pasa de arena apagada a olivo: 5,2:1 entre un estado y
  el otro, en la pieza más grande de las dos. La perilla es papel con una sombra, la de cualquier
  interruptor, y refuerza con su posición y con el color de su icono.

  Se intentó al revés, cargando el contraste en la perilla, de las tres formas que hay, y las tres
  fallaron por el mismo motivo: **hacían que el reposo se viera más fuerte que el estado puesto**.
  Una vía de arena oscura pesaba. Una perilla rellena de tinta gritaba, porque un disco oscuro es
  el lenguaje de "puesto". Un filete se veía de más. Cargar el contraste en la pieza grande resuelve
  las tres a la vez, y de paso deja la perilla que la gente ya conoce;
- **la vía usa `--color-surface-muted` con su filete**, o sea el mismo material que el botón
  secundario y los cuadrados de icono. No es un color inventado para el interruptor, que era
  justo lo que lo hacía desentonar;
- la cifra dentro de una cápsula rellena va en lima con el número en tinta. En blanco translúcido
  sobre el olivo daba 3,2:1, por debajo del 4,5:1 que necesita un texto de 11 px.

**2 · Ningún texto baja de 4,5:1.** De aquí sale que la firma de aurariola no se apague en reposo
(a 11 px la dejaría por debajo) y que el aspa de borrar una fecha mida 24 px y no 22, que es el
mínimo de objetivo de WCAG 2.2.

---

# 5 · Cómo se usa

Los módulos no vuelven a escribir nada de esto: lo componen.

```css
/* src/features/about/SuggestForm.module.css */
.send {
  composes: base boton principal from "../../styles/controls.module.css";
  /* y aquí solo lo que es propio de este sitio */
}
```

`composes` es de CSS Modules y no cuesta nada en tiempo de ejecución: el elemento acaba con las dos
clases y las reglas compartidas se emiten una vez. **La geometría propia se queda en el módulo**
(dónde va la pieza, cuánto mide su hueco en su rejilla); lo que se comparte vive en el archivo
común.

Un límite que conviene saber de antemano: `composes` solo vale en un selector que sea **una sola
clase local**. `.lista button` no puede componer nada, así que la pieza necesita su propia clase en
el JSX. Eso es bueno: obliga a nombrar lo que se está dibujando.

## Quién gana a quién: una sola regla

**Todo lo del catálogo vale cero de especificidad, y el módulo que toque una propiedad la gobierna
entera, en todos sus estados.**

Por eso cada regla va envuelta en `:where()`, los estados incluidos. Dentro del archivo manda el
orden; fuera, cualquier cosa que escriba un módulo gana.

La consecuencia práctica: **si un módulo cambia el fondo de un control, tiene que decir también qué
hace ese fondo al pasar por encima.** Si no lo dice, se queda igual, porque el hover del catálogo ya
no puede alcanzarlo.

Nació de dos fallos reales y los dos del mismo sitio. El buscador componía `.campo` y le quitaba el
fondo, y se quedaba con el fondo igualmente. El botón de quitar filtros se ponía verde claro al
pasar por encima en vez de olivo oscuro, y su icono claro desaparecía. En los dos casos las reglas
valían lo mismo y decidía el orden en que el empaquetador juntara los archivos. **Una precedencia
que depende de cómo se parta el paquete no es una precedencia.**

## Los enlaces internos

Un destino con dirección propia es un `<a href>`, y el clic se intercepta con
[`alPulsarEnlace`](../src/lib/navegacion.ts), que deja pasar Ctrl, Cmd, Mayúsculas y el botón
central para que el navegador haga lo que hace con cualquier enlace. Las rutas las dan
`rutaDeLugar`, `rutaDeZona` y `rutaDeInfo` en [`url-state.ts`](../src/lib/url-state.ts).

Seis sitios eran botones teniendo ruta, y mientras lo fueron no se podían abrir en otra pestaña, ni
copiar, ni encontrar desde fuera.

---

# 6 · Cómo añadir algo nuevo

1. **¿Qué hace?** Elige su familia de la sección 1. Si no es ninguna, escribe aquí por qué antes de
   dibujarla.
2. **¿Qué papel hace su texto?** Toma el escalón de la sección 3. Si ninguno encaja, el problema no
   es que falte un tamaño: es que falta definir el papel. Defínelo aquí primero.
3. **¿Sobre qué está apoyada?** Si es una superficie, su esquina sale de la sección 2.
4. **Componlo**, no lo dibujes. Si reemplazas una superficie, declara también su hover.
5. **Córrelo:** el inventario tiene que seguir diciendo que todas componen una familia.

---

# 7 · Lo que queda fuera

### La página que no puede componer nada

La 404 (`scripts/build/pagina-404.ts`) se sirve sola, sin la hoja de estilos de la guía: tiene que
pintarse aunque no cargue nada más, porque es justo la página que aparece cuando algo no está donde
se esperaba. Así que su único enlace lleva los valores del botón principal **escritos a mano**, y es
la única duplicación del catálogo que existe a propósito.

Si cambian la esquina o el acento, hay que tocarlos también ahí. La alternativa (meterla en el
paquete) la haría depender de lo mismo que puede estar fallando.

### Las dos que no coinciden

Dos piezas tienen una familia y un elemento que no se corresponden, y las dos están así a propósito:

- **Contacto y redes, y Cómo llegar.** El elemento es un `<a href>` de verdad (a un teléfono, a un
  perfil, a Google Maps), así que la familia es navegar. La forma es la de ejecutar, porque lo que
  llevan dentro es un icono o son la acción principal de su fila, y en los dos casos no hay texto
  que pueda llevar el subrayado. Eran círculos, y el círculo es la forma de identidad en esta guía:
  un teléfono no es una identidad.
- **Ir al buscador.** La familia es navegar y el elemento es un `<button>`. Lo que hace es poner el
  cursor dentro del campo de búsqueda, y un fragmento (`href="#..."`) no mueve el cursor dentro de
  un campo de forma fiable en todos los navegadores, además de dejar una entrada en el historial
  que nadie pidió.

### Lo que no es ninguna de las cinco familias

| Pieza | Por qué |
|---|---|
| Estrellas de calificación | grupo de opción única ordenada; la forma la da la estrella |
| Asa de la hoja | se arrastra, no se pulsa. Barra de 40×5 px en `sand-400`, dentro de un área de agarre de 72×24 |
| Panel de depuración del mapa (6) | solo existe en desarrollo |

Los contenedores y las formas de identidad no "quedan fuera": tienen su propia regla, en la
sección 2.

### Dónde se fue lo que había

De **diecinueve** valores de esquina a **cinco** en lo que se pulsa:

```
--radius-pill      cápsulas y la vía del interruptor
--radius-control   ejecutar y escribir (6 px)
--radius-round     perilla, avatar, atajos de ratón
sin radio          navegar
clip-path          el banderín del mapa
```

Más los tres de contenedor y el de identidad de la sección 2. Los controles en pila del mapa llevan
`0` porque el recorte de la pila ya dibuja la esquina.

---

# 8 · Cómo se comprueba

Dos cosas distintas: que no falte ninguna pieza, y que las que hay cumplan.

**Que no falte ninguna.**

```bash
node scripts/inventario-interactuables.mjs
```

Recorre el JSX y lista cada `button`, `a`, `input`, `select` y `textarea` con el archivo donde vive y
la pista que lo identifica. El total tiene que cuadrar con este documento; si sale una pieza que no
está aquí, o se mete en una familia o se escribe por qué no entra en ninguna.

Este inventario es la razón de que el catálogo tenga 75 piezas y no 61: la primera versión se
escribió de memoria y se dejó catorce fuera, cinco de ellas navegaciones dibujadas como botones. La
sexta apareció al corregir las pruebas, y era peor que las otras cinco: los enlaces entre páginas de
información ya estaban **dibujados** como enlaces y seguían siendo botones, o sea que ni siquiera se
veía el defecto.

**Que las que hay cumplan.**

```bash
npx playwright test catalogo
```

[`tests/e2e/catalogo.spec.ts`](../tests/e2e/catalogo.spec.ts) mira lo que el navegador calcula, no
lo que el CSS dice, que es la única forma de atrapar una regla compartida ganándole a la del módulo.
Fija seis cosas: las cinco formas, los altos, el contraste de la perilla contra su vía, que el
avatar siga a la barra, que lo que tiene dirección sea un enlace, y que nada de lo que flota sobre
el mapa sea transparente.

Las tres últimas veces que se corrió encontró, en este orden: el `select` nativo colándose con su
esquina de 6,5 px, el desnivel de cuatro píxeles entre el avatar y la tarjeta de búsqueda, y la vía
del interruptor a 1,66:1. Ninguna de las tres se veía leyendo el CSS.
