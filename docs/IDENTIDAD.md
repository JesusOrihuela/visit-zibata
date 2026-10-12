# Identidad: el plan y por dónde va

Qué se está haciendo para que la guía se reconozca sin leer el logotipo, y por qué cada decisión.
El sistema en sí vive en [DESIGN.md](../DESIGN.md); esto es el plan de trabajo.

## El diagnóstico, que no es el obvio

La auditoría de UI dio 0 hallazgos críticos: la guía no se lee como generada. Pero "no es slop" no
es lo mismo que "tiene carácter", y el carácter faltaba. La causa resultó ser más concreta de lo
esperado:

> **El hilo de identidad existe, está bien construido, y se corta en la cabecera del panel.**

En [src/config/palette.ts](../src/config/palette.ts) hay un sistema de dos familias cromáticas
generadas desde HSL con una regla escrita: **plaza** en color pleno (responde a "¿cuál es cuál?"
mirando Zibatá desde arriba) y **categoría** en tinte claro con icono en tinta oscura (responde a
"¿qué tipo de comida es?"). Viven en registros distintos a propósito, para que nunca parezca que una
plaza y una categoría significan lo mismo.

Ese color llega al mapa y al encabezado del panel. No llegaba a las tarjetas, ni a la ficha, ni a
los resultados de búsqueda. Se cruzaba de un mundo con identidad a uno genérico en un clic, y esa
discontinuidad es lo que se sentía como falta de personalidad.

El plan no inventa identidad. Lleva la que hay hasta el final.

## Las tres reglas que lo gobiernan

**Dos canales de color que no se mezclan.** El olivo marca **acción** (se puede pulsar). El acento de
plaza marca **lugar** (dónde estás). Un elemento no lleva los dos.

**El acento de plaza aparece en una sola propiedad por superficie.** Un aro, un filete, un texto.
Nunca un fondo. Quince colores sueltos por la interfaz se vuelven ruido en cuanto uno rellena algo.

**Nada pesa.** El presupuesto inicial va a 121,2 KB de 122. Todo lo que sigue es reasignación de lo
que ya existe, en CSS y SVG. Ninguna librería, ninguna ilustración generada, ningún motion pesado.

## Las fases

| | Fase | Resultado |
|---|---|---|
| 2 | El hilo de la plaza | hecho, y es el cambio grande |
| 1 | Formas, elevación y bordes | **mucho menor de lo planeado**: la premisa no sobrevivió a la medición |
| 3 | Continuidad mapa ↔ panel | **sin trabajo**: ya estaba resuelto |
| 4 | Un movimiento con firma | una retirada, no una adición |
| 5 | Responsive por breakpoint | verificado, sin deuda nueva |
| 6 | Revisión con las herramientas | hecho, y encontró lo que nadie habría visto a ojo |

Se empezó por la 2 y no por la 1 a propósito. Resultó ser la decisión correcta por una razón que no
se esperaba: con el hilo de color puesto, las fases 1 y 3 se quedaron casi sin contenido.

### Fase 2 · El hilo de la plaza

El color de la plaza viaja ahora por todo el recorrido, en cuatro sitios y siempre como aro o como
texto, nunca como fondo:

- **El aro de la foto del lugar**, en la tarjeta y en la ficha. Era un filete neutro de 1 px. La foto
  queda siendo el sitio donde vive la identidad del lugar: aro de plaza fuera, punto de estado en la
  esquina.
- **El nombre de la zona** en los grupos de resultados, que es lo que hace legible una búsqueda que
  mezcla zonas.
- **El alfiler de la dirección** en la ficha, que es lo único de la ficha que dice dónde está y no
  qué hacer.
- **Las filas del explorador**, que ya lo llevaban.

No se tocó la pastilla de filtro de zona: es un control, y los controles son olivo. Darle el acento
habría mezclado los dos canales el mismo día que se separaron.

Medido en el navegador: el marcador de Paseo Zibatá en el mapa y el aro de las fotos de sus lugares
pintan el mismo `rgb(103, 60, 30)`. Y las once plazas activas dan entre 5,01:1 y 13,53:1 de
contraste contra las tres superficies, así que el nombre coloreado pasa incluso el 4,5 de texto
normal, no solo el 3 de texto grande.

### Fase 1 · Lo que la medición deshizo

El plan decía que la interfaz abusaba de superficie + desenfoque + borde + sombra a la vez, sin
jerarquía. **Al contarlo, era falso.** De 47 declaraciones de sombra, 15 son filetes, 20 usan un
token y solo 12 son elevación escrita a mano, cada una en un contexto distinto y con razón. La
receta de las superficies flotantes es consistente, no caótica.

Lo que sí había era **deriva de tokens**, y no se ve a ojo:

- **Un azul fuera de la paleta** (`#2f6fde`) escrito a mano en el punto de "estás aquí". El color es
  correcto (es la convención de los mapas) pero no estaba registrado en ningún sitio. Ahora es
  `--blue-ubicacion`, con el porqué escrito.
- **Cuatro rojos haciendo el trabajo de dos.** `#b4432c` en el botón de favorito y en el filtro,
  `#c0453c` en la ilustración del tutorial, `#a33a32` en el error del formulario, `#fbe9e4` de fondo.
  Y, lo peor: el borde de campo inválido decía `var(--color-danger, #c0453c)` **y ese token nunca
  existió**, así que lo que se pintaba era el fallback. Un campo con error se marcaba con el rojo de
  los corazones. Dos semánticas opuestas con el mismo color, por un nombre mal escrito que nadie
  veía.

Ahora son dos: `--heart-600` para el favorito y `--danger-600` para la alerta, con una regla en
DESIGN.md que dice que no se mezclan.

### Fase 3 · Sin trabajo, porque ya estaba

El plan proponía que el panel creciera desde el marcador. Al probarlo en el navegador, la relación
ya era inequívoca: el marcador seleccionado **se rellena con el color de su plaza**, se eleva y gana
z-index. Con la fase 2, ese mismo color continúa en la cabecera, en las fotos y en el alfiler.

Añadir un `transform-origin` calculado habría sido movimiento por movimiento. La prueba del propio
plan dice que si no mejora ninguna dimensión, hay que cuestionar su existencia.

### Fase 4 · Una retirada

El movimiento con firma iba a ser una curva propia para la hoja inferior. Se descartó por lo mismo:
una curva no es identidad, es decoración con otro nombre.

Lo que sí se hizo fue **quitar**. La lista de lugares entraba escalonada, 22 ms por fila hasta doce.
Se ve bien una vez y mal las siguientes cincuenta, porque la lista se redibuja en cada tecla del
buscador y en cada filtro. Lo que se ve decenas de veces al día no se anima: deja de leerse como
pulido y empieza a leerse como lentitud.

### Fase 5 · Responsive

Verificado a 320 px, que es el caso estrecho, además de los ocho anchos que ya cubre
`tests/e2e/responsive.spec.ts`. Sin desbordamiento y sin deuda nueva.

Queda pendiente lo que ya se sabía: la medida de línea del panel son 38 caracteres, por debajo de
los 45 cómodos. Viene de `--panel-width` y es una decisión de producto, no un descuido.

### Fase 6 · Qué encontró cada herramienta

Ninguna encontró lo mismo, que es la prueba de que el reparto funciona:

| Herramienta | Qué vio |
|---|---|
| `/hallmark audit` | el texto justificado de las fichas |
| `review-animations` | dos animaciones recalculando disposición sobre el mapa |
| `impeccable detect` contra URL | el tipo de letra, y dos falsos positivos que se apagaron con medición |
| `impeccable detect` contra código, **con DESIGN.md puesto** | los cuatro rojos y el azul sin token |

El último solo apareció **después** de escribir DESIGN.md: sin una paleta declarada, el detector no
tenía contra qué comparar. Escribir el sistema no fue burocracia, fue lo que hizo visible un bug.

## Lo que se descartó, y por qué

Un análisis previo proponía más de lo que se hizo. Lo que quedó fuera:

- **Diagonales, siluetas irregulares, elementos que atraviesan otros.** Sobre un mapa que se mueve,
  una forma irregular se lee como un fallo de dibujado, no como una decisión.
- **Cinco a siete motivos propios.** Son tres. Un mantenedor y 0,8 KB de margen no sostienen siete
  sin que se vuelvan incoherentes, y un sistema incoherente se lee peor que uno pequeño.
- **Un footer expresivo.** La franja mide 24 px en escritorio porque todo lo que ocupa es mapa que no
  se ve.
- **Quitar píldoras.** Aquí se usan para filtros y estados, que es exactamente para lo que sirven.
  Lo que sobraba eran las tarjetas flotantes.
- **Cambiar la tipografía.** Decisión del propietario: se queda. Cambiarla obliga a volver a medir un
  presupuesto que acaba de chocar con su techo.
