import { defineConfig } from 'vite';

/**
 * En production, /config.js est généré au démarrage du conteneur.
 * En développement ce fichier n'existe pas : on le sert à la volée pour
 * éviter une 404 dans la console.
 */
function devRuntimeConfig() {
  return {
    name: 'dev-runtime-config',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/config.js', (req, res) => {
        const apiUrl = process.env.VITE_API_URL || '';
        res.setHeader('Content-Type', 'application/javascript');
        // Valeur vide : api.js retombe alors sur VITE_API_URL puis localhost.
        res.end(`window.__APP_CONFIG__ = { API_URL: ${JSON.stringify(apiUrl)} };\n`);
      });
    },
  };
}

export default defineConfig({
  plugins: [devRuntimeConfig()],
  server: {
    port: 5173,
    open: true,
  },
});
