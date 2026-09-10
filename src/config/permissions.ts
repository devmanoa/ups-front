import { runtimeConfig } from './runtime';
import keycloak from './keycloak';

/**
 * Droits Konitys de l'utilisateur courant.
 *
 * Le SDK `konitys-perms.js` est normalement chargé par `konitys-header.js` ;
 * cette application charge son en-tête par Module Federation et ne passe pas
 * par ce script. On interroge donc la passerelle directement.
 *
 * Ce contrôle est un confort d'affichage : cacher un bouton inutile évite un
 * refus après coup. La véritable barrière est côté serveur, où `requirePerm`
 * refait la vérification — un bouton caché reste appelable à la main.
 */

/** Clé canonique déclarée par notre schéma. Doit rester alignée sur le backend. */
const APP_KEY = 'ups';

interface PermissionsMe {
  user_id: string;
  apps: Record<string, Record<string, boolean>>;
  is_admin: boolean;
  enforcement?: {
    globally_enabled?: boolean;
    disabled_apps?: string[];
    enabled_apps?: string[];
  };
}

let cache: { at: number; data: PermissionsMe | null } | null = null;
let inFlight: Promise<PermissionsMe | null> | null = null;

/** Les droits changent rarement en cours de session. */
const TTL_MS = 5 * 60 * 1000;

async function fetchMe(): Promise<PermissionsMe | null> {
  const gateway = runtimeConfig.gatewayUrl;
  if (!gateway || !keycloak.token) return null;

  try {
    const res = await fetch(`${gateway}/api/permissions/me`, {
      headers: { Authorization: `Bearer ${keycloak.token}` },
    });
    if (!res.ok) return null;
    return (await res.json()).data as PermissionsMe;
  } catch {
    // Passerelle injoignable : rien n'est caché, et le serveur tranchera.
    return null;
  }
}

/** Charge les droits, une seule requête même en cas d'appels simultanés. */
export async function loadPermissions(): Promise<PermissionsMe | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  if (inFlight) return inFlight;

  inFlight = fetchMe()
    .then((data) => {
      cache = { at: Date.now(), data };
      return data;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

function isEnforced(me: PermissionsMe): boolean {
  const e = me.enforcement;
  if (!e) return false;

  if (e.globally_enabled) return !(e.disabled_apps ?? []).includes(APP_KEY);
  return (e.enabled_apps ?? []).includes(APP_KEY);
}

/**
 * L'utilisateur détient-il ce droit ?
 *
 * Vrai par défaut : sans réponse de la passerelle, ou contrôle désactivé,
 * l'interface reste entière. Masquer par précaution rendrait l'application
 * inutilisable à la première panne.
 */
export function hasPermission(me: PermissionsMe | null, key: string): boolean {
  if (!me) return true;
  if (me.is_admin) return true;
  if (!isEnforced(me)) return true;

  return Boolean(me.apps?.[APP_KEY]?.[key]);
}

/** Vide le cache. Utile après un changement de profil. */
export function resetPermissions(): void {
  cache = null;
}
