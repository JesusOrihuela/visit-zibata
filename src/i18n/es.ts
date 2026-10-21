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
  'explore.andMore': '{list} y {count} más',
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
  'place.onlyYou': 'Solo para ti',
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
  'visit.mark': 'Registrar una visita a {name}',
  'visit.pickDay': 'Elige el día de la visita',
  'visit.been': { one: 'Has venido una vez', other: 'Has venido {count} veces' },
  'visit.lastOne': ', la última el {date}.',
  'visit.seeAll': 'Ver todas',
  'visit.hideAll': 'Ocultar',
  'visit.remove': 'Quitar la visita del {date}',
  'visit.prevMonth': 'Mes anterior',
  'visit.nextMonth': 'Mes siguiente',
  'visit.closeCalendar': 'Cerrar el calendario',
  'visit.first': 'Registra tu primera visita',
  'favorites.add': 'Guardar en favoritos',
  'favorites.remove': 'Quitar de favoritos',
  'favorites.filter': 'Favoritos',
  'filters.openNow': 'Abierto ahora',
  // Nombre del grupo de interruptores para quien lo escucha; a la vista no lleva título.
  'filters.switches': 'Filtros rápidos',
  // Para el punto de la tarjeta, que no lleva texto a la vista. Lo lee un lector de pantalla.
  'filters.openNowLabel': 'Abierto ahora: {name}',
  'filters.closedNowLabel': 'Cerrado ahora: {name}',
  'filters.unknownHoursLabel': 'Sin horario publicado: {name}',
  'filters.temporarilyClosedLabel': 'Cerrado temporalmente: {name}',

  /*
   * El aviso de cierre temporal. Va en la ficha, antes del horario, porque es lo único que hay que
   * leer antes de salir de casa. El motivo sale de una lista cerrada (ver `cierre` en
   * src/data/schemas.ts): texto libre no se podría decir en inglés.
   */
  'closure.title': 'Cerrado temporalmente',
  'closure.remodelacion': 'Por remodelación.',
  'closure.vacaciones': 'Por vacaciones.',
  'closure.traspaso': 'Por cambio de dueño.',
  'closure.since': 'Así desde el {date}.',
  // Mientras el negocio no dé fecha, la guía no la inventa, y lo dice en vez de callarlo.
  'closure.noReturn': 'Todavía no hay fecha de reapertura.',
  'favorites.saved': 'Guardado en favoritos',

  'brand.by': 'Un proyecto de',

  /*
   * Textos que solo salen en los metadatos de cada página prerenderizada: título de pestaña,
   * resultado de búsqueda y vista previa al compartir. Nunca se ven dentro de la aplicación.
   */
  'seo.home.title': 'Visit Zibatá · La guía local para descubrir Zibatá',
  'seo.home.description':
    'Descubre lo que hay en Zibatá, Querétaro: los negocios y lugares de cada zona en un mapa 3D, con horarios, contacto y cómo llegar.',
  'seo.title': '{name} · Visit Zibatá',
  // Solo para los locales cuyo nombre se repite (dos sucursales de una misma cadena).
  'seo.title.zone': '{name} · {plaza} · Visit Zibatá',
  'seo.place.fallback': '{giros} en {plaza}, Zibatá. Horario, contacto y cómo llegar.',
  // Lo que se añade a una descripción corta: solo los giros y la zona del propio local.
  'seo.place.context': '{giros} en {lugar}.',
  'seo.place.contextLugar': 'En {lugar}.',
  'seo.plaza.fallback': '{name}, Zibatá. Qué hay, horarios y cómo llegar.',
  // Los cuatro siguientes solo salen en el HTML que se sirve antes de que arranque la aplicación
  // (ver scripts/build/contenido.ts). Son texto de interfaz igual: los lee quien no tiene
  // JavaScript, y los lee un buscador.
  'seo.nearby': 'Más en {plaza}',
  'seo.whatsHere': 'Qué hay aquí',
  'seo.zones': 'Las zonas de Zibatá',
  'seo.backHome': 'Ver el mapa de Zibatá',

  'share.action': 'Compartir',
  'share.place': 'Compartir {name}',
  /* Etiqueta, no frase: lleva el nombre, los giros y la zona, que es lo que la guía ya publica. */
  'share.text': '{name} · {giros} · {plaza}',
  'share.copied': 'Copiado',
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
  'map.rotate': 'Girar el mapa: arrastra, o pulsa para girar un octavo de vuelta',
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

  'about.aboutLead': 'Una guía para saber qué hay en Zibatá y decidir adónde ir.',
  'about.aboutBody':
    'Reúne en un mapa los lugares de la zona con lo que hace falta para decidir. Qué ofrece cada uno, dónde está, a qué hora abre y cómo llegar.',
  'about.aboutSources':
    'Es una guía independiente, de la comunidad para la comunidad, hecha con información pública y actualizada cuando algo cambia.',

  /*
   * Dos nombres para la misma página, y es a propósito. "Privacidad" es la etiqueta corta de la
   * franja del mapa y del pasaporte, donde el ancho es escaso. El título largo es el que se lee
   * dentro y el que se indexa, porque desde la v4.18 esta página también son los términos de uso:
   * eran dos avisos cortos que se repetían, y leerlos juntos es más claro que buscarlos por
   * separado (ver docs/CUENTAS.md para lo que sí se guarda).
   */
  'about.privacy': 'Privacidad',
  'about.privacyTitle': 'Privacidad y términos',
  'about.privacyLead':
    'Esta guía no usa cuentas ni cookies de rastreo, y no comparte tus datos con nadie. Esta página también reúne los términos de uso.',
  /*
   * Desde la v4.8.0 la guía sí cuenta visitas, así que el aviso lo dice. El texto es deliberadamente
   * concreto: una promesa vaga ("respetamos tu privacidad") no se puede comprobar, y esta sí, porque
   * describe exactamente lo que guardan las tablas de la base (ver worker/esquema.sql): contadores por día.
   */
  'about.privacyCounts':
    'Para saber los intereses del usuario, contamos cuántas veces se abre cada página y cada lugar, a qué enlaces se sale, qué filtros se usan, si una búsqueda encontró resultados y desde qué tipo de sitio se llega. No guardamos lo que escribes, tu IP ni ningún identificador, y no los vendemos ni los compartimos. Si tu navegador pide no ser rastreado, solo contamos la visita a la página.',
  'about.privacyBody':
    'Los lugares que abres y el idioma se guardan únicamente en este navegador. Tus favoritos, tus calificaciones y las visitas que marcas se guardan aquí y además se envían para que no se pierdan y para que el número de personas que guardaron cada lugar sea cierto: viajan atados a un identificador al azar, sin correo, sin nombre y sin nada que diga quién eres. Tus calificaciones no se publican nunca, ni siquiera como promedio; sirven para ordenar la guía y no salen del servidor. Ese identificador vive solo en este navegador, así que si borras los datos del sitio se pierde y empiezas de cero. Si escribes en "Sugiere un cambio", lo que escribas se guarda para poder atenderlo, junto con el contacto que dejes si decides dejarlo; eso no va atado a ningún identificador.',
  'about.privacyLocation':
    'Tu ubicación se utiliza solo al pulsar el botón para centrar el mapa y no se guarda ni se transmite. El mapa y las tipografías se sirven desde este mismo sitio, y guardar un lugar tampoco llama a nadie de fuera, de modo que usar la guía no genera ni una petición a terceros. Los enlaces a Google Maps, redes sociales o reparto abren sitios externos, cada uno con su propia política.',

  'about.termsTitle': 'Términos de uso',
  'about.termsWhat':
    'Esta guía es un proyecto independiente. No tiene relación comercial con ninguno de los lugares que aparecen: nadie paga por estar, por salir más arriba ni por aparecer destacado, y no hay publicidad. Que un lugar esté aquí no es una recomendación ni un respaldo, solo que existe en la zona y hay datos suficientes para describirlo.',
  'about.termsData':
    'La información se reúne de fuentes públicas y de lo que corrige cada negocio, y se revisa por temporada. Aun así puede estar desactualizada: los horarios cambian, un teléfono deja de servir y un local cierra sin avisar. La guía se ofrece tal como está, sin garantía de que cada dato sea exacto hoy. Para algo que importe (el horario antes de salir, un precio, una reserva), confírmalo directo con el lugar.',
  'about.termsFix':
    'Si un dato de tu negocio está mal, o prefieres no aparecer, escribe por "Sugiere un cambio" y se corrige o se quita en la siguiente actualización. No hace falta explicar por qué: basta con pedirlo.',
  'about.termsContent':
    'Los textos, el mapa y el código de la guía son de quien la mantiene. El nombre, el logotipo y la marca de cada negocio son de ese negocio, y aquí se usan solo para identificarlo. Los enlaces a Google Maps, redes sociales o reparto llevan a sitios de terceros, y lo que ocurra ahí se rige por sus propias reglas.',

  'about.contribute': 'Sugiere un cambio',
  'about.contributeLead': '¿Falta un lugar o hay un dato que ya no es correcto?',
  'about.contributeBody':
    'Escribe quien sea, vecino, cliente o el propio negocio: toda corrección suma, sea un horario, un teléfono, las redes o la descripción.',
  'about.contributeMeanwhile':
    'Lo que escribas llega directo a quien mantiene la guía, sin pasar por ningún servicio de terceros. No hace falta cuenta ni correo: el contacto es opcional y solo sirve para responderte. La guía se revisa por temporada, y lo que pida corregir un negocio entra en la siguiente actualización.',

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
    'Tu mensaje se guarda en el servidor de la guía para poder atenderlo. Nada más: ni cuenta, ni dirección.',

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

  'locale.label': 'Idioma',
  'locale.shortEs': 'ES',
  'locale.shortEn': 'EN',
  'locale.switchTo': 'Ver la guía en {language}',

  'debug.title': 'Depuración del mapa',
} as const

export type MessageKey = keyof typeof es
export type Messages = {
  [K in MessageKey]: (typeof es)[K] extends string ? string : { one: string; other: string }
}
