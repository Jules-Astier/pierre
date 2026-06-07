import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const reactNativeWebEntry = new URL(
  './node_modules/react-native-web/dist/index.js',
  import.meta.url
).pathname;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: /^react-native$/, replacement: reactNativeWebEntry }],
  },
  server: {
    host: '127.0.0.1',
    port: 5184,
  },
});
