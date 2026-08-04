import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * En production, /config.js est généré au démarrage du conteneur par
 * docker-entrypoint.sh. En développement le fichier n'existe pas : on le sert
 * à la volée pour éviter une 404 dans la console.
 */
function devRuntimeConfig(): Plugin {
  return {
    name: 'dev-runtime-config',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/config.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript');
        // Objet vide : la résolution retombe sur les variables Vite.
        res.end('window.__APP_CONFIG__ = {};\n');
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devRuntimeConfig()],
  server: {
    port: 5173,
  },
});
