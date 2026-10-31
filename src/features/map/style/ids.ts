export const SOURCE = {
  base: 'zibata',
  plazaSites: 'plaza-sites',
  plazaBuildings: 'plaza-buildings',
  mask: 'outside-mask',
  /** Capas de realismo (ver layers/realismo.ts). */
  soil: 'realismo-suelo',
  relief: 'realismo-relieve',
  context: 'realismo-contexto',
  contextRoads: 'realismo-vias',
} as const

/** Capas con las que el usuario interactÃºa (hover / clic sobre plazas). */
export const INTERACTIVE_PLAZA_LAYERS = ['plaza-buildings', 'plaza-sites-fill'] as const

export const LAYER = {
  plazaSitesFill: 'plaza-sites-fill',
  plazaSitesOutline: 'plaza-sites-outline',
  plazaSitesSoon: 'plaza-sites-soon',
  plazaBuildings: 'plaza-buildings',
  plazaBuildingsInactive: 'plaza-buildings-inactive',
  buildings: 'buildings',
  buildingsOutside: 'buildings-outside',
  trees: 'trees',
  treeTrunks: 'tree-trunks',
  treeShrubs: 'tree-shrubs',
} as const
