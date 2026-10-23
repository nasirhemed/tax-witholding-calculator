import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'";

/** In the built file, block all network access so the page can't send your numbers anywhere. */
function noNetwork(): Plugin {
  return {
    name: 'no-network-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    ],
  };
}

// Bundles everything into dist/index.html so the app opens from disk with no server.
export default defineConfig({
  plugins: [noNetwork(), viteSingleFile()],
  build: { target: 'es2022' },
});
