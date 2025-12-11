import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  resolve: {
    alias: [{ find: /^lucide-react\/icons\//, replacement: 'lucide-react/dist/esm/icons/' }]
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-ai': ['@google/genai'],
          'vendor-charts': ['recharts'],
          'vendor-icons': ['lucide-react']
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