import "./loadEnv"; // Importar PRIMEIRO para carregar variáveis de ambiente

// Carregar variáveis de ambiente PRIMEIRO!
// import dotenv from "dotenv"; // Movido para loadEnv.ts
// import path from "path"; // Movido para loadEnv.ts

// Determinar o caminho para o arquivo .env na raiz do projeto
// const envPath = path.resolve(process.cwd(), '.env'); // Movido para loadEnv.ts
// console.log(`[index.ts] Tentando carregar .env de: ${envPath}`); // Movido para loadEnv.ts
// const dotenvResult = dotenv.config({ path: envPath }); // Movido para loadEnv.ts

// if (dotenvResult.error) {
//   console.error('[index.ts] Erro ao carregar .env:', dotenvResult.error); // Movido para loadEnv.ts
// } else {
//   console.log('[index.ts] .env carregado com sucesso.'); // Movido para loadEnv.ts
//   if (dotenvResult.parsed) {
//     console.log('[index.ts] Variáveis carregadas do .env:', Object.keys(dotenvResult.parsed)); // Movido para loadEnv.ts
//   }
// }

// --- DEBUG --- 
// console.log('DEBUG: Após dotenv.config()');
// console.log('DEBUG: DATABASE_URL:', process.env.DATABASE_URL);
// console.log('DEBUG: PORT:', process.env.PORT);
// --- FIM DEBUG ---

import express, { type Request, Response, NextFunction } from "express";
import { setupVite, serveStatic, log } from "./vite";
import session from "express-session";
import crypto from "crypto";
import path from "path"; // RESTAURAR esta importação, pois é usada abaixo
import { fileURLToPath } from 'url';
import { migrate } from './migrate';

// === IMPORTS DE SEGURANÇA ===
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

// Calcular __dirname para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Para garantir que temos um secret único a cada inicialização
const generateSecret = () => crypto.randomBytes(32).toString('hex');

const app = express();

// === CONFIGURAÇÕES DE SEGURANÇA ===

// 1. Helmet - Headers de segurança
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// 2. CORS - Configuração restritiva
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL || 'https://your-domain.com']
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 3. Rate Limiting - Proteção contra ataques de força bruta
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // 1000 requests por IP
  message: "Muitas tentativas. Tente novamente em 15 minutos.",
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas de login por IP
  message: "Muitas tentativas de login. Tente novamente em 15 minutos.",
  skipSuccessfulRequests: true,
});

app.use(generalLimiter);
// Rate limiting específico para endpoints de autenticação será aplicado nas rotas

app.use(express.json({ limit: '10mb' })); // Limite de payload
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Inicializar serviço de notificações 
const notificationService = {
  initialize: () => {
    console.log('Serviço de notificações inicializado');
    
    // Verificar se há usuários órfãos no sistema
    setTimeout(async () => {
      try {
        const { findOrphanSupportUsers } = await import('./clean-orphan-users');
        const orphanUsers = await findOrphanSupportUsers();
        
        if (orphanUsers.length > 0) {
          console.log(`Aviso: Foram encontrados ${orphanUsers.length} usuários de suporte sem registro de atendente.`);
          console.log('Para corrigir, execute a função fixAllOrphanSupportUsers() do módulo clean-orphan-users.');
        }
      } catch (error) {
        console.error('Erro ao verificar usuários órfãos:', error);
      }
    }, 5000); // Aguardar 5 segundos para não atrapalhar a inicialização
  }
};

// Inicializar serviço
notificationService.initialize();

// Configurar a sessão com configurações seguras
app.use(session({
  secret: process.env.SESSION_SECRET || generateSecret(),
  resave: false,
  saveUninitialized: false,
  name: 'sessionId', // Nome personalizado para evitar detecção automática
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS apenas em produção
    httpOnly: true, // Previne acesso via JavaScript
    maxAge: 24 * 60 * 60 * 1000, // 1 dia
    sameSite: 'strict' // Proteção CSRF
  }
}));

// === MIDDLEWARE DE LOG MELHORADO ===
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // Mascarar dados sensíveis nos logs
      if (capturedJsonResponse) {
        const sanitizedResponse = { ...capturedJsonResponse };
        if (sanitizedResponse.password) sanitizedResponse.password = '[MASKED]';
        if (sanitizedResponse.token) sanitizedResponse.token = '[MASKED]';
        if (sanitizedResponse.session) sanitizedResponse.session = '[MASKED]';
        
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
    // Executar migrações antes de iniciar o servidor (silencioso se não há pendências)
    await migrate();
    
    // Continuar com o código de inicialização do servidor
    console.log("Iniciando o servidor...");
    
    // Importar dinamicamente DEPOIS de dotenv.config()
    const { registerRoutes } = await import("./routes");
    const { migratePasswords } = await import("./migrate-passwords");

    // 1. Registrar rotas da API e obter o servidor HTTP configurado
    const server = await registerRoutes(app);
    
    // 2. Configurar o Vite DEPOIS das rotas da API
    await setupVite(app, server);
    
    // 3. Executar migrações de senhas (se necessário)
    await migratePasswords();
    
    // 4. Inicializar scheduler para verificações automáticas
    console.log("Inicializando scheduler de notificações...");
    const { schedulerService } = await import("./services/scheduler-service");
    schedulerService.start();
    
    // 5. Iniciar servidor na porta especificada
    const PORT = process.env.PORT || 5173; 
    server.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
      console.log(`🔒 Middlewares de segurança ativados: Helmet, CORS, Rate Limiting`);
    });
  } catch (error) {
    console.error('Erro ao iniciar o servidor:', error);
    process.exit(1);
  }
}

startServer();
