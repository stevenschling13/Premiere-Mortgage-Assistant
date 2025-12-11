import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('react')) return 'vendor-react';
          if (id.includes('@google/genai')) return 'vendor-ai';
          if (id.includes('recharts')) return 'vendor-charts';
        }
      }
    }
  }
});