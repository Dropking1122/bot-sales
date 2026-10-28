import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    // @bot-sales/shared is a linked workspace package compiled to CommonJS, so it is not under
    // node_modules and Vite's default commonjs include pattern misses it — its __exportStar
    // re-exports then read as "not exported".
    commonjsOptions: {
      include: [/shared[\\/]dist/, /node_modules/]
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8090',
        changeOrigin: true
      },
      '/storage': {
        target: process.env.VITE_API_URL || 'http://localhost:8090',
        changeOrigin: true
      }
    }
  }
});
