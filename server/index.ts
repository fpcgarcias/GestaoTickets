import "./loadEnv"; // Importar PRIMEIRO para carregar variáveis de ambiente

import express, { type Request, Response, NextFunction } from "express";
import { setupVite, serveStatic, log } from "./vite";
import session from "express-session";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { migrate } from "./migrate";
import { runMigrations } from "./migration-runner";
import http from "http";

// === IMPORTS DE SEGURANÇA ===
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

// Calcular __dirname para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Para garantir que temos um secret único a cada inicialização
const generateSecret = () => crypto.randomBytes(32).toString("hex");

const app = express();

// === CONFIGURAÇÕES DE PROXY ===
// Configuração robusta para múltiplos proxies e acessos
app.set("trust proxy", true); // Confiar em TODOS os proxies para máxima flexibilidade
console.log("🔧 Trust proxy: Habilitado para todos os proxies");

// === CONFIGURAÇÕES DE SEGURANÇA ===

// 1. Helmet - Headers de segurança (mais permissivo)
app.use(
  helmet({
    contentSecurityPolicy: false, // Desabilitar CSP para evitar problemas
    hsts: {
      maxAge: 31536000,
      includeSubDomains: false, // Menos restritivo para subdomínios
      preload: false,
    },
  })
);

// 2. CORS - Configuração MUITO flexível para múltiplos acessos
app.use(
  cors({
    origin: function (origin, callback) {
      // Em desenvolvimento, permitir qualquer origem
      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }

      // Lista expandida de origens permitidas
      const allowedOrigins = [
        "https://suporte.oficinamuda.com.br",
        "http://suporte.oficinamuda.com.br",
        "https://oficinamuda.com.br",
        "http://oficinamuda.com.br",
        "https://www.oficinamuda.com.br",
        "http://www.oficinamuda.com.br",
        "https://app.ticketwise.com.br",
        "http://app.ticketwise.com.br",
        "https://suporte.vixbrasil.com",
        "http://suporte.vixbrasil.com",
        "https://ticketwise.com.br",
        "http://ticketwise.com.br",
        "https://vixbrasil.com",
        "http://vixbrasil.com",
      ];

      // Se não há origin (requests diretos) ou está na lista, permitir
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Permitir qualquer subdomínio de oficinamuda.com.br
      if (origin.endsWith(".oficinamuda.com.br")) {
        return callback(null, true);
      }

      // Permitir qualquer subdomínio de ticketwise.com.br
      if (origin.endsWith(".ticketwise.com.br")) {
        return callback(null, true);
      }

      // Permitir qualquer subdomínio de vixbrasil.com
      if (origin.endsWith(".vixbrasil.com")) {
        return callback(null, true);
      }

      // Permitir qualquer IP (regex para IPs)
      const ipRegex = /^https?:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;
      if (ipRegex.test(origin)) {
        return callback(null, true);
      }

      // Permitir localhost para desenvolvimento
      if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
        return callback(null, true);
      }

      // Se chegou aqui, bloquear mas logar
      console.log(`🚫 CORS bloqueado para origem: ${origin}`);
      callback(null, true); // TEMPORARIAMENTE permitir tudo para debug
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Origin", "Accept"],
  })
);

// 3. Rate Limiting - MAIS PERMISSIVO para evitar bloqueios
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5000, // 5000 requests por IP (muito mais generoso)
  message: "Muitas tentativas. Tente novamente em 15 minutos.",
  standardHeaders: true,
  legacyHeaders: false,
  // Não aplicar rate limiting em desenvolvimento
  skip: () => process.env.NODE_ENV !== "production",
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 50, // 50 tentativas de login por IP (muito mais generoso)
  message: "Muitas tentativas de login. Tente novamente em 15 minutos.",
  skipSuccessfulRequests: true,
  // Não aplicar em desenvolvimento
  skip: () => process.env.NODE_ENV !== "production",
});

// Aplicar rate limiting apenas em produção
if (process.env.NODE_ENV === "production") {
  app.use(generalLimiter);
  // Rate limiting específico para endpoints de autenticação será aplicado nas rotas
}

app.use(express.json({ limit: "10mb" })); // Limite de payload
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// Inicializar serviço de notificações
const notificationService = {
  initialize: () => {
    console.log("Serviço de notificações inicializado");

    // Verificar se há usuários órfãos no sistema
    setTimeout(async () => {
      try {
        const { findOrphanSupportUsers } = await import("./clean-orphan-users");
        const orphanUsers = await findOrphanSupportUsers();

        if (orphanUsers.length > 0) {
          console.log(
            `Aviso: Foram encontrados ${orphanUsers.length} usuários de suporte sem registro de atendente.`
          );
          console.log(
            "Para corrigir, execute a função fixAllOrphanSupportUsers() do módulo clean-orphan-users."
          );
        }
      } catch (error) {
        console.error("Erro ao verificar usuários órfãos:", error);
      }
    }, 5000); // Aguardar 5 segundos para não atrapalhar a inicialização
  },
};

// Inicializar serviço
notificationService.initialize();

// Configurar a sessão com configurações seguras
app.use(
  session({
    secret: process.env.SESSION_SECRET || generateSecret(),
    resave: false,
    saveUninitialized: false,
    name: "sessionId", // Nome personalizado para evitar detecção automática
    cookie: {
      secure: process.env.NODE_ENV === "production", // HTTPS apenas em produção
      httpOnly: true, // Previne acesso via JavaScript
      maxAge: 24 * 60 * 60 * 1000, // 1 dia
      sameSite: "strict", // Proteção CSRF
    },
  })
);

// === MIDDLEWARE DE LOG MELHORADO ===
app.use((req, res, next) => {
  const start = Date.now();
  const pathReq = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json.bind(res);
  res.json = (bodyJson: any, ...args: any[]) => {
    capturedJsonResponse = bodyJson;
    return originalResJson(bodyJson, ...args);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (pathReq.startsWith("/api")) {
      let logLine = `${req.method} ${pathReq} ${res.statusCode} in ${duration}ms`;

      // Mascarar dados sensíveis nos logs
      if (capturedJsonResponse) {
        const sanitizedResponse = { ...capturedJsonResponse };
        if (sanitizedResponse.password) sanitizedResponse.password = "[MASKED]";
        if (sanitizedResponse.token) sanitizedResponse.token = "[MASKED]";
        if (sanitizedResponse.session) sanitizedResponse.session = "[MASKED]";

        logLine += ` :: ${JSON.stringify(sanitizedResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// // Servir arquivos estáticos - Usar o __dirname calculado
// app.use(express.static(path.join(__dirname, "public"))); // Comentar ou remover esta linha

// Função start agora configura tudo
async function startServer() {
  try {
    // 1. Executar migrações de estrutura do banco PRIMEIRO
    console.log("🔧 Verificando estrutura do banco de dados...");
    await runMigrations();

    // 2. Continuar com o código de inicialização do servidor
    console.log("Iniciando o servidor...");

    // Importar dinamicamente DEPOIS de dotenv.config()
    const { registerRoutes } = await import("./routes");
    const { migratePasswords } = await import("./utils/password-migration");

    // 3. Registrar rotas da API e obter o servidor HTTP configurado
    //    Aqui assume-se que registerRoutes retorna um http.Server criado para o Express
    //    Caso registerRoutes apenas registre rotas e não retorne servidor, comente esta linha
    const server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse> =
      await registerRoutes(app);

    // 4. Configurar o Vite DEPOIS das rotas da API
    await setupVite(app, server);

    // 5. Executar criptografia de senhas (se necessário)
    await migratePasswords();

    // 6. Inicializar scheduler para verificações automáticas
    console.log("Inicializando scheduler de notificações...");
    const { schedulerService } = await import("./services/scheduler-service");
    schedulerService.start();

    // 7. Iniciar servidor na porta especificada, ouvindo em 0.0.0.0 (IPv4 + IPv6)
    //    Convertendo explicitamente para number para não dar erro de overload no TypeScript
    const PORT = Number(process.env.PORT) || 5000;
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Servidor rodando na porta ${PORT}`);
      console.log("🔒 Middlewares de segurança ativados: Helmet, CORS, Rate Limiting");
    });
  } catch (error) {
    console.error("Erro ao iniciar o servidor:", error);
    process.exit(1);
  }
}

startServer();
