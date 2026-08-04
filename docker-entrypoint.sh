#!/bin/sh
set -e

# Génère la configuration runtime lue par l'application avant son démarrage.
# Permet de changer l'URL du backend depuis Coolify sans reconstruire l'image.

CONFIG_FILE="/usr/share/nginx/html/config.js"

# Échappe les guillemets et antislashs pour produire un JS valide.
ESCAPED_API_URL=$(printf '%s' "${VITE_API_URL}" | sed 's/\\/\\\\/g; s/"/\\"/g')

cat > "$CONFIG_FILE" <<EOF
window.__APP_CONFIG__ = { API_URL: "${ESCAPED_API_URL}" };
EOF

echo "[entrypoint] config.js généré — API_URL=${VITE_API_URL:-(non définie, repli sur l'origine)}"
