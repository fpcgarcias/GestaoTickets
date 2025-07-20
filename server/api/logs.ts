import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

interface LogFile {
  name: string;
  size: number;
  modified: Date;
  type: 'combined' | 'error' | 'performance' | 'security';
  version?: number;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  details?: any;
}

// Função para listar arquivos de log
export async function listLogFiles(req: Request, res: Response) {
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    
    if (!fs.existsSync(logsDir)) {
      return res.json([]);
    }

    const files = fs.readdirSync(logsDir)
      .filter(file => file.endsWith('.log'))
      .map(file => {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        
        // Extrair tipo e versão do nome do arquivo
        const match = file.match(/^(.+?)(\d+)?\.log$/);
        const baseName = match?.[1] || file.replace('.log', '');
        const version = match?.[2] ? parseInt(match[2]) : undefined;
        
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime,
          type: baseName as LogFile['type'],
          version
        };
      })
      .sort((a, b) => {
        // Ordenar por tipo primeiro, depois por versão (decrescente)
        if (a.type !== b.type) {
          return a.type.localeCompare(b.type);
        }
        if (a.version !== b.version) {
          return (b.version || 0) - (a.version || 0);
        }
        return b.modified.getTime() - a.modified.getTime();
      });

    res.json(files);
  } catch (error) {
    console.error('Erro ao listar logs:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

// Função para ler conteúdo de um arquivo de log
export async function readLogFile(req: Request, res: Response) {
  try {
    const { filename } = req.params;
    const { page = '1', limit = '1000', level, search, startDate, endDate } = req.query;
    
    // Validar nome do arquivo
    if (!filename || !filename.endsWith('.log')) {
      return res.status(400).json({ message: 'Nome de arquivo inválido' });
    }

    const logsDir = path.join(process.cwd(), 'logs');
    const filePath = path.join(logsDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Arquivo não encontrado' });
    }

    // Verificar tamanho do arquivo (limite de 50MB)
    const stats = fs.statSync(filePath);
    if (stats.size > 50 * 1024 * 1024) {
      return res.status(413).json({ 
        message: 'Arquivo muito grande. Use o download para arquivos maiores que 50MB.' 
      });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // Aplicar filtros
    let filteredLines = lines;
    
    if (level) {
      const levelStr = Array.isArray(level) ? level[0] : level;
      if (levelStr && typeof levelStr === 'string') {
        const levelLower = levelStr.toLowerCase();
        filteredLines = filteredLines.filter(line => {
          const lineLower = line.toLowerCase();
          
          // Verificar diferentes padrões de nível
          return (
            // Padrão JSON: {"level":"error"}
            lineLower.includes(`"level":"${levelLower}"`) ||
            // Padrão brackets: [ERROR]
            lineLower.includes(`[${levelLower}]`) ||
            // Padrão colon: ERROR:
            lineLower.includes(`${levelLower}:`) ||
            // Padrão específico para cada nível
            (levelLower === 'error' && (
              lineLower.includes('validationerror') || 
              lineLower.includes('very slow request') ||
              lineLower.includes('error')
            )) ||
            (levelLower === 'info' && (
              lineLower.includes('express') ||
              lineLower.includes('email prod') ||
              lineLower.includes('ai') ||
              lineLower.includes('ia') ||
              lineLower.includes('info')
            )) ||
            (levelLower === 'warn' && (
              lineLower.includes('warn') ||
              lineLower.includes('warning')
            )) ||
            (levelLower === 'debug' && lineLower.includes('debug'))
          );
        });
      }
    }
    
    if (search) {
      const searchTerm = search.toString().toLowerCase();
      filteredLines = filteredLines.filter(line => 
        line.toLowerCase().includes(searchTerm)
      );
    }
    
    if (startDate || endDate) {
      filteredLines = filteredLines.filter(line => {
        // Tentar extrair data de diferentes formatos
        let lineDate: Date | null = null;
        let lineDateStr = '';
        
        // Padrão 1: {"level":"info", "message":"...", "timestamp":"2025-07-15 22:59:08"}
        const jsonTimestampMatch = line.match(/"timestamp"\s*:\s*"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})"/);
        if (jsonTimestampMatch) {
          lineDateStr = jsonTimestampMatch[1];
          lineDate = new Date(lineDateStr);
        } else {
          // Padrão 2: 2025-07-15 22:59:08 (início da linha)
          const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
          if (timestampMatch) {
            lineDateStr = timestampMatch[1];
            lineDate = new Date(lineDateStr);
          } else {
            // Padrão 3: Procurar por qualquer data no formato YYYY-MM-DD
            const dateMatch = line.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
              lineDateStr = dateMatch[1] + ' 00:00:00';
              lineDate = new Date(lineDateStr);
            }
          }
        }
        
        if (!lineDate || isNaN(lineDate.getTime())) {
          return true; // Se não conseguir extrair data, incluir na lista
        }
        
        // Extrair apenas a data (YYYY-MM-DD) para comparação
        const lineDateOnly = lineDateStr.split(' ')[0];
        
        // Aplicar filtros de data
        if (startDate) {
          const startDateStr = startDate.toString();
          if (lineDateOnly < startDateStr) {
            return false;
          }
        }
        
        if (endDate) {
          const endDateStr = endDate.toString();
          if (lineDateOnly > endDateStr) {
            return false;
          }
        }
        
        return true;
      });
    }

    // Paginação
    const pageNum = parseInt(page.toString());
    const limitNum = parseInt(limit.toString());
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedLines = filteredLines.slice(startIndex, endIndex);

    // Processar linhas para extrair informações estruturadas
    const entries: LogEntry[] = paginatedLines.map(line => {
      // Tentar extrair timestamp de diferentes formatos
      let timestamp = '';
      
      // Padrão 1: {"level":"info", "message":"...", "timestamp":"2025-07-15 22:59:08"}
      const jsonTimestampMatch = line.match(/"timestamp"\s*:\s*"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})"/);
      if (jsonTimestampMatch) {
        timestamp = jsonTimestampMatch[1];
      } else {
        // Padrão 2: 2025-07-17 17:12:15 (padrão ISO no início da linha)
        const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
        if (timestampMatch) {
          timestamp = timestampMatch[1];
        } else {
          // Padrão 3: 5:12:15 PM (formato 12h)
          const timeMatch = line.match(/(\d{1,2}:\d{2}:\d{2} (?:AM|PM))/);
          if (timeMatch) {
            timestamp = timeMatch[1];
          } else {
            // Padrão 4: Procurar por qualquer formato de data/hora
            const anyTimeMatch = line.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
            if (anyTimeMatch) {
              timestamp = anyTimeMatch[1];
            }
          }
        }
      }
      
      // Tentar extrair nível de diferentes formatos
      let level = 'UNKNOWN';
      
      // Padrão 1: {"level":"error", "message":"..."} (JSON)
      const jsonMatch = line.match(/"level"\s*:\s*"([^"]+)"/i);
      if (jsonMatch) {
        level = jsonMatch[1].toUpperCase();
      } else {
        // Padrão 2: [ERROR], [WARN], [INFO], [DEBUG] (brackets)
        const bracketMatch = line.match(/\[(ERROR|WARN|INFO|DEBUG)\]/i);
        if (bracketMatch) {
          level = bracketMatch[1].toUpperCase();
        } else {
          // Padrão 3: ERROR:, WARN:, INFO:, DEBUG: (com dois pontos)
          const colonMatch = line.match(/(ERROR|WARN|INFO|DEBUG)\s*:/i);
          if (colonMatch) {
            level = colonMatch[1].toUpperCase();
          } else {
            // Padrão 4: Procurar por palavras-chave específicas no texto
            const lowerLine = line.toLowerCase();
            if (lowerLine.includes('validationerror') || lowerLine.includes('error') || lowerLine.includes('erro')) {
              level = 'ERROR';
            } else if (lowerLine.includes('warn') || lowerLine.includes('warning')) {
              level = 'WARN';
            } else if (lowerLine.includes('info')) {
              level = 'INFO';
            } else if (lowerLine.includes('debug')) {
              level = 'DEBUG';
            } else if (lowerLine.includes('very slow request')) {
              level = 'ERROR'; // Requests muito lentos são tratados como erro
            } else if (lowerLine.includes('express') && lowerLine.includes('post') || lowerLine.includes('get')) {
              level = 'INFO'; // Requests HTTP são info
            } else if (lowerLine.includes('email prod') || lowerLine.includes('email')) {
              level = 'INFO'; // Logs de email são info
            } else if (lowerLine.includes('ai') || lowerLine.includes('ia')) {
              level = 'INFO'; // Logs de IA são info
            }
          }
        }
      }
      
      return {
        timestamp: timestamp || '',
        level: level,
        message: line,
        details: null
      };
    });


    
    res.json({
      entries,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: filteredLines.length,
        totalPages: Math.ceil(filteredLines.length / limitNum),
        hasNext: endIndex < filteredLines.length,
        hasPrev: pageNum > 1
      },
      fileInfo: {
        name: filename,
        size: stats.size,
        modified: stats.mtime,
        totalLines: lines.length
      }
    });
  } catch (error) {
    console.error('Erro ao ler log:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

// Função para download de arquivo de log
export async function downloadLogFile(req: Request, res: Response) {
  try {
    const { filename } = req.params;
    
    // Validar nome do arquivo
    if (!filename || !filename.endsWith('.log')) {
      return res.status(400).json({ message: 'Nome de arquivo inválido' });
    }

    const logsDir = path.join(process.cwd(), 'logs');
    const filePath = path.join(logsDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Arquivo não encontrado' });
    }

    // Configurar headers para download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/plain');
    
    // Stream do arquivo
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Erro ao fazer download do log:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

// Função para obter estatísticas dos logs
export async function getLogStats(req: Request, res: Response) {
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    
    if (!fs.existsSync(logsDir)) {
      return res.json({
        totalFiles: 0,
        totalSize: 0,
        fileTypes: {},
        recentActivity: []
      });
    }

    const files = fs.readdirSync(logsDir)
      .filter(file => file.endsWith('.log'));
    
    let totalSize = 0;
    const fileTypes: Record<string, number> = {};
    const recentActivity: Array<{name: string, modified: Date, size: number}> = [];
    
    files.forEach(file => {
      const filePath = path.join(logsDir, file);
      const stats = fs.statSync(filePath);
      
      totalSize += stats.size;
      
      const match = file.match(/^(.+?)(\d+)?\.log$/);
      const baseName = match?.[1] || file.replace('.log', '');
      fileTypes[baseName] = (fileTypes[baseName] || 0) + 1;
      
      recentActivity.push({
        name: file,
        modified: stats.mtime,
        size: stats.size
      });
    });
    
    // Ordenar por data de modificação (mais recente primeiro)
    recentActivity.sort((a, b) => b.modified.getTime() - a.modified.getTime());
    
    res.json({
      totalFiles: files.length,
      totalSize,
      fileTypes,
      recentActivity: recentActivity.slice(0, 10) // Últimos 10 arquivos
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas dos logs:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
} 