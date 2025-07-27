import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: process.env.NODE_ENV === 'production' ? [
          ['babel-plugin-react-remove-properties', { properties: ['data-testid'] }]
        ] : []
      }
    }),
    runtimeErrorOverlay(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: process.env.NODE_ENV !== 'production',
    chunkSizeWarningLimit: 800, // Reduzido de 1000 para 800
    rollupOptions: {
      onwarn(warning: any, warn: any) {
        // Suprimir warnings específicos do Zod relacionados a comentários mal formatados
        if (
          warning.code === 'UNRECOGNIZED_COMMENT' && 
          warning.loc && 
          warning.loc.file && 
          warning.loc.file.includes('node_modules/zod')
        ) {
          return;
        }
        
        // Suprimir warnings de comentários que contêm anotações específicas do Zod
        if (
          warning.message && 
          (warning.message.includes('contains an annotation that Rollup cannot interpret') ||
           warning.message.includes('/* @__PURE__ */') ||
           warning.message.includes('core._parse') ||
           warning.message.includes('core._safeParse') ||
           warning.message.includes('core._parseAsync') ||
           warning.message.includes('core._safeParseAsync') ||
           warning.message.includes('$ZodIP'))
        ) {
          return;
        }
        
        // Para outros warnings, usar o comportamento padrão
        warn(warning);
      },
      output: {
        manualChunks: (id: string) => {
          // React e React DOM
          if (id.includes('react') && (id.includes('react-dom') || id.includes('react/') || id.includes('react-dom/'))) {
            return 'react-vendor';
          }
          
          // Radix UI components
          if (id.includes('@radix-ui/')) {
            return 'radix-ui';
          }
          
          // TanStack Query
          if (id.includes('@tanstack/')) {
            return 'tanstack-query';
          }
          
          // Form libraries
          if (id.includes('react-hook-form') || id.includes('@hookform/') || id.includes('zod')) {
            return 'form-libs';
          }
          
          // Charts
          if (id.includes('recharts')) {
            return 'charts';
          }
          
          // Date utilities
          if (id.includes('date-fns')) {
            return 'date-utils';
          }
          
          // UI utilities
          if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) {
            return 'ui-utils';
          }
          
          // Icons
          if (id.includes('lucide-react') || id.includes('react-icons')) {
            return 'icons';
          }
          
          // Animation libraries
          if (id.includes('framer-motion') || id.includes('tailwindcss-animate')) {
            return 'animations';
          }
          
          // Wouter (routing)
          if (id.includes('wouter')) {
            return 'router';
          }
          
          // AWS SDK
          if (id.includes('@aws-sdk/')) {
            return 'aws-sdk';
          }
          
          // Node modules que não são específicos
          if (id.includes('node_modules') && !id.includes('@radix-ui/') && !id.includes('@tanstack/') && !id.includes('react') && !id.includes('@aws-sdk/')) {
            return 'vendor';
          }
        },
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo: any) => {
          const info = assetInfo.name?.split('.') || [];
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext || '')) {
            return `img/[name]-[hash][extname]`;
          }
          if (/css/i.test(ext || '')) {
            return `css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        entryFileNames: 'js/[name]-[hash].js'
      },
      treeshake: {
        moduleSideEffects: false
      },
      external: (id: string) => {
        // Não bundlar dependências do Node.js no build do cliente
        return id.startsWith('node:') || id.startsWith('fs') || id.startsWith('path');
      }
    },
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    reportCompressedSize: true
  },
  server: {
    hmr: {
      overlay: false,
      port: 24678,
      host: '0.0.0.0',
    },
    fs: {
      strict: false
    },
    host: '0.0.0.0',
    port: 5173,
    cors: {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@tanstack/react-query',
      'react-hook-form',
      'date-fns',
      'recharts',
      'wouter',
      'lucide-react'
    ],
    exclude: [
      '@aws-sdk/client-s3',
      '@aws-sdk/s3-request-presigner'
    ],
    force: process.env.NODE_ENV === 'development'
  },
  preview: {
    port: 4173,
    strictPort: true,
    host: '0.0.0.0'
  },
  css: {
    devSourcemap: process.env.NODE_ENV !== 'production',
    preprocessorOptions: {
    }
  },
  worker: {
    format: 'es'
  }
});
