/**
 * Los títulos de las páginas fijas de información.
 *
 * Una ficha y una categoría comparten con ellas el patrón `{nombre} · Visit Zibatá`. Un local o una
 * categoría con uno de estos nombres dejaría dos páginas con el mismo título. La lista se compara
 * con las copias de la guía en una prueba; el Worker la usa para rechazarlo antes de la PR.
 */
export const TITULOS_RESERVADOS = [
  'Acerca de esta guía',
  'Privacidad y términos',
  'Sugiere un cambio o contáctanos',
  'Cómo usar la guía',
  'About this guide',
  'Privacy and terms',
  'Suggest a change or contact us',
  'How to use the guide',
] as const
