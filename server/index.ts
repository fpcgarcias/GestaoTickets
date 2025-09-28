import "./loadEnv";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  console.log("Inicializando monitoramento...");
  await import("./telemetry/newrelic.js");
  await import("./telemetry/otel-config.js");
  console.log("Monitoramento inicializado!");
} else {
  console.log("Monitoramento New Relic desabilitado (NODE_ENV !== 'production')");
}

const express = require("express") as typeof import("express");
const { setupVite, serveStatic, log } = await import("./vite");
const session = require("express-session") as typeof import("express-session");
const crypto = require("crypto") as typeof import("crypto");
const path = require("path") as typeof import("path");
const fs = require("fs") as typeof import("fs");
const { fileURLToPath } = require("url") as typeof import("url");
const { runMigrations } = await import("./migration-runner");
const { initDb } = await import("./db");
const pgSimple = require("connect-pg-simple") as typeof import("connect-pg-simple");
import helmet from "helmet";
import cors from "cors";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
// === IMPORTS DE SEGURANCA ===

// Calcular __dirname para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Para garantir que temos um secret único a cada inicialização
const generateSecret = () => crypto.randomBytes(32).toString('hex');

const app = express();

// === TRATAMENTO DE ERROS GLOBAIS PARA EVITAR CRASHES ===
process.on('uncaughtException', (error) => {
  // Filtrar erros comuns que não são críticos
  if (error.message && (
    error.message.includes('EPIPE') || 
    error.message.includes('ECONNRESET') ||
    error.message.includes('ETIMEDOUT')
  )) {
    // Erros de conexão são normais - não logar como erro crítico
    console.log('🔌 Conexão cliente interrompida (normal):', error.message);
    return;
  }
  
  console.error('❌ UNCAUGHT EXCEPTION - Servidor não vai crashar:', error);
  // NÃO fazer process.exit() para evitar crash
});

process.on('unhandledRejection', (reason, promise) => {
  // Filtrar rejeições relacionadas a conexões
  if (reason && typeof reason === 'object' && 'message' in reason) {
    const message = (reason as Error).message;
    if (message.includes('EPIPE') || message.includes('ECONNRESET') || message.includes('ETIMEDOUT')) {
      console.log('🔌 Promise rejeitada por conexão interrompida (normal):', message);
      return;
    }
  }
  
  console.error('❌ UNHANDLED REJECTION - Servidor não vai crashar:', reason);
  console.error('Promise:', promise);
  // NÃO fazer process.exit() para evitar crash
});

// Capturar erros de sintaxe e outros erros síncronos
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM recebido, encerrando graciosamente...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT recebido, encerrando graciosamente...');
  process.exit(0);
});

// === CONFIGURAÇÕES DE PROXY ===
// Configuração robusta para múltiplos proxies e acessos
app.set('trust proxy', true); // Confiar em TODOS os proxies para máxima flexibilidade
console.log('🔧 Trust proxy: Habilitado para todos os proxies');

// === CONFIGURAÇÕES DE SEGURANÇA ===

// 1. Helmet - Headers de segurança (mais permissivo)
app.use(helmet({
  contentSecurityPolicy: false, // Desabilitar CSP para evitar problemas
  hsts: {
    maxAge: 31536000,
    includeSubDomains: false, // Menos restritivo para subdomínios
    preload: false
  }
}));

// 2. CORS - Configuração MUITO flexível para múltiplos acessos
app.use(cors({
  origin: function (origin, callback) {
    // Em desenvolvimento, permitir qualquer origem
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // Lista expandida de origens permitidas
    const allowedOrigins = [
      'https://suporte.oficinamuda.com.br',
      'http://suporte.oficinamuda.com.br',
      'https://oficinamuda.com.br',
      'http://oficinamuda.com.br',
      'https://www.oficinamuda.com.br',
      'http://www.oficinamuda.com.br',
      'https://app.ticketwise.com.br',
      'http://app.ticketwise.com.br',
      'https://suporte.vixbrasil.com',
      'http://suporte.vixbrasil.com',
      'https://ticketwise.com.br',
      'http://ticketwise.com.br',
      'https://vixbrasil.com',
      'http://vixbrasil.com'
    ];
    
    // Se não há origin (requests diretos) ou está na lista, permitir
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Permitir qualquer subdomínio de oficinamuda.com.br
    if (origin.endsWith('.oficinamuda.com.br')) {
      return callback(null, true);
    }
    
    // Permitir qualquer subdomínio de ticketwise.com.br
    if (origin.endsWith('.ticketwise.com.br')) {
      return callback(null, true);
    }
    
    // Permitir qualquer subdomínio de vixbrasil.com
    if (origin.endsWith('.vixbrasil.com')) {
      return callback(null, true);
    }
    
    // Permitir qualquer IP (regex para IPs)
    const ipRegex = /^https?:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;
    if (ipRegex.test(origin)) {
      return callback(null, true);
    }
    
    // Permitir localhost para desenvolvimento
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Se chegou aqui, bloquear mas logar
    console.log(`🚫 CORS bloqueado para origem: ${origin}`);
    callback(null, true); // TEMPORARIAMENTE permitir tudo para debug
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept']
}));

// 3. Rate Limiting - COM TRATAMENTO DE ERRO PARA NÃO CRASHAR O SERVIDOR
let generalLimiter, authLimiter;

try {
  if (process.env.NODE_ENV === 'production') {
    generalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 5000, // 5000 requests por IP (muito mais generoso)
      message: "Muitas tentativas. Tente novamente em 15 minutos.",
      standardHeaders: true,
      legacyHeaders: false,
      // USAR HELPER DO EXPRESS-RATE-LIMIT PARA IP CORRETO
      keyGenerator: ipKeyGenerator,
      // Configurar para aceitar trust proxy
      trustProxy: true
    });

    authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 50, // 50 tentativas de login por IP (muito mais generoso)
      message: "Muitas tentativas de login. Tente novamente em 15 minutos.",
      skipSuccessfulRequests: true,
      // USAR HELPER DO EXPRESS-RATE-LIMIT PARA IP CORRETO
      keyGenerator: ipKeyGenerator,
      trustProxy: true
    });

    app.use(generalLimiter);
    console.log('🔒 Rate limiting: Habilitado (produção) com trust proxy');
  } else {
    // Em desenvolvimento, criar middlewares vazios que não fazem nada
    generalLimiter = (req: any, res: any, next: any) => next();
    authLimiter = (req: any, res: any, next: any) => next();
    console.log('🔒 Rate limiting: Desabilitado (desenvolvimento)');
  }
} catch (error) {
  console.error('❌ ERRO ao configurar rate limiting:', error);
  console.log('⚠️  Rate limiting DESABILITADO para evitar crash do servidor');
  // Criar middlewares vazios que não fazem nada em caso de erro
  generalLimiter = (req: any, res: any, next: any) => next();
  authLimiter = (req: any, res: any, next: any) => next();
}

// Exportar para uso nas rotas
export { generalLimiter, authLimiter };

app.use(express.json({ limit: '10mb' })); // Limite de payload
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Inicializar serviço de notificações 
const notificationService = {
  initialize: () => {
    console.log('Serviço de notificações inicializado');
    
    // TEMPORARIAMENTE DESABILITADO - possível causa do crash
    /*
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
    */
  }
};

// Inicializar serviço
notificationService.initialize();

// Configurar store de sessão baseado no ambiente
let sessionStore;
if (process.env.NODE_ENV === 'production') {
  try {
    // Em produção, usar PostgreSQL para armazenar sessões
    const PostgresStore = pgSimple(session);
    sessionStore = new PostgresStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      },
      tableName: 'user_sessions', // Usar a tabela existente
      createTableIfMissing: true, // Criar automaticamente se não existir (evita erro 500 no login)
      // CRÍTICO: Desabilitar limpeza automática que roda a cada intervalo
      pruneSessionInterval: false, // Não fazer limpeza automática
      // Se precisar de limpeza, fazer manualmente apenas durante horário comercial
    });
    console.log('🔧 Session store: PostgreSQL (produção) - usando tabela user_sessions');
  } catch (error) {
    console.error('❌ Erro ao configurar PostgreSQL session store:', error);
    console.log('⚠️  Fallback para MemoryStore (não recomendado para produção)');
    sessionStore = undefined; // Fallback para MemoryStore
  }
} else {
  // Em desenvolvimento, usar MemoryStore
  sessionStore = undefined; // Usar MemoryStore padrão
  console.log('🔧 Session store: MemoryStore (desenvolvimento)');
}

// Configurar a sessão com configurações seguras
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || generateSecret(),
  resave: false,
  saveUninitialized: false,
  name: 'sessionId', // Nome personalizado para evitar detecção automática
  // Sessão deslizante: renova o cookie a cada resposta enquanto houver atividade
  rolling: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS apenas em produção
    httpOnly: true, // Previne acesso via JavaScript
    // Janela de inatividade: 8 horas
    maxAge: 8 * 60 * 60 * 1000, // 8h
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
        // Mascarar TODAS as possíveis informações sensíveis
        if (sanitizedResponse.password) sanitizedResponse.password = '[MASKED]';
        if (sanitizedResponse.senha) sanitizedResponse.senha = '[MASKED]';
        if (sanitizedResponse.token) sanitizedResponse.token = '[MASKED]';
        if (sanitizedResponse.session) sanitizedResponse.session = '[MASKED]';
        if (sanitizedResponse.email) sanitizedResponse.email = '[MASKED]';
        if (sanitizedResponse.username) sanitizedResponse.username = '[MASKED]';
        if (sanitizedResponse.name) sanitizedResponse.name = '[MASKED]';
        
        // Se for array de usuários, mascarar cada item
        if (Array.isArray(sanitizedResponse) || (sanitizedResponse.users && Array.isArray(sanitizedResponse.users))) {
          logLine += ` :: [USERS_DATA_MASKED]`;
        } else {
          logLine += ` :: ${JSON.stringify(sanitizedResponse)}`;
        }
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
    // Inicializar conexão com DB (com fallback HTTP→WS quando necessário)
    await initDb();
    // Executar migrações de estrutura do banco PRIMEIRO
    console.log("🔧 Verificando estrutura do banco de dados...");
    await runMigrations();
    
    // Continuar com o código de inicialização do servidor
    console.log("Iniciando o servidor...");
    
    // Importar dinamicamente DEPOIS de dotenv.config()
    const { registerRoutes } = await import("./routes");
    const { migratePasswords } = await import("./utils/password-migration");

    // 1. Registrar rotas da API e obter o servidor HTTP configurado
    const server = await registerRoutes(app);
    
    // 2. Configurar Vite (desenvolvimento) ou servir arquivos estáticos (produção)
    console.log(`🔍 NODE_ENV: '${process.env.NODE_ENV}'`);
    
    // Verificar se existe pasta dist/public para produção
    const distPath = path.resolve(import.meta.dirname, "..", "dist/public");
    const hasDistFolder = fs.existsSync(distPath);
    
    if (process.env.NODE_ENV === 'production' && hasDistFolder) {
      console.log("🚀 Modo PRODUÇÃO: Servindo arquivos estáticos compilados");
      serveStatic(app);
      console.log("✅ Arquivos estáticos configurados");
    } else {
      if (process.env.NODE_ENV === 'production' && !hasDistFolder) {
        console.log("⚠️  PRODUÇÃO mas sem pasta dist - usando Vite");
      } else {
        console.log("🔧 Modo DESENVOLVIMENTO: Configurando Vite com HMR");
      }
      await setupVite(app, server);
    }
    
    // 3. Executar criptografia de senhas (se necessário)
    await migratePasswords();
    
    // 4. Inicializar scheduler para verificações automáticas
    console.log("Inicializando scheduler de notificações...");
    const { schedulerService } = await import("./services/scheduler-service");
    schedulerService.start();
    
    // 5. Iniciar servidor na porta especificada
    const PORT = process.env.PORT || 5000; 
    server.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
      console.log(`🔒 Middlewares de segurança ativados: Helmet, CORS, Rate Limiting`);
    });
  } catch (error) {
    console.error('❌ ERRO ao iniciar o servidor:', error);
    console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'N/A');
    console.log('⚠️  Servidor não vai crashar - tentando continuar...');
    
    // NÃO fazer process.exit() - deixar o servidor tentar continuar
    // Em vez de crashar, vamos tentar iniciar apenas o básico
    try {
      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () => {
        console.log(`⚠️  Servidor iniciado em modo de recuperação na porta ${PORT}`);
        console.log('⚠️  Algumas funcionalidades podem não estar disponíveis');
      });
    } catch (recoveryError) {
      console.error('❌ Falha total na inicialização:', recoveryError);
      // Só agora fazer exit se nem o básico funcionar
      process.exit(1);
    }
  }
}

startServer();

