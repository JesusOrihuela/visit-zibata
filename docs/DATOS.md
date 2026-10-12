# Datos comerciales

Los datos viven en `data/commercial/` y están separados del código. Tras cualquier cambio ejecuta:

```bash
npm run data:validate          # añade -- --fix para recalcular placeIds y categories de las plazas
```

La validación también corre antes de cada build y en CI: un error detiene la publicación.
Los archivos declaran `$schema`, así que VS Code autocompleta y marca errores al editarlos.

| Archivo | Contenido |
| --- | --- |
| `categories.json` | Taxonomía: categorías, sus giros, iconos y sinónimos de búsqueda. |
| `plazas.json` | Zonas que agrupan locales (`plaza` en el esquema): nombre, descripción, dirección, coordenadas, geometría, estado y procedencia. |
| `places.json` | Locales (establecimientos). |
| `imports/restaurantes-zibata.csv` | Hoja de importación equivalente al dataset verificado (con `id`). |
| `schemas/*.schema.json` | Generados por `data:validate`; no editar. |

> Los datos vigentes provienen de la investigación del 2026-09-14 ([research/](../research/methodology.md)), que
> auditó y sustituyó la lista beta "Restaurantes en Zibatá.xlsx" (archivada en `data/research/beta/`).
> `places.json` solo contiene lugares con estado `active` o `likely_active`; los cerrados, inciertos,
> rechazados y próximos se conservan con su evidencia en `data/research/`. No se inventan datos:
> descripciones, horarios, teléfonos y enlaces solo figuran cuando hay fuente.

## Locales cerrados: se recuerdan, no se publican

Un negocio que cierra **sale de la guía** (no está en `data/commercial/places.json`) pero **se queda en
`research/decisions.json`** con `status: "closed"`, su fecha y el motivo. No cuesta nada al usuario y
sirve para tres cosas: que una ronda de investigación no vuelva a darlo de alta, que se pueda explicar
por qué desapareció, y que el conteo de cierres diga algo sobre lo viva que está la plaza.

El campo `active` del esquema se conserva para otra cosa: ocultar un registro sin borrarlo (una plaza
que aún no abre, un local en obra). Hoy los 103 publicados están activos.

Borrar de verdad un registro solo tiene sentido si nunca existió (un duplicado, un error de captura).

### Cómo se mantiene (a mano o desde un backend)

La fuente de verdad es **`research/decisions.json`**: es el único archivo que se edita. Todo lo demás
(`data/commercial/places.json`, `data/research/closed.json` y las auditorías) lo genera
`node scripts/research/build-dataset.ts`. Para dar de baja un negocio:

1. En su decisión: `status: "closed"` (o `"removed"` si otro negocio ocupó el local), `reason` con lo que
   se comprobó, `fieldVerifiedAt`/`lastVerifiedAt` con la fecha y la fuente en `sources`.
2. Si lo sustituyó otro local, `replacedBy: "<id del nuevo>"`.
3. `node scripts/research/build-dataset.ts` y `npm run data:validate`.

El registro sale de la guía y aparece en `data/research/closed.json` con su evidencia. Reabre: se vuelve
a `likely_active` y regresa con su historial intacto. `scripts/research/closed-records.test.ts` vigila las
dos reglas que no se pueden romper: ningún cerrado se publica y ninguno se queda sin motivo, fecha ni
fuente.

Cada registro cerrado es ya una fila con clave propia (`id`), estado (`status`), fechas
(`lastVerifiedAt`, `fieldVerifiedAt`), relaciones (`plazaId`, `replacedBy`, `duplicateOf`) y sus fuentes
como lista de objetos. El día que haya backend, `records` es la tabla `places` con
`status = 'closed'` y `sources` su tabla hija: no hay que rehacer el modelo, solo importarlo.

## Verificación del propietario, local por local

Lo que no se puede confirmar en fuentes públicas (ubicación exacta del local, giro, descripción, redes) lo
completa el propietario en el formulario temporal "Verificación de locales" (una página de claude.ai con
los locales precargados, uno a la vez). Reglas:

- Todo campo es opcional; lo vacío deja el dato como está.
- La **ubicación propia** solo se usa si se marca "es la ubicación actual y exacta". Sin eso, la ficha
  sigue llevando a la plaza.
- Las respuestas se exportan como `reviews/<id>.json` y se aplican con
  `npm run data:apply-review -- <carpeta>` y después `node scripts/research/build-dataset.ts`. Cada local
  revisado queda con `fieldVerifiedAt` = fecha de la revisión.
- **El formato lo unifica el pipeline, no la persona** (`scripts/research/lib/owner-text.ts`): el
  teléfono pasa a E.164 y el horario se lee del texto libre ("lunes 2–11:30 p.m.", "L-V 8:00-21:00",
  "todos los días…") y se guarda estructurado. Lo que no se puede leer sin adivinar (un "3:30 - 9:30"
  sin a.m./p.m.) se reporta y se queda vacío.
- La **descripción** se publica como la escribió el negocio: con sus emojis y con sus saltos de línea
  (máximo tres; a partir de ahí el resto se une con " · " para que la ficha siga leyéndose de un
  vistazo). Solo se normalizan las letras decorativas ("𝙗𝙞𝙧𝙧𝙞𝙖" → "birria") y las viñetas sueltas al
  principio de cada línea. La ficha la muestra con `white-space: pre-line`.
- La **ubicación propia** se descarta si cae a más de 250 m de su plaza: ese enlace es de otra
  sucursal. En el campus Anáhuac los locales comparten la ubicación del campus a propósito.

> Ronda del 2026-09-22: 103 revisiones aplicadas · 100 descripciones · 92 horarios · 88 ubicaciones
> propias · 78 teléfonos. El **número de local se retiró del dataset**: cada plaza numera a su manera y
> confundía más de lo que ayudaba.

## Verificación en sitio

Un registro se publica cuando hay **al menos una fuente**: una URL pública (sitio propio, red social
oficial, plataforma de reparto, directorio) **o** una verificación en sitio de quien mantiene la guía,
que se anota como `campo:AAAA-MM-DD` en `verification.sources` (en la decisión:
`"fieldVerifiedAt": "AAAA-MM-DD"`).

Muchos negocios de barrio no tienen web ni aparecen en plataformas de reparto. Dejarlos fuera no haría
la guía más veraz, solo más pobre; publicarlos sin decir de dónde sale el dato sí sería inventar. Por eso
la verificación de campo es una fuente con nombre y fecha, no una excepción silenciosa.

## Qué contenido hay hoy (2026-09-15)

| Dato | Cobertura | Por qué |
| --- | --- | --- |
| Nombre, plaza, categoría, estado | 76/76 | Base de la guía; cada registro con fuente y fecha |
| Descripción | 75/76 | Solo cuando la fuente describe el negocio |
| Subcategoría | 45/76 | Ver el criterio más abajo |
| Enlaces (web o redes) | 65/76 | Perfil oficial verificado |
| Teléfono | 10/76 | Solo si la fuente oficial lo publica |
| WhatsApp | 1/76 | Ídem |
| Horario | 3/76 | Casi ningún negocio publica horarios en su propio sitio |
| Fotografías | 0/76 | Sin fotos con licencia propia; se usa una ilustración por categoría |

> Actualizado el 2026-09-26: **101 locales en 11 zonas activas** (Sushi Itto y BeeWaffle cerraron,
> verificado en campo) y dos zonas "Próximamente". Sucursales de una misma marca (Luka, Sinforosa, Starbucks) son
> registros distintos, uno por zona.
>
> Antes: **98 locales en 10 plazas activas**. 33 registros se
> sostienen (también) en una verificación en sitio, 11 negocios cerrados salieron de la guía y Plaza Loop
> se incorporó con sus locales. El detalle por registro sigue en `research/business-audit.json`.

Esa cobertura es un límite de las fuentes públicas, no un pendiente de captura: las fichas de directorios y
mapas comerciales que sí traen horarios derivan de Google, cuya API y cuyo contenido este proyecto no usa
(ver [SEGURIDAD.md](SEGURIDAD.md) y las reglas de [AGENTS.md](../AGENTS.md)). Cuando el negocio publique sus
horarios en su propio sitio o red social, se añaden con la fuente en `research/decisions.json`.

### Giros: el dato del local

Cada local lleva de **uno a tres giros**, en orden y repartidos en dos niveles:

```json
"giros": ["parrilla-argentina", "pizza"],
"secundarios": ["desayunos"]
```

Los **principales** (`giros`) son lo que define al local. Los **secundarios** son lo demás que se
vende ahí. El tope de tres cuenta entre los dos: un local que necesita más no se está describiendo,
se está enumerando. Un giro no puede estar en los dos niveles, y una prueba lo comprueba sobre los
datos publicados. La categoría no se escribe en el local: se deduce de sus giros con el catálogo.

**El nivel es peso visual, no visibilidad.** Los dos filtran igual, se buscan igual y pesan igual en
el orden personal: si Castore hace ramen, sale al filtrar Asiática aunque el ramen sea su tercer
renglón. Lo que cambia es dónde se dibuja cada uno:

| Dónde | Principales | Secundarios |
| --- | --- | --- |
| Tarjeta de la lista y resultados | Icono, y nombre si entra en la línea | Nombre si entra en la línea |
| Ilustración redonda del local sin foto | Icono, los tres si son tres | No aparecen |
| Ficha | Icono y nombre | Icono y nombre, igual que los principales |

En la ilustración redonda los dibujos comparten una sola placa que crece con la cuenta, en vez de
llevar una cada uno: así caben tres sin tocarse entre sí ni rozar el borde del círculo.

**En la tarjeta de la lista solo hay una línea**, así que se nombran los giros que caben en ella,
siempre al menos uno, y el resto se cuenta ("Alitas · Hamburguesas +1"). El presupuesto son 25
letras, contadas en `PlaceCard`: va en letras y no en píxeles porque medir el ancho real obligaría a
observar el tamaño de cada tarjeta al pintar. Un tope fijo de dos nombres no bastaba, porque hay
pares que ya no caben ("Jugos y Smoothies · Alto en Proteína"), y donde caben tres se leen los tres
("Pasta · Italiana · Pizza"). El `title` lleva la lista entera y la ficha los enseña todos.

**En la ficha, los giros van en una fila si caben y en un renglón cada uno si no**, y quien lo
decide es el ancho del bloque, no el de la ventana: con el panel estrecho o la pantalla partida la
ventana es ancha y el hueco no. Es una consulta de contenedor con el corte en el ancho del caso peor
(tres giros, 323 px), para que dentro de una misma vista todos los locales se lean igual. Nunca dos
giros arriba y uno abajo: eso partía la lista por donde no hay junta. **Los dos niveles se pintan
igual**: en la ficha todos son lo que se vende ahí, y el orden, con los principales delante, ya dice
cuál manda. El nivel solo decide quién sale en la lista y en la ilustración redonda, que es donde
falta sitio.

Hoy 61 locales llevan más de un giro (36 con dos y 25 con tres) y 34 tienen algún secundario.
**No hay un tercer nivel**: lo que se vende en un local o es un giro, principal o secundario, o no
está. El campo `tags` existió y se quitó, porque un cajón invisible que solo alimentaba al buscador
complicaba el modelo sin que nadie lo viera. Lo que vivía ahí y merecía existir se convirtió en giro
(Cecina, Empanadas, Wraps, Hot Dogs, Papas Fritas); lo demás se fue.

### Los dos idiomas

La guía se lee en español (el idioma de partida) y en inglés. Lo que se traduce y lo que no:

| Qué | Se traduce |
| --- | --- |
| Textos de interfaz | Sí, en `src/i18n/es.ts` y `en.ts`; TypeScript exige que no falte ninguna clave |
| Categorías y giros | Sí, en `label.en` de la taxonomía, en Title Case y sin calcos |
| Nombres de locales y de plazas | No. Son nombres propios: Cafele es Cafele |
| Direcciones | No |
| Descripción de una plaza | Sí. La escribe la guía, así que su inglés es texto propio |
| Descripción de un local | Sí, pero marcada. La escribe el negocio: ver abajo |

**La descripción de un local es del negocio, no nuestra.** Por eso `description` lleva los dos
idiomas (`{ es, en }`): en español se lee tal cual la escribió su dueño, y en inglés se lee la
traducción con la leyenda "Machine translation" y un botón que devuelve al original. Si no hay `en`
se muestra el original sin leyenda, que es lo que pasa con las descripciones que ya venían en inglés
(hoy once). En el CSV son dos columnas, `description` y `descriptionEn`. El buscador indexa los dos
idiomas, así que una búsqueda en inglés encuentra por la traducción.

Un idioma nuevo se añade creando su archivo en `src/i18n/`, registrándolo en `index.ts` y llenando
`label` y `description` con esa clave. Ningún componente cambia: los textos de interfaz salen de
`t()` y los de datos de `localized()`.

### Categorías: los estantes de la barra

Una **categoría** agrupa giros y solo existe para navegar: es la pastilla del filtro. Nunca se imprime
sobre un local, que se nombra siempre por sus giros, y se nombra **por el antojo**, que puede ser un
plato ("Tacos y Antojitos", "Alitas y Hamburguesas") o una cocina entera ("Mexicana", "Asiática",
"Italiana"), porque de las dos formas se antoja. La regla que las sujeta:

**Ningún giro abarca más que su estante.** Un giro que es una cocina completa es tan ancho como el
estante, así que tiene que ser el general de un estante con ese nombre, y se llama igual que él:
Italiana en "Italiana", Mexicana en "Mexicana", Asiática en "Asiática". El arranque genérico
("Cocina", "Comida") no dice nada que el adjetivo no diga ya, y en una línea estorba; el id sí lo
conserva (`cocina-italiana`), porque los locales lo referencian. Lo que sí cuelga de un estante de plato
es la cocina reducida a ese plato: Parrilla Argentina en "Carnes y Parrilla", que es más estrecha que
él. Una prueba lo comprueba sobre los datos publicados.

De ahí sale una tensión que se resolvió a mano. Un estante con nombre de cocina recoge también a quien
sirve uno de sus platos sin ser de esa cocina: en "Italiana" caen Domino's y El Hornero, que es una
parrilla argentina con horno de pizza. El dueño de la guía lo decidió así a sabiendas, porque quien
quiere italiano busca "Italiana" y no "Pizza y Pasta", y porque la ficha del local nunca imprime la
categoría: El Hornero se lee "Parrilla Argentina · Pizza", que es lo que es. El estante es dónde
buscar, no una etiqueta que se le cuelgue al local.

Un nombre compuesto ("Panadería y Repostería") promete las dos cosas por separado, no las dos a la
vez. Y cuando un estante recoge más platos de los que caben en su nombre, se le busca uno que los
abarque en vez de alargar la lista: así "Alitas y Hamburguesas" pasó a "Comida Rápida" al entrar
Papas Fritas y Hot Dogs.

**Un giro se llama por la comida, no por el local.** Tacos y no Taquería, Mariscos y no Marisquería,
porque se dice "quiero tacos" y no "quiero taquería". Las cocinas enteras son la excepción por el
lado contrario ("quiero comida italiana"), y Panadería, Repostería y Pastelería lo son porque ahí el
nombre del oficio es el nombre de lo que se come.

### El giro general

Cada categoría puede tener un **giro general**, el cajón de "es esto, en general", para el local que
hace de todo en ella y ninguna especialidad: Mexicana, Hamburguesas, Mariscos, Entre Panes.
No es una excepción ni un hueco: es un giro más, con su nombre, y comparte dibujo con su categoría
porque son la misma idea. Así **ningún local se queda sin giro** (hoy 10 llevan solo el general) y la
ficha siempre dice lo mismo. Se crea solo cuando algún local lo necesita: "Postres y Dulces" y
"Bebidas" no tienen, y "Desayunos y Café" tampoco, porque no hay un "esto en general" que abarque
café y desayuno a la vez: se ponen los dos giros, o brunch. Y puede quedarse vacío sin estorbar:
"Botanas" y "Waffles" no tienen locales hoy, pero son donde caerá el primero que los venda.

### Iconos

Cada giro tiene su dibujo y **ningún dibujo se repite entre dos giros distintos**; con su categoría
sí puede compartirlo, y lo hacen el giro general (son la misma idea) y "Café", que lleva la taza de
"Desayunos y Café" porque es el dibujo que le toca aunque no sea el general de ese estante. En la ficha se enseñan los iconos de todos, en el mismo
orden; en la tarjeta de la lista y en la ilustración redonda van solo los de los principales; donde
solo cabe uno (el escalón del podio del perfil) va el del primero. El mapa no
dibuja iconos de local: marca plazas con su cuenta. Una prueba exige que cada icono usado tenga dibujo
y que no haya dos giros con el mismo.

### Un giro nuevo

Nace cuando hay dos o más locales o cuando es lo único que vende uno y la gente lo busca por ese
nombre (arepas, kebabs, birria). Si no llega a giro, no se guarda: no hay cajón invisible donde
dejarlo. Añadir comida china es un giro en Asiática y frituras uno en "Para Picar": ni un
solo local cambia de forma. Así nació "Ramen", cuando se supo que Castore lo hace al mismo nivel que
sus hamburguesas.

El conteo de "Todo" cuenta **lugares**, no giros: un local con tres giros sigue siendo un lugar.

### Ubicación propia de un local y enlaces de Maps

La ficha lleva a la **plaza** salvo que el local tenga una ubicación propia verificada y actual: en la
decisión, `location` + `googleMapsUri` (hoy solo Smoothie Lab, con el enlace que aportó el propietario).
Una plaza también puede llevar `googleMapsUri`: "Cómo llegar" abre ese sitio exacto en vez de buscar por
nombre y dirección (MOL Pitahaya, Xentric Zibatá, Plaza Luna). Las coordenadas de un enlace corto se leen
de su redirección, sin abrir ni copiar contenido de Google.

## Actualizar la investigación

Las decisiones por registro viven en `research/decisions.json` y la evidencia en `research/log/*.jsonl`.
`node scripts/research/build-dataset.ts` regenera `places.json`, `plazas.json`, `categories.json`, el CSV y los
entregables de auditoría. El procedimiento completo y las reglas de estado y confianza están en
[research/methodology.md](../research/methodology.md).

## Agregar o actualizar locales desde CSV (recomendado para cargas grandes)

1. Copia `imports/restaurantes-zibata.csv` o crea uno con estas columnas (UTF-8, con encabezado):

   `id, name, plaza, giros y secundarios (separados por ";"), description, descriptionEn, hours, lat, lng, googleMapsUri, website, instagram, facebook, tiktok, whatsapp, phone, active`

2. Ejecuta `npm run data:import -- data/commercial/imports/mi-archivo.csv` (añade `--dry-run` para probar).

Reglas:

- `plaza` y `category` aceptan el nombre visible ("Paseo Zibatá", "Tacos y antojitos") o el id.
  Sin categoría → `otros` (con aviso).
- `active`: `sí`/`no` (también `true`/`false`, `1`/`0`, `✔`). Vacío = inactivo.
- `links`: además de web, Instagram, Facebook, TikTok y WhatsApp, el esquema admite los tres de
  reparto (`rappi`, `uberEats`, `didiFood`). Sin enlace no se dibuja botón, así que una ficha puede
  llegar a ocho.
- `hours`: texto compacto, p. ej. `lun-vie 08:00-22:00; sab,dom 09:00-14:00, 17:00-23:00; mie cerrado`.
  También `diario 13-2` (cruza medianoche) y `nota: Cocina cierra 30 min antes`.
- `whatsapp` / `phone`: 10 dígitos se interpretan como México (+52).
- `instagram` / `tiktok` / `facebook`: URL completa o `@usuario`.
- `id` (opcional) conserva el identificador aunque cambie el nombre. Si falta, se genera del nombre
  (`D’Lu Coffee & Bakery` → `dlu-coffee-bakery`) y, si el nombre se repite en otra plaza, se añade la plaza.
- Reimportar actualiza los locales existentes con las columnas no vacías y conserva lo demás (fotos,
  `verification`). Un local nuevo importado sin `verification` genera un aviso de validación hasta añadir sus
  fuentes (ver abajo).

## Editar un local a mano (`places.json`)

```json
{
  "id": "cafe-ejemplo",
  "slug": "cafe-ejemplo",
  "name": "Café Ejemplo",
  "plazaId": "paseo-zibata",
  "giros": ["cafe-de-especialidad", "panaderia"],
  "description": { "es": "Café de especialidad y panadería de masa madre.", "en": "Specialty coffee and sourdough bakery." },
  "hours": { "mon": ["08:00-20:00"], "tue": ["08:00-20:00"], "sun": [], "note": "Horario de verano" },
  "location": { "lat": 20.67935, "lng": -100.31497 },
  "googleMapsUri": null,
  "googlePlaceId": null,
  "phone": "+524421234567",
  "photos": [],
  "links": {
    "website": "https://cafeejemplo.mx",
    "instagram": "https://www.instagram.com/cafeejemplo/",
    "facebook": null,
    "tiktok": null,
    "whatsapp": "+524421234567"
  },
  "active": true,
  "verification": {
    "status": "likely_active",
    "confidence": "medium",
    "lastVerifiedAt": "2026-09-14",
    "sources": ["https://www.instagram.com/cafeejemplo/"]
  }
}
```

- Solo se muestran los campos con valor: nunca aparecen botones vacíos.
- `active: false` oculta el local sin borrarlo. Para un cierre temporal **no es lo que se quiere**:
  ver abajo.
- `verification`: estado de la investigación (`active` o `likely_active` para publicarse), confianza
  (`high`/`medium`/`low`), fecha de la última verificación y URLs de las fuentes. Un local activo sin
  `verification` produce un aviso; con un estado no publicable (`closed`, `uncertain`…), un error.
- Tras añadir o quitar locales: `npm run data:validate -- --fix` para sincronizar la plaza.

### Cerrado temporalmente

Un local en obra, de vacaciones o en traspaso lleva `cierre`:

```json
"cierre": { "motivo": "remodelacion", "desde": "2026-10-09" }
```

`motivo` solo admite `remodelacion`, `vacaciones` o `traspaso`: es una lista cerrada porque el aviso
se escribe en los dos idiomas, y un texto libre no se podría traducir. `desde` es la fecha en que
empezó. **No hay fecha de reapertura**, y es a propósito: mientras el negocio no la dé, ponerla sería
inventar un dato.

Qué cambia con el campo puesto:

- El punto de la tarjeta se vuelve **ámbar**, el único de los cuatro estados que avisa de algo.
- La ficha abre con un aviso, **antes del botón de "Cómo llegar"**, con el motivo y la fecha. El
  horario sigue debajo tal cual: volverá a valer cuando reabra, y borrarlo perdería un dato
  verificado.
- Queda **fuera del filtro "Abierto ahora"** aunque su horario diga que a esta hora abre, y **baja en
  el orden**: es el único valor negativo de la tabla de apertura.
- El texto del aviso va también en el HTML prerenderizado, antes que nada, para quien lea la página
  sin JavaScript.

Tres cosas que **no** se hacen y conviene no confundir:

| | Qué significa | Qué hacer |
|---|---|---|
| `cierre` | Cerrado por ahora, va a volver | Poner el campo |
| `active: false` | Fuera de la guía sin borrar el registro | Bajar la bandera |
| Sin `hours` | La guía no sabe el horario | No tocar nada |

Vaciarle el horario a un local en obra sería lo peor de las tres: perdería un dato verificado y lo
dejaría igual que los once de los que no sabemos nada.

**"Temporal" caduca.** La revisión por temporada tiene que preguntar por los que llevan meses así,
porque un "cerrado temporalmente" de hace dos años es un dato falso con otro nombre.

### Horarios

Cada día (`mon`…`sun`) es una lista de rangos `"HH:MM-HH:MM"` en hora de Querétaro:

- Día ausente → sin información (no se muestra).
- Lista vacía `[]` → cerrado ese día.
- Varios turnos → `["08:00-14:00", "17:00-22:00"]`; cruzar medianoche → `["18:00-02:00"]`.

La ficha muestra el estado ("Abierto" / "Cerrado") y agrupa días iguales ("Lun–Vie 08:00–22:00"); la hora
de apertura o cierre no se repite en el estado porque la tabla que va debajo ya la dice.
**En las listas no se muestran horario ni número de local**: solo 3 de 76 negocios publican horarios y 13
su local, y en una lista eso deja filas desiguales que se leen como información faltante. El dato sigue
publicándose donde se necesita (la ficha del lugar), sin inventar lo que no hay.

### Google Maps ("Cómo llegar")

El botón abre Google Maps en una pestaña nueva (Google no se usa para mostrar el mapa ni datos) y lleva
**siempre a las coordenadas de la plaza**, nunca a la puerta del local: la ubicación exacta de cada
negocio no está verificada y una ruta que termina en el sitio equivocado es peor que una que deja en la
plaza correcta. El texto del botón lo dice ("Cómo llegar a Paseo Zibatá").

## Fotografías

Solo fotos propias, aportadas por el negocio o con licencia adecuada. **Nunca** descargarlas de Google
Places, Google Maps ni redes sociales.

1. Coloca los originales en `data/commercial/photos-src/<id-del-lugar>/` (no se versionan).
   Opcional: `foto.txt` junto a `foto.jpg` con el texto alternativo en la primera línea y el crédito en la segunda.
2. Ejecuta `npm run images:optimize` (o `-- --place <id>`).
3. Se generan WebP y AVIF (máx. 1600 px) con variantes de 480 px (miniatura) y 960 px en
   `public/images/places/<id>/`, y se registran en `places.json` con dimensiones y color de relleno.

Sin fotos, la ficha no muestra nada en su lugar (ni marcador ni aviso): un hueco con una ilustración
genérica no aporta información. En las listas, la placa de color con el icono de la categoría no sustituye
a una foto: identifica el tipo de comida.

## Plazas (`plazas.json`)

Campos: `id`, `slug`, `name`, `description`, `address`, `coordinates`, `geometry` (Polygon o MultiPolygon),
`active`, `placeIds` y `categories` (derivados, se recalculan con `--fix`), `locationConfidence`
(`high`/`medium`/`low`), `locationSource` (evidencia de la ubicación) y `verification` (como en los locales).

### Agregar una plaza nueva

Zibatá crece: cada cierto tiempo aparece una plaza que no estaba en la investigación. El dataset se genera
desde `research/decisions.json`, así que la plaza se añade **ahí** (editar `plazas.json` a mano se perdería
en la siguiente generación).

1. Consigue una fuente pública verificable de su ubicación y su nombre. Sirve el polígono del centro
   comercial en OpenStreetMap (`shop=mall`), el sitio del desarrollo o el de la propia plaza. Sin fuente no
   se añade: el proyecto no inventa ubicaciones.
2. Obtén la geometría (ver [PIPELINE-GIS.md](PIPELINE-GIS.md#añadir-o-corregir-la-geometría-de-una-plaza)
   o `npm run map:suggest-plaza`).
3. Añade una entrada a `plazas` en `research/decisions.json` con el bloque `new`:

   ```json
   {
     "id": "plaza-ejemplo",
     "status": "active",
     "confidence": "high",
     "name": "Plaza Ejemplo",
     "new": {
       "description": "Plaza comercial sobre Av. …",
       "address": "Av. …, Zibatá",
       "coordinates": { "lat": 20.6827, "lng": -100.3186 },
       "geometry": { "type": "Polygon", "coordinates": [[[-100.3188, 20.6825]]] },
       "locationConfidence": "high",
       "locationSource": "De dónde sale la geometría (con URL o identificador)"
     },
     "sources": ["https://…"],
     "notes": "Qué falta por verificar"
   }
   ```

4. Añade o mueve sus locales en `places` (el mismo archivo), cada uno con su evidencia.
5. `node scripts/research/build-dataset.ts` regenera el dataset y `npm run map:build` le da volumen en el
   mapa (si no hay huellas de edificio dentro, se genera una a partir de su geometría).

Una plaza reportada pero **sin fuente** que la ubique va a `candidatePlazas` con lo que falta, para no
perderla ni publicarla como si estuviera verificada.

Para una plaza que ya existe en la lista beta basta con su decisión (`status`, `name`, `coordinates`…);
`placeIds` y `categories` son derivados y se recalculan solos.

Una plaza con `active: false` no aparece como interactiva en el mapa ni en los filtros.

### Plazas "Próximamente"

Una plaza confirmada y en obra se registra con `status: "coming_soon"` en su decisión: el generador le
pone `comingSoon: true` y `active: false`. En el mapa aparece con el contorno punteado y la leyenda
"Próximamente", y en la lista de plazas en su propia sección; no entra en filtros, ni en conteos, ni
acepta locales. Necesita ubicación verificable igual que cualquier otra plaza: sin coordenadas no se
dibuja (queda en `candidatePlazas` hasta tenerlas).

## Categorías (`categories.json`)

La taxonomía curada vive en `research/taxonomy.json` y se publica en `categories.json` al generar el
dataset: edítala ahí. Cada categoría lleva sus `giros`, y son los giros los que se asignan a un local.
Criterio: **una categoría por antojo, con al menos tres o cuatro lugares**, nombrada por lo que se come
y nunca por la cocina ni por el tipo de local (ver "Categorías: los estantes de la barra").

Se pueden renombrar, reordenar (`order`), añadir o cambiar de icono sin tocar componentes. Mover un
giro de categoría, o ascenderlo a categoría propia el día que crezca, tampoco toca ningún local: el
local solo lleva el id del giro.

- `icon`: uno de `acai`, `antojito`, `arepa`, `bagel`, `baguette`, `beef`, `beer`, `birria`, `boba`, `bowl`, `cake-slice`, `candy`, `cecina`, `cerdo`, `cherry`, `chopsticks`, `coffee`, `cooking-pot`, `crepa`, `croissant`, `cup-soda`, `cupcake`, `drumstick`, `dumbbell`, `egg-fried`, `elote`, `empanada`, `fish`, `flame`, `fruta`, `hamburger`, `hand-platter`, `hot-dog`, `hotcakes`, `ice-cream`, `italiana`, `jugo`, `kebab`, `leafy-green`, `martini`, `memela`, `molcajete`, `nigiri`, `pan`, `papas`, `papas-fritas`, `pasta`, `pizza`, `popcorn`, `quesadilla`, `ramen`, `salad`, `sandwich`, `shrimp`, `taco`, `torta`, `utensils-crossed`, `waffle`, `wine`, `wrap` (un nombre desconocido usa un icono genérico). Se amplían en
  `src/components/icons/CategoryIcon.tsx`, y una prueba exige que ninguno se repita entre dos giros.
- `synonyms`: palabras con las que la búsqueda encuentra la categoría o el giro ("coffee", "nieve",
  "boba"…).
- `general: true` marca el giro que es "la categoría entera"; comparte icono con ella.
- `slug`: `{ es, en }`, lo que sale en la URL del filtro (`?categoria=desayunos-y-cafe`,
  `?category=breakfast-and-coffee`). Ver abajo.
- Las categorías sin locales activos no aparecen en los filtros.
- Si cambias el `id` de un giro, actualiza los locales que lo usan (la validación te avisará).

### `slug` de categoría: el id no es la URL

El `id` de una categoría es la **clave estable**: es con lo que se relaciona todo lo demás y nunca
cambia. El `slug` es **cara pública**, uno por idioma, y se puede retocar sin tocar un solo dato:

```json
{ "id": "desayunos-y-cafe", "slug": { "es": "desayunos-y-cafe", "en": "breakfast-and-coffee" } }
```

Que hoy el slug español coincida con el id es historia, no obligación. El inglés se deriva de la
etiqueta inglesa de la categoría. Se traduce el valor y no solo el nombre del parámetro porque una URL
mitad en un idioma y mitad en otro no la reconoce nadie, y no había enlaces antiguos que respetar.

La validación exige que los slugs **no se repitan dentro de un mismo idioma**, y el build falla si
colisionan. Entre idiomas sí pueden coincidir: `bar` es `bar` en los dos, y eso no estorba porque cada
árbol de rutas se lee con su propio diccionario.
