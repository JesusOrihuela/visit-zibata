# Propuesta de identidad: Visit Zibatá

Fecha: 2026-09-29 · Estado: **nombre y marca implementados en la v4.0.0**

El producto se llama Visit Zibatá y tiene símbolo propio. El dominio y el SEO sin hash ya están
hechos (§6); lo que queda abierto es el uso del topónimo, que está más abajo.

## 1. Nombre

**Visit Zibatá** (dominio `visitzibata.com`, disponible). Decidido e implementado: `app.name` en los
dos idiomas, `<title>`, Open Graph y manifiesto PWA.

A favor:

- El patrón `visit<lugar>` lo entiende cualquiera: es el lenguaje de las oficinas de turismo
  (visitmexico.com, visitportugal.com, visitoslo.com). Comunica "guía oficial de un lugar" sin
  explicar nada.
- Funciona en español y en inglés sin traducirse, que importa porque la guía ya es bilingüe.
- Escala: si mañana entran compras, servicios o eventos, el nombre no se queda corto. Por la misma
  razón, el descriptor dejó de ser "Comer y beber" en la v4.4.0: acotaba el proyecto a lo que hoy
  contiene en vez de a lo que quiere ser.
- El dominio está libre y es corto.

En contra, a decidir con los ojos abiertos:

- **"Zibatá" es el nombre de un desarrollo inmobiliario privado.** Ese patrón de nombre funciona para
  ciudades y países, donde nadie es dueño del topónimo. Antes de registrar dominio y redes conviene
  revisar si el nombre está registrado como marca y, si se puede, hablar con el desarrollador: una
  guía independiente que usa su nombre puede leerse como oficial. Alternativas si hubiera fricción:
  **Guía Zibatá**, **Zibatá Local**, **Antojo Zibatá** (más específico de comida) o un nombre propio
  que no dependa del topónimo (**Cañada**, por las cañadas arboladas del fraccionamiento).
- "Visit" sugiere turismo, y la mayoría de quienes usan la guía **viven** ahí. Se compensa con el
  descriptor: *Visit Zibatá · Qué comer, dónde y cuándo*.

Arquitectura de nombre propuesta:

| Elemento | Texto |
|---|---|
| Marca | Visit Zibatá |
| Descriptor (es) | La guía de zibateños para zibateños |
| Descriptor (en) | By locals, for locals |
| Nombre en la app (PWA) | Visit Zibatá |
| Voz | Directa, sin superlativos ni "el mejor". Nunca opina de un negocio; describe. |

## 2. Símbolo

**Una brújula cuya aguja es la letra Z.** Dice las dos cosas a la vez y con el mismo peso: la Z de
Zibatá, y que esto es una guía.

### Cómo está construido

Se dibuja una sola mitad, de la punta al centro, y la otra es esa misma **girada 180 grados**.
Encajan exactas sin ajuste porque el punto medio de la diagonal de una Z es su centro. El grosor
nace en cero en las dos puntas y crece hasta el centro, así que la pieza entera es a la vez la aguja
de una brújula y la letra, y el punto donde cambia de color es el pivote. El aro y la rosa repiten el
olivo de la mitad de arriba: nada se lee como un objeto pegado encima del otro.

El contorno **no** se genera desplazando una línea central a los dos lados por igual. Ese método
falla en los codos de una Z: por fuera no puede cerrar más apretado que el propio grosor (sale media
luna) y por dentro las dos orillas se cruzan, el lazo se recorre al revés y el relleno lo cancela
(queda una grieta donde debía haber esquina). Cada tramo se desplaza por su cuenta y se juntan en la
esquina, con inglete por dentro y una vuelta de tensión regulada por fuera, que es como se construye
una letra.

El color se parte en **horizontal**, con hueco. Como la diagonal queda a 22 grados de la horizontal,
el corte la atraviesa muy oblicuo y el hueco se lee como una franja larga; perpendicular al trazo
mide cerca del 15 % de su grosor.

### Los dos cortes

| Archivo | Cuándo | Qué cambia |
|---|---|---|
| `public/logo.svg` | 40 px o más | Trazo 19, aro 11, hueco 12 |
| `public/simbolo.svg` | menos de 40 px | Trazo, aro y puntas más gordos, hueco 8 |

`public/favicon.svg` no es un tercer corte: es el corte chico ya montado sobre su baldosa, y lo
genera `npm run images:icons`. No se edita a mano.

Es la misma relación que hay entre el corte de titular y el de texto de una tipografía: con el corte
grande, a 16 px el hueco se come la diagonal y la Z se parte en dos piezas sueltas. Aun con el corte
chico, a 16 px la letra es más una insinuación que una letra: es el límite de meter una letra dentro
de un aro, y se acepta a sabiendas.

### Reglas de uso

- **Colores**: olivo `#536C2A` el aro, la rosa y la mitad de arriba; lima `#8CBA37` la mitad de
  abajo. Sobre fondo oscuro, la parte olivo pasa a papel `#F7F4ED`. En los iconos de aplicación, que
  van sobre olivo, la mitad de abajo usa el lima claro `#B8D77C`: el lima de marca queda demasiado
  cerca del olivo del fondo y la aguja pierde sus dos mitades.
- **Zona de respeto**: el largo de la punta del norte por los cuatro lados.
- **Tamaño mínimo**: 16 px, con el corte chico.
- **No**: deformar, girar (la inclinación ya está en el dibujo), recolorear fuera de la paleta,
  ponerle sombra (el aro es calado y se cuela por el centro) ni meterlo en una baldosa redondeada,
  salvo en los iconos de aplicación y en el favicon de la pestaña.
- **El favicon va sobre baldosa olivo** por la misma razón que los iconos de aplicación, más una
  propia: el símbolo suelto es olivo oscuro y en una pestaña en modo oscuro se pierde contra el
  fondo. Con baldosa se lee igual en los dos modos y deja de depender del tema de quien mira. La
  esquina va algo más redondeada que en los iconos de aplicación (56 de 256 frente a 48), porque a
  16 px una esquina de 48 se lee casi cuadrada, y el símbolo al 78 % en vez del 84 %, porque aquí no
  hay máscara del sistema que se coma el borde pero al 84 % el aro toca la curva.
- **Una sola fuente por corte**: `public/logo.svg` y `public/simbolo.svg`. De ahí salen los cinco PNG
  de icono y el favicon (`npm run images:icons`) y el símbolo de la imagen social (`npm run
  images:og`). El símbolo no se copia a
  mano en ningún otro sitio.
- **Entra por `<img>`, no en línea**: en línea suma cerca de 3 KB gzip y el paquete inicial está en
  119,8 de 120 KB de presupuesto.

### Firma de autoría

El lockup oficial de aurariola.com (símbolo, "un proyecto de" y wordmark) en la franja inferior y
en "Acerca de esta guía", con Kode Mono y el punto en oro. Del sello de aurariola se toma solo eso; el anillo de píxeles se queda fuera para no competir
con la marca de la guía. El oro de esa marca (`#b7791f`) se queda en 3,3:1 sobre las superficies
arena y no llega al 4,5:1 que pide un texto de 11 px, así que se usa el mismo oro oscurecido hasta
5:1 (`--gold-700`).

### Qué se descartó por el camino

El símbolo anterior (volumen isométrico dentro de una baldosa) decía "plaza" pero no decía ni el
lugar ni que esto fuera una guía. Antes de la brújula se probaron y se rechazaron: un pin con una
cañada dentro (demasiado liso y demasiado genérico), un sello con el paisaje (leía a club campestre,
no a guía) y varias Z sueltas dentro de un aro (el aro y la letra se leían como dos objetos
apilados, no como una pieza).

## 3. Paleta

Se conserva la base actual y se completa con los tonos que el mapa ya usa, para que producto y marca
hablen igual:

| Rol | Color | Uso |
|---|---|---|
| Olivo | `#536C2A` | Acción principal, marca, estados activos |
| Lima | `#8CBA37` | Acentos, confirmaciones, insignias |
| Arena | `#D1C3B0` | Superficies cálidas, bordes, el suelo del mapa |
| Crema | `#FCFAF6` | Fondo de tarjetas y hojas |
| Tinta | `#1F2419` | Texto principal |
| Cañada | `#93AD6B` | Arbolado del mapa, ilustraciones |
| Agua | `#B2CDC8` | Cuerpos de agua, información neutra |

Reglas: un solo acento por pantalla; el color de plaza (generado en HSL) nunca compite con el olivo de
marca; contraste mínimo AA 4.5:1 para texto y 3:1 para iconos (ya se cumple y hay pruebas que lo
verifican).

## 4. Tipografía

- **Instrument Sans** se queda para interfaz y datos; 600 para etiquetas en versalitas, 500 para cuerpo.
  Números con `tabular-nums` en horarios y conteos (ya aplicado).
- **Instrument Serif se sustituye en los títulos** (ronda 2): tiene el ojo pequeño y el interletraje muy
  cerrado, así que "Explora Zibatá" sale apretado y más solemne de lo que la guía quiere sonar.
  - **Fraunces 600: adoptada el 2026-09-23.** Serif cálida, de ojo grande, pensada para titulares; se lee
    grande sin ponerse formal y mantiene el aire editorial. Ya es `--font-display` en la guía
    (autoalojada con `@fontsource/fraunces`, solo el peso 600). Los rótulos del mapa siguen en Instrument
    Serif: sus glifos se generan aparte, en el pipeline de teselas.
  - **Alternativa: Bricolage Grotesque 700**: sin serifas, más urbana y joven; se aleja del tono "guía
    de lugar".
  - Cambiarlo toca un solo token (`--font-display`) y ninguna de las dos pesa más que la actual. Ambas
    se autoalojan con `@fontsource`, sin pedir nada a Google en tiempo de ejecución.

## 5. Iconografía

- Base **Lucide** (trazo 2 px, esquinas redondeadas) más siete iconos propios dibujados con la misma
  geometría: taco, tortilla, torta, baguette, sushi, palillos, gofre y cafetera de filtro.
- Regla: **un icono por giro, no por categoría** (ya implementado) y ninguno decorativo: si un icono no
  ayuda a distinguir, no va.
- Pendiente para la identidad: un set de 3–4 ilustraciones de cabecera (cañada, plaza, mesa) para
  "Acerca de", redes y la imagen para compartir.

## 6. SEO y presencia

Hecho, por orden en que se fue resolviendo:

1. **`<title>` y descripción por idioma**, Open Graph con imagen propia, CSP estricta, sitio estático
   y rápido, y `<html lang>` que cambia con el idioma.
2. **Dominio propio con HTTPS**, `visitzibata.com` en Cloudflare, servido por un Worker con assets
   estáticos y con `www` redirigido (ver [DESPLIEGUE.md](DESPLIEGUE.md)).
3. **Rutas legibles** para compartir e indexar, con un árbol por idioma: `/lugar/el-hornero` y
   `/en/place/el-hornero`, `/zona/paseo-zibata` y `/en/area/paseo-zibata`. Llevan la palabra que se
   ve en pantalla, no la del código: la URL se comparte y se dicta, así que es interfaz. El hash se quedó en el camino porque lo que va después de `#` nunca llega
   al servidor, así que ningún rastreador veía más que la portada.
4. **Una página real por ruta**: 234 archivos HTML generados en el build desde el dataset, cada uno
   con su `<title>`, su `description` y su `canonical`.
5. **`hreflang`** `es`, `en` y `x-default` entre las dos versiones de cada página, con el español
   como `x-default`.
6. **`sitemap.xml` y `robots.txt`** generados en el build con los dos árboles.
7. **Imagen de vista previa por local**, compuesta al publicar. Mientras ningún local tenga foto usa
   el tono de su categoría; cuando haya fotos, las toma sin tocar código.
8. **404 propio** con la marca del sitio, que es lo que ve quien escribe mal un enlace o guarda el de
   un local que ya no se publica.

9. **Datos estructurados**: `ItemList` en la portada y en cada zona, y el negocio por ficha con el
   tipo que le toca (`Bakery`, `BarOrPub`, `CafeOrCoffeeShop`…). Solo con datos verificados, sin
   `aggregateRating` ni `priceRange`, y **sin horario** hasta que una segunda ronda de verificación
   permita distinguir un dato fresco de uno rancio.

Lo que falta:

- Fichas de la propia guía en Google Business y redes con el mismo nombre y logo.

### Imágenes de la ficha pública

`npm run images:marca` genera dos que no son del sitio sino de su presencia en GitHub, y por eso
viven en `docs/img/` y no en `public/`:

| Archivo | Para qué | Dónde se sube |
|---|---|---|
| `social-preview.png` (1280×640) | La tarjeta del repositorio al compartir su enlace | Repositorio → Settings → General → Social preview |
| `aurariola-oscuro.png` (512×512) | El símbolo de aurariola.com | Perfil de la organización |

Se componen desde la misma fuente que el resto de la marca (el símbolo de `public/logo.svg` y la
rejilla de `AurariolaMark.tsx`), así que si la marca cambia se regeneran en vez de retocarlas a mano.
Subirlas es manual: GitHub no las toma del repositorio.
- El horario en los datos estructurados, cuando haya esa segunda verificación.

Palabras clave reales por las que buscaría alguien: "dónde comer en Zibatá", "restaurantes Zibatá",
"plazas Zibatá", "qué abre hoy en Zibatá", "desayunos Zibatá". La página principal debería responder
literalmente a la primera.

## 7. Qué implica implementarlo

| Ámbito | Trabajo |
|---|---|
| Producto | Hecho en la v4.0.0: nombre en `index.html`, manifiesto PWA, `app.name`, Brand, iconos y OG |
| Diseño | Hecho: símbolo en SVG en dos cortes, favicon, iconos "any" y "maskable", apple-touch. Faltan las ilustraciones |
| Datos | Ninguno: la identidad no toca el dataset |
| Dominio | Hecho: `visitzibata.com` en Cloudflare, HTTPS, `www` redirigido |
| SEO | Hecho: rutas sin hash, página por ruta, hreflang, sitemap, imagen por local, 404 propio y datos estructurados |
| Riesgo | Revisar el uso del topónimo antes de registrar marca o dominio |

Estimación: la parte de producto y diseño fue una tarde larga; las rutas sin hash y el prerenderizado,
un par de días con pruebas; los datos estructurados, una tarde. Del bloque de SEO solo queda el
horario, y no depende de código sino de volver a verificar los datos.

## 8. Recomendación

1. **Sigue abierta la pregunta del topónimo**, y es lo único con riesgo real. El nombre y el símbolo
   ya están en la app, pero antes de registrar marca o dominio conviene revisar si "Zibatá" está
   registrado y, si se puede, hablar con el desarrollador. Mientras tanto, la guía publica la leyenda
   de independencia en la franja inferior: "Guía independiente de establecimientos y servicios de la
   zona", que es la protección práctica frente a un nombre todavía sin registrar.
2. Hecho: `visitzibata.com` registrado en Cloudflare y servido por un Worker con assets estáticos.
3. Hecho también las rutas sin hash, la página por ruta y los datos estructurados, que es lo que de
   verdad mueve el SEO. El teléfono entra (77 de 101 verificados, y un número viejo es una llamada
   perdida); el horario no, porque un "Abierto ahora" equivocado manda a alguien a una puerta
   cerrada. Entra cuando una segunda ronda de verificación permita distinguir el dato fresco.
