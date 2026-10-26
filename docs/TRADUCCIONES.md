# Traducciones de Visit Zibatá

Este documento fija cómo se traduce la guía. Hay dos corpus distintos y cada uno tiene su fuente de
verdad; confundirlos es el origen de casi todas las traducciones malas.

| Corpus | Dónde vive | Quién manda |
|---|---|---|
| **Interfaz** | `src/i18n/es.ts` y `src/i18n/en.ts` | Nosotros. El español es el original. |
| **Datos** | `data/commercial/*.json` | El negocio o la fuente pública escriben el `es`; el `en` lo generamos nosotros. |

TypeScript obliga a que `en.ts` tenga todas las claves de `es.ts` (`satisfies Messages`). Los datos no
tienen esa red: este documento es su contrato.

## 1. Variedad de inglés: británico

Toda la interfaz usa inglés británico y las traducciones de datos lo siguen. Mezclar variedades se
lee como traducción automática aunque el texto sea correcto.

- `favourites`, `flavour`, `colour`, `centre`, `neighbour`, `holiday`.
- Fechas y números con el formato de `Intl`, nunca escritos a mano.
- **Excepción:** los nombres propios conservan su grafía. `Zibatá Discovery Center` se queda como está
  aunque el resto diga `centre`.

### Forma

- Comillas tipográficas (`’`), no rectas: *don’t*, *what’s*.
- Compuestos con guion cuando van delante del sustantivo: *one-of-a-kind flavour*, *cold-pressed
  juice*, *Baja-style seafood*, *Mixed-use development*.
- Mayúsculas solo en nombres propios: *Irish pub*, no *Irish Pub*.

## 2. Traducir el sentido, no la palabra

Antes de traducir, mira el giro del local y la frase completa. La misma palabra cambia de sentido
según el contexto, y ese es el error que más se cuela.

| Español | Contexto | Inglés correcto | Inglés incorrecto |
|---|---|---|---|
| Cortes | Carnes y parrilla | Grill & Steak | Cuts |
| Cortes y color | Peluquería | Haircuts and colour | Cuts and colour |
| Tacos y Antojitos | Categoría | Tacos & Street Food | Tacos & Little Cravings |
| Entre Panes | Categoría | Sandwiches & Wraps | Between Breads |
| Papas Preparadas | Botanas | Loaded Chips | Prepared Potatoes |
| Para Picar | Categoría | Snacks & Bites | To Nibble |
| Comida Casera | Casera y fondas | Home Cooking | Homemade Food |
| Comida | Franja del día (desayuno, comida, cena) | Lunch | Food |
| Tortas | Entre panes | Tortas | Cakes |

### Lo que no se traduce

- **Nombres de platillos:** tortas, birria, cecina, carnitas, pozole, elotes, esquites, gaspachos,
  paletas, açaí, memelas, sopes, flautas.
- **Nombres de locales, plazas y marcas:** se quedan como los escribió su dueño.
- **Palabras que el lector ya busca en español:** `tacos` no se convierte en `tacos (Mexican
  sandwiches)` en una etiqueta; si hace falta explicar, se explica en la descripción, no en la
  etiqueta.

### Falsos amigos que ya han aparecido

`cortes` (cortes de carne / cortes de pelo), `tortas` (sándwiches, no pasteles), `pasta` (pasta, no
pastelería), `pastel` (cake), `pan` (bread), `bar` (bar), `fonda` (home-style eatery).

## 3. La interfaz

- **Nada de texto suelto.** Toda cadena visible, `aria-label`, `title` y mensaje de estado sale de
  `t('clave')`. Si falta una clave, se añade en los dos idiomas.
- **Voz:** la guía habla en primera persona del plural ("no pudimos cargar el mapa", "usamos la
  información") y trata al lector de tú. Es la persona que usan las guías de estilo de producto cuando
  habla una marca y no una persona suelta, y además es la que firma el aviso de privacidad
  (Aurariola.com como responsable). Mezclar "yo" y "nosotros" en la misma interfaz se lee como dos
  autores distintos; por eso no hay "cuéntame" ni "lo reviso" en ningún texto.
- **Plurales:** `{ one, other }` con `Intl.PluralRules`; nunca `{count} lugares` a mano.
- **Variables:** `{name}`, `{count}`, `{plaza}`. No se reordenan ni se traducen.
- **Nombres accesibles:** empiezan por el texto visible y añaden el contexto después
  (`Xentric Anáhuac, 25 lugares`). Traducir el `aria-label` a algo que no empiece igual rompe el
  contrato de accesibilidad; las pruebas de `FilterBar`, `PlazaPanel`, `VisitButton` y `map.spec.ts`
  lo vigilan.
- **Longitud:** el inglés suele ser más corto, pero no siempre. Un botón que crece parte la fila;
  compruébalo en móvil.

## 4. Los datos

- **El `es` no se toca.** Es el texto del negocio. Solo se corrige con autorización del dueño o con
  una fuente pública verificable.
- **El `en` es nuestro.** Se puede corregir sin pedir permiso, porque es una traducción generada y la
  ficha la marca como tal.
- **Si el negocio ya escribió en inglés**, se copia su texto al campo `en`. Al ser idéntico al `es`,
  la ficha no muestra la leyenda de "traducción automática", que sería mentira.
- **Cobertura:** todo local y toda plaza llevan `description.es` y `description.en`; toda categoría y
  todo giro llevan `label.es` y `label.en`. Lo comprueba `validateTranslations` en
  `src/data/relations.ts`, que corre con `npm run data:validate`, y por tanto con el build y el
  despliegue.
- **El contexto del metadato lo pone la plantilla**, no la descripción: giros + plaza + Zibatá, y
  después el texto del negocio recortado a 160 caracteres. No se escribe la frase a mano en el
  prerender.
- **Las imágenes OG no llevan texto traducible:** nombre del local (nombre propio), plaza y el color
  de su categoría. La misma imagen vale para los dos idiomas, así que no hay dos juegos de 103
  archivos ni etiquetas en español en una ficha inglesa.

## 5. Cómo revisar una traducción

1. ¿Qué es el negocio? Lee sus giros y su plaza antes de tocar la frase.
2. ¿La palabra significa eso **aquí**? Pasa la lista de falsos amigos.
3. ¿Es un platillo o un nombre propio? Entonces no se traduce.
4. ¿Está en inglés británico?
5. ¿Los plurales y las variables están completos?
6. ¿El nombre accesible sigue empezando por el texto visible?
7. ¿Cabe en la interfaz a 375 px?

## 6. Validación

```powershell
npm run data:validate   # estructura, campos derivados y cobertura de traducciones
npm run build           # prerenderiza ES y EN y comprueba los metadatos
npm test                # paridad de claves y textos de interfaz
npm run test:seo        # páginas servidas, metadatos y versión sin JavaScript
```

Si un local, una plaza, una categoría o un giro se queda sin inglés, `data:validate` falla con el
`id` concreto. Es la red que faltaba cuando trece locales publicaron su descripción solo en español.

## 7. Decisiones tomadas

- **2026-10-25 · Voz.** Primera persona del plural y trato de tú en toda la interfaz. El formulario
  de sugerencias decía "cuéntame / lo reviso" y pasó a "cuéntanos / lo revisamos".
- **2026-10-25 · Zona visitada.** `profile.zoneDone` pasa de "estrenada" a "visitada": el dato es
  "hay al menos una visita", no "fue la primera".
- **2026-10-25 · Tarjeta OG.** Sin giros traducidos; nombre, plaza y color de categoría. Una imagen
  por local para los dos idiomas.
- **2026-10-25 · Meta de categoría.** El inglés deja de decir "of the locality" y pasa a
  "…: 26 places across 10 areas, with hours, contact and directions."
- **2026-10-25 · `place.ratingCount`.** Eliminada: no se usaba y las notas no se publican por diseño.
- **2026-10-25 · Segunda pasada.** Se quitó "the locality" de los metadatos de portada y categoría,
  se unificaron los compuestos con guion y las comillas tipográficas, y la línea inglesa del 404
  pasó a traducir el mensaje completo en vez de resumirlo.
