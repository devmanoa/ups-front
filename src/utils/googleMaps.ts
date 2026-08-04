import { runtimeConfig } from '../config/runtime';

/**
 * Chargement paresseux du script Google Maps Places.
 *
 * Le script n'est chargé qu'au premier montage d'un champ d'adresse, et une
 * seule fois pour toute l'application (la promesse est mémorisée).
 */

let loaderPromise: Promise<void> | null = null;

export function isGoogleMapsConfigured(): boolean {
  return Boolean(runtimeConfig.googleMapsApiKey);
}

export function loadGoogleMaps(): Promise<void> {
  if (loaderPromise) return loaderPromise;

  const key = runtimeConfig.googleMapsApiKey;
  if (!key) {
    return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY non configurée'));
  }

  // Le script a pu être injecté par un autre bundle (plateforme fédérée).
  if (window.google?.maps?.places) {
    loaderPromise = Promise.resolve();
    return loaderPromise;
  }

  loaderPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    // "places" pour l'autocomplétion d'adresse, "marker" pour la carte des
    // points relais. Un seul chargement sert les deux usages.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key
    )}&libraries=places,marker&language=fr`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Réinitialisé pour permettre une nouvelle tentative (réseau coupé…).
      loaderPromise = null;
      reject(new Error('Échec du chargement de Google Maps'));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}

export interface ParsedAddress {
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Convertit les `address_components` Google en champs du formulaire UPS.
 *
 * Google découpe la voie en numéro (`street_number`) et nom (`route`) ; UPS
 * attend une ligne unique. La ville peut arriver sous plusieurs types selon
 * le pays, d'où la liste de replis.
 */
export function parsePlace(place: google.maps.places.PlaceResult): ParsedAddress {
  const get = (type: string, useShort = false): string => {
    const component = place.address_components?.find((c) => c.types.includes(type));
    if (!component) return '';
    return useShort ? component.short_name : component.long_name;
  };

  const streetNumber = get('street_number');
  const route = get('route');

  const city =
    get('locality') ||
    get('postal_town') ||
    get('administrative_area_level_2') ||
    get('sublocality');

  return {
    addressLine1: [streetNumber, route].filter(Boolean).join(' '),
    city,
    // UPS attend le code court pour l'état (ex. « MD », pas « Maryland »).
    state: get('administrative_area_level_1', true),
    postalCode: get('postal_code'),
    country: get('country', true),
    latitude: place.geometry?.location?.lat(),
    longitude: place.geometry?.location?.lng(),
  };
}
