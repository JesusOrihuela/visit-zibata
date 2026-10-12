/// <reference types="vite/client" />

/** Versión de package.json, inyectada por Vite (ver vite.config.ts). */
declare const __APP_VERSION__: string

/** URL pública absoluta (SITE_URL al compilar); cadena vacía si no se pasó. */
declare const __SITE_URL__: string

interface ImportMetaEnv {
  /** "true" para incluir el modo depuración del mapa en un build de producción. */
  readonly VITE_ENABLE_MAP_DEBUG?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
