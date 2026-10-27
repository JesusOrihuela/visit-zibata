/**
 * Interface strings in English. TypeScript demands every key of the Spanish catalogue
 * (`satisfies Messages`), so a new string never ships half translated. Data (place descriptions,
 * plaza names) stays as its owner wrote it: only the interface is translated.
 */
import type { Messages } from './es.ts'

export const en = {
  'app.name': 'Visit Zibatá',
  'app.tagline': 'The local guide',
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

  'explore.title': 'Explore Zibatá',
  'explore.summary': '{plazas} with {places} on the map',
  'explore.hint': 'Tap an area on the map or pick one from the list.',
  'explore.andMore': '{list} and {count} more',
  'explore.list': 'Areas',
  'explore.openList': 'Explore Zibatá',
  'explore.expand': 'See the areas',

  'results.title': 'Results',
  'results.empty.title': 'Nothing found',
  'results.empty.body': 'No places match that. Try another word or clear the filters.',

  'plaza.label': 'Area',
  'plaza.places': 'Places in this area',
  'plaza.empty': 'No places listed in this area yet.',
  'plaza.filteredEmpty': 'No place in this area matches the filters.',
  'plaza.showAll': 'See every place in the area',
  'plaza.select': '{name}, {places}',
  'plaza.directions': 'Directions to the area',
  'plaza.comingSoon': 'Coming soon',
  'plaza.comingSoonList': 'Under construction',

  'place.backToPlaza': 'Back to {plaza}',
  'place.backToResults': 'Back to results',
  'place.directionsToPlaza': 'Directions to {plaza}',
  'place.directionsToPlace': 'Directions to {name}',
  'place.directions': 'Directions',
  'place.onlyYou': 'Only you',
  'place.directionsHint': 'Opens Google Maps in a new tab',
  'place.machineTranslation': 'Automatic translation',
  'place.showOriginal': 'View the Spanish original',
  'place.showTranslation': 'View the translation',
  'place.location': 'Location',
  'place.description': 'Description',
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
  'place.savedCount': { one: '{count} person saved it', other: '{count} people saved it' },
  'place.missingInfo': 'We don’t have any more information about this place yet.',

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
  'visit.mark': 'Log a visit to {name}',
  'visit.pickDay': 'Pick the day of the visit',
  'visit.been': { one: 'You’ve been once', other: 'You’ve been {count} times' },
  'visit.lastOne': ', the last one on {date}.',
  'visit.seeAll': 'See all',
  'visit.hideAll': 'Hide',
  'visit.remove': 'Remove the visit on {date}',
  'visit.prevMonth': 'Previous month',
  'visit.nextMonth': 'Next month',
  'visit.closeCalendar': 'Close the calendar',
  'visit.first': 'Log your first visit',
  'favorites.add': 'Save to favourites',
  'favorites.remove': 'Remove from favourites',
  'favorites.filter': 'Favourites',
  'filters.openNow': 'Open now',
  'filters.switches': 'Quick filters',
  'filters.openNowLabel': 'Open now: {name}',
  'filters.closedNowLabel': 'Closed now: {name}',
  'filters.unknownHoursLabel': 'No opening hours published: {name}',
  'filters.temporarilyClosedLabel': 'Temporarily closed: {name}',

  'closure.title': 'Temporarily closed',
  'closure.remodelacion': 'For refurbishment.',
  'closure.vacaciones': 'On holiday.',
  'closure.traspaso': 'Under new ownership.',
  'closure.since': 'Since {date}.',
  'closure.noReturn': 'No reopening date yet.',
  'favorites.saved': 'Saved to favourites',

  'brand.by': 'A project by',

  'seo.home.title': 'Visit Zibatá · The local guide to discovering Zibatá',
  'seo.imageAlt':
    'Visit Zibatá: a map of Zibatá with the plazas where to eat and drink, the local guide to the town.',
  'seo.home.description':
    'Discover Zibatá: businesses and places in each plaza, with hours, contact ' +
    'and directions. Everything you need to decide where to go.',
  'seo.title': '{name} · Visit Zibatá',
  'seo.title.zone': '{name} in {plaza} · Visit Zibatá',
  'seo.place.fallback': '{giros} at {plaza}, Zibatá. Hours, contact and directions.',
  'seo.place.context': '{giros} at {lugar}.',
  'seo.place.contextLugar': 'At {lugar}.',
  'seo.plaza.fallback': '{name}, Zibatá. What’s there, hours and directions.',
  'seo.nearby': 'More in {plaza}',
  'seo.whatsHere': 'What’s here',
  'seo.zones': 'The areas of Zibatá',
  'seo.categories': 'Categories',
  'seo.category.name': '{label} in Zibatá',
  'seo.category.description': {
    one: '{label} is one of the categories of Zibatá: {lugares} in {zonas}, with hours, contact and directions.',
    other:
      '{label} is one of the categories of Zibatá: {lugares} across {zonas}, with hours, contact and directions.',
  },
  'seo.category.descriptionSinZona': {
    one: '{label} is one of the categories of Zibatá: {lugares}, with hours, contact and directions.',
    other:
      '{label} is one of the categories of Zibatá: {lugares}, with hours, contact and directions.',
  },
  'seo.category.title': '{label} in Zibatá: {giros}',
  'seo.category.places': 'Places in this category',
  'seo.category.zones': 'Where to find them',
  'seo.category.zoneCount': { one: '{count} area', other: '{count} areas' },
  'seo.backHome': 'See the map of Zibatá',

  'share.action': 'Share',
  'share.place': 'Share {name}',
  'share.text': '{name} · {giros} · {plaza}',
  'share.copied': 'Copied',
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
  'map.rotate': 'Rotate the map: drag, or press to turn an eighth of a turn',
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
  'about.fix': 'Suggest or contact',
  'about.tutorial': 'See the tutorial',
  'about.tutorialTitle': 'How to use the guide',
  'about.tutorialLead': 'The four steps to move around the map, find a place and save it.',
  'about.moreLabel': 'More about the guide',
  'about.independent': 'An independent guide to the area’s businesses and services.',

  'about.aboutLead': 'A guide to what’s in Zibatá, so you can decide where to go.',
  'about.aboutBody':
    'It brings the places of the area together on one map with what you need to decide. What each one offers, where it is, when it opens and how to get there.',
  'about.aboutSources':
    'It is an independent guide, by the community and for the community, built from public information and updated whenever something changes.',

  'about.privacy': 'Privacy',
  'about.privacyTitle': 'Privacy and terms',
  'about.privacyLead':
    'This guide uses no accounts and no tracking cookies, and shares your data with no one. This page also covers the terms of use.',
  'about.privacyCounts':
    'To understand what users are interested in, we count how many times each page and place is opened, which links are followed, which filters are used, whether a search found results, and what kind of site visitors arrive from. We do not store what you type, your IP, or any identifier, and we neither sell nor share them. If your browser asks not to be tracked, we only count the page visit.',
  'about.privacyBody':
    'The places you open and the language are stored only in this browser. Your favourites, your ratings and the visits you log are stored here and also sent, so they are not lost and so the count of people who saved each place is true: they travel attached to a random identifier, with no email, no name and nothing that says who you are. Your ratings are never published, not even as an average; they help order the guide and never leave the server. That identifier lives only in this browser, so clearing the site data loses it and you start over. If you write in "Suggest a change or contact us", what you write is stored so it can be acted on, along with the contact you leave if you choose to; that is not tied to any identifier. The data controller is Aurariola.com, in Querétaro, Mexico. We do not collect sensitive personal data. We use the information only to make the guide work — language, favourites, ratings, saved visits and anonymous visit counting — and to reply if you write to us. If you want to know what data we hold, correct it, cancel it or object to our use of it, send us a message through "Suggest a change or contact us" with your name, the right you are exercising and a description of the data; you can also delete what is stored in this browser from the browser settings. We will publish any changes to this notice on this page with the update date.',
  'about.privacyLocation':
    'Your location is used only when you press the locate button, to centre the map, and it is never stored or transmitted. The map and the fonts are served from this same site, and saving a place calls no one either, so using the guide makes no third-party requests at all. Links to Google Maps, social accounts or delivery apps open external sites, each with its own policy.',

  'about.termsTitle': 'Terms of use',
  'about.termsWhat':
    'This guide is an independent project. It has no commercial relationship with any of the places listed: nobody pays to be here, to rank higher or to be featured, and there is no advertising. A place being listed is not a recommendation or an endorsement, only that it exists in the area and there is enough information to describe it.',
  'about.termsData':
    'The information comes from public sources and from what each business corrects, and it is reviewed each season. Even so it can be out of date: opening hours change, a phone number stops working, a place closes without notice. The guide is offered as it is, with no guarantee that every detail is accurate today. For anything that matters (the hours before heading out, a price, a booking), confirm it directly with the place.',
  'about.termsFix':
    'If something about your business is wrong, or you would rather not be listed, write through "Suggest a change or contact us" and it is corrected or removed in the next update. No explanation needed: asking is enough.',
  'about.termsContent':
    'The text, the map and the code of this guide belong to whoever maintains it. Each business name, logo and trademark belongs to that business, and is used here only to identify it. Links to Google Maps, social accounts or delivery apps lead to third-party sites, and what happens there follows their own rules.',

  'about.contribute': 'Suggest a change or contact us',
  'about.contributeLead':
    'Is a place missing, is something incorrect or would you like to contact us?',
  'about.contributeBody':
    'Anyone can write, a neighbour, a customer or the business itself: every correction helps, be it opening hours, a phone number, social accounts or the description. You can also exercise your ARCO rights or ask us anything.',
  'about.contributeMeanwhile':
    'What you write goes straight to whoever maintains the guide, with no third-party service in between. No account and no email needed: the contact field is optional and only serves to reply to you. The guide is reviewed each season, and anything a business asks to correct enters the next update.',

  'suggest.title': 'Tell us what changes or write your message',
  'suggest.who': 'Who is writing?',
  'suggest.whoNeighbor': 'Neighbour',
  'suggest.whoOwner': 'Business',
  'suggest.whoOther': 'Other',
  'suggest.place': 'Place, area or subject',
  'suggest.placeHint': 'Optional',
  'suggest.message': 'Your message',
  'suggest.contact': 'Your email',
  'suggest.contactHint': 'Optional',
  'suggest.send': 'Send',
  'suggest.sending': 'Sending…',
  'suggest.ok': 'Thank you. We will check it and it goes into the next update.',
  'suggest.error': 'It could not be sent. Please try again in a while.',
  'suggest.required': 'Write your message.',
  'suggest.trap': 'Leave this field empty',
  'suggest.note':
    'Your message is stored on the guide’s own server so it can be acted on. Nothing else: no account, no address.',

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
  'profile.noVisits': 'All of Zibatá still to discover: {total} areas and {places} places.',
  'profile.zonesLabel': 'Areas of Zibatá',
  'profile.zoneDone': 'visited',
  'profile.podium': 'Your usual three',
  'profile.position': 'Place {position}',
  'profile.tastes': 'What you look for most',
  'profile.tasteCount': { one: '{count} place', other: '{count} places' },
  'profile.empty':
    'Log a visit, save a place with the heart or rate it, and your time in Zibatá will show up here.',
  'profile.storage': 'All of this stays in this browser.',

  'locale.label': 'Language',
  'locale.shortEs': 'ES',
  'locale.shortEn': 'EN',
  'locale.switchTo': 'View the guide in {language}',

  'debug.title': 'Map debugging',
} satisfies Messages
