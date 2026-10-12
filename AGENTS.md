# AGENTS.md

Guía para agentes y colaboradores. Contexto del producto y comandos en [README.md](README.md).

## Reglas del proyecto

- Sitio estático: nada de API keys ni dependencias de servicios de pago en runtime. Lo único que
  corre en el servidor es `worker/`, que sirve los archivos, cuenta visitas y comparticiones por
  página y día (sin cookies, sin IP, sin nada por persona) y guarda lo que marca cada quien bajo una
  cuenta anónima sin correo ni nombre. Si se cae, el sitio sigue: nada de eso puede romper la
  página, y hay pruebas que fijan lo que NO se guarda.
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

## Antes de terminar un cambio

```bash
npm run check          # lint + tipos + tests + build
npm run test:e2e       # si tocaste UI o mapa
```

## Toolset

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
