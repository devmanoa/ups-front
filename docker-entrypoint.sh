#!/bin/sh
set -e

# Génère la configuration runtime lue par l'application avant son démarrage.
# Permet de changer les URL (backend, Keycloak, plateforme) depuis Coolify
# sans reconstruire l'image.

CONFIG_FILE="/usr/share/nginx/html/config.js"

# Échappe les antislashs et guillemets pour produire un JS valide.
escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

cat > "$CONFIG_FILE" <<EOF
window.__APP_CONFIG__ = {
  API_URL: "$(escape "${VITE_API_URL}")",
  KEYCLOAK_URL: "$(escape "${VITE_KEYCLOAK_URL}")",
  KEYCLOAK_REALM: "$(escape "${VITE_KEYCLOAK_REALM}")",
  KEYCLOAK_CLIENT_ID: "$(escape "${VITE_KEYCLOAK_CLIENT_ID}")",
  PLATEFORM_URL: "$(escape "${VITE_PLATEFORM_URL}")"
};
EOF

echo "[entrypoint] config.js généré — API_URL=${VITE_API_URL:-(non définie)} KEYCLOAK_URL=${VITE_KEYCLOAK_URL:-(non définie)}"
