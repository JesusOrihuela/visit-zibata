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

| | Fase | Estado |
|---|---|---|
| 2 | El hilo de la plaza | hecho |
| 1 | Formas, elevación y bordes | hecho |
| 3 | Continuidad mapa ↔ panel | hecho |
| 4 | Un movimiento con firma | hecho |
| 5 | Responsive por breakpoint | hecho |
| 6 | Revisión con las cuatro herramientas | hecho |

Se empezó por la 2 y no por la 1 a propósito: es la que más cambia la sensación del producto, sale
de algo que ya estaba bien pensado, y las otras se entienden mejor con el hilo de color puesto.

### Fase 2 · El hilo de la plaza

El color de la plaza viaja ahora por todo el recorrido, en cuatro sitios y siempre como aro o como
texto, nunca como fondo:

- **El aro de la foto del lugar.** Era un filete neutro de 1 px; ahora es el color de su plaza. La
  foto queda siendo el sitio donde vive la identidad del lugar: aro de plaza fuera, punto de estado
  en la esquina.
- **El encabezado de grupo en los resultados de búsqueda.** Cuando una búsqueda mezcla zonas, cada
  grupo lleva el color de la suya.
- **El botón de volver y la línea de ubicación en la ficha**, que es donde se nombra la plaza.
- **Las filas del explorador de zonas**, que ya lo llevaban.

No se tocó la pastilla de filtro de zona: es un control, y los controles son olivo. Darle el acento
habría mezclado los dos canales el mismo día que se separaron.

### Fase 1 · Formas, elevación y bordes

Tres jerarquías donde había una sola forma repetida.

**Formas.** Lo redondo se pulsa, lo recto es contenido, el círculo es identidad. Las tarjetas de
lugar dejan de ser rectángulos redondeados flotantes y pasan a ser filas de un índice, separadas por
aire y no por una caja cada una. La foto circular es la única forma redonda que queda, y por eso
carga el aro de plaza y el punto de estado.

**Elevación.** Cuatro niveles explícitos, y cada elemento elige uno:

| Nivel | Qué es | Recurso |
|---|---|---|
| 0 | contenido dentro de un panel | sin sombra |
| 1 | pastillas y controles sobre el mapa | `--shadow-sm` + filete |
| 2 | panel y hoja, que flotan de verdad | `--shadow-md` + desenfoque |
| 3 | diálogos, que tapan el mapa entero | `--shadow-lg` |

**Bordes.** Un mecanismo por función: borde delimita, contraste separa, sombra eleva, espacio
agrupa. Antes se usaban los cuatro a la vez en los mismos sitios.

### Fase 3 · Continuidad mapa ↔ panel

Al tocar un marcador, el panel ya no aparece sin más: crece desde la posición del marcador. Es la
diferencia entre "apareció un panel" y "abrí ese lugar". El `transform-origin` se calcula desde la
coordenada real del marcador en pantalla.

### Fase 4 · Un movimiento con firma

El movimiento era correcto y anónimo. Ahora hay **uno** reconocible, y solo uno: la hoja inferior se
asienta con una curva propia, que es la interacción más repetida del producto en móvil.

Lo que se quitó, por la tabla de frecuencia de Emil Kowalski: la lista de lugares ya no entra
escalonada. Una lista que se vuelve a escalonar en cada cambio de filtro se ve decenas de veces al
día, y eso es exactamente lo que no debe animarse.

### Fase 5 · Responsive por breakpoint

Revisados 320, 375, 414, 768 y 1280 como experiencias y no como un encogimiento. La deuda conocida
era la medida de línea del panel: 38 caracteres, por debajo de los 45 que pide una lectura cómoda.

### Fase 6 · Revisión

Cada capa tiene su herramienta y ninguna se pisa con otra; la tabla está en
[AGENTS.md](../AGENTS.md).

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
