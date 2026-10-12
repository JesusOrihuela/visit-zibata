# Seguridad y privacidad

Todo lo que se publica es público: no hay servidor, sesión, base de datos ni secretos. La superficie de
ataque se reduce a lo que el navegador ejecuta y a los enlaces que ofrece la guía.

## Principios

- **Sin backend ni credenciales.** Ninguna API key, token ni servicio de pago, ni en el código ni en el
  build. `npm run build` no lee variables secretas.
- **Sin terceros en runtime.** No hay CDN, analítica, publicidad, mapas de terceros ni fuentes remotas:
  todas las peticiones van al propio origen. Un E2E comprueba que un recorrido completo no genera ni una
  petición externa.
- **Google Maps solo como enlace.** Nunca Google Places, ni scraping, ni descarga de fotos.
- **Sin datos personales.** No hay cuentas, formularios ni rastreo. Los favoritos, las
  calificaciones y el recuento de fichas abiertas (que solo sirve para ordenar sus listas) viven en
  `localStorage` del dispositivo y nunca salen de él.

## El panel privado

`/panel` es la única página del sitio que no es pública. La protege **Cloudflare Access** (ver
[DESPLIEGUE.md](DESPLIEGUE.md)), no código nuestro: aquí no hay inicio de sesión, ni contraseñas, ni
sesiones que mantener.

El Worker **verifica la firma** del testigo que Access inyecta en `Cf-Access-Jwt-Assertion`, contra
el JWKS del equipo y con RS256 a secas, y comprueba emisor, destinatario (`aud`) y vigencia. Sin
dependencias: `crypto.subtle` lo trae.

La primera versión solo miraba que la cabecera existiera, con el argumento de que un Worker vive
dentro de Cloudflare y Cloudflare borra las cabeceras `Cf-*` de fuera. El argumento tenía dos
agujeros y conviene dejarlos escritos, porque los dos son fáciles de reintroducir:

1. **Access solo intercepta las rutas que cubre su regla.** Si la aplicación cubre `/panel` pero no
   `/api/panel`, esa petición llega al Worker sin pasar por ninguna puerta y quien la hace escribe
   la cabecera él mismo.
2. **Un Worker se sirve también en `workers.dev`** salvo que se apague, y ahí la regla del dominio
   no existe. Está apagado con `workers_dev: false`, y eso también cierra la puerta de atrás al
   límite de peticiones del alta de cuentas, que está atado al dominio.

Falla cerrado en todos los casos: sin configuración, sin testigo, con uno que no verifica o con el
JWKS caído, la respuesta es 403. La única salida es `PANEL_ABIERTO`, que solo existe en desarrollo
(`npm run worker:dev`) y es una variable explicita, no un nombre de host.

La página lleva su propia CSP (`default-src 'self'`), `noindex, nofollow`, y no está en el sitemap.
Su estilo y su guión son archivos aparte justamente para no necesitar `'unsafe-inline'`.

## Content Security Policy

Se inyecta en el build como `<meta http-equiv="Content-Security-Policy">` (GitHub Pages no permite
cabeceras propias), solo en producción: el servidor de desarrollo necesita estilos en línea para HMR.

```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:;
font-src 'self'; connect-src 'self' https://api.web3forms.com; worker-src 'self' blob:; child-src 'self' blob:;
manifest-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'self'
```

- **`style-src` admite una huella**, `'sha256-…'`, y es la del bloque de estilo en línea de la
  página 404. No es `'unsafe-inline'`: permite ese bloque exacto y ningún otro, y la calcula el
  build desde el mismo módulo que escribe la página, así que no se pueden separar.

  Tiene que estar en la política del sitio aunque la 404 lleve la suya: **cuando hay dos políticas,
  el navegador aplica las dos**. Hasta la v4.16.1 la cabecera decía `style-src 'self'` y la página
  decía `'unsafe-inline'`, así que la intersección las prohíbe y la 404 salió publicada sin una sola
  regla aplicada. No lo vio nadie porque `vite preview` no sirve `_headers`: en local solo existía
  el `<meta>` permisivo. Lo fija ahora `scripts/build/pagina-404.test.ts`.
- **Ni un script de terceros.** En la v4.11 hubo aquí un hueco para `challenges.cloudflare.com`, el
  desafío de Turnstile que se pedía al crear una cuenta, y `frame-src` dejó de ser `'none'`. En la
  v4.12 esa pieza se sustituyó por una prueba de trabajo que se calcula en el propio navegador con
  `crypto.subtle` (ver `src/lib/prueba-de-trabajo.ts` y [CUENTAS.md](CUENTAS.md)), así que la
  política volvió a cerrarse. El motivo del cambio no fue la política sino que Turnstile dejaba fuera
  en silencio a quien usa Tor o un bloqueador duro; cerrar la CSP fue el premio.

- `connect-src` abre un único destino externo, **api.web3forms.com**, y solo se usa al pulsar "Enviar"
  en "Sugiere un cambio". Navegar por la guía no hace ninguna petición fuera del propio origen. El
  correo de destino no viaja en el código: vive en Web3Forms, atado a la clave pública del formulario.
  La clave se pasa en `VITE_WEB3FORMS_KEY` (ver `.env.example`), no está en el repositorio y, como
  cualquier variable `VITE_*`, Vite la incrusta en el JavaScript publicado: es una clave de cliente,
  pública por diseño, y lo que la protege es la lista de dominios permitidos en el panel de Web3Forms
  más el campo trampa del formulario. Sin clave, el formulario no se dibuja.
- `blob:` en imágenes y workers lo usa MapLibre internamente; `data:` lo usan iconos embebidos.
- `frame-ancestors` **no** puede declararse en `<meta>`: si el hosting admite cabeceras, añade
  `Frame-Ancestors: 'none'` o `X-Frame-Options: DENY` (ver [DESPLIEGUE.md](DESPLIEGUE.md)).
- Verificación: un E2E recorre inicio → plaza → ficha → búsqueda y exige **0 violaciones de CSP y 0
  peticiones externas** en los cuatro proyectos; un control negativo confirma que la política sí bloquea
  estilos en línea y `fetch` a dominios externos, tanto en Chromium como en WebKit.

## Enlaces y datos de entrada

- Los enlaces externos son `https`, se abren con `target="_blank"` y `rel="noopener noreferrer"`, y un E2E
  lo comprueba en la ficha.
- El esquema de datos rechaza `javascript:`, `data:` y rutas absolutas en enlaces y fotos. La misma regla
  se aplica al cargar los datos en el navegador (`src/data/rules.ts`), así que un archivo publicado sin
  pasar por el build tampoco puede colar un enlace peligroso: el registro se descarta con un aviso.
- El estado de la URL (`/zona/...`, `?categoria=...`) se valida contra una expresión de slug antes de
  usarse, también en el árbol inglés y al traducir un enlace antiguo con hash. Un camino que no
  corresponde a ninguna página la responde el 404 del sitio, así que nada inventado llega a la
  aplicación; si aun así llegara (una plaza despublicada entre dos despliegues), se muestra un aviso
  y se limpia la URL para no compartirla.
- React escapa el contenido; no se usa `dangerouslySetInnerHTML` en ninguna parte.

## El conteo de visitas

Desde la v4.8.0 hay código de servidor (`worker/`), y conviene decir qué cambia y qué no.

**No cambia** la promesa de que navegar no genera peticiones a terceros: el conteo ocurre en el mismo
origen que sirve la página, así que no sale nada hacia fuera y la prueba E2E que lo comprueba sigue
en pie. Tampoco cambia la CSP: no hubo que abrir nada.

**Sí cambia** que ahora existe una base de datos. Su superficie es deliberadamente mínima: el Worker
solo escribe, con una única consulta parametrizada y fija (`worker/analitica.ts`), y no hay ningún
camino por el que una petición pueda leer de ella ni alterar su forma. No hay endpoint de lectura: los
números se consultan con `wrangler` desde la máquina del propietario.

Lo que se guarda es un contador por día y ruta. Aunque alguien se hiciera con la base entera, no
encontraría a nadie: no hay identificadores, ni IP, ni user agent, ni referente.

## Geolocalización

El botón "Mi ubicación" pide permiso **solo tras una acción explícita** del usuario. La posición se usa
para centrar el mapa en memoria: no se almacena, no se envía a ningún servidor y no queda en la URL. Si el
permiso se deniega, se muestra un aviso y la guía sigue igual de usable.

## Dependencias y supervisión

- `npm audit` sin vulnerabilidades (0 en dependencias de producción y de desarrollo).
- Dependabot semanal para npm y mensual para las acciones de GitHub (fijadas por SHA).
- Gitleaks en cada pull request; además se hizo una búsqueda local de secretos sobre todo el árbol de
  trabajo antes de la versión 1.0.0.

## Qué queda fuera

- Cabeceras que dependen del hosting (`frame-ancestors`, HSTS, `Referrer-Policy`): no se pueden fijar
  desde un sitio estático en GitHub Pages.
- No hay prueba de penetración externa ni análisis dinámico: la aplicación no tiene servidor propio que
  atacar, pero tampoco se ha auditado el hosting de terceros.
- La CSP no puede proteger de un compromiso del propio repositorio o del hosting: cualquiera con acceso de
  escritura publica lo que quiera.
