/**
 * Rotas de System Logs — GET /api/system-logs e GET /api/system-logs/stats.
 *
 * Protegidas por authRequired + companyAdminRequired.
 */

import express from 'express';
import { authRequired, companyAdminRequired } from '../middleware/authorization';
import { listSystemLogs, getSystemLogStats } from '../api/logs-api';

const router = express.Router();

// Estatísticas (DEVE vir antes de rotas com parâmetros)
router.get('/stats', authRequired, companyAdminRequired, getSystemLogStats);

// Listagem paginada de logs
router.get('/', authRequired, companyAdminRequired, listSystemLogs);

export default router;
