/**
 * Textos de la interfaz en español (idioma inicial). Para añadir otro idioma crea `en.ts` con
 * `satisfies Messages` y regístralo en `src/i18n/index.ts`: TypeScript exigirá todas las claves.
 * Valores con `{variable}` se interpolan; los objetos { one, other } son plurales (Intl.PluralRules).
 */
export const es = {
  'app.name': 'Visit Zibatá',
  'app.tagline': 'La guía de zibateños para zibateños',
  'app.mapLabel': 'Mapa 3D interactivo de Zibatá',

  'search.label': 'Buscar lugares',
  'search.placeholder': 'Busca café, tacos o una zona…',
  'search.placeholderShort': 'Busca en Zibatá…',
  'search.clear': 'Borrar búsqueda',

  'filters.categories': 'Categorías',
  'filters.allCategories': 'Todo',
  'filters.plaza': 'Filtrar por zona',
  'filters.allPlazas': 'Todas las zonas',
  'filters.clear': 'Limpiar filtros',
  'filters.results': { one: '{count} resultado', other: '{count} resultados' },

  'plazas.count': { one: '{count} zona', other: '{count} zonas' },
  'places.count': { one: '{count} lugar', other: '{count} lugares' },
  'places.matching': { one: '{count} coincide', other: '{count} coinciden' },

  'explore.title': 'Explora Zibatá',
  'explore.summary': '{plazas} con {places} en el mapa',
  'explore.hint': 'Toca una zona en el mapa o elige una de la lista.',
  'explore.list': 'Zonas',
  'explore.openList': 'Explora Zibatá',

  'results.title': 'Resultados',
  'results.empty.title': 'Sin resultados',
  'results.empty.body':
    'No encontramos lugares con esos criterios. Prueba otra palabra o limpia los filtros.',

  'plaza.label': 'Zona',
  'plaza.places': 'Lugares en esta zona',
  'plaza.empty': 'Aún no hay lugares activos registrados en esta zona.',
  'plaza.filteredEmpty': 'Ningún lugar de esta zona coincide con los filtros.',
  'plaza.showAll': 'Ver todos los lugares de la zona',
  'plaza.select': 'Ver {name}, {places}',
  'plaza.directions': 'Cómo llegar a la zona',
  'plaza.comingSoon': 'Próximamente',
  'plaza.comingSoonList': 'En construcción',

  'place.backToPlaza': 'Volver a {plaza}',
  'place.backToResults': 'Volver a resultados',
  'place.directionsToPlaza': 'Cómo llegar a {plaza}',
  'place.directionsToPlace': 'Cómo llegar a {name}',
  'place.directions': 'Cómo llegar',
  'place.directionsHint': 'Abre Google Maps en una pestaña nueva',
  'place.machineTranslation': 'Traducción automática',
  'place.showOriginal': 'Ver original en español',
  'place.showTranslation': 'Ver traducción',
  'place.hours': 'Horario',
  'place.contact': 'Contacto y redes',
  'place.call': 'Llamar',
  'place.whatsapp': 'WhatsApp',
  'place.website': 'Sitio web',
  'place.instagram': 'Instagram',
  'place.facebook': 'Facebook',
  'place.tiktok': 'TikTok',
  'place.rappi': 'Rappi',
  'place.uberEats': 'Uber Eats',
  'place.didiFood': 'DiDi Food',
  'place.noPhoto': 'Ilustración de la categoría {category}',
  'place.openDetail': 'Ver detalles de {name}',
  'place.ratingCount': { one: '{count} valoración', other: '{count} valoraciones' },
  'place.savedCount': { one: '{count} persona lo guardó', other: '{count} personas lo guardaron' },
  'place.missingInfo': 'Aún no tenemos más información de este lugar.',

  'hours.open': 'Abierto',
  'hours.closed': 'Cerrado',
  'hours.closedAllDay': 'Cerrado',
  'hours.today': 'Hoy',

  'day.mon': 'Lunes',
  'day.tue': 'Martes',
  'day.wed': 'Miércoles',
  'day.thu': 'Jueves',
  'day.fri': 'Viernes',
  'day.sat': 'Sábado',
  'day.sun': 'Domingo',
  'dayShort.mon': 'Lun',
  'dayShort.tue': 'Mar',
  'dayShort.wed': 'Mié',
  'dayShort.thu': 'Jue',
  'dayShort.fri': 'Vie',
  'dayShort.sat': 'Sáb',
  'dayShort.sun': 'Dom',

  'rating.legend': 'Tu calificación',
  'rating.set': {
    one: 'Calificar {name} con {value} estrella',
    other: 'Calificar {name} con {value} estrellas',
  },
  'rating.hint': 'Califica este lugar',
  'rating.yours': {
    one: 'Calificado con {value} estrella',
    other: 'Calificado con {value} estrellas',
  },
  'rating.preview': {
    one: 'Calificar con {value} estrella',
    other: 'Calificar con {value} estrellas',
  },

  'visit.action': 'Registrar visita',
  'visit.registered': 'Visita registrada',
  'visit.mark': 'Registrar tu visita de hoy a {name}',
  'visit.undo': 'Quitar la visita de hoy a {name}',
  'visit.count': { one: '{count} visita', other: '{count} visitas' },
  'visit.last': 'Última visita: {date}',
  'visit.undoHint': 'Toca para deshacer, solo hoy',
  'visit.first': 'Registra tu primera visita',

  'favorites.add': 'Guardar en favoritos',
  'favorites.remove': 'Quitar de favoritos',
  'favorites.filter': 'Favoritos',
  'favorites.saved': 'Guardado en favoritos',

  'brand.by': 'Un proyecto de',

  /*
   * Textos que solo salen en los metadatos de cada página prerenderizada: título de pestaña,
   * resultado de búsqueda y vista previa al compartir. Nunca se ven dentro de la aplicación.
   */
  'seo.home.title': 'Visit Zibatá · La guía de zibateños para zibateños',
  'seo.home.description':
    'Explora Zibatá, Querétaro, en un mapa 3D y descubre qué hay en cada plaza: horarios, contacto y cómo llegar.',
  'seo.title': '{name} · Visit Zibatá',
  'seo.place.fallback': '{giros} en {plaza}, Zibatá. Horario, contacto y cómo llegar.',
  'seo.plaza.fallback': '{name}, Zibatá. Qué hay, horarios y cómo llegar.',

  'share.action': 'Compartir',
  'share.place': 'Compartir {name}',
  /* Etiqueta, no frase: lleva el nombre, los giros y la zona, que es lo que la guía ya publica. */
  'share.text': '{name} · {giros} · {plaza}',
  'share.copied': 'Enlace copiado',
  'share.failed': 'No se pudo copiar el enlace',

  'panel.close': 'Cerrar panel',
  'a11y.skipToSearch': 'Ir al buscador',
  'link.missing': 'Ese enlace apunta a un lugar que ya no está en la guía.',
  'link.dismiss': 'Cerrar aviso',
  'network.offline': 'Sin conexión a internet. Partes del mapa pueden no cargar hasta que vuelva.',
  'panel.expand': 'Ampliar panel',
  'panel.collapse': 'Reducir panel',
  'panel.label': 'Información de lugares',

  'map.zoomIn': 'Acercar',
  'map.zoomOut': 'Alejar',
  'map.resetNorth': 'Orientar al norte',
  'map.reset': 'Volver a la vista de Zibatá',
  'map.locate': 'Mostrar mi ubicación',
  'map.locateError': 'No pudimos obtener tu ubicación.',
  'map.loading': 'Cargando Zibatá…',
  'map.controls': 'Controles del mapa',
  'map.locateOutside': 'Parece que no estás en Zibatá, así que el mapa sigue mostrando sus zonas.',
  'map.locateUnsupported': 'Este navegador no permite obtener tu ubicación.',
  'map.userLocation': 'Tu ubicación',
  'map.error.title': 'El mapa 3D no está disponible',
  'map.error.webgl':
    'Tu navegador o dispositivo no permite mostrar el mapa 3D (WebGL2). Puedes seguir explorando las zonas y lugares desde la lista.',
  'map.error.generic': 'No pudimos cargar el mapa. Revisa tu conexión e inténtalo de nuevo.',
  'map.retry': 'Reintentar',

  'data.error.title': 'No pudimos cargar los lugares',
  'data.error.body':
    'Ocurrió un problema al leer la información de Zibatá. Inténtalo de nuevo en unos segundos.',
  'data.retry': 'Reintentar',
  'data.loading': 'Cargando lugares…',

  'onboarding.step1.title': 'Explora Zibatá',
  'onboarding.step1.body':
    'Arrastra para moverte, pellizca o usa la rueda para acercarte y gira con dos dedos o clic derecho.',
  'onboarding.step2.title': 'Selecciona una zona',
  'onboarding.step2.body':
    'Las zonas con lugares están resaltadas en verde. Tócalas para ver qué hay.',
  'onboarding.step3.title': 'Abre la ficha de un lugar',
  'onboarding.step3.body':
    'Filtra por categoría o busca lo que necesites, y toca una tarjeta para ver horario, contacto y cómo llegar.',
  'onboarding.step4.title': 'Deja tu marca',
  'onboarding.step4.body':
    'En la ficha puedes registrar tus visitas al lugar, guardarlo con el corazón y calificarlo con estrellas.',
  'onboarding.next': 'Siguiente',
  'onboarding.back': 'Anterior',
  'onboarding.skip': 'Saltar',
  'onboarding.start': 'Empezar a explorar',
  'onboarding.close': 'Cerrar',
  'onboarding.progress': 'Paso {current} de {total}',

  'about.open': 'Acerca de esta guía',
  'about.openShort': 'Acerca',
  'about.title': 'Acerca de esta guía',
  'about.fix': 'Sugiere un cambio',
  'about.tutorial': 'Ver el tutorial',
  'about.tutorialTitle': 'Cómo usar la guía',
  'about.tutorialLead':
    'Los cuatro pasos para moverte por el mapa, encontrar un lugar y guardarlo.',
  'about.moreLabel': 'Más sobre la guía',
  'about.independent': 'Guía independiente de establecimientos y servicios de la zona.',
  'about.languageEs': 'Español',
  'about.languageEn': 'English',

  'about.aboutLead': 'Una guía para saber qué hay en Zibatá y decidir adónde ir.',
  'about.aboutBody':
    'Reúne en un mapa los lugares de la zona con lo que hace falta para decidir. Qué ofrece cada uno, dónde está, a qué hora abre y cómo llegar.',
  'about.aboutSources':
    'Es una guía independiente, de la comunidad para la comunidad, hecha con información pública y actualizada cuando algo cambia.',

  'about.privacy': 'Privacidad',
  'about.privacyLead':
    'Esta guía no usa cuentas ni cookies de rastreo, y no comparte tus datos con nadie.',
  /*
   * Desde la v4.8.0 la guía sí cuenta visitas, así que el aviso lo dice. El texto es deliberadamente
   * concreto: una promesa vaga ("respetamos tu privacidad") no se puede comprobar, y esta sí, porque
   * describe exactamente las cuatro columnas que existen en la base.
   */
  'about.privacyCounts':
    'Para saber qué lugares interesan, nuestro propio servidor suma una visita por página y por día. Eso es todo lo que se guarda: "esta página se abrió 12 veces hoy". No queda registro de quién, ni desde dónde, ni con qué, así que no hay manera de seguir a nadie entre dos visitas. El dato es nuestro: no se vende ni se comparte.',
  'about.privacyBody':
    'Tus calificaciones, los lugares que abres y el idioma se guardan únicamente en este navegador. Tus favoritos también, y además se envían para que cuenten en el número de personas que guardaron cada lugar: viajan atados a un identificador al azar, sin correo, sin nombre y sin nada que diga quién eres. Ese identificador vive solo en este navegador, así que si borras los datos del sitio se pierde y empiezas de cero.',
  'about.privacyLocation':
    'Tu ubicación se utiliza solo al pulsar el botón para centrar el mapa y no se guarda ni se transmite. El mapa y las tipografías se sirven desde este mismo sitio, y guardar un lugar tampoco llama a nadie de fuera, de modo que usar la guía no genera ni una petición a terceros. Los enlaces a Google Maps, redes sociales o reparto abren sitios externos, cada uno con su propia política.',

  'about.contribute': 'Sugiere un cambio',
  'about.contributeLead': '¿Falta un lugar o hay un dato que ya no es correcto?',
  'about.contributeBody':
    'Escribe quien sea, vecino, cliente o el propio negocio: toda corrección suma, sea un horario, un teléfono, las redes o la descripción.',
  'about.contributeMeanwhile':
    'El canal para enviarlas está en definición y se publicará aquí en cuanto exista. Mientras tanto, la guía se revisa por temporada y cualquier dato que un negocio pida corregir entra en la siguiente actualización.',

  'suggest.title': 'Cuéntame qué cambia',
  'suggest.who': '¿Quién escribe?',
  'suggest.whoNeighbor': 'Vecino',
  'suggest.whoOwner': 'Negocio',
  'suggest.whoOther': 'Otro',
  'suggest.place': 'Lugar o zona',
  'suggest.placeHint': 'Opcional',
  'suggest.message': 'Tu mensaje',
  'suggest.contact': 'Tu correo',
  'suggest.contactHint': 'Opcional',
  'suggest.send': 'Enviar',
  'suggest.sending': 'Enviando…',
  'suggest.ok': 'Gracias. Lo reviso y entra en la próxima actualización.',
  'suggest.error': 'No se pudo enviar. Inténtalo de nuevo en un rato.',
  'suggest.required': 'Escribe tu mensaje.',
  /* Etiqueta del campo trampa: solo la oyen los lectores de pantalla, y les dice que lo dejen. */
  'suggest.trap': 'No rellenes este campo',
  'suggest.note':
    'Al enviar, tu mensaje se envía por Web3Forms y se recibe por correo. La guía no guarda ninguna información.',

  'about.credits': 'Datos y créditos',
  'about.creditsBody':
    'Mapa propio con datos de OpenStreetMap, Overture Maps y ESA WorldCover, dibujado con MapLibre. Iconos de Lucide y Simple Icons, banderas de circle-flags y logotipos de reparto de Wikimedia Commons.',
  'about.version': 'Versión {version}',
  'about.close': 'Cerrar',

  'profile.open': 'Tu Zibatá',
  'profile.title': 'Tu Zibatá',
  'profile.subtitle': 'Tus visitas, tus favoritos y tus notas',
  'profile.journey': 'Tu paso por Zibatá',
  'profile.visitsSummary': {
    one: 'Has visitado {count} lugar de Zibatá, en {zones} de sus {total} zonas.',
    other: 'Has visitado {count} lugares de Zibatá, en {zones} de sus {total} zonas.',
  },
  'profile.noVisits': 'Todo Zibatá por estrenar: {total} zonas y {places} lugares.',
  'profile.zonesLabel': 'Zonas de Zibatá',
  'profile.zoneDone': 'estrenada',
  'profile.podium': 'Tus tres de siempre',
  'profile.position': 'Puesto {position}',
  'profile.tastes': 'Lo que más buscas',
  'profile.tasteCount': { one: '{count} lugar', other: '{count} lugares' },
  'profile.empty':
    'Registra una visita, guarda un lugar con el corazón o califícalo, y aquí verás tu paso por Zibatá.',
  'profile.storage': 'Todo esto se queda en este navegador.',

  'locale.shortEs': 'ES',
  'locale.shortEn': 'EN',
  'locale.switchTo': 'Ver la guía en {language}',

  'debug.title': 'Depuración del mapa',
} as const

export type MessageKey = keyof typeof es
export type Messages = {
  [K in MessageKey]: (typeof es)[K] extends string ? string : { one: string; other: string }
}
