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
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
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
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      onwarn(warning, warn) {
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
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-select',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-toast',
            '@radix-ui/react-tabs',
            '@radix-ui/react-accordion'
          ],
          charts: ['recharts'],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
          query: ['@tanstack/react-query'],
          utils: ['date-fns', 'clsx', 'tailwind-merge']
        },
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split('/').pop()?.replace(/\.[^.]*$/, '')
            : 'chunk';
          return `js/${facadeModuleId}-[hash].js`;
        },
        assetFileNames: (assetInfo) => {
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
      external: (id) => {
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
      'recharts'
    ],
    exclude: [],
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
