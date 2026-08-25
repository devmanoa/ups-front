/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_KEYCLOAK_URL: string;
  readonly VITE_KEYCLOAK_REALM: string;
  readonly VITE_KEYCLOAK_CLIENT_ID: string;
  readonly VITE_PLATEFORM_URL?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Configuration injectée au runtime par docker-entrypoint.sh.
 * Prioritaire sur import.meta.env : permet de changer les URL sans rebuild.
 */
interface AppRuntimeConfig {
  API_URL?: string;
  KEYCLOAK_URL?: string;
  KEYCLOAK_REALM?: string;
  KEYCLOAK_CLIENT_ID?: string;
  PLATEFORM_URL?: string;
  /** Interface web d'Antennes, pour renvoyer vers la fiche d'un contact. */
  ANTENNES_APP_URL?: string;
  GOOGLE_MAPS_API_KEY?: string;
}

interface Window {
  __APP_CONFIG__?: AppRuntimeConfig;
  google?: typeof google;
}
