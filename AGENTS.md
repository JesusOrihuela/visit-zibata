# AGENTS.md

Guía para agentes y colaboradores. Contexto del producto y comandos en [README.md](README.md).

## Reglas del proyecto

- Sitio estático: nada de API keys ni dependencias de servicios externos en runtime, y la CSP lo
  fija (`connect-src 'self'`, sin un solo destino fuera). Lo único que corre en el servidor es
  `worker/`, que sirve los archivos, cuenta visitas y comparticiones por página y día (sin cookies,
  sin IP, sin nada por persona), guarda lo que marca cada quien bajo una cuenta anónima sin correo ni
  nombre, y recibe las sugerencias de "Sugiere un cambio" (lo que la persona escribió, sin colgar de
  ninguna cuenta). Si se cae, el sitio sigue: nada de eso puede romper la página, y hay pruebas que
  fijan lo que NO se guarda.
- El mapa es MapLibre con datos propios (`public/map`). Google Maps solo como enlace externo; nunca Google
  Places, scraping ni descarga de fotos de terceros.
- No inventar datos de negocios reales (horarios, teléfonos, descripciones, fotos). Sin publicidad,
  reservas ni rastreo, nunca.
- Sin reseñas ni notas públicas, y **la guía nunca publica una media**. Lo único de la comunidad
  que se ve es el conteo de corazones, y solo a partir de cinco. Las estrellas alimentan el orden,
  pero el servidor manda un empuje ya calculado y la media no llega al navegador: no es que la
  interfaz decida no enseñarla, es que no la recibe (ver [docs/CUENTAS.md](docs/CUENTAS.md)).
- Datos en `data/`, validados con los esquemas de `src/data/schemas.ts`. Textos de UI en `src/i18n/es.ts`.
- Procesamiento GIS solo en `scripts/map` (Node), nunca en el navegador.
- Imports relativos con extensión `.ts`/`.tsx` (los scripts corren con Node sin transpilar).

## Cómo se escribe aquí

- Nada de guion largo (—) ni de comillas angulares (" "): delatan texto generado. Con coma, punto,
  paréntesis o comillas dobles rectas alcanza.
- Vale para todo: textos de interfaz, comentarios del código, documentación, datos y mensajes de
  commit.

## Autoría

- **Nunca firmar nada a nombre de una herramienta.** Ni `Co-Authored-By` de un asistente, ni líneas
  de "generado con", ni en mensajes de commit, ni en descripciones de pull request, ni en issues. El
  proyecto lo firma una persona. Si tu configuración añade esa línea por omisión, quítala antes de
  commitear.

## Diseño

El sistema vive en [DESIGN.md](DESIGN.md): los tokens con su porqué, las reglas con nombre y lo que
el build carga como defecto sin que sea regla. La fuente de verdad de los valores sigue siendo
`src/styles/tokens.css`.

**La fuente única es [docs/CATALOGO.md](docs/CATALOGO.md)**: el catálogo de interfaz. Tres reglas,
y las tres dicen lo mismo de tres maneras (lo que decide es la función, nunca el sitio):

- **la forma** la decide el tipo de acción, en cinco familias;
- **el tamaño de letra**, el papel del texto, en nueve escalones;
- **la esquina de una superficie**, dónde está apoyada.

Están ahí también el color, los hovers, los estados y las 75 piezas una por una. Los valores viven
en `src/styles/controls.module.css` y `src/styles/tokens.css`. Un módulo no vuelve a dibujar un
botón: lo compone.

```css
.enviar {
  composes: base boton principal from "../../styles/controls.module.css";
}
```

Antes de añadir nada, mirar de qué familia es. Si no es de ninguna, se escribe por
qué en el catálogo; lo que no vale es inventarle una forma. `node scripts/inventario-interactuables.mjs`
lista todas y `tests/e2e/catalogo.spec.ts` fija las reglas.

Cinco herramientas y un hueco cada una, para que no se pisen:

| Capa | Herramienta | Cuándo |
|---|---|---|
| Formas, letra y superficies | [docs/CATALOGO.md](docs/CATALOGO.md) + `inventario-interactuables.mjs` | antes de añadir cualquier pieza |
| Conformidad, automática | `impeccable` (hook en cada edición, y `detect <url>`) | sola |
| Estructura y tipografía | `/hallmark audit` | antes de un cambio grande de UI |
| Movimiento | `review-animations` | si tocas una transición |
| Datos del peor caso | `break-ui` | al cerrar un componente |
| Catálogo de tells | `antislop-ui` | mientras se diseña, para consultar |

El hook solo salta con Edit y Write: si editas por script, corre el detector a mano. Las reglas
apagadas y su evidencia están en DESIGN.md; no se apaga una regla para que el contador baje.

## Antes de terminar un cambio

```bash
npm run check                                 # lint + tipos + tests + build
npx playwright test <spec> --project=desktop  # mientras iteras: un spec, un proyecto
node scripts/inventario-interactuables.mjs    # si añadiste algo que se pulse
npm run test:e2e                              # la matriz entera, UNA vez antes de cerrar
```

La matriz completa son cuatro proyectos y unos diez minutos. Mientras iteras no aporta nada que no
dé el spec que estás tocando en escritorio; déjala para el final. Una sesión de este repositorio
llegó a correrla diez veces, y nueve sobraban.

El inventario tiene que terminar diciendo *"Todas componen una familia del catálogo"*. Si nombra
alguna, o entra en una familia de [docs/CATALOGO.md](docs/CATALOGO.md) o se escribe ahí por qué no
entra en ninguna.

## Modelos

Sonnet ejecuta, Opus asesora, Haiku acarrea. Está en el ajuste global, así que no hace falta nada
por proyecto; el porqué y los avisos, en `~/.claude/QUALITY-STACK.md` § Models.

**Aquí se consulta al asesor antes de** proponer o aprobar un cambio de diseño, tocar una regla de
[docs/CATALOGO.md](docs/CATALOGO.md), o dar por terminado un cambio. En este repositorio los fallos
caros no han sido de código sino de juicio: una recomendación de diseño sin respaldo que hubo que
retirar, una prueba que medía la propiedad equivocada y daba verde con el defecto puesto, una
expresión regular que se comió 237 líneas. Ninguna puerta automática atrapa eso.

**Si un diseño se rechaza dos veces en una sesión**, eso es la señal para poner `"model": "opus"` en
`.claude/settings.json` de este proyecto, en vez de seguir intentando con el mismo.

## Toolset

- modelos: Sonnet ejecutor + Opus asesor + Haiku acarreo (ver arriba)
- delegation: on
- lean-code: on
- verify-loop: on
- rtk: on
- codegraph: off
- worktrees: off
- spec-kit / bmad / superpowers: off
- precommit-hooks: off
- lint-format: on (Biome)
- security-scan: on (Gitleaks en CI)
- ci-cd: on (GitHub Actions → Cloudflare Workers)
- a11y-perf: on (axe en E2E)
- dep-updates: on (Dependabot)
