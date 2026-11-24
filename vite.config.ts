import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Every build gets its own version id. The app compares it with version.json on the
// server to notice when a newer Bruna has been published (see src/update.ts).
const VERSION = Date.now().toString(36);

const versionFile = (): Plugin => ({
  name: 'bruna-version',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ v: VERSION }) });
  },
});

// Relative base so the build works from any folder (GitHub Pages, a USB stick, etc.)
export default defineConfig({
  base: './',
  plugins: [react(), versionFile()],
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  test: { environment: 'node' },
} as any);
