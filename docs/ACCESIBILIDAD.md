# Accesibilidad

Objetivo: **WCAG 2.1 nivel AA**. Este documento dice qué se ha verificado, cómo, y qué queda fuera. No se
declara "conforme AA": una conformidad formal exige una evaluación completa criterio por criterio, y aquí
se ha hecho una verificación técnica y de uso, no una auditoría de conformidad.

## Qué se ha verificado

| Área | Cómo | Resultado |
| --- | --- | --- |
| Violaciones automáticas | axe-core en inicio, plaza y ficha, en 4 proyectos de Playwright | 0 graves o críticas |
| Teclado | E2E: primer `Tab` = "Ir al buscador"; `Escape` cierra ficha, panel y tutorial; foco devuelto al control de origen | Pasa |
| Lector de pantalla | **NVDA 2026.2 real** sobre el build de producción (Edge, Windows 11), 4 sesiones con registro de voz | Pasa, con 3 correcciones (abajo) |
| Movimiento | `prefers-reduced-motion`: cámara sin animación, transiciones a 0 | Pasa (E2E) |
| Zoom y tamaños | 9 tamaños de 320×568 a 1920×1080: sin desbordamiento ni solapes | Pasa (E2E) |
| Objetivos táctiles | Controles de 40–44 px; pastillas y tarjetas con área completa | Revisado en la auditoría |

## Estructura para lectores de pantalla

- Un `<h1>` visible solo para lectores ("Visit Zibatá · La guía de zibateños para zibateños"), `<h2>`
  por panel (plaza o lugar). Sobre el mapa la marca es solo el símbolo, así que ese `<h1>` es la
  única forma de oír el nombre: no se puede quitar.
- Regiones: `main`, `search`, la región del mapa (`Mapa 3D interactivo de Zibatá`) y el panel
  (`Información de lugares`, complementario).
- **Una sola región `aria-live`** en toda la interfaz, para los resultados y los avisos: al escribir se
  anuncia "19 resultados", y al perder la conexión, el aviso correspondiente.
- Cada marcador de plaza es un `button` con `aria-pressed` y nombre completo ("Ver Paseo Zibatá: 22
  lugares"); los grupos anuncian qué plazas contienen.
- Al abrir una plaza o una ficha, el foco pasa a su encabezado; al cerrar con teclado vuelve al control que
  la abrió (marcador, tarjeta o buscador).

## Correcciones que salieron de la sesión con NVDA

1. **Pastillas de categoría**: NVDA leía "Todo19" y "Desayunos y café12" (nombre y conteo pegados). Ahora
   cada pastilla tiene nombre accesible propio: "Todo, 76 lugares", "Desayunos y café, 12 lugares".
2. **Marca**: se leía "ZibatáCOMER Y BEBER"; ahora "Zibatá, Comer y beber".
3. **Controles de MapLibre**: la atribución se anunciaba en inglés ("Toggle attribution"); ahora en
   español ("Mostrar u ocultar la atribución"), igual que el resto de la interfaz.

La transcripción está en [release/evidencia/nvda-transcripcion.md](release/evidencia/nvda-transcripcion.md).

## Cómo repetir la prueba con NVDA

1. Copia portable de NVDA (`nvda_<versión>.exe --create-portable-silent --portable-path=<carpeta>`).
2. Configuración: sintetizador `silence` y registro a nivel entrada/salida.
3. `nvda.exe --minimal --no-sr-flag -c <config> -f <registro> -l 12`.
4. Abrir el build servido (p. ej. `npm run preview`) en Edge o Chrome y recorrer con teclado: `Tab`,
   `Entrar`, `Escape`, y la navegación rápida de NVDA (`h` encabezados, `b` botones).
5. Las líneas `Speaking [...]` del registro son la transcripción.

## Límites conocidos

- **Sin lectores distintos de NVDA**: no se ha probado VoiceOver (macOS/iOS), JAWS ni TalkBack.
- **El mapa 3D no es navegable por sí mismo con lector de pantalla**: se exponen los marcadores como
  botones y toda la información existe también en la lista de plazas y en los resultados, que es la vía
  accesible equivalente.
- **Contraste**: la paleta se diseñó con contraste AA para texto e iconos sobre sus fondos, y axe no
  reporta fallos, pero no se ha medido a mano cada combinación sobre el mapa (texto sobre cartografía).

  El contraste **no textual** (WCAG 1.4.11, las partes de un control) se mide aparte, porque axe no
  lo revisa: la vía del interruptor contra su perilla lo comprueba `tests/e2e/catalogo.spec.ts`. Es
  el caso que más importa de los tres, porque la posición de la perilla es lo único que dice si el
  filtro está puesto; con la arena clara que llevaba daba 1,66:1 y el control no comunicaba su
  estado. El resto de las partes de control no está medido a mano todavía.
- **Zoom de texto al 200 %** verificado por tamaños de viewport equivalentes, no con el zoom de texto del
  navegador.
- Un diálogo del navegador (permiso de ubicación) queda fuera del control de la guía.
