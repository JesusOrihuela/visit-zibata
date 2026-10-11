/**
 * Interface strings in English. TypeScript demands every key of the Spanish catalogue
 * (`satisfies Messages`), so a new string never ships half translated. Data (place descriptions,
 * plaza names) stays as its owner wrote it: only the interface is translated.
 */
import type { Messages } from './es.ts'

export const en = {
  'app.name': 'Visit Zibatá',
  'app.tagline': 'By locals, for locals',
  'app.mapLabel': 'Interactive 3D map of Zibatá',

  'search.label': 'Search places',
  'search.placeholder': 'Search coffee, tacos, an area…',
  'search.placeholderShort': 'Search in Zibatá…',
  'search.clear': 'Clear search',

  'filters.categories': 'Categories',
  'filters.allCategories': 'All',
  'filters.plaza': 'Filter by area',
  'filters.allPlazas': 'All areas',
  'filters.clear': 'Clear filters',
  'filters.results': { one: '{count} result', other: '{count} results' },

  'plazas.count': { one: '{count} area', other: '{count} areas' },
  'places.count': { one: '{count} place', other: '{count} places' },
  'places.matching': { one: '{count} match', other: '{count} matches' },

  'explore.title': 'Explore Zibatá',
  'explore.summary': '{plazas} with {places} on the map',
  'explore.hint': 'Tap an area on the map or pick one from the list.',
  'explore.list': 'Areas',
  'explore.openList': 'Explore Zibatá',

  'results.title': 'Results',
  'results.empty.title': 'Nothing found',
  'results.empty.body': 'No places match that. Try another word or clear the filters.',

  'plaza.label': 'Area',
  'plaza.places': 'Places in this area',
  'plaza.empty': 'No open places listed in this area yet.',
  'plaza.filteredEmpty': 'No place in this area matches the filters.',
  'plaza.showAll': 'See every place in the area',
  'plaza.select': 'See {name}, {places}',
  'plaza.directions': 'Directions to the area',
  'plaza.comingSoon': 'Coming soon',
  'plaza.comingSoonList': 'Under construction',

  'place.backToPlaza': 'Back to {plaza}',
  'place.backToResults': 'Back to results',
  'place.directionsToPlaza': 'Directions to {plaza}',
  'place.directionsToPlace': 'Directions to {name}',
  'place.directions': 'Directions',
  'place.directionsHint': 'Opens Google Maps in a new tab',
  'place.machineTranslation': 'Automatic Translation',
  'place.showOriginal': 'View the Spanish original',
  'place.showTranslation': 'View the translation',
  'place.hours': 'Hours',
  'place.contact': 'Contact and socials',
  'place.call': 'Call',
  'place.whatsapp': 'WhatsApp',
  'place.website': 'Website',
  'place.instagram': 'Instagram',
  'place.facebook': 'Facebook',
  'place.tiktok': 'TikTok',
  'place.rappi': 'Rappi',
  'place.uberEats': 'Uber Eats',
  'place.didiFood': 'DiDi Food',
  'place.noPhoto': '{category} illustration',
  'place.openDetail': 'See details for {name}',
  'place.ratingCount': { one: '{count} rating', other: '{count} ratings' },
  'place.savedCount': { one: '{count} person saved it', other: '{count} people saved it' },
  'place.missingInfo': 'We don’t have more about this place yet.',

  'hours.open': 'Open',
  'hours.closed': 'Closed',
  'hours.closedAllDay': 'Closed',
  'hours.today': 'Today',

  'day.mon': 'Monday',
  'day.tue': 'Tuesday',
  'day.wed': 'Wednesday',
  'day.thu': 'Thursday',
  'day.fri': 'Friday',
  'day.sat': 'Saturday',
  'day.sun': 'Sunday',
  'dayShort.mon': 'Mon',
  'dayShort.tue': 'Tue',
  'dayShort.wed': 'Wed',
  'dayShort.thu': 'Thu',
  'dayShort.fri': 'Fri',
  'dayShort.sat': 'Sat',
  'dayShort.sun': 'Sun',

  'rating.legend': 'Your rating',
  'rating.set': {
    one: 'Rate {name} with {value} star',
    other: 'Rate {name} with {value} stars',
  },
  'rating.hint': 'Rate this place',
  'rating.yours': { one: 'Rated {value} star', other: 'Rated {value} stars' },
  'rating.preview': { one: 'Rate {value} star', other: 'Rate {value} stars' },

  'visit.action': 'Log a visit',
  'visit.registered': 'Visit logged',
  'visit.mark': 'Log your visit to {name} today',
  'visit.undo': 'Remove today’s visit to {name}',
  'visit.count': { one: '{count} visit', other: '{count} visits' },
  'visit.last': 'Last visit: {date}',
  'visit.undoHint': 'Tap to undo, today only',
  'visit.first': 'Log your first visit',

  'favorites.add': 'Save to favourites',
  'favorites.remove': 'Remove from favourites',
  'favorites.filter': 'Favourites',
  'favorites.saved': 'Saved to favourites',

  'brand.by': 'A project by',

  'seo.home.title': 'Visit Zibatá · By locals, for locals',
  'seo.home.description':
    'Explore Zibatá, Querétaro, on a 3D map and find what each plaza has: hours, contact and directions.',
  'seo.title': '{name} · Visit Zibatá',
  'seo.place.fallback': '{giros} at {plaza}, Zibatá. Hours, contact and directions.',
  'seo.plaza.fallback': '{name}, Zibatá. What is there, hours and directions.',

  'share.action': 'Share',
  'share.place': 'Share {name}',
  'share.text': '{name} · {giros} · {plaza}',
  'share.copied': 'Link copied',
  'share.failed': 'Could not copy the link',

  'panel.close': 'Close panel',
  'a11y.skipToSearch': 'Skip to search',
  'link.missing': 'That link points to a place that is no longer in the guide.',
  'link.dismiss': 'Dismiss',
  'network.offline': 'You’re offline. Parts of the map may not load until you’re back.',
  'panel.expand': 'Expand panel',
  'panel.collapse': 'Collapse panel',
  'panel.label': 'Place information',

  'map.zoomIn': 'Zoom in',
  'map.zoomOut': 'Zoom out',
  'map.resetNorth': 'Face north',
  'map.reset': 'Back to the Zibatá view',
  'map.locate': 'Show my location',
  'map.locateError': 'We couldn’t get your location.',
  'map.loading': 'Loading Zibatá…',
  'map.controls': 'Map controls',
  'map.locateOutside': 'Looks like you’re not in Zibatá, so the map still shows its areas.',
  'map.locateUnsupported': 'This browser can’t share your location.',
  'map.userLocation': 'Your location',
  'map.error.title': 'The 3D map isn’t available',
  'map.error.webgl':
    'Your browser or device can’t show the 3D map (WebGL2). You can still explore the areas and places from the list.',
  'map.error.generic': 'We couldn’t load the map. Check your connection and try again.',
  'map.retry': 'Try again',

  'data.error.title': 'We couldn’t load the places',
  'data.error.body':
    'Something went wrong reading Zibatá’s information. Try again in a few seconds.',
  'data.retry': 'Try again',
  'data.loading': 'Loading places…',

  'onboarding.step1.title': 'Explore Zibatá',
  'onboarding.step1.body':
    'Drag to move, pinch or scroll to zoom, and rotate with two fingers or right click.',
  'onboarding.step2.title': 'Pick an area',
  'onboarding.step2.body':
    'Areas with places are highlighted in green. Tap one to see what’s there.',
  'onboarding.step3.title': 'Open a place',
  'onboarding.step3.body':
    'Filter by category or search for what you need, then tap a card for hours, contact and directions.',
  'onboarding.step4.title': 'Leave your mark',
  'onboarding.step4.body':
    'On each place you can log your visits, save it with the heart and rate it with stars.',
  'onboarding.next': 'Next',
  'onboarding.back': 'Back',
  'onboarding.skip': 'Skip',
  'onboarding.start': 'Start exploring',
  'onboarding.close': 'Close',
  'onboarding.progress': 'Step {current} of {total}',

  'about.open': 'About this guide',
  'about.openShort': 'About',
  'about.title': 'About this guide',
  'about.fix': 'Suggest a change',
  'about.tutorial': 'See the tutorial',
  'about.tutorialTitle': 'How to use the guide',
  'about.tutorialLead': 'The four steps to move around the map, find a place and save it.',
  'about.moreLabel': 'More about the guide',
  'about.independent': 'An independent guide to the area’s businesses and services.',
  'about.languageEs': 'Español',
  'about.languageEn': 'English',

  'about.aboutLead': 'A guide to what there is in Zibatá, so you can decide where to go.',
  'about.aboutBody':
    'It brings the places of the area together on one map with what you need to decide. What each one offers, where it is, when it opens and how to get there.',
  'about.aboutSources':
    'It is an independent guide, by the community and for the community, built from public information and updated whenever something changes.',

  'about.privacy': 'Privacy',
  'about.privacyLead':
    'This guide uses no accounts and no tracking cookies, and shares your data with no one.',
  'about.privacyCounts':
    'To know which places people care about, our own server adds one visit per page per day. That is all that is stored: "this page was opened 12 times today". Nothing records who, from where, or with what, so there is no way to follow anyone between two visits. The data is ours: it is neither sold nor shared.',
  'about.privacyBody':
    'Your ratings, the places you open and the language are stored only in this browser. So are your favourites, and they are also sent so they count towards how many people saved each place: they travel attached to a random identifier, with no email, no name and nothing that says who you are. That identifier lives only in this browser, so clearing the site data loses it and you start over.',
  'about.privacyLocation':
    'Your location is used only when you press the locate button, to centre the map, and it is never stored or transmitted. The map and the fonts are served from this same site, and saving a place calls no one either, so using the guide makes no third-party requests at all. Links to Google Maps, social accounts or delivery apps open external sites, each with its own policy.',

  'about.contribute': 'Suggest a change',
  'about.contributeLead': 'Is a place missing or is something no longer right?',
  'about.contributeBody':
    'Anyone can write, a neighbour, a customer or the business itself: every correction helps, be it opening hours, a phone number, social accounts or the description.',
  'about.contributeMeanwhile':
    'The channel for sending them is being defined and will be published here as soon as it exists. Until then, the guide is reviewed each season and anything a business asks to correct enters the next update.',

  'suggest.title': 'Tell me what changes',
  'suggest.who': 'Who is writing?',
  'suggest.whoNeighbor': 'Neighbour',
  'suggest.whoOwner': 'Business',
  'suggest.whoOther': 'Other',
  'suggest.place': 'Place or area',
  'suggest.placeHint': 'Optional',
  'suggest.message': 'Your message',
  'suggest.contact': 'Your email',
  'suggest.contactHint': 'Optional',
  'suggest.send': 'Send',
  'suggest.sending': 'Sending…',
  'suggest.ok': 'Thank you. I will check it and it enters the next update.',
  'suggest.error': 'It could not be sent. Please try again in a while.',
  'suggest.required': 'Write your message.',
  'suggest.trap': 'Leave this field empty',
  'suggest.note':
    'On sending, your message goes out through Web3Forms and arrives by email. The guide stores no information.',

  'about.credits': 'Data and credits',
  'about.creditsBody':
    'Our own map built from OpenStreetMap, Overture Maps and ESA WorldCover data, drawn with MapLibre. Icons from Lucide and Simple Icons, flags from circle-flags and delivery logos from Wikimedia Commons.',
  'about.version': 'Version {version}',
  'about.close': 'Close',

  'profile.open': 'Your Zibatá',
  'profile.title': 'Your Zibatá',
  'profile.subtitle': 'Your visits, your favourites and your notes',
  'profile.journey': 'Your time in Zibatá',
  'profile.visitsSummary': {
    one: 'You have visited {count} place in Zibatá, across {zones} of its {total} areas.',
    other: 'You have visited {count} places in Zibatá, across {zones} of its {total} areas.',
  },
  'profile.noVisits': 'All of Zibatá still to try: {total} areas and {places} places.',
  'profile.zonesLabel': 'Areas of Zibatá',
  'profile.zoneDone': 'visited',
  'profile.podium': 'Your usual three',
  'profile.position': 'Place {position}',
  'profile.tastes': 'What you look for most',
  'profile.tasteCount': { one: '{count} place', other: '{count} places' },
  'profile.empty':
    'Log a visit, save a place with the heart or rate it, and your time in Zibatá will show up here.',
  'profile.storage': 'All of this stays in this browser.',

  'locale.shortEs': 'ES',
  'locale.shortEn': 'EN',
  'locale.switchTo': 'View the guide in {language}',

  'debug.title': 'Map debugging',
} satisfies Messages
