/**
 * Paleta cartográfica. Deriva de la identidad (#D1C3B0 arena, #536C2A olivo, #8CBA37 lima):
 * suelo cálido tipo maqueta, verdes suaves que no compiten con las plazas y plazas en verde de marca.
 */
export const mapTheme = {
  groundOutside: '#e2d9c9',
  groundZibata: '#eee6d9',
  outsideVeil: '#e2d9c9',
  boundaryEdge: '#cdbfa7',

  landuse: {
    residential: '#ebe3d5',
    commercial: '#ece2d1',
    education: '#eae2d4',
    park: '#d8e3c1',
    grass: '#dfe7cc',
    wood: '#ccd8b0',
    farmland: '#ece6d6',
    golf: '#cadaa8',
    pitch: '#d3e1b8',
    pitchOutline: '#f8f5ee',
  },

  water: '#b2cdc8',
  waterOutline: '#9dbfb9',

  road: {
    highway: '#fffdf8',
    highwayCasing: '#d3c6b1',
    major: '#fffefb',
    majorCasing: '#dccfbb',
    street: '#fffdf9',
    streetCasing: '#e4d9c8',
    service: '#fbf8f2',
    path: '#d8cab3',
  },

  building: {
    residential: '#fbf8f2',
    commercial: '#f5efe4',
    education: '#f4efe6',
    other: '#f7f2e9',
    outside: '#e9e1d4',
  },

  /**
   * Copas de árbol: verdes de la familia olivo/lima, apagados como el resto de la maqueta para no
   * competir con las plazas. Los árboles bajos van más claros; los altos, más profundos.
   */
  tree: {
    low: '#bccf9c',
    high: '#93ad6b',
    trunk: '#b9a88f',
  },

  /**
   * El color propio de cada plaza vive en `src/config/palette.ts` (lo comparten mapa y paneles); aquí
   * solo quedan los estados que no dependen de la plaza.
   */
  plaza: {
    /** Plaza sin resultados con los filtros puestos. */
    buildingDimmed: '#dfe3d3',
    /** Plaza sin lugares publicados: presente en la maqueta, pero sin identidad propia. */
    inactiveBuilding: '#e6dccb',
  },

  label: {
    /*
     * Gris para la calle, gris apagado para el área (residencial, escuela, hito), verde para el parque
     * y el golf, y azul para el agua. Son los cuatro papeles del estándar de rótulos: uno dice cómo se
     * llama la vía, otro cómo se llama el área, y los dos últimos, qué hay.
     */
    road: '#7d7361',
    district: '#9c917d',
    green: '#5b6f3b',
    water: '#3f6c8a',
    halo: '#f7f2ea',
  },

  sky: {
    sky: '#ede5d8',
    horizon: '#f6f1e8',
    fog: '#f1ebe1',
  },

  light: '#fff5e6',
} as const
