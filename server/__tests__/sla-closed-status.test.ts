/**
 * Testes para lógica de SLA com status "closed"
 * Feature: status-encerrado
 * Task: 17.1 Modificar cálculos de SLA
 * 
 * Valida: Requisitos 10.1, 10.2, 10.3
 */

import { describe, it, expect } from 'vitest';
import { isSlaFinished, isSlaPaused, isSlaActive, SLA_FINISHED_STATUSES } from '../../shared/ticket-utils';
import { calculateSLAStatus, getBusinessHoursConfig } from '../../shared/utils/sla-calculator';
import type { TicketStatus } from '../../shared/ticket-utils';

describe('SLA - Status "closed"', () => {
  describe('Requisito 10.1: SLA para quando status muda para "closed"', () => {
    it('deve incluir "closed" em SLA_FINISHED_STATUSES', () => {
      expect(SLA_FINISHED_STATUSES).toContain('closed');
      expect(SLA_FINISHED_STATUSES).toContain('resolved');
    });

    it('isSlaFinished deve retornar true para status "closed"', () => {
      expect(isSlaFinished('closed')).toBe(true);
    });

    it('isSlaFinished deve retornar true para status "resolved"', () => {
      expect(isSlaFinished('resolved')).toBe(true);
    });

    it('isSlaFinished deve retornar false para status ativos', () => {
      const activeStatuses: TicketStatus[] = ['new', 'ongoing', 'in_analysis', 'reopened'];
      
      for (const status of activeStatuses) {
        expect(isSlaFinished(status)).toBe(false);
      }
    });

    it('calculateSLAStatus deve marcar SLA como finalizado quando currentStatus é "closed"', () => {
      const ticketCreated = new Date(2024, 0, 8, 10, 0, 0); // Segunda 10h
      const currentTime = new Date(2024, 0, 8, 12, 0, 0);   // Segunda 12h
      
      const slaResult = calculateSLAStatus(
        ticketCreated,
        4, // 4 horas de SLA
        currentTime,
        undefined, // sem resolvedAt explícito
        getBusinessHoursConfig(),
        [],
        'closed' // status atual é closed
      );
      
      // O SLA deve estar finalizado (não pausado, mas finalizado)
      expect(slaResult.isPaused).toBe(false);
      // O tempo deve ter sido calculado até currentTime
      expect(slaResult.timeElapsed).toBeGreaterThan(0);
    });
  });

  describe('Requisito 10.2: SLA é marcado como finalizado para status "closed"', () => {
    it('status "closed" não deve estar em SLA_PAUSED_STATUSES', () => {
      expect(isSlaPaused('closed')).toBe(false);
    });

    it('status "closed" não deve estar em SLA_ACTIVE_STATUSES', () => {
      expect(isSlaActive('closed')).toBe(false);
    });

    it('calculateSLAStatus deve usar resolvedAt quando fornecido para status "closed"', () => {
      const ticketCreated = new Date(2024, 0, 8, 10, 0, 0);  // Segunda 10h
      const resolvedAt = new Date(2024, 0, 8, 12, 0, 0);     // Segunda 12h (2h depois)
      const currentTime = new Date(2024, 0, 8, 15, 0, 0);    // Segunda 15h (5h depois)
      
      const slaResult = calculateSLAStatus(
        ticketCreated,
        4, // 4 horas de SLA
        currentTime,
        resolvedAt, // fornecido explicitamente
        getBusinessHoursConfig(),
        [],
        'closed'
      );
      
      // O tempo deve ser calculado até resolvedAt, não até currentTime
      const expectedTimeMs = 2 * 60 * 60 * 1000; // 2 horas em ms
      expect(slaResult.timeElapsed).toBe(expectedTimeMs);
      expect(slaResult.percentConsumed).toBe(50); // 2h de 4h = 50%
    });
  });

  describe('Requisito 10.3: SLA reinicia se status sai de "closed" para status ativo', () => {
    it('status "reopened" deve estar em SLA_ACTIVE_STATUSES', () => {
      expect(isSlaActive('reopened')).toBe(true);
    });

    it('status "ongoing" deve estar em SLA_ACTIVE_STATUSES', () => {
      expect(isSlaActive('ongoing')).toBe(true);
    });

    it('calculateSLAStatus deve calcular SLA normalmente para status ativo após "closed"', () => {
      const ticketCreated = new Date(2024, 0, 8, 10, 0, 0); // Segunda 10h
      const currentTime = new Date(2024, 0, 8, 13, 0, 0);   // Segunda 13h
      
      // Simular que o ticket foi reaberto (status ativo)
      const slaResult = calculateSLAStatus(
        ticketCreated,
        4, // 4 horas de SLA
        currentTime,
        undefined, // sem resolvedAt (ticket ativo)
        getBusinessHoursConfig(),
        [],
        'reopened' // status ativo
      );
      
      // O SLA deve estar ativo (não pausado, não finalizado)
      expect(slaResult.isPaused).toBe(false);
      expect(isSlaFinished('reopened')).toBe(false);
      
      // O tempo deve continuar contando
      const expectedTimeMs = 3 * 60 * 60 * 1000; // 3 horas em ms
      expect(slaResult.timeElapsed).toBe(expectedTimeMs);
      expect(slaResult.percentConsumed).toBe(75); // 3h de 4h = 75%
    });

    it('calculateSLAStatus deve considerar histórico de status ao calcular SLA após reabertura', () => {
      const ticketCreated = new Date(2024, 0, 8, 10, 0, 0);  // Segunda 10h
      const closedAt = new Date(2024, 0, 8, 12, 0, 0);       // Segunda 12h (fechado após 2h)
      const reopenedAt = new Date(2024, 0, 8, 14, 0, 0);     // Segunda 14h (reaberto 2h depois)
      const currentTime = new Date(2024, 0, 8, 15, 0, 0);    // Segunda 15h (1h após reabertura)
      
      const statusPeriods = [
        {
          status: 'new' as TicketStatus,
          startTime: ticketCreated,
          endTime: new Date(2024, 0, 8, 11, 0, 0) // 1h como new
        },
        {
          status: 'ongoing' as TicketStatus,
          startTime: new Date(2024, 0, 8, 11, 0, 0),
          endTime: closedAt // 1h como ongoing
        },
        {
          status: 'closed' as TicketStatus,
          startTime: closedAt,
          endTime: reopenedAt // 2h como closed (não conta)
        },
        {
          status: 'reopened' as TicketStatus,
          startTime: reopenedAt,
          endTime: currentTime // 1h como reopened
        }
      ];
      
      const slaResult = calculateSLAStatus(
        ticketCreated,
        4, // 4 horas de SLA
        currentTime,
        undefined, // sem resolvedAt (ticket ativo)
        getBusinessHoursConfig(),
        statusPeriods,
        'reopened'
      );
      
      // Tempo total: 1h (new) + 1h (ongoing) + 1h (reopened) = 3h
      // O período "closed" não deve contar
      const expectedTimeMs = 3 * 60 * 60 * 1000; // 3 horas em ms
      expect(slaResult.timeElapsed).toBe(expectedTimeMs);
      expect(slaResult.percentConsumed).toBe(75); // 3h de 4h = 75%
    });
  });

  describe('Integração: Fluxo completo de SLA com status "closed"', () => {
    it('deve calcular SLA corretamente em um fluxo: new → ongoing → closed → reopened', () => {
      const ticketCreated = new Date(2024, 0, 8, 9, 0, 0);   // Segunda 9h
      
      // Períodos de status
      const statusPeriods = [
        {
          status: 'new' as TicketStatus,
          startTime: ticketCreated,
          endTime: new Date(2024, 0, 8, 10, 0, 0) // 1h como new
        },
        {
          status: 'ongoing' as TicketStatus,
          startTime: new Date(2024, 0, 8, 10, 0, 0),
          endTime: new Date(2024, 0, 8, 11, 30, 0) // 1.5h como ongoing
        },
        {
          status: 'closed' as TicketStatus,
          startTime: new Date(2024, 0, 8, 11, 30, 0),
          endTime: new Date(2024, 0, 8, 14, 0, 0) // 2.5h como closed (não conta)
        },
        {
          status: 'reopened' as TicketStatus,
          startTime: new Date(2024, 0, 8, 14, 0, 0),
          endTime: new Date(2024, 0, 8, 15, 0, 0) // 1h como reopened
        }
      ];
      
      const currentTime = new Date(2024, 0, 8, 15, 0, 0); // Segunda 15h
      
      const slaResult = calculateSLAStatus(
        ticketCreated,
        8, // 8 horas de SLA
        currentTime,
        undefined,
        getBusinessHoursConfig(),
        statusPeriods,
        'reopened'
      );
      
      // Tempo total: 1h (new) + 1.5h (ongoing) + 1h (reopened) = 3.5h
      const expectedTimeMs = 3.5 * 60 * 60 * 1000;
      expect(slaResult.timeElapsed).toBe(expectedTimeMs);
      expect(slaResult.percentConsumed).toBeCloseTo(43.75, 0); // 3.5h de 8h ≈ 43.75%
      expect(slaResult.isBreached).toBe(false);
      expect(slaResult.status).toBe('ok');
    });
  });
});
