import Keycloak from 'keycloak-js';
import { runtimeConfig } from './runtime';

const keycloak = new Keycloak({
  url: runtimeConfig.keycloakUrl,
  realm: runtimeConfig.keycloakRealm,
  clientId: runtimeConfig.keycloakClientId,
});

export default keycloak;
