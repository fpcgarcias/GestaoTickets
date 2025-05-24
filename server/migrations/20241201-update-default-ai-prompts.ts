import { sql } from 'drizzle-orm';
import { db } from '../db';

export async function up() {
  console.log('Migrando: Atualizando prompts padrão das configurações de IA existentes');

  const newSystemPrompt = `Você é um assistente especializado em análise de prioridade de tickets de suporte técnico. Analise o título e descrição do ticket e determine a prioridade apropriada baseada nos seguintes critérios:

CRITICAL: Sistemas completamente fora do ar, falhas de segurança críticas, perda de dados, problemas que afetam múltiplos usuários imediatamente e impedem operações essenciais.

HIGH: Funcionalidades principais não funcionando, problemas que impedem trabalho de usuários específicos, deadlines próximos sendo impactados, falhas que afetam produtividade significativamente.

MEDIUM: Problemas que causam inconveniência mas têm soluções alternativas, funcionalidades secundárias não funcionando, solicitações de melhorias importantes mas não urgentes.

LOW: Dúvidas simples, solicitações de treinamento, melhorias estéticas, configurações pessoais, problemas que não impedem o trabalho.

ATENÇÃO: Responda APENAS com uma das palavras exatas: critical, high, medium ou low (sempre em minúsculas e em inglês).`;

  const newUserPrompt = `Título: {titulo}

Descrição: {descricao}

Prioridade:`;

  // Atualizar todas as configurações existentes
  await db.execute(sql`
    UPDATE ai_configurations 
    SET 
      system_prompt = ${newSystemPrompt},
      user_prompt_template = ${newUserPrompt},
      updated_at = NOW()
    WHERE 
      system_prompt LIKE '%CRÍTICA%' OR 
      system_prompt LIKE '%ALTA%' OR
      system_prompt LIKE '%MÉDIA%' OR
      system_prompt LIKE '%BAIXA%';
  `);

  console.log('Prompts padrão atualizados com sucesso');
}

export async function down() {
  console.log('Revertendo: Restaurando prompts antigos');
  
  const oldSystemPrompt = `Você é um assistente especializado em análise de prioridade de tickets de suporte técnico. Analise o título e descrição do ticket e determine a prioridade apropriada baseada nos seguintes critérios:

CRÍTICA: Sistemas completamente fora do ar, falhas de segurança críticas, perda de dados, problemas que afetam múltiplos usuários imediatamente.

ALTA: Funcionalidades principais não funcionando, problemas que impedem trabalho de usuários específicos, deadlines próximos sendo impactados.

MÉDIA: Problemas que causam inconveniência mas têm alternativas, funcionalidades secundárias não funcionando, solicitações de melhorias importantes.

BAIXA: Dúvidas, solicitações de treinamento, melhorias estéticas, problemas que não impedem o trabalho.

Responda APENAS com uma das palavras: CRÍTICA, ALTA, MÉDIA ou BAIXA. Opcionalmente, adicione uma justificativa breve na linha seguinte.`;

  const oldUserPrompt = `Título: {titulo}

Descrição: {descricao}`;

  await db.execute(sql`
    UPDATE ai_configurations 
    SET 
      system_prompt = ${oldSystemPrompt},
      user_prompt_template = ${oldUserPrompt},
      updated_at = NOW()
    WHERE 
      system_prompt LIKE '%CRITICAL%' OR 
      system_prompt LIKE '%HIGH%' OR
      system_prompt LIKE '%MEDIUM%' OR
      system_prompt LIKE '%LOW%';
  `);
} 