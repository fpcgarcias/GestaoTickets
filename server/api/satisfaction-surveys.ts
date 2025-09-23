import { Request, Response } from 'express';
import { db } from '../db';
import { satisfactionSurveys, companies, tickets } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

// Schema de validação para resposta da pesquisa
const satisfactionResponseSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comments: z.string().optional().nullable(),
}).refine((data) => {
  // Se a avaliação for 1 ou 2 estrelas, comentário é obrigatório
  if ((data.rating === 1 || data.rating === 2)) {
    return data.comments && data.comments.trim().length > 0;
  }
  return true;
}, {
  message: "Comentário é obrigatório para avaliações de 1 ou 2 estrelas",
  path: ["comments"]
});

// GET /api/satisfaction-surveys/:token - Obter dados da pesquisa
export async function GET(req: Request, res: Response) {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ message: 'Token é obrigatório' });
    }

    console.log(`[📊 SATISFACTION API] 🔍 VERSÃO CORRIGIDA - Buscando pesquisa com token: ${token}`);

    // Buscar pesquisa de satisfação usando SQL template literal
    const surveyResult = await db.execute(sql`
      SELECT * FROM satisfaction_surveys 
      WHERE survey_token = ${token} 
      LIMIT 1
    `);
    
    const survey = surveyResult.rows[0];

    if (!survey) {
      console.log(`[📊 SATISFACTION API] ❌ Pesquisa não encontrada para token: ${token}`);
      return res.status(404).json({ message: 'Pesquisa de satisfação não encontrada' });
    }

    // Verificar se a pesquisa expirou
    const now = new Date();
    if (survey.expires_at && survey.expires_at < now) {
      console.log(`[📊 SATISFACTION API] ⏰ Pesquisa expirada: ${token}`);
      
      // Marcar como expirada se ainda não foi
      if (survey.status !== 'expired') {
        await db
          .update(satisfactionSurveys)
          .set({ status: 'expired' })
          .where(eq(satisfactionSurveys.id, survey.id));
      }
      
      return res.status(410).json({ message: 'Esta pesquisa de satisfação expirou' });
    }

    // Verificar se já foi respondida
    if (survey.status === 'responded') {
      console.log(`[📊 SATISFACTION API] ✅ Pesquisa já respondida: ${token}`);
      return res.status(409).json({ 
        message: 'Esta pesquisa já foi respondida',
        already_responded: true,
        response: {
          rating: survey.rating,
          comments: survey.comments,
          responded_at: survey.responded_at
        }
      });
    }

    // Buscar dados da empresa para personalização
    const companyResult = await db.execute(sql`
      SELECT * FROM companies 
      WHERE id = ${survey.company_id} 
      LIMIT 1
    `);
    
    const company = companyResult.rows[0];

    // Definir cores baseadas no domínio (igual ao email-notification-service.ts)
    let themeColors = {
      primary: '#3B82F6',
      secondary: '#F3F4F6',
      accent: '#10B981',
      background: '#F9FAFB',
      text: '#111827'
    };

    if (company?.domain) {
      // Detectar tema pelo domínio (seguindo lógica do index.html)
      if (company.domain.includes('vixbrasil.com')) {
        // Tema VIX (amarelo/dourado)
        themeColors = {
          primary: '#D4A017',      // hsl(45, 93%, 47%)
          secondary: '#F5F5DC',    // hsl(45, 20%, 95%)
          accent: '#F0E68C',       // hsl(45, 50%, 90%)
          background: '#FFFEF7',   // hsl(45, 10%, 98%)
          text: '#2F2F1F'          // hsl(45, 20%, 15%)
        };
      } else if (company.domain.includes('oficinamuda.com')) {
        // Tema Oficina Muda (azul escuro)
        themeColors = {
          primary: '#005A8B',      // hsl(200, 100%, 35%)
          secondary: '#E6F3FF',    // hsl(200, 20%, 95%)
          accent: '#CCE7FF',       // hsl(200, 50%, 90%)
          background: '#F7FBFF',   // hsl(200, 10%, 98%)
          text: '#1A2B33'          // hsl(200, 20%, 15%)
        };
      }
    }

    console.log(`[📊 SATISFACTION API] ✅ Pesquisa encontrada e válida: ${token}`);
    console.log(`[📊 SATISFACTION API] 🎨 Tema aplicado: ${company?.domain?.includes('vixbrasil.com') ? 'VIX' : company?.domain?.includes('oficinamuda.com') ? 'Oficina Muda' : 'TicketWise'}`);

    res.json({
      survey: {
        id: survey.id,
        ticket_id: survey.ticket_id,
        customer_email: survey.customer_email,
        sent_at: survey.sent_at,
        expires_at: survey.expires_at,
        status: survey.status
      },
      company: company ? {
        name: company.name,
        colors: themeColors,
        domain: company.domain
      } : null
    });

  } catch (error) {
    console.error(`[📊 SATISFACTION API] ❌ Erro ao buscar pesquisa:`, error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

// POST /api/satisfaction-surveys/:token - Enviar resposta da pesquisa
export async function POST(req: Request, res: Response) {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ message: 'Token é obrigatório' });
    }

    // Validar dados da resposta
    const validationResult = satisfactionResponseSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Dados inválidos',
        errors: validationResult.error.errors
      });
    }

    const { rating, comments } = validationResult.data;

    console.log(`[📊 SATISFACTION API] 📝 Recebendo resposta para token: ${token}`, { rating, comments: comments?.substring(0, 50) });

    // Buscar pesquisa de satisfação
    const [survey] = await db
      .select()
      .from(satisfactionSurveys)
      .where(eq(satisfactionSurveys.survey_token, token))
      .limit(1);

    if (!survey) {
      console.log(`[📊 SATISFACTION API] ❌ Pesquisa não encontrada para token: ${token}`);
      return res.status(404).json({ message: 'Pesquisa de satisfação não encontrada' });
    }

    // Verificar se a pesquisa expirou
    const now = new Date();
    if (survey.expires_at && survey.expires_at < now) {
      console.log(`[📊 SATISFACTION API] ⏰ Tentativa de resposta em pesquisa expirada: ${token}`);
      
      // Marcar como expirada se ainda não foi
      if (survey.status !== 'expired') {
        await db
          .update(satisfactionSurveys)
          .set({ status: 'expired' })
          .where(eq(satisfactionSurveys.id, survey.id));
      }
      
      return res.status(410).json({ message: 'Esta pesquisa de satisfação expirou' });
    }

    // Verificar se já foi respondida
    if (survey.status === 'responded') {
      console.log(`[📊 SATISFACTION API] ⚠️ Tentativa de resposta duplicada: ${token}`);
      return res.status(409).json({ 
        message: 'Esta pesquisa já foi respondida',
        already_responded: true
      });
    }

    // Salvar resposta
    const [updatedSurvey] = await db
      .update(satisfactionSurveys)
      .set({
        rating,
        comments: comments || null,
        responded_at: now,
        status: 'responded'
      })
      .where(eq(satisfactionSurveys.id, survey.id))
      .returning();

    console.log(`[📊 SATISFACTION API] ✅ Resposta salva com sucesso: ${token}`, { 
      rating, 
      survey_id: updatedSurvey.id 
    });

    // Buscar dados da empresa para resposta personalizada
    const companyResult = await db.execute(sql`
      SELECT * FROM companies 
      WHERE id = ${survey.company_id} 
      LIMIT 1
    `);
    
    const company = companyResult.rows[0];

    res.json({
      message: 'Resposta enviada com sucesso!',
      survey: {
        id: updatedSurvey.id,
        rating: updatedSurvey.rating,
        comments: updatedSurvey.comments,
        responded_at: updatedSurvey.responded_at
      },
      company_name: company?.name || 'Sistema de Tickets'
    });

  } catch (error) {
    console.error(`[📊 SATISFACTION API] ❌ Erro ao salvar resposta:`, error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}
