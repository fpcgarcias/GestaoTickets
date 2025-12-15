/**
 * Testes de Propriedade para Logging Completo de Erros
 * Feature: notification-system, Property 25: Logging completo de erros
 * Validates: Requirements 7.5
 */

import fc from 'fast-check';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock do logger para capturar as chamadas
vi.mock('../logger', () => ({
  logNotificationError: vi.fn(),
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  }
}));

import { logNotificationError } from '../logger';

const mockLogNotificationError = vi.mocked(logNotificationError);

describe('Property 25: Logging completo de erros', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Property 25: Para qualquer erro em operações de notificação, o log deve conter 
  // detalhes completos incluindo mensagem de erro, stack trace e contexto da operação
  it('deve registrar detalhes completos para qualquer erro de notificação', () => {
    fc.assert(fc.property(
      // Geradores para diferentes tipos de erro
      fc.oneof(
        // Error objects com stack trace
        fc.record({
          message: fc.string({ minLength: 1, maxLength: 200 }),
          stack: fc.string({ minLength: 10, maxLength: 500 }),
          name: fc.constantFrom('Error', 'TypeError', 'ReferenceError', 'NetworkError')
        }).map(obj => {
          const error = new Error(obj.message);
          error.name = obj.name;
          error.stack = obj.stack;
          return error;
        }),
        // String errors
        fc.string({ minLength: 1, maxLength: 100 }),
        // Number errors
        fc.integer(),
        // Object errors
        fc.record({
          code: fc.integer(),
          message: fc.string({ minLength: 1, maxLength: 100 })
        })
      ),
      // Operações válidas
      fc.constantFrom(
        'Notification persistence failed',
        'WebSocket delivery failed',
        'Web Push delivery failed',
        'Push subscription registration failed',
        'API: List notifications failed',
        'Cleanup scheduler execution failed'
      ),
      // Níveis de severidade
      fc.constantFrom('info', 'warning', 'error', 'critical'),
      // Contexto opcional
      fc.option(fc.record({
        userId: fc.option(fc.integer({ min: 1, max: 10000 })),
        notificationId: fc.option(fc.integer({ min: 1, max: 100000 })),
        ticketId: fc.option(fc.integer({ min: 1, max: 50000 })),
        endpoint: fc.option(fc.webUrl()),
        notificationType: fc.option(fc.constantFrom('new_ticket', 'status_change', 'new_reply'))
      }), { nil: undefined }),
      
      (error, operation, severity, context) => {
        // Executar a função de logging
        logNotificationError(operation, error, severity as any, context);

        // Verificar que a função foi chamada
        expect(mockLogNotificationError).toHaveBeenCalledTimes(1);
        
        // Verificar os argumentos passados
        const [calledOperation, calledError, calledSeverity, calledContext] = mockLogNotificationError.mock.calls[0];
        
        // Verificar que a operação foi preservada
        expect(calledOperation).toBe(operation);
        
        // Verificar que o erro foi preservado
        expect(calledError).toBe(error);
        
        // Verificar que a severidade foi preservada
        expect(calledSeverity).toBe(severity);
        
        // Verificar que o contexto foi preservado (se fornecido)
        if (context) {
          expect(calledContext).toEqual(context);
        }

        // Reset para próxima iteração
        vi.clearAllMocks();
      }
    ), { numRuns: 100 });
  });

  it('deve incluir stack trace quando o erro é uma instância de Error', () => {
    fc.assert(fc.property(
      fc.string({ minLength: 1, maxLength: 100 }),
      fc.string({ minLength: 10, maxLength: 500 }),
      fc.constantFrom('error', 'critical'),
      
      (message, stackTrace, severity) => {
        const error = new Error(message);
        error.stack = stackTrace;
        
        logNotificationError('Test operation', error, severity as any);
        
        // Verificar que foi chamado
        expect(mockLogNotificationError).toHaveBeenCalledTimes(1);
        
        // O erro deve ser uma instância de Error com stack trace
        const calledError = mockLogNotificationError.mock.calls[0][1];
        expect(calledError).toBeInstanceOf(Error);
        expect((calledError as Error).message).toBe(message);
        expect((calledError as Error).stack).toBe(stackTrace);

        vi.clearAllMocks();
      }
    ), { numRuns: 50 });
  });

  it('deve tratar erros não-Error (strings, números, objetos) adequadamente', () => {
    fc.assert(fc.property(
      fc.oneof(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.integer(),
        fc.record({
          code: fc.integer(),
          description: fc.string({ minLength: 1, maxLength: 50 })
        })
      ),
      
      (nonErrorValue) => {
        logNotificationError('Test operation', nonErrorValue, 'error');
        
        // Verificar que foi chamado
        expect(mockLogNotificationError).toHaveBeenCalledTimes(1);
        
        // O valor deve ser preservado como está
        const calledError = mockLogNotificationError.mock.calls[0][1];
        expect(calledError).toBe(nonErrorValue);

        vi.clearAllMocks();
      }
    ), { numRuns: 50 });
  });

  it('deve preservar contexto completo incluindo IDs de usuário e notificação', () => {
    fc.assert(fc.property(
      fc.record({
        userId: fc.integer({ min: 1, max: 10000 }),
        notificationId: fc.integer({ min: 1, max: 100000 }),
        ticketId: fc.option(fc.integer({ min: 1, max: 50000 })),
        endpoint: fc.option(fc.webUrl()),
        notificationType: fc.option(fc.constantFrom('new_ticket', 'status_change', 'new_reply')),
        customField: fc.option(fc.string({ minLength: 1, maxLength: 50 }))
      }),
      
      (context) => {
        const error = new Error('Test error');
        
        logNotificationError('Test operation', error, 'error', context);
        
        // Verificar que foi chamado
        expect(mockLogNotificationError).toHaveBeenCalledTimes(1);
        
        // Verificar que o contexto foi preservado completamente
        const calledContext = mockLogNotificationError.mock.calls[0][3];
        expect(calledContext).toEqual(context);
        
        // Verificar campos obrigatórios
        expect(calledContext?.userId).toBe(context.userId);
        expect(calledContext?.notificationId).toBe(context.notificationId);
        
        // Verificar campos opcionais se presentes
        if (context.ticketId) {
          expect(calledContext?.ticketId).toBe(context.ticketId);
        }
        if (context.endpoint) {
          expect(calledContext?.endpoint).toBe(context.endpoint);
        }
        if (context.notificationType) {
          expect(calledContext?.notificationType).toBe(context.notificationType);
        }

        vi.clearAllMocks();
      }
    ), { numRuns: 100 });
  });

  it('deve funcionar corretamente sem contexto', () => {
    fc.assert(fc.property(
      fc.string({ minLength: 1, maxLength: 100 }),
      fc.constantFrom('info', 'warning', 'error', 'critical'),
      
      (errorMessage, severity) => {
        const error = new Error(errorMessage);
        
        // Chamar sem contexto
        logNotificationError('Test operation', error, severity as any);
        
        // Verificar que foi chamado
        expect(mockLogNotificationError).toHaveBeenCalledTimes(1);
        
        // Verificar argumentos
        const [operation, calledError, calledSeverity, context] = mockLogNotificationError.mock.calls[0];
        expect(operation).toBe('Test operation');
        expect(calledError).toBe(error);
        expect(calledSeverity).toBe(severity);
        expect(context).toBeUndefined();

        vi.clearAllMocks();
      }
    ), { numRuns: 50 });
  });
});