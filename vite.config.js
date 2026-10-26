import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

// In development, serve the Vercel functions in /api from the Vite dev server so
// `npm run dev` runs the whole site (pages + API + SQLite) with one command.
function devApi() {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next();
        const route = req.url.split('?')[0].slice('/api/'.length).replace(/\/$/, '');
        const file = resolve(root, 'api', `${route}.js`);
        if (!/^[a-z0-9-]+$/.test(route) || !existsSync(file)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Not found.' }));
          return;
        }
        try {
          const mod = await server.ssrLoadModule(file);
          await mod.default(req, res);
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

// Multi-page setup: the home page plus one entry per game.
export default defineConfig({
  base: '/',
  plugins: [devApi()],
  build: {
    // three.js alone is ~600 kB; that's expected for a 3D game.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        cowVsUfo: resolve(root, 'games/cow-vs-ufo/index.html'),
      },
    },
  },
  server: { host: true },
});
