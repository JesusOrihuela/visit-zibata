# Arquitectura

## Principios

- **El mapa es el producto.** La interfaz flota sobre él y revela contenido de forma progresiva:
  mapa → zona → local → detalle.
- **"Zona" en la interfaz, `plaza` en el código.** Lo que agrupa locales no siempre es una plaza
  comercial (el campus de la Anáhuac o el campo de golf no lo son), así que la interfaz los llama
  zonas. **La URL también es interfaz**, así que lleva la palabra visible: `/zona/…` en español y
  `/area/…` en inglés (`src/lib/url-state.ts`). El tipo de dominio, los datos y el código mantienen
  `plaza` como identificador estable, y nada de eso sale a la pantalla.
- **Estático y portable.** Solo HTML, CSS, JS, JSON, GeoJSON, teselas, imágenes y fuentes. Sin backend,
  cuentas, API keys ni servicios de pago. Cualquier hosting estático sirve.
- **Datos separados del código** y validados dos veces: con Zod en el build y con comprobaciones ligeras
  (sin Zod) al cargarlos en el navegador, compartiendo las mismas reglas (`src/data/rules.ts`).

## Capas

```
src/
  app/            Composición, estado global (useReducer + Context), sincronización con la URL
  components/     UI genérica: panel lateral, hoja inferior, iconos, marca, estados vacíos
  config/         Cámara y límites del mapa (lee data/geographic/extent.json)
  data/           Esquemas Zod, validación de relaciones, repositorio y catálogo
  features/
    map/          MapView, marcadores de plaza, controles, cámara, estilo por capas, depuración
    plazas/       PlazaPanel, ResultsPanel, ExplorePanel, pastillas de categoría
    places/       PlaceCard, PlaceList, PlaceDetail, galería, horarios, ilustraciones
    search/       SearchBar e índice Fuse.js
    filters/      FilterBar y lógica de filtros
    favorites/    Favoritos en localStorage (opcional)
    ranking/      Orden personal de las listas (gustos + descubrimiento)
    about/        Idioma, franja de la guía y las páginas de información
    onboarding/   Tutorial de 3 pasos
  hooks/ lib/ i18n/ styles/ types/
scripts/          Pipeline GIS, datos (validar/importar CSV) e imágenes
data/             Datos geográficos y comerciales (fuente de verdad)
public/           Assets publicados tal cual (map/, icons/, images/)
```

### Mapa (`src/features/map`)

- `MapView` crea MapLibre una vez, registra el protocolo `pmtiles://` y el worker, y traduce el estado a
  **feature-state** (hover, seleccionado, atenuado), marcadores y cámara. Recibe el espacio ocupado por los
  paneles como `padding` y no conoce su maquetación.
- El estilo se compone por capas en `style/layers/`: `ground.ts` (GreenLayer, WaterLayer), `roads.ts`
  (RoadLayer), `buildings.ts` (BuildingLayer), `plazas.ts` (PlazaLayer + PlazaHighlight) y `labels.ts`.
  Colores en `style/theme.ts`.
- `PlazaMarkers` son botones HTML accesibles (teclado, lector de pantalla) con resolución de colisiones:
  etiqueta completa → desplazada → solo cifra → oculta.
- Si no hay WebGL2, se muestra un aviso y la lista de plazas mantiene la guía utilizable.

### Estado

`src/app/state.ts` (reducer puro, testeado). Correspondencia con el brief: `selectedPlaza` (también actúa
como filtro de plaza), `selectedPlace`, `activeCategory`, `searchQuery`, `tutorialVisible`, `mapLoaded`
(`mapStatus`). `useExperience` deriva resultados, conteos y el modo del panel. La URL (`/zona/…`,
`/lugar/…`, `?categoria=`, `/info/…`, y su árbol en inglés bajo `/en`) se sincroniza en `useUrlSync`,
que es el **único** sitio que la escribe.

### Información de la guía

"Acerca de esta guía", "Privacidad y términos", "Sugiere un cambio" y el tutorial son **cuatro rutas
propias** (`/info/acerca`, `/info/privacidad`, `/info/sugerir`, `/info/tutorial`, y su árbol en
inglés bajo `/en/info/`): se enlazan y comparten por separado, y al cerrarlas se vuelve a la plaza o
ficha que seguía en el estado. En escritorio se llega desde la franja inferior del mapa (`GuideBar`);
en móvil, donde esa franja se pelearía con la hoja y con la atribución, desde el botón de información
de la barra superior. Cada página es su propia hoja (`InfoDialog`) y lleva a las otras.

Privacidad y términos van en una sola página desde la v4.18. La dirección no cambió, porque ya
estaba indexada: lo que cambió es que el título dice las dos cosas y los términos se leen debajo del
aviso de privacidad. En la franja y en el pasaporte la etiqueta sigue siendo "Privacidad", que es lo
que cabe.

### Tu Zibatá (perfil local)

No hay cuentas, pero sí hay algo que es de quien usa la guía, todo en su dispositivo: **visitas**
marcadas a mano (`zibata:visitas`), **favoritos**, **notas en estrellas** y las fichas que ha abierto.
El sello del final de la barra superior (`features/profile/ProfileButton.tsx`) se llena cuando ya hay
marcas, lleva la cifra de favoritos y abre la hoja (`ProfileSheet.tsx`, en su propio trozo de JS porque
casi nunca se abre).

La hoja no es un panel de métricas ni una lista de recomendaciones, y tampoco un menú de enlaces: es
una foto del presente, para mirar. **Tu paso por Zibatá** es una frase con lo que llevas y las zonas de
la guía en insignias del color que cada plaza tiene en el mapa, llenas las estrenadas y en contorno las
que faltan; son un cuadro, no controles. **Tus tres de siempre** son los tres lugares que salen de tus
propias marcas, en cascada: estrellas, visitas, corazón, fichas abiertas, visita más reciente,
frecuencia a esa plaza y, si todo empata, orden alfabético. Ese orden es interno: en pantalla es un
podio, con el primero al centro y más alto, donde solo se ve el lugar, sus giros y su puesto. El
orden del documento sigue siendo 1, 2, 3, que es el que se lee y se recorre con el teclado; el 2, 1, 3
del podio lo pone `order` en CSS. La hoja está pensada para caber sin desplazarse, y en pantallas de
menos de 740 px de alto suelta el subtítulo y los iconos del podio para seguir cabiendo. **Lo que más se te antoja** son los tres giros donde más marcas hay,
contando solo las que se ponen a propósito (visitas, notas y corazones), nunca las fichas abiertas. Una
**visita** se marca desde la ficha ("Registrar visita"): guarda la fecha, el mismo día se puede deshacer
y a partir del siguiente se acumula. Pesa en el orden personal más que abrir una ficha, porque la pone
la persona a propósito.

Ese sello es también el sitio reservado para la cuenta el día que exista: mismo lugar, misma forma, sin
tener que rehacer la barra. En un teléfono es además el único camino hacia las páginas de información
(en escritorio está la franja del mapa), y por eso la hoja las lista todas.

### Responsive

Un solo árbol de componentes. ≥ 900 px: panel lateral derecho (~28 % del ancho). < 900 px: hoja inferior
con dos estados (colapsada / expandida), arrastrable y operable con teclado; en vertical el mapa se gira
para aprovechar la pantalla.

## Datos: repositorio intercambiable

La UI solo depende de `PlacesRepository` (`src/data/PlacesRepository.ts`):

```ts
interface PlacesRepository {
  getCategories(): Promise<Category[]>
  getPlazas(): Promise<Plaza[]>
  getPlaces(): Promise<Place[]>
}
```

`StaticPlacesRepository` importa los JSON como chunks con hash (caché inmutable) y valida **registro a
registro** con `runtimeValidation.ts`: las mismas reglas que los esquemas Zod del build (identificadores,
enlaces seguros, teléfonos, horarios, fotos), pero sin cargar Zod en el navegador. Un registro inválido se
descarta con un aviso; solo se falla si un archivo es ilegible o se queda sin categorías ni plazas.
`loadCatalog` hace lo mismo con las relaciones: descarta o corrige lo que las rompe (plaza o giro
inexistente, slug repetido, coordenadas fuera de Zibatá, estado no publicable) en vez de bloquear la guía.
Los tests comprueban que ambas validaciones aceptan y rechazan exactamente lo mismo.

### Futuro: CMS, Supabase o API

1. Crear `RemotePlacesRepository` que haga `fetch` al origen y valide con los esquemas de `src/data/schemas.ts`.
2. Cambiar la instancia en `src/app/App.tsx` (único punto de composición).
3. MapView, PlaceCard, PlaceDetail, búsqueda y filtros no cambian: consumen el mismo `Catalog`.

Un panel administrativo (edición de plazas, locales y fotos con autenticación administrativa) puede escribir
en ese origen y disparar un rebuild, o la app puede leerlo en vivo. La geometría 3D de plazas seguiría
generándose con `map:build`, o se serviría como GeoJSON dinámico con el mismo formato que
`plaza-buildings.geojson`.

## Orden personal de las listas

Las listas de una plaza y de resultados (sin texto de búsqueda) se ordenan con `rankPlaces`
(`src/features/ranking/`), una función pura:

- **Gusto.** Favoritos (+3), calificaciones (estrellas − 3) × 1,2, así que una de 1 o 2 resta, y fichas abiertas
  (log₂ de las aperturas y de las visitas marcadas, con vida media de 30 días) suman afinidad al lugar, a cada uno de sus giros, a sus categorías y un
  poco a su plaza. Un sushi que nunca abrió sube si abre mucho otro sushi.
- **Comunidad (opcional).** `rankPlaces` acepta las señales que hoy no existen (cuántas personas
  guardaron el lugar y su calificación media, con un factor de confianza por número de valoraciones) y
  pesan 0,3 como mucho: orientan, nunca mandan sobre el gusto propio. En la interfaz solo se publican
  los **corazones**; la media de estrellas ordena pero no se enseña junto al negocio, porque un promedio
  público es un arma de doble filo para un local pequeño.
- **Abierto ahora (0,5).** Un local cerrado no sirve para decidir dónde ir en este momento, así que
  estar abierto sube. Pesa más que la comunidad y que el giro, pero no manda: un favorito aporta
  0,76 por la vía directa, así que un lugar que esta persona guardó y está cerrado puede seguir por
  delante de uno indiferente que está abierto. Los once locales sin horario publicado quedan en
  medio (0,35) y no en el suelo: no se sabe si están abiertos, y hundirlos castigaría al negocio por
  un hueco de la guía.
- **Descubrimiento y segundas oportunidades.** Una de cada cuatro posiciones es para un lugar que no ha
  abierto nunca **o que no abre desde hace más de 60 días**, con una rotación diaria determinista: lo
  nuevo tiene sitio y lo que se descartó hace tiempo puede volver.
- **Las pastillas de categoría** también se ordenan por afinidad (`categoryAffinity`), con el orden
  curado como desempate: quien siempre busca tacos los encuentra primero.
- **Sin señales**, el orden curado de la guía, con una sola excepción: lo abierto ahora sube, y
  dentro de cada grupo (abierto, sin horario, cerrado) se conserva el orden curado. Estar abierto no
  es una señal personal, es una propiedad del mundo, así que no hace falta haber marcado nada para
  que valga. El resto de la maquinaria (afinidades, descubrimiento, rotación diaria) sí espera a que
  haya algo marcado: barajarle la guía cada día a quien llega por primera vez no le sirve de nada.
  Con texto de búsqueda manda la relevancia.
- Las señales se leen una vez por lista: marcar un favorito dentro de ella no la reordena bajo el dedo.

Las señales vienen de una `PreferenceSource` (`preferences.ts`). Hoy es local (`zibata:favoritos`,
`zibata:calificaciones`, `zibata:interacciones`, máx. 300 lugares); con cuentas y base de datos basta con
`setPreferenceSource()` hacia una API, y `rankPlaces` puede correr igual en el servidor. El historial local
viaja una vez en `localProfileSnapshot()` para no empezar de cero.

## Tipografía

**La escala vive en [docs/CATALOGO.md](CATALOGO.md) § 3**, con un escalón por papel, las tres
familias y los tres pesos. Aquí estaba repetida y se desfasó: decía dos familias cuando hay tres y
el cuerpo en 15 px cuando pasó a 14. Es exactamente lo que una fuente única viene a evitar, así que
en vez de corregirla se quita.

Lo que sí es de arquitectura y no de catálogo:

- Los valores viven en `src/styles/tokens.css` y **no hay tamaños sueltos en los componentes**: lo
  comprueba una prueba (`tests/e2e/catalogo.spec.ts`).
- Fraunces es ancha, así que por encima de 30 px los nombres largos empiezan a partirse en tres
  líneas. Ese es el techo de la escala, y el motivo.
- Las versalitas llevan `letter-spacing: 0.08em`; los títulos, `-0.015em`.
- Las cifras que se comparan en columna (horarios, conteos) van con `font-variant-numeric:
  tabular-nums`.
- **Cada visita baja un solo idioma**, así que también baja un solo juego de pesos: se cargan tres
  ficheros de fuente, no cinco, y por eso la escala no tiene 500 ni 800.

## Idioma

Los textos de interfaz viven en `src/i18n/<locale>.ts` y TypeScript exige que cada catálogo tenga todas
las claves (`satisfies Messages`), así que no se publica media traducción. **Cada visita baja un solo
idioma**: el español va en el paquete (es el idioma por omisión y el respaldo de `localized()`, así
que `t()` nunca se queda sin nada), y el inglés se pide cuando hace falta. Por eso `setLocale()` es
asíncrona.

Lo único que viaja siempre en los dos idiomas son las cuatro cadenas de `cambioDeIdioma.ts`: el botón
de idioma escribe su etiqueta en el idioma **al que lleva**, así que la primera pantalla ya las
necesita. Unos 120 bytes, a cambio de que el catálogo que no se usa deje de viajar. El idioma activo lo decide
`resolveLocale()` en este orden: **lo que diga la URL** (el prefijo `/en`), después el elegido a mano
(se recuerda en este dispositivo) y, si no hay ninguno, el español.

Nota deliberada: **no** se detecta el idioma del navegador. Al existir un árbol de rutas por idioma,
detectarlo haría que un rastreador que pide la portada en inglés acabase redirigido a `/en`, y la
portada española dejaría de indexarse. La preferencia guardada sí redirige, pero solo al cargar y
nunca con el botón atrás, que si no se quedaría atrapado.

Cambiar de idioma con `setLocale()` avisa a `useLocale()`, que re-renderiza la interfaz desde la raíz:
no hace falta recargar ni pasar el idioma por props. Se cambia desde `LocaleSwitch`, en la barra
superior: un botón que nombra el idioma al que lleva, visible en cualquier vista y sin abrir nada, y
que lleva a la **misma página en el otro árbol** porque el idioma entra en el cálculo de la ruta. Los
datos (nombres y descripciones de los negocios) se quedan en el idioma en que los escribió su dueño;
las categorías sí están traducidas, incluido su slug de URL.

## Enlaces y compartir

El estado compartible vive en la **ruta** (`src/lib/url-state.ts`), con un árbol por idioma:

| Español | Inglés |
| --- | --- |
| `/` | `/en` |
| `/zona/<slug>` | `/en/area/<slug>` |
| `/lugar/<slug>` | `/en/place/<slug>` |
| `/info/{acerca,privacidad,sugerir,tutorial}` | `/en/info/{about,privacy,suggest,tutorial}` |
| `?categoria=desayunos-y-cafe` | `?category=breakfast-and-coffee` |

El parámetro de categoría se traduce entero, nombre y valor: una URL mitad en un idioma y mitad en
otro no la reconoce nadie, y no hay enlaces antiguos que respetar porque el filtro nunca se publicó.
El valor que viaja es el **slug** de la categoría, no su `id` (ver [DATOS.md](DATOS.md)); traducir uno
en otro necesita el catálogo, así que lo hace `useUrlSync` y `url-state.ts` se queda puro y testeable.

Hasta la v4.6.0 todo esto vivía en el hash (`#/lugar/tomassa`), porque GitHub Pages no sabe reescribir
rutas. El cambio no es cosmético: **lo que va después de `#` nunca se envía al servidor**, así que el
rastreador de Google o de WhatsApp solo veía la portada. Lo que lo hace posible es que cada ruta sea
un archivo de verdad (abajo), no una reescritura.

Un enlace antiguo con hash sigue llevando a donde prometía: al cargar, `pathFromLegacyHash()` lo
traduce a su ruta y la reescribe, de modo que a partir de ahí todo funciona con el formato nuevo. En
desarrollo no hay prerenderizado, así que un plugin de `vite.config.ts` entrega `index.html` para las
rutas que la aplicación sirve (`APP_ROUTE`) y **solo** para esas: un camino inventado responde 404
mientras se desarrolla, igual que en producción.

El botón de compartir de la ficha (`src/lib/share.ts`) **no** comparte la URL de la vista: arma la
canónica del lugar, sin la categoría ni ningún otro estado. Si la compartiera tal cual, el mismo
local daría una URL distinta por cada filtro desde el que alguien lo compartiera, y los enlaces
entrantes se repartirían entre todas. La raíz sale de `SITE_URL` cuando se compiló con ella, para
que compartir desde dos dominios produzca el mismo enlace.

Compartir usa la hoja del sistema (`navigator.share`) cuando existe y el portapapeles cuando no. Si
el navegador no trae ninguna de las dos, el botón no se dibuja.

## Una página por ruta (SEO y vistas previas)

`scripts/build/prerender.ts` es un plugin de build que escribe **234 páginas** (117 por idioma: la
portada, las 11 zonas activas, 101 locales y 3 páginas de información), más `sitemap.xml` y
`robots.txt`. Las zonas sin actividad no tienen página: no se indexa lo que no se puede visitar. Nada de
esto se escribe a mano: sale de `data/commercial/*.json` en cada compilación, así que añadir un local
o cambiarle el nombre se refleja solo en la siguiente publicación.

Desde la v4.16 cada una trae también su contenido escrito dentro de `<div id="root">`: el nombre, los
giros, la dirección, el horario, el contacto y enlaces a la zona y a los locales vecinos. Antes el
cuerpo eran 193 bytes iguales en todas, así que un rastreador veía páginas vacías y sin enlaces entre
ellas, y Search Console lo decía con esas palabras ("Página de referencia: no se ha detectado
ninguna"). React lo sustituye al montar, así que no es contenido distinto del que enseña la
aplicación: es el mismo, servido antes. Hay E2E que lo comprueban con JavaScript desactivado.

Las 234 cargan la misma aplicación; lo demás distinto está en el `<head>`: `<html lang>`,
`<title>`, `description`, `canonical` y las tres `hreflang` (`es`, `en` y `x-default` apuntando al
español, que es el idioma por omisión del sitio). Las dos listas de páginas se generan con el mismo
recorrido, así que la gemela en el otro idioma ocupa la misma posición y las `hreflang` salen sin
emparejar por ruta.

### A qué locales enlaza cada ficha

Cada ficha servida termina con "Más en {zona}": una lista de hasta **8** locales de su misma zona.
Antes eran los 8 primeros del dataset para todos, así que en las zonas grandes (Xentric Anáhuac 25
locales, Paseo Zibatá 24, Anáhuac Querétaro 12, Plaza Zielo 10) los mismos ocho recibían el enlace de
todos y 37 de las 101 fichas tenían **un único enlace entrante**. `scripts/build/vecinos.ts` reparte
la lista: cada ficha elige primero al vecino que menos enlaces lleva hasta ese momento, después al
de su misma categoría y después al primero del dataset. Es determinista y no depende del idioma.

En las zonas donde caben todos (hasta 9 locales) la lista es la de siempre. Este bloque **solo existe en
el HTML servido**: la interfaz no tiene uno equivalente, así que el reparto no añade enlaces ni toca la
interfaz, solo cambia cuáles. Resultado medido: mediana de enlaces entrantes 8 a 9, máximo 25 a 10 y
fichas con un solo enlace 37 a 2 (las dos que están solas en su zona: MOL Pitahaya y Zibatá Golf).

### Título y descripción de una ficha

`scripts/build/metadatos.ts` decide el título y la descripción de las 101 fichas **juntas**, porque
un título o una descripción solo se distingue de otro mirando la lista entera. Es solo el `<head>`:
el texto visible de la ficha y el `description` del JSON-LD siguen siendo los del negocio.

| Qué | Regla |
|---|---|
| Título | `{nombre} · Visit Zibatá`. Si dos locales comparten nombre (dos sucursales de Starbucks, Luka, Sinforosa, La Michoacana), el de cada uno lleva su zona: `{nombre} · {zona} · Visit Zibatá` |
| Saltos de línea del dato | Si la línea siguiente empieza en minúscula, es un corte duro a media frase y se une con un espacio. Si empieza en mayúscula, emoji o cifra, es un separador y se une con " · " (o con un espacio si la anterior ya termina en puntuación o emoji) |
| Nombre repetido | Se quita del principio de la descripción solo si le sigue un separador (`.`, `\|`, `:`) y queda texto de verdad. "CAFELE es una cafetería…" se queda: el nombre es el sujeto |
| Descripción corta (menos de 70 caracteres) | Se completa con los giros y la zona del propio local ("Bowl Revolution. Açaí, Jugos en Centro Zibatá."). Un giro que la descripción ya dice no se repite: si no queda ninguno, solo se dice la zona |
| Dos descripciones iguales | A la segunda se le reserva sitio para el contexto, de modo que ninguna pareja salga idéntica |
| Corte | A 160 caracteres, en una frase completa si deja al menos la mitad; si no, en una palabra, sin signos ni conjunciones colgando |
| Cierre temporal | La descripción abre con "Cerrado temporalmente. {motivo}", el mismo aviso que abre el cuerpo, y el `lastmod` del sitemap no es anterior a la fecha del cierre |

Nada se inventa: lo único que se añade son los giros y la zona del local, que ya están en los datos.
Que Google muestre esta descripción, o que respete su orden, no está garantizado: la usa cuando le
parece que describe mejor la página que el texto de la propia página. Lo comprueban
`scripts/build/metadatos.test.ts` (las funciones, con locales reales),
`scripts/build/prerender.metadatos.test.ts` (las 234 páginas con el dataset) y
`tests/e2e/metadatos.spec.ts` (el HTML ya publicado en `dist/`).

La portada tiene sus propios `seo.home.title` y `seo.home.description` (en `src/i18n`), que también
están en `index.html` para que la plantilla no diverja. El lema de la marca (`app.tagline`), que es
visible en la interfaz y es el `h1`, no cambia con ellos.

Son **archivos planos** (`dist/lugar/tomassa.html`) y no carpetas con índice. Cloudflare sirve un
archivo individual sin barra final, pero redirige `/lugar/tomassa` a `/lugar/tomassa/` si es una
carpeta: un salto extra en cada enlace compartido y una URL canónica distinta de la que se comparte.

`scripts/images/generate-place-og.ts` (`npm run images:og-places`) compone una imagen de vista previa
por local en `dist/og/<slug>.jpg`. No se guardan en el repositorio: se generan al publicar, después
del build, porque el build limpia `dist`. Hoy ningún local tiene foto, así que la mitad derecha de la
tarjeta usa el tono de su categoría; el día que haya fotos esa misma mitad las toma, la rama ya está
escrita. Se renderiza con el navegador de Playwright, que ya es dependencia de desarrollo, en una sola
página con las 101 tarjetas, y se pasa por `sharp` a JPEG: en PNG pesaban 20 MB, en JPEG 1,9 MB.

### Texto que no debe salir en un fragmento de búsqueda

Google compone el fragmento de un resultado con el texto de la página **ya renderizada**, y eso
incluye los controles. Una ficha llegó a abrirse con "Cómo llegar Abre Google Maps en una pestaña
nueva" en lugar de con lo que dice el local. Lo que es de interfaz y no del local va dentro de un
elemento con `data-nosnippet` (Google solo lo reconoce en `span`, `div` y `section`, y pide que esté
puesto cuando el elemento se inserta, que es lo que hace React):

| Dónde | Qué excluye |
|---|---|
| `PlaceDetail`: el `div` de las salidas | "Cómo llegar", su ayuda para lectores de pantalla y el botón de compartir |
| `PlaceDetail`: la `section` personal | La calificación y el registro de visitas |
| `PlazaPanel`: un `span` alrededor del enlace | "Cómo llegar a la zona" (un `<a>` no admite el atributo; el `span` es `display: contents` y no genera caja) |
| `PlaceCard`: el estado oculto de cada tarjeta | "Abierto ahora: {nombre}", que repite el nombre |

Nombre, giros, zona, dirección y descripción **no** llevan el atributo: son lo que el local dice de sí
mismo. No cambia nada visible ni lo que lee un lector de pantalla. Que Google haga caso no está
garantizado y solo se ve en producción; lo que se puede comprobar aquí, y comprueba
`tests/e2e/fragmentos.spec.ts`, es que el atributo esté en lo que toca y en nada más.

### Datos estructurados

Cada ficha lleva un bloque JSON-LD (`scripts/build/structured-data.ts`) con lo mismo que ya dice la
página, pero en el vocabulario de schema.org: nombre, tipo de negocio, descripción, teléfono,
dirección, coordenadas, enlace de Maps y perfiles oficiales. La portada lista sus zonas y cada zona
lista sus locales, como `ItemList` con solo nombre y URL: los datos de cada destino los lee el
buscador de su propia página, y duplicarlos aquí solo abriría la puerta a que las dos copias
discrepen.

El tipo no es siempre `Restaurant`: sale de la categoría del primer giro, así que una panadería es
`Bakery` y un bar es `BarOrPub`. Cuando la categoría no identifica una forma concreta de negocio se
usa el padre común (`FoodEstablishment`), y "Otros" se queda en `LocalBusiness`, porque la guía va
más allá de la comida y ahí puede haber cualquier cosa. Mentir hacia abajo cuesta más que quedarse
en el tipo general.

Tres reglas, en orden de importancia:

1. **Nada que no esté en el dataset.** Sin `aggregateRating`, sin `priceRange` y sin `review`. Lo que
   se escribe aquí el buscador lo publica como hecho.
2. **Sin `openingHours`, a propósito.** El horario es el único dato de la ficha que se pudre solo, y
   un "Abierto ahora" equivocado manda a alguien a una puerta cerrada. Hoy los 101 locales llevan el
   mismo `lastVerifiedAt`, así que no hay forma de distinguir un horario fresco de uno rancio; en
   cuanto haya una segunda ronda de verificación, ese campo da el criterio y emitirlo es un filtro.
3. **Un campo que falta se omite**, no se rellena. Hoy eso deja 24 fichas sin teléfono, 13 sin
   coordenadas y 3 sin dirección, que son exactamente las que no tienen el dato.

La dirección de un local es la de su zona: no tiene una propia porque está dentro de una plaza. La
localidad, el estado y el país salen de `data/geographic/config.json`.

El `404.html` lo genera `vite.config.ts` con la marca del sitio, sin JavaScript y con el estilo en
línea: es la página que aparece cuando algo falla, así que no debe depender de que el resto cargue.
Ahí llegan los errores de tecleo y el enlace guardado de un local que ya no se publica. `vite preview`
responde un 404 vacío, así que un plugin lo hace servir este archivo y la suite E2E puede comprobar lo
que se ve de verdad.

## Visitas

`worker/` es el primer código de servidor del proyecto. Sirve los mismos archivos de `dist/` que
antes y, de paso, suma una visita. Lo que guarda es una fila por **día, ruta e idioma** con un
contador:

| fecha | ruta | idioma | cuenta |
|---|---|---|---|
| 2026-10-05 | /lugar/tomassa | es | 12 |

Eso es todo. No hay identificador, ni cookie, ni IP, ni user agent, ni referente: **no es que se
anonimice después, es que no se recoge**. El costo de esa decisión hay que saberlo: no se puede saber
cuántas personas distintas hubo, solo cuántas veces se abrió cada página. Para decidir qué locales
interesan alcanza, y a cambio no hay nada que prometer sobre el resto.

Tres decisiones que conviene no deshacer sin pensarlo:

1. **Se cuenta en el servidor, no en la página.** Cero bytes de JavaScript (el paquete inicial está a
   300 bytes de su límite), no lo bloquea un bloqueador de anuncios, funciona sin JavaScript, y es
   imposible que recoja algo de la persona porque nunca toca el navegador. A cambio hay que filtrar
   robots, que se hace por user agent en `worker/analitica.ts`.
2. **Es un `UPSERT`, no un registro por visita.** Con una fila por visita la tabla crece sin fin y hay
   que acordarse de purgarla; así se queda en cientos de filas al mes, y no existe ningún instante en
   el que la base haya guardado un evento individual.
3. **Contar jamás puede romper la página.** La respuesta se obtiene primero y se devuelve igual
   aunque la base no exista, esté caída o falle a mitad: el apunte va en `waitUntil`, fuera del camino
   de la respuesta, y envuelto en un `try`. Sin enlace a la base, el sitio sirve y no cuenta.

La lógica vive en `worker/analitica.ts`, que es pura y no sabe de plataforma: se prueba entera sin
levantar un Worker, y sus pruebas fijan sobre todo **lo que no debe contarse** (robots, 404, lo que no
es una página) y lo que no debe llegar a la base.

El Worker corre solo en las ocho rutas de página. Las teselas, las imágenes y los assets se sirven
sin pasar por él, que es lo que mantiene el costo en cero y evita contar un archivo como una visita.

## Las sugerencias

"Sugiere un cambio" es el único formulario de la guía, y desde la v4.18 su envío va a `POST
/api/sugerencia` (`worker/sugerencias.ts`), no a un servicio de terceros. El módulo es puro: lee el
cuerpo, recorta los textos a sus topes y devuelve `null` si no hay mensaje o si el sello no tiene
forma de sello. Las tres consultas (guardar, últimas cincuenta, cuántas sin atender) son constantes
del mismo archivo, parametrizadas, y se prueban sin levantar un Worker.

Guardar una sugerencia sí puede fallar a la vista, al contrario que contar una visita: la persona
necesita saber si su recado llegó. El endpoint responde 201 al guardar, 400 si no hay mensaje, 403
si falta la prueba de trabajo y 409 si el sello ya se usó, y el formulario dice lo que toca en cada
caso.

Se leen en el panel privado, que las enseña con su fecha y lleva la cuenta de las que faltan por
atender. No hay aviso por correo, y esa es la razón de que el panel las cuente.

## Los corazones (lo único que se publica)

Cuántas personas han guardado cada lugar. Es la única señal de la comunidad que sale a la vista, y
la decisión de que sea esa y no otra está razonada en [CUENTAS.md](CUENTAS.md): el corazón exige
intención, va uno por cuenta y a esta escala se lee bien, mientras que las visitas miden curiosidad y
se inflan recargando.

**Las dos reglas viven en el SQL, no en la interfaz**, para que no haya forma de pedirle al servidor
los números que decidió no publicar:

- **Umbral de cinco.** Por debajo no se devuelve nada. "1 persona lo guardó" es peor que el silencio
  para un local recién abierto, y con uno o dos delataría a quien lo guardó.
- **Edad mínima de diez minutos.** Los corazones de una cuenta recién creada no cuentan. Convierte un
  ataque instantáneo en uno que hay que sostener.

El gesto es **local e instantáneo**, como siempre: se escribe en `localStorage` y la interfaz responde
sin esperar a nadie. El aviso al servidor va detrás y nunca lo bloquea, porque lo que aporta es que
el corazón cuente para el número público, no que funcione. Sin red, sin cuenta o con el servidor
caído, los favoritos son los de siempre y el número sencillamente no aparece.

Las estrellas **no se muestran nunca**, y la forma de garantizarlo es que la interfaz no las reciba:
la fuente devuelve `rating: null` siempre. Sí alimentan el orden personal, donde la media de la
comunidad **solo puede subir, nunca bajar** (`rankPlaces.ts`): sin ese tope, tres votos
malintencionados hundirían a un negocio que no puede verlo ni rebatirlo.

## Rendimiento

- Chunk principal ~108 KB gzip; MapLibre (~284 KB gzip) en un chunk aparte que empieza a descargarse en
  paralelo a los datos. `npm run perf:budget` falla si el build supera el presupuesto acordado.
- Teselas sueltas: el navegador baja solo las que entran en pantalla (~200 KB en la vista inicial) y
  cada una se cachea por su cuenta. Hasta la v4.7.0 era un único archivo PMTiles leído por rangos HTTP;
  se soltó porque el hosting dejó de servir rangos (ver `scripts/build/map-tiles.ts`).
- Edificios con altura progresiva por zoom y un único estilo sin reconstrucciones: hover y selección usan
  feature-state.
- Imágenes AVIF/WebP con `srcset`, `loading="lazy"`, `aspect-ratio` y color de relleno.
- Búsqueda en memoria con consulta diferida (`useDeferredValue`) y caché de la última consulta.
- Un único reloj compartido actualiza el estado "abierto/cerrado" de todas las tarjetas.

### Escalabilidad

Medido con datasets sintéticos fuera de producción (300 y 500 locales en 30 plazas): validación y catálogo
por debajo de 3 ms, índice de búsqueda ~6 ms, latencia de tecleo ≤ 0,3 s y ~50 MB de heap. Nada en el
código supone el tamaño actual del dataset. Dos puntos a vigilar si la guía creciera mucho:

- la colocación de marcadores es O(n²) sobre las plazas visibles (cómoda hasta unas decenas);
- las listas no están virtualizadas: por encima de ~1 000 locales convendría virtualizar los resultados.

## Accesibilidad

HTML semántico (landmarks, encabezados), foco visible, botones con nombre accesible, marcadores y controles
del mapa operables con teclado, foco gestionado al abrir paneles, `prefers-reduced-motion` (sin animaciones
ni vuelos de cámara), axe sin violaciones graves o críticas en los tests E2E, y la información nunca depende
solo del color (conteos y textos acompañan al verde). Una sola región `aria-live` anuncia resultados y
avisos. Verificado además con NVDA real: ver [ACCESIBILIDAD.md](ACCESIBILIDAD.md).

## Seguridad y privacidad

No hay secretos ni tokens: todo lo publicado es público, con una CSP declarada en el propio HTML y sin
recursos de terceros. Los enlaces externos usan `rel="noopener noreferrer"`. Los favoritos, las calificaciones,
las fichas abiertas (para el orden personal), el idioma elegido y el tutorial usan almacenamiento local
del navegador; no hay analítica ni rastreo, y la ubicación solo se pide tras una
acción explícita y nunca se guarda ni se envía. Detalle en [SEGURIDAD.md](SEGURIDAD.md).
