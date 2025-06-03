import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as true,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  
  // Middleware para configurar headers adequados de cache em desenvolvimento
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    if (url.startsWith('/api/')) {
      return next();
    }

    // Configurar headers de cache apropriados para desenvolvimento
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // Ler o template sempre do disco para mudanças dinâmicas
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      
      // Remover nanoid que pode causar problemas de cache
      // e usar timestamp simples apenas se necessário
      if (process.env.NODE_ENV === 'development') {
        const timestamp = Date.now();
        template = template.replace(
          `src="/src/main.tsx"`,
          `src="/src/main.tsx?t=${timestamp}"`,
        );
      }
      
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Configurar headers de cache para produção
  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      // Cache agressivo para assets com hash no nome
      if (filePath.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
        if (filePath.includes('-') && filePath.match(/[a-f0-9]{8}/)) {
          // Assets com hash - cache longo
          res.set('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          // Assets sem hash - cache moderado
          res.set('Cache-Control', 'public, max-age=3600');
        }
      } else {
        // HTML e outros arquivos - sem cache
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      }
    }
  }));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    // Configurar headers para o index.html
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
