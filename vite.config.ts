import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from 'vite-plugin-pwa';

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
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      disable: false,
      manifest: {
        name: 'TicketWise - Sistema de Gestão de Tickets',
        short_name: 'TicketWise',
        description: 'Sistema completo de gestão de tickets e atendimento ao cliente',
        theme_color: '#8b5cf6',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    }),
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
        manualChunks: undefined, // Deixar o Vite fazer code splitting automático
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
      'lucide-react',
      'clsx',
      'tailwind-merge'
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
