/**
 * Résolution de la configuration, par ordre de priorité :
 * 1. window.__APP_CONFIG__ — injecté au démarrage du conteneur (production)
 * 2. import.meta.env — figé au build par Vite (développement local)
 * 3. valeur de repli
 *
 * Ce mécanisme permet de modifier les URL depuis Coolify sans reconstruire
 * l'image Docker.
 */
function resolve(runtimeKey: keyof AppRuntimeConfig, buildValue: string | undefined, fallback = ''): string {
  const runtimeValue = window.__APP_CONFIG__?.[runtimeKey];
  const value = runtimeValue || buildValue || fallback;
  return value.replace(/\/$/, '');
}

export const runtimeConfig = {
  apiUrl: resolve('API_URL', import.meta.env.VITE_API_URL, 'http://localhost:3000'),
  keycloakUrl: resolve('KEYCLOAK_URL', import.meta.env.VITE_KEYCLOAK_URL),
  keycloakRealm: resolve('KEYCLOAK_REALM', import.meta.env.VITE_KEYCLOAK_REALM, 'konitys'),
  keycloakClientId: resolve(
    'KEYCLOAK_CLIENT_ID',
    import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
    'ups-management'
  ),
  plateformUrl: resolve('PLATEFORM_URL', import.meta.env.VITE_PLATEFORM_URL),
};

/**
 * Keycloak ne peut pas s'initialiser sans URL de serveur. Dans ce cas l'app
 * démarre en mode non authentifié plutôt que de planter au chargement.
 */
export const isAuthConfigured = Boolean(runtimeConfig.keycloakUrl);
