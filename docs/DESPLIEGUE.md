# Despliegue

El sitio es 100 % estático: `npm run build` produce `dist/` y cualquier servidor de archivos lo sirve. No
hay backend, base de datos, variables secretas ni servicios de pago.

Desde la v4.6.0 el build escribe **234 páginas HTML** (una por ruta y por idioma), `sitemap.xml`,
`robots.txt` y `404.html`. Los archivos son planos (`dist/lugar/tomassa.html`), no carpetas con
índice, para que `/lugar/tomassa` se sirva directo y no haya que redirigir a `/lugar/tomassa/`.

## Estado actual (2026-10-04)

Código en <https://github.com/aurariola-studio/visit-zibata>. Alojamiento: **Cloudflare**, Worker con
assets estáticos llamado `visit-zibata`, en `visitzibata.com`.

No es un proyecto de Pages: Cloudflare está integrando Pages dentro de Workers y los sitios estáticos
nuevos se crean así. Para el sitio no cambia nada (los mismos archivos de `dist/`, el mismo
`_headers`), solo el comando de publicación.

## Publicar en Cloudflare

Se compila y se publica desde GitHub Actions, **no con la integración de Git de Cloudflare**. Es una
decisión deliberada: esa integración compila por su cuenta y no corre las pruebas, así que publicaría
igual con el presupuesto de peso roto, con axe en rojo o con los tests de CSP fallando. Las puertas de
este repositorio solo sirven si nada se publica sin pasarlas.

Preparación, una sola vez:

1. El Worker `visit-zibata` debe quedar **sin integración de Git**, o publicará dos veces y una de
   ellas sin pasar las puertas.
2. Crea un token de API con la plantilla **Edit Cloudflare Workers** y anota el **Account ID**.
3. En GitHub → Settings → Secrets and variables → Actions:
   - secreto `CLOUDFLARE_API_TOKEN`
   - secreto `CLOUDFLARE_ACCOUNT_ID`
   - variable `PAGES_SITE_URL` (opcional; por omisión `https://visitzibata.com/`)

A partir de ahí, cada push a `main` ejecuta `.github/workflows/deploy.yml`: `npm ci` → Gitleaks →
validación de datos → lint, tipos y tests → build → imágenes de vista previa → presupuesto de
rendimiento → humo E2E → `wrangler deploy`, que sube `dist/` como assets del Worker (ver
`wrangler.jsonc`). Si cualquier paso falla, no se publica nada.

El E2E de aquí es un **humo** (un proyecto, una base, unos siete minutos) y no la suite entera: la
matriz completa, con los cuatro navegadores y las dos bases, la corre `ci.yml` en el pull request y
es la que bloquea la fusión. Repetirla al publicar añadía media hora sin cubrir nada nuevo, y llegó
a tumbar un despliegue por una prueba sensible al tiempo que ya había pasado dos veces. El humo no
sobra, en cambio: al fusionar con squash, el commit que llega a `main` es un commit nuevo que nunca
existió en el pull request, y esto comprueba el artefacto exacto que se va a publicar.

El paso de imágenes va **después** del build y no antes: el build limpia `dist/`, así que unas
imágenes generadas primero desaparecerían sin dejar rastro y cada enlace compartido volvería a
mostrar la imagen de la portada. Los navegadores de Playwright se instalan antes del build porque
la composición de esas imágenes también usa Chromium.

Las acciones están fijadas por SHA y `wrangler` está fijado en el lockfile (Dependabot las actualiza).

La búsqueda de secretos usa el **binario** de Gitleaks con la versión fijada, no `gitleaks-action`:
esa acción exige clave de licencia cuando el repositorio vive en una organización, y desde el
traslado a `aurariola-studio` vive en una. El binario es el mismo escáner, MIT y sin clave. Si algún
día se prefiere volver a la acción, hace falta una clave de gitleaks.io en el secreto
`GITLEAKS_LICENSE`.

### Cabeceras

`dist/_headers` lo genera el build (plugin `zibata-headers` en `vite.config.ts`) a partir de la misma
constante que el `<meta>` de la CSP, para que no puedan divergir. Añade lo que un `<meta>` no puede
declarar: `frame-ancestors`, `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy` y el
`Cache-Control` por tipo de archivo. El formato lo entienden tanto los Workers con assets estáticos
como Pages y Netlify.

### El 404

`wrangler.jsonc` fija `not_found_handling: "404-page"`: una ruta inexistente devuelve el `404.html`
que genera el build, no la portada. Sin eso, un *fallback* tipo SPA convertiría cualquier error de
tecleo en un 200 y Google indexaría basura. Desde que el enrutado salió del hash esto pasa de verdad:
ahí llegan los errores de tecleo en `/lugar/...` y el enlace guardado de un local que ya no se
publica. Hay pruebas E2E que lo comprueban en local, porque un plugin hace que `vite preview` sirva
ese archivo igual que el hosting; contra el sitio publicado conviene confirmarlo una vez con
`curl -I https://visitzibata.com/no-existe`.

## La base de visitas (D1)

Desde la v4.8.0 el Worker cuenta visitas. Preparación, **una sola vez**.

**1. Permiso en el token.** El token de la API de Cloudflare que vive en el secreto
`CLOUDFLARE_API_TOKEN` necesita `D1:Edit` además de `Workers Scripts:Edit`; sin él, `wrangler deploy`
falla al publicar un Worker con enlace a D1. En el panel de Cloudflare: icono de perfil (arriba a la
derecha) → **My Profile** → **API Tokens** → el token → **Edit** → añadir el permiso
**Account · D1 · Edit** → **Continue to summary** → **Update token**.

Editar un token **no cambia su valor**, así que el secreto de GitHub se queda como está. Si en vez de
editarlo se crea uno nuevo, hay que actualizar el secreto con `gh secret set CLOUDFLARE_API_TOKEN`.

**2. La base.** Hace falta estar identificado en Cloudflare desde esta máquina (`npx wrangler login`
abre el navegador; con `npx wrangler whoami` se comprueba).

```bash
npm run analitica:crear      # crea la base y devuelve su database_id
```

Pega ese `database_id` en `wrangler.jsonc`, donde dice `PENDIENTE`. **No es un secreto**: identifica
la base, no da acceso a ella, y por eso va versionado. Después, crea la tabla:

```bash
npm run analitica:esquema
```

Ese comando aplica `worker/esquema.sql` (visitas, comparticiones y sugerencias). Desde la v4.10.0 hay un segundo
archivo con las tablas de identidad y de lo que marca cada quien, que se aplica igual. Los dos usan
`CREATE TABLE IF NOT EXISTS`, así que volver a aplicarlos tras una actualización añade lo que falte
sin tocar lo que ya hay:

```bash
npx wrangler d1 execute visit-zibata-analitica --remote --file=worker/esquema-cuentas.sql
```

### Crear cuentas cuesta trabajo, y no hace falta configurar nada

Desde la v4.12 el alta de una cuenta exige una prueba de trabajo que el navegador calcula solo (ver
[CUENTAS.md](CUENTAS.md)). No hay claves, ni secretos, ni servicios externos que dar de alta: funciona
igual en desarrollo y en produccion.

Lo que si conviene anadir, porque es gratis y son tres minutos en el panel de Cloudflare, es una regla
de **Rate limiting** sobre el alta:

1. Panel de Cloudflare, dominio `visitzibata.com`.
2. **Security** -> **WAF** -> **Rate limiting rules** -> **Create rule**.
3. Condicion: **URI Path** equals `/api/cuenta`, y **Request Method** equals `POST`.
4. Contar por **IP**, 5 peticiones cada 10 segundos. Accion **Block**, 10 segundos.

Desde la v4.18 conviene una segunda regla igual para `/api/sugerencia`, el formulario de "Sugiere un
cambio", que tambien cuesta una prueba de trabajo. Ahi el limite puede ser mas estrecho, porque
nadie manda dos recados en diez segundos: contar por **IP**, 3 peticiones cada 60 segundos, accion
**Block** 60 segundos.

### Poner a cero las sugerencias sin leer

El panel solo lee, asi que el contador baja desde la linea de comandos. Se abre el panel, se leen
las nuevas, y despues:

```bash
npx wrangler d1 execute visit-zibata-analitica --remote   --command="UPDATE sugerencia SET atendida = 1 WHERE atendida = 0"
```

Las sugerencias siguen ahi: lo unico que cambia es el contador de "sin leer". Es deliberado que no
haya una casilla en el panel: seria la primera escritura que acepta, y leer recados no es algo que
pase diez veces al dia.

La IP la usa Cloudflare para contar y no llega nunca a este codigo ni a la base.

**Si vienes de la v4.11**, que llevaba Turnstile: borra el secreto con
`npx wrangler secret delete TURNSTILE_SECRET`, la variable con
`gh variable delete TURNSTILE_SITEKEY` y el widget desde el panel. Ya no los lee nadie.

El orden importa: la base tiene que existir **antes** del primer `wrangler deploy` con el enlace
puesto, o la publicacion falla.

### El panel privado

En `/panel` hay una página con los números: visitas por día, páginas más abiertas, enlaces
compartidos, lugares más guardados y cuántas notas tiene cada uno. No lleva inicio de sesión propio,
y ese es el punto: **la puerta la pone Cloudflare Access**, que es configuración y no código nuestro.

Sin esa regla puesta, el Worker responde 403 y la página lo dice con esas palabras. Falla cerrado a
propósito: si alguien borra la regla por error, el panel deja de funcionar en vez de quedar abierto.

Para ponerla, una sola vez:

1. Panel de Cloudflare, **Zero Trust** (se activa gratis la primera vez), **Access** ->
   **Applications** -> **Add an application** -> **Self-hosted**.
2. Nombre: `Panel de Visit Zibatá`. Dominio `visitzibata.com` con la ruta `panel`.
3. Añade un segundo dominio a la misma aplicación con la ruta `api/panel`. Hacen falta los dos: uno
   protege la página y el otro los datos.
4. Política: **Allow**, con **Include** -> **Emails** -> tu correo.
5. Guardar, y copiar la **Application Audience (AUD) Tag** que aparece en la aplicación.
6. Poner esos dos identificadores en `wrangler.jsonc`, en `vars`, y volver a publicar:

```jsonc
"vars": {
  "ACCESS_TEAM": "tu-equipo.cloudflareaccess.com",
  "ACCESS_AUD": "la-etiqueta-aud-de-la-aplicacion"
}
```

No son secretos (el dominio del equipo sale en la URL de inicio de sesión y la etiqueta AUD
identifica la aplicación, como un `client_id`), por eso van versionados. **Vacíos, el panel está
cerrado**: el Worker verifica la firma del testigo de Access contra el JWKS del equipo y comprueba
que el destinatario sea esa etiqueta, y sin los dos datos no puede, así que responde 403.

A partir de ahí, abrir `visitzibata.com/panel` pide identificarse una vez y deja una cookie; la
página y sus datos pasan por la misma puerta. El plan gratuito de Zero Trust cubre 50 personas.

En local no hay Access. El panel se abre con `npm run worker:dev`, que pasa `PANEL_ABIERTO`, y no
con `wrangler dev` a secas. Esa variable solo existe en ese comando: en producción no está, y la
salida ya no depende del nombre de host (ver `worker/acceso.ts`).

### Ver los números desde la terminal

```bash
npm run analitica:ver                 # las páginas más abiertas de los últimos 30 días
npm run analitica:ver -- --dias=7     # otra ventana
npm run analitica:ver -- --local      # la base de desarrollo, la que llena `wrangler dev`
```

```
  PÁGINA             IDIOMA  VISITAS
  -----------------  ------  -------
  /lugar/tomassa     es            3  ████████████████████████
  /en/place/tomassa  en            1  ████████

  5 visitas en 3 páginas  (es 80% · en 20%)
```

También se puede consultar desde el panel de Cloudflare, sin terminal: **Storage & Databases** →
**D1** → `visit-zibata-analitica` → pestaña **Console**, y escribir SQL ahí.

**No hay panel propio ni endpoint de lectura, a propósito.** Una página que mostrara estos números
habría que protegerla, y proteger algo es justo el trabajo que este proyecto no quiere tener. Los
números los mira quien tiene las llaves de Cloudflare.

**Si algo de esto falta, el sitio funciona igual.** `worker/index.ts` comprueba que el enlace exista
y, si no, sirve la página y no cuenta. Es deliberado: contar es lo accesorio.

### Qué cuesta

El Worker corre **solo en las ocho rutas de página** (`run_worker_first` en `wrangler.jsonc`), nunca
en las teselas, las imágenes ni los archivos de `assets/`. Con `true` en vez de esa lista, cada
archivo estático contaría como invocación facturada, y son cientos por visita.

Como la tabla guarda un contador por día y ruta en vez de una fila por visita, son unas pocas
escrituras por página y día, y la tabla se queda en cientos de filas al mes para siempre.

## Requisitos del hosting

- **Nada especial.** Las teselas del mapa se sirven sueltas, así que ya **no** hace falta que el
  servidor admita peticiones `Range`. Ese requisito estuvo vigente hasta la v4.7.0 y es lo que rompió
  el mapa al mudarse a un Worker con assets estáticos, que no hace byte serving.
- **Sin *fallback* SPA**: existe un archivo por ruta, así que un camino inexistente debe responder
  404 con el `404.html` del build, no la portada con un 200.
- **Archivos servidos sin barra final añadida**: `/lugar/tomassa` debe entregar `lugar/tomassa.html`
  tal cual. Un hosting que redirija a `/lugar/tomassa/` mete un salto en cada enlace compartido.
- Tipos MIME correctos para `.pmtiles` (`application/octet-stream`), `.webmanifest` y `.woff2`.
- Nada más: ni reescrituras, ni cabeceras especiales, ni certificados propios.

## Publicar en otro servidor

```bash
npm run build                      # dist/ para servir en la raíz del dominio
BASE_PATH=/subdirectorio/ npm run build
SITE_URL=https://mi-dominio/ npm run build   # canonical, hreflang, sitemap y Open Graph absolutos
npm run images:og-places                     # después del build: dist/og/<slug>.jpg
```

`SITE_URL` ya no es solo cosa de Open Graph: de ahí salen el `canonical` y las `hreflang` de las 234
páginas y las URLs del `sitemap.xml`. Sin ella el build funciona, pero esos enlaces quedan relativos
y el sitemap no sirve para enviarlo a un buscador.

En Git Bash (Windows), exporta `MSYS_NO_PATHCONV=1` antes de pasar rutas como `BASE_PATH`.

## Cabeceras en otros hostings

En Cloudflare Pages y Netlify no hay que hacer nada: el build genera `dist/_headers` (ver arriba). En
un hosting que no lea ese archivo (nginx, Apache, S3 con CloudFront), hay que trasladar su contenido a
la configuración del servidor. El `<meta>` de la CSP sigue viajando en el HTML, así que un hosting sin
cabeceras conserva la política; lo que se pierde sin ellas es `frame-ancestors`, que un `<meta>` no
puede declarar.

## Verificación local de una publicación

```bash
SITE_URL=https://visitzibata.com/ npm run build
npm run images:og-places                         # después del build, que limpia dist/
npm run preview -- --port 4173 --strictPort     # sirve dist/ igual que en producción
npm run test:e2e                                 # E2E contra ese build
npm run perf:budget                              # presupuesto de peso
```

`vite preview` sirve el `404.html` del sitio porque el plugin `zibata-404` se lo pide; por omisión
responde un 404 vacío y la prueba de esa página no valdría nada.

Para comprobar el prerenderizado sin abrir el navegador:

```bash
curl -I http://localhost:4173/lugar/tomassa      # 200, sin redirección
curl -I http://localhost:4173/en/place/tomassa   # 200
curl -I http://localhost:4173/lugar/inventado    # 404
grep -c "<url>" dist/sitemap.xml                 # 234
```

Para imitar un hosting en subruta (404 reales, 301 de directorios), este repositorio se probó
además con `BASE_PATH=/visit-zibata/` y un servidor estático estricto sobre `dist/`.

## Reversión

No hay migraciones ni estado: revertir es volver a publicar el commit anterior (`git revert` y push, o
re-ejecutar el workflow sobre la etiqueta previa). Los datos viven en el propio repositorio.
