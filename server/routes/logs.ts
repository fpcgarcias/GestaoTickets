import express, { Request, Response, NextFunction } from 'express';
import { 
  listLogFiles, 
  readLogFile, 
  downloadLogFile, 
  getLogStats 
} from '../api/logs';

const router = express.Router();

// Middleware para verificar se o usuário está autenticado
function authRequired(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  next();
}

// Middleware para verificar se o usuário é admin
function adminRequired(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId || req.session.userRole !== 'admin') {
    return res.status(403).json({ message: "Acesso negado: Requer perfil de Administrador" });
  }
  next();
}

// === ROTAS DE LOGS DO SISTEMA ===

// Listar arquivos de log disponíveis (apenas admin)
router.get("/", authRequired, adminRequired, listLogFiles);

// Estatísticas dos logs (apenas admin) - DEVE VIR ANTES DAS ROTAS COM PARÂMETROS
router.get("/stats", authRequired, adminRequired, getLogStats);

// Download de arquivo de log (apenas admin)
router.get("/:filename/download", authRequired, adminRequired, downloadLogFile);

// Ler conteúdo de um arquivo de log (apenas admin) - DEVE VIR POR ÚLTIMO
router.get("/:filename", authRequired, adminRequired, readLogFile);

export default router; 