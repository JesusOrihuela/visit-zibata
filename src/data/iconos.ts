/**
 * Los nombres de icono que existen en la guía.
 *
 * `CategoryIcon.tsx` tiene el dibujo de cada uno; esta lista es la que pueden usar los datos y el
 * editor del panel. Se mantiene aparte del componente a propósito: el Worker y el panel necesitan
 * los nombres sin arrastrar React ni los SVG al paquete del Worker.
 *
 * Una prueba comprueba que cada nombre de aquí tiene dibujo. Si se añade un icono nuevo, hay que
 * tocar los dos sitios.
 */
export const ICONOS = [
  'acai',
  'antojito',
  'arepa',
  'bagel',
  'baguette',
  'beef',
  'beer',
  'birria',
  'boba',
  'bowl',
  'cake-slice',
  'candy',
  'cecina',
  'cerdo',
  'cherry',
  'chopsticks',
  'coffee',
  'cooking-pot',
  'crepa',
  'croissant',
  'cup-soda',
  'cupcake',
  'drumstick',
  'dumbbell',
  'egg-fried',
  'elote',
  'empanada',
  'fish',
  'flame',
  'fruta',
  'hamburger',
  'hand-platter',
  'hot-dog',
  'hotcakes',
  'ice-cream',
  'italiana',
  'jugo',
  'kebab',
  'leafy-green',
  'martini',
  'memela',
  'molcajete',
  'nigiri',
  'pan',
  'papas',
  'papas-fritas',
  'pasta',
  'pizza',
  'ramen',
  'popcorn',
  'quesadilla',
  'salad',
  'sandwich',
  'shrimp',
  'taco',
  'torta',
  'utensils-crossed',
  'waffle',
  'wrap',
  'wine',
] as const

export type Icono = (typeof ICONOS)[number]
